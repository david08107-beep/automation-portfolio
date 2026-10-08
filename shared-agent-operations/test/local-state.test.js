import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStoredDemoSystem} from '../src/local-state.js';

const caller = {actorId:'demo-dave',workspaceId:'work'};
function statePath(t) {
  const directory=mkdtempSync(join(tmpdir(),'orbit-state-'));
  t.after(() => rmSync(directory,{recursive:true,force:true}));
  return join(directory,'history.json');
}
function approve(system,w) {
  const v=w.results.at(-1);
  const result=system.operations.approve({...caller,workflowId:w.id,versionId:v.id,payloadDigest:v.payloadDigest});
  assert.equal(result.ok,true); return result.value;
}

test('saved history and source references survive a restart and remain reviewable', t => {
  const path=statePath(t),system=createStoredDemoSystem(path);
  const started=system.operations.start({...caller,request:'Fictional launch campaign'});
  assert.equal(started.ok,true);
  const w=started.value,v=w.results.at(-1);
  const revised=system.operations.revise({...caller,workflowId:w.id,payload:{...v.payload,launchPost:'Saved revision'}});
  assert.equal(revised.ok,true);
  const restored=createStoredDemoSystem(path);
  const loaded=restored.operations.get({...caller,workflowId:w.id}).value;
  assert.equal(loaded.results.at(-1).payload.launchPost,'Saved revision');
  const approved=approve(restored,loaded);
  const completed=restored.operations.execute({...caller,workflowId:w.id,approvalId:approved.approvals.at(-1).id});
  assert.equal(completed.ok,true);
  const again=createStoredDemoSystem(path);
  assert.equal(again.repository.get(w.id).status,'completed');
  assert.equal(again.orbitExecutor.executionCount,1);
  assert.equal(again.operations.execute({...caller,workflowId:w.id,approvalId:approved.approvals.at(-1).id}).ok,false);
});

test('receipt reconciliation prevents a duplicate after persistence failure and restart', t => {
  const path=statePath(t),system=createStoredDemoSystem(path);
  const w=system.operations.start({...caller,request:'Fictional retry campaign'}).value;
  const approved=approve(system,w),approvalId=approved.approvals.at(-1).id;
  system.repository.failNextWrite();
  const failed=system.operations.execute({...caller,workflowId:w.id,approvalId});
  assert.equal(failed.error.code,'PERSISTENCE_FAILED');
  const restored=createStoredDemoSystem(path);
  assert.equal(restored.orbitExecutor.executionCount,1);
  const retried=restored.operations.execute({...caller,workflowId:w.id,approvalId});
  assert.equal(retried.ok,true); assert.equal(retried.value.executions.length,1);
  assert.equal(restored.orbitExecutor.executionCount,1);
});

test('an unreadable existing history file is preserved', t => {
  const path=statePath(t);
  writeFileSync(path,'invalid original history','utf8');
  assert.throws(() => createStoredDemoSystem(path),/existing file has been preserved/);
  assert.equal(readFileSync(path,'utf8'),'invalid original history');
});

test('a failed disk replacement leaves the saved version and in-memory record unchanged', t => {
  const path=statePath(t),system=createStoredDemoSystem(path);
  const w=system.operations.start({...caller,request:'Fictional storage test'}).value;
  const previous=readFileSync(path,'utf8');
  mkdirSync(path+'.tmp');
  const failed=system.operations.revise({...caller,workflowId:w.id,payload:{...w.results.at(-1).payload,launchPost:'Unsaved revision'}});
  assert.equal(failed.error.code,'PERSISTENCE_FAILED');
  assert.equal(readFileSync(path,'utf8'),previous);
  assert.deepEqual(system.repository.get(w.id),w);
});
