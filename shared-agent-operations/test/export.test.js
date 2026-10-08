import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDemoSystem} from '../src/operations.js';
import {reviewedExport} from '../web/export.js';
const caller={actorId:'demo-dave',workspaceId:'work'};
test('exports only exact reviewed saved content, with honest preview labels',()=>{
  const system=createDemoSystem();
  const w=system.operations.start({...caller,request:'Fictional campaign'}).value;
  assert.throws(()=>reviewedExport(w));
  const v=w.results.at(-1);
  const approved=system.operations.approve({...caller,workflowId:w.id,versionId:v.id,payloadDigest:v.payloadDigest}).value;
  const exported=reviewedExport(approved);
  assert.ok(exported.content.includes(v.payload.launchPost));
  assert.match(exported.content,/not AI-generated/); assert.match(exported.filename,/-v1\.txt$/);
  const completed=system.operations.execute({...caller,workflowId:w.id,approvalId:approved.approvals[0].id}).value;
  assert.equal(reviewedExport(completed).content,exported.content);
});
test('revised, cancelled and mismatched approval versions cannot be exported',()=>{
  const system=createDemoSystem(),w=system.operations.start({...caller,request:'Fictional campaign'}).value,v=w.results.at(-1);
  const approved=system.operations.approve({...caller,workflowId:w.id,versionId:v.id,payloadDigest:v.payloadDigest}).value;
  const bad=structuredClone(approved); bad.approvals[0].payloadDigest='wrong'; assert.throws(()=>reviewedExport(bad));
  const revised=system.operations.revise({...caller,workflowId:w.id,baseVersionId:v.id,payload:{...v.payload,launchPost:'New content'}}).value;
  assert.throws(()=>reviewedExport(revised));
  assert.throws(()=>reviewedExport(system.operations.cancel({...caller,workflowId:w.id}).value));
});
