import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AiOsEngineAdapter,
  createBaselineAdapterSystem,
  MarketingCampaignServiceAdapter,
  OrbitReplyServiceExecutorAdapter,
} from '../src/baseline-adapters.js';

test('AI OS adapter uses the baseline enqueue contract and persists the scheduled state', () => {
  const state = {version: 2, workflows: [], activity: []};
  let writes = 0;
  const engine = {
    enqueue(target, request, type) {
      assert.equal(target, state);
      assert.equal(request, 'Prepare a fictional launch');
      assert.equal(type, 'brief');
      const workflow = {id: 'ai-workflow', tasks: [
        {id: 't1', title: 'Plan', agent: 'planner'},
        {id: 't2', title: 'Write', agent: 'writer'},
      ]};
      target.workflows.push(workflow);
      return workflow;
    },
  };
  const adapter = new AiOsEngineAdapter({engine, repository: {read: () => state, write: value => { assert.equal(value, state); writes += 1; }}});
  const tasks = adapter.schedule({request: 'Prepare a fictional launch'}, {workflowId: 'shared-1'});
  assert.equal(writes, 1);
  assert.deepEqual(tasks.map(task => task.owner), ['ai-os', 'marketing-agent']);
  assert.deepEqual(tasks[1].dependsOn, ['t1']);
  assert.equal(tasks[0].baseline.sharedWorkflowId, 'shared-1');
});

test('Marketing adapter binds exact campaign and version revisions to the shared source', () => {
  const context = {actor: {id: 'demo-dave', name: 'Dave'}, workspaceId: 'work'};
  const campaign = {
    id: 'campaign-1', revision: 3, versions: [
      {id: 'version-1', revision: 2, assets: {launchPost: 'Frozen campaign'}},
    ],
  };
  let createKey;
  const service = {
    createCampaign(receivedContext, input, key) {
      assert.deepEqual(receivedContext, context);
      assert.equal(input.kind, 'campaign');
      assert.equal(input.brief.topic, 'Prepare a fictional launch');
      createKey = key;
      return {ok: true, value: structuredClone(campaign)};
    },
    getCampaign: () => ({ok: true, value: structuredClone(campaign)}),
    listCampaigns: () => ({ok: true, value: [structuredClone(campaign)]}),
  };
  const adapter = new MarketingCampaignServiceAdapter({service, context});
  const source = adapter.prepare({request: 'Prepare a fictional launch', goal: 'Owner-reviewed campaign'}, {
    actorId: 'demo-dave', workspaceId: 'work', workflowId: 'shared-1',
  });
  assert.equal(createKey, 'shared:work:shared-1:prepare');
  assert.deepEqual(source, {
    campaignId: 'campaign-1', campaignRevision: 3, versionId: 'version-1', versionRevision: 2,
    assets: {launchPost: 'Frozen campaign'},
  });
  campaign.revision = 4;
  campaign.versions[0].revision = 3;
  assert.equal(adapter.source('version-1').campaignRevision, 4);
  assert.equal(adapter.source('version-1').versionRevision, 3);
});

test('Orbit adapter projects the exact payload through draft, review, approval, and simulated execution once', () => {
  const calls = [];
  const executions = [];
  const draft = {id: 'draft-1', currentRevision: 1};
  const version = {id: 'version-1', body: '', to: '', subject: ''};
  const service = {
    createReplyDraft(input) {
      calls.push(['create', input]);
      return {ok: true, value: {draft, version}};
    },
    reviseReplyDraft(input) {
      calls.push(['revise', input]);
      Object.assign(version, {body: input.body, to: input.to, subject: input.subject});
      return {ok: true, value: {draft, version}};
    },
    requestReplyReview(input) {
      calls.push(['review', input]);
      return {ok: true, value: {review: {id: 'review-1'}}};
    },
    approveReplyVersion(input) {
      calls.push(['approve', input]);
      return {ok: true, value: {approval: {id: 'approval-1'}}};
    },
    getReplyHistory(input) {
      calls.push(['history', input]);
      return {ok: true, value: {executions: structuredClone(executions)}};
    },
    executeApprovedReply(input) {
      calls.push(['execute', input]);
      const execution = {
        id: 'execution-1', versionId: version.id, status: 'Sent', simulated: true,
        at: '2026-10-08T20:00:00.000Z',
        payload: {body: version.body, to: version.to, subject: version.subject},
      };
      executions.push(execution);
      return {ok: true, value: {execution}};
    },
  };
  const adapter = new OrbitReplyServiceExecutorAdapter({
    service,
    context: {actorId: 'demo-dave', workspaceId: 'work'},
    messageId: 'message-1',
    to: 'fictional@example.test',
  });
  const input = {
    idempotencyKey: 'shared-key',
    payload: {launchPost: 'Frozen campaign'},
    context: {actorId: 'demo-dave', workspaceId: 'work'},
    workflowId: 'shared-1',
    approval: {status: 'approved', versionId: 'shared-version', payloadDigest: 'digest'},
    version: {id: 'shared-version', payloadDigest: 'digest', payload: {launchPost: 'Frozen campaign'}},
  };
  const first = adapter.execute(input);
  const second = adapter.execute(input);
  assert.deepEqual(second, first);
  assert.equal(first.simulated, true);
  assert.deepEqual(first.payload, input.payload);
  assert.equal(calls.filter(([name]) => name === 'execute').length, 1);
  assert.match(calls.find(([name]) => name === 'revise')[1].body, /Workflow: shared-1/);
  assert.match(calls.find(([name]) => name === 'revise')[1].body, /\{"launchPost":"Frozen campaign"\}/);

  const restarted = new OrbitReplyServiceExecutorAdapter({
    service,
    context: {actorId: 'demo-dave', workspaceId: 'work'},
    messageId: 'message-1',
    to: 'fictional@example.test',
  });
  assert.deepEqual(restarted.execute(input), first);
  assert.equal(calls.filter(([name]) => name === 'execute').length, 1);
});

