import {createHash, randomUUID} from 'node:crypto';

export const BASELINES = Object.freeze({
  orbit: Object.freeze({branch: 'gh-pages', commit: 'd15e6bf7cb0cf94c3fce79e8b43e24d524efdb77', version: '1.5.0'}),
  aiOs: Object.freeze({branch: 'ai-os-baseline-v1.2.1-demo', commit: 'f1ed525ed7b19959d8d6d651116688192ff8396b', version: '1.2.1-demo'}),
  marketing: Object.freeze({branch: 'marketing-agent-baseline-v0.2.0', commit: 'eb2434cf4604627f56ca49a5d1f3959b5edb72f2', version: '0.2.0'}),
});

const clone = value => structuredClone(value);
const now = () => new Date().toISOString();
const sortValue = value => Array.isArray(value)
  ? value.map(sortValue)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sortValue(value[key])]))
    : value;
const canonical = value => JSON.stringify(sortValue(value));
const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const ok = value => ({ok: true, value: clone(value)});
const fail = (code, message, retryable = false, details = undefined) => ({
  ok: false,
  error: {...(details === undefined ? {} : {details}), code, message, retryable},
});

class OperationError extends Error {
  constructor(code, message, retryable = false, details = undefined) {
    super(message);
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

function normalizeText(value, label, max = 20_000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new OperationError('INVALID_INPUT', `${label} must be non-empty text no longer than ${max} characters.`);
  }
  return value.trim();
}

function context(input) {
  const actorId = normalizeText(input?.actorId, 'Actor ID', 128);
  const workspaceId = normalizeText(input?.workspaceId, 'Workspace ID', 128);
  return {actorId, workspaceId};
}

function task(id, owner, title) {
  return {id, owner, title, status: 'pending', attempts: 0};
}

function event(workflow, type, summary, refs = {}) {
  workflow.activity.push({id: randomUUID(), type, summary, at: now(), ...refs});
  workflow.updatedAt = workflow.activity.at(-1).at;
}

function currentVersion(workflow) {
  return workflow.results.at(-1);
}

function assertWorkspace(workflow, input) {
  const caller = context(input);
  if (caller.workspaceId !== workflow.workspaceId || caller.actorId !== workflow.actorId) {
    throw new OperationError('WORKSPACE_MISMATCH', 'The workflow does not belong to this actor and workspace.');
  }
  return caller;
}

export class MemoryWorkflowRepository {
  #workflows = new Map();
  #failNext = false;

  failNextWrite() {
    this.#failNext = true;
  }

  get(id) {
    const value = this.#workflows.get(id);
    if (!value) throw new OperationError('NOT_FOUND', 'Workflow not found.');
    return clone(value);
  }

  list() {
    return [...this.#workflows.values()].map(clone);
  }

  save(workflow, expectedRevision = null) {
    if (this.#failNext) {
      this.#failNext = false;
      throw new OperationError('PERSISTENCE_FAILED', 'The workflow could not be saved.', true);
    }
    const stored = this.#workflows.get(workflow.id);
    if (expectedRevision === null && stored) throw new OperationError('REVISION_CONFLICT', 'Workflow already exists.');
    if (expectedRevision !== null && stored?.revision !== expectedRevision) {
      throw new OperationError('REVISION_CONFLICT', 'Workflow changed. Reload before continuing.', true, {currentRevision: stored?.revision});
    }
    const next = clone(workflow);
    next.revision = (stored?.revision ?? 0) + 1;
    this.#workflows.set(next.id, next);
    return clone(next);
  }
}

export class FixtureOrbitBriefAdapter {
  establish(request) {
    return {
      briefId: randomUUID(),
      request,
      audience: 'fictional dog-care clients',
      goal: 'prepare a reviewed seven-day campaign and launch message',
      constraints: ['fictional data only', 'no external publishing', 'owner review required'],
      revision: 1,
    };
  }
}

export class FixtureAiOsAdapter {
  schedule(brief) {
    return [
      {id: randomUUID(), owner: 'executive-assistant', title: 'Establish the campaign brief', dependsOn: []},
      {id: randomUUID(), owner: 'ai-os', title: 'Schedule the preparation workflow', dependsOn: ['executive-assistant']},
      {id: randomUUID(), owner: 'marketing-agent', title: 'Prepare campaign content', dependsOn: ['ai-os']},
      {id: randomUUID(), owner: 'ai-os', title: 'Review the exact frozen draft', dependsOn: ['marketing-agent']},
      {id: randomUUID(), owner: 'executive-assistant', title: 'Simulate the approved send', dependsOn: ['ai-os-review']},
    ].map((item, index, items) => ({...item, dependsOn: index ? [items[index - 1].id] : []}));
  }
}

export class FixtureMarketingAdapter {
  #versions = new Map();
  #failGeneration = false;

