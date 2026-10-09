import {DraftRecovery} from './drafts.js';
import {emptyCampaign, campaignRequest} from './campaign.js';
import {reviewedExport} from './export.js';

const root = document.getElementById('shared-workspace')?.shadowRoot || document;
const $ = id => root.querySelector('#'+id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storage;
try {storage = window.localStorage;} catch {storage = {getItem() {throw Error('Unavailable');}, setItem() {throw Error('Unavailable');}};}
const recovery = new DraftRecovery(storage);
let workflows = [], selected = recovery.state.selected, view = recovery.state.view, busy = false;
const labels = {'awaiting-review':'Needs your review', completed:'Preview completed', cancelled:'Cancelled', failed:'Needs attention', running:'In progress'};
const last = w => w.results.at(-1);
const approval = w => w.approvals.find(a => a.status === 'approved' && a.versionId === last(w)?.id);
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const title = w => w.command.request.length > 90 ? w.command.request.slice(0,87) + '…' : w.command.request;
const time = value => escape(new Date(value).toLocaleString());

function message(text, error = false) {
  $('message').textContent = text;
  $('message').className = error ? 'error' : 'success';
}
function events(items) {
  return items.map(({event,workflow}) => '<div class="activity"><button class="text-button activity-link" data-open="'+escape(workflow.id)+'">'+escape(title(workflow))+'</button><p>'+escape(event.summary)+'</p><time>'+time(event.at)+'</time></div>').join('') || '<p class="brief">Your activity will appear here as you work.</p>';
}
function nextStep(w) {
  if (w.status === 'completed') return 'Your preview is complete. Your saved draft is here whenever you need it.';
  if (w.status === 'cancelled') return 'This request has been cancelled. Nothing was sent.';
  if (w.status === 'failed') return 'This request needs attention. Retry the failed step when you are ready.';
  if (approval(w)) return 'You approved this version. Next, preview the send; nothing will be published.';
  return 'I’ve prepared a sample campaign draft. Read it below, make any changes, and approve the version you want to preview.';
}
function draftStatus(w) {
  const draft = recovery.get(w.id), v = last(w);
  if (!draft) return 'Saved version';
  if (draft.baseVersionId !== v?.id) return 'A newer version exists. Your local edits are kept separately.';
  return recovery.persistent ? 'Edits saved on this browser · not yet submitted' : 'Edits kept in this tab only · browser storage unavailable';
}
function render() {
  const review = workflows.filter(w => w.status === 'awaiting-review');
  const failed = workflows.filter(w => w.status === 'failed');
  $('total').textContent = workflows.length;
  $('pending').textContent = review.length;
  $('completed').textContent = workflows.filter(w => w.status === 'completed').length;
  $('review-count').textContent = review.length;
  const names = {overview:'Today', work:'Workflows', studio:'Content Studio', review:'Needs my review', activity:'Activity'};
  $('view-title').textContent = names[view];
  $('page-heading').textContent = view === 'overview' ? 'What needs your attention, Dave?' : names[view];
  $('page-subtitle').textContent = {overview:'Your assistant, workflow engine, and content studio—working from the same request.', work:'Follow every request from preparation to review and simulated completion.', studio:'Prepare campaign briefs, edit saved content, and bring the exact version back for review.', review:'Decide what is ready. Changes always need a fresh approval.', activity:'See what happened and return to the request behind it.'}[view];
  $('home-panel').hidden = view !== 'overview';
  $('compose').hidden = !['overview','studio'].includes(view);
  $('workspace-intro').hidden = view !== 'overview';
  $('workspace-areas').hidden = view !== 'overview';
  $('workflow-board').hidden = view !== 'work';
  $('studio-intro').hidden = view !== 'studio';
  const stages = [
    ['Preparation', w => w.status === 'running' || (w.status === 'failed' && w.failure?.stage === 'preparation')],
    ['Review & decision', w => w.status === 'awaiting-review' || (w.status === 'failed' && w.failure?.stage === 'execution')],
    ['Finished', w => ['completed','cancelled'].includes(w.status)],
  ];
  $('workflow-stages').innerHTML = stages.map(([name, matches]) => {
    const items = workflows.filter(matches);
    return '<section class="workflow-lane"><h3>'+name+' <span>'+items.length+'</span></h3>'+items.map(w => '<button class="lane-request" data-open="'+escape(w.id)+'"><strong>'+escape(title(w))+'</strong><span>'+escape(labels[w.status]??w.status)+'</span><small>'+w.tasks.filter(t=>t.status==='completed').length+' / '+w.tasks.length+' steps complete</small></button>').join('')+(items.length?'':'<p class="brief">No requests here yet.</p>')+'</section>';
  }).join('');
  $('activity-panel').hidden = view !== 'activity';
  root.querySelector('.work-grid').hidden = view === 'activity';
  $('list-title').textContent = view === 'review' ? 'Ready for your decision' : view === 'overview' ? 'Recent requests' : view === 'studio' ? 'Campaign library' : 'All workflows';
  root.querySelectorAll('[data-view]').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
    if(b.dataset.view===view) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
  });
  $('next-heading').textContent = failed.length ? failed.length+' request'+(failed.length===1?' needs':'s need')+' attention.' : review.length ? review.length+' draft'+(review.length===1?' needs':'s need')+' your review.' : 'You have room to get started.';
  $('next-summary').textContent = failed.length ? 'A step failed. Open the request to see what happened and retry safely.' : review.length ? 'Your next useful step is to review a draft. Orbit keeps the preparation and history together for you.' : 'Start with a marketing request. I’ll bring a sample draft back here for you to review.';
  $('next-action').textContent = failed.length ? 'Open request needing attention' : review.length ? 'Review next draft' : 'Plan a campaign';
  const visible = view === 'review' ? review : workflows;
  if (!visible.some(w => w.id === selected)) selected = visible[0]?.id ?? null;
  $('workflow-list').innerHTML = visible.map(w => '<button class="workflow '+(w.id===selected?'selected':'')+'" data-id="'+escape(w.id)+'"><strong>'+escape(title(w))+'</strong><small>'+time(w.createdAt)+' · '+w.results.length+' saved version'+(w.results.length===1?'':'s')+(recovery.get(w.id)?' · Local edits':'')+'</small><span class="badge '+escape(w.status)+'">'+escape(labels[w.status]??w.status)+'</span></button>').join('') || '<p class="brief">Nothing waiting here. Ask Orbit for help from Today.</p>';
  $('all-activity').innerHTML = events(workflows.flatMap(w => w.activity.map(event => ({event,workflow:w}))).sort((a,b) => b.event.at.localeCompare(a.event.at)));
  renderDetail(workflows.find(w => w.id === selected));
  recovery.setView(view, selected);
}
function renderDetail(w) {
  if (!w) {
    $('detail').innerHTML = '<div class="empty"><span class="empty-symbol">◈</span><h2>Start with what you need.</h2><p>Orbit keeps the request, draft, and review together. This preview supports marketing campaigns.</p></div>';
    return;
  }
  if (view === 'overview') {
    $('detail').innerHTML = '<p class="eyebrow">ORBIT</p><h2 class="detail-title">Pick up where you left off</h2><p class="brief">'+escape(w.command.request)+'</p><div class="assistant-reply"><p>'+escape(nextStep(w))+'</p></div><button class="primary" data-open="'+escape(w.id)+'">Open request</button>';
    return;
  }
  const v = last(w), a = approval(w), editable = w.status === 'awaiting-review';
  const draft = recovery.get(w.id), stale = draft && draft.baseVersionId !== v?.id;
  const payload = editable && draft && !stale ? draft.payload : v?.payload;
  let html = '<span class="badge '+escape(w.status)+'">'+escape(labels[w.status]??w.status)+'</span>';
  html += '<div class="conversation-request"><p class="eyebrow">YOU ASKED</p><p class="brief">'+escape(w.command.request)+'</p></div>';
  if(w.command.campaignBrief) html += '<details class="plan"><summary>Saved campaign brief</summary><dl class="brief-summary">'+Object.entries(w.command.campaignBrief).map(([key,value])=>'<dt>'+escape({business:'Business or service',audience:'Audience',platform:'Platform',tone:'Tone',goal:'Desired result'}[key]??key)+'</dt><dd>'+escape(value)+'</dd>').join('')+'</dl></details>';
  html += '<div class="assistant-reply"><p class="eyebrow">ORBIT</p><p>'+escape(nextStep(w))+'</p></div>';
  html += '<details class="plan"><summary>How this request is progressing</summary><div class="steps">'+w.tasks.map(t => '<div class="step '+escape(t.status)+'"><span>'+(t.status==='completed'?'✓':t.status==='running'?'◉':'○')+'</span><span>'+escape(t.title)+'</span></div>').join('')+'</div></details>';
  if (v) {
    html += '<div class="draft-heading"><h2>Your campaign draft</h2><span class="subtle">Version '+v.number+(a?' · Approved':'')+'</span></div><p class="sample-note">Sample output, not AI-generated from your request. Edit it to try the review flow.</p>';
    html += '<p id="draft-status" class="subtle recovery-status" role="status">'+escape(draftStatus(w))+'</p>';
    if (stale) html += '<div class="recovery-notice">The saved version changed since you started editing. '+(editable?'<button class="text-button" data-action="restoreDraft">Restore my local edits onto this version</button>':'Your local edits remain available until you discard them.')+'</div>';
    html += '<label for="launch">Launch post</label><textarea id="launch" '+(editable?'':'readonly')+'>'+escape(payload.launchPost??'')+'</textarea>';
    html += '<label for="video">Short video script</label><textarea id="video" '+(editable?'':'readonly')+'>'+escape(payload.shortVideoScript??'')+'</textarea>';
    html += '<label for="calendar">Content calendar · one item per line</label><textarea id="calendar" '+(editable?'':'readonly')+'>'+escape((payload.calendar??[]).join('\n'))+'</textarea>';
  }
  if (w.status==='completed') html += '<div class="receipt">✓ Preview completed. One simulated send was recorded. Nothing was sent or published.</div>';
  if (w.failure) html += '<p class="error">'+escape(w.failure.code)+' · Retry the failed step below.</p>';
  try {reviewedExport(w); html += '<div class="actions"><button class="secondary" data-action="copyReviewed">Copy reviewed draft</button><button class="secondary" data-action="downloadReviewed">Download reviewed draft (.txt)</button></div><p class="sample-note">Uses only the current reviewed saved version, not unsaved edits. This does not publish.</p>';} catch {}
  html += '<div class="actions">';
  if (editable) html += '<button class="secondary" data-action="revise">Save changes for review</button>';
  if (editable&&!a) html += '<button class="primary" data-action="approve">Approve this version</button>';
  if (a&&['awaiting-review','failed'].includes(w.status)) html += '<button class="primary" data-action="execute">Preview approved send</button>';
  if (w.failure?.stage==='preparation') html += '<button class="primary" data-action="retryPreparation">Retry preparation</button>';
  if (draft || editable) html += '<button class="text-button" data-action="discardDraft" '+(draft?'':'hidden')+'>Discard local edits</button>';
  if (!['completed','cancelled'].includes(w.status)) html += '<button class="danger" data-action="cancel">Cancel request</button>';
  html += '</div><h2 class="activity-heading">Request history</h2>'+events(w.activity.map(event => ({event,workflow:w})));
  $('detail').innerHTML = html;
  if (busy) setBusy(true);
}
function editedPayload(w) {
  return {...last(w).payload,launchPost:$('launch').value,shortVideoScript:$('video').value,calendar:$('calendar').value.split('\n').map(item=>item.trim()).filter(Boolean)};
}
function captureDraft() {
  const w = workflows.find(w => w.id===selected);
  if (!w || w.status!=='awaiting-review' || !$('launch')) return;
  const draft = recovery.get(w.id);
  if (draft && draft.baseVersionId!==last(w).id) return;
  const payload = editedPayload(w);
  if (same(payload,last(w).payload)) recovery.discard(w.id);
  else recovery.remember(w.id,last(w).id,payload);
  $('draft-status').textContent = draftStatus(w);
  $('detail').querySelector('[data-action="discardDraft"]').hidden = !recovery.get(w.id);
}
function setBusy(value) {
  root.querySelectorAll('button,textarea,input,select').forEach(element => element.disabled = value);
}
async function refresh() {
  const res = await fetch('/api/workflows');
  if (!res.ok) throw Error('Could not load requests. Your local edits are still kept.');
  workflows = (await res.json()).workflows.reverse();
  render();
}
async function command(action,extras={}) {
  if (busy) return;
  captureDraft();
  busy = true;
  setBusy(true);
  message('Orbit is working on your request…');
  try {
    const res = await fetch('/api/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...extras})});
    const result = await res.json();
    if (!res.ok || !result.ok) {
      if (result.error?.code === 'DRAFT_STALE') await refresh();
      throw Error(result.error?.message??'Could not complete the action.');
    }
    if (action==='revise' || action==='cancel') recovery.discard(result.value.id);
    if (action==='start') {view='studio'; recovery.note('request',''); $('request').value=''; recovery.campaignNote(emptyCampaign(),$('brief-mode').value); fillCampaign();}
    selected = result.value.id;
    await refresh();
    message({start:'Your sample draft is ready. Review it below.',revise:'Changes saved as a new version. Review this version before approving.',approve:'This version is approved. You can preview the send.',execute:'Preview completed. Nothing was sent externally.',cancel:'Request cancelled.',retryPreparation:'Your sample draft is ready for review.'}[action]);
  } catch (error) {message(error.message,true);}
  finally {busy=false; setBusy(false);}
}
function changeView(nextView,nextId=selected) {
  if (busy) return;
  captureDraft();
  view=nextView; selected=nextId; render();
  message('');
  $('view-title').scrollIntoView({block:'start'});
  $('page-heading').focus({preventScroll:true});
}
async function exportReviewed(w,action) {
  captureDraft();
  if(recovery.get(w.id)) {message('Save and approve your local edits, or discard them, before exporting.',true); return;}
  busy=true; setBusy(true);
  try {
    const res=await fetch('/api/workflows');
    if(!res.ok) throw Error('Could not verify the saved version. Nothing was exported.');
    const current=(await res.json()).workflows.find(item=>item.id===w.id);
    if(!current||current.revision!==w.revision) {await refresh(); throw Error('The request changed. Review the loaded saved version before exporting.');}
    const {content,filename}=reviewedExport(current);
    if(action==='copyReviewed') {
      if(!navigator.clipboard?.writeText) throw Error('Clipboard access is unavailable. Use Download reviewed draft instead.');
      await navigator.clipboard.writeText(content);
      message('Reviewed draft copied. Nothing was published.');
    } else {
      const url=URL.createObjectURL(new Blob([content],{type:'text/plain;charset=utf-8'}));
      const link=document.createElement('a'); link.href=url; link.download=filename; document.body.append(link); link.click(); link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
      message('Reviewed draft download requested. Nothing was published.');
    }
  } catch(error) {message(action==='copyReviewed'&&error.name==='NotAllowedError'?'Clipboard access was denied. Use Download reviewed draft instead.':error.message,true);}
  finally {busy=false; setBusy(false);}
}
$('request').value=recovery.state.request;
$('priorities').value=recovery.state.priorities;
function readCampaign() {return Object.fromEntries(['business','audience','platform','tone','goal'].map(field=>[field,$('campaign-'+field).value]));}
function fillCampaign() {for(const [field,value] of Object.entries(recovery.state.campaign)) $('campaign-'+field).value=value;}
function updateBriefMode() {
  const guided=$('brief-mode').value==='guided';
  $('campaign-fields').hidden=!guided;
  for(const field of ['business','audience','goal']) $('campaign-'+field).required=guided;
  $('request').required=!guided;
  $('request').maxLength=guided?12000:20000;
  $('request-label').textContent=guided?'Additional details (optional)':'Tell Orbit what you need';
}
fillCampaign(); $('brief-mode').value=recovery.state.briefMode; updateBriefMode();
$('campaign-fields').addEventListener('input',()=>{if(!recovery.campaignNote(readCampaign(),$('brief-mode').value)) message('Campaign brief kept in this tab only; browser storage is unavailable.',true);});
$('brief-mode').addEventListener('change',()=>{updateBriefMode(); recovery.campaignNote(readCampaign(),$('brief-mode').value);});
$('request').addEventListener('input',() => {
  if (!recovery.note('request',$('request').value)) message('Browser storage is unavailable. Keep this tab open to retain your notes.',true);
});
$('priorities').addEventListener('input',() => {
  $('priority-status').textContent=recovery.note('priorities',$('priorities').value)?'Saved on this browser':'Kept in this tab only';
});
$('detail').addEventListener('input',captureDraft);
$('brief-form').addEventListener('submit',e => {
  e.preventDefault();
  try {
    const guided=$('brief-mode').value==='guided', campaignBrief=readCampaign();
    command('start',{request:guided?campaignRequest(campaignBrief,$('request').value):$('request').value,...(guided?{campaignBrief}: {})});
  } catch(error) {message(error.message,true);}
});
root.querySelector('.suggestions').addEventListener('click',e => {
  const button=e.target.closest('[data-prompt]');
  if (!button) return;
  if ($('request').value.trim()) {message('Your current request is kept. Clear it first to use a starter.',true); return;}
  $('brief-mode').value='free'; updateBriefMode(); recovery.campaignNote(readCampaign(),'free');
  $('request').value=button.dataset.prompt; recovery.note('request',$('request').value); $('request').focus();
});
$('next-action').addEventListener('click',() => {
  const failed=workflows.find(w => w.status==='failed');
  if (failed) {changeView('work',failed.id); return;}
  const next=workflows.find(w => w.status==='awaiting-review');
  if (next) changeView('review',next.id);
  else {$('request').focus(); $('request').scrollIntoView({block:'center'});}
});
$('refresh').addEventListener('click',() => {captureDraft(); refresh().catch(e => message(e.message,true));});
root.querySelector('nav').addEventListener('click',e => {
  const button=e.target.closest('[data-view]'); if (button) changeView(button.dataset.view);
});
$('workflow-list').addEventListener('click',e => {
  const button=e.target.closest('[data-id]'); if (button) changeView(view==='overview'?'work':view,button.dataset.id);
});
root.addEventListener('click',e => {
  const area=e.target.closest('[data-area]'); if(area) {changeView(area.dataset.area); return;}
  const button=e.target.closest('[data-open]'); if (button) changeView('work',button.dataset.open);
});
$('detail').addEventListener('click',e => {
  const button=e.target.closest('[data-action]'); if (!button || busy) return;
  const w=workflows.find(w => w.id===selected),v=last(w),action=button.dataset.action;
  if(['copyReviewed','downloadReviewed'].includes(action)) {exportReviewed(w,action); return;}
  if (action==='discardDraft') {recovery.discard(w.id); render(); return;}
  if (action==='restoreDraft') {recovery.remember(w.id,v.id,{...v.payload,...recovery.get(w.id).payload}); render(); message('Local edits restored. Compare them with the saved version before saving.'); return;}
  if (recovery.get(w.id)?.baseVersionId && recovery.get(w.id).baseVersionId!==v.id && ['revise','approve','execute'].includes(action)) {message('Restore or discard your local edits before continuing with the newer version.',true); return;}
  if (['approve','execute'].includes(action) && !same(editedPayload(w),v.payload)) {message('Save your changes for review before approving or previewing the send.',true); return;}
  if (action==='revise' && same(editedPayload(w),v.payload)) {message('No changes to save. You can approve this version.'); return;}
  command(action,{workflowId:w.id,...(action==='revise'?{payload:editedPayload(w),baseVersionId:v.id}:{}),...(action==='approve'?{versionId:v.id,payloadDigest:v.payloadDigest}:{}),...(action==='execute'?{approvalId:approval(w).id}:{})});
});
window.addEventListener('orbit:campaign-view',e => {
  if (['work','studio'].includes(e.detail)) changeView(e.detail);
});
window.addEventListener('storage',e => {
  if (e.key==='orbit.assistant.recovery.v1') message('Another tab changed its recovery copies. Your current tab is kept; save important edits before switching.',true);
});
window.addEventListener('beforeunload',e => {
  captureDraft();
  if (!recovery.persistent && (Object.keys(recovery.state.drafts).length || $('request').value || $('priorities').value || ['business','audience','goal'].some(field=>$('campaign-'+field).value))) {e.preventDefault(); e.returnValue='';}
});
refresh().catch(e => message(e.message,true));
