import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createState,enqueue,tick,decide,fail,retry,editResult,restore,agentAssignments,seedDemo,regenerate,restoreDraft} from '../src/engine.js';
import {read,write,createPersistence} from '../src/storage.js';
const finish=s=>{for(let i=0;i<12;i++)tick(s);};
test('execution cannot approve early, enforces dependencies, and retains edits',()=>{
 const s=createState(),w=enqueue(s,'Brief');assert.equal(decide(s,w.id,'complete'),false);
 tick(s);assert.deepEqual(w.tasks.map(t=>t.status),['running','pending','pending']);assert.equal(w.step,0);
 tick(s);assert.deepEqual(w.tasks.map(t=>t.status),['completed','running','pending']);
 finish(s);assert.equal(w.status,'awaiting review');editResult(s,w.id,'   ');assert.equal(decide(s,w.id,'complete'),false);
 editResult(s,w.id,'Dave edited this');assert.equal(decide(s,w.id,'complete'),true);assert.equal(editResult(s,w.id,'overwrite'),false);
 tick(s);assert.equal(w.result,'Dave edited this');assert.match(s.activity[0].message,/Nothing was sent/);
 assert.equal(decide(s,w.id,'complete'),false);
});
test('concurrent processes never double-book agents and produce distinct results',()=>{
 const s=createState();for(const request of ['Weekly brief','Draft project update','Review software backlog'])enqueue(s,request);
 for(let i=0;i<12;i++){tick(s);assert.ok(agentAssignments(s).every(a=>a.assignments.length<=1));for(const w of s.workflows){const active=w.tasks.findIndex(t=>t.status==='running');if(active>=0)assert.ok(w.tasks.slice(0,active).every(t=>t.status==='completed'));}}
 assert.ok(s.workflows.every(w=>w.status==='awaiting review'));
 assert.match(s.workflows.find(w=>w.type==='brief').result,/WEEKLY OPERATIONS BRIEF/);
 assert.match(s.workflows.find(w=>w.type==='update').result,/UNSENT TEAM UPDATE/);
 assert.match(s.workflows.find(w=>w.type==='backlog').result,/REQ-104/);
});
test('failure blocks remaining work, frees agents, and retry keeps event history',()=>{
 const s=createState(),w=enqueue(s,'Brief');tick(s);fail(s,w.id);assert.deepEqual(w.tasks.map(t=>t.status),['failed','blocked','blocked']);
 assert.ok(agentAssignments(s).every(a=>!a.assignments.length));finish(s);assert.equal(w.status,'failed');
 assert.equal(retry(s,w.id),true);finish(s);assert.equal(w.status,'awaiting review');assert.ok(w.timeline.some(t=>/failed/.test(t.text)));
 assert.equal(retry(s,w.id),false);
});
test('cancellation stops queued, running, review and failed workflows',()=>{
 for(const stage of ['queued','running','review','failed']){const s=createState(),w=enqueue(s,'Brief');if(stage==='running')tick(s);if(stage==='review')finish(s);if(stage==='failed')fail(s,w.id);const progress=w.step;decide(s,w.id,'cancel');finish(s);assert.equal(w.status,'cancelled');assert.equal(w.step,progress);}
});
test('restoration releases active claims and resumes without rerunning completed tasks',()=>{
 const s=createState(),w=enqueue(s,'Brief');tick(s);tick(s);const r=restore(JSON.stringify(s));assert.equal(r.notice,'');assert.equal(r.state.workflows[0].tasks[0].status,'completed');assert.equal(r.state.workflows[0].tasks[1].status,'pending');finish(r.state);assert.equal(r.state.workflows[0].status,'awaiting review');assert.equal(r.state.workflows[0].timeline.filter(t=>t.text.startsWith('Planner completed')).length,1);
});
test('v1 saved results and decisions migrate intact',()=>{
 const raw={version:1,workflows:[{id:'old',request:'Draft update',status:'completed',step:3,created:new Date().toISOString(),timeline:[],result:'An approved original',decision:'Dave approved'}],activity:[]};
 const {state,notice}=restore(JSON.stringify(raw));assert.equal(notice,'');assert.equal(state.version,2);assert.equal(state.workflows[0].result,raw.workflows[0].result);assert.equal(state.workflows[0].tasks.length,3);
});
test('invalid storage is diagnosed without a crash; unavailable storage degrades to session mode',()=>{
 for(const raw of ['{broken',JSON.stringify({version:2,workflows:[{}],activity:[]})]){const r=restore(raw);assert.deepEqual(r.state,createState());assert.match(r.notice,/could not be read/);}
 assert.equal(read({getItem(){throw Error();}}).healthy,false);assert.equal(write({setItem(){throw Error();}},createState()),false);
});
test('demo scenario is consistent and cannot overwrite existing workflows',()=>{
 const s=createState();assert.equal(seedDemo(s),true);assert.equal(s.workflows.length,3);assert.equal(s.workflows.filter(w=>w.status==='failed').length,1);assert.equal(s.workflows.filter(w=>w.status==='awaiting review').length,1);assert.equal(seedDemo(s),false);assert.equal(restore(JSON.stringify(s)).notice,'');
});
test('invalid requests and decision actions do not mutate the workspace',()=>{
 const s=createState();assert.equal(enqueue(s,'   '),null);assert.equal(enqueue(s,'x'.repeat(501)),null);const w=enqueue(s,'Brief');assert.equal(decide(s,w.id,'send'),false);assert.equal(w.status,'queued');
});

