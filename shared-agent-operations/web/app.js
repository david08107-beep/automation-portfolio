import {DraftRecovery} from './drafts.js';

const $ = id => document.getElementById(id);
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
  $('total').textContent = workflows.length;
  $('pending').textContent = review.length;
  $('completed').textContent = workflows.filter(w => w.status === 'completed').length;
  $('review-count').textContent = review.length;
  const names = {overview:'Today', work:'My requests', review:'Needs my review', activity:'Activity'};
  $('view-title').textContent = names[view];
  $('page-heading').textContent = view === 'overview' ? 'What needs your attention, Dave?' : names[view];
  $('page-subtitle').textContent = {overview:'Keep your priorities close. Tell Orbit what you need, and review the next step here.', work:'Your requests, results, and next steps in one place.', review:'Decide what is ready. Changes always need a fresh approval.', activity:'See what happened and return to the request behind it.'}[view];
  $('home-panel').hidden = view !== 'overview';
  $('compose').hidden = view !== 'overview';
  $('activity-panel').hidden = view !== 'activity';
  document.querySelector('.work-grid').hidden = view === 'activity';
  $('list-title').textContent = view === 'review' ? 'Ready for your decision' : view === 'overview' ? 'Recent requests' : 'My requests';
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('next-heading').textContent = review.length ? review.length+' draft'+(review.length===1?'':'s')+' need your review.' : 'You have room to get started.';
  $('next-summary').textContent = review.length ? 'Your next useful step is to review a draft. Orbit keeps the preparation and history together for you.' : 'Start with a marketing request. I’ll bring a sample draft back here for you to review.';
  $('next-action').textContent = review.length ? 'Review next draft' : 'Plan a campaign';
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
  return {...last(w).payload,launchPost:$('launch').value,shortVideoScript:$('video').value,calendar:$('calendar').value.split('\n')};
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
  document.querySelectorAll('button,textarea').forEach(element => element.disabled = value);
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
    if (!res.ok || !result.ok) throw Error(result.error?.message??'Could not complete the action.');
    if (action==='revise' || action==='cancel') recovery.discard(result.value.id);
    if (action==='start') {view='work'; recovery.note('request',''); $('request').value='';}
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
}
$('request').value=recovery.state.request;
$('priorities').value=recovery.state.priorities;
$('request').addEventListener('input',() => {
  if (!recovery.note('request',$('request').value)) message('Browser storage is unavailable. Keep this tab open to retain your notes.',true);
});
$('priorities').addEventListener('input',() => {
  $('priority-status').textContent=recovery.note('priorities',$('priorities').value)?'Saved on this browser':'Kept in this tab only';
});
$('detail').addEventListener('input',captureDraft);
$('brief-form').addEventListener('submit',e => {e.preventDefault(); command('start',{request:$('request').value});});
document.querySelector('.suggestions').addEventListener('click',e => {
  const button=e.target.closest('[data-prompt]');
  if (!button) return;
  if ($('request').value.trim()) {message('Your current request is kept. Clear it first to use a starter.',true); return;}
  $('request').value=button.dataset.prompt; recovery.note('request',$('request').value); $('request').focus();
});
$('next-action').addEventListener('click',() => {
  const next=workflows.find(w => w.status==='awaiting-review');
  if (next) changeView('review',next.id);
  else {$('request').focus(); $('request').scrollIntoView({block:'center'});}
});
$('refresh').addEventListener('click',() => {captureDraft(); refresh().catch(e => message(e.message,true));});
document.querySelector('nav').addEventListener('click',e => {
  const button=e.target.closest('[data-view]'); if (button) changeView(button.dataset.view);
});
$('workflow-list').addEventListener('click',e => {
  const button=e.target.closest('[data-id]'); if (button) changeView(view==='overview'?'work':view,button.dataset.id);
});
document.addEventListener('click',e => {
  const button=e.target.closest('[data-open]'); if (button) changeView('work',button.dataset.open);
});
$('detail').addEventListener('click',e => {
  const button=e.target.closest('[data-action]'); if (!button || busy) return;
  const w=workflows.find(w => w.id===selected),v=last(w),action=button.dataset.action;
  if (action==='discardDraft') {recovery.discard(w.id); render(); return;}
  if (action==='restoreDraft') {recovery.remember(w.id,v.id,{...v.payload,...recovery.get(w.id).payload}); render(); return;}
  if (recovery.get(w.id)?.baseVersionId && recovery.get(w.id).baseVersionId!==v.id && ['revise','approve','execute'].includes(action)) {message('Restore or discard your local edits before continuing with the newer version.',true); return;}
  if (['approve','execute'].includes(action) && !same(editedPayload(w),v.payload)) {message('Save your changes for review before approving or previewing the send.',true); return;}
  if (action==='revise' && same(editedPayload(w),v.payload)) {message('No changes to save. You can approve this version.'); return;}
  command(action,{workflowId:w.id,...(action==='revise'?{payload:editedPayload(w)}:{}),...(action==='approve'?{versionId:v.id,payloadDigest:v.payloadDigest}:{}),...(action==='execute'?{approvalId:approval(w).id}:{})});
});
window.addEventListener('storage',e => {
  if (e.key==='orbit.assistant.recovery.v1') message('Another tab changed its recovery copies. Your current tab is kept; save important edits before switching.',true);
});
window.addEventListener('beforeunload',e => {
  captureDraft();
  if (!recovery.persistent && (Object.keys(recovery.state.drafts).length || $('request').value || $('priorities').value)) {e.preventDefault(); e.returnValue='';}
});
refresh().catch(e => message(e.message,true));
