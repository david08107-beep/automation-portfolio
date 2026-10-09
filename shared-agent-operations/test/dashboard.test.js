import {test} from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createDashboardServer} from '../server.mjs';

async function dashboard(t) {
  const server = createDashboardServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const send = (input, origin = url) => fetch(`${url}/api/commands`, {method:'POST', headers:{Origin:origin,'Content-Type':'application/json'}, body:JSON.stringify(input)});
  const command = async input => {const res = await send(input); assert.equal(res.status,200); return (await res.json()).value;};
  return {url, send, command};
}

test('showcase serves only its allowlisted assets and viewing it leaves workflows untouched', async t => {
  const {url} = await dashboard(t);
  for (const [path, type] of [['/showcase','text/html'], ['/showcase.js','text/javascript'], ['/showcase.css','text/css']]) {
    const res = await fetch(`${url}${path}`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), new RegExp(type));
    assert.match(res.headers.get('content-security-policy'), /script-src 'self'/);
    const content = await res.text();
    assert.ok(content.length > 100);
    if (path === '/showcase') assert.match(content, /illustrative, not the live workflow/);
  }
  assert.equal((await fetch(`${url}/SHOWCASE.md`)).status, 404);
  assert.equal((await fetch(`${url}/local-data/history.json`)).status, 404);
  assert.deepEqual((await (await fetch(`${url}/api/workflows`)).json()).workflows, []);
});

test('dashboard runs prepare, edit, exact approval and simulated execution through the shared core', async t => {
  const {url, command, send} = await dashboard(t);
  const page = await fetch(url+'/campaigns');
  const html = await page.text();
  assert.match(html, /Your Executive Assistant/);
  assert.match(html, /data-view="studio"/);
  assert.match(html, /id="workflow-board"/);
  assert.match(html, /id="studio-intro"/);
  assert.ok(!html.includes('<iframe'));
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const prepared = await command({action:'start', request:'Fictional campaign', actorId:'attacker', workspaceId:'other'});
  assert.equal(prepared.actorId, 'demo-dave'); assert.equal(prepared.workspaceId, 'work');
  assert.equal(prepared.status,'awaiting-review');
  let version = prepared.results.at(-1);
  const approved = await command({action:'approve', workflowId:prepared.id, versionId:version.id,payloadDigest:version.payloadDigest});
  const edited = await command({action:'revise',workflowId:prepared.id,baseVersionId:version.id,payload:{...version.payload,launchPost:'Edited launch post'}});
  assert.equal(edited.approvals[0].status,'invalidated');
  const stale = await send({action:'execute',workflowId:prepared.id,approvalId:approved.approvals[0].id});
  assert.equal(stale.status,409);
  version = edited.results.at(-1);
  const current = await command({action:'approve', workflowId:prepared.id, versionId:version.id,payloadDigest:version.payloadDigest});
  const completed = await command({action:'execute',workflowId:prepared.id,approvalId:current.approvals.at(-1).id});
  assert.equal(completed.status,'completed'); assert.equal(completed.executions.length,1); assert.equal(completed.executions[0].simulated,true);
  const duplicate = await send({action:'execute',workflowId:prepared.id,approvalId:current.approvals.at(-1).id});
  assert.equal(duplicate.status,409);
  const list = await (await fetch(`${url}/api/workflows`)).json();
  assert.equal(list.workflows.length,1); assert.equal(list.workflows[0].executions.length,1);
});

