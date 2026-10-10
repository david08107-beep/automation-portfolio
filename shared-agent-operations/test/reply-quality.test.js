import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createReplyGenerator,normalizeReplyBody,declineIsClear} from '../src/reply-generation.js';
import {createDashboardServer} from '../server.mjs';
const input={workspace:'work',message:'Sarah asks Dave to confirm partnership terms.',brief:'Sarah needs confirmation before Friday.',previousBody:'Hi Sarah, the terms look good. Let us plan a kickoff.',settings:{goal:'decline',tone:'professional',feedback:'mixed'}};
const postpone='Hi Sarah,\nThe proposed terms do not align with our current priorities. I appreciate the effort but I need more time to reassess our alignment. I will get back to you soon.\nBest,\nDave';
const valid='Hi Sarah,\n\nThank you for the proposal. I must respectfully decline this proposal.\n\nBest,\nDave';
const response=body=>new Response(JSON.stringify({message:{content:JSON.stringify({body})}}));
test('literal newline escapes in a model reply become readable plain text',()=>{
 assert.equal(normalizeReplyBody('Hi Sarah,\\n\\nI must decline.\\r\\nBest,\\nDave'),'Hi Sarah,\n\nI must decline.\nBest,\nDave');
 assert.equal(normalizeReplyBody(valid),valid);
 assert.equal(normalizeReplyBody('<img src=x>\\nDave'),'<img src=x>\nDave'); // Never interpreted as HTML.
});
test('screenshot postponement fails the conservative decline check',()=>{
 assert.equal(declineIsClear(postpone),false);
 assert.equal(declineIsClear('The terms look good. Let us schedule the kickoff.'),false);
 assert.equal(declineIsClear(valid),true);
 assert.equal(declineIsClear('We will not proceed with this proposal.'),true);
});
test('postponement is repaired once with an explicit correction instruction',async()=>{
 let calls=0;
 const result=await createReplyGenerator({enabled:true,fetchImpl:async(_,options)=>{
 calls++;
 if(calls===1)return response(postpone);
 assert.match(JSON.parse(options.body).messages[0].content,/failed to clearly decline/);
 return response(valid.replace(/\n/g,'\\n'));
 }})(input);
 assert.equal(result.ok,true);assert.equal(result.value.body,valid);assert.equal(calls,2);
});
test('repeated postponement never becomes an accepted decline draft',async()=>{
 let calls=0;
 const result=await createReplyGenerator({enabled:true,fetchImpl:async()=>{calls++;return response(postpone);}})(input);
 assert.equal(result.error.code,'AI_GOAL_MISMATCH');assert.equal(calls,2);
});
test('normalized empty body is rejected without success',async()=>{
 const result=await createReplyGenerator({enabled:true,fetchImpl:async()=>response('\\n\\n')})(input);
 assert.equal(result.error.code,'AI_OUTPUT');
});
test('all tone and assessment selections retain the explicit decline instruction',async()=>{
 for(const tone of ['professional','warm','concise'])for(const feedback of ['positive','mixed','negative']){
 const result=await createReplyGenerator({enabled:true,fetchImpl:async(_,options)=>{
 const request=JSON.parse(options.body);const context=JSON.parse(request.messages[1].content);
 assert.equal(context.settings.tone,tone);assert.equal(context.settings.feedback,feedback);
 assert.match(request.messages[0].content,/Do not substitute a request for more time/);
 return response(valid);
 }} )({...input,settings:{...input.settings,tone,feedback}});
 assert.equal(result.ok,true);
 }
});
test('HTTP generation returns formatted draft without approvals or execution',async t=>{
 const server=createDashboardServer(undefined,createReplyGenerator({enabled:true,fetchImpl:async()=>response(valid.replace(/\n/g,'\\n'))}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const url=`http://127.0.0.1:${server.address().port}`;
 const result=await (await fetch(url+'/api/reply-generation',{method:'POST',headers:{Origin:url,'Content-Type':'application/json'},body:JSON.stringify(input)})).json();
 assert.equal(result.value.body,valid);assert.equal(result.value.requiresReview,true);
 assert.deepEqual((await (await fetch(url+'/api/workflows')).json()).workflows,[]);
});
test('reported bare backslash separators become paragraphs without changing Windows paths',()=>{
 const reported="Hi Sarah,\\ thanks for sending the proposal.\\ Best, Dave";
 assert.equal(normalizeReplyBody(reported),'Hi Sarah,\n\nthanks for sending the proposal.\n\nBest, Dave');
 assert.equal(normalizeReplyBody('See C:\\newfolder\\report.txt and C:\\temp\\notes.txt'),'See C:\\newfolder\\report.txt and C:\\temp\\notes.txt');
 assert.equal(normalizeReplyBody('Hi Sarah,\\\\n\\\\nThank you.\\\\r\\\\nBest, Dave'),'Hi Sarah,\n\nThank you.\nBest, Dave');
});
test('local requests cap generation and keep the model warm without changing deadlines',async()=>{
 const result=await createReplyGenerator({enabled:true,fetchImpl:async(_,options)=>{
 const request=JSON.parse(options.body);
 assert.equal(request.options.num_predict,384);assert.equal(request.keep_alive,'10m');
 assert.match(request.messages[0].content,/under 80 words/);
 return response(valid);
 }})(input);
 assert.equal(result.ok,true);
});
