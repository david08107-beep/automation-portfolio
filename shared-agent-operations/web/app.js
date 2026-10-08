const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let workflows = [], selected = null, view = 'overview', busy = false;
const labels = {'awaiting-review':'Awaiting review', completed:'Completed', cancelled:'Cancelled', failed:'Needs attention', running:'In progress'};
const last = w => w.results.at(-1);
const approval = w => w.approvals.find(a => a.status === 'approved' && a.versionId === last(w)?.id);
function events(items) {return items.map(e => `<div class="activity">${escape(e.summary)}<time>${escape(new Date(e.at).toLocaleString())}</time></div>`).join('') || '<p class="brief">Your activity will appear here.</p>';}
function render() {
  const review = workflows.filter(w => w.status === 'awaiting-review');
  $('total').textContent = workflows.length; $('pending').textContent = review.length; $('completed').textContent = workflows.filter(w => w.status === 'completed').length; $('review-count').textContent = review.length;
  $('view-title').textContent = {overview:'Overview',review:'Review queue',activity:'Activity'}[view];
  $('compose').hidden = view !== 'overview'; $('activity-panel').hidden = view !== 'activity'; document.querySelector('.work-grid').hidden = view === 'activity';
  $('list-title').textContent = view === 'review' ? 'Ready for your review' : 'Your workflows';
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const visible = view === 'review' ? review : workflows;
  if (!visible.some(w => w.id === selected)) selected = visible[0]?.id ?? null;
  $('workflow-list').innerHTML = visible.map(w => `<button class="workflow ${w.id === selected?'selected':''}" data-id="${escape(w.id)}"><strong>${escape(w.command.request)}</strong><small>${escape(new Date(w.createdAt).toLocaleString())} · ${w.results.length} draft version${w.results.length===1?'':'s'}</small><span class="badge ${escape(w.status)}">${escape(labels[w.status] ?? w.status)}</span></button>`).join('') || '<p class="brief">No workflows here yet.</p>';
  $('all-activity').innerHTML = events(workflows.flatMap(w => w.activity).sort((a,b) => b.at.localeCompare(a.at)));
  const w = workflows.find(w => w.id === selected);
  if (!w) {$('detail').innerHTML = '<div class="empty"><span class="empty-symbol">◈</span><h2>Your team is ready.</h2><p>Prepare a campaign from Overview to start a shared workflow.</p></div>'; return;}
  const v = last(w), a = approval(w), editable = w.status === 'awaiting-review';
  $('detail').innerHTML = `<span class="badge ${escape(w.status)}">${escape(labels[w.status] ?? w.status)}</span><h2 class="detail-title">Campaign workspace</h2><p class="brief">${escape(w.command.request)}</p><div class="steps">${w.tasks.map(t => `<div class="step ${escape(t.status)}"><span>${t.status==='completed'?'✓':t.status==='running'?'◉':'○'}</span><span>${escape(t.title)}</span></div>`).join('')}</div>${v?`<div class="draft-heading"><h2>Review your campaign</h2><span class="subtle">Version ${v.number}${a?' · Approved':''}</span></div><label for="launch">Launch post</label><textarea id="launch" ${editable?'':'readonly'}>${escape(v.payload.launchPost ?? '')}</textarea><label for="video">Short video script</label><textarea id="video" ${editable?'':'readonly'}>${escape(v.payload.shortVideoScript ?? '')}</textarea><label for="calendar">Content calendar · one item per line</label><textarea id="calendar" ${editable?'':'readonly'}>${escape((v.payload.calendar ?? []).join('\n'))}</textarea>`:''}${w.status==='completed'?'<div class="receipt">✓ Simulation completed. One simulated send was recorded. Nothing was sent or published.</div>':''}${w.failure?`<p class="error">${escape(w.failure.code)} · You can retry this step.</p>`:''}<div class="actions">${editable?'<button class="secondary" data-action="revise">Save edits as new version</button>':''}${editable&&!a?'<button class="primary" data-action="approve">Approve this version</button>':''}${a&&['awaiting-review','failed'].includes(w.status)?'<button class="primary" data-action="execute">Simulate approved send</button>':''}${w.failure?.stage==='preparation'?'<button class="primary" data-action="retryPreparation">Retry preparation</button>':''}${!['completed','cancelled'].includes(w.status)?'<button class="danger" data-action="cancel">Cancel workflow</button>':''}</div><h2 class="activity-heading">Workflow activity</h2>${events(w.activity)}`;
}
async function refresh() {const res = await fetch('/api/workflows'); if (!res.ok) throw new Error('Could not load workflows.'); workflows = (await res.json()).workflows.reverse(); render();}
function message(text, error = false) {$('message').textContent = text; $('message').className = error?'error':'success';}
function editedPayload(w) {return {...last(w).payload, launchPost:$('launch').value, shortVideoScript:$('video').value, calendar:$('calendar').value.split('\n').filter(s => s.trim())};}
async function command(action, extras = {}) {
  if (busy) return;
  busy = true; document.querySelectorAll('button').forEach(b => b.disabled = true); message('Working…');
  try {
    const res = await fetch('/api/commands', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action, ...extras})});
    const result = await res.json();
    if (!res.ok || !result.ok) throw new Error(result.error?.message ?? 'Could not complete the action.');
    selected = result.value.id; await refresh();
    message({start:'Your campaign draft is ready to review.',revise:'New version saved. Review and approve this version.',approve:'Version approved. You can now simulate the send.',execute:'Simulation completed. Nothing was sent externally.',cancel:'Workflow cancelled.',retryPreparation:'Your draft is ready to review.'}[action]);
  } catch (error) {message(error.message, true);} finally {busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false);}
}
$('brief-form').addEventListener('submit', e => {e.preventDefault(); command('start', {request:$('request').value});});
$('refresh').addEventListener('click', () => refresh().catch(e => message(e.message,true)));
document.querySelector('nav').addEventListener('click', e => {const b = e.target.closest('[data-view]'); if (b) {view = b.dataset.view; render();}});
$('workflow-list').addEventListener('click', e => {const b = e.target.closest('[data-id]'); if (b) {selected = b.dataset.id; render();}});
$('detail').addEventListener('click', e => {
  const button = e.target.closest('[data-action]'); if (!button) return;
  const w = workflows.find(w => w.id === selected), v = last(w), action = button.dataset.action;
  if (['approve','execute'].includes(action) && JSON.stringify(editedPayload(w)) !== JSON.stringify(v.payload)) {message('Save your edits as a new version before approving or simulating a send.',true); return;}
  command(action, {workflowId:w.id, ...(action==='revise'?{payload:editedPayload(w)}:{}), ...(action==='approve'?{versionId:v.id,payloadDigest:v.payloadDigest}:{}), ...(action==='execute'?{approvalId:approval(w).id}:{})});
});
refresh().catch(e => message(e.message, true));