  failNextGeneration() {
    this.#failGeneration = true;
  }

  prepare(brief) {
    if (this.#failGeneration) {
      this.#failGeneration = false;
      throw new OperationError('GENERATION_FAILED', 'Marketing content generation failed.', true);
    }
    const campaignId = randomUUID();
    const versionId = randomUUID();
    const assets = {
      launchPost: `A fictional launch post for ${brief.audience}.`,
      shortVideoScript: 'Show the service, explain the benefit, and invite a fictional booking inquiry.',
      calendar: ['Introduce the service', 'Share a care tip', 'Show a fictional client story', 'Answer a common question', 'Review before publishing'],
    };
    const source = {campaignId, campaignRevision: 1, versionId, versionRevision: 1, assets};
    this.#versions.set(versionId, clone(source));
    return clone(source);
  }

  source(versionId) {
    const value = this.#versions.get(versionId);
    if (!value) throw new OperationError('SOURCE_NOT_FOUND', 'Marketing source version not found.');
    return clone(value);
  }

  mutateSource(versionId, assets) {
    const value = this.source(versionId);
    const next = {...value, campaignRevision: value.campaignRevision + 1, versionRevision: value.versionRevision + 1, assets: clone(assets)};
    this.#versions.set(versionId, next);
    return clone(next);
  }
}

export class FixtureOrbitExecutor {
  #receipts = new Map();
  #failNext = false;
  executionCount = 0;

  failNextExecution() {
    this.#failNext = true;
  }

  execute({idempotencyKey, payload}) {
    const existing = this.#receipts.get(idempotencyKey);
    if (existing) return clone(existing);
    if (this.#failNext) {
      this.#failNext = false;
      throw new OperationError('EXECUTION_FAILED', 'The simulated send failed before execution.', true);
    }
    const receipt = {id: randomUUID(), idempotencyKey, simulated: true, status: 'Sent', payload: clone(payload), at: now()};
    this.#receipts.set(idempotencyKey, receipt);
    this.executionCount += 1;
    return clone(receipt);
  }
}

export class SharedAgentOperations {
  constructor({repository, orbitBrief, aiOs, marketing, orbitExecutor}) {
    this.repository = repository;
    this.orbitBrief = orbitBrief;
    this.aiOs = aiOs;
    this.marketing = marketing;
    this.orbitExecutor = orbitExecutor;
  }

  #result(action) {
    try {
      return ok(action());
    } catch (error) {
      if (error instanceof OperationError) return fail(error.code, error.message, error.retryable, error.details);
      return fail('UNEXPECTED_ERROR', 'The simulated workflow failed unexpectedly.', true);
    }
  }

  #save(workflow, expectedRevision = null) {
    return this.repository.save(workflow, expectedRevision);
  }