test('baseline adapter system completes the shared workflow without an external action', () => {
  const aiState = {version: 2, workflows: [], activity: []};
  const campaign = {
    id: 'campaign-1', revision: 1, versions: [
      {id: 'campaign-version-1', revision: 1, assets: {launchPost: 'Frozen campaign'}},
    ],
  };
  const orbitExecutions = [];
  let orbitVersion;
  const system = createBaselineAdapterSystem({
    aiOsEngine: {
      enqueue(state) {
        const workflow = {id: 'ai-workflow-1', tasks: [
          {id: 'ai-task-1', title: 'Plan', agent: 'planner'},
          {id: 'ai-task-2', title: 'Write', agent: 'writer'},
        ]};
        state.workflows.push(workflow);
        return workflow;
      },
    },
    aiOsRepository: {read: () => aiState, write: () => {}},
    marketingService: {
      createCampaign: () => ({ok: true, value: structuredClone(campaign)}),
      getCampaign: () => ({ok: true, value: structuredClone(campaign)}),
      listCampaigns: () => ({ok: true, value: [structuredClone(campaign)]}),
    },
    marketingContext: {actor: {id: 'demo-dave', name: 'Dave'}, workspaceId: 'work'},
    orbitReplyService: {
      getReplyHistory: () => ({ok: true, value: {executions: structuredClone(orbitExecutions)}}),
      createReplyDraft(input) {
        orbitVersion = {id: 'orbit-version-1', body: input.body, to: input.to, subject: input.subject};
        return {ok: true, value: {draft: {id: 'orbit-draft-1', currentRevision: 1}, version: orbitVersion}};
      },
      reviseReplyDraft: () => assert.fail('The exact first Orbit draft should not need revision.'),
      requestReplyReview: () => ({ok: true, value: {review: {id: 'orbit-review-1'}}}),
      approveReplyVersion: () => ({ok: true, value: {approval: {id: 'orbit-approval-1'}}}),
      executeApprovedReply: () => {
        const execution = {
          id: 'orbit-execution-1', versionId: orbitVersion.id, status: 'Sent', simulated: true,
          at: '2026-10-08T20:00:00.000Z',
          payload: {body: orbitVersion.body, to: orbitVersion.to, subject: orbitVersion.subject},
        };
        orbitExecutions.push(execution);
        return {ok: true, value: {execution}};
      },
    },
    orbitContext: {actorId: 'demo-dave', workspaceId: 'work'},
    orbitMessageId: 'message-1',
    orbitRecipient: 'fictional@example.test',
  });
  const caller = {actorId: 'demo-dave', workspaceId: 'work'};
  const prepared = system.operations.start({...caller, request: 'Prepare a fictional launch'});
  assert.equal(prepared.ok, true);
  const version = prepared.value.results.at(-1);
  const approved = system.operations.approve({...caller, workflowId: prepared.value.id, versionId: version.id, payloadDigest: version.payloadDigest});
  assert.equal(approved.ok, true);
  const executed = system.operations.execute({...caller, workflowId: prepared.value.id, approvalId: approved.value.approvals.at(-1).id});
  assert.equal(executed.ok, true);
  assert.equal(executed.value.status, 'completed');
  assert.equal(executed.value.executions[0].simulated, true);
  assert.equal(orbitExecutions.length, 1);
});
