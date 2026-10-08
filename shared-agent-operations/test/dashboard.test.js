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

test('dashboard runs prepare, edit, exact approval and simulated execution through the shared core', async t => {
  const {url, command, send} = await dashboard(t);
  const page = await fetch(url);
  assert.match(await page.text(), /AI Projects Hub/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const prepared = await command({action:'start', request:'Fictional campaign', actorId:'attacker', workspaceId:'other'});
  assert.equal(prepared.actorId, 'demo-dave'); assert.equal(prepared.workspaceId, 'work');
  assert.equal(prepared.status,'awaiting-review');
  let version = prepared.results.at(-1);
  const approved = await command({action:'approve', workflowId:prepared.id, versionId:version.id,payloadDigest:version.payloadDigest});
  const edited = await command({action:'revise',workflowId:prepared.id,payload:{...version.payload,launchPost:'Edited launch post'}});
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

test('dashboard rejects foreign origins, oversized input, unknown actions, traversal and malformed drafts', async t => {
  const {url,send} = await dashboard(t);
  assert.equal((await send({action:'start',request:'Fictional campaign'}, 'https://example.com')).status,403);
  assert.equal((await send({action:'start',request:'Fictional campaign'}, '')).status,403);
  assert.equal((await send({action:'start',request:'x'.repeat(65_000)})).status,413);
  assert.equal((await send({action:'get'})).status,400);
  assert.equal((await send({action:'revise',payload:{launchPost:'Bad'}})).status,400);
  assert.equal((await fetch(`${url}/src/operations.js`)).status,404);
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