  #sourceMatches(version) {
    const source = this.marketing.source(version.source.versionId);
    return source.campaignId === version.source.campaignId
      && source.campaignRevision === version.source.campaignRevision
      && source.versionRevision === version.source.versionRevision
      && digest(source.assets) === version.sourceDigest;
  }

  start(input) {
    return this.#result(() => {
      const caller = context(input);
      const request = normalizeText(input.request, 'Request');
      const createdAt = now();
      let workflow = {
        schemaVersion: 1,
        id: randomUUID(),
        correlationId: randomUUID(),
        workspaceId: caller.workspaceId,
        actorId: caller.actorId,
        status: 'running',
        revision: 0,
        command: {id: randomUUID(), request, createdAt},
        sourceBaselines: BASELINES,
        tasks: [
          task('orbit-brief', 'executive-assistant', 'Establish the campaign brief'),
          task('ai-os-schedule', 'ai-os', 'Schedule the preparation workflow'),
          task('marketing-prepare', 'marketing-agent', 'Prepare campaign content'),
          task('owner-review', 'ai-os', 'Review the exact frozen draft'),
          task('orbit-execute', 'executive-assistant', 'Simulate the approved send'),
        ],
        results: [], reviews: [], approvals: [], executions: [], activity: [],
        createdAt, updatedAt: createdAt,
      };
      workflow = this.#save(workflow);
      const expectedRevision = workflow.revision;
      try {
        workflow.tasks[0].status = 'completed'; workflow.tasks[0].attempts += 1;
        workflow.brief = this.orbitBrief.establish(request);
        event(workflow, 'brief.established', 'Orbit established the fictional campaign brief.');
        workflow.tasks[1].status = 'completed'; workflow.tasks[1].attempts += 1;
        workflow.plan = this.aiOs.schedule(workflow.brief);
        event(workflow, 'workflow.scheduled', 'AI OS scheduled one simulated integration workflow.');
        workflow.tasks[2].status = 'running'; workflow.tasks[2].attempts += 1;
        const source = this.marketing.prepare(workflow.brief);
        const version = {
          id: randomUUID(),
          number: 1,
          source: {campaignId: source.campaignId, campaignRevision: source.campaignRevision, versionId: source.versionId, versionRevision: source.versionRevision},
          payload: clone(source.assets),
          sourceDigest: digest(source.assets),
          payloadDigest: digest(source.assets),
          createdAt: now(),
        };
        workflow.results.push(version);
        workflow.tasks[2].status = 'completed';
        workflow.tasks[3].status = 'running'; workflow.tasks[3].attempts += 1;
        workflow.status = 'awaiting-review';
        event(workflow, 'draft.prepared', 'Marketing prepared a frozen draft for owner review.', {versionId: version.id});
        return this.#save(workflow, expectedRevision);
      } catch (error) {
        workflow.status = 'failed';
        workflow.failure = {stage: 'preparation', code: error.code ?? 'PREPARATION_FAILED', retryable: error.retryable === true};
        workflow.tasks[2].status = 'failed';
        event(workflow, 'workflow.failed', 'Preparation failed; no simulated send occurred.');
        try { this.#save(workflow, expectedRevision); } catch {}
        throw error;
      }
    });
  }

  retryPreparation(input) {
    return this.#result(() => {
      let workflow = this.repository.get(input.workflowId);
      assertWorkspace(workflow, input);
      if (workflow.status !== 'failed' || workflow.failure?.stage !== 'preparation') throw new OperationError('INVALID_STATE', 'This workflow is not awaiting a preparation retry.');
      const expectedRevision = workflow.revision;
      workflow.tasks[2].status = 'running'; workflow.tasks[2].attempts += 1;
      const source = this.marketing.prepare(workflow.brief);
      const version = {id: randomUUID(), number: workflow.results.length + 1, source: {campaignId: source.campaignId, campaignRevision: source.campaignRevision, versionId: source.versionId, versionRevision: source.versionRevision}, payload: clone(source.assets), sourceDigest: digest(source.assets), payloadDigest: digest(source.assets), createdAt: now()};
      workflow.results.push(version);
      workflow.tasks[2].status = 'completed';
      workflow.tasks[3].status = 'running'; workflow.tasks[3].attempts += 1;
      workflow.status = 'awaiting-review'; delete workflow.failure;
      event(workflow, 'draft.prepared', 'Marketing preparation succeeded on retry.', {versionId: version.id});
      return this.#save(workflow, expectedRevision);
    });
  }

  revise(input) {
    return this.#result(() => {
      const workflow = this.repository.get(input.workflowId);
      assertWorkspace(workflow, input);
      if (workflow.status !== 'awaiting-review') throw new OperationError('INVALID_STATE', 'The workflow is not awaiting review.');
      const previous = currentVersion(workflow);
      const payload = clone(input.payload);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new OperationError('INVALID_INPUT', 'Revised payload must be an object.');
      workflow.approvals.filter(item => item.status === 'approved').forEach(item => { item.status = 'invalidated'; item.invalidatedAt = now(); });
      const version = {id: randomUUID(), number: previous.number + 1, source: clone(previous.source), sourceDigest: previous.sourceDigest, payload, payloadDigest: digest(payload), createdAt: now(), editedBy: workflow.actorId};
      workflow.results.push(version);
      event(workflow, 'draft.revised', 'Owner edits created a new frozen version and invalidated earlier approvals.', {versionId: version.id});
      return this.#save(workflow, workflow.revision);
    });
  }

  approve(input) {
    return this.#result(() => {
      const workflow = this.repository.get(input.workflowId);
      assertWorkspace(workflow, input);
      if (workflow.status !== 'awaiting-review') throw new OperationError('INVALID_STATE', 'The workflow is not awaiting review.');
      const version = currentVersion(workflow);
      if (input.versionId !== version.id || input.payloadDigest !== version.payloadDigest) throw new OperationError('APPROVAL_STALE', 'Approval must name the current exact frozen version.');
      if (!this.#sourceMatches(version)) throw new OperationError('SOURCE_CHANGED', 'The Marketing source changed after preparation. Prepare a new frozen version.');
      const review = {id: randomUUID(), versionId: version.id, payloadDigest: version.payloadDigest, actorId: workflow.actorId, reviewedAt: now(), status: 'approved'};
      const approval = {id: randomUUID(), reviewId: review.id, versionId: version.id, payloadDigest: version.payloadDigest, actorId: workflow.actorId, status: 'approved', approvedAt: now()};
      workflow.reviews.push(review); workflow.approvals.push(approval);
      event(workflow, 'draft.approved', 'Dave approved the exact frozen draft for simulated execution.', {versionId: version.id, approvalId: approval.id});
      return this.#save(workflow, workflow.revision);
    });
  }

  execute(input) {
    return this.#result(() => {
      const workflow = this.repository.get(input.workflowId);
      assertWorkspace(workflow, input);
      if (!['awaiting-review', 'failed'].includes(workflow.status)) throw new OperationError('INVALID_STATE', 'The workflow is not ready for simulated execution.');
      const version = currentVersion(workflow);
      const approval = workflow.approvals.find(item => item.id === input.approvalId);
      if (!approval || approval.status !== 'approved' || approval.versionId !== version.id || approval.payloadDigest !== version.payloadDigest) throw new OperationError('APPROVAL_REQUIRED', 'A current exact-version approval is required.');
      if (!this.#sourceMatches(version)) {
        approval.status = 'invalidated'; approval.invalidatedAt = now();
        workflow.status = 'awaiting-review';
        this.#save(workflow, workflow.revision);
        throw new OperationError('SOURCE_CHANGED', 'The Marketing source changed after approval. Prepare and review a new version.');
      }
      const idempotencyKey = `${workflow.workspaceId}:${workflow.id}:${approval.id}:${version.id}`;
      try {
        const receipt = this.orbitExecutor.execute({idempotencyKey, payload: version.payload});
        if (!workflow.executions.some(item => item.idempotencyKey === idempotencyKey)) workflow.executions.push(receipt);
        workflow.tasks[3].status = 'completed';
        workflow.tasks[4].status = 'completed'; workflow.tasks[4].attempts += 1;
        workflow.status = 'completed'; delete workflow.failure;
        approval.status = 'executed'; approval.executedAt = receipt.at;
        event(workflow, 'execution.simulated', 'Orbit recorded one idempotent simulated send; nothing was sent externally.', {versionId: version.id, approvalId: approval.id, executionId: receipt.id});
        return this.#save(workflow, workflow.revision);
      } catch (error) {
        if (error.code !== 'PERSISTENCE_FAILED') {
          workflow.status = 'failed';
          workflow.failure = {stage: 'execution', code: error.code ?? 'EXECUTION_FAILED', retryable: error.retryable === true};
          workflow.tasks[4].status = 'failed'; workflow.tasks[4].attempts += 1;
          event(workflow, 'workflow.failed', 'Simulated execution failed; AI OS did not mark the workflow complete.');
          try { this.#save(workflow, workflow.revision); } catch {}
        }
        throw error;
      }
    });
  }

  cancel(input) {
    return this.#result(() => {
      const workflow = this.repository.get(input.workflowId);
      assertWorkspace(workflow, input);
      if (['completed', 'cancelled'].includes(workflow.status)) throw new OperationError('INVALID_STATE', 'The workflow cannot be cancelled in its current state.');
      workflow.status = 'cancelled';
      workflow.tasks.filter(item => !['completed', 'failed'].includes(item.status)).forEach(item => { item.status = 'cancelled'; });
      workflow.approvals.filter(item => item.status === 'approved').forEach(item => { item.status = 'invalidated'; item.invalidatedAt = now(); });
      event(workflow, 'workflow.cancelled', 'Dave cancelled the workflow; no simulated send occurred.');
      return this.#save(workflow, workflow.revision);
    });
  }

  get(input) {
    return this.#result(() => {
      const workflow = this.repository.get(input.workflowId);
      assertWorkspace(workflow, input);
      return workflow;
    });
  }
}

export function createDemoSystem() {
  const repository = new MemoryWorkflowRepository();
  const marketing = new FixtureMarketingAdapter();
  const orbitExecutor = new FixtureOrbitExecutor();
  const operations = new SharedAgentOperations({repository, orbitBrief: new FixtureOrbitBriefAdapter(), aiOs: new FixtureAiOsAdapter(), marketing, orbitExecutor});
  return {operations, repository, marketing, orbitExecutor};
}
