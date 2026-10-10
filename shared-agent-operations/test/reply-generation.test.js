import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReplyGenerator} from '../src/reply-generation.js';
import {createDashboardServer} from '../server.mjs';
const input={workspace:'work',message:'Sarah asks about kickoff.',brief:'Confirm Tuesday',previousBody:'Old reply',settings:{goal:'confirm',tone:'warm',feedback:'positive'}};
const response=body=>new Response(JSON.stringify({message:{content:JSON.stringify(body)}}));
const cloudInput={...input,mode:'cloud'};
const cloudConfig={cloudEnabled:true,cloudModel:'gemma4:31b',cloudApiKey:'test-cloud-key'};
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
test('cloud mode uses the hosted API with backend bearer authentication and no structured-output field',async()=>{
 const result=await createReplyGenerator({...cloudConfig,fetchImpl:async(url,options)=>{
   assert.equal(url,'https://ollama.com/api/chat');assert.equal(options.redirect,'error');
   assert.equal(options.headers.Authorization,'Bearer test-cloud-key');
   const request=JSON.parse(options.body);assert.equal(request.model,'gemma4:31b');assert.equal(request.stream,false);
   assert.equal(request.format,undefined);assert.equal(request.keep_alive,undefined);assert.equal(request.think,false);assert.equal(request.options.num_predict,384);
   assert.ok(!options.body.includes('test-cloud-key'));
   return response({body:'Thanks Sarah — Tuesday works for a discussion. — Dave'});
 }})(cloudInput);
 assert.equal(result.ok,true);assert.equal(result.value.source,'ollama-cloud');assert.equal(result.value.requiresReview,true);
});
test('cloud mode requires explicit opt-in, credentials, and a direct hosted model identifier',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;return response({body:'Draft'});};
 assert.equal((await createReplyGenerator({cloudModel:'gpt-oss:20b',cloudApiKey:'key',fetchImpl})(cloudInput)).error.code,'AI_DISABLED');
 assert.equal((await createReplyGenerator({cloudEnabled:true,cloudModel:'gpt-oss:20b',fetchImpl})(cloudInput)).error.code,'AI_CREDENTIALS');
 assert.equal((await createReplyGenerator({cloudEnabled:true,cloudModel:'gpt-oss:20b',cloudApiKey:'bad\nheader',fetchImpl})(cloudInput)).error.code,'AI_CREDENTIALS');
 assert.equal((await createReplyGenerator({cloudEnabled:true,cloudModel:'gpt-oss:20b:cloud',cloudApiKey:'key',fetchImpl})(cloudInput)).error.code,'AI_CONFIG');
 assert.equal(calls,0);
});
test('cloud invalid output retries once without silently switching providers',async()=>{
 let calls=0;const result=await createReplyGenerator({...cloudConfig,fetchImpl:async(url,options)=>{
   calls++;assert.equal(url,'https://ollama.com/api/chat');assert.equal(JSON.parse(options.body).format,undefined);
   return response(calls===1?{body:input.previousBody}:{body:'x',extra:'not allowed'});
 }})(cloudInput);
 assert.equal(result.error.code,'AI_OUTPUT');assert.equal(calls,2);
});
test('cloud authentication, model, and rate-limit failures are clear and redact provider details',async()=>{
 const cases=[
   [401,'AI_AUTH'],[403,'AI_AUTH'],[404,'AI_MODEL_UNAVAILABLE'],[400,'AI_REQUEST'],[503,'AI_UNAVAILABLE']
 ];
 for(const [status,code] of cases){
   const result=await createReplyGenerator({...cloudConfig,fetchImpl:async()=>new Response(JSON.stringify({error:'test-cloud-key private provider detail'}),{status})})(cloudInput);
   assert.equal(result.error.code,code);assert.ok(!JSON.stringify(result).includes('test-cloud-key'));assert.ok(!JSON.stringify(result).includes('private provider detail'));
 }
 const limited=await createReplyGenerator({...cloudConfig,fetchImpl:async()=>new Response('{}',{status:429,headers:{'Retry-After':'12'}})})(cloudInput);
 assert.equal(limited.error.code,'AI_RATE_LIMIT');assert.match(limited.error.message,/12 seconds/);
});
test('cloud timeout and explicit cancellation abort the hosted request without changing the draft',async()=>{
 let timeoutSignal;const timedOut=await createReplyGenerator({...cloudConfig,timeoutMs:10,fetchImpl:async(_,options)=>{timeoutSignal=options.signal;return new Response(new ReadableStream({start(){}}));}})(cloudInput);
 assert.equal(timedOut.error.code,'AI_TIMEOUT');assert.equal(timeoutSignal.aborted,true);
 const external=new AbortController();let cancelSignal;
 const pending=createReplyGenerator({...cloudConfig,fetchImpl:async(_,options)=>{cancelSignal=options.signal;return new Promise(()=>{});}})(cloudInput,{signal:external.signal});
 external.abort();const cancelled=await pending;
 assert.equal(cancelled.error.code,'AI_CANCELLED');assert.equal(cancelSignal.aborted,true);assert.match(cancelled.error.message,/draft is preserved/);
});
test('cloud mode preserves workspace context and cannot create approval or execution',async()=>{
 let providerContext;
 const generated=await createReplyGenerator({...cloudConfig,fetchImpl:async(_,options)=>{providerContext=JSON.parse(JSON.parse(options.body).messages[1].content);return response({body:'Thanks — I will review the details. — Dave'});}})({...cloudInput,workspace:'personal'});
 assert.equal(generated.ok,true);assert.equal(providerContext.workspace,'personal');
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
 const core=require('../executive/reply/core.js');const fixtures=require('../executive/reply/fixtures.js');
 const service=core.createService({repository:core.memoryRepository(),messages:fixtures.personal});
 const context={workspace:{id:'personal'},actor:{id:'demo-dave'},messageId:'personal-message-0'};
 const draft=service.createReplyDraft(context).value;
 const revised=service.saveReplyDraftVersion({...context,draftId:draft.draft.id,expectedRevision:draft.draft.currentRevision,body:generated.value.body});
 assert.equal(revised.ok,true);const history=service.getReplyHistory(context).value;
 assert.equal(history.approvals.length,0);assert.equal(history.executions.length,0);
 assert.equal(service.executeApprovedReply({...context,draftId:draft.draft.id}).error.code,'APPROVAL_REQUIRED');
});
test('capability status exposes readiness but never the cloud credential',async t=>{
 const generator=createReplyGenerator({...cloudConfig});
 const server=createDashboardServer(undefined,generator);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url=`http://127.0.0.1:${server.address().port}`;const status=await (await fetch(url+'/api/reply-generation/status')).json();
 assert.equal(status.defaultMode,'scripted');assert.equal(status.modes.local.enabled,false);assert.equal(status.modes.cloud.enabled,true);
 assert.ok(!JSON.stringify(status).includes('test-cloud-key'));
});
test('HTTP cloud generation returns only an editable draft and leaves workflow persistence untouched',async t=>{
 let calls=0;const generator=createReplyGenerator({...cloudConfig,fetchImpl:async(url,options)=>{calls++;assert.equal(url,'https://ollama.com/api/chat');assert.equal(options.headers.Authorization,'Bearer test-cloud-key');return response({body:'Thanks Sarah — I will review Tuesday. — Dave'});}});
 const server=createDashboardServer(undefined,generator);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url=`http://127.0.0.1:${server.address().port}`;
 const reply=await fetch(url+'/api/reply-generation',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(cloudInput)});
 const result=await reply.json();assert.equal(reply.status,200);assert.equal(result.value.requiresReview,true);assert.equal(result.value.source,'ollama-cloud');assert.equal(calls,1);
 assert.deepEqual((await (await fetch(url+'/api/workflows')).json()).workflows,[]);
});
test('decline stays explicit with warm tone and positive assessment',async()=>{
 const result=await createReplyGenerator({enabled:true,fetchImpl:async(_,options)=>{
 const prompt=JSON.parse(options.body).messages[0].content;
 assert.match(prompt,/Clearly and respectfully decline/);assert.match(prompt,/Do not accept the terms/);assert.match(prompt,/friendly, empathetic/);assert.match(prompt,/positive feedback does not mean accepting/);
 return response({body:'Thank you Sarah. I appreciate the effort, but must decline.'});
 }} )({...input,settings:{goal:'decline',tone:'warm',feedback:'positive'}});
 assert.equal(result.ok,true);
});
test('unchanged output retries once and accepts a distinct reply',async()=>{
 let calls=0;const result=await createReplyGenerator({enabled:true,fetchImpl:async(_,options)=>{
 calls++;if(calls===1)return response({body:input.previousBody});
 assert.match(JSON.parse(options.body).messages[0].content,/last result was invalid or unchanged/);
 return response({body:'A distinct reply for Dave'});
 }})(input);
 assert.equal(result.ok,true);assert.equal(calls,2);
});
test('repeated unchanged output returns specific error with bounded attempts',async()=>{
 let calls=0;const result=await createReplyGenerator({enabled:true,fetchImpl:async()=>{calls++;return response({body:input.previousBody});}})(input);
 assert.equal(result.error.code,'AI_UNCHANGED');assert.equal(calls,2);
});