test('inconsistent saved task dependencies are rejected instead of leaving stuck processes',()=>{
 const s=createState(),w=enqueue(s,'Brief');w.tasks[2].status='running';w.status='running';const r=restore(JSON.stringify(s));assert.match(r.notice,/could not be read/);assert.equal(r.state.workflows.length,0);
});
test('retry resumes after completed prerequisites and does not repeat the planner',()=>{
 const s=createState(),w=enqueue(s,'Weekly brief');tick(s);tick(s);assert.equal(w.step,1);fail(s,w.id);retry(s,w.id);
 assert.equal(w.step,1);assert.equal(w.tasks[0].status,'completed');assert.equal(restore(JSON.stringify(s)).notice,'');finish(s);
 assert.equal(w.status,'awaiting review');assert.equal(w.timeline.filter(t=>t.text.startsWith('Planner completed')).length,1);
});
test('explicit process choice overrides keywords and invalid request types are rejected',()=>{
 const s=createState(),w=enqueue(s,'Investigate a project security review','backlog');finish(s);assert.match(w.result,/SOFTWARE REQUEST TRIAGE/);assert.equal(enqueue(s,null),null);assert.equal(enqueue(s,{}),null);
});
test('storage keeps selected workflow and validates view preferences separately from domain state',()=>{
 const s=createState(),w=enqueue(s,'Weekly brief');let raw;const storage={getItem:()=>raw,setItem:(key,value)=>raw=value};
 write(storage,s,{selected:w.id,filter:'failed',process:'backlog',taskFilter:'blocked',historyFilter:'selected',timelineOpen:true});const saved=read(storage);assert.equal(saved.view.selected,w.id);assert.equal(saved.view.process,'backlog');assert.equal(saved.state.view,undefined);
 write(storage,s,{selected:'missing',filter:'bad',process:'__proto__'});assert.deepEqual(read(storage).view,{});
});

test('stale tab writes are rejected without overwriting newer workflows',()=>{
 let raw=null;const storage={getItem:()=>raw,setItem:(key,value)=>raw=value};const a=createPersistence(storage),b=createPersistence(storage);
 enqueue(a.initial.state,'From A');assert.equal(a.save(a.initial.state), 'saved');const retained=raw;
 enqueue(b.initial.state,'From B');assert.equal(b.save(b.initial.state), 'conflict');assert.equal(raw,retained);assert.equal(b.check(),'conflict');
 const latest=createPersistence(storage);enqueue(latest.initial.state,'From B after reload');assert.equal(latest.save(latest.initial.state),'saved');assert.equal(JSON.parse(raw).workflows.length,2);
});
test('guarded persistence retains corrupt snapshots and degrades when storage writes fail',()=>{
 let raw='{broken';const storage={getItem:()=>raw,setItem:(key,value)=>raw=value};const adapter=createPersistence(storage);assert.match(adapter.initial.notice,/could not be read/);assert.equal(adapter.check(),'current');assert.equal(raw,'{broken');
 enqueue(adapter.initial.state,'A new request');assert.equal(adapter.save(adapter.initial.state),'saved');assert.equal(adapter.check(),'current');
 const denied=createPersistence({getItem:()=>null,setItem(){throw Error('quota');}});assert.equal(denied.save(createState()),'unavailable');assert.equal(createPersistence(null).check(),'unavailable');
});

test('alternatives preserve exact drafts, request and process without approval',()=>{
 for(const type of ['brief','update','backlog']){
  const state=createState(),w=enqueue(state,'Original request',type);assert.equal(regenerate(state,w.id),false);finish(state);editResult(state,w.id,'Dave’s exact edit');
  assert.equal(regenerate(state,w.id),true);const alternative=w.result;assert.notEqual(alternative,'Dave’s exact edit');assert.match(alternative,/Decision focus/);regenerate(state,w.id);assert.notEqual(w.result,alternative);
  assert.equal(restoreDraft(state,w.id,0),true);assert.equal(w.result,'Dave’s exact edit');assert.equal(w.request,'Original request');assert.equal(w.type,type);assert.equal(w.status,'awaiting review');
  const restored=restore(JSON.stringify(state));assert.equal(restored.notice,'');assert.equal(restored.state.workflows[0].drafts[0].result,'Dave’s exact edit');decide(state,w.id,'complete');assert.equal(regenerate(state,w.id),false);assert.equal(restoreDraft(state,w.id,0),false);
 }
});
test('invalid draft history recovers without rendering unsafe state',()=>{
 const state=createState(),w=enqueue(state,'Brief');finish(state);regenerate(state,w.id);w.drafts[0].type='unknown';assert.match(restore(JSON.stringify(state)).notice,/could not be read/);
});
test('restore allowlists fields and bounds untrusted payloads',()=>{
 const s=createState(),w=enqueue(s,'Brief');finish(s);s.providerToken='synthetic-marker';w.connectionSecret='synthetic-marker';w.tasks[0].scope='admin';s.activity[0].authorization='synthetic-marker';
 const restored=restore(JSON.stringify(s));assert.equal(restored.notice,'');assert.equal(restored.state.providerToken,undefined);assert.equal(restored.state.workflows[0].connectionSecret,undefined);assert.equal(restored.state.workflows[0].tasks[0].scope,undefined);assert.equal(restored.state.activity[0].authorization,undefined);
 assert.equal(editResult(s,w.id,'x'.repeat(100001)),false);w.result='x'.repeat(100001);assert.match(restore(JSON.stringify(s)).notice,/could not be read/);
});
test('approval is terminal and duplicate decisions do not produce duplicate execution events',()=>{
 const s=createState(),w=enqueue(s,'Brief');finish(s);assert.equal(decide(s,w.id,'complete'),true);const count=s.activity.length;assert.equal(decide(s,w.id,'complete'),false);assert.equal(decide(s,w.id,'cancel'),false);assert.equal(s.activity.length,count);assert.equal(restoreDraft(s,w.id,'__proto__'),false);
});
