let guidedSession = null;
const approvalDetails = {
  reply: 'Hi Sarah,\n\nThanks for sharing the revised proposal. The updated terms look good to me. Let’s plan a kickoff for next Tuesday at 10:00 AM Eastern, subject to your availability.\n\nBest,\nDave',
  meeting: 'Proposed change\nFriday, October 9 · 10:30–11:00 AM Eastern\n\nAttendees: Dave and Morgan Ellis\n\nThis slot avoids the finance review and leaves 30 minutes before your next meeting. A calendar update would be prepared for both attendees.',
  report: 'Weekly executive digest\n\nMilestones: The product team completed the onboarding prototype. The Northstar partnership proposal is ready for sign-off.\n\nRisks: Budget allocation needs review before Friday.\n\nNext week: Kick off the design sprint and finalize the offsite venue.\n\nSuggested recipients: Leadership team.'
};

const actionProfiles = {
  reply: {kind:'email',label:'Send Email',status:'Sent',viewLabel:'View sent email',success:'Email sent — demo simulation',title:'Send the partnership reply',defaultPayload:{to:'sarah.mitchell@northstar.example',subject:'Re: Q4 partnership — kickoff and next steps',body:approvalDetails.reply}},
  meeting: {kind:'calendar',label:'Approve & Reschedule',status:'Rescheduled',viewLabel:'View meeting change',success:'Meeting rescheduled — demo simulation',title:'Reschedule the investor check-in',defaultPayload:{start:'2026-10-09T10:30',end:'2026-10-09T11:00',notify:true}},
  report: {kind:'document',label:'Share Document',status:'Shared',viewLabel:'View shared document',success:'Document shared — demo simulation',title:'Share the weekly executive digest',defaultPayload:{message:"Here's this week's executive digest: milestones, risks, and team priorities."}}
};

// Each workspace has one state model for briefing, actions, counters, and history.
const STORAGE_KEY = 'orbit.executive-assistant.demo.v2';
const LEGACY_KEY = 'orbit.executive-assistant.approvals.v1';
const MAX_ACTIVITY = 100;
const MAX_REPLY_LENGTH = 10000;
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const approvalCards = $$('.approval-card');
const taskCards = $$('[data-task]');
const specialistCards = $$('[data-agent]');
const activityFeed = $('#activity-feed');
const dialog = $('#review-dialog');
const taskListDialog = $('#task-list-dialog');
const meetingDialog = $('#meeting-dialog');
let selectedMeetingKey=null,meetingOrigin=null,meetingReviewReturn=null,meetingReviewHandoff=false;
let taskListFilter='all',selectedTaskId=null,taskListOrigin=null;
const commandHub = $('.operations-hub');
const hubStatus = commandHub.querySelector('p');
const idleHubMarkup = hubStatus.innerHTML;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const demo = {
  unread: Number($('#unread-count').textContent),
  priority: $$('.email-tags .urgent').length,
  meetings: $$('.timeline .meeting').length,
  nextMeeting: $('.stat-card[href="#calendar"] p strong').textContent,
  focus: $('.focus-block small').textContent.split(' · ')[0].toLowerCase(),
  sender: $('.email-meta strong').textContent,
  priorCompleted: 3,
  tasks: taskCards.map(card => ({id:card.dataset.task, title:card.querySelector('input + span').firstChild.textContent.trim(), due:card.dataset.due})),
  research: $$('.research-notes article').slice(0,2).map(card => ({title:card.querySelector('h3').textContent, text:card.querySelector('p').textContent}))
};
const freshState = () => ({version:2, decisions:{}, approvals:[], executions:{}, drafts:{}, legacyReviewed:[], tasks:[], activity:[], proactiveScanned:false, monitoringSeen:[], monitoringReplay:0, monitoringPaused:false, meetingBriefPrepared:false, motionPaused:null, messages:{}});
let state = freshState();
let storageAvailable = true;
let storageReadable = true;
let selectedCard = null;
let reviewOrigin = null;
let reviewWorkspace = null;
let toastTimer;
let commandTimer;
let commandGeneration = 0;
let processing = false;
let workflowMode = null;
let monitorTimer;
const SIGNAL_IDS = ['email','conflict','deadline','brief','draft','approval'];
let responseRoute = null;
let responseCommandNotice='',responseEditorDraft=null,responseUndo=null,responseDisclosureOpen=new Set();
let stateNotice = '';
let executionEvents = [];
let currentWorkflow = null;
const agentLastChecked = new Map();

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 5500);
}
const MAX_STORED_STATE_LENGTH=4*1024*1024;
function safeHeader(value,max=320){return typeof value==='string' && value.length<=max && value.trim().length>0 && !/[\r\n\x00]/.test(value);}
function safeAddress(value){return safeHeader(value) && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);}
function validDate(value) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function normalizeState(saved) {
  if (!saved || saved.version !== 2) throw new Error('Unsupported state');
  const result = freshState();
  for (const id of Object.keys(actionProfiles)) {
    const execution = saved.executions?.[id];
    if (execution && execution.status === actionProfiles[id].status && validDate(execution.at)) {
      const payload = normalizePayload(id,execution.payload);
      if (payload) result.executions[id] = {status:execution.status,at:execution.at,payload};
    }
    const draft = normalizePayload(id,saved.drafts?.[id]);
    if (draft) result.drafts[id] = draft;
  }
  for(const id of ['meeting','report']) {
    const choice=saved.decisions?.[id];
    if(choice && ['Dismissed','Deferred'].includes(choice.status) && validDate(choice.at) && (choice.status==='Dismissed' || validDate(choice.until))) result.decisions[id]={status:choice.status,at:choice.at,...(choice.status==='Deferred'?{until:choice.until}:{})};
  }
  result.messages = normalizeMessages(saved.messages);
  result.approvals = Object.keys(result.executions);
  result.legacyReviewed = [...new Set([...(Array.isArray(saved.legacyReviewed) ? saved.legacyReviewed : []),...(Array.isArray(saved.approvals) ? saved.approvals : [])].filter(id => Object.keys(actionProfiles).includes(id) && !result.approvals.includes(id)))];
  result.tasks = [...new Set((Array.isArray(saved.tasks) ? saved.tasks : []).filter(id => demo.tasks.some(task => task.id === id)))];
  const seen = new Set();
  result.activity = (Array.isArray(saved.activity) ? saved.activity : []).filter(event => {
    if (!event || typeof event.id !== 'string' || seen.has(event.id) || !validDate(event.at) || typeof event.title !== 'string' || typeof event.detail !== 'string' || !['approval','task','command','proactive','message'].includes(event.kind)) return false;
    seen.add(event.id); return true;
  }).slice(-MAX_ACTIVITY).map(event => ({id:event.id,at:event.at,title:event.title.slice(0,300),detail:event.detail.slice(0,300),kind:event.kind,route:typeof event.route === 'string' ? event.route : ''}));
  result.proactiveScanned = saved.proactiveScanned === true;
  result.monitoringSeen = [...new Set((Array.isArray(saved.monitoringSeen) ? saved.monitoringSeen : []).filter(id=>SIGNAL_IDS.includes(id)))];
  result.monitoringReplay = Number.isInteger(saved.monitoringReplay) && saved.monitoringReplay >= 0 ? saved.monitoringReplay % SIGNAL_IDS.length : 0;
  result.monitoringPaused = saved.monitoringPaused === true;
  result.meetingBriefPrepared = saved.meetingBriefPrepared === true;
  result.motionPaused = typeof saved.motionPaused === 'boolean' ? saved.motionPaused : null;
  if(saved.replyCore!==undefined)result.replyCore=structuredClone(saved.replyCore); // Preserve evidence; service validates and fails closed, never silently replaces history.
  return result;
}
function loadLegacyState() {
  let raw;
  try { raw = localStorage.getItem(STORAGE_KEY); }
  catch { storageReadable=false; storageAvailable = false; stateNotice = 'Browser storage is unavailable. This demo will work for the current session only.'; return; }
  try {
    if (raw) { const saved = JSON.parse(raw); state = normalizeState(saved); if (!saved.executions && state.legacyReviewed.length) { stateNotice = 'Previously reviewed items now require an action-specific confirmation. No demo actions were executed automatically.'; saveState(); } return; }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
    if (Array.isArray(legacy)) legacy.forEach(item => {
      const card = approvalCards.find(card => card.dataset.approval === item?.id);
      if (!card || !validDate(item.approvedAt) || state.legacyReviewed.includes(item.id)) return;
      state.legacyReviewed.push(item.id);
      state.activity.push({id:`legacy-${item.id}`,kind:'approval',at:item.approvedAt,title:`Previously reviewed: ${card.querySelector('h3').textContent}`,detail:'Prior authorization retained; confirm the specific demo operation before execution',route:'approvals'});
    });
    if (state.legacyReviewed.length) { saveState(); stateNotice = 'Prior reviews were retained. Confirm Send Email, Reschedule, or Share before any demo action executes.'; }
  } catch { state = freshState(); stateNotice = 'Saved demo data could not be read. A fresh demo has been loaded.'; }
}
function saveState() {
  if(!storageReadable){workspaceStates[activeWorkspace]=state;storageAvailable=false;return;}
  if (guidedSession) { workspaceStates[activeWorkspace] = state; return; }
  try { workspaceStates[activeWorkspace] = state; localStorage.setItem(WORKSPACE_KEY, JSON.stringify({version:1, selected:activeWorkspace, contexts:workspaceStates})); storageAvailable = true; }
  catch { storageAvailable = false; }
}
function commit(message) {
  if(responseUndo || $('#response-feedback button')){responseUndo=null;$('#response-feedback button')?.remove();}
  saveState();
  render(true);
  notify(message + (guidedSession ? ' Temporary guided demo only; saved progress is untouched.' : storageAvailable ? ' Saved in this browser.' : ' Browser storage is unavailable; refresh will reset this session.'));
}
function logActivity(kind, title, detail, route = '') {
  state.activity.push({id:crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,kind,title,detail,route,at:new Date().toISOString()});
  state.activity = state.activity.slice(-MAX_ACTIVITY);
}
function pendingCards() { return approvalCards.filter(card => !decisionPaused(card.dataset.approval) && !state.approvals.includes(card.dataset.approval) && !(card.dataset.approval==='reply' && messageResolved())); }
function openTasks() { return [...demo.tasks.filter(task => !state.tasks.includes(task.id)), ...Object.entries(state.messages || {}).flatMap(([i,r])=>(r.artifacts || []).filter(a=>['task','followup'].includes(a.kind) && !a.done).map(a=>({id:`message-${i}-${a.kind}`,title:a.title,due:dueFromDate(a.dueDate),dueDate:a.dueDate,owner:a.owner})))]; }
function dueTasks() { return openTasks().filter(task => ['today','overdue'].includes(task.due)); }
function animateStatus(element) {
  if (reducedMotion.matches || document.body.classList.contains('motion-paused')) return;
  element.classList.remove('status-transition'); void element.offsetWidth; element.classList.add('status-transition');
}
function renderActivity(animate) {
  activityFeed.replaceChildren();
  state.activity.forEach((event,index) => {
    const entry = document.createElement('div'); entry.className = `activity-item ${event.kind}-activity`;
    if (animate && index === state.activity.length - 1) entry.classList.add('new-activity');
    const icon = document.createElement('span'); icon.className = 'activity-icon'; icon.textContent = ['command','proactive'].includes(event.kind) ? '✧' : '✓'; icon.setAttribute('aria-hidden','true');
    const body = document.createElement('div');
    const title = document.createElement('p'); title.textContent = event.title;
    const detail = document.createElement('small'); detail.textContent = event.detail;
    body.append(title,detail);
    const time = document.createElement('time'); time.dateTime = event.at;
    time.textContent = new Date(event.at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'});
    time.title = new Date(event.at).toLocaleString('en-US',{timeZone:'America/New_York'}) + ' Eastern';
    entry.append(icon,body,time); activityFeed.prepend(entry);
  });
}
function render(animate = false) {
  approvalCards.forEach(card => {
    const id = card.dataset.approval;
    const profile = actionProfiles[id];
    const execution = state.executions[id];
    card.classList.toggle('approved',Boolean(execution));
    card.querySelector('.status-label').textContent = execution ? `✓ ${profile.status}` : state.drafts[id] ? 'Draft saved' : state.legacyReviewed.includes(id) ? 'Reviewed · Confirm action' : 'Ready for review';
    const button = card.querySelector('.approve-button'); button.disabled = Boolean(execution); button.textContent = execution ? profile.status : ({reply:'Review reply',meeting:'Review schedule change',report:'Review document'}[id]);
    button.hidden=Boolean(execution) || decisionPaused(id) || (id==='reply' && messageResolved());
    card.querySelector('.review-button').hidden=!button.hidden;
    card.querySelector('.review-button').textContent = execution ? profile.viewLabel : 'Review';
    card.querySelector('.action-boundary').textContent = execution ? 'Executed in demo mode · No external action' : 'Review required · Demo simulation';
    if (id === 'meeting') card.querySelector('p').textContent = execution ? `Moved to ${formatMeetingTime(execution.payload)} — demo simulation.` : currentContext.meetingDescription;
  });
  const draftTag=$('.email-row .email-tags .tag:not(.urgent):not(.message-state-tag)');
  if(draftTag)draftTag.textContent = state.executions.reply ? 'Reply sent · Demo' : messageResolved() ? 'Resolved locally' : state.drafts.reply ? 'Saved draft ready' : 'Draft reply ready';
  $('#calendar-action-summary').textContent = decisionPaused('meeting') ? `${currentContext.meetingName} · ${state.decisions.meeting.status.toLowerCase()} proposal · View details` : state.executions.meeting ? `${currentContext.meetingName} rescheduled · ${formatMeetingTime(state.executions.meeting.payload)} · Demo simulation` : `Upcoming change · ${currentContext.meetingName} is prepared for review.`;
  taskCards.forEach(card => {
    const completed = state.tasks.includes(card.dataset.task);
    card.querySelector('input').checked = completed; card.classList.toggle('task-completed',completed);
  });
  const pending = pendingCards().length;
  const open = openTasks().length;
  const due = dueTasks().length;
  ['approval-count','nav-approval-count','panel-approval-count'].forEach(id => { document.getElementById(id).textContent = pending; });
  ['task-count','nav-task-count'].forEach(id => { document.getElementById(id).textContent = open; });
  $('#due-task-count').textContent = dueSummary();
  $('#completed-task-count').textContent = `✓ ${demo.priorCompleted + state.tasks.length + Object.values(state.messages || {}).reduce((n,r)=>n+(r.artifacts || []).filter(a=>['task','followup'].includes(a.kind) && a.done).length,0)} completed`;
  $('#task-panel-summary').textContent = due ? `${due} ${due === 1 ? 'task needs' : 'tasks need'} attention${dueTasks().some(t=>t.due==='overdue')?' · Includes overdue work':' today'}` : 'Your due-today tasks are clear';
  $('#approval-summary').textContent = pending ? 'Your decision' : 'All handled';
  $('#briefing-summary').textContent = `You have ${demo.meetings} ${currentContext.calendarNoun} today. I've surfaced ${demo.priority} important emails. ` + (pending ? `I've prepared ${pending} ${pending === 1 ? 'action' : 'actions'} for you to review.` : 'All prepared demo actions have been executed.');
  renderInbox();
  renderProactive();
  renderOperator();
  renderShareCard();
  renderActivity(animate);
  if (dialog.open && selectedCard) syncDialog();
  renderOperations();
  renderTaskList();
  renderMeetingDetails();
  if (responseRoute && !processing) { $('#command-response-text').textContent = workspaceResponse(responseRoute); renderResponseActions(responseRoute); }
  if (animate) $$('#task-count, #nav-task-count, #approval-count, #nav-approval-count, #panel-approval-count, #operations-approval-status, #task-panel-summary').forEach(animateStatus);
}
function normalizePayload(id,payload) {
  if (!payload || typeof payload !== 'object') return null;
  if(id==='reply' && ((payload.to!==undefined && !safeAddress(payload.to)) || (payload.subject!==undefined && !safeHeader(payload.subject,300))))return null;
  if (id === 'reply') return typeof payload.body === 'string' && payload.body.trim() && payload.body.length <= MAX_REPLY_LENGTH ? {to:safeAddress(payload.to) ? payload.to : actionProfiles.reply.defaultPayload.to,subject:safeHeader(payload.subject,300) ? payload.subject : actionProfiles.reply.defaultPayload.subject,body:payload.body} : null;
  if (id === 'meeting') return validLocalTime(payload.start) && validLocalTime(payload.end) && payload.end > payload.start ? {start:payload.start,end:payload.end,notify:payload.notify === true} : null;
  if (id === 'report') return normalizeSharePayload(payload);
  return null;
}
function validLocalTime(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'Z')) && new Date(value+'Z').toISOString().slice(0,16)===value;
}
function formatLocal(value) {
  // datetime-local is interpreted as the selected Eastern wall time, not host timezone.
  const date = new Date(value+'Z');
  return date.toLocaleString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'UTC'});
}
function formatMeetingTime(payload) {
  if (payload.start.slice(0,10) !== payload.end.slice(0,10)) return `${formatLocal(payload.start)} – ${formatLocal(payload.end)} Eastern`;
  const start = new Date(payload.start+'Z'), end = new Date(payload.end+'Z');
  const day = start.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
  const clock = date => date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'UTC'});
  return `${day} · ${clock(start)}–${clock(end)} Eastern`;
}
function meetingConflicts(payload) {
  return payload.start < currentContext.conflictEnd && payload.end > currentContext.conflictStart;
}
function currentPayload() {
  const id = selectedCard.dataset.approval;
  if (id === 'reply') return {to:$('#email-to').value,subject:$('#email-subject').value,body:$('#email-body').value};
  if (id === 'meeting') return {start:$('#calendar-start').value,end:$('#calendar-end').value,notify:$('#calendar-notify').checked};
  return {...(state.executions.report?.payload || state.drafts.report || shareDefaults()),delivery:$('#share-delivery').value,access:$('#share-access').value,message:$('#document-message').value,contextRecorded:true};
}
function showValidation(message) {
  $('#review-validation').textContent = message; $('#review-validation').hidden = false;
}
function validateAction(payload) {
  const id = selectedCard.dataset.approval;
  $('#review-validation').hidden = true;
  if(id==='reply' && (!safeAddress(payload.to) || !safeHeader(payload.subject,300))){showValidation('Use a valid recipient and single-line subject. Nothing sent.');return false;}
  if (id === 'reply' && !payload.body.trim()) { showValidation('Add a message body before saving or sending.'); $('#email-body').focus(); return false; }
  if (!normalizePayload(id,payload)) { showValidation(id === 'meeting' ? 'Choose valid dates with an end after the start.' : id === 'reply' ? 'Keep the message body within 10,000 characters.' : 'Choose a supported delivery and access level, and keep the accompanying message within 2,000 characters.'); if (id === 'meeting') { $('#calendar-editor').hidden = false; $('#calendar-start').focus(); } return false; }
  if (id === 'meeting' && meetingConflicts(payload)) { showValidation(`That time overlaps ${currentContext.conflictLabel}. Choose another time.`); $('#calendar-editor').hidden = false; $('#calendar-start').focus(); return false; }
  return true;
}
function syncDialog() {
  const id = selectedCard.dataset.approval;
  const profile = actionProfiles[id];
  const execution = state.executions[id];
  $('#dialog-execute').disabled = Boolean(execution); $('#dialog-execute').textContent = execution ? `${profile.status} · Demo` : profile.label;
  $('#dialog-secondary').hidden = Boolean(execution);
  $('#decision-controls').hidden=Boolean(execution) || decisionPaused(id);
  $('#dialog-execute').disabled=Boolean(execution) || decisionPaused(id);
  if(decisionPaused(id)) $('#dialog-execute').textContent=state.decisions[id].status+' · No action executed';
  $('#dialog-cancel').textContent = execution ? 'Close' : 'Cancel';
  for (const kind of ['email','calendar','document']) {
    const section = document.getElementById(kind+'-review'); section.hidden = kind !== profile.kind; section.disabled = Boolean(execution) || kind !== profile.kind;
  }
  $('#review-intro').textContent = execution ? `${profile.status} in demo mode. These are the exact details Dave confirmed.` : "Review or edit Orbit's prepared work. Choose the specific action to confirm execution.";
  if(id==='report'){renderShareSummary();$('#share-review-history').hidden=!execution;$('#review-intro').textContent=execution?'Shared in demo mode. These are the recorded details Dave confirmed.':'Orbit prepared the document and delivery context. Review the summary, then explicitly confirm Share Document.';}
  if(decisionPaused(id)){$('#review-intro').textContent=`${state.decisions[id].status} by Dave. This prepared action was not executed. Restore it from decision history to authorize it.`;$('#dialog-secondary').hidden=true;for(const kind of ['email','calendar','document'])document.getElementById(kind+'-review').disabled=true;}
  $('#review-boundary').textContent = id==='report'?'Demo simulation only. No real cloud link or email was sent. Share Document is your explicit confirmation.':execution ? 'Completed demo simulation. No real email was sent, meeting changed, or document shared.' : 'Demo simulation only. Nothing is sent, rescheduled, or shared with a real account. The final action below is your explicit confirmation.';
}
function openAction(card,origin) {
  if(card.dataset.approval==='reply' && !state.executions.reply){openMessage(0,origin,true);return;}
  if (workflowMode === 'proactive') cancelProactive();
  clearTimeout(monitorTimer);
  selectedCard = card; reviewOrigin = origin; reviewWorkspace=activeWorkspace;
  const id = card.dataset.approval;
  const profile = actionProfiles[id];
  const payload = state.executions[id]?.payload || state.drafts[id] || profile.defaultPayload;
  $('#review-title').textContent = profile.title; $('#review-validation').hidden = true; $('#review-save-state').hidden = true;
  $('#calendar-editor').hidden = true; $('#document-message').readOnly = false;
  $('#dialog-secondary').textContent = id === 'reply' ? 'Save Draft' : id === 'meeting' ? 'Edit Time' : 'Save Draft';
  if (id === 'reply') { $('#email-to').value = payload.to; $('#email-subject').value = payload.subject; $('#email-body').value = payload.body; }
  if (id === 'meeting') { $('#calendar-start').value = payload.start; $('#calendar-end').value = payload.end; $('#calendar-notify').checked = payload.notify; $('#calendar-proposed').textContent = formatMeetingTime(payload); updateNotificationSummary(); }
  if (id === 'report') { populateShareReview(normalizeSharePayload(payload)); }
  $('#decision-defer-editor').hidden=true;$('#decision-defer').setAttribute('aria-expanded','false');
  $$('#document-review details').forEach(e=>e.open=false);
  syncDialog(); dialog.showModal();
}
approvalCards.forEach(card => {
  card.querySelector('.approve-button').addEventListener('click',event => openAction(card,event.currentTarget));
  card.querySelector('.review-button').addEventListener('click',event => openAction(card,event.currentTarget));
});
$('#dialog-secondary').addEventListener('click',() => {
  const id = selectedCard.dataset.approval;
  if (state.executions[id]) return;
  if (id === 'reply') {
    const payload = currentPayload(); if (!validateAction(payload)) return;
    if (JSON.stringify(state.drafts[id]) === JSON.stringify(payload)) { notify('This email draft is already saved.'); return; }
    state.drafts[id] = payload;
    logActivity('approval',`Email draft saved: ${actionProfiles.reply.defaultPayload.subject}`,'Draft only · Nothing sent; Send Email still requires Dave’s confirmation','approvals');
    commit('Email draft saved. Nothing was sent.');
    $('#review-save-state').hidden = false; $('#review-save-state').textContent = storageAvailable ? 'Draft saved in this browser. Nothing was sent; Send Email is still required.' : 'Draft prepared for this session. Browser storage is unavailable.';
  } else if (id === 'meeting') {
    const editing = $('#calendar-editor').hidden;
    if (!editing && !validateAction(currentPayload())) return;
    $('#calendar-editor').hidden = !editing; $('#dialog-secondary').textContent = editing ? 'Finish editing' : 'Edit Time';
    if (editing) $('#calendar-start').focus();
  } else {
    const payload=currentPayload();if(!validateAction(payload))return;
    const normalized=normalizeSharePayload(payload);
    if(JSON.stringify(state.drafts.report)===JSON.stringify(normalized)){notify('This share draft is already saved. Nothing shared.');return;}
    state.drafts.report=normalized;
    logActivity('approval',`Share draft saved: ${normalized.fileName}`,`${SHARE_DELIVERY[normalized.delivery]} · ${SHARE_ACCESS[normalized.access]} · Nothing shared`,'approvals');
    commit('Share draft saved. Nothing shared.');
    $('#review-save-state').hidden=false;$('#review-save-state').textContent=storageAvailable?'Share draft saved in this browser. Share Document still requires your confirmation.':'Share draft retained for this session. Browser storage is unavailable.';
  }
});
['calendar-start','calendar-end'].forEach(id => document.getElementById(id).addEventListener('input',() => {
  const payload = currentPayload(); $('#calendar-proposed').textContent = normalizePayload('meeting',payload) ? formatMeetingTime(payload) : 'Choose a valid start and end time';
}));
function updateNotificationSummary() { $('#calendar-notification-status').textContent = $('#calendar-notify').checked ? 'Attendees would be notified in this simulation. No real notification is sent.' : 'Attendees would not be notified. This change remains a demo simulation.'; }
$('#calendar-notify').addEventListener('change',updateNotificationSummary);
$('#action-form').addEventListener('keydown',event => {
  // Enter in a metadata/time field must not accidentally execute an external-style action.
  if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault();
});
$('#action-form').addEventListener('submit',event => {
  event.preventDefault();
  if (event.submitter !== $('#dialog-execute') || !dialog.open || !selectedCard || reviewWorkspace!==activeWorkspace) return;
  const id = selectedCard.dataset.approval;
  if (state.executions[id] || decisionPaused(id)) return;
  const payload = currentPayload(); if (!validateAction(payload)) return;
  const profile = actionProfiles[id];
  state.executions[id] = {status:profile.status,at:new Date().toISOString(),payload:id==='report'?normalizeSharePayload(payload):payload};
  state.approvals = Object.keys(state.executions); delete state.drafts[id]; delete state.decisions[id];
  const titles = {reply:`Email sent: ${payload.subject}`,meeting:`Meeting rescheduled: ${currentContext.meetingName} — ${id === 'meeting' ? formatMeetingTime(payload) : ''}`,report:`Document shared: ${currentContext.documentTitle}`};
  const detail = id === 'reply' ? `To ${payload.to}` : id === 'meeting' ? `${currentContext.attendees} · Attendee notifications ${payload.notify ? 'simulated' : 'not requested'}` : `${payload.recipients.map(r=>r.name).join(', ')} · ${SHARE_DELIVERY[payload.delivery]} · ${SHARE_ACCESS[payload.access]} · No real cloud link or email sent`;
  logActivity('approval',titles[id],`${detail} · Dave confirmed · Demo simulation only`,'approvals');
  if (activeWorkspace==='personal' && id==='reply' && !state.tasks.includes('family-reply')) {state.tasks.push('family-reply');logActivity('task','Completed the family lunch follow-up','Dave confirmed Send Email; linked local demo task completed','tasks');}
  dialog.close(); commit(profile.success+(id==='report'?' — No real cloud link or email was sent.':''));
});
['close-dialog','dialog-cancel'].forEach(id => document.getElementById(id).addEventListener('click',() => dialog.close()));
dialog.addEventListener('close',() => {
  if(meetingReviewReturn){const context=meetingReviewReturn;meetingReviewReturn=null;if(context.workspace===activeWorkspace){openMeetingDetails(context.key,context.origin);return;}}
  if(restoreResponseFocus(reviewOrigin)){scheduleMonitoring(3500);return;}
  const origin = reviewOrigin && !reviewOrigin.disabled ? reviewOrigin : selectedCard?.querySelector('.review-button');
  if (origin?.isConnected && origin.getClientRects().length) origin.focus({preventScroll:true});
  else { const review=selectedCard?.querySelector('.review-button'); if(review?.getClientRects().length) review.focus({preventScroll:true}); else $('#attention-title').focus({preventScroll:true}); }
  scheduleMonitoring(3500);
});

