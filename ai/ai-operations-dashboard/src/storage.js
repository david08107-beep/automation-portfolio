import {capacityFailure,snapshotFailure,LIMITS} from './limits.js';
import {STORAGE_KEY,createState,restore,statuses,recipes} from './engine.js';
export function browserStorage() {try{return window.localStorage;}catch{return null;}}
function viewPreferences(view,state) {
  if(!view||typeof view!=='object')return {};
  const output={};
  if(state.workflows.some(w=>w.id===view.selected))output.selected=view.selected;
  for(const [key,choices] of Object.entries({filter:['all','active',...statuses],taskFilter:['active','running','blocked','completed','all'],historyFilter:['all','selected'],process:['auto',...Object.keys(recipes)]}))if(choices.includes(view[key]))output[key]=view[key];
  if(typeof view.timelineOpen==='boolean')output.timelineOpen=view.timelineOpen;
  return output;
}
export function read(storage) {
  if(!storage)return {state:createState(),view:{},notice:'Browser storage is unavailable. Changes last only in this session.',healthy:false};
  try {
    const snapshot=storage.getItem(STORAGE_KEY)??null,restored=restore(snapshot),{view,...state}=restored.state;
    return {...restored,state,view:viewPreferences(view,state),snapshot,healthy:true};
  }catch{return {state:createState(),view:{},notice:'Browser storage is unavailable. Changes last only in this session.',healthy:false};}
}
export function write(storage,state,view={}) {
  try {if(!storage||capacityFailure(state))return false;const snapshot=JSON.stringify({...state,view:viewPreferences(view,state)});if(snapshotFailure(snapshot))return false;storage.setItem(STORAGE_KEY,snapshot);return true;}catch{return false;}
}

/** Best-effort optimistic guard for this browser demo, not an atomic server transaction. */
export function createPersistence(storage) {
  const initial=read(storage);
  let baseline=initial.snapshot??null,conflicted=false;
  function check() {
    if(conflicted)return 'conflict';
    try {
      if(!storage)return 'unavailable';
      if((storage.getItem(STORAGE_KEY)??null)!==baseline){conflicted=true;return 'conflict';}
      return 'current';
    }catch{return 'unavailable';}
  }
  let lastReason=null;
  function save(state,view={}) {
    const status=check();if(status!=='current')return status;
    try {
      const preferences=viewPreferences(view,state);
      lastReason=capacityFailure(state);if(lastReason)return 'limit';
      if(JSON.stringify(preferences).length>LIMITS.viewReserveChars){lastReason={code:'view_limit',message:'Workspace preference size limit reached.'};return 'limit';}
      const snapshot=JSON.stringify({...state,view:preferences});
      lastReason=snapshotFailure(snapshot);if(lastReason)return 'limit';
      storage.setItem(STORAGE_KEY,snapshot);baseline=snapshot;return 'saved';
    }catch{return 'unavailable';}
  }
  return {initial,check,save,get lastReason(){return lastReason;}};
}
