import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LIMITS,capacityFailure} from '../src/limits.js';
import {createState,perform,enqueue,tick,restore,STORAGE_KEY} from '../src/engine.js';
import {write,read,createPersistence} from '../src/storage.js';
function storage(raw=null){return {raw,getItem(){return this.raw;},setItem(key,value){assert.equal(key,STORAGE_KEY);this.raw=value;}};}
function prepared(){const s=createState(),w=enqueue(s,'Brief');for(let i=0;i<4;i++)tick(s);return {s,w};}
function rejectUnchanged(s,operation,args,code){const before=JSON.stringify(s),outcome=perform(s,operation,...args);assert.equal(outcome.ok,false);assert.equal(outcome.reason.code,code);assert.equal(JSON.stringify(s),before);}
test('runtime admits 500 workflows, persists the maximum, and rejects workflow 501 atomically',()=>{
 const s=createState();for(let i=0;i<LIMITS.workflows;i++)assert.equal(perform(s,'enqueue',`Brief ${i}`).ok,true);
 const store=storage();assert.equal(write(store,s),true);const loaded=read(store);assert.equal(loaded.notice,'');assert.equal(loaded.state.workflows.length,LIMITS.workflows);
 rejectUnchanged(s,'enqueue',['One too many'],'workflow_limit');assert.equal(enqueue(s,'One too many'),null);assert.equal(write(store,s),true);
});
test('runtime admits 1000 draft versions, reloads them, and rejects regeneration and restoration atomically',()=>{
 const {s,w}=prepared();for(let i=0;i<LIMITS.draftsPerWorkflow;i++)assert.equal(perform(s,'regenerate',w.id).ok,true);
 assert.equal(w.drafts.length,LIMITS.draftsPerWorkflow);const store=storage();assert.equal(write(store,s),true);const loaded=read(store);assert.equal(loaded.notice,'');assert.deepEqual(loaded.state.workflows[0].drafts,w.drafts);
 rejectUnchanged(s,'regenerate',[w.id],'draft_limit');rejectUnchanged(s,'restoreDraft',[w.id,0],'draft_limit');
});
test('activity and per-workflow timeline limits reject full operations without partial execution',()=>{
 const {s,w}=prepared(),event=s.activity[0];s.activity=Array.from({length:LIMITS.activity},(_,i)=>({...event,id:`event-${i}`}));
 rejectUnchanged(s,'record',['New event',w.id],'activity_limit');assert.equal(restore(JSON.stringify(s)).notice,'');
 s.activity=[];w.timeline=Array.from({length:LIMITS.timelinePerWorkflow},()=>({...w.timeline[0]}));rejectUnchanged(s,'regenerate',[w.id],'timeline_limit');assert.equal(restore(JSON.stringify(s)).notice,'');
});
test('serialized admission budget survives save/reload; one extra character is rejected without loss',()=>{
 const {s,w}=prepared();w.drafts=Array.from({length:99},()=>({result:'x'.repeat(LIMITS.resultChars),request:w.request,type:w.type,time:w.created}));
 w.result='';const remaining=LIMITS.snapshotChars-LIMITS.viewReserveChars-JSON.stringify(s).length;
 assert.ok(remaining>0&&remaining<LIMITS.resultChars);assert.equal(perform(s,'editResult',w.id,'x'.repeat(remaining)).ok,true);assert.equal(capacityFailure(s),null);
 const store=storage();assert.equal(write(store,s,{selected:w.id}),true);assert.equal(read(store).notice,'');assert.equal(read(store).state.workflows[0].result,w.result);
 rejectUnchanged(s,'editResult',[w.id,w.result+'x'],'snapshot_limit');const persisted=store.raw;const oversized=structuredClone(s);oversized.workflows[0].result+='x';const persistence=createPersistence(store);assert.equal(persistence.save(oversized),'limit');assert.equal(persistence.lastReason.code,'snapshot_limit');assert.equal(store.raw,persisted);
});
test('legacy snapshots exceeding old count boundaries remain recoverable without truncation or overwrite',()=>{
 const {s,w}=prepared();w.drafts=Array.from({length:LIMITS.draftsPerWorkflow+1},()=>({result:'Legacy draft',request:w.request,type:w.type,time:w.created}));
 s.workflows=Array.from({length:LIMITS.workflows+1},(_,i)=>({...structuredClone(w),id:i===0?w.id:`legacy-${i}`,drafts:i===0?w.drafts:[]}));
 const raw=JSON.stringify(s),store=storage(raw),persistence=createPersistence(store),loaded=persistence.initial;
 assert.match(loaded.notice,/exceeds current admission limits/);assert.equal(loaded.state.workflows.length,501);assert.equal(loaded.state.workflows[0].drafts.length,1001);assert.equal(loaded.state.workflows[0].result,w.result);
 rejectUnchanged(loaded.state,'enqueue',['More'],'workflow_limit');assert.equal(persistence.save(loaded.state),'limit');assert.equal(store.raw,raw);
 assert.equal(persistence.save(createState()),'saved');assert.equal(read(store).notice,'');
});
test('scheduler and contextual decisions reject at history capacity without committing task or decision changes',()=>{
 const s=createState(),w=enqueue(s,'Brief');tick(s);const event=s.activity[0];s.activity=Array.from({length:LIMITS.activity},(_,i)=>({...event,id:`full-${i}`}));
 rejectUnchanged(s,'tick',[],'activity_limit');rejectUnchanged(s,'decide',[w.id,'cancel'],'activity_limit');rejectUnchanged(s,'fail',[w.id],'activity_limit');
});
test('input limits provide structured reasons and preserve current content',()=>{
 const {s,w}=prepared();rejectUnchanged(s,'editResult',[w.id,'x'.repeat(LIMITS.resultChars+1)],'result_limit');rejectUnchanged(s,'enqueue',['x'.repeat(LIMITS.requestChars+1)],'request_limit');
});
test('runtime activity uses the same canonical fields as restoration',()=>{
 const s=createState();assert.equal(perform(s,'record','Local event',undefined,'unknown').ok,true);assert.equal(s.activity[0].workflowId,null);assert.equal(s.activity[0].kind,'execution');assert.deepEqual(restore(JSON.stringify(s)).state.activity,s.activity);
});
