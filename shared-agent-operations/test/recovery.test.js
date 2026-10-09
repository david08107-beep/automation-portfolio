import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DraftRecovery, STORAGE_KEY} from '../web/drafts.js';

const payload = {launchPost: 'My edited launch', shortVideoScript: 'My script', calendar: ['First day', '', 'Third day']};
function storage() {
  const records = new Map();
  return {getItem: key => records.get(key) ?? null, setItem: (key,value) => records.set(key,value)};
}

test('draft recovery keeps independent edits and notes across browser reloads', () => {
  const disk = storage(), first = new DraftRecovery(disk);
  first.remember('request-a','version-a',payload);
  first.remember('request-b','version-b',{...payload,launchPost:'Different request'});
  first.note('request','Unsubmitted request'); first.note('priorities','Review launch');
  first.setView('review','request-a');
  const reload = new DraftRecovery(disk);
  assert.deepEqual(reload.get('request-a').payload,payload);
  assert.equal(reload.get('request-b').payload.launchPost,'Different request');
  assert.equal(reload.state.request,'Unsubmitted request'); assert.equal(reload.state.priorities,'Review launch');
  assert.equal(reload.state.view,'review'); assert.equal(reload.state.selected,'request-a');
  reload.discard('request-a');
  assert.equal(new DraftRecovery(disk).get('request-a'),null);
  assert.equal(new DraftRecovery(disk).get('request-b').baseVersionId,'version-b');
});

test('recovery copies cannot introduce approvals and retain the original version reference', () => {
  const recovery = new DraftRecovery(storage());
  recovery.remember('request','old-version',payload);
  const copy = recovery.get('request'); copy.payload.launchPost='Modified read';
  assert.equal(recovery.get('request').payload.launchPost,payload.launchPost);
  assert.equal(recovery.get('request').baseVersionId,'old-version');
  assert.equal(recovery.get('request').approval,undefined);
});

test('unavailable storage retains in-tab edits and reports the limitation', () => {
  const broken = {getItem() {throw Error('blocked');},setItem() {throw Error('full');}};
  const recovery = new DraftRecovery(broken);
  assert.equal(recovery.remember('request','version',payload),false);
  assert.equal(recovery.persistent,false);
  assert.deepEqual(recovery.get('request').payload,payload);
});

test('malformed recovery records are ignored instead of rendered as drafts', () => {
  const disk = storage();
  disk.setItem(STORAGE_KEY,JSON.stringify({drafts:{bad:{baseVersionId:'v',payload:{calendar:'not an array'}}}}));
  assert.equal(new DraftRecovery(disk).get('bad'),null);
});

test('independent browser tabs do not erase each other’s recovery records', () => {
  const disk = storage(), a = new DraftRecovery(disk), b = new DraftRecovery(disk);
  a.remember('request-a','version-a',payload);
  b.remember('request-b','version-b',payload);
  a.note('priorities','Keep the launch on track');
  const restored = new DraftRecovery(disk);
  assert.ok(restored.get('request-a')); assert.ok(restored.get('request-b'));
  b.discard('request-b');
  assert.ok(new DraftRecovery(disk).get('request-a'));
});

test('content studio view restores the same selected request and local draft', () => {
  const disk = storage(), first = new DraftRecovery(disk);
  first.remember('campaign-a', 'version-a', payload);
  first.setView('studio', 'campaign-a');
  const reload = new DraftRecovery(disk);
  assert.equal(reload.state.view, 'studio');
  assert.equal(reload.state.selected, 'campaign-a');
  assert.deepEqual(reload.get('campaign-a').payload, payload);
});