function checkVisibleControl(element){return element.checkVisibility?element.checkVisibility({visibilityProperty:true}):Boolean(element.getClientRects().length);}
function containDialogFocus(event) {
  if (event.key !== 'Tab') return;
  const overlay=event.currentTarget;
  const controls=[...overlay.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [href], [tabindex="0"], summary')].filter(element=>element.getClientRects().length && checkVisibleControl(element));
  const first=controls[0],last=controls[controls.length-1];if(!first)return;
  if(event.shiftKey && (document.activeElement===first || !overlay.contains(document.activeElement))){event.preventDefault();last.focus();}
  else if(!event.shiftKey && (document.activeElement===last || !overlay.contains(document.activeElement))){event.preventDefault();first.focus();}
}
dialog.addEventListener('keydown',containDialogFocus);
taskCards.forEach(card => card.querySelector('input').addEventListener('change',event => {
  const id = card.dataset.task;
  const checked = event.target.checked;
  if (id==='family-reply' && activeWorkspace==='personal' && messageRecord(0).status==='Handled')state.messages[0].handledLinkedTaskChanged=true;
  if (checked === state.tasks.includes(id)) return;
  state.tasks = checked ? [...state.tasks,id] : state.tasks.filter(item => item !== id);
  logActivity('task',`You ${checked ? 'completed' : 'reopened'}: ${demo.tasks.find(task => task.id === id).title}`,checked ? 'Demo task marked complete by Dave' : 'Demo task restored to your radar','tasks');
  commit(checked ? 'Task complete.' : 'Task reopened.');
}));


function priorityTask() {
  const due = dueTasks();
  return [...due].sort((a,b)=>taskUrgency(b)-taskUrgency(a))[0];
}
function proactiveUpdates() {
  const personal = activeWorkspace === 'personal';
  const due = dueTasks().length;
  const pending = pendingCards().length;
  const sent = Boolean(state.executions.reply);
  const rescheduled = state.executions.meeting;
  const updates = [
    {kind:'inbox',icon:'↗',title:`${demo.priority} important ${demo.priority===1?'message needs':'messages need'} attention`,detail:messageResolved() && !sent ? `You marked ${demo.sender}’s message ${messageRecord(0).status.toLowerCase()}. No reply was sent.` : sent ? personal ? 'Your confirmed lunch reply is sent in demo mode. The appointment reminder remains on your radar.' : 'Your confirmed partnership reply is sent in demo mode. Tomorrow’s board materials still need review.' : personal ? 'Alex needs a reply tonight; your appointment reminder is flagged.' : 'Sarah’s deadline and tomorrow’s board materials are flagged.',handled:'Prioritized'},
    {kind:'calendar',icon:'⌁',title:rescheduled ? 'The scheduling conflict is resolved' : 'I found one scheduling conflict',detail:calendarDecisionSummary(),handled:rescheduled?'Rescheduled · Demo':decisionPaused('meeting')?state.decisions.meeting.status:'Alternative prepared'},
    {kind:'draft',icon:'✧',title:messageResolved() && !sent ? `Your message to ${demo.sender} is ${messageRecord(0).status.toLowerCase()}` : sent ? `Your reply to ${demo.sender} is sent` : state.drafts.reply ? 'Your edited reply is saved' : 'I’ve drafted a reply for you',detail:messageResolved() && !sent ? 'Your local decision is recorded. No email was sent, and no new reply is requested.' : sent ? 'You confirmed the send in demo mode. No real message left this workspace.' : personal ? 'Lunch reply ready for tonight. Edit it before choosing Send Email.' : 'Partnership reply ready before Friday. Edit it before choosing Send Email.',handled:messageResolved() && !sent ? 'Resolved locally' : sent ? 'Sent · Demo' : state.drafts.reply ? 'Draft saved' : 'Draft prepared'},
    {kind:'task',icon:'◷',title:due ? `${due} ${due === 1 ? 'task needs' : 'tasks need'} attention${dueTasks().some(t=>t.due==='overdue')?' · Includes overdue work':' today'}` : 'Your due-today tasks are clear',detail:due ? `Next: ${priorityTask().title}. ${personal ? 'Bill reminder: Friday.' : 'I’ve flagged the deadline.'}` : `${state.tasks.length} tasks are marked complete. ${openTasks().length ? 'The remaining tasks are on your radar.' : 'You have no open demo tasks.'}`,handled:due ? 'Deadlines flagged' : 'Caught up'},
    {kind:'approval',icon:'◇',title:pending ? `I’ve prepared ${pending} ${pending === 1 ? 'action' : 'actions'} for you` : 'No actions are waiting for authorization',detail:pending ? 'Details ready. Only you can confirm sending, rescheduling, or sharing.' : 'Completed, deferred, and declined decisions are recorded separately. No real account was changed.',handled:pending ? 'Your decision' : 'Handled · Demo'}
  ];
  if (state.meetingBriefPrepared) updates.push({kind:'brief',icon:'✧',title:'Your next meeting brief is ready',detail:`I’ve gathered the local context for ${demo.nextMeeting}. Nothing needs your approval here.`,handled:'Prepared quietly'});
  return updates;
}
function recommendations() {
  return attentionItems().slice(0,1);
}
function renderProactive() {
  const updates = $('#since-updates'); updates.replaceChildren();
  proactiveUpdates().forEach(update=>{
    const li=document.createElement('li');li.className='since-item';li.dataset.signal=update.kind;
    const icon=document.createElement('span');icon.className='since-icon';icon.innerHTML={brief:'<svg class="ui-icon" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',inbox:'<svg class="ui-icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/></svg>',calendar:'<svg class="ui-icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18"/></svg>',draft:'<svg class="ui-icon" viewBox="0 0 24 24"><path d="m4 20 4-1L20 7l-3-3L5 16l-1 4M14 7l3 3"/></svg>',task:'<svg class="ui-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></svg>',approval:'<svg class="ui-icon" viewBox="0 0 24 24"><path d="m12 3 9 9-9 9-9-9 9-9"/></svg>'}[update.kind];icon.setAttribute('aria-hidden','true');
    const body=document.createElement('div');const title=document.createElement('h3');title.textContent=update.title;const detail=document.createElement('p');detail.textContent=update.detail;body.append(title,detail);
    const status=document.createElement('span');status.className='prepared-chip';status.textContent=update.handled;
    li.append(icon,body,status);updates.append(li);
  });
  $('#proactive-context').textContent=`${currentContext.name} · Scripted recap, not a live account scan. Today’s events don’t overlap. ${state.executions.meeting ? 'Friday’s change is complete in demo mode.' : 'Friday’s conflict is recorded; the proposed change is available in your decision history.'}`;
  const list=$('#recommendation-list');
  const focused=document.activeElement.closest?.('[data-recommendation-key]')?.dataset.recommendationKey;
  list.replaceChildren();
  recommendations().forEach(item=>{
    const li=document.createElement('li');li.className='recommendation';
    const body=document.createElement('div');const title=document.createElement('h3');title.textContent=item.title;const reason=document.createElement('p');reason.textContent=item.reason;body.append(title,reason);li.append(body);
    if(item.action){const button=document.createElement('button');button.type='button';button.className='recommendation-action';button.textContent=item.action;button.dataset.recommendationKey=item.approval || item.task;
      if(item.approval){button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',()=>openAction(approvalCards.find(card=>card.dataset.approval===item.approval),button));}
      else button.addEventListener('click',()=>openSpecificTask(item.task));
      li.append(button);
    }else{const status=document.createElement('span');status.className='prepared-chip';status.textContent=item.handled;li.append(status);}
    list.append(li);
  });
  if(focused){const replacement=[...list.querySelectorAll('[data-recommendation-key]')].find(button=>button.dataset.recommendationKey===focused);if(replacement)replacement.focus({preventScroll:true});}
  $('.stat-card[href="#inbox"] .stat-pill').textContent=`${demo.priority} need attention`;
  $('.stat-card[href="#inbox"] > p').textContent=`I’ve sorted ${demo.unread-demo.priority} lower-priority messages.`;
  $('.stat-card[href="#calendar"] .stat-top > span').textContent='Schedule';
  $('.stat-subvalue').textContent=`${demo.focus} focus`;
  const conversation=$('.conversation-context');conversation.textContent=`I’m ready, Dave. I’ve reviewed your ${activeWorkspace==='personal'?'personal day':'workday'}. Ask what changed, what needs attention, or what I can prepare.`;
  $('.greeting p').textContent=activeWorkspace==='personal' ? 'I’ve reviewed your reminders and personal plans. Here’s what needs a decision.' : 'I’ve reviewed the inbox, deadlines, and meetings. Here’s what needs a decision.';
}


// One triage policy feeds the executive briefing, action queue, and recommendations.
function attentionItems() {
  const personal=activeWorkspace==='personal';
  const items=pendingCards().map(card=>{
    const id=card.dataset.approval;
    const descriptions={reply:personal?'Orbit already prepared a response. Alex needs your answer tonight.':'Orbit already prepared a response. Sarah needs an answer before Friday.',meeting:personal?'Friday’s visit overlaps your appointment. A clean 9:00 AM alternative is prepared.':'Friday’s investor call overlaps Finance. A clean 10:30 AM alternative is prepared.',report:'Orbit prepared the document, recipients, permissions, and message. Only you can authorize sharing.'};
    return {title:id==='reply'?(personal?'Reply to Alex about Saturday lunch':'Reply to Sarah about the partnership'):card.querySelector('h3').textContent,reason:descriptions[id],approval:id,action:id==='reply'?'Review draft':id==='meeting'?'Review schedule change':'Review document',severity:id==='reply'&&personal?'urgent':'prepared',score:id==='reply'?(personal?95:70):id==='meeting'?65:40};
  });
  dueTasks().filter(task=>!(personal && task.id==='family-reply' && !state.executions.reply && !messageResolved())).forEach(task=>items.push({title:task.title,reason:task.due==='overdue'?'Overdue in this demo. Review the deadline and decide the next step.':'Due today. Review the task and mark it complete when done.',task:task.id,action:'Open task',severity:'urgent',score:taskUrgency(task)}));
  return items.sort((a,b)=>b.score-a.score);
}
function handledFacts() {
  return [`Prioritized ${demo.unread} emails; ${demo.priority} are important`,state.executions.reply?'Recorded your confirmed email send · Demo':messageResolved()?'Recorded your local message decision · No email sent':'Drafted 1 reply for your review',`Checked ${demo.focus} of scheduled focus time`,state.executions.meeting?'Recorded your confirmed reschedule · Demo':decisionPaused('meeting')?`Recorded your ${state.decisions.meeting.status.toLowerCase()} proposal · No meeting changed`:'Identified the Friday conflict and prepared an alternative',pendingCards().length ? `Prepared ${pendingCards().length} actions for your decision` : 'Recorded your decisions · Executed only when confirmed',...(state.meetingBriefPrepared?['Prepared the next meeting’s context brief']:[])];
}
function allTaskItems(){
  const baseline=demo.tasks.map(task=>({ ...task,completed:state.tasks.includes(task.id),owner:'Dave',detail:taskCards.find(card=>card.dataset.task===task.id)?.querySelector('input + span small')?.textContent || '' }));
  const local=Object.entries(state.messages || {}).flatMap(([i,r])=>(r.artifacts || []).filter(item=>['task','followup'].includes(item.kind)).map(item=>({id:`message-${i}-${item.kind}`,title:item.title,owner:item.owner || 'Dave',due:dueFromDate(item.dueDate),detail:item.dueDate?'Due '+item.dueDate:'No due date set',completed:item.done,artifact:item})));
  return [...baseline,...local];
}
function renderTaskList(){
  if(!taskListDialog.open)return;
  const focused=document.activeElement.dataset.taskListId,items=allTaskItems(),open=items.filter(t=>!t.completed);
  $('#task-list-summary').textContent=`${currentContext.name} · ${open.length} open · ${dueSummary()} · ${items.filter(t=>t.completed).length} completed`;
  $('[data-task-filter="today"]').textContent=items.some(t=>!t.completed && t.due==='overdue')?'Due / overdue':'Due today';
  const visible=items.filter(t=>taskListFilter==='all' || taskListFilter==='completed' && t.completed || taskListFilter==='open' && !t.completed || taskListFilter==='today' && ['today','overdue'].includes(t.due) && !t.completed);
  const list=$('#task-list-items');list.replaceChildren();
  visible.forEach(task=>{
    const row=document.createElement('label');row.className='full-task-row';row.classList.toggle('selected-task',task.id===selectedTaskId);row.classList.toggle('task-completed',task.completed);
    const check=document.createElement('input');check.type='checkbox';check.checked=task.completed;check.dataset.taskListId=task.id;check.setAttribute('aria-label','Complete '+task.title);
    const body=document.createElement('span');body.className='full-task-body';const title=document.createElement('strong');title.textContent=task.title;const detail=document.createElement('small');detail.textContent=`${task.owner} · ${task.detail}${task.artifact?' · From inbox':''}`;body.append(title,detail);
    const badge=document.createElement('span');badge.className='full-task-badge';badge.textContent=task.completed?'Completed':task.id===selectedTaskId?'Selected':task.due==='overdue'?'Overdue':task.due==='today'?'Due today':'Upcoming';
    check.addEventListener('change',()=>{
      if(task.artifact){task.artifact.done=check.checked;logActivity('task',`You ${check.checked?'completed':'reopened'}: ${task.title}`,'Dave updated a local demo task','tasks');commit(check.checked?'Task complete.':'Task reopened.');}
      else{const original=taskCards.find(card=>card.dataset.task===task.id).querySelector('input');original.checked=check.checked;original.dispatchEvent(new Event('change',{bubbles:true}));}
    });row.append(check,body,badge);list.append(row);
  });
  $('#task-list-empty').hidden=visible.length!==0;
  if(focused){const replacement=[...list.querySelectorAll('input')].find(e=>e.dataset.taskListId===focused);if(replacement)replacement.focus({preventScroll:true});else $(`[data-task-filter="${taskListFilter}"]`).focus({preventScroll:true});}
}
function openSpecificTask(id=null){
  if(id && !allTaskItems().some(t=>t.id===id))return;
  taskListOrigin=document.activeElement;
  if(workflowMode==='proactive')cancelProactive();clearTimeout(monitorTimer);
  selectedTaskId=id;taskListFilter='all';
  $$('[data-task-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.taskFilter==='all')));
  taskListDialog.showModal();renderTaskList();
  const selected=[...$('#task-list-items').querySelectorAll('input')].find(e=>e.dataset.taskListId===id);
  if(selected){selected.focus({preventScroll:true});selected.closest('label').scrollIntoView({block:'nearest',behavior:'instant'});}else $('#task-list-close').focus();
}
$('#task-list-open').addEventListener('click',()=>openSpecificTask());
$('#task-list-close').addEventListener('click',()=>taskListDialog.close());
$$('[data-task-filter]').forEach(button=>button.addEventListener('click',()=>{taskListFilter=button.dataset.taskFilter;$$('[data-task-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderTaskList();}));
taskListDialog.addEventListener('keydown',containDialogFocus);
taskListDialog.addEventListener('close',()=>{
  if(restoreResponseFocus(taskListOrigin)){scheduleMonitoring(3500);return;}
  const replacement=taskListOrigin?.dataset.attentionTask?[...$$('[data-attention-task]')].find(button=>button.dataset.attentionTask===taskListOrigin.dataset.attentionTask):taskListOrigin?.id?document.getElementById(taskListOrigin.id):null;
  const origin=taskListOrigin?.isConnected?taskListOrigin:replacement;
  if(origin?.getClientRects().length)origin.focus({preventScroll:true});else $('#attention-title').focus({preventScroll:true});scheduleMonitoring(3500);
});

function renderOperator() {
  const focusedTask=document.activeElement.dataset.attentionTask;
  const items=attentionItems(),urgent=items.filter(item=>item.severity==='urgent');
  $('#executive-title').textContent=activeWorkspace==='personal'?'I’ve reviewed your personal day.':'I’ve reviewed your workday.';
  $('#executive-action').hidden=items.length===0;
  if(items.length){const next=items[0];$('#executive-action').textContent=next.action;$('#executive-action').onclick=()=>next.approval?openAction(approvalCards.find(card=>card.dataset.approval===next.approval),$('#executive-action')):openSpecificTask(next.task);$('#executive-action').setAttribute('aria-haspopup','dialog');}
  $('#briefing-verdict').textContent=items.length ? `${items.length} ${items.length===1?'thing needs':'things need'} your attention.` : 'No decisions are waiting for you.';
  $('#briefing-summary').textContent=items.length ? `${urgent.length ? `${urgent.length} need attention today. ` : ''}I’ve prepared the next steps; you decide what happens.` : 'No immediate decision is waiting. Completed, deferred, and declined items remain in your history.';
  const priorities=$('#executive-priorities');priorities.replaceChildren();items.slice(0,2).forEach(item=>{const li=document.createElement('li');li.textContent=item.title+(item.task?(allTaskItems().find(t=>t.id===item.task)?.due==='overdue'?' — overdue':' — due today'):item.severity==='urgent'?' — reply tonight':' — ready for review');priorities.append(li);});
  $('#executive-handled').textContent=`Already handled: inbox triage, ${demo.focus} of protected focus time, and prepared reviews.`;
  $('#executive-reassurance').textContent=`The other ${demo.unread-demo.priority} messages can wait. Today’s schedule has no overlaps.`;
  $('#attention-total').textContent=items.length;
  const pendingList=$('.approvals-panel .approval-list'),completedList=$('#completed-action-list');
  approvalCards.forEach(card=>{
    const item=items.find(item=>item.approval===card.dataset.approval);
    if(card.dataset.approval==='reply' && item){card.querySelector('h3').textContent=item.title;card.querySelector('p').textContent='Orbit already prepared a response.';card.querySelector('.approve-button').textContent='Review reply';}
    if(card.dataset.approval==='reply' && messageResolved() && !state.executions.reply){card.querySelector('.status-label').textContent=messageRecord(0).status;card.querySelector('.approve-button').disabled=true;card.querySelector('.approve-button').textContent=messageRecord(0).status;card.querySelector('.review-button').textContent='Open message';card.querySelector('.action-boundary').textContent='Resolved locally · No email sent';}
    const target=item?pendingList:completedList;if(card.parentElement!==target)target.append(card);
    card.dataset.triage=item?.severity || 'completed';
    let badge=card.querySelector('.triage-badge');if(!badge){badge=document.createElement('span');badge.className='triage-badge';card.querySelector('h3').after(badge);}badge.textContent=item?item.severity==='urgent'?'Needs attention today':'Prepared · Your decision':'Confirmed by Dave · Demo';
    const choice=decisionPaused(card.dataset.approval)?state.decisions[card.dataset.approval]:null;
    let restore=card.querySelector('.restore-decision');
    if(choice){card.querySelector('.status-label').textContent=choice.status;badge.textContent=choice.status==='Deferred'?`Returns ${localTime(choice.until)}`:'Not needed · No action executed';card.querySelector('.review-button').textContent='View prepared details';card.querySelector('.action-boundary').textContent='Dave chose '+choice.status.toLowerCase()+' · Nothing executed';
      if(!restore){restore=document.createElement('button');restore.type='button';restore.className='review-button restore-decision';restore.textContent='Restore to attention';restore.addEventListener('click',()=>restoreDecision(card.dataset.approval));card.querySelector('.approval-actions').append(restore);}restore.hidden=false;
    }else if(restore)restore.hidden=true;
    let reason=card.querySelector('.triage-reason');if(!reason){reason=document.createElement('p');reason.className='triage-reason';card.querySelector('.approval-actions').before(reason);}reason.textContent=item?.reason || (choice?'Your decision is recorded. Nothing was sent, rescheduled, or shared.':'Completed only after your explicit confirmation.');
  });
  const tasks=$('#attention-tasks');tasks.replaceChildren();items.filter(item=>item.task).forEach(item=>{const row=document.createElement('article');row.className='attention-task';const body=document.createElement('div');const label=document.createElement('span');label.className='triage-badge';label.textContent=allTaskItems().find(t=>t.id===item.task)?.due==='overdue'?'Overdue · Needs attention':'Due today · Needs attention';const title=document.createElement('h3');title.textContent=item.title;const reason=document.createElement('p');reason.textContent='Deadline flagged. Review the task; mark it complete when done.';body.append(label,title,reason);const button=document.createElement('button');button.className='recommendation-action';button.type='button';button.textContent='Open task';button.dataset.attentionTask=item.task;button.setAttribute('aria-haspopup','dialog');button.addEventListener('click',()=>openSpecificTask(item.task));row.append(body,button);tasks.append(row);});
  if(focusedTask){const control=[...tasks.querySelectorAll('button')].find(button=>button.dataset.attentionTask===focusedTask);if(control)control.focus({preventScroll:true});}
  $('#attention-empty').hidden=items.length!==0;pendingList.hidden=!pendingCards().length;
  $('#completed-actions').hidden=completedList.children.length===0;$('#completed-action-count').textContent=completedList.children.length;
  const handled=$('#handled-summary-list');handled.replaceChildren();handledFacts().forEach(fact=>{const li=document.createElement('li');li.textContent=fact;handled.append(li);});
  $('#reassurance-title').textContent='The remaining items can wait.';
  $('#reassurance-detail').textContent=`${demo.unread-demo.priority} lower-priority messages can wait. No overlaps in today’s schedule. ${dueTasks().some(t=>t.due==='overdue')?'Overdue work is included in your attention queue.':'No overdue demo tasks are flagged.'}`;
  $('#meeting-brief-panel').hidden=!state.meetingBriefPrepared;
  $('#meeting-brief-text').textContent=`Next: ${demo.nextMeeting} · ${demo.meetings} ${currentContext.calendarNoun} today. ${demo.research[0].text} ${dueTasks().length ? `${dueTasks().length} tasks need attention today.` : 'Your due-today tasks are complete.'} ${demo.focus} of focus time stay protected. Local fictional context only.`;
  $('#monitoring-toggle').textContent=state.monitoringPaused?'Resume demo monitoring':'Pause demo monitoring';$('#monitoring-toggle').setAttribute('aria-pressed',String(state.monitoringPaused));
  if(workflowMode!=='proactive')$('#monitoring-status').textContent=state.monitoringPaused?'Demo monitoring paused':state.monitoringSeen.length===SIGNAL_IDS.length?'All scenario signals triaged · Monitoring quietly':'Demo monitoring on · Preparing the next meaningful signal';
  const recent=[...state.activity].reverse().find(event=>event.kind==='proactive');
  if(recent)$('#proactive-context').textContent=`${currentContext.name} · Last demo signal: ${recent.title}. No connected accounts.`;
}
function demoSignals() {
  const personal=activeWorkspace==='personal';
  return [
    {id:'email',agents:['inbox','approvals'],title:personal?'Important personal email detected':'Important work email detected',outcome:messageResolved()?'Your local message decision is already recorded; no new action is needed.':`I’ve prioritized ${demo.sender}’s message, summarized the deadline, and prepared the reply for review.`,classification:messageResolved()?'informational':personal?'urgent':'prepared'},
    {id:'conflict',agents:['calendar','approvals'],title:personal?'Appointment overlap detected':'Investor scheduling conflict detected',outcome:state.executions.meeting?'Your confirmed demo reschedule resolves the conflict; no new change is needed.':currentContext.calendarFinding,classification:state.executions.meeting?'informational':'prepared'},
    {id:'deadline',agents:['tasks'],title:'Task deadline checked',outcome:priorityTask()?`${priorityTask().title} is ${priorityTask().due==='overdue'?'overdue':'due today'}. I’ve flagged it for your attention.`:'Your due-today tasks are complete; no deadline interruption is needed.',classification:dueTasks().length?'urgent':'informational'},
    {id:'brief',agents:['calendar','research'],title:'Meeting brief prepared',outcome:`I’ve gathered local context for the ${demo.nextMeeting} ${personal?'personal event':'meeting'}. Read it in the calendar when useful.`,classification:'informational'},
    {id:'draft',agents:['inbox','approvals'],title:messageResolved()?'Recorded message decision checked':'Draft response prepared',outcome:messageResolved() && !state.executions.reply?'Your local message decision is retained. No send or new approval was created.':state.executions.reply?'The recorded send remains a demo simulation. I have not sent another message.':state.drafts.reply?'Your edited draft is retained. I have not replaced it or sent it.':'The reply is ready to edit. Send Email still needs your explicit confirmation.',classification:messageResolved()?'informational':'prepared'},
    {id:'approval',agents:['approvals'],title:'Prepared decisions checked',outcome:pendingCards().length?`${pendingCards().length} prepared actions need your decision. No external action has executed.`:'All prepared demo actions are complete. There is nothing new to authorize.',classification:pendingCards().length?'prepared':'informational'}
  ];
}
function scheduleMonitoring(delay=45000) {
  clearTimeout(monitorTimer);
  if(state.monitoringPaused || guidedSession)return;
  monitorTimer=setTimeout(()=>{
    if(document.hidden || responseEditorDraft || dialog.open || messageDialog.open || taskListDialog.open || meetingDialog.open || processing){scheduleMonitoring(2500);return;}
    const signal=demoSignals().find(signal=>!state.monitoringSeen.includes(signal.id));
    if(signal)startProactive(signal);else scheduleMonitoring(45000);
  },delay);
}
function cancelProactive() {
  if(workflowMode!=='proactive')return;
  clearTimeout(commandTimer);commandGeneration++;clearHighlights();setBusy(false);workflowMode=null;currentWorkflow=null;
  $('#workflow-title').textContent='Orbit is monitoring your workspace';$('#workflow-phase').textContent='Background preparation paused for your request';$('#workflow-badge').textContent='IDLE';renderOperator();
}
function startProactive(signal) {
  if(processing || responseEditorDraft || dialog.open || messageDialog.open || taskListDialog.open || meetingDialog.open)return;
  ['workflow-title','workflow-phase','monitoring-status'].forEach(id=>document.getElementById(id).setAttribute('aria-live','off'));
  clearTimeout(monitorTimer);workflowMode='proactive';currentWorkflow=signal.id;executionEvents=[];setBusy(true);
  $('#workflow-title').textContent=signal.title;$('#workflow-badge').textContent='OBSERVING';$('#execution-note').textContent='Proactive demo signal · Eastern time';
  $('#operations').classList.add('command-processing');commandHub.classList.add('orchestrating');executionStep(`Observe: ${signal.title}`);
  const generation=++commandGeneration,workspace=activeWorkspace;let index=0;
  const valid=()=>generation===commandGeneration && workspace===activeWorkspace;
  const complete=()=>{
    if(!valid())return;
    const replay=signal.replay===true;signal={...demoSignals().find(candidate=>candidate.id===signal.id),replay};
    if(replay)state.monitoringReplay=(state.monitoringReplay+1)%SIGNAL_IDS.length;
    executionStep(`Prioritize: ${signal.classification==='urgent'?'Needs attention today':signal.classification==='prepared'?'Ready for your review':'Informational · No interruption'}`);
    executionStep('Prepare: '+(signal.id==='brief'?'Meeting context brief':'Next step checked against current state'));
    executionStep(signal.classification==='informational'?'No interruption needed':'Escalate: decision surfaced in Needs your attention');
    if(signal.id==='brief')state.meetingBriefPrepared=true;
    state.monitoringSeen=[...new Set([...state.monitoringSeen,signal.id])];state.proactiveScanned=state.monitoringSeen.length===SIGNAL_IDS.length;
    logActivity('proactive',signal.title,signal.outcome+' · '+(signal.classification==='urgent'?'Needs attention':signal.classification==='prepared'?'Ready for review':'Handled quietly')+' · Demo',signal.agents[0]);
    executionStep('Preparation complete · No external execution');clearHighlights();setBusy(false);workflowMode=null;currentWorkflow=null;
    $('#workflow-title').textContent='Orbit is monitoring your workspace';$('#workflow-phase').textContent=signal.classification==='informational'?'Prepared quietly · No decision needed':'Work prepared · Waiting for Dave’s decision';$('#workflow-badge').textContent='IDLE';$('#execution-note').textContent='Last proactive workflow · Eastern time';
    saveState();render(true);
    if(signal.classification==='urgent'){$('#monitoring-status').setAttribute('aria-live','polite');$('#monitoring-status').textContent=signal.title+' · Needs attention today';}
    scheduleMonitoring(state.monitoringSeen.length===SIGNAL_IDS.length?45000:1600);
  };
  const next=()=>{
    if(!valid())return;
    if(index===signal.agents.length){$('#workflow-badge').textContent='PREPARING';hubStatus.lastChild.textContent='Preparing the next logical step…';commandTimer=setTimeout(complete,350);return;}
    const agent=signal.agents[index++];activateAgent(agent);$('#workflow-badge').textContent='UNDERSTANDING';
    commandTimer=setTimeout(()=>{if(!valid())return;const card=$(`[data-agent="${agent}"]`);card.classList.remove('agent-working');card.classList.add('agent-processed');const path=$$('.connector-pulse')[specialistCards.indexOf(card)];path.classList.remove('route-active');path.classList.add('route-return');agentLastChecked.set(agent,Date.now());executionStep(`Understand: ${card.querySelector('h3').textContent} checked the ${activeWorkspace} context`);renderOperations();next();},650);
  };next();
}
$('#monitoring-toggle').addEventListener('click',()=>{$('#monitoring-status').setAttribute('aria-live','polite');state.monitoringPaused=!state.monitoringPaused;if(state.monitoringPaused){clearTimeout(monitorTimer);cancelProactive();}else scheduleMonitoring(1200);saveState();renderOperator();renderOperations();if(!storageAvailable)notify('Monitoring preference lasts for this session only; browser storage is unavailable.');});
$('#monitoring-next').addEventListener('click',()=>{const signals=demoSignals(),next=signals.find(signal=>!state.monitoringSeen.includes(signal.id));startProactive({... (next || signals[state.monitoringReplay]),replay:!next});});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(monitorTimer);cancelProactive();}else scheduleMonitoring(1800);});

function routeCommand(request) {
  const text = request.toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
  if (/\b(what did you handle|what have you handled|what have you done|what did orbit handle|already handled)\b/.test(text)) return 'handled';
  if (/\b(what changed|whats changed|since my last check|recent updates|recent activity)\b/.test(text)) return 'changes';
  if (/\b(needs? (my )?attention|what should i do next)\b/.test(text)) return 'attention';
  if (/\b(what can you (handle|do|prepare)|what (can|could) orbit (handle|do|prepare))\b/.test(text)) return 'capabilities';
  if (/\b(draft|write|compose)\b/.test(text) && /\b(reply|response|email)\b/.test(text) && !/\b(review|show|open)\b/.test(text)) return 'unsupported';
  if (/\b(share|sharing|send document|document approval)\b/.test(text)) return 'approvals';
  if (/\b(briefing|brief|summary|focus|prioriti[sz]e|priorities|start my day)\b/.test(text)) return 'briefing';
  const routes = [
    ['inbox',/\b(inbox|emails?|mail|messages?|replies|reply|drafts?)\b/],
    ['calendar',/\b(calendar|meetings?|schedule|scheduling|reschedule|conflicts?|availability)\b/],
    ['tasks',/\b(tasks?|to do|todos?|due|deadlines?)\b/],
    ['approvals',/\b(approvals?|approve|sign off|signoff|review actions|needs review|pending actions)\b/],
    ['research',/\b(research|investigate|look into|background|context|offsite|northstar)\b/]
  ].filter(([,pattern]) => pattern.test(text));
  return routes.length > 1 ? 'briefing' : routes.length ? routes[0][0] : 'unsupported';
}
function workspaceResponse(route) {
  const pending = pendingCards();
  const due = dueTasks();
  const open = openTasks().length;
  const partnership = messageResolved() && !state.executions.reply ? `You marked ${demo.sender}’s message ${messageRecord(0).status.toLowerCase()}; no email was sent.` : state.executions.reply ? `Your reply to ${demo.sender} has been sent in demo mode.` : currentContext.inboxFinding;
  const inbox = `In ${currentContext.name}, you have ${demo.unread} unread emails; ${demo.priority} are high priority. ${partnership} ${activeWorkspace==='personal' && ['Handled','Snoozed'].includes(messageStatus(2))?'The utility bill message is '+messageStatus(2).toLowerCase()+' locally; no payment was made.':currentContext.inboxSecondary}`;
  const calendar = `In ${currentContext.name}, you have ${demo.meetings} ${currentContext.calendarNoun} today with ${demo.focus} of protected focus time. Your next event is at ${demo.nextMeeting}. ` + calendarDecisionSummary();
  const tasks = `You have ${open} open ${open === 1 ? 'task' : 'tasks'}; ${due.filter(t=>t.due==='today').length} ${due.filter(t=>t.due==='today').length === 1 ? 'is' : 'are'} due today.${due.some(t=>t.due==='overdue')?' '+due.filter(t=>t.due==='overdue').length+' overdue.':''} ` + (due.length ? `Prioritize ${[...due].sort((a,b)=>taskUrgency(b)-taskUrgency(a)).map(task => task.title.charAt(0).toLowerCase()+task.title.slice(1)).join(' and ')}.` : 'Your due-today tasks are complete. Keep the protected focus block for preparation.');
  const approvals = pending.length ? `${pending.length} prepared ${pending.length===1?'action needs':'actions need'} your decision. Review the details below; nothing is sent, rescheduled, or shared automatically.` : 'No actions are waiting for authorization. Completed, deferred, and declined decisions are recorded separately; no external action was performed.';
  const research = `From the fictional workspace notes:\n\n${demo.research.map(note => `${note.title}: ${note.text}`).join('\n\n')}\n\nThis is a local context brief, not web research.`;
  const next=attentionItems()[0];
  const recommendation = next ? `Start with ${next.title.charAt(0).toLowerCase()+next.title.slice(1)}.` : 'Your urgent demo tasks and actions are clear.';
  const briefing = `Dave, here's your ${currentContext.name} briefing. ${recommendation}\n\n${demo.priority} emails are high priority. ${partnership} Your next event is at ${demo.nextMeeting}; ${demo.focus} of focus time are protected.\n\n${open} tasks remain, ${dueSummary()}, and ${pending.length} actions are pending. ${calendarDecisionSummary()}`;
  const changes = `Dave, here’s the current recap in ${currentContext.name} during this scripted morning recap:\n\n${proactiveUpdates().map(update=>`${update.title}. ${update.detail}`).join('\n\n')}` + (state.activity.some(event=>!['proactive','command'].includes(event.kind)) ? `\n\nMore recently:\n${state.activity.filter(event=>!['proactive','command'].includes(event.kind)).slice(-3).reverse().map(event=>event.title).join('\n')}` : '');
  const attention = next ? `Start with ${next.title.charAt(0).toLowerCase()+next.title.slice(1)}. ${next.reason}\n\n${attentionItems().length} items need your attention. You can handle the next steps below.` : 'Your urgent tasks and prepared actions are clear. Deferred or declined proposals remain in decision history; no external action happens automatically.';
  const capabilities = `In ${currentContext.name}, I can prioritize and summarize your fictional messages, prepare a reply, flag calendar conflicts and propose a time, surface task deadlines, and prepare ${currentContext.documentTitle.toLowerCase()} for sharing. I can also summarize local notes and brief you on what changed.\n\nYou review and edit the work. Send Email, Approve & Reschedule, and Share Document execute only after you confirm, and only as demo simulations. I can’t send real messages, change real calendars, pay bills, browse the web, or connect to external accounts.`;
  const handled = `In ${currentContext.name}, here’s what I’ve already handled:\n\n${handledFacts().join('\n')}\n\nI’ve kept ${demo.unread-demo.priority} lower-priority messages out of your decision queue. Any sent email, changed meeting, or shared document required your confirmation and remains a demo simulation.`;
  return (responseCommandNotice && route!=='unsupported'?responseCommandNotice+'\n\n':'') + {inbox,calendar,tasks,approvals,research,briefing,changes,attention,handled,capabilities,unsupported:'This scripted demo can review inbox, calendar, tasks, approvals, and local notes. It cannot generate a custom reply or execute an action from a typed command. Review and edit prepared work using the controls below; sending, sharing, or rescheduling still needs your explicit confirmation.'}[route];
}
function renderOperations() {
  if(!processing){$('#workflow-title').textContent=responseEditorDraft?'Waiting for your local action':state.monitoringPaused?'Orbit is ready · Demo monitoring paused':'Orbit is monitoring your workspace';$('#workflow-phase').textContent=responseEditorDraft?'Save or cancel the prepared local action · Nothing executed':state.monitoringPaused?'Commands remain available · Automatic demo signals paused':'Specialists idle or monitoring · No automatic execution';$('#workflow-badge').textContent=responseEditorDraft?'AWAITING YOU':state.monitoringPaused?'PAUSED':'IDLE';}
  const pending = pendingCards().length;
  const due = dueTasks().length;
  const open = openTasks().length;
  const idleStates = {inbox:'Idle',calendar:state.monitoringPaused?'Paused':'Monitoring',tasks:state.monitoringPaused?'Paused':'Monitoring',research:'Standing by',approvals:pending ? 'Waiting' : 'Idle'};
  const metrics = {inbox:`${currentContext.unread} emails analyzed`,calendar:`${demo.meetings} ${currentContext.calendarNoun} today`,tasks:dueTasks().some(t=>t.due==='overdue')?dueSummary():`${due} ${due === 1 ? 'task' : 'tasks'} due today`,research:'No active request',approvals:`${pending} ${pending === 1 ? 'action needs' : 'actions need'} approval`};
  specialistCards.forEach(card => {
    const agent = card.dataset.agent;
    const active = card.classList.contains('agent-working');
    const previous = [...state.activity].reverse().find(event => event.kind === 'command' && (event.route === agent || (['briefing','changes','attention'].includes(event.route) && ['inbox','calendar','tasks','approvals'].includes(agent))));
    const last = agentLastChecked.get(agent) || (previous ? Date.parse(previous.at) : null);
    const lastText = last ? `Last checked ${Math.floor((Date.now()-last)/60000) === 0 ? 'just now' : Math.floor((Date.now()-last)/60000)+' min ago'}` : 'Last checked 2 min ago';
    const metadata = {inbox:lastText,calendar:"Today's schedule clear",tasks:`${open} open ${open === 1 ? 'task' : 'tasks'}`,research:'Local context only',approvals:pending ? 'Human decision required' : 'No actions waiting now'};
    const labels=[['.agent-status',active ? 'Processing' : idleStates[agent]],[':scope > p',active && agent === 'research' ? 'Preparing local context' : metrics[agent]],['.agent-meta',active ? 'Analyzing demo context…' : card.classList.contains('agent-processed') ? 'Result returned to Orbit' : metadata[agent]]];
    labels.forEach(([selector,value])=>{const element=card.querySelector(selector);if(element.textContent!==value)element.textContent=value;});
  });
}
function renderExecution() {
  const list = $('#execution-timeline'); list.replaceChildren();
  $('#execution-toggle').hidden = processing || executionEvents.length <= 2;
  if (!executionEvents.length) {
    const li = document.createElement('li'); li.className = 'timeline-idle'; li.textContent = 'Submit a command above to see Orbit coordinate its specialists.'; list.append(li); return;
  }
  executionEvents.slice(-7).forEach(event => {
    const li = document.createElement('li');
    const time = document.createElement('time'); time.dateTime = event.at;
    time.textContent = new Date(event.at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'America/New_York'});
    const text = document.createElement('span'); text.textContent = event.text;
    li.append(time,text); list.append(li);
  });
}
function executionStep(text) { executionEvents.push({at:new Date().toISOString(),text}); renderExecution(); }
function clearHighlights() {
  $('#operations').classList.remove('command-processing'); commandHub.classList.remove('orchestrating'); hubStatus.innerHTML = idleHubMarkup;
  specialistCards.forEach(card => card.classList.remove('agent-working','agent-processed'));
  $$('.connector-pulse').forEach(path => path.classList.remove('route-active','route-return'));
  renderOperations();
}
function setBusy(busy) {
  processing = busy;
  const commandBusy = busy && workflowMode !== 'proactive';
  $('#execution-toggle').hidden = busy || executionEvents.length <= 2;
  if (busy) { $('#command-response-actions').replaceChildren(); $('#operations').classList.remove('execution-expanded'); $('#execution-toggle').setAttribute('aria-expanded','false'); $('#execution-toggle').textContent='Show full timeline'; }
  $('#command-send').disabled = commandBusy; $('#command-send').textContent = commandBusy ? 'Processing…' : 'Send';
  $('#command-input').readOnly = commandBusy;
  $$('[data-command]').forEach(button => { button.disabled = commandBusy; });
  $('#command-response').setAttribute('aria-busy',String(commandBusy)); $('#command-form').setAttribute('aria-busy',String(commandBusy));
  $('#monitoring-next').disabled = busy;
}
function activateAgent(agent) {
  specialistCards.forEach((card,index) => {
    const active = card.dataset.agent === agent;
    card.classList.toggle('agent-working',active);
    $$('.connector-pulse')[index].classList.toggle('route-active',active);
  });
  hubStatus.lastChild.textContent = `Coordinating ${$(`[data-agent="${agent}"] h3`).textContent}…`;
  $('#workflow-phase').textContent = `${$(`[data-agent="${agent}"] h3`).textContent} is processing demo context`;
  const stageCopy = {inbox:'I’m reviewing the important messages…',calendar:'I’m checking the schedule and proposed change…',tasks:'I’m checking deadlines and priorities…',approvals:'I’m checking the work ready for your decision…',research:'I’m reviewing the local workspace notes…'}[agent];
  if (workflowMode === 'proactive') $('#monitoring-status').textContent=stageCopy; else $('#command-status').textContent=stageCopy;
  renderOperations();
}
function submitCommand(request) {
  if(responseEditorDraft){notify('Save or cancel the local action before starting another request.');focusResponseEditor();return;}
  request = request.trim();
  if (workflowMode === 'proactive') cancelProactive();
  if (processing) return;
  if (!request) { $('#command-status').textContent = 'Enter a request or choose a suggestion.'; $('#command-input').focus(); return; }
  ['workflow-title','workflow-phase'].forEach(id=>document.getElementById(id).setAttribute('aria-live','polite'));
  clearTimeout(monitorTimer); workflowMode = 'command';
  const route = routeCommand(request);
  responseEditorDraft=null;responseUndo=null;responseDisclosureOpen.clear();$('#response-feedback').hidden=true;
  responseCommandNotice=/\b(send|reschedule|move|share|delete|pay|book|cancel|assign|create|update|complete)\b/i.test(request)?'Typed commands do not execute actions. Review the prepared work below and use its explicit confirmation control.':'';
  responseRoute = route;
  const agents = ['briefing','changes','attention'].includes(route) ? ['inbox','calendar','tasks','approvals'] : ['unsupported','capabilities','handled'].includes(route) ? [] : [route];
  const names = agents.map(agent => $(`[data-agent="${agent}"] h3`).textContent).join(' → ') || 'Executive Assistant';
  const workflowNames = {handled:'Summarizing what I already handled',changes:'Reviewing what changed',attention:'Prioritizing what needs attention',capabilities:'Explaining what I can prepare',inbox:'Reviewing inbox',calendar:"Checking today's schedule",tasks:'Reviewing tasks and deadlines',approvals:'Checking pending approvals',research:'Preparing a workspace research brief',briefing:'Preparing daily briefing',unsupported:'Checking demo capabilities'};
  const completedSteps = {inbox:'Inbox Agent analyzed priority messages',calendar:'Calendar Agent checked schedule',tasks:'Task Agent reviewed deadlines',approvals:'Approval Agent checked pending decisions',research:'Research Agent summarized local context'};
  currentWorkflow = route; executionEvents = [];
  $('#command-input').value = request; $('#command-response').hidden = false; setBusy(true);
  $('#command-status').textContent = 'Orbit is processing your demo request…'; $('#command-route').textContent = 'Orbit → '+names+' → Orbit';
  $('#command-response-badge').textContent = 'PROCESSING'; $('#command-response-text').textContent = 'Orbit is coordinating the next steps. Follow the live execution in AI Operations.';
  $('#command-request-label').textContent = `Your request: ${request}`;
  $('#workflow-title').textContent = workflowNames[route]; $('#workflow-badge').textContent = 'PROCESSING'; $('#execution-note').textContent = 'Current request · Eastern time';
  $('#operations').classList.add('command-processing'); commandHub.classList.add('orchestrating');
  executionStep('Request received by Executive Assistant'); animateStatus($('#command-response'));
  const generation = ++commandGeneration;
  let index = 0;
  const complete = () => {
    if (generation !== commandGeneration) return;
    executionStep(route === 'briefing' ? 'Briefing ready' : route === 'unsupported' ? 'Demo capabilities explained' : 'Response ready');
    clearHighlights(); setBusy(false); workflowMode = null; currentWorkflow = null;
    $('#workflow-title').textContent = 'Orbit is monitoring your workspace'; $('#workflow-phase').textContent = 'Request complete · All specialists idle or monitoring'; $('#workflow-badge').textContent = 'IDLE'; $('#execution-note').textContent = 'Last completed request · Eastern time';
    $('#command-response-text').textContent = workspaceResponse(route); $('#command-response-badge').textContent = route === 'unsupported' ? 'DEMO CAPABILITIES' : 'DEMO RESPONSE';
    $('#command-status').textContent = route === 'unsupported' ? 'Try a supported demo request' : 'Request complete · Fictional data only';
    const actions = {handled:'summarized the work already handled',changes:'summarized what changed',attention:'prioritized what needs your attention',capabilities:'explained what Orbit can prepare',inbox:'reviewed your inbox',calendar:'checked your schedule and conflicts',tasks:'reviewed your due tasks',approvals:'reviewed your pending approvals',research:'prepared a workspace research brief',briefing:'generated your daily briefing',unsupported:'explained the demo capabilities'};
    logActivity('command',`Executive Assistant ${actions[route]}`,`${names} · Simulated request completed`,route);
    saveState(); render(true); animateStatus($('#command-response'));
    if (!storageAvailable) notify('Request complete. Browser storage is unavailable; activity will last for this session only.');
    $('#command-input').focus({preventScroll:true});
    scheduleMonitoring(5000);
  };
  const next = () => {
    if (generation !== commandGeneration) return;
    if (index === agents.length) {
      specialistCards.forEach(card => card.classList.remove('agent-working'));
      if (agents.length) executionStep('Results returned to Executive Assistant');
      else executionStep('Executive Assistant checked supported capabilities');
      hubStatus.lastChild.textContent = agents.length ? 'Combining specialist results…' : 'Preparing capability guidance…';
      $('#workflow-badge').textContent = 'SYNTHESIZING'; $('#workflow-phase').textContent = agents.length ? 'Specialist results returned · Orbit is preparing the response' : 'Orbit is explaining the supported demo workflows'; renderOperations();
      commandTimer = setTimeout(complete,350); return;
    }
    const agent = agents[index++]; activateAgent(agent);
    commandTimer = setTimeout(() => {
      if (generation !== commandGeneration) return;
      const card = $(`[data-agent="${agent}"]`); card.classList.remove('agent-working'); card.classList.add('agent-processed');
      const path = $$('.connector-pulse')[specialistCards.indexOf(card)]; path.classList.remove('route-active'); path.classList.add('route-return');
      agentLastChecked.set(agent,Date.now()); executionStep(completedSteps[agent]); renderOperations(); next();
    },550);
  };
  next();
}
$('#command-form').addEventListener('submit',event => { event.preventDefault(); submitCommand($('#command-input').value); });
$$('[data-command]').forEach(button => button.addEventListener('click',() => submitCommand(button.dataset.command)));
$('#execution-toggle').addEventListener('click',()=>{const expanded=$('#operations').classList.toggle('execution-expanded');$('#execution-toggle').setAttribute('aria-expanded',String(expanded));$('#execution-toggle').textContent=expanded?'Show less':'Show full timeline';});
function resetCommand() {
  clearTimeout(monitorTimer); workflowMode = null;
  $('#completed-actions').open=false;
  $('#operations').classList.remove('execution-expanded'); $('#execution-toggle').setAttribute('aria-expanded','false'); $('#execution-toggle').textContent='Show full timeline';
  clearTimeout(commandTimer); commandGeneration++; responseRoute = null;responseCommandNotice='';responseEditorDraft=null;responseUndo=null;responseDisclosureOpen.clear();$('#response-feedback').hidden=true; currentWorkflow = null; executionEvents = []; agentLastChecked.clear(); clearHighlights(); setBusy(false); renderExecution();
  $('#workflow-title').textContent = 'Orbit is monitoring your workspace'; $('#workflow-phase').textContent = 'All specialists idle or monitoring'; $('#workflow-badge').textContent = 'IDLE'; $('#execution-note').textContent = 'Waiting for a demo command';
  $('#command-input').value = ''; $('#command-response').hidden = true; $('#command-response-text').textContent = ''; $('#command-response-actions').replaceChildren(); $('#command-status').textContent = 'I’m ready when you are';
}
function syncMotion() {
  const paused = reducedMotion.matches || (state.motionPaused ?? false);
  document.body.classList.toggle('motion-paused',paused);
  $('#motion-toggle').setAttribute('aria-pressed',String(paused));
  $('#motion-toggle').disabled = reducedMotion.matches;
  $('#motion-toggle').textContent = paused ? 'Motion off' : 'Motion on';
  $('#motion-toggle').setAttribute('aria-label',reducedMotion.matches ? 'Animations disabled by your reduced-motion preference' : paused ? 'Enable visual animations' : 'Pause visual animations');
  $('#motion-toggle').title = reducedMotion.matches ? 'Respecting your system reduced-motion setting' : 'Toggle decorative animations';
}
$('#motion-toggle').addEventListener('click',() => { state.motionPaused = !document.body.classList.contains('motion-paused'); syncMotion(); saveState(); if (!storageAvailable) notify('Motion changed for this session. Browser storage is unavailable.'); });
reducedMotion.addEventListener('change',syncMotion);
$('#reset-demo').addEventListener('click',() => {
  resetCommand(); meetingReviewReturn=null;if(meetingDialog.open)meetingDialog.close();if(taskListDialog.open)taskListDialog.close();if(messageDialog.open)messageDialog.close(); if (dialog.open) dialog.close(); selectedCard = null; workspaceStates = OrbitWorkspacePolicy.reset(workspaceStates,activeWorkspace,freshState); state = workspaceStates[activeWorkspace];
  try { saveState(); }
  catch { storageAvailable = false; }
  syncMotion(); render(true); scheduleMonitoring(1500); notify(currentContext.name+' reset. The other workspace and campaign history are unchanged.' + (storageAvailable ? '' : ' Browser storage is unavailable.'));
});
$$('.nav-link').forEach(link => link.addEventListener('click',() => {
  $$('.nav-link').forEach(item => { item.classList.remove('active'); item.removeAttribute('aria-current'); });
  link.classList.add('active'); link.setAttribute('aria-current','location');
}));

// Both contexts reuse the same DOM and interactions; their mutable state never overlaps.
const WORKSPACE_KEY = 'orbit.executive-assistant.workspaces.v1';
let activeWorkspace = 'personal';
let workspaceStates = {personal:freshState(),work:freshState()};
const workProfiles = JSON.parse(JSON.stringify(actionProfiles));
const workDetails = {...approvalDetails};
const snapshotSelectors = ['.greeting p','.greeting .eyebrow','.breadcrumb','.briefing strong','.stat-card[href="#inbox"] .stat-pill','.stat-card[href="#inbox"] > p','.stat-card[href="#calendar"] .stat-top > span','.stat-subvalue','.schedule-overview','.timeline','.research-notes','#email-review .prepared-reason p','#calendar-review .action-facts','#calendar-editor .field-help','#document-review .action-facts'];
const workMarkup = new Map(snapshotSelectors.map(selector => [selector,$(selector).innerHTML]));
const workInbox = $$('.email-row').map(row => ({avatar:row.querySelector('.avatar').textContent,sender:row.querySelector('strong').textContent,title:row.querySelector('h3').textContent,body:row.querySelector('p').textContent,tags:row.querySelector('.email-tags').innerHTML}));
const workTasks = taskCards.map(card => ({id:card.dataset.task,due:card.dataset.due,html:card.querySelector('input + span').innerHTML,tag:card.querySelector('.tag').textContent}));
const workApprovals = approvalCards.map(card => ({title:card.querySelector('h3').textContent,description:card.querySelector('p').textContent}));
const contexts = {
  work:{name:'Work Workspace',unread:12,meetings:4,nextMeeting:'9:30 AM',focus:'2 hours',priorCompleted:3,meetingName:'Investor check-in',meetingDescription:"Reschedule Friday's call to 10:30 AM to resolve a calendar conflict.",attendees:'Dave and Morgan Ellis',documentTitle:'Weekly executive digest',recipients:'Leadership team',conflictStart:'2026-10-09T11:00',conflictEnd:'2026-10-09T12:00',conflictLabel:'the finance review (October 9, 11:00 AM–12:00 PM Eastern)',inboxFinding:"Sarah Mitchell's partnership proposal needs attention before Friday.",inboxSecondary:"Daniel Kim's board materials are ready for tomorrow.",calendarNoun:'meetings',calendarFinding:"Friday's investor check-in conflicts with the finance review. A 10:30 AM alternative is ready for your review."},
  personal:{name:'Personal Workspace',unread:8,meetings:3,nextMeeting:'10:00 AM',focus:'90 minutes',priorCompleted:1,meetingName:'Home maintenance visit',meetingDescription:'Move Friday’s maintenance visit to 9:00 AM to avoid your appointment.',attendees:'Dave and Casey Reed',documentTitle:'Family weekend plan',recipients:'Alex Rivera and Jamie Chen',conflictStart:'2026-10-09T10:00',conflictEnd:'2026-10-09T11:00',conflictLabel:'your appointment (October 9, 10:00–11:00 AM Eastern)',inboxFinding:"Alex Rivera's family lunch invitation needs a reply by tonight.",inboxSecondary:'A fictional utility bill reminder is due Friday.',calendarNoun:'personal events',calendarFinding:'Friday’s home maintenance visit overlaps your appointment. A 9:00 AM alternative is prepared for review.'}
};
let currentContext = contexts.personal;
const personalInbox = [
  {avatar:'AR',sender:'Alex Rivera',title:'Family lunch — can you confirm Saturday?',body:'Let’s meet at noon. Can you bring something for the table?',tags:['● High priority','Draft reply ready']},
  {avatar:'HC',sender:'Harbor Care Desk',title:'Appointment reminder for Friday',body:'Your fictional appointment is at 10:00 AM. Please arrive 10 minutes early.',tags:['● High priority','Appointment reminder']},
  {avatar:'HU',sender:'Harbor Utilities',title:'Monthly bill reminder',body:'Your demo household bill is due Friday. No payment is connected.',tags:['Bill reminder']},
  {avatar:'JC',sender:'Jamie Chen',title:'Weekend errands and grocery list',body:'I added a few pantry items to our fictional weekend plan.',tags:['Family scheduling']}
];
const personalTasks = [
  ['groceries','today','Pick up groceries','Errands · Due today','30 min'],['family-reply','today','Respond to Saturday’s family lunch invitation','Family · Due today','High priority'],['bill','friday','Review the utility bill reminder','Household · Due Friday','10 min'],['appointment','friday','Prepare for Friday’s appointment','Personal · Due Friday','15 min'],['library','tomorrow','Return library books','Errands · Due tomorrow','20 min'],['weekend','next-week','Plan next week’s household errands','Home · Due next week','15 min']
];
function refreshDemoData() {
  Object.assign(demo,{...currentContext,priority:$$('.email-tags .urgent').length,sender:$('.email-meta strong').textContent,tasks:taskCards.map(card => ({id:card.dataset.task,title:card.querySelector('input + span').firstChild.textContent.trim(),due:card.dataset.due})),research:$$('.research-notes article').slice(0,2).map(card => ({title:card.querySelector('h3').textContent,text:card.querySelector('p').textContent}))});
  $('#unread-count').textContent = demo.unread; $('#meeting-count').textContent = demo.meetings;
  $('.stat-card[href="#calendar"] p strong').textContent = demo.nextMeeting;
}
function applyWorkspace(id) {
  activeWorkspace = id; currentContext = contexts[id]; document.body.dataset.context = id;
  snapshotSelectors.forEach(selector => { $(selector).innerHTML = workMarkup.get(selector); });
  Object.assign(actionProfiles,JSON.parse(JSON.stringify(workProfiles))); Object.assign(approvalDetails,workDetails);
  $$('.email-row').forEach((row,i) => {
    const item = workInbox[i]; row.querySelector('.avatar').textContent=item.avatar; row.querySelector('strong').textContent=item.sender; row.querySelector('h3').textContent=item.title; row.querySelector('p').textContent=item.body; row.querySelector('.email-tags').innerHTML=item.tags;
  });
  taskCards.forEach((card,i) => { const item=workTasks[i];card.dataset.task=item.id;card.dataset.due=item.due;card.querySelector('input + span').innerHTML=item.html;card.querySelector('.tag').textContent=item.tag;card.querySelector('.tag').classList.toggle('urgent',item.tag==='High priority'); });
  approvalCards.forEach((card,i) => { card.querySelector('h3').textContent=workApprovals[i].title;card.querySelector('p').textContent=workApprovals[i].description; });
  if (id === 'personal') {
    $('.greeting p').textContent='Your personal day, thoughtfully organized. Make time for life beyond work.';
    $('.greeting .eyebrow').textContent='YOUR PERSONAL DAY, ORCHESTRATED';
    $('.briefing strong').textContent='A little headspace for everyday life.';
    $$('.email-row').forEach((row,i) => { const item=personalInbox[i];row.querySelector('.avatar').textContent=item.avatar;row.querySelector('strong').textContent=item.sender;row.querySelector('h3').textContent=item.title;row.querySelector('p').textContent=item.body;const tags=row.querySelector('.email-tags');tags.replaceChildren();item.tags.forEach((text,j) => {const tag=document.createElement('span');tag.className='tag'+(i<2 && j===0?' urgent':'');tag.textContent=text;tags.append(tag);}); });
    taskCards.forEach((card,i) => {const [taskId,due,title,detail,tag]=personalTasks[i];card.dataset.task=taskId;card.dataset.due=due;const label=card.querySelector('input + span');label.textContent=title;const small=document.createElement('small');small.textContent=detail;label.append(small);card.querySelector('.tag').textContent=tag;card.querySelector('.tag').classList.toggle('urgent',tag==='High priority');});
    $('.stat-card[href="#inbox"] > p').textContent='Personal reminders, prioritized';
    $('.stat-card[href="#calendar"] .stat-top > span').textContent="Today's personal events";
    $('.stat-subvalue').textContent='1h 45m';
    $('.schedule-overview').innerHTML='<span><i class="online-dot"></i> 3 personal events</span><span>90 min of focus time protected</span>';
    $('.timeline').innerHTML='<div class="meeting"><time>10:00<span>10:30</span></time><div class="meeting-card mint-meeting"><span class="meeting-type">PERSONAL</span><h3>Appointment preparation call</h3><p>30 min · Fictional phone call</p></div></div><div class="meeting"><time>12:30<span>13:00</span></time><div class="meeting-card"><span class="meeting-type">FAMILY</span><h3>Weekend planning with Alex</h3><p>30 min · Demo video call</p></div></div><div class="focus-block"><time>13:00</time><span>⌁ &nbsp; Personal focus <small>90 minutes · No interruptions</small></span></div><div class="meeting"><time>17:00<span>17:45</span></time><div class="meeting-card"><span class="meeting-type">HOME</span><h3>Grocery and errand planning</h3><p>45 min · At home</p></div></div>';
    const titles=['Reply to Alex’s family lunch invitation','Move your home maintenance visit','Share the family weekend plan'];
    const descriptions=['Confirm Saturday’s lunch and offer to bring groceries.',currentContext.meetingDescription,'A short plan for family lunch, errands, and household reminders.'];
    approvalCards.forEach((card,i)=>{card.querySelector('h3').textContent=titles[i];card.querySelector('p').textContent=descriptions[i];});
    approvalDetails.reply='Hi Alex,\n\nSaturday at noon works for me. I can bring groceries and a salad. Looking forward to catching up!\n\nBest,\nDave';
    approvalDetails.report='Family weekend plan\n\nSaturday: Family lunch at noon with Alex and Jamie. Dave brings groceries and a salad.\n\nErrands: Return library books and collect pantry essentials.\n\nReminders: Review the fictional utility bill before Friday.\n\nAll names and plans are fictional demo data.';
    actionProfiles.reply.title='Send the family lunch reply'; actionProfiles.reply.defaultPayload={to:'alex.rivera@family.example',subject:'Re: Saturday family lunch',body:approvalDetails.reply};
    actionProfiles.meeting.title='Reschedule the home maintenance visit';actionProfiles.meeting.defaultPayload={start:'2026-10-09T09:00',end:'2026-10-09T09:30',notify:true};
    actionProfiles.report.title='Share the family weekend plan';actionProfiles.report.defaultPayload={message:'Here is our fictional weekend plan, including lunch and errands.'};
    $('#email-review .prepared-reason p').textContent='Alex requested a reply by tonight. Orbit prepared a draft confirming lunch and offering to bring groceries.';
    const facts=$$('#calendar-review .action-facts dd');['Friday, October 9, 2026 · 10:00–10:30 AM Eastern','',currentContext.attendees,'Keep your appointment clear and retain a convenient maintenance slot.','Friday’s appointment is 10:00–11:00 AM Eastern, overlapping the original maintenance visit.'].forEach((text,i)=>facts[i].textContent=text);
    $('#calendar-editor .field-help').textContent='All proposed times are Eastern. Choose an end after the start and avoid the flagged appointment.';
    const docs=$$('#document-review .action-facts dd');docs[0].textContent=currentContext.documentTitle;docs[1].textContent=currentContext.recipients+' (fictional demo recipients)';
    const notes=$$('.research-notes article');notes[0].querySelector('.operations-label').textContent='FAMILY CONTEXT';notes[0].querySelector('h3').textContent='Saturday family lunch';notes[0].querySelector('p').textContent='Alex is planning lunch at noon. Confirm attendance and coordinate groceries with Jamie.';notes[1].querySelector('.operations-label').textContent='HOUSEHOLD CONTEXT';notes[1].querySelector('h3').textContent='Appointments and errands';notes[1].querySelector('p').textContent='Avoid the Friday appointment when moving the maintenance visit. Group grocery pickup and library returns into one trip.';
  } else { $('.greeting p').textContent='Your workday, in focus. Keep projects, clients, and team decisions moving.'; }
  $('.breadcrumb').replaceChildren(document.createTextNode(currentContext.name+' / '),Object.assign(document.createElement('strong'),{textContent:'Overview'}));
  $('#command-help').textContent=currentContext.name+' · Fictional context only. No connected accounts.';
  $('#command-response-title').textContent='Executive Assistant · '+currentContext.name;
  $$('[data-workspace]').forEach(button=>{const active=button.dataset.workspace===id;button.setAttribute('aria-pressed',String(active));});
  refreshDemoData();
  window.dispatchEvent(new CustomEvent('orbit:workspace-changed',{detail:id}));
}
function loadState() {
  let raw;
  try {raw=localStorage.getItem(WORKSPACE_KEY);}catch {storageReadable=false;storageAvailable=false;stateNotice='Browser storage is blocked. Changes work for this session only.';applyWorkspace('personal');state=workspaceStates.personal;return;}
  try {
    if(raw){if(raw.length>MAX_STORED_STATE_LENGTH)throw Error('Saved data exceeds demo limits');const saved=JSON.parse(raw);if(saved?.version!==1 || !saved.contexts || typeof saved.contexts!=='object')throw Error('Invalid workspace data');workspaceStates={personal:freshState(),work:freshState()};let recovered=false;for(const id of ['personal','work']){applyWorkspace(id);try{workspaceStates[id]=normalizeState(saved.contexts[id]);}catch{recovered=true;}}applyWorkspace(saved.selected==='work'?'work':'personal');state=workspaceStates[activeWorkspace];if(recovered)stateNotice='An invalid workspace was reset. Valid workspace data was retained.';return;}
    applyWorkspace('work');loadLegacyState();workspaceStates.work=state;applyWorkspace('personal');state=workspaceStates.personal;saveState();
  } catch {workspaceStates={personal:freshState(),work:freshState()};applyWorkspace('personal');state=workspaceStates.personal;stateNotice='Saved browser data was invalid. A fresh demo is ready; new saves replace the invalid data.';}
}
$$('[data-workspace]').forEach(button=>button.addEventListener('click',()=>{
  const id=button.dataset.workspace;if(id===activeWorkspace)return;
  workspaceStates[activeWorkspace]=state;
  resetCommand();meetingReviewReturn=null;if(meetingDialog.open)meetingDialog.close();if(taskListDialog.open)taskListDialog.close();if(messageDialog.open)messageDialog.close();if(dialog.open)dialog.close();selectedCard=null;reviewOrigin=null;
  applyWorkspace(id);try{state=normalizeState(workspaceStates[id] || freshState());}catch{state=freshState();}workspaceStates[id]=state;
  restoreTimedItems();syncMotion();render(true);saveState();scheduleMonitoring(1500);notify(currentContext.name+' active · Fictional demo data only.'+(storageAvailable?'':' Browser storage unavailable; session only.'));
}));

// V1.4 document delivery records are local demo payloads, not provider connections.
const SHARE_DELIVERY={'cloud-link':'Email with cloud link',attachment:'Email attachment','copy-link':'Copy share link'};
const SHARE_ACCESS={view:'View only',comment:'Can comment',edit:'Can edit'};
const SHARE_DOCUMENTS={
  personal:{fileName:'Family_Weekend_Plan.pdf',documentTitle:'Family Weekend Plan',recipients:[{name:'Alex Rivera',email:'alex.rivera@family.example'},{name:'Jamie Chen',email:'jamie.chen@family.example'}],reason:'Jamie asked for the weekend plan, so I prepared the document, selected Alex and Jamie, and drafted a short message.'},
  work:{fileName:'Weekly_Executive_Digest.pdf',documentTitle:'Weekly Executive Digest',recipients:[{name:'Morgan Ellis',email:'morgan.ellis@leadership.example'},{name:'Daniel Kim',email:'daniel.kim@leadership.example'}],reason:'The leadership team needs the weekly update, so I prepared the digest, selected Morgan and Daniel, and drafted the delivery message.'}
};
function shareDefaults(){const doc=SHARE_DOCUMENTS[activeWorkspace];return {fileName:doc.fileName,documentTitle:doc.documentTitle,type:'PDF',source:'Orbit Demo Drive',recipients:doc.recipients.map(r=>({...r})),delivery:'cloud-link',access:'view',message:actionProfiles.report.defaultPayload.message,contextRecorded:true};}
function normalizeSharePayload(payload){
  if(!payload || typeof payload.message!=='string' || payload.message.length>2000)return null;
  const defaults=shareDefaults();
  if(payload.delivery!==undefined && !Object.hasOwn(SHARE_DELIVERY,payload.delivery))return null;
  if(payload.access!==undefined && !Object.hasOwn(SHARE_ACCESS,payload.access))return null;
  // Recipient editing is outside this demo scope; only this workspace's prepared recipients are valid.
  if(payload.recipients!==undefined && (!Array.isArray(payload.recipients) || payload.recipients.length!==defaults.recipients.length || !payload.recipients.every((r,i)=>r?.name===defaults.recipients[i].name && r?.email===defaults.recipients[i].email)))return null;
  return {...defaults,delivery:payload.delivery || defaults.delivery,access:payload.access || defaults.access,message:payload.message,contextRecorded:payload.contextRecorded===false?false:payload.delivery!==undefined && payload.access!==undefined};
}
function shareHistoryText(execution){
  const payload=execution.payload,time=new Date(execution.at).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:'America/New_York'});
  return `Shared ${time} Eastern · ${payload.contextRecorded?payload.recipients.map(r=>r.name).join(', ')+' · '+SHARE_DELIVERY[payload.delivery]+' · '+SHARE_ACCESS[payload.access]:'Recipients/delivery/access not recorded in earlier demo'} · Demo simulation`;
}
function renderShareCard(){
  const card=approvalCards.find(c=>c.dataset.approval==='report'),execution=state.executions.report,payload=execution?.payload || state.drafts.report || shareDefaults();
  card.querySelector('p').textContent='Prepared by Orbit: the document and recipients are ready.';
  card.querySelector('.approve-button').textContent=execution?'Shared':'Review & Share';
  let context=card.querySelector('.share-card-context');if(!context){context=document.createElement('div');context.className='share-card-context';card.querySelector('.approval-actions').before(context);}context.replaceChildren();
  for(const [label,value] of [['Delivery',execution && !payload.contextRecorded?'Not recorded · Earlier demo':SHARE_DELIVERY[payload.delivery]],['Recipients',execution && !payload.contextRecorded?'Not recorded · Earlier demo':payload.recipients.map(r=>r.name).join(', ')],['Access',execution && !payload.contextRecorded?'Not recorded · Earlier demo':SHARE_ACCESS[payload.access]]]){const line=document.createElement('div'),name=document.createElement('span');name.textContent=label;line.append(name,document.createTextNode(value));context.append(line);}
  let history=card.querySelector('.share-card-history');if(!history){history=document.createElement('div');history.className='share-card-history';card.append(history);}history.hidden=!execution;history.textContent=execution?shareHistoryText(execution):'';
}
function populateShareReview(payload){
  $('#share-file-name').textContent=payload.fileName;$('#share-document-title').textContent=payload.documentTitle;$('#share-recipient-names').textContent=state.executions.report && !payload.contextRecorded?'Not recorded in earlier demo':payload.recipients.map(r=>r.name).join(', ');$('#share-reason').textContent=SHARE_DOCUMENTS[activeWorkspace].reason;
  $('#document-review .share-selectors').hidden=Boolean(state.executions.report && !payload.contextRecorded);
  $('#share-access-help').textContent=state.executions.report && !payload.contextRecorded?'This earlier demo did not record an access selection.':'In this simulation, recipients receive only the access level you select. No real permissions change.';
  $('#document-preview').textContent=approvalDetails.report;$('#document-message').value=payload.message;$('#share-delivery').value=payload.delivery;$('#share-access').value=payload.access;
  const recipients=$('#share-recipients');recipients.hidden=Boolean(state.executions.report && !payload.contextRecorded);recipients.replaceChildren();for(const recipient of payload.recipients){const line=document.createElement('div');line.className='share-recipient';line.textContent=recipient.name;const address=document.createElement('small');address.textContent=recipient.email;line.append(address);recipients.append(line);}
  renderShareSummary();
}
function renderShareSummary(){
  if(selectedCard?.dataset.approval!=='report')return;
  const execution=state.executions.report,payload=execution?.payload || currentPayload();
  $('#share-summary-what').textContent=payload.fileName;$('#share-summary-who').textContent=execution && !payload.contextRecorded?'Not recorded in earlier demo':payload.recipients.map(r=>r.name).join(', ');
  $('#share-summary-how').textContent=execution && !payload.contextRecorded?'Not recorded in earlier demo':SHARE_DELIVERY[payload.delivery];$('#share-summary-access').textContent=execution && !payload.contextRecorded?'Not recorded in earlier demo':SHARE_ACCESS[payload.access];
  $('#share-summary-message').textContent=payload.message || 'No accompanying message';
  $('#share-delivery-note').textContent=execution && !payload.contextRecorded?'This earlier share recorded the message only. File metadata is the current demo template; recipients, delivery and access were not recorded.':payload.delivery==='copy-link'?'This mode records a simulated copy-link action. Nothing is placed on your clipboard and no cloud link is generated. The accompanying message is retained as context; no recipients are emailed.':payload.delivery==='attachment'?'The PDF and message would be emailed to the listed recipients. Access is recorded as intended permission; an email attachment cannot enforce cloud access restrictions. No real attachment is sent.':'The listed recipients would receive an email containing a cloud link and your message, with the selected access. No real link is generated or email sent.';
  $('#share-review-history').hidden=!execution;$('#share-review-history').textContent=execution?shareHistoryText(execution):'';
}
['share-delivery','share-access','document-message'].forEach(id=>document.getElementById(id).addEventListener(id==='document-message'?'input':'change',renderShareSummary));

// V1.3: message state is additive and isolated inside each workspace model.
const messageDialog = $('#message-dialog');
messageDialog.addEventListener('keydown',containDialogFocus);
$('#reply-body').maxLength=MAX_REPLY_LENGTH;$('#email-body').maxLength=MAX_REPLY_LENGTH;
let selectedMessage = null, messageOrigin = null, messageWorkspace = null;
const MESSAGE_STATUSES=['New','Important','Draft Ready','Draft Saved','Replied','Handled','Snoozed','Reminder Created'];
function normalizeMessages(saved){
  const output={};
  for(let i=0;i<4;i++){
    const value=saved?.[i];if(!value || typeof value!=='object')continue;
    const record={read:value.read===true};
    if(MESSAGE_STATUSES.includes(value.status))record.status=value.status;
    if(typeof value.draft==='string')record.draft=value.draft.slice(0,MAX_REPLY_LENGTH);
    record.replySettings=cleanReplySettings(value.replySettings);record.draftHistory=cleanDraftHistory(value.draftHistory);record.draftVariant=Number.isInteger(value.draftVariant)?Math.max(0,value.draftVariant):0;
    if(typeof value.replyBrief==='string')record.replyBrief=value.replyBrief.slice(0,4000);
    if(validDate(value.snoozeUntil))record.snoozeUntil=value.snoozeUntil;
    if(typeof value.handledLinkedTaskWasDone==='boolean')record.handledLinkedTaskWasDone=value.handledLinkedTaskWasDone;
    if(value.handledLinkedTaskChanged===true)record.handledLinkedTaskChanged=true;
    if(typeof value.sentBody==='string')record.sentBody=value.sentBody.slice(0,MAX_REPLY_LENGTH);
    record.artifacts=Array.isArray(value.artifacts)?value.artifacts.filter(a=>a && ['calendar','reminder','task','followup'].includes(a.kind) && typeof a.title==='string' && validDate(a.at)).slice(0,4).map(a=>({kind:a.kind,title:a.title.slice(0,300),at:a.at,done:a.done===true,owner:typeof a.owner==='string'?a.owner.slice(0,100):'Dave',...(typeof a.dueDate==='string' && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate)?{dueDate:a.dueDate}:{}),...(validDate(a.remindAt)?{remindAt:a.remindAt}:{}),...(validDate(a.notifiedAt)?{notifiedAt:a.notifiedAt}:{})})):[];
    output[i]=record;
  }return output;
}
function messageRecord(i){return state.messages?.[i] || {};}
function messageResolved(){return Boolean(state.executions.reply) || ['Handled','Replied','Snoozed'].includes(messageRecord(0).status);}
function messageData(i){return structuredClone(OrbitReplyFixtures[activeWorkspace][i]);}
const replyExecutors=new Map();
function replyContext(i){return {workspace:{id:activeWorkspace},actor:{id:'demo-dave'},messageId:`${activeWorkspace}-message-${i}`};}
function replyService(){const ws=activeWorkspace;if(!replyExecutors.has(ws))replyExecutors.set(ws,OrbitReplyCore.demoExecutor());return OrbitReplyBrowserAdapter.create({workspaceId:ws,executor:replyExecutors.get(ws),read:()=>workspaceStates[ws].replyCore,write:next=>{workspaceStates[ws].replyCore=next;if(ws===activeWorkspace)state.replyCore=next;saveState();return {durable:storageAvailable&&!guidedSession};}});}
function replyServiceError(result){if(result.ok)return false;$('#reply-validation').hidden=false;$('#reply-validation').textContent=result.error.code+': '+result.error.message;return true;}
function syncReplyVersion(i,input,label='Saved draft'){
 const service=replyService(),context=replyContext(i);let history=service.getReplyHistory(context);if(replyServiceError(history))return null;
 if(!history.value.draft){const record=messageRecord(i),data=messageData(i);const versions=record.draftHistory || [];
  let created=service.createReplyDraft({...context,body:versions[0]?.body || record.draft || (i===0?state.drafts.reply?.body:null) || input.body || data.draft,brief:versions[0]?.brief ?? (record.draft!==undefined?record.replyBrief:input.brief) ?? data.summary,settings:versions[0]?.settings || (record.draft!==undefined?record.replySettings:input.settings) || cleanReplySettings({})});if(replyServiceError(created))return null;
  for(const version of versions.slice(1)){const saved=service.saveReplyDraftVersion({...context,draftId:created.value.draft.id,expectedRevision:created.value.draft.currentRevision,...version});if(replyServiceError(saved))return null;created=saved;}
  history=service.getReplyHistory(context);
 }
 const result=service.saveReplyDraftVersion({...context,draftId:history.value.draft.id,expectedRevision:history.value.draft.currentRevision,...input});if(replyServiceError(result))return null;
 projectReplyDraft(i,result.value.version,label);return result.value;
}
function projectReplyDraft(i,version,label){const record=state.messages[i] ||= {};record.draft=version.body;record.replyBrief=version.brief;record.replySettings=version.settings;record.status='Draft Saved';const history=replyService().getReplyHistory(replyContext(i));record.draftHistory=history.value.versions.slice(-20).map(v=>({body:v.body,brief:v.brief,to:v.to,subject:v.subject,settings:v.settings,at:v.createdAt,label:v.id===version.id?label:'Saved version '+v.revision,versionId:v.id,revision:v.revision}));if(i===0)state.drafts.reply={to:version.to,subject:version.subject,body:version.body};}
function messageStatus(i){return i===0 && state.executions.reply?'Replied':messageRecord(i).status || (i===0?'Draft Ready':i===1?'Important':'New');}
function renderInbox(){
  state.messages ||= {};
  // Reconcile an authoritative receipt if refresh interrupted the legacy UI projection.
  if(state.replyCore!==undefined){try{
    const core=OrbitReplyCore.validateStore(state.replyCore);
    for(const execution of core.executions){
      if(execution.workspaceId!==activeWorkspace || execution.actorId!=='demo-dave')continue;
      const i=OrbitReplyFixtures[activeWorkspace].findIndex(m=>m.id===execution.messageId);if(i<0)continue;
      const record=state.messages[i] ||= {};record.status='Replied';record.sentBody=execution.payload.body;delete record.draft;
      if(i===0){state.executions.reply={status:'Sent',at:execution.at,payload:structuredClone(execution.payload)};delete state.drafts.reply;state.approvals=Object.keys(state.executions);}
    }
  }catch{/* Retain invalid snapshots for the service to report; never replace them. */}}
  $$('.email-row').forEach((row,i)=>{
    row.dataset.message=i;row.tabIndex=-1;row.setAttribute('role','group');row.removeAttribute('aria-haspopup');row.setAttribute('aria-label',`Message from ${row.querySelector('strong').textContent}: ${row.querySelector('h3').textContent}`);
    let status=row.querySelector('.message-state-tag');if(!status){status=document.createElement('span');status.className='tag message-state-tag';row.querySelector('.email-tags').append(status);}status.textContent=messageStatus(i);
    const dot=row.querySelector('.unread-dot');if(dot)dot.hidden=Boolean(messageRecord(i).read || ['Replied','Handled','Snoozed'].includes(messageStatus(i)));
    let actions=row.querySelector('.message-row-actions');if(!actions){actions=document.createElement('div');actions.className='message-row-actions';row.querySelector('.email-body').append(actions);for(const [text,compose] of [['Open Message',false],['Reply',true]]){const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-haspopup','dialog');b.addEventListener('click',e=>{e.stopPropagation();openMessage(i,b,compose);});actions.append(b);}}
    actions.querySelector('button:last-child').disabled=['Replied','Handled','Snoozed'].includes(messageStatus(i));
    actions.querySelector('button:last-child').hidden=activeWorkspace==='personal' && [1,2].includes(i);
  });
  const readCount=[0,1,2,3].filter(i=>messageRecord(i).read || ['Replied','Handled','Snoozed'].includes(messageStatus(i))).length;
  demo.unread=currentContext.unread-readCount;
  demo.priority=[0,1].filter(i=>!['Replied','Handled','Snoozed'].includes(messageStatus(i))).length;
  $('#unread-count').textContent=demo.unread;
  demo.meetings=currentContext.meetings;$('#meeting-count').textContent=demo.meetings;
  renderMessageDestinations();
  let artifacts=$('#inbox-local-items');if(!artifacts){artifacts=document.createElement('div');artifacts.id='inbox-local-items';artifacts.className='inbox-local-items';$('.inbox-panel .panel-footer').before(artifacts);}artifacts.replaceChildren();
  for(const [i,record] of Object.entries(state.messages))for(const item of record.artifacts || []){
    const card=document.createElement('div');card.className='inbox-local-item';card.textContent=`${{calendar:'Calendar entry',reminder:'Reminder',task:'Task',followup:'Follow-up'}[item.kind]} · ${item.title}`;const small=document.createElement('small');small.textContent=`Owner: ${item.owner || 'Dave'}${item.dueDate?' · Due '+item.dueDate:''}${item.remindAt?' · '+(item.notifiedAt && !item.done?'Reminder due: ':'Reminder ')+localTime(item.remindAt):''} · Local demo only`;card.append(small);artifacts.append(card);
  }
  if(messageDialog.open && selectedMessage!==null){$('#message-state').textContent=messageStatus(selectedMessage);renderMessageArtifacts();
    if(messageRecord(selectedMessage).draft!==undefined && !['Replied','Handled','Snoozed'].includes(messageStatus(selectedMessage)) && !$('#message-actions [data-edit-draft]')){const edit=document.createElement('button');edit.type='button';edit.dataset.editDraft='';edit.textContent='Edit Draft';edit.addEventListener('click',()=>composeReply(true));const existing=[...$('#message-actions').querySelectorAll('button')].find(b=>b.textContent==='Edit Draft');if(existing)existing.dataset.editDraft='';else $('#message-actions').append(edit);}
  }
}
function renderMessageDestinations(){
  for(const [selector,kinds] of [['#calendar',['calendar']],['#tasks',['task','followup','reminder']]]){
    let list=$(selector+' .message-destination');if(!list){list=document.createElement('div');list.className='message-destination inbox-local-items';$(selector).append(list);}list.replaceChildren();
    for(const [i,r] of Object.entries(state.messages))for(const item of r.artifacts || [])if(kinds.includes(item.kind)){
      const card=document.createElement('div');card.className='inbox-local-item';const title=document.createElement('span');title.textContent=item.title;card.append(title);const meta=document.createElement('small');meta.textContent=`${item.kind} · Local demo only`;
      if(['task','followup','reminder'].includes(item.kind)){card.dataset.localTask=`message-${i}-${item.kind}`;const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=item.done;check.setAttribute('aria-label','Complete '+item.title);check.addEventListener('change',()=>{item.done=check.checked;logActivity('message',`${item.done?'Completed':'Reopened'}: ${item.title}`,'Local message action · Demo','tasks');commit('Local action updated');const match=[...list.querySelectorAll('input')].find(c=>c.getAttribute('aria-label')==='Complete '+item.title);match?.focus({preventScroll:true});});label.append(check,document.createTextNode(' Complete'));meta.append(label);const context=document.createElement('small');context.textContent=`Owner: ${item.owner || 'Dave'}${item.dueDate?' · Due '+item.dueDate:''}${item.remindAt?' · '+(item.notifiedAt && !item.done?'Reminder due: ':'Reminder ')+localTime(item.remindAt):''}`;meta.append(context);}
      card.append(meta);list.append(card);
    }
  }
}

function openMessage(i,origin,compose=false){
  if(workflowMode==='proactive')cancelProactive();clearTimeout(monitorTimer);
  selectedMessage=i;messageOrigin=origin;messageWorkspace=activeWorkspace;const data=messageData(i);
  state.messages ||= {};const record=state.messages[i] ||= {};record.read=true;saveState();render();
  $('#message-title').textContent=data.subject;$('#message-sender').textContent=`${data.sender} <${data.to}>`;$('#message-received').textContent=`${data.received} · Fictional October 7 scenario`;$('#message-priority').textContent=data.priority;
  $('#message-full-body').textContent=data.body;$('#message-summary').textContent=data.summary;$('#message-recommendation').textContent=data.recommendation;$('#message-feedback').textContent='';$('#message-action-editor').hidden=true;$('#reply-composer').hidden=true;$('#reply-validation').hidden=true;
  const actions=$('#message-actions');actions.replaceChildren();
  const terminal=['Replied','Handled','Snoozed'].includes(messageStatus(i));
  const add=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;if(text==='Edit Draft')b.dataset.editDraft='';b.addEventListener('click',fn);actions.append(b);};
  if(['Handled','Snoozed'].includes(messageStatus(i)))add(messageStatus(i)==='Handled'?'Reopen message':'Return to inbox',()=>{reopenMessage(i);openMessage(i,messageOrigin);});
  if(!terminal){if(!(activeWorkspace==='personal' && [1,2].includes(i))){add(record.draft!==undefined || i===0 && state.drafts.reply?'Edit Draft':'Review Orbit Draft',()=>composeReply(true));add('Generate AI reply',()=>{
  const button=$('#draft-ai-generate');
  if(!button || button.disabled){$('#message-feedback').textContent='Local AI is disabled or still checking its configuration. Review Orbit Draft is available now.';return;}
  composeReply(true);$('#draft-mode').value='local';$('#draft-generate').scrollIntoView({block:'center',behavior:reducedMotion.matches?'auto':'smooth'});$('#draft-generate').click();
});add('Write my own reply',()=>composeReply(false));}
    const kinds=activeWorkspace==='personal'?(i===2?[['Create Reminder','reminder']]:i===1?[['Add to Calendar','calendar'],['Create Reminder','reminder']]:[['Add to Calendar','calendar']]):[['Create Task','task'],['Add Follow-up','followup']];
    for(const [text,kind] of kinds){const existing=record.artifacts?.some(a=>a.kind===kind);add(existing && kind!=='calendar'?({task:'Edit Task',followup:'Edit Follow-up',reminder:'Edit Reminder'}[kind]):text,()=>kind==='calendar'?createMessageArtifact(kind):editLocalAction(kind));}
    if(activeWorkspace==='personal' && i===2)add('Snooze',()=>editLocalAction('snooze'));
    add('Mark Handled',()=>resolveMessage('Handled'));
  }
  $('#message-state').textContent=messageStatus(i);renderMessageArtifacts();if(!messageDialog.open)messageDialog.showModal();
  if(compose && !terminal)composeReply(true);
}
function composeReply(useDraft){
  $('#message-action-editor').hidden=true;
  const i=selectedMessage,data=messageData(i),record=messageRecord(i);$('#reply-composer').hidden=false;$('#reply-validation').hidden=true;
  $('#reply-to').value=data.to;$('#reply-subject').value='Re: '+data.subject;
  $('#reply-body').value=useDraft?(record.draft ?? (i===0?state.drafts.reply?.body:undefined) ?? data.draft):'';
  restoreReplySettings(record);$('#reply-body').focus();
}
function replyBody(){const body=$('#reply-body').value.trim();if(body.length>MAX_REPLY_LENGTH){$('#reply-validation').textContent='Keep the reply within 10,000 characters.';$('#reply-validation').hidden=false;$('#reply-body').focus();return null;}if(!body){$('#reply-validation').textContent='Write a reply before saving or sending.';$('#reply-validation').hidden=false;$('#reply-body').focus();return null;}$('#reply-validation').hidden=true;return body;}
function renderMessageArtifacts(){const target=$('#message-artifacts');target.replaceChildren();for(const item of messageRecord(selectedMessage).artifacts || []){const line=document.createElement('p');line.textContent=`${item.kind}: ${item.title} · Demo simulation`;target.append(line);}const body=messageRecord(selectedMessage).sentBody || (selectedMessage===0?state.executions.reply?.payload.body:null);if(body){const line=document.createElement('p');line.className='message-full-body';line.textContent='Sent reply (demo):\n'+body;target.append(line);}}
function createMessageArtifact(kind,metadata={}){
  const record=state.messages[selectedMessage] ||= {},data=messageData(selectedMessage);record.artifacts ||= [];
  const existing=record.artifacts.find(a=>a.kind===kind);
  if(existing){if(!Object.keys(metadata).length){$('#message-feedback').textContent='This local demo action is already recorded.';return;}
    if(metadata.remindAt!==existing.remindAt)delete existing.notifiedAt;Object.assign(existing,metadata);
    logActivity('message',`Updated ${kind}: ${existing.title}`,'Dave updated the local demo record · No external service changed','tasks');commit('Local action updated');openMessage(selectedMessage,messageOrigin);return;
  }
  const title=kind==='calendar'?(selectedMessage===1?'Appointment · Friday October 9 · 10:00–11:00 AM Eastern':'Family lunch · Saturday October 10 · Noon Eastern'):data.subject;
  record.artifacts.push({kind,title:metadata.title || title,at:new Date().toISOString(),done:false,...metadata});if(kind==='reminder')record.status='Reminder Created';
  logActivity('message',`${{calendar:'Calendar entry added',reminder:'Reminder created',task:'Task created',followup:'Follow-up added'}[kind]}: ${title}`,'Dave confirmed · Local demo simulation only','inbox');commit('Action created — demo simulation');$('#message-feedback').textContent='Created in this fictional workspace only. No external service was updated.';
}
function reopenMessage(i){
  if(!['Handled','Snoozed'].includes(messageStatus(i)))return false;
  const record=state.messages[i],wasHandled=record.status==='Handled';
  record.status=record.draft!==undefined || i===0 && state.drafts.reply?'Draft Saved':i===0?'Draft Ready':i===1?'Important':'New';record.read=false;delete record.snoozeUntil;
  if(wasHandled && i===0 && activeWorkspace==='personal' && record.handledLinkedTaskWasDone===false && !record.handledLinkedTaskChanged)state.tasks=state.tasks.filter(id=>id!=='family-reply');
  delete record.handledLinkedTaskWasDone;delete record.handledLinkedTaskChanged;responseUndo=null;
  logActivity('message',`Reopened: ${messageData(i).subject}`,'Dave restored a local message · Saved draft retained · No email sent','inbox');commit('Message reopened');return true;
}
function updateMessageDisposition(i,status){
  if(['Replied','Handled','Snoozed'].includes(messageStatus(i)))return false;
  const record=state.messages[i] ||= {};record.status=status;record.read=true;
  if(i===0 && activeWorkspace==='personal' && status==='Handled'){delete record.handledLinkedTaskChanged;record.handledLinkedTaskWasDone=state.tasks.includes('family-reply');if(!record.handledLinkedTaskWasDone)state.tasks.push('family-reply');}
  logActivity('message',`${status}: ${messageData(i).subject}`,'Dave confirmed · No email sent'+(status==='Snoozed'?' · Returns '+localTime(record.snoozeUntil)+' when Orbit is open':''),'inbox');commit(`Message ${status.toLowerCase()} — local demo`);return true;
}
function resolveMessage(status){
  if(!updateMessageDisposition(selectedMessage,status))return;
  openMessage(selectedMessage,messageOrigin);$('#message-feedback').textContent='Recorded locally. No email was sent.';
}
$('#reply-save').addEventListener('click',()=>{
 if(['Replied','Handled','Snoozed'].includes(messageStatus(selectedMessage)))return;
 const body=replyBody();if(body===null)return;const value=syncReplyVersion(selectedMessage,{body,brief:$('#draft-brief').value,settings:currentReplySettings(),to:$('#reply-to').value,subject:$('#reply-subject').value});if(!value)return;
 logActivity('message',`Draft saved: ${messageData(selectedMessage).subject}`,'Versioned editable draft only · Nothing sent','inbox');commit('Draft saved. Nothing sent.');$('#message-feedback').textContent=guidedSession?'Draft saved in temporary guided session only. Nothing sent.':storageAvailable?'Draft saved. Send Reply still requires your explicit confirmation.':'Browser storage is unavailable or full. Draft retained for this session only; download a backup.';
});
$('#reply-composer').addEventListener('keydown',event=>{if(event.key==='Enter' && event.target.tagName==='INPUT')event.preventDefault();});
$('#reply-composer').addEventListener('submit',event=>{
  event.preventDefault();if(event.submitter!==$('#reply-send') || !messageDialog.open || $('#reply-composer').hidden || messageWorkspace!==activeWorkspace || !Number.isInteger(selectedMessage) || selectedMessage<0 || selectedMessage>3 || ['Replied','Handled','Snoozed'].includes(messageStatus(selectedMessage)))return;
  const body=replyBody();if(body===null)return;const i=selectedMessage,context=replyContext(i),service=replyService();
  const saved=syncReplyVersion(i,{body,brief:$('#draft-brief').value,settings:currentReplySettings(),to:$('#reply-to').value,subject:$('#reply-subject').value});if(!saved)return;
  const reviewed=service.requestReplyReview({...context,draftId:saved.draft.id,versionId:saved.version.id});if(replyServiceError(reviewed))return;
  const approved=service.approveReplyVersion({...context,draftId:saved.draft.id,reviewId:reviewed.value.review.id});if(replyServiceError(approved))return;
  const executed=service.executeApprovedReply({...context,draftId:saved.draft.id,approvalId:approved.value.approval.id});if(replyServiceError(executed))return;
  const execution=executed.value.execution,record=state.messages[i] ||= {};record.status='Replied';record.sentBody=execution.payload.body;delete record.draft;
  if(i===0){state.executions.reply={status:'Sent',at:execution.at,payload:execution.payload};state.approvals=Object.keys(state.executions);delete state.drafts.reply;if(activeWorkspace==='personal'&&!state.tasks.includes('family-reply'))state.tasks.push('family-reply');}
  logActivity('message',`Reply sent: ${messageData(i).subject}`,`To ${execution.payload.to} · Dave confirmed exact revision ${saved.version.revision} · Demo simulation — no real email sent`,'inbox');commit('Demo simulation — no real email sent');openMessage(i,messageOrigin);$('#message-feedback').textContent='Demo simulation — no real email sent';
});
$('#reply-cancel').addEventListener('click',()=>{$('#reply-composer').hidden=true;$('#reply-validation').hidden=true;$('#message-feedback').textContent='Unsaved edits discarded. Any saved draft is retained.';$('#message-actions button')?.focus();});
$('#message-close').addEventListener('click',()=>messageDialog.close());
messageDialog.addEventListener('close',()=>{if(restoreResponseFocus(messageOrigin)){scheduleMonitoring(3500);return;}if(messageOrigin?.isConnected && messageOrigin.getClientRects().length && !messageOrigin.disabled)messageOrigin.focus({preventScroll:true});else $$('.email-row')[selectedMessage]?.focus({preventScroll:true});scheduleMonitoring(3500);});
$$('.email-row').forEach((row,i)=>{row.addEventListener('click',event=>{if(!event.target.closest('button'))openMessage(i,row);});row.addEventListener('keydown',event=>{if(event.target===row && ['Enter',' '].includes(event.key)){event.preventDefault();openMessage(i,row);}});});

// V1.5 navigation preferences are independent from demo workspace state.
const SIDEBAR_STORAGE_KEY='orbitSidebarState';
const sidebar=$('#orbit-sidebar'),sidebarToggle=$('#sidebar-toggle'),navigationDrawer=$('#navigation-drawer');
const mobileNavigation=matchMedia('(max-width:650px)');
const SIDEBAR_STATES=['expanded','compact','hidden'];
let sidebarState='expanded';
try{const saved=localStorage.getItem(SIDEBAR_STORAGE_KEY);if(SIDEBAR_STATES.includes(saved))sidebarState=saved;}catch{/* Navigation remains usable without storage. */}
function renderNavigation(){
  const mobile=mobileNavigation.matches;
  document.body.dataset.sidebar=mobile?'mobile':sidebarState;
  sidebar.inert=!mobile && sidebarState==='hidden';
  sidebarToggle.setAttribute('aria-controls',mobile?'navigation-drawer':'orbit-sidebar');
  if(mobile)sidebarToggle.setAttribute('aria-haspopup','dialog');else sidebarToggle.removeAttribute('aria-haspopup');
  const action=mobile?(navigationDrawer.open?'Close navigation':'Open navigation'):sidebarState==='expanded'?'Compact navigation':sidebarState==='compact'?'Hide navigation':'Show navigation';
  sidebarToggle.setAttribute('aria-label',action);sidebarToggle.title=action;sidebarToggle.querySelector('span').textContent=action;
  sidebarToggle.setAttribute('aria-expanded',String(mobile?navigationDrawer.open:sidebarState!=='hidden'));
  $$('.nav-link').forEach(link=>link.removeAttribute('title'));
}
function closeNavigationDrawer(){if(navigationDrawer.open)navigationDrawer.close();}
function configureNavigation(){
  if(mobileNavigation.matches){navigationDrawer.append(sidebar);sidebar.inert=false;}
  else{closeNavigationDrawer();document.body.insertBefore(sidebar,$('main'));}
  renderNavigation();
}
sidebarToggle.addEventListener('click',()=>{
  if(mobileNavigation.matches){if(navigationDrawer.open)closeNavigationDrawer();else{navigationDrawer.showModal();renderNavigation();$('#drawer-close').focus();}return;}
  sidebarState=SIDEBAR_STATES[(SIDEBAR_STATES.indexOf(sidebarState)+1)%SIDEBAR_STATES.length];renderNavigation();
  try{localStorage.setItem(SIDEBAR_STORAGE_KEY,sidebarState);}catch{notify('Navigation layout changed for this session. Browser storage is unavailable.');}
});
$('#drawer-close').addEventListener('click',closeNavigationDrawer);
navigationDrawer.addEventListener('close',()=>{renderNavigation();sidebarToggle.focus({preventScroll:true});});
navigationDrawer.addEventListener('keydown',containDialogFocus);

mobileNavigation.addEventListener('change',configureNavigation);
$$('.nav-link').forEach(link=>{
  const label=[...link.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent).join('').trim();link.dataset.navLabel=label;link.setAttribute('aria-label',label);
  const text=document.createElement('span');text.className='nav-text';text.textContent=label;
  [...link.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).forEach(node=>node.remove());link.children[0].after(text);
  const tooltip=document.createElement('span');tooltip.className='nav-tooltip';tooltip.setAttribute('aria-hidden','true');tooltip.textContent=label;link.append(tooltip);
  link.addEventListener('click',()=>{if(mobileNavigation.matches)closeNavigationDrawer();});
});
function syncActiveNavigation(){
  const destination=location.hash || '#overview';
  const active=$$('.nav-link').find(link=>link.getAttribute('href')===destination);if(!active)return;
  $('.breadcrumb strong').textContent=active.dataset.navLabel;
  $$('.nav-link').forEach(link=>{const selected=link===active;link.classList.toggle('active',selected);if(selected)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});
}
window.addEventListener('hashchange',syncActiveNavigation);
configureNavigation();syncActiveNavigation();

// Decision closure and timed local actions are browser-only, never external execution.
function demoDate(){return '2026-10-07';}
function localInput(date){const d=new Date(date);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function localTime(value){return new Date(value).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}
function decisionPaused(id){const d=state.decisions[id];return d && (d.status==='Dismissed' || new Date(d.until)>new Date());}
function restoreDecision(id){delete state.decisions[id];logActivity('approval',`Restored to attention: ${actionProfiles[id].title}`,'Dave restored the prepared action · Nothing executed','approvals');commit('Action restored to attention');$('#attention-title').focus({preventScroll:true});}
function recordDecision(status){
  const id=selectedCard?.dataset.approval;if(!id || state.executions[id] || decisionPaused(id))return;
  const until=new Date($('#decision-return').value);
  if(status==='Deferred' && (!Number.isFinite(until.getTime()) || until<=new Date())){showValidation('Choose a future return time.');$('#decision-return').focus();return;}
  const payload=currentPayload();if(normalizePayload(id,payload))state.drafts[id]=payload;
  state.decisions[id]={status,at:new Date().toISOString(),...(status==='Deferred'?{until:until.toISOString()}:{})};
  logActivity('approval',`${status==='Dismissed'?'Not needed':'Deferred'}: ${actionProfiles[id].title}`,status==='Deferred'?`Returns ${localTime(until)} · Nothing executed`:'Dave declined the suggestion · Nothing executed','approvals');dialog.close();commit(status==='Deferred'?'Action deferred':'Action marked not needed');
}
$('#decision-dismiss').addEventListener('click',()=>recordDecision('Dismissed'));
$('#decision-defer').addEventListener('click',()=>{const editor=$('#decision-defer-editor');editor.hidden=!editor.hidden;$('#decision-defer').setAttribute('aria-expanded',String(!editor.hidden));if(!editor.hidden){$('#decision-return').value=localInput(Date.now()+86400000);$('#decision-return').focus();}});
$('#decision-confirm-defer').addEventListener('click',()=>recordDecision('Deferred'));
let localActionKind=null;
function editLocalAction(kind){
  localActionKind=kind;$('#reply-composer').hidden=true;$('#message-action-editor').hidden=false;$('#local-action-error').textContent='';
  const timed=['reminder','snooze'].includes(kind);$('#local-title-field').hidden=kind==='snooze';$('#local-owner-field').hidden=timed;$('#local-date-field').hidden=timed;$('#local-time-field').hidden=!timed;
  $('#local-action-title').textContent={task:'Create a task',followup:'Create a follow-up task',reminder:'Set a reminder',snooze:'Snooze until'}[kind];$('#local-action-confirm').textContent={task:'Create Task',followup:'Create Follow-up',reminder:'Set Reminder',snooze:'Confirm Snooze'}[kind];
  const saved=messageRecord(selectedMessage).artifacts?.find(a=>a.kind===kind);
  if(saved){$('#local-action-title').textContent='Edit '+(kind==='followup'?'follow-up':kind);$('#local-action-confirm').textContent='Save changes';}
  $('#local-action-name').value=saved?.title || (kind==='followup'?'Follow up: ':'')+messageData(selectedMessage).subject;$('#local-action-owner').value=saved?.owner || 'Dave';$('#local-action-date').value=saved?.dueDate || demoDate();$('#local-action-time').value=localInput(saved?.remindAt || Date.now()+86400000);(kind==='snooze'?$('#local-action-time'):$('#local-action-name')).focus();
}
$('#local-action-cancel').addEventListener('click',()=>{$('#message-action-editor').hidden=true;$('#message-actions button').focus();});
$('#local-action-confirm').addEventListener('click',()=>{
  const kind=localActionKind,timed=['reminder','snooze'].includes(kind),name=$('#local-action-name').value.trim(),owner=$('#local-action-owner').value.trim(),when=new Date($('#local-action-time').value),dueDate=$('#local-action-date').value;
  if(kind!=='snooze' && !name || !timed && (!owner || !dueDate) || timed && (!Number.isFinite(when.getTime()) || when<=new Date())){$('#local-action-error').textContent='Enter a title and owner with a due date, or choose a future reminder / return time.';return;}
  if(kind==='snooze'){state.messages[selectedMessage].snoozeUntil=when.toISOString();resolveMessage('Snoozed');$('#message-feedback').textContent='Returns '+localTime(when)+' when Orbit is open. No external notification.';}
  else{createMessageArtifact(kind,{title:name,...(timed?{remindAt:when.toISOString()}:{owner,dueDate})});$('#message-action-editor').hidden=true;}
});
function restoreTimedItems(){
  let changed=false;
  for(const [id,choice] of Object.entries(state.decisions)){if(choice.status==='Deferred' && new Date(choice.until)<=new Date()){delete state.decisions[id];logActivity('approval',`Deferred action returned: ${actionProfiles[id].title}`,'Return time reached · Nothing executed','approvals');changed=true;}}
  for(const [i,r] of Object.entries(state.messages)){if(r.status==='Snoozed' && validDate(r.snoozeUntil) && new Date(r.snoozeUntil)<=new Date()){r.status=Number(i)<2?'Important':'New';r.read=false;delete r.snoozeUntil;logActivity('message',`Snoozed message returned: ${messageData(Number(i)).subject}`,'Return time reached in this browser · No email sent','inbox');changed=true;}}
  for(const r of Object.values(state.messages)){for(const item of r.artifacts || []){if(item.kind==='reminder' && !item.done && !item.notifiedAt && validDate(item.remindAt) && new Date(item.remindAt)<=new Date()){item.notifiedAt=new Date().toISOString();logActivity('message',`Reminder due: ${item.title}`,'In-app reminder only · No external notification','tasks');changed=true;}}}
  if(changed){saveState();render(true);notify('Timed workspace items returned. Check your attention queue and reminders.');}
}
setInterval(()=>{if(!processing && !dialog.open && !messageDialog.open && !taskListDialog.open && !meetingDialog.open)restoreTimedItems();},15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden && !processing)restoreTimedItems();});
function calendarDecisionSummary(){if(state.executions.meeting)return `${currentContext.meetingName} was rescheduled to ${formatMeetingTime(state.executions.meeting.payload)} in demo mode. No real calendar was changed.`;const choice=decisionPaused('meeting')?state.decisions.meeting:null;if(choice)return choice.status==='Deferred'?`Friday’s original conflict remains. You deferred the prepared change until ${localTime(choice.until)}; no meeting was changed.`:'You declined the proposed scheduling change. Friday’s original conflict remains; no meeting was changed.';return currentContext.calendarFinding;}
function dueFromDate(date){return !date?'later':date<demoDate()?'overdue':date===demoDate()?'today':'later';}
function taskUrgency(task){return task.due==='overdue'?120:taskCards.find(c=>c.dataset.task===task.id)?.querySelector('.tag')?.classList.contains('urgent')?100:90;}
function dueSummary(){const tasks=dueTasks(),overdue=tasks.filter(t=>t.due==='overdue').length;return overdue?`${tasks.length} need attention · ${overdue} overdue`:`${tasks.length} due today`;}
function restoreResponseFocus(origin){
  const key=origin?.dataset.responseFocus;if(!key)return false;
  const button=[...$$('[data-response-focus]')].find(e=>e.dataset.responseFocus===key && checkVisibleControl(e));
  (button || $('#command-response-title')).focus({preventScroll:true});return true;
}
function responseFeedback(message,undo=null){
  responseUndo=undo;const target=$('#response-feedback');target.replaceChildren();target.hidden=false;
  const text=document.createElement('span');text.textContent=message;target.append(text);
  if(undo){const button=document.createElement('button');button.type='button';button.className='review-button';button.textContent='Undo';button.dataset.responseFocus='undo';button.addEventListener('click',()=>{
    const data=responseUndo;if(!data || data.workspace!==activeWorkspace || messageStatus(data.i)!=='Handled')return;
    if(data.previous)state.messages[data.i]=data.previous;else delete state.messages[data.i];
    if(data.i===0 && activeWorkspace==='personal' && !data.linkedWasDone)state.tasks=state.tasks.filter(id=>id!=='family-reply');
    logActivity('message',`Restored: ${messageData(data.i).subject}`,'Dave undid Mark handled · No email sent','inbox');commit('Message restored');responseFeedback('Message restored to your inbox. No email was sent.');$('#command-response-title').focus({preventScroll:true});
  });target.append(button);}
}
function completeResponseTask(id,done){
  const task=allTaskItems().find(t=>t.id===id);if(!task)return;
  responseUndo=null;
  if(task.artifact){task.artifact.done=done;logActivity('task',`You ${done?'completed':'reopened'}: ${task.title}`,'Dave updated the local demo task','tasks');commit(done?'Task complete.':'Task reopened.');}
  else{const input=taskCards.find(c=>c.dataset.task===id).querySelector('input');input.checked=done;input.dispatchEvent(new Event('change',{bubbles:true}));}
  responseFeedback(`${done?'Completed':'Reopened'}: ${task.title}`);
}
function beginResponseEditor(i,kind){
  const old=messageRecord(i).artifacts?.find(a=>a.kind===kind);
  responseEditorDraft={workspace:activeWorkspace,i,kind,title:old?.title || (kind==='followup'?'Follow up: ':'')+messageData(i).subject,owner:old?.owner || 'Dave',date:old?.dueDate || demoDate(),time:localInput(old?.remindAt || Date.now()+86400000)};
  if(workflowMode==='proactive')cancelProactive();clearTimeout(monitorTimer);renderResponseActions(responseRoute);renderOperations();focusResponseEditor();
}
function focusResponseEditor(){const editor=$('#response-local-editor');if(!editor)return;const disclosure=editor.closest('details');if(disclosure)disclosure.open=true;editor.querySelector('input')?.focus({preventScroll:true});editor.scrollIntoView({block:'nearest',behavior:reducedMotion.matches || document.body.classList.contains('motion-paused')?'instant':'smooth'});}
function renderResponseEditor(target){
  const draft=responseEditorDraft;if(!draft || draft.workspace!==activeWorkspace)return;
  const form=document.createElement('form');form.className='response-editor';form.id='response-local-editor';
  const heading=document.createElement('h4');heading.textContent=draft.kind==='reminder'?'Set an in-app reminder':draft.kind==='snooze'?'Snooze this message':'Prepare a task';form.append(heading);
  const timed=['reminder','snooze'].includes(draft.kind);
  const field=(label,key,type)=>{const wrapper=document.createElement('label');wrapper.className='action-field';wrapper.append(document.createTextNode(label));const input=document.createElement('input');input.type=type;input.required=true;input.value=draft[key];input.id='response-editor-'+key;input.dataset.responseFocus='editor-'+key;if(type==='text')input.maxLength=key==='title'?300:100;input.addEventListener('input',()=>draft[key]=input.value);wrapper.append(input);form.append(wrapper);};
  if(draft.kind!=='snooze')field('Title','title','text');
  if(timed){field('Return / reminder time (browser local time)','time','datetime-local');const note=document.createElement('small');note.textContent='In-app demo only. Returns when Orbit is open; no notification service.';form.append(note);}
  else{field('Owner','owner','text');field('Due date · Scenario day: October 7, 2026','date','date');}
  const error=document.createElement('p');error.className='response-editor-error';error.setAttribute('role','alert');form.append(error);
  const controls=document.createElement('div');controls.className='response-card-actions';const cancel=document.createElement('button');cancel.type='button';cancel.className='review-button';cancel.textContent='Cancel';cancel.addEventListener('click',()=>{responseEditorDraft=null;renderResponseActions(responseRoute);renderOperations();$('#command-response-title').focus({preventScroll:true});scheduleMonitoring(3500);});
  const save=document.createElement('button');save.type='submit';save.className='approve-button';save.dataset.responseFocus='editor-save';save.textContent=timed?(draft.kind==='snooze'?'Confirm snooze':'Save reminder'):'Save task';controls.append(cancel,save);form.append(controls);
  form.addEventListener('submit',event=>{
    event.preventDefault();if(draft.workspace!==activeWorkspace)return;
    const time=new Date(draft.time);if(timed && (!Number.isFinite(time.getTime()) || time<=new Date())){error.textContent='Choose a future time.';return;}
    if(draft.kind!=='snooze' && !draft.title.trim() || !timed && (!draft.owner.trim() || !draft.date)){error.textContent='Enter a title, owner, and due date.';return;}
    responseEditorDraft=null;responseUndo=null;const record=state.messages[draft.i] ||= {};
    if(draft.kind==='snooze'){record.snoozeUntil=time.toISOString();updateMessageDisposition(draft.i,'Snoozed');responseFeedback('Message snoozed until '+localTime(time)+'. No email was sent.');}
    else{record.artifacts ||= [];const existing=record.artifacts.find(a=>a.kind===draft.kind),payload={kind:draft.kind,title:draft.title.trim(),...(timed?{remindAt:time.toISOString()}:{owner:draft.owner.trim(),dueDate:draft.date})};
      if(existing){if(payload.remindAt!==existing.remindAt)delete existing.notifiedAt;Object.assign(existing,payload);}else record.artifacts.push({...payload,at:new Date().toISOString(),done:false});
      if(draft.kind==='reminder')record.status='Reminder Created';logActivity('message',`${existing?'Updated':'Created'} ${draft.kind}: ${payload.title}`,'Dave confirmed · Local demo record only','tasks');commit('Local action saved');responseFeedback(timed?'Reminder saved for '+localTime(time)+'. No external notification.':'Task saved for '+payload.owner+' · Due '+payload.dueDate+'.');
    }
    $('#command-response-title').focus({preventScroll:true});scheduleMonitoring(3500);
  });target.append(form);
}
function renderResponseActions(route){
  const target=$('#command-response-actions'),active=document.activeElement,focusKey=active.dataset.responseFocus,selection=active.tagName==='INPUT' && active.type==='text'?[active.selectionStart,active.selectionEnd]:null;
  target.replaceChildren();if(processing)return;
  const button=(label,key,callback,review=false)=>{const b=document.createElement('button');b.type='button';b.className=review?'approve-button':'review-button';b.textContent=label;b.dataset.responseFocus=key;if(review || ['tasks-full'].includes(key) || /^(task-view-|calendar-\d|inbox-read-)/.test(key))b.setAttribute('aria-haspopup','dialog');b.addEventListener('click',()=>callback(b));return b;};
  const card=(title,detail,status)=>{const article=document.createElement('article');article.className='response-action-card';const top=document.createElement('div');top.className='response-card-top';const h=document.createElement('h4');h.textContent=title;const tag=document.createElement('span');tag.className='response-card-status';tag.textContent=status;top.append(h,tag);const p=document.createElement('p');p.textContent=detail;const actions=document.createElement('div');actions.className='response-card-actions';article.append(top,p,actions);return {article,actions};};
  const disclosure=(name,label)=>{const d=document.createElement('details');d.className='response-more';d.open=responseDisclosureOpen.has(name);const summary=document.createElement('summary');summary.textContent=label;d.append(summary);d.addEventListener('toggle',()=>{if(d.isConnected){if(d.open)responseDisclosureOpen.add(name);else responseDisclosureOpen.delete(name);}});target.append(d);return d;};
  const reviewApproval=(item,parent)=>{const view=card(item.title,item.reason,'Prepared · Your decision');view.actions.append(button(item.action,'approval-'+item.approval,b=>openAction(approvalCards.find(c=>c.dataset.approval===item.approval),b),true));parent.append(view.article);};
  const taskCard=(task,parent)=>{const view=card(task.title,`${task.owner || 'Dave'} · ${task.detail || (task.due==='today'?'Due today':task.due==='overdue'?'Overdue':'Upcoming')}`,task.completed?'Completed':task.due==='overdue'?'Overdue':task.due==='today'?'Due today':'Upcoming');
    const label=document.createElement('label');label.className='response-task-check';const check=document.createElement('input');check.type='checkbox';check.checked=task.completed;check.dataset.responseFocus='task-'+task.id;check.setAttribute('aria-label','Complete '+task.title);check.addEventListener('change',()=>completeResponseTask(task.id,check.checked));label.append(check,document.createTextNode(task.completed?'Completed · Uncheck to reopen':'Mark complete'));view.actions.append(label,button('View full task list','task-view-'+task.id,()=>openSpecificTask(task.id)));parent.append(view.article);};
  const inboxCard=(i,parent)=>{const data=messageData(i),status=messageStatus(i),terminal=['Replied','Handled','Snoozed'].includes(status),view=card(data.subject,`${data.sender} · ${data.summary}`,terminal?status:data.priority==='High'?'High priority · '+status:status);view.article.dataset.responseMessage=String(i);
    if(!terminal){if(!(activeWorkspace==='personal' && [1,2].includes(i)))view.actions.append(button(messageRecord(i).draft!==undefined?'Edit draft':'Review draft','inbox-review-'+i,b=>openMessage(i,b,true),true));
      if(activeWorkspace==='personal' && [1,2].includes(i))view.actions.append(button(messageRecord(i).artifacts?.some(a=>a.kind==='reminder')?'Edit reminder':'Set reminder','inbox-reminder-'+i,()=>beginResponseEditor(i,'reminder')));
      if(activeWorkspace==='work'){
        const relatedId=[null,'board','sprint','offsite'][i],related=relatedId?allTaskItems().find(t=>t.id===relatedId):null;
        if(messageRecord(i).artifacts?.some(a=>a.kind==='task') || !related)view.actions.append(button(messageRecord(i).artifacts?.some(a=>a.kind==='task')?'Edit task':'Create task','inbox-task-'+i,()=>beginResponseEditor(i,'task')));
        else view.actions.append(button(related.completed?'View completed task':'View related task','task-view-related-'+i,()=>openSpecificTask(relatedId)));
      }
      if(activeWorkspace==='personal' && i===2)view.actions.append(button('Snooze','inbox-snooze-'+i,()=>beginResponseEditor(i,'snooze')));
      view.actions.append(button('Mark handled','inbox-handle-'+i,()=>{const previous=state.messages[i]?JSON.parse(JSON.stringify(state.messages[i])):null,linkedWasDone=state.tasks.includes('family-reply');if(updateMessageDisposition(i,'Handled')){responseFeedback('Handled: '+data.subject+'. No email was sent.',{workspace:activeWorkspace,i,previous,linkedWasDone});$('#response-feedback button').focus({preventScroll:true});}}));
    }else if(['Handled','Snoozed'].includes(status)){view.actions.append(button(status==='Handled'?'Reopen message':'Return to inbox','inbox-reopen-'+i,()=>{reopenMessage(i);responseFeedback('Message restored to your inbox. Saved drafts are retained; no email was sent.');$('#command-response-title').focus({preventScroll:true});}));}
    view.actions.append(button('Read message','inbox-read-'+i,b=>openMessage(i,b)));parent.append(view.article);};
  if(route==='inbox'){
    const active=[0,1,2,3].filter(i=>!['Replied','Handled','Snoozed'].includes(messageStatus(i))),featured=active.filter(i=>i<2);(featured.length?featured:active.slice(0,2)).forEach(i=>inboxCard(i,target));
    const shown=featured.length?featured:active.slice(0,2),others=[0,1,2,3].filter(i=>!shown.includes(i));if(others.length){const more=disclosure('inbox-more','Other sample messages & resolved items ('+others.length+')');others.forEach(i=>inboxCard(i,more));}
  }else if(route==='tasks'){
    const items=allTaskItems(),due=items.filter(t=>!t.completed && ['today','overdue'].includes(t.due)).sort((a,b)=>taskUrgency(b)-taskUrgency(a));due.forEach(t=>taskCard(t,target));
    const rest=items.filter(t=>!due.some(d=>d.id===t.id));if(rest.length){const more=disclosure('task-more','Upcoming & completed tasks ('+rest.length+')');rest.forEach(t=>taskCard(t,more));}target.append(button('Open full task list','tasks-full',()=>openSpecificTask()));
  }else if(route==='calendar'){
    const entries=meetingFixtures[activeWorkspace];entries.forEach((_,i)=>{const data=meetingDetails(String(i)),view=card(data.title,data.when+' · '+data.location,i===0?'Next in the demo day':'Today');view.actions.append(button('View meeting brief','calendar-'+i,b=>openMeetingDetails(String(i),b),true));target.append(view.article);});
    if(!state.executions.meeting){const choice=decisionPaused('meeting')?state.decisions.meeting:null,data=meetingDetails('prepared-change'),view=card(data.title,currentContext.calendarFinding,choice?choice.status:'Friday · Proposed change');view.actions.append(button(choice?'View deferred / declined proposal':'Review proposed change','calendar-change',b=>choice?openMeetingDetails('prepared-change',b):openAction(approvalCards.find(c=>c.dataset.approval==='meeting'),b),true));target.append(view.article);}
  }else if(['briefing','attention','changes','approvals'].includes(route)){
    const items=route==='approvals'?attentionItems().filter(t=>t.approval):attentionItems();const featured=items.slice(0,3);featured.forEach(item=>item.approval?reviewApproval(item,target):taskCard(allTaskItems().find(t=>t.id===item.task),target));
    if(items.length>3){const more=disclosure('decision-more','More waiting ('+(items.length-3)+')');items.slice(3).forEach(item=>item.approval?reviewApproval(item,more):taskCard(allTaskItems().find(t=>t.id===item.task),more));}
    if(!items.length){const p=document.createElement('p');p.className='response-quiet';p.textContent=route==='approvals'?'No prepared actions are awaiting approval. Deferred or declined items remain in decision history.':'Nothing needs an immediate decision. Your scheduled focus time can stay protected.';target.append(p);}
  }else if(route==='unsupported'){
    for(const [label,request] of [['Review my inbox','Review my inbox'],['Check my schedule','Check my calendar'],['Daily briefing','Give me my daily briefing']])target.append(button(label,'try-'+request,()=>submitCommand(request)));
  }else if(route==='handled'){
    state.activity.filter(e=>!['command','proactive'].includes(e.kind)).slice(-3).reverse().forEach(event=>{const view=card(event.title,event.detail,'Recorded');target.append(view.article);});
  }
  const editorContainer=responseEditorDraft?target.querySelector(`[data-response-message="${responseEditorDraft.i}"]`) || target:target;
  renderResponseEditor(editorContainer);
  if(focusKey){const replacement=[...target.querySelectorAll('[data-response-focus]')].find(e=>e.dataset.responseFocus===focusKey && checkVisibleControl(e));if(replacement){replacement.focus({preventScroll:true});if(selection)replacement.setSelectionRange(...selection);}else if(active.closest('#command-response-actions'))$('#command-response-title').focus({preventScroll:true});}
}
// Meeting agendas and participants are fictional local fixtures, scoped to this demo workspace.
const meetingFixtures={
  work:[
    {attendees:['Dave','Sarah Mitchell','Daniel Kim','Aisha Patel','Morgan Ellis'],agenda:['Confirm today’s leadership priorities','Review delivery risks and owners','Agree which decisions need Dave’s input'],focus:'Leave with clear owners for today’s budget and design decisions.',notes:['Today’s schedule has no overlaps; the 12:00–2:00 PM focus block remains protected.','The partnership proposal and tomorrow’s board materials are the important inbox context.'],tasks:['budget','brand']},
    {attendees:['Dave','Aisha Patel','Daniel Kim'],agenda:['Review Q4 milestones and roadmap trade-offs','Discuss budget allocation and brand direction','Confirm sprint priorities before Friday'],focus:'Resolve the budget and design trade-offs before committing to the next sprint.',notes:['The onboarding prototype is complete in the fictional executive digest.','Sprint priorities are due Friday; today’s budget and brand tasks are the immediate decisions.'],tasks:['budget','brand','sprint']},
    {attendees:['Dave','Sarah Mitchell'],agenda:['Review Northstar’s revised partnership terms','Discuss next Tuesday’s proposed kickoff','Agree next steps and an agenda owner'],focus:'Clarify the terms and kickoff timing; a prepared email still requires Dave to confirm sending.',notes:['Sarah’s proposal needs attention before Friday.','The kickoff is a proposal, not a confirmed external calendar event.'],tasks:['kickoff'],reply:true},
    {attendees:['Dave','Aisha Patel'],agenda:['Review team capacity and delivery risks','Discuss the three sprint decisions in Aisha’s message','Agree follow-up priorities'],focus:'Agree which sprint decisions Aisha can progress and which require Dave’s review.',notes:['Aisha’s sprint update is available in the fictional priority inbox.','Sprint priorities are due Friday; no scheduling conflict is flagged for this meeting.'],tasks:['sprint']}
  ],
  personal:[
    {attendees:['Dave','Harbor Care Desk'],agenda:['Confirm Friday’s appointment time','Review arrival and paperwork reminders','Identify any scheduling questions'],focus:'Confirm the Friday appointment logistics without changing any booking.',notes:['The appointment reminder says Friday, October 9, 10:00–11:00 AM Eastern; arrive ten minutes early.','Friday’s maintenance visit overlaps that appointment. Its separate proposed move needs your decision.'],tasks:['appointment']},
    {attendees:['Dave','Alex Rivera'],agenda:['Confirm Saturday’s lunch at noon','Coordinate groceries and what Dave will bring','Review the family weekend plan'],focus:'Confirm attendance and who is bringing groceries before tonight.',notes:['Alex’s invitation needs a reply tonight.','The prepared family weekend plan includes Alex and Jamie as intended recipients; sharing remains your decision.'],tasks:['family-reply'],reply:true},
    {attendees:['Dave','Jamie Chen'],agenda:['Review pantry essentials and the grocery list','Group grocery pickup and library returns','Check the remaining household reminders'],focus:'Group errands into one trip and keep the Friday bill reminder on your radar.',notes:['Jamie’s fictional message contains the weekend errands and grocery list.','Marking the utility reminder handled does not pay a bill.'],tasks:['groceries','library','bill']}
  ]
};
function meetingDetails(key){
  if(key==='prepared-change')return {title:currentContext.meetingName,when:state.executions.meeting?formatMeetingTime(state.executions.meeting.payload):$('#calendar-review .action-facts dd').textContent,location:activeWorkspace==='work'?'Demo video call':'At home · Fictional maintenance visit',attendees:activeWorkspace==='work'?['Dave','Morgan Ellis']:['Dave','Casey Reed'],agenda:activeWorkspace==='work'?['Review the investor check-in priorities','Discuss milestones and open risks','Agree follow-up decisions']:['Confirm the maintenance visit window','Review the planned household visit','Keep the appointment slot clear'],focus:'Review the conflict and proposed alternative before authorizing any change.',notes:[state.executions.meeting?'Your confirmed demo change resolves the original scheduling conflict. No real calendar was updated.':currentContext.calendarFinding,'Changing this meeting is simulated and always requires Dave’s explicit confirmation.'],change:true,tasks:[]};
  if(key.startsWith('message-')){
    const index=Number(key.split('-')[1]),artifact=messageRecord(index).artifacts?.find(a=>a.kind==='calendar');if(!artifact)return null;
    return {title:artifact.title,when:index===1?'Friday, October 9, 2026 · 10:00–11:00 AM Eastern':'Saturday, October 10, 2026 · Noon Eastern',location:index===1?'Fictional appointment location':'Family lunch · Demo location not specified',attendees:index===1?['Dave','Harbor Care Desk']:['Dave','Alex Rivera','Jamie Chen'],agenda:index===1?['Prepare appointment paperwork','Arrive ten minutes early']:['Confirm lunch attendance','Coordinate groceries and what to bring'],notes:[`Created locally from: ${messageData(index).subject}`,'This is an in-browser calendar entry, not a real booking or invitation.'],focus:'Check the source message and the plan before making any external arrangements.',tasks:[]};
  }
  const index=Number(key),row=$$('.timeline .meeting')[index],fixture=meetingFixtures[activeWorkspace][index];if(!row || !fixture)return null;
  const times=[...row.querySelector('time').childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim(),end=row.querySelector('time span').textContent;
  return {...fixture,title:row.querySelector('h3').textContent,when:`Wednesday, October 7, 2026 · ${times}–${end} Eastern`,location:row.querySelector('.meeting-card > p').textContent.split(' · ').slice(1).join(' · ')};
}
function renderMeetingDetails(){
  $$('.timeline .meeting-card').forEach((card,index)=>{
    let button=card.querySelector('.meeting-open');if(!button){button=document.createElement('button');button.type='button';button.className='meeting-open';button.textContent='View briefing';button.setAttribute('aria-haspopup','dialog');card.append(button);}
    card.dataset.meetingKey=String(index);button.setAttribute('aria-label','View briefing for '+card.querySelector('h3').textContent);
  });
  $$('#calendar .message-destination .inbox-local-item').forEach((card,index)=>{
    const entries=Object.entries(state.messages).filter(([,r])=>r.artifacts?.some(a=>a.kind==='calendar'));const entry=entries[index];if(!entry)return;
    let button=card.querySelector('.meeting-open');if(!button){button=document.createElement('button');button.type='button';button.className='meeting-open';button.textContent='View briefing';button.setAttribute('aria-haspopup','dialog');card.append(button);}card.dataset.meetingKey=`message-${entry[0]}-calendar`;button.setAttribute('aria-label','View briefing for '+entry[1].artifacts.find(a=>a.kind==='calendar').title);
  });
  if(!meetingDialog.open)return;
  const data=meetingDetails(selectedMeetingKey);if(!data)return;
  $('#meeting-detail-title').textContent=data.title;$('#meeting-detail-context').textContent=currentContext.name+' · Fictional meeting preparation';$('#meeting-detail-time').textContent=data.when;$('#meeting-detail-location').textContent=data.location;
  const fill=(selector,items)=>{const list=$(selector);list.replaceChildren();items.forEach(text=>{const li=document.createElement('li');li.textContent=text;list.append(li);});};
  fill('#meeting-detail-attendees',data.attendees);fill('#meeting-detail-agenda',data.agenda);
  const notes=[...data.notes];
  if(activeWorkspace==='personal' && selectedMeetingKey==='0' && state.executions.meeting)notes[1]='You explicitly confirmed the maintenance move in demo mode; the original conflict is resolved locally.';
  if(activeWorkspace==='personal' && selectedMeetingKey==='1' && messageResolved())notes[0]=state.executions.reply?'Your lunch reply is recorded as sent in this demo.':'You resolved Alex’s message locally; no reply was sent.';
  if(activeWorkspace==='work' && selectedMeetingKey==='2' && messageResolved())notes[0]=state.executions.reply?'Your partnership reply is recorded as sent in this demo.':'You resolved Sarah’s message locally; no reply was sent.';
  if(activeWorkspace==='personal' && selectedMeetingKey==='0' && decisionPaused('meeting'))notes[1]=`Friday’s maintenance conflict remains. You ${state.decisions.meeting.status.toLowerCase()} the prepared alternative; no meeting was changed.`;
  if(activeWorkspace==='personal' && selectedMeetingKey==='1' && state.executions.report)notes[1]='You explicitly shared the family weekend plan in demo mode. No real document or email was delivered.';
  (data.tasks || []).forEach(id=>{const task=allTaskItems().find(t=>t.id===id);if(task)notes.push(`${task.title}: ${task.completed?'completed in this demo':task.detail.toLowerCase()}.`);});
  if(data.reply)notes.push(state.executions.reply?'Your reply was explicitly sent in demo mode; no real email was delivered.':messageResolved()?'The message was resolved locally without sending a reply.':'Orbit’s editable reply is prepared; nothing has been sent.');
  fill('#meeting-detail-notes',notes);$('#meeting-detail-focus').textContent='Suggested focus: '+data.focus;
  $('#meeting-change-facts').hidden=!data.change;$('#meeting-review-change').hidden=!data.change;
  const choice=decisionPaused('meeting')?state.decisions.meeting:null,execution=state.executions.meeting;
  $('#meeting-change-status').textContent=!data.change?'No scheduling change is prepared for this meeting. Today’s schedule has no overlaps.':execution?'Rescheduled in demo mode. These are the confirmed details; no real calendar was changed.':choice?`${choice.status==='Deferred'?'Deferred until '+localTime(choice.until):'Marked not needed by Dave'}. The original conflict remains; no meeting has changed.`:'Orbit prepared an alternative to resolve this Friday conflict. Review and edit it before confirming rescheduling.';
  if(data.change){const facts=$$('#calendar-review .action-facts dd');$('#meeting-change-original').textContent=facts[0].textContent;$('#meeting-change-conflict').textContent=facts[4].textContent;$('#meeting-change-proposed').textContent=formatMeetingTime(execution?.payload || state.drafts.meeting || actionProfiles.meeting.defaultPayload);$('#meeting-review-change').textContent=execution?'View confirmed change':choice?'Restore & review change':'Review proposed change';}
}
function openMeetingDetails(key,origin=document.activeElement){
  if(!meetingDetails(key))return;
  meetingOrigin=origin;selectedMeetingKey=key;if(workflowMode==='proactive')cancelProactive();clearTimeout(monitorTimer);
  meetingDialog.showModal();renderMeetingDetails();meetingDialog.scrollTop=0;$('#meeting-detail-close').focus({preventScroll:true});
}
$('#calendar').addEventListener('click',event=>{if(event.target.closest('#calendar-action-summary'))openMeetingDetails('prepared-change',event.target.closest('button'));else{const card=event.target.closest('[data-meeting-key]');if(card)openMeetingDetails(card.dataset.meetingKey,card.querySelector('.meeting-open'));}});
$('#meeting-detail-close').addEventListener('click',()=>meetingDialog.close());
meetingDialog.addEventListener('keydown',containDialogFocus);
meetingDialog.addEventListener('close',()=>{if(meetingReviewHandoff){meetingReviewHandoff=false;return;}if(restoreResponseFocus(meetingOrigin)){scheduleMonitoring(3500);return;}if(meetingOrigin?.isConnected && meetingOrigin.getClientRects().length)meetingOrigin.focus({preventScroll:true});else $('#calendar-action-summary').focus({preventScroll:true});scheduleMonitoring(3500);});

$('#meeting-review-change').addEventListener('click',()=>{
  meetingReviewReturn={key:selectedMeetingKey,workspace:activeWorkspace,origin:meetingOrigin};meetingReviewHandoff=true;meetingDialog.close();
  if(decisionPaused('meeting'))restoreDecision('meeting');
  openAction(approvalCards.find(card=>card.dataset.approval==='meeting'),meetingOrigin);
});

loadState(); restoreTimedItems(); syncMotion(); render(); scheduleMonitoring(1500);
if (stateNotice) notify(stateNotice);
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    if (!document.body.classList.contains('motion-paused')) entry.target.classList.add('is-revealing');
    observer.unobserve(entry.target);
  }),{threshold:.08});
  $$('.greeting, .briefing, .command-center, .stat-card, .panel').forEach((element,index) => { element.style.setProperty('--entrance-delay',`${index % 4 * 65}ms`); observer.observe(element); });
}


