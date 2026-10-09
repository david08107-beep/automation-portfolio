import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const policy=require('../executive/workspace-policy.js');
const fixtures=require('../executive/reply/fixtures.js');

test('Personal and Work have distinct purposes and business tools fail closed',()=>{
  assert.match(policy.context('personal').subtitle,/Family messages/);
  assert.match(policy.context('work').subtitle,/Work emails/);
  assert.equal(policy.businessAllowed('personal'),false);
  assert.equal(policy.businessAllowed('work'),true);
  assert.equal(policy.businessAllowed('unknown'),false);
  assert.throws(()=>policy.context('unknown'),/Unknown workspace/);
});
test('resetting Personal preserves Work changes without mutating saved contexts',()=>{
  const personal={tasks:['groceries'],drafts:{reply:'Family reply'}},work={tasks:['budget'],drafts:{reply:'Client reply'}};
  const saved={personal,work},next=policy.reset(saved,'personal',()=>({tasks:[],drafts:{}}));
  assert.strictEqual(next.work,work);
  assert.deepEqual(next.personal,{tasks:[],drafts:{}});
  assert.deepEqual(saved.personal,personal);
  assert.notStrictEqual(next.personal,next.work);
});
test('resetting Work preserves Personal changes and rejects unknown targets',()=>{
  const saved={personal:{tasks:['groceries']},work:{tasks:['budget']}};
  assert.strictEqual(policy.reset(saved,'work',()=>({})).personal,saved.personal);
  assert.throws(()=>policy.reset(saved,'unknown',()=>({})),/Unknown workspace/);
});
test('personal and work email fixtures have separate identities and audiences',()=>{
  for(const id of ['personal','work']) {
    assert.ok(fixtures[id].length>0);
    for(const message of fixtures[id]) {
      assert.equal(message.workspaceId,id);
      assert.ok(message.id.startsWith(id+'-message-'));
    }
  }
  assert.match(fixtures.personal[0].subject,/Family lunch/);
  assert.match(fixtures.work[0].subject,/partnership/);
  assert.equal(fixtures.personal.some(m=>m.sender==='Sarah Mitchell'),false);
  assert.equal(fixtures.work.some(m=>m.sender==='Alex Rivera'),false);
});