test('dashboard preserves newer edits and rejects blank drafts and unsupported connected tasks',async t=>{
  const {command,send,url}=await dashboard(t);
  const w=await command({action:'start',request:'Prepare an email marketing campaign about meeting preparation'}), v=w.results.at(-1);
  await command({action:'revise',workflowId:w.id,baseVersionId:v.id,payload:{...v.payload,shortVideoScript:'Newer script'}});
  const stale=await send({action:'revise',workflowId:w.id,baseVersionId:v.id,payload:{...v.payload,launchPost:'Older edit'}});
  assert.equal(stale.status,409);
  assert.equal((await stale.json()).error.code,'DRAFT_STALE');
  const current=(await (await fetch(`${url}/api/workflows`)).json()).workflows[0];
  assert.equal(current.results.at(-1).payload.shortVideoScript,'Newer script');
  const empty=await send({action:'revise',workflowId:w.id,baseVersionId:current.results.at(-1).id,payload:{launchPost:'',shortVideoScript:'',calendar:[]}});
  assert.equal((await empty.json()).error.code,'INVALID_INPUT');
  for(const request of ['Summarize my inbox','Reschedule tomorrow’s meeting','Read my emails']) {
    const unsupported=await send({action:'start',request});
    assert.equal(unsupported.status,400);
    assert.equal((await unsupported.json()).error.code,'UNSUPPORTED_REQUEST');
  }
  assert.equal((await (await fetch(`${url}/api/workflows`)).json()).workflows.length,1);
});

test('dashboard rejects foreign origins, oversized input, unknown actions, traversal and malformed drafts', async t => {
  const {url,send} = await dashboard(t);
  assert.equal((await send({action:'start',request:'Fictional campaign'}, 'https://example.com')).status,403);
  assert.equal((await send({action:'start',request:'Fictional campaign'}, '')).status,403);
  assert.equal((await send({action:'start',request:'x'.repeat(65_000)})).status,413);
  assert.equal((await send({action:'get'})).status,400);
  assert.equal((await send({action:'revise',payload:{launchPost:'Bad'}})).status,400);
  assert.equal((await fetch(`${url}/src/operations.js`)).status,404);
  for (const path of ['/constructor', '/toString', '/__proto__']) {
    assert.equal((await fetch(`${url}${path}`)).status, 404);
  }
  const status = await new Promise((resolve,reject) => {
    const req = httpRequest(`${url}/api/workflows`, {headers:{Host:'untrusted.example'}}, res => {res.resume(); resolve(res.statusCode);});
    req.on('error',reject); req.end();
  });
  assert.equal(status,403);
});

test('cancelled dashboard work cannot be approved or executed', async t => {
  const {command,send} = await dashboard(t);
  const w = await command({action:'start',request:'Cancel this fictional campaign'});
  const cancelled = await command({action:'cancel',workflowId:w.id});
  assert.equal(cancelled.status,'cancelled');
  const v = w.results.at(-1);
  assert.equal((await send({action:'approve',workflowId:w.id,versionId:v.id,payloadDigest:v.payloadDigest})).status,409);
});

test('dashboard preserves Unicode text when request bytes arrive in split chunks', async t => {
  const {url} = await dashboard(t);
  const request = 'Prepare a fictional café campaign 🐾';
  const body = Buffer.from(JSON.stringify({action: 'start', request}));
  const split = body.indexOf(Buffer.from('é')) + 1;
  const result = await new Promise((resolve, reject) => {
    const req = httpRequest(`${url}/api/commands`, {
      method: 'POST', headers: {Origin: url, 'Content-Type': 'application/json'},
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8'))}));
    });
    req.on('error', reject);
    req.write(body.subarray(0, split));
    setTimeout(() => req.end(body.subarray(split)), 20);
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.value.command.request, request);
});

test('dashboard saves structured campaign fields and rejects malformed briefs',async t=>{
  const {command,send,url}=await dashboard(t);
  const campaignBrief={business:'Dog boarding',audience:'Local owners',platform:'Facebook',tone:'Educational',goal:'Request availability'};
  const w=await command({action:'start',request:'Prepare a campaign for dog boarding',campaignBrief});
  assert.deepEqual(w.command.campaignBrief,campaignBrief);
  assert.equal((await send({action:'start',request:'Prepare a campaign',campaignBrief:{...campaignBrief,goal:''}})).status,409);
  assert.equal((await fetch(`${url}/campaign.js`)).status,200);
});
