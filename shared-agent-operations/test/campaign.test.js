import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCampaign,campaignRequest,emptyCampaign} from '../web/campaign.js';
import {DraftRecovery} from '../web/drafts.js';
import {createDemoSystem} from '../src/operations.js';
const brief={business:'Dog training',audience:'Local owners',platform:'Instagram',tone:'Friendly',goal:'Encourage booking enquiries'};
test('campaign brief validates required fields and creates a readable request',()=>{
  const request=campaignRequest(brief,'Use only confirmed availability.');
  for(const value of Object.values(brief)) assert.ok(request.includes(value));
  assert.match(request,/Use only confirmed availability/);
  assert.equal(normalizeCampaign({...brief,business:'  Dog training '}).business,'Dog training');
  for(const input of [emptyCampaign(),{...brief,goal:' '},{...brief,platform:'invented'},{...brief,tone:'invented'},{...brief,audience:'x'.repeat(1001)}]) assert.throws(()=>normalizeCampaign(input));
});
test('unfinished campaign survives reload and submitted brief stays with workflow',()=>{
  const records=new Map(),storage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
  const draft=new DraftRecovery(storage); draft.campaignNote(brief,'guided'); draft.note('request','Availability subject to review');
  const reload=new DraftRecovery(storage);
  assert.deepEqual(reload.state.campaign,brief); assert.equal(reload.state.briefMode,'guided');
  const system=createDemoSystem();
  const result=system.operations.start({actorId:'demo-dave',workspaceId:'work',request:campaignRequest(brief,reload.state.request),campaignBrief:brief});
  assert.equal(result.ok,true); assert.deepEqual(result.value.command.campaignBrief,brief);
  brief.goal='Changed local goal';
  assert.equal(system.repository.get(result.value.id).command.campaignBrief.goal,'Encourage booking enquiries');
});
