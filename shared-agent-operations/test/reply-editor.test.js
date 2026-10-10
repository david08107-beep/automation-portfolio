import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {matches,lock}=createRequire(import.meta.url)('../executive/reply/editor-state.js');
const before={body:'Hello\r\nDave',brief:'Ask about terms',to:'sarah@example.test',subject:'Proposal',settings:{goal:'clarify',tone:'concise',feedback:'positive'},at:'earlier',label:'Before AI'};
test('editor matching ignores metadata, property ordering and textarea line endings',()=>{
 assert.equal(matches(before,{...before,body:'Hello\nDave',settings:{feedback:'positive',tone:'concise',goal:'clarify'},at:'later',label:'Saved'}),true);
});
test('actual body, brief, recipient, subject and setting edits are detected',()=>{
 for(const key of ['body','brief','to','subject'])assert.equal(matches(before,{...before,[key]:'changed'}),false);
 for(const key of ['goal','tone','feedback'])assert.equal(matches(before,{...before,settings:{...before.settings,[key]:'changed'}}),false);
});
test('generation locks controls and restores their original disabled states on completion or cancel',()=>{
 const controls=[{disabled:false},{disabled:true},{disabled:false}];const unlock=lock(controls);
 assert.ok(controls.every(control=>control.disabled));unlock();assert.deepEqual(controls.map(control=>control.disabled),[false,true,false]);unlock();assert.deepEqual(controls.map(control=>control.disabled),[false,true,false]);
});