// Guided actions use fresh in-memory contexts. The persisted workspace record is
// never overwritten; refresh safely leaves the tour and loads saved progress.
(() => {
  let tourStep=0, tourTimer=null, tourBusy=false;
  const bar=document.createElement('section');bar.className='orbit-tour';bar.hidden=true;bar.setAttribute('aria-label','Orbit guided demo');
  bar.innerHTML='<div class="orbit-tour-copy"><span class="eyebrow">GUIDED DEMO · TEMPORARY SESSION</span><h2 id="tour-heading"></h2><p id="tour-description" role="status" aria-live="polite"></p></div><div class="orbit-tour-controls"><button class="approve-button" id="tour-next" type="button"></button><button class="review-button" id="tour-exit" type="button">Skip tour</button></div>';
  document.body.append(bar);
  const modalExit=document.createElement('button');modalExit.type='button';modalExit.className='review-button tour-dialog-exit';modalExit.textContent='Exit guided demo & restore progress';modalExit.hidden=true;messageDialog.prepend(modalExit);
  const labels=[['1 of 3 · Your daily briefing','Ask Orbit to review the workday. Watch the specialists coordinate, then see the priorities.','Run daily briefing'],['2 of 3 · You control the reply','Review the fictional reply, edit its body, and explicitly choose Send Reply. Nothing is sent to a real account.','Review prepared reply'],['3 of 3 · Separate workspaces','Switch to Personal Workspace and review its distinct inbox. Your original saved progress stays untouched.','Switch & review personal inbox'],['Walkthrough complete','You saw orchestration, an explicit human decision, and independent workspace data. Finish to restore your saved dashboard.','Finish & restore progress']];
  const editorNote=document.createElement('p');editorNote.className='tour-editor-note';editorNote.id='tour-editor-note';editorNote.hidden=true;editorNote.setAttribute('role','status');editorNote.setAttribute('aria-live','polite');$('#reply-body').closest('label').before(editorNote);
  let cueTarget=null, cueKey='';
  function clearCue(){if(cueTarget)cueTarget.classList.remove('tour-highlight');cueTarget=null;cueKey='';editorNote.hidden=true;$('#reply-body').removeAttribute('aria-describedby');$('#reply-send').removeAttribute('aria-describedby');}
  function cue(target,text,key,scroll=false){if(!target)return;if(cueKey===key && cueTarget===target)return;if(cueTarget)cueTarget.classList.remove('tour-highlight');cueTarget=target;cueKey=key;target.classList.add('tour-highlight');if(messageDialog.open){editorNote.hidden=false;editorNote.textContent=text;$('#reply-body').setAttribute('aria-describedby','tour-editor-note');$('#reply-send').setAttribute('aria-describedby','tour-editor-note');}else $('#tour-description').textContent=text;if(scroll)target.scrollIntoView({block:'center',behavior:reducedMotion.matches?'auto':'smooth'});}
  function annotate(){if(!guidedSession)return;if(messageDialog.open && tourStep===1){cue($('#reply-body'),'Step 2 of 3 · This is an editable draft, not a sent email. Change the message, then choose Send Reply below. Save Draft saves it without sending.','reply-edit');$('#reply-send').classList.add('tour-confirm-highlight');return;}$('#reply-send').classList.remove('tour-confirm-highlight');editorNote.hidden=true;if(tourBusy && processing){const agent=$('.agent-working');cue(agent || $('#operations'),agent?agent.querySelector('h3').textContent+' is checking fictional workspace data. Orbit will combine the findings into your response.':'Orbit is coordinating the specialists. No external action is being executed.','processing-'+(agent?.dataset.agent || 'core'));return;}if(tourStep===0)cue($('#tour-next'),'Start here: Run daily briefing. Orbit will check the work inbox, schedule, deadlines, and pending decisions.','start');else if(tourStep===1)cue($('#command-response'),'Briefing ready. These cards show what needs attention. Choose Review prepared reply below to inspect and edit Sarah’s draft.','briefing');else if(tourStep===2)cue($('#personal-workspace-tab'),'Reply sent — demo simulation only. Next, switch to Personal Workspace: its messages and approvals are separate.','workspace');else cue($('#command-response'),'This is the Personal inbox, with different fictional messages. Finish restores your original saved dashboard.','finish');}
  function paint(){const [title,copy,label]=labels[tourStep];$('#tour-heading').textContent=title;$('#tour-description').textContent=copy;$('#tour-next').textContent=tourBusy?'Working…':label;$('#tour-next').disabled=tourBusy;annotate();}
  function closePanels(){meetingReviewReturn=null;[messageDialog,dialog,meetingDialog,taskListDialog].forEach(d=>{if(d.open)d.close();});}
  function end(){if(!guidedSession)return;clearInterval(tourTimer);clearCue();$('#reply-send').classList.remove('tour-confirm-highlight');resetCommand();closePanels();const saved=guidedSession;workspaceStates=saved.contexts;applyWorkspace(saved.selected);state=workspaceStates[activeWorkspace];guidedSession=null;bar.hidden=true;modalExit.hidden=true;document.body.classList.remove('tour-active');$('#reset-demo').disabled=false;$('#try-orbit').disabled=false;syncMotion();render(true);scheduleMonitoring(1500);$('#try-orbit').focus({preventScroll:true});notify('Guided demo ended. Your original workspace progress is restored.');}
  $('#try-orbit').addEventListener('click',()=>{if(guidedSession)return;closePanels();resetCommand();workspaceStates[activeWorkspace]=state;guidedSession={contexts:JSON.parse(JSON.stringify(workspaceStates)),selected:activeWorkspace};workspaceStates={personal:freshState(),work:freshState()};applyWorkspace('work');state=workspaceStates.work;clearTimeout(monitorTimer);cancelProactive();tourStep=0;tourBusy=false;$('#reset-demo').disabled=true;$('#try-orbit').disabled=true;modalExit.hidden=false;document.body.classList.add('tour-active');syncMotion();render(true);bar.hidden=false;paint();$('#tour-next').focus();tourTimer=setInterval(()=>{if(!guidedSession)return;if(tourStep===1 && workspaceStates.work.executions.reply){tourStep=2;tourBusy=false;paint();}else if(tourBusy && !processing && tourStep===0){tourStep=1;tourBusy=false;paint();$('#command-response').scrollIntoView({block:'start',behavior:reducedMotion.matches?'auto':'smooth'});}else if(tourBusy && !processing && tourStep===2){tourStep=3;tourBusy=false;paint();$('#command-response').scrollIntoView({block:'start',behavior:reducedMotion.matches?'auto':'smooth'});}annotate();},250);});
  $('#tour-next').addEventListener('click',()=>{if(tourBusy)return;if(tourStep===3){end();return;}if(tourStep===1){if(activeWorkspace!=='work')$('[data-workspace="work"]').click();openMessage(0,$('#tour-next'),true);$('#reply-body').focus();annotate();return;}tourBusy=true;paint();if(tourStep===0){if(activeWorkspace!=='work')$('[data-workspace="work"]').click();submitCommand('Give me my daily briefing');}else{$('[data-workspace="personal"]').click();submitCommand('Review my inbox');}$('#operations').scrollIntoView({block:'center',behavior:reducedMotion.matches?'auto':'smooth'});annotate();});
  $('#tour-exit').addEventListener('click',end);modalExit.addEventListener('click',end);
})();

