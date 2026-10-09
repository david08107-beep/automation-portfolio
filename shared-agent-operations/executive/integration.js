// Orbit keeps executive contexts separate. Business campaign tools are Work-only.
const host = document.getElementById('shared-workspace');
const root = host.attachShadow({mode:'open'});
root.append(document.getElementById('campaign-workspace-template').content.cloneNode(true));
let campaignReady;
function updateContext() {
  const id = document.body.dataset.context;
  const info = OrbitWorkspacePolicy.context(id);
  document.getElementById('workspace-context-title').textContent = info.title;
  document.getElementById('workspace-context-summary').textContent = info.subtitle;
  document.getElementById('workspace-scope-note').textContent = info.scope;
  document.getElementById('command-input').placeholder = info.placeholder;
  document.getElementById('reset-demo').textContent = id==='personal'?'Reset Personal demo':'Reset Work demo';
  document.getElementById('reset-demo').title = 'Reset only this executive workspace; the other workspace and campaigns are preserved.';
  document.querySelectorAll('[data-context-select]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.contextSelect===id)));
  document.querySelectorAll('[data-work-only]').forEach(item=>item.hidden = !OrbitWorkspacePolicy.businessAllowed(id));
  for(const [section,label] of [['inbox',info.inbox],['calendar',info.calendar],['tasks',info.tasks],['research',info.research]]) {
    const link = document.querySelector('.nav-link[href="#'+section+'"]');
    link.dataset.navLabel = label;
    link.setAttribute('aria-label',label);
    link.querySelector('.nav-text').textContent = label;
    link.querySelector('.nav-tooltip').textContent = label;
  }
  document.querySelector('#inbox .panel-heading h2').firstChild.textContent = info.inbox+' ';
  document.querySelector('#calendar .panel-heading h2').textContent = id==='personal'?'Your personal schedule':'Your work schedule';
  document.querySelector('#tasks .panel-heading h2').textContent = info.tasks;
  document.querySelector('#research .panel-heading h2').firstChild.textContent = info.research+' ';
}
function route() {
  const section = location.hash.slice(1);
  const business = ['workflows','studio'].includes(section);
  const allowed = OrbitWorkspacePolicy.businessAllowed(document.body.dataset.context);
  const shared = business && allowed;
  host.hidden = !shared;
  document.getElementById('executive-content').hidden = shared;
  if(!document.body.classList.contains('tour-active')) document.getElementById('try-orbit').disabled = shared;
  if(business && !allowed) {
    document.getElementById('workspace-boundary-message').textContent = 'Business tools belong to Work. Select Work above to use Workflows or Content Studio. Your Personal changes are kept.';
    location.hash = 'overview';
    return;
  }
  if(shared) {
    document.querySelector('.breadcrumb strong').textContent = section==='studio'?'Content Studio':'Workflows';
    campaignReady ||= import('/app.js');
    campaignReady.then(()=>{
      if(!OrbitWorkspacePolicy.businessAllowed(document.body.dataset.context) || host.hidden) return;
      const current = location.hash.slice(1);
      window.dispatchEvent(new CustomEvent('orbit:campaign-view',{detail:current==='studio'?'studio':'work'}));
    }).catch(()=>{
      host.textContent = 'The campaign workspace could not load. Your Executive Assistant is still available from Overview.';
    });
    host.scrollIntoView({block:'start'});
  }
}
window.addEventListener('orbit:workspace-changed',()=>{
  updateContext();
  document.getElementById('workspace-boundary-message').textContent = '';
  if(location.hash && location.hash!=='#overview') location.hash='overview';
  route();
});
window.addEventListener('hashchange',route);
updateContext();
route();
