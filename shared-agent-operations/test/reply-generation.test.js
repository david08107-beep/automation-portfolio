import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReplyGenerator} from '../src/reply-generation.js';
import {createDashboardServer} from '../server.mjs';
const input={workspace:'work',message:'Sarah asks about kickoff.',brief:'Confirm Tuesday',previousBody:'Old reply',settings:{goal:'confirm',tone:'warm',feedback:'positive'}};
const response=body=>new Response(JSON.stringify({message:{content:JSON.stringify(body)}}));
test('disabled and invalid input never contact a model',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return response({body:'Hello'});};
 assert.equal((await createReplyGenerator({fetchImpl})(input)).error.code,'AI_DISABLED');
 assert.equal((await createReplyGenerator({enabled:true,fetchImpl})({...input,workspace:'other'})).error.code,'INVALID_INPUT');assert.equal(calls,0);
});
test('optional model returns only an editable draft',async()=>{
 const result=await createReplyGenerator({enabled:true,fetchImpl:async(url,options)=>{assert.equal(url,'http://127.0.0.1:11434/api/chat');assert.equal(options.redirect,'error');const data=JSON.parse(options.body);assert.equal(data.stream,false);assert.match(data.messages[1].content,/Confirm Tuesday/);return response({body:'Thanks Sarah — Tuesday works. — Dave'});}})(input);
 assert.equal(result.ok,true);assert.equal(result.value.requiresReview,true);
});
test('invalid, unchanged, oversized and failed outputs preserve drafts',async()=>{
 for(const fetchImpl of [async()=>response({body:input.previousBody}),async()=>response({body:'x',send:true}),async()=>response({body:'x'.repeat(13000)}),async()=>new Response('broken'),async()=>{throw Error('secret provider details');},async()=>new Response('x'.repeat(65000))]){
 const result=await createReplyGenerator({enabled:true,fetchImpl})(input);assert.equal(result.ok,false);assert.ok(!JSON.stringify(result).includes('secret provider details'));
 }
});
test('timeout includes body consumption and aborts request',async()=>{
 let signal;const result=await createReplyGenerator({enabled:true,timeoutMs:10,fetchImpl:async(_,options)=>{signal=options.signal;return new Response(new ReadableStream({start(){}}));}})(input);
 assert.equal(result.error.code,'AI_TIMEOUT');assert.equal(signal.aborted,true);
});
test('HTTP draft route enforces origin and leaves workflows unchanged',async t=>{
 const server=createDashboardServer(undefined,createReplyGenerator({enabled:true,fetchImpl:async()=>response({body:'Hello Sarah'})}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url=`http://127.0.0.1:${server.address().port}`;
 const send=origin=>fetch(url+'/api/reply-generation',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(input)});
 assert.equal((await send('https://foreign.example')).status,403);
 assert.equal((await (await send(url)).json()).value.body,'Hello Sarah');
 assert.deepEqual((await (await fetch(url+'/api/workflows')).json()).workflows,[]);
});
test('generated text enters existing revision service without approval or execution',async()=>{
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
 const core=require('../executive/reply/core.js');const fixtures=require('../executive/reply/fixtures.js');
 const service=core.createService({repository:core.memoryRepository(),messages:fixtures.work});
 const context={workspace:{id:'work'},actor:{id:'demo-dave'},messageId:'work-message-0'};
 const draft=service.createReplyDraft(context).value;
 const generated=await createReplyGenerator({enabled:true,fetchImpl:async()=>response({body:'Thanks Sarah, let us discuss Tuesday.'})})(input);
 const revised=service.saveReplyDraftVersion({...context,draftId:draft.draft.id,expectedRevision:draft.draft.currentRevision,body:generated.value.body});
 assert.equal(revised.ok,true);
 const history=service.getReplyHistory(context).value;assert.equal(history.approvals.length,0);assert.equal(history.executions.length,0);
 assert.equal(service.executeApprovedReply({...context,draftId:draft.draft.id}).error.code,'APPROVAL_REQUIRED');
});
test('capability status reports opt-in without contacting Ollama',async t=>{
 for(const enabled of [false,true]){
 let calls=0;const generator=createReplyGenerator({enabled,fetchImpl:async()=>{calls++;throw Error('should not call');}});
 const server=createDashboardServer(undefined,generator);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
 const url=`http://127.0.0.1:${server.address().port}`;
 const status=await (await fetch(url+'/api/reply-generation/status')).json();
 assert.equal(status.enabled,enabled);assert.equal(calls,0);
 if(!enabled){const res=await fetch(url+'/api/reply-generation',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal((await res.json()).error.code,'AI_DISABLED');assert.equal(calls,0);}
 }finally{await new Promise(resolve=>server.close(resolve));}
 }
});
test('local-only configuration rejects cloud models and editor output overflow',async()=>{
 let calls=0;
 const cloud=await createReplyGenerator({enabled:true,model:'gemma4:cloud',fetchImpl:async()=>{calls++;return response({body:'Draft'});}})(input);
 assert.equal(cloud.error.code,'AI_CONFIG');assert.equal(calls,0);
 const oversized=await createReplyGenerator({enabled:true,fetchImpl:async()=>response({body:'x'.repeat(10001)})})(input);
 assert.equal(oversized.error.code,'AI_OUTPUT');
});