// Local reply alternatives and snapshots; no model or delivery service.
function cleanReplySettings(v){const pick=(key,allowed,fallback)=>allowed.includes(v?.[key])?v[key]:fallback;return {goal:pick('goal',['clarify','confirm','decline'],'clarify'),tone:pick('tone',['professional','warm','concise'],'professional'),feedback:pick('feedback',['positive','mixed','negative'],'mixed')};}
function cleanDraftHistory(value){return (Array.isArray(value)?value.slice(-100):[]).filter(v=>v && typeof v.body==='string' && validDate(v.at) && typeof v.brief==='string').slice(-20).map(v=>({body:v.body.slice(0,MAX_REPLY_LENGTH),brief:v.brief.slice(0,4000),to:safeAddress(v.to)?v.to:'',subject:safeHeader(v.subject,300)?v.subject:'',settings:cleanReplySettings(v.settings),label:typeof v.label==='string'?v.label.slice(0,100):'Draft',at:v.at}));}
function currentReplySettings(){return cleanReplySettings({goal:$('#draft-goal').value,tone:$('#draft-tone').value,feedback:$('#draft-feedback').value});}
function restoreReplySettings(record){const settings=cleanReplySettings(record.replySettings);$('#draft-goal').value=settings.goal;$('#draft-tone').value=settings.tone;$('#draft-feedback').value=settings.feedback;$('#draft-brief').value=record.replyBrief || messageData(selectedMessage).summary;}
function draftSnapshot(label){return {label,body:$('#reply-body').value,brief:$('#draft-brief').value,to:$('#reply-to').value,subject:$('#reply-subject').value,settings:currentReplySettings(),at:new Date().toISOString()};}
function recordDraftVersion(label){return syncReplyVersion(selectedMessage,{body:$('#reply-body').value,brief:$('#draft-brief').value,to:$('#reply-to').value,subject:$('#reply-subject').value,settings:currentReplySettings()},label);}
(() => {
 const tools=document.createElement('section');tools.className='reply-draft-tools';tools.setAttribute('aria-label','Scripted reply preparation');tools.innerHTML='<p class="muted">Scripted alternatives · Uses this message, Dave’s identity, and the selected workspace. Scripted mode is default; local AI requires explicit server opt-in.</p><label class="action-field">Reply brief<textarea id="draft-brief" rows="2" maxlength="4000"></textarea></label><div class="draft-settings"><label class="action-field">Goal<select id="draft-goal"><option value="clarify">Request clarification</option><option value="confirm">Confirm next step</option><option value="decline">Decline respectfully</option></select></label><label class="action-field">Tone<select id="draft-tone"><option value="professional">Professional</option><option value="warm">Warm</option><option value="concise">Concise</option></select></label><label class="action-field">Your assessment<select id="draft-feedback"><option value="positive">Positive</option><option value="mixed" selected>Mixed</option><option value="negative">Negative</option></select></label></div><div class="draft-toolbar"><label class="action-field">Generation mode<select id="draft-mode"><option value="scripted">Scripted demo</option><option value="local" disabled>Local AI</option></select></label><button type="button" id="draft-generate" class="approve-button">Generate reply</button><details id="draft-more" class="draft-more"><summary>More</summary><div class="message-actions"><button type="button" id="draft-history-open" aria-haspopup="dialog">Draft history</button><button type="button" id="draft-download">Download draft</button><button type="button" id="draft-copy">Copy draft</button></div><p id="draft-timing" class="muted">Timing appears after local AI generation.</p></details><button type="button" id="draft-regenerate" hidden>Scripted alternative</button></div><p id="draft-notice" role="status" aria-live="polite"></p>';
 $('#reply-body').closest('label').before(tools);
 const history=document.createElement('dialog');history.id='draft-history-dialog';history.className='action-dialog draft-history-dialog';history.setAttribute('aria-labelledby','draft-history-title');history.innerHTML='<div class="dialog-top"><h2 id="draft-history-title">Reply draft history</h2><button type="button" id="draft-history-close" class="close-button" aria-label="Close draft history">×</button></div><p>Versions are specific to this message and workspace. Restore brings back the brief, body, and selected settings; nothing is sent.</p><div id="draft-history-items"></div>';document.body.append(history);history.addEventListener('keydown',containDialogFocus);$('#draft-history-close').addEventListener('click',()=>history.close());history.addEventListener('close',()=>{if(messageDialog.open)$('#draft-history-open').focus();});
 const notice=text=>$('#draft-notice').textContent=text;
 const aiButton=document.createElement('button');aiButton.id='draft-ai-generate';aiButton.type='button';aiButton.textContent='Generate with local AI';aiButton.hidden=true;aiButton.title='Optional Ollama · disabled by default · draft only';$('#draft-copy').after(aiButton);
 aiButton.disabled=true;
 const aiStatus=document.createElement('p');aiStatus.className='muted';aiStatus.textContent='Checking optional local AI configuration…';$('.draft-toolbar').after(aiStatus);
 let aiEnabled=false,aiRequest=null,unlockAi=null,aiProgressTimer=null;
 fetch('/api/reply-generation/status').then(response=>{if(!response.ok)throw Error('Unavailable');return response.json();}).then(status=>{
   aiEnabled=status.enabled===true;aiButton.disabled=!aiEnabled;$('#draft-mode option[value=local]').disabled=!aiEnabled;
   aiStatus.textContent=aiEnabled?'Local AI available · Choose it in Generation mode. Drafts require review.':'Scripted mode · Local AI is disabled on this server.';
 }).catch(()=>{aiStatus.textContent='Scripted mode · Optional local AI requires the local Orbit server.';});
 const cancelAi=()=>{clearInterval(aiProgressTimer);aiProgressTimer=null;$('#reply-composer').removeAttribute('aria-busy');aiButton.textContent='Generate with local AI';$('#draft-generate').textContent='Generate reply';$('#draft-generate').disabled=false;aiRequest?.abort();aiRequest=null;unlockAi?.();unlockAi=null;aiButton.disabled=!aiEnabled;};
 messageDialog.addEventListener('close',cancelAi);
 $('#reply-cancel').addEventListener('click',cancelAi);
 $('#draft-generate').addEventListener('click',()=>{
   $('#draft-more').open=false;
   if($('#draft-mode').value==='local')aiButton.click();else $('#draft-regenerate').click();
 });
 aiButton.addEventListener('click',async()=>{
   if(!aiEnabled || aiRequest)return;
   const controller=new AbortController();aiRequest=controller;
   const workspace=activeWorkspace,index=selectedMessage;
   const startedAt=Date.now();
   unlockAi=OrbitReplyEditorState.lock($$('#reply-composer input, #reply-composer textarea, #reply-composer select, #draft-generate, #draft-regenerate, #draft-history-open, #reply-save, #reply-send'));
   $('#draft-generate').textContent='Generating…';aiButton.disabled=true;$('#reply-composer').setAttribute('aria-busy','true');
   notice('Preparing your reply… Nothing will be sent.');
   // Yield a paint before synchronous version/history persistence.
   await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
   if(controller.signal.aborted || activeWorkspace!==workspace || selectedMessage!==index || !messageDialog.open){if(aiRequest===controller)cancelAi();return;}
   const snapshot=draftSnapshot('Before local AI');
   const saved=recordDraftVersion('Before local AI');if(!saved){cancelAi();return;}
   const service=replyService(),context=replyContext(index);
   aiButton.disabled=true;aiButton.textContent='Generating…';$('#reply-composer').setAttribute('aria-busy','true');
   notice('Preparing your reply… First use may need to load the local model. Nothing will be sent.');
   aiProgressTimer=setInterval(()=>{const seconds=Math.floor((Date.now()-startedAt)/1000);notice(`Preparing your reply · ${seconds}s. ${seconds>=5?'The local model may be loading or retrying; Cancel keeps your draft.':'Settings are held steady while generating.'}`);},1000);
   const preparationMs=Date.now()-startedAt;
   try{
     const response=await fetch('/api/reply-generation',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({workspace,message:JSON.stringify((({sender,subject,body,summary})=>({sender,subject,body,summary}))(messageData(index))),brief:snapshot.brief,settings:snapshot.settings,previousBody:snapshot.body})});
     const result=await response.json();
     if(controller.signal.aborted || activeWorkspace!==workspace || selectedMessage!==index || !messageDialog.open)return;
     if(!response.ok || !result.ok){notice(typeof result.error?.message==='string'?result.error.message:'Local AI is unavailable. Your draft is preserved.');return;}
     if(!OrbitReplyEditorState.matches(snapshot,draftSnapshot('Before local AI'))){notice('The reply editor changed during generation. Your edits are preserved; generate again with the current settings.');return;}
     if(typeof result.value?.body!=='string' || !result.value.body.trim() || result.value.body.length>MAX_REPLY_LENGTH){notice('Local AI returned an invalid draft. Nothing was replaced.');return;}
     const revised=service.saveReplyDraftVersion({...context,draftId:saved.draft.id,expectedRevision:saved.draft.currentRevision,...snapshot,body:result.value.body});
     if(replyServiceError(revised))return;
     projectReplyDraft(index,revised.value.version,'Local AI draft');$('#reply-body').value=revised.value.version.body;
     const elapsed=((Date.now()-startedAt)/1000).toFixed(1);
     const timing=result.value.timing;
     $('#draft-timing').textContent=`Total: ${elapsed}s · Editor preparation: ${(preparationMs/1000).toFixed(1)}s`+(timing?` · Attempts: ${timing.attempts}`:'')+(Number.isFinite(timing?.loadMs)?` · Model load: ${(timing.loadMs/1000).toFixed(1)}s`:'')+(Number.isFinite(timing?.generateMs)?` · Model generation: ${(timing.generateMs/1000).toFixed(1)}s`:'');
     notice(`Local AI draft ready in ${elapsed}s. `+persist()+' Review before sending.');
   }catch{if(!controller.signal.aborted && activeWorkspace===workspace && selectedMessage===index)notice('Local AI is unavailable. Your draft is preserved; scripted alternatives still work.');}
   finally{if(aiRequest===controller){clearInterval(aiProgressTimer);aiProgressTimer=null;$('#reply-composer').removeAttribute('aria-busy');aiButton.textContent='Generate with local AI';$('#draft-generate').textContent='Generate reply';unlockAi?.();unlockAi=null;aiRequest=null;aiButton.disabled=!aiEnabled;}}
 });
 const persist=()=>{saveState();return guidedSession?'Temporary guided session only.':storageAvailable?'Saved in this browser.':'Browser storage is unavailable or full. Changes are retained only for this session; download a backup.';};
 $('#draft-regenerate').addEventListener('click',()=>{const saved=recordDraftVersion('Before alternative');if(!saved)return;const result=replyService().prepareReplyAlternative({...replyContext(selectedMessage),draftId:saved.draft.id,expectedRevision:saved.draft.currentRevision,settings:currentReplySettings(),brief:$('#draft-brief').value,to:$('#reply-to').value,subject:$('#reply-subject').value});if(replyServiceError(result))return;projectReplyDraft(selectedMessage,result.value.version,'New alternative');$('#reply-body').value=result.value.version.body;notice('Distinct scripted alternative prepared. '+persist()+' Nothing sent.');});
 function renderHistory(){const target=$('#draft-history-items');target.replaceChildren();const stored=replyService().getReplyHistory(replyContext(selectedMessage));if(!stored.ok){notice(stored.error.code+': '+stored.error.message);return false;}const versions=stored.value.draft?stored.value.versions.slice(-20).map(v=>({...v,at:v.createdAt,label:'Saved version '+v.revision})):messageRecord(selectedMessage).draftHistory || [];if(!versions.length){const p=document.createElement('p');p.textContent='No saved versions yet. Save Draft or prepare an alternative first.';target.append(p);}versions.slice().reverse().forEach((v,index)=>{const card=document.createElement('article');card.className='draft-history-card';const title=document.createElement('h3');title.textContent=v.label+' · '+new Date(v.at).toLocaleString();const summary=document.createElement('p');summary.textContent=`${v.settings.goal} · ${v.settings.tone} · ${v.settings.feedback}\nBrief: ${v.brief}`;const preview=document.createElement('pre');preview.textContent=v.body;const button=document.createElement('button');button.type='button';button.className='review-button';button.textContent='Restore this version';button.addEventListener('click',()=>{if(!recordDraftVersion('Before restoration'))return;const restored=syncReplyVersion(selectedMessage,{body:v.body,brief:v.brief,settings:v.settings,to:safeAddress(v.to)?v.to:messageData(selectedMessage).to,subject:safeHeader(v.subject,300)?v.subject:'Re: '+messageData(selectedMessage).subject},'Restored version');if(!restored)return;restoreReplySettings(messageRecord(selectedMessage));$('#reply-body').value=v.body;$('#reply-to').value=restored.version.to;$('#reply-subject').value=restored.version.subject;notice('Original brief, draft, and settings restored. '+persist()+' Nothing sent.');history.close();});card.append(title,summary,preview,button);target.append(card);});}
 $('#draft-history-open').addEventListener('click',()=>{if(renderHistory()===false)return;history.showModal();$('#draft-history-close').focus();});
 $('#draft-download').addEventListener('click',()=>{const body=replyBody();if(body===null)return;try{const text=`Orbit fictional draft — nothing sent\nWorkspace: ${currentContext.name}\nTo: ${$('#reply-to').value}\nSubject: ${$('#reply-subject').value}\n\n${body}\n`;const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='orbit-'+activeWorkspace+'-reply.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Draft download requested. No email sent.');}catch{notice('Download could not start. Copy the draft or select its text manually.');}});
 $('#draft-copy').addEventListener('click',async()=>{try{if(!navigator.clipboard?.writeText)throw Error('Unavailable');await navigator.clipboard.writeText($('#reply-body').value);notice('Draft copied. Nothing sent.');}catch{notice('Clipboard access was blocked or unavailable. Select the draft text and copy it manually, or download it.');}});
 messageDialog.addEventListener('close',()=>{if(history.open)history.close();notice('');});
})();


// Dismiss only a press and release on the backdrop, never an inside-to-outside drag.
function enableBackdropDismiss(overlay) {
  let pressedOutside = false;
  const outside = event => {
    const bounds = overlay.getBoundingClientRect();
    return event.target === overlay && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom);
  };
  overlay.addEventListener('pointerdown', event => { pressedOutside = event.button === 0 && outside(event); });
  overlay.addEventListener('pointercancel', () => { pressedOutside = false; });
  overlay.addEventListener('close', () => { pressedOutside = false; });
  overlay.addEventListener('click', event => {
    const dismiss = pressedOutside && outside(event);
    pressedOutside = false;
    if (dismiss && overlay.open) overlay.close();
  });
}
$$('dialog').forEach(enableBackdropDismiss);

// Keep the close control independent of the content/header that scrolls away.
$$('dialog').forEach(overlay => {
  const host = overlay.id === 'navigation-drawer' ? sidebar : overlay;
  const button = host.querySelector('.close-button,.close-dialog,#drawer-close');
  if (!button) return;
  const floating = document.createElement('div');
  floating.className = 'dialog-floating-close';
  floating.append(button); // Moving the existing button preserves its listeners and accessible name.
  host.prepend(floating);
  host.classList.add('has-floating-close');
});
