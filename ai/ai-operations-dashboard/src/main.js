import './style.css';
import {createState,perform,recipes,recipeFor,matchesFilter,decisionQueue,regenerate,restoreDraft,STORAGE_KEY} from './engine.js';
import {browserStorage,createPersistence} from './storage.js';
import {layout} from './ui.js';
import {patchWorkspace} from './dom.js';
const persistence=createPersistence(browserStorage()),initial=persistence.initial;
let state=initial.state,preserveUnreadableSnapshot=initial.healthy&&Boolean(initial.notice);
const ctx={selected:state.workflows[0]?.id,filter:'all',command:'',taskFilter:'active',historyFilter:'all',storageHealthy:initial.healthy,timelineOpen:false,process:'auto',storageConflict:false,historyLimit:60,draftHistoryOpen:false,transferStatus:'',planOpen:false,...initial.view};
const root=document.querySelector('#app');
// Keep modal and live-region DOM stable while unrelated workflows continue running.
const dialog=document.createElement('dialog');dialog.id='confirm';dialog.setAttribute('aria-labelledby','confirm-title');dialog.setAttribute('aria-describedby','confirm-copy');
dialog.innerHTML='<form method="dialog"><p class="eyebrow">DAVE’S DECISION</p><h2 id="confirm-title"></h2><p id="confirm-copy"></p><pre id="confirm-result" tabindex="0" role="region" aria-label="Edited result to approve" hidden></pre><div class="dialog-actions"><button value="cancel">Keep working</button><button class="primary" id="confirm-action" value="confirm">Confirm</button></div></form>';
const live=document.createElement('div');live.className='sr-only';live.setAttribute('role','status');live.setAttribute('aria-live','polite');
const notice=document.createElement('div');notice.id='notice';notice.setAttribute('role','status');
document.body.append(dialog,live,notice);notice.textContent=initial.notice;
let pendingDecision=null,returnFocus=null,composing=false,renderPending=false;
const dirtyEdits=new Set();
function processType(){return ctx.process==='auto'?recipeFor(ctx.command):ctx.process;}
function revealSelected(){const w=state.workflows.find(w=>w.id===ctx.selected);if(w&&!matchesFilter(w,ctx.filter))ctx.filter='all';}
function run(operation,...args){const outcome=perform(state,operation,...args);if(!outcome.ok&&outcome.reason.code!=='invalid_operation'){notice.textContent=outcome.reason.message;announce(outcome.reason.message);}return outcome;}
function flushEdits(id){let changed=false;for(const workflowId of [...dirtyEdits]){if(id&&id!==workflowId)continue;if(run('record','Dave edited the prepared result',workflowId,'edit').ok){dirtyEdits.delete(workflowId);changed=true;}}return changed;}
function announce(message){live.textContent=message;}
function blockStaleWorkspace(){
 if(ctx.storageConflict)return;
 ctx.storageConflict=true;
 notice.replaceChildren();const message=document.createElement('p');
 message.textContent='Another tab changed this workspace. This tab is paused to prevent overwriting it. Copy any unsaved edits before reloading.';
 const reload=document.createElement('button');reload.id='reload-latest';reload.textContent='Reload latest workspace';
 reload.onclick=()=>confirm('Reload the latest workspace?','This loads the saved workspace from the other tab. Any unsaved edits or request text in this tab will be discarded. Copy them before continuing.',()=>location.reload(),{label:'Reload latest',allowConflict:true});
 notice.append(message,reload);
 if(dialog.open&&!pendingDecision?.allowConflict){dialog.returnValue='cancel';dialog.close();}
 render();announce('Workspace changed in another tab. This tab is paused.');
}
function ensureCurrent(){if(persistence.check()==='conflict'){blockStaleWorkspace();return false;}return true;}
function save(){
 const previous=ctx.storageHealthy,status=persistence.save(state,ctx);
 if(status==='conflict'){blockStaleWorkspace();return;}
 if(status==='limit'){notice.textContent=persistence.lastReason.message;announce(persistence.lastReason.message);return;}
 ctx.storageHealthy=status==='saved';if(ctx.storageHealthy)preserveUnreadableSnapshot=false;
 notice.textContent=ctx.storageHealthy?'':'Browser storage is unavailable. Changes last only in this session.';
 if(previous!==ctx.storageHealthy)queueMicrotask(render);
}
function savePreferences(){if(!preserveUnreadableSnapshot)save();}
function render(){
 if(composing){renderPending=true;return;}renderPending=false;
 const active=document.activeElement,focusId=root.contains(active)?active.id:null,focusKey=active?.dataset?.focus,focusAction=active?.dataset?.action,focusWorkflow=active?.dataset?.id;
 const start=active?.selectionStart,end=active?.selectionEnd;
 const scrollPositions=[...root.querySelectorAll('.workflow-list,.task-table,.history ul')].map(el=>[el.className,el.scrollTop]);
 patchWorkspace(root,layout(state,ctx));
 const command=document.querySelector('#command');command.setCustomValidity(ctx.command.length&&!ctx.command.trim()?'Enter a request with at least one non-space character.':'');
 if(ctx.storageConflict){
   for(const control of root.querySelectorAll('#create-workflow,#process,[data-action="demo"],[data-action="reset"],[data-action="suggest"],[data-action="approve"],[data-action="cancel"],[data-action="fail"],[data-action="retry"],[data-action="regenerate"],[data-action="restore-draft"]'))control.disabled=true;
   command.readOnly=true;const result=document.querySelector('#result');if(result)result.readOnly=true;
 }
 for(const [name,top] of scrollPositions){const el=name?root.querySelector('.'+name.replaceAll(' ','.')):root.querySelector('.history ul');if(el)el.scrollTop=top;}
 let next=focusId?document.getElementById(focusId):null;if(!next&&focusKey)next=[...root.querySelectorAll('[data-focus]')].find(el=>el.dataset.focus===focusKey);
 if(!next&&focusAction)next=[...root.querySelectorAll('[data-action]')].find(el=>el.dataset.action===focusAction&&el.dataset.id===focusWorkflow);
 next?.focus({preventScroll:true});if(next?.setSelectionRange&&typeof start==='number')next.setSelectionRange(start,end);
}
function select(id,review=false){
 if(flushEdits())save();ctx.selected=id;ctx.transferStatus='';ctx.draftHistoryOpen=false;ctx.planOpen=false;revealSelected();savePreferences();render();const selected=state.workflows.find(w=>w.id===id);const section=document.querySelector(selected?.status==='awaiting review'?'.result':selected?.status==='failed'?'.failure':'#execution');section.scrollIntoView({behavior:'instant',block:'start'});
 const focus=selected?.status==='awaiting review'?document.querySelector('#result'):selected?.status==='failed'?document.querySelector('[data-action="retry"]'):document.querySelector('#detail-title');if(focus){if(focus.id==='detail-title')focus.tabIndex=-1;focus.focus({preventScroll:true});}
}
function confirm(title,copy,action,{result='',label='Confirm',allowConflict=false}={}){
 returnFocus={id:document.activeElement?.id,action:document.activeElement?.dataset?.action,workflow:document.activeElement?.dataset?.id};
 document.querySelector('#confirm-title').textContent=title;document.querySelector('#confirm-copy').textContent=copy;
 document.querySelector('#confirm-result').textContent=result;document.querySelector('#confirm-result').hidden=!result;
 document.querySelector('#confirm-action').textContent=label;pendingDecision={run:action,allowConflict};dialog.returnValue='';dialog.showModal();dialog.querySelector('button[value="cancel"]').focus();
}
dialog.addEventListener('close',()=>{
 const action=pendingDecision;pendingDecision=null;if(dialog.returnValue==='confirm'&&(action?.allowConflict||ensureCurrent()))action?.run();
 const target=document.getElementById(returnFocus?.id)||[...root.querySelectorAll('[data-action]')].find(el=>el.dataset.action===returnFocus?.action&&el.dataset.id===returnFocus?.workflow);
 if(ctx.storageConflict)document.querySelector('#reload-latest')?.focus({preventScroll:true});else if(target&&!target.disabled)target.focus({preventScroll:true});else {const fallback=document.querySelector('#detail-title')||document.querySelector('#command');if(fallback){if(fallback.id==='detail-title')fallback.tabIndex=-1;fallback.focus({preventScroll:true});}}
});
root.addEventListener('compositionstart',()=>composing=true);root.addEventListener('compositionend',()=>{composing=false;if(renderPending)render();});
root.addEventListener('input',event=>{
 if(event.target.id==='command'){
   ctx.command=event.target.value;event.target.setCustomValidity(ctx.command.length&&!ctx.command.trim()?'Enter a request with at least one non-space character.':'');document.querySelector('#process-preview').textContent=`Will prepare: ${recipes[processType()].name} · fictional data`;
 }
 if(event.target.id==='result'){
   const id=event.target.dataset.workflow,w=state.workflows.find(w=>w.id===id);
   if(!ensureCurrent())return;
   const outcome=w&&w.result!==event.target.value?run('editResult',id,event.target.value):{ok:true};
   event.target.setCustomValidity(outcome.ok?'':outcome.reason.message);
   if(outcome.ok&&w){dirtyEdits.add(id);save();}
   document.querySelector('#approve').disabled=!outcome.ok||!event.target.value.trim();
 }
});
root.addEventListener('change',event=>{
 if(event.target.id==='result'){if(flushEdits(event.target.dataset.workflow))save();return;}
 const key={'filter':'filter','task-filter':'taskFilter','history-filter':'historyFilter','process':'process'}[event.target.id];if(key){if(key==='historyFilter')ctx.historyLimit=60;ctx[key]=event.target.value;savePreferences();render();}
});
root.addEventListener('toggle',event=>{if(event.target.classList.contains('plan-details'))ctx.planOpen=event.target.open;if(event.target.classList.contains('draft-history'))ctx.draftHistoryOpen=event.target.open;if(event.target.classList.contains('timeline-details')&&ctx.timelineOpen!==event.target.open){ctx.timelineOpen=event.target.open;savePreferences();}},true);
root.addEventListener('submit',event=>{
 if(event.target.id!=='command-form')return;event.preventDefault();if(!ensureCurrent())return;const outcome=run('enqueue',ctx.command,processType());if(!outcome.ok)return;const w=outcome.value;flushEdits();
 ctx.selected=w.id;ctx.command='';ctx.filter='all';save();render();announce('Request queued. Simulated execution will start shortly.');
});
window.addEventListener('pagehide',()=>{if(flushEdits())save();});
root.addEventListener('click',event=>{
 const summary=event.target.closest('[data-summary]');if(summary){event.preventDefault();ctx.filter=summary.dataset.summary;const matching=state.workflows.filter(w=>matchesFilter(w,ctx.filter));const next=decisionQueue(state).find(w=>matchesFilter(w,ctx.filter))||matching.find(w=>w.id===ctx.selected)||matching[0];if(next)select(next.id);else{savePreferences();render();document.querySelector('#workflows').scrollIntoView({behavior:'instant',block:'start'});document.querySelector('#filter').focus({preventScroll:true});}}
 const button=event.target.closest('[data-action]');if(!button)return;
 const {action,id,type,index}=button.dataset,w=state.workflows.find(w=>w.id===id);
 if(action==='history-more'){ctx.historyLimit+=60;render();const focus=document.querySelector('[data-action="history-more"]')||document.querySelector('#activity h2');if(focus){if(focus.tagName!=='BUTTON')focus.tabIndex=-1;focus.focus({preventScroll:true});}}
 if(['suggest','demo','reset','approve','cancel','fail','retry','regenerate','restore-draft'].includes(action)&&!ensureCurrent())return;
 if(action==='close-drafts'){ctx.draftHistoryOpen=false;render();document.querySelector('.draft-history summary')?.focus();}
 if(action==='regenerate'&&w){if(run('regenerate',id).ok){flushEdits();save();render();announce('Alternative ready. Previous draft retained.');}}
 if(action==='restore-draft'&&w){if(run('restoreDraft',id,Number(index)).ok){flushEdits();ctx.process=w.type;save();render();announce('Saved draft restored. Previous draft retained.');}}
 if(['copy','download'].includes(action)&&w?.result){
  const report=message=>{ctx.transferStatus=message;render();announce(message);};
  if(action==='copy'){
   if(!navigator.clipboard?.writeText)report('Clipboard is unavailable. Select and copy the draft manually.');
   else navigator.clipboard.writeText(w.result).then(()=>report('Draft copied.'),()=>report('Clipboard access was denied. Select and copy the draft manually.'));
  }else{let url;try{url=URL.createObjectURL(new Blob([w.result],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`ai-os-${w.type}-draft.txt`;document.body.append(link);link.click();link.remove();report('Draft download requested. Check your browser downloads.');}catch{report('The draft could not be downloaded. Select and copy the text manually.');}finally{if(url)setTimeout(()=>URL.revokeObjectURL(url),1000);}}
 }
 if(action==='suggest'){ctx.process=type;ctx.command=recipes[type].label;savePreferences();render();document.querySelector('#command').focus();}
 if(['select','review','inspect'].includes(action))select(id,action==='review');
 if(action==='demo'){if(!run('seedDemo').ok)return;flushEdits();ctx.selected=state.workflows.find(w=>w.status==='awaiting review')?.id;save();render();announce('Demo loaded: an operations brief, project update, and failed software triage.');}
 if(action==='reset')confirm('Reset the demo?','This deletes all workflows, edits, decisions, and history saved by AI OS in this browser. Other projects are unaffected.',()=>{state=createState();dirtyEdits.clear();ctx.selected=null;ctx.command='';ctx.filter='all';ctx.historyFilter='all';ctx.taskFilter='active';ctx.process='auto';ctx.timelineOpen=false;ctx.historyLimit=60;save();render();announce('Demo reset.');});
 if(action==='approve'&&w){if(document.querySelector('#result')?.value!==w.result){announce('The current edit could not be saved. Restore or shorten it before approving.');return;}if(flushEdits())save();const reviewedResult=w.result;confirm('Approve this prepared result?',`Approve the exact edited result for “${w.request}”. This completes the simulated workflow and records Dave’s decision locally. Nothing will be sent, shared, or changed externally.`,()=>{if(state.workflows.find(item=>item.id===id)?.result!==reviewedResult){announce('Draft changed. Review the current result before approving.');ctx.transferStatus='Draft changed. Review the current result before approving.';render();return;}if(run('decide',id,'complete').ok){revealSelected();save();render();announce('Result approved locally. No external action performed.');}},{result:reviewedResult,label:recipes[w.type].approval});}
 if(action==='cancel'&&w){if(flushEdits())save();confirm('Cancel this workflow?',`Stop “${w.request}”. The request, executed tasks, prepared result, and history remain available locally.`,()=>{if(run('decide',id,'cancel').ok){revealSelected();save();render();announce('Workflow cancelled.');}});}
 if(action==='fail'&&run('fail',id).ok){revealSelected();save();render();announce('Simulated failure. Downstream tasks are blocked; retry is available.');}
 if(action==='retry'&&run('retry',id).ok){revealSelected();save();render();announce('Retry scheduled. Completed work retained.');}
});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY||event.key===null)ensureCurrent();});
setInterval(()=>{
 if(ctx.storageConflict||!ensureCurrent())return;
 const before=state.workflows.find(w=>w.id===ctx.selected)?.status;
 if(run('tick').ok){save();render();const after=state.workflows.find(w=>w.id===ctx.selected)?.status;if(before!==after)announce(`Selected workflow: ${after}.`);}
},1800);
render();
