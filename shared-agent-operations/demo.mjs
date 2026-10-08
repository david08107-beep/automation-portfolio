import {createDemoSystem} from './src/operations.js';

const caller = {actorId: 'demo-dave', workspaceId: 'work'};
const system = createDemoSystem();
const prepared = system.operations.start({...caller, request: 'Prepare a fictional seven-day dog-care campaign'});
if (!prepared.ok) throw new Error(prepared.error.message);
const version = prepared.value.results.at(-1);
const approved = system.operations.approve({...caller, workflowId: prepared.value.id, versionId: version.id, payloadDigest: version.payloadDigest});
if (!approved.ok) throw new Error(approved.error.message);
const completed = system.operations.execute({...caller, workflowId: prepared.value.id, approvalId: approved.value.approvals.at(-1).id});
if (!completed.ok) throw new Error(completed.error.message);

console.log(JSON.stringify({
  workflowId: completed.value.id,
  status: completed.value.status,
  simulated: completed.value.executions[0].simulated,
  externalActions: 0,
  activity: completed.value.activity.map(item => item.type),
}, null, 2));
