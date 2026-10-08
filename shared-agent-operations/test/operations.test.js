import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoSystem} from '../src/operations.js';

const caller = {actorId: 'demo-dave', workspaceId: 'work'};
const start = system => system.operations.start({...caller, request: 'Prepare a fictional seven-day dog-care campaign'});
const approve = (system, workflow) => system.operations.approve({...caller, workflowId: workflow.id, versionId: workflow.results.at(-1).id, payloadDigest: workflow.results.at(-1).payloadDigest});

test('completes only after exact-version approval and one simulated execution', () => {
  const system = createDemoSystem();
  const prepared = start(system);
  assert.equal(prepared.ok, true);
  assert.equal(prepared.value.status, 'awaiting-review');
  assert.equal(prepared.value.tasks.at(-1).status, 'pending');

  const approved = approve(system, prepared.value);
  assert.equal(approved.ok, true);
  assert.equal(approved.value.status, 'awaiting-review');

  const executed = system.operations.execute({...caller, workflowId: approved.value.id, approvalId: approved.value.approvals.at(-1).id});
  assert.equal(executed.ok, true);
  assert.equal(executed.value.status, 'completed');
  assert.equal(executed.value.executions.length, 1);
  assert.equal(executed.value.executions[0].simulated, true);
  assert.equal(system.orbitExecutor.executionCount, 1);
});

test('rejects stale approval and invalidates approval when the draft changes', () => {
  const system = createDemoSystem();
  const prepared = start(system).value;
  const stale = system.operations.approve({...caller, workflowId: prepared.id, versionId: 'old-version', payloadDigest: prepared.results.at(-1).payloadDigest});
  assert.equal(stale.error.code, 'APPROVAL_STALE');

  const approved = approve(system, prepared).value;
  const revised = system.operations.revise({...caller, workflowId: prepared.id, payload: {...prepared.results.at(-1).payload, launchPost: 'Dave edited this fictional post.'}});
  assert.equal(revised.ok, true);
  assert.equal(revised.value.approvals.at(-1).status, 'invalidated');
  const execute = system.operations.execute({...caller, workflowId: prepared.id, approvalId: approved.approvals.at(-1).id});
  assert.equal(execute.error.code, 'APPROVAL_REQUIRED');
});

test('detects changed Marketing source content before approval', () => {
  const system = createDemoSystem();
  const prepared = start(system).value;
  const version = prepared.results.at(-1);
  system.marketing.mutateSource(version.source.versionId, {...version.payload, launchPost: 'Changed at source'});
  const result = approve(system, prepared);
  assert.equal(result.error.code, 'SOURCE_CHANGED');
});

test('invalidates approval when Marketing source changes before execution', () => {
  const system = createDemoSystem();
  const prepared = start(system).value;
  const approved = approve(system, prepared).value;
  const version = approved.results.at(-1);
  const approvalId = approved.approvals.at(-1).id;
  system.marketing.mutateSource(version.source.versionId, {...version.payload, launchPost: 'Changed after approval'});
  const result = system.operations.execute({...caller, workflowId: prepared.id, approvalId});
  assert.equal(result.error.code, 'SOURCE_CHANGED');
  const current = system.operations.get({...caller, workflowId: prepared.id}).value;
  assert.equal(current.status, 'awaiting-review');
  assert.equal(current.approvals.at(-1).status, 'invalidated');
  assert.equal(current.executions.length, 0);
});

test('enforces workspace ownership and cancellation', () => {
  const system = createDemoSystem();
  const prepared = start(system).value;
  const denied = system.operations.get({actorId: 'demo-dave', workspaceId: 'personal', workflowId: prepared.id});
  assert.equal(denied.error.code, 'WORKSPACE_MISMATCH');
  const cancelled = system.operations.cancel({...caller, workflowId: prepared.id});
  assert.equal(cancelled.value.status, 'cancelled');
  assert.equal(cancelled.value.executions.length, 0);
});

test('records generation failure and supports a safe preparation retry', () => {
  const system = createDemoSystem();
  system.marketing.failNextGeneration();
  const failed = start(system);
  assert.equal(failed.error.code, 'GENERATION_FAILED');
  const [workflow] = system.repository.list();
  assert.equal(workflow.status, 'failed');
  assert.equal(workflow.failure.stage, 'preparation');
  const retried = system.operations.retryPreparation({...caller, workflowId: workflow.id});
  assert.equal(retried.ok, true);
  assert.equal(retried.value.status, 'awaiting-review');
  assert.equal(retried.value.results.length, 1);
});

test('execution failure never marks AI OS complete and retry succeeds once', () => {
  const system = createDemoSystem();
  const prepared = start(system).value;
  const approved = approve(system, prepared).value;
  const approvalId = approved.approvals.at(-1).id;
  system.orbitExecutor.failNextExecution();
  const failed = system.operations.execute({...caller, workflowId: prepared.id, approvalId});
  assert.equal(failed.error.code, 'EXECUTION_FAILED');
  const afterFailure = system.operations.get({...caller, workflowId: prepared.id});
  assert.equal(afterFailure.value.status, 'failed');
  assert.equal(system.orbitExecutor.executionCount, 0);
  const retried = system.operations.execute({...caller, workflowId: prepared.id, approvalId});
  assert.equal(retried.value.status, 'completed');
  assert.equal(system.orbitExecutor.executionCount, 1);
});

test('persistence retry reuses the simulated receipt without duplicate execution', () => {
  const system = createDemoSystem();
  const prepared = start(system).value;
  const approved = approve(system, prepared).value;
  const approvalId = approved.approvals.at(-1).id;
  system.repository.failNextWrite();
  const first = system.operations.execute({...caller, workflowId: prepared.id, approvalId});
  assert.equal(first.error.code, 'PERSISTENCE_FAILED');
  assert.equal(system.orbitExecutor.executionCount, 1);
  const retried = system.operations.execute({...caller, workflowId: prepared.id, approvalId});
  assert.equal(retried.value.status, 'completed');
  assert.equal(system.orbitExecutor.executionCount, 1);
  assert.equal(retried.value.executions.length, 1);
});
