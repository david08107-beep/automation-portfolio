import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDashboardServer} from '../server.mjs';

test('Orbit remains the entry point with original assistant and additive campaign areas',async t=>{
  const server=createDashboardServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}`;
  const page=await fetch(url), html=await page.text();
  assert.equal(page.status,200);
  for(const id of ['executive-title','command-form','inbox','calendar','tasks','approvals','message-dialog','meeting-dialog','personal-workspace-tab','shared-workspace']) assert.ok(html.includes(`id="${id}"`),id);
  assert.ok(!html.includes('id="workspace-toggle"'));
  assert.ok(!html.includes('id="workspace-menu"'));
  assert.match(html,/href="#workflows"/); assert.match(html,/href="#studio"/);
  assert.match(html,/id="personal-workspace-tab"/);
  assert.match(html,/id="work-workspace-tab"/);
  assert.match(html,/id="workspace-scope-note"/);
  assert.match(html,/href="#studio" data-work-only/);
  assert.equal((await fetch(url+'/executive/workspace-policy.js')).status,200);
  assert.ok(!html.includes('<iframe'));
  for(const path of ['/executive/app.js','/executive/styles.css','/executive/reply/core.js','/executive/reply/editor-state.js','/executive/reply/fixtures.js','/executive/reply/browser-adapter.js','/executive/integration.js','/executive/workspace.css']) assert.equal((await fetch(url+path)).status,200,path);
  assert.equal((await fetch(url+'/executive/tests/reply-service.cjs')).status,404);
  assert.equal((await fetch(url+'/executive/README.md')).status,404);
  assert.deepEqual((await (await fetch(url+'/api/workflows')).json()).workflows,[]);
});
