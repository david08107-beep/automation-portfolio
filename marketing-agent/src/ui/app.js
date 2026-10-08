import {CampaignClient,campaignToHistory} from './campaign-client.js';
import {createAssets,instructionFacts,seriousConcern} from '../content/template-generator.ts';
import {canonical} from '../domain/validation.ts';
const client=new CampaignClient();
let campaignCache=[], busy=false;
const $ = selector => document.querySelector(selector);
const tones = ['Warm & playful','Polished & helpful','Bold & punchy','Neighborly & sincere'];
const defaults = {name:'Paws & Polish',type:'Boutique dog grooming and spa care',difference:'Gentle one-on-one care and a personal touch for every pup.',location:'our neighborhood',voice:tones[0],tagline:'',booking:'',audience:'Local dog parents'};
const configs = {
 social:{title:'Create a quick post',label:'What can customers know?',badge:'POST'},
 campaign:{title:'Plan a campaign',label:'What is the campaign about?',badge:'CAMPAIGN'},
 review:{title:'Reply to a review',label:'Paste the customer’s review',badge:'RESPONSE'},
 followup:{title:'Write a customer message',label:'What happened or what should they know?',badge:'EMAIL'}
};
const clean = value => String(value || '').trim();
let toastTimer, currentTool = 'social', activeEntry = null, currentAssets = {}, currentAsset = 'message', currentVariant = 0, editingResult = null;
function cacheKey(key){return ['ff-profile','ff-results','ff-removed-results','ff-currency'].includes(key)?key+':'+(client.workspaceId||'pending'):key;}
function read(key,fallback){try{const raw=localStorage.getItem(cacheKey(key));if(raw!==null)return JSON.parse(raw)??fallback;if(client.workspaceId==='workspace-alice' && cacheKey(key)!==key)return JSON.parse(localStorage.getItem(key))??fallback;return fallback;}catch{return fallback;}}
function store(key, value) { try { localStorage.setItem(cacheKey(key), JSON.stringify(value)); return true; } catch { toast('Storage unavailable. Export your work to keep it.'); return false; } }
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('show'); toastTimer = setTimeout(()=>$('#toast').classList.remove('show'),3500); }
function profile() { const saved = read('ff-profile',{}); return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,typeof saved?.[key] === 'string' ? saved[key] : value])); }
function uid() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function toolKey(key) { return ['pack','calendar'].includes(key) ? 'campaign' : key; }
function history() { return campaignCache.filter(c=>!c.archived).map(campaignToHistory); }
function archivedCampaigns() { return campaignCache.filter(c=>c.archived).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)); }
function versions(entry) { return Array.isArray(entry?.versions) ? entry.versions : []; }
function historyId(entry) { return entry.id; }
function contextKey(tool,s,p) {
 const relevant=tool==='review'?{topic:s.topic,feedback:s.reviewSentiment}:tool==='followup'?{topic:s.topic,purpose:s.followupPurpose,name:s.customerName}:{topic:s.topic,goal:s.goal,platform:s.platform,tone:s.tone,offer:tool==='campaign'?s.offer:'',deadline:tool==='campaign'?s.deadline:''};
 return canonical({tool,relevant,profile:p});
}
function acceptCampaign(campaign) {
 const index=campaignCache.findIndex(c=>c.id===campaign.id);if(index<0)campaignCache.unshift(campaign);else campaignCache[index]=campaign;
 const entry=campaignToHistory(campaign);entry.key=contextKey(entry.tool,entry,campaign.profile);return entry;
}
function serviceError(result) {
 toast(result.error.message);
 if(result.error.code==='REVISION_CONFLICT'){$('#conflictNotice').hidden=false;$('#conflictNotice').textContent='This creation changed in another tab. Your edits are kept here. Export them, then open the latest saved creation from the library before saving again.';}
 return false;
}
async function refreshCampaigns() {const result=await client.list();if(!result.ok)return serviceError(result);campaignCache=result.value;renderHistory();return true;}
async function run(action){if(busy)return;busy=true;document.body.dataset.busy='true';try{await action();}catch(error){toast(error.message || 'Operation failed. Your edits are kept.');}finally{busy=false;document.body.dataset.busy='false';}}
const fields = ['topic','goal','platform','tone','offer','deadline','reviewSentiment','followupPurpose','customerName'];
function sessionRead(key,fallback){try{return JSON.parse(sessionStorage.getItem(key))??fallback;}catch{return fallback;}}
function sessionStore(key,value){try{sessionStorage.setItem(key,JSON.stringify(value));return true;}catch{toast('Tab draft storage unavailable. Export your work.');return false;}}
let working=sessionRead('campaign-working:'+client.workspaceId,{});
if (!working || typeof working !== 'object' || Array.isArray(working)) working = {};
function settings() { return Object.fromEntries(fields.map(id=>[id,$('#'+id).value])); }
function remember() {
 working[currentTool] = {...settings(), entryId:activeEntry?.id || null, assets:currentAssets, asset:currentAsset, variant:currentVariant};
 sessionStore('campaign-working:'+client.workspaceId,working);sessionStore('campaign-last-tool:'+client.workspaceId,currentTool);
}
function snapshotEditor() { if (Object.hasOwn(currentAssets,currentAsset)) currentAssets[currentAsset] = $('#draftCopy').value; }
function loadFields(saved = {}) {
 if(!saved || typeof saved!=='object' || Array.isArray(saved))saved={};
 const fallback = {topic:'',goal:'Get bookings',platform:'Instagram',tone:tones.includes(profile().voice)?profile().voice:tones[0],offer:'',deadline:'',reviewSentiment:'Mixed or unsure',followupPurpose:'Check in after a visit',customerName:''};
 fields.forEach(id=>{ $('#'+id).value = typeof saved[id] === 'string' ? saved[id] : fallback[id]; if ($('#'+id).tagName === 'SELECT' && !$('#'+id).value) $('#'+id).value = fallback[id]; });
}
function setView(view) {
 const results = view === 'results';
 $('#resultsView').hidden = !results; $('#creationView').hidden = results;
 document.querySelectorAll('[data-view]').forEach(button=>{const selected=button.dataset.view===view;button.classList.toggle('selected',selected);if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
 document.querySelectorAll('[data-tool]').forEach(button=>{button.hidden=(view==='care')!==['review','followup'].includes(button.dataset.tool);});
 $('#workspaceIntro').textContent = results ? 'Keep a record of inquiries, bookings, and income so you can decide what to repeat.' : view === 'care' ? 'Listen to feedback, follow up thoughtfully, and invite customers back.' : 'Create a useful message, plan a campaign, and track what it brings back.';
 if (results) renderResults();
}
function selectTool(key, rememberPrevious = true) {
 if (rememberPrevious) { snapshotEditor(); remember(); }
 currentTool = toolKey(key);
 const config = configs[currentTool];
 setView(['review','followup'].includes(currentTool)?'care':'create');
 document.querySelectorAll('[data-tool]').forEach(button=>{const selected=button.dataset.tool===currentTool;button.classList.toggle('active',selected);button.setAttribute('aria-selected',selected);button.tabIndex=selected?0:-1;});
 $('#formTitle').textContent=config.title; $('#topicLabel').childNodes[0].textContent=config.label;
 const marketing=['social','campaign'].includes(currentTool);
 $('#marketingSettings').hidden=!marketing; $('#campaignSettings').hidden=currentTool!=='campaign';
 $('#reviewSettings').hidden=currentTool!=='review'; $('#followupSettings').hidden=currentTool!=='followup';
 $('#briefHelp').textContent=currentTool==='review'?'The original review stays private to your brief; check the reply before posting.':'Enter facts customers can read, rather than instructions such as “write a post.”';
 loadFields(working[currentTool]);
 const saved=working[currentTool]; activeEntry=history().find((x,i)=>historyId(x,i)===saved?.entryId) || null;
 if (activeEntry) activeEntry={...activeEntry,key:contextKey(activeEntry.tool,activeEntry,activeEntry.profile)};
 currentAssets=saved?.assets && typeof saved.assets==='object' && !Array.isArray(saved.assets)?Object.fromEntries(Object.entries(saved.assets).filter(([,v])=>typeof v==='string')):{};
 currentVariant=saved?.variant===1?1:0; currentAsset=Object.hasOwn(currentAssets,saved?.asset)?saved.asset:Object.keys(currentAssets)[0]||'message';
 $('#conflictNotice').hidden=true;renderDraft(); renderPrompts(); remember();
}
const examples = {
 social:[['Fill an opening','Three grooming appointments are open this Saturday. Contact our team to ask which time suits your pup.'],['Care tip','Before your groom, tell us about your pup’s coat, comfort level, and any previous grooming experiences.'],['Thank customers','Thank you to the dog parents who supported our local team this week. We appreciate your trust.']],
 campaign:[['First grooms','We offer gentle first grooming visits for puppies, with time to discuss their comfort and care needs.'],['Seasonal care','Our team can help you choose a grooming routine that suits your dog’s coat and everyday activities.'],['Meet our team','Our team takes time to understand each pup’s needs before their appointment.']],
 review:[['Positive example','Your team was patient with my nervous puppy. Thank you!','Positive'],['Mixed example','The groom looked good, but the appointment started late.','Mixed or unsure'],['Negative example','I waited too long and did not feel listened to.','Negative']],
 followup:[['After a visit','Your pup visited us for their first groom yesterday.','Check in after a visit'],['Rebooking','It may be time to discuss your pup’s next grooming visit.','Invite a rebooking'],['After a concern','You raised a concern about the timing of your appointment.','Follow up on a concern']]
};
function renderPrompts() {
 $('.quick-prompts').replaceChildren();
 examples[currentTool].forEach(([label,fact,setting])=>{const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=()=>{ $('#topic').value=fact;if(setting)$('#'+(currentTool==='review'?'reviewSentiment':'followupPurpose')).value=setting;remember();$('#topic').focus();};$('.quick-prompts').append(button);});
}
async function keepCurrentEdits() {
 if(!activeEntry || !Object.keys(currentAssets).length)return true;
 if(versions(activeEntry).some(v=>canonical(v.assets)===canonical(currentAssets)))return true;
 return persistVersion('Edited');
}
async function persistVersion(label) {
 const result=await client.write('saveVersion',{campaignId:activeEntry.id,expectedRevision:activeEntry.revision,assets:structuredClone(currentAssets),variant:currentVariant,label});
 if(!result.ok)return serviceError(result);
 activeEntry=acceptCampaign(result.value);remember();renderHistory();return true;
}
async function generate(switchOnly=false) {
 snapshotEditor();
 const s=settings();
 if(!clean(s.topic)){toast('Add the facts customers need first.');$('#topic').focus();return;}
 if(currentTool!=='review' && instructionFacts(s.topic)){toast('Replace instructions with facts customers can read. The examples can help.');$('#topic').focus();return;}
 if(!await keepCurrentEdits())return;
 const p=profile(),key=contextKey(currentTool,s,p);
 const existing=history().find(entry=>contextKey(entry.tool,entry,entry.profile)===key);
 const selection=switchOnly && activeEntry?.key===key?1-currentVariant:0;
 let result;
 if(existing){
  result=await client.write('saveVersion',{campaignId:existing.id,expectedRevision:existing.revision,assets:createAssets(currentTool,s,p,selection),variant:selection,label:`Template ${selection+1}`});
 }else result=await client.write('create',{kind:currentTool,brief:s,profile:p,variant:selection});
 if(!result.ok)return serviceError(result);
 activeEntry=acceptCampaign(result.value);currentVariant=selection;
 // A template can be an earlier saved version; select it without mutating persisted history.
 currentAssets=createAssets(currentTool,s,p,selection);currentAsset=Object.keys(currentAssets)[0];
 remember();renderHistory();renderDraft();
}
function renderDraft() {
 const hasDraft=Object.keys(currentAssets).length>0;
 $('#emptyState').classList.toggle('hidden',hasDraft);$('#draft').classList.toggle('hidden',!hasDraft);
 $('#outputType').textContent=currentTool==='social'?$('#platform').value.toUpperCase():configs[currentTool].badge;
 $('#alternativeLabel').textContent=hasDraft?`Template ${currentVariant+1} of 2`:'';
 $('#reviewAlert').hidden=!(currentTool==='review' && seriousConcern($('#topic').value));
 $('#reviewAlert').textContent='This review describes a serious concern. Handle it personally; verify what happened before replying. This draft is only an acknowledgement.';
 if(!hasDraft)return;
 $('#assetSettings').hidden=Object.keys(currentAssets).length===1;
 $('#assetSelect').replaceChildren();Object.keys(currentAssets).forEach(key=>{const option=document.createElement('option');option.value=key;option.textContent=key==='strategy'?'Campaign strategy':key;$('#assetSelect').append(option);});$('#assetSelect').value=currentAsset;
 $('#draftCopy').value=currentAssets[currentAsset];
 $('#copyButton').textContent=currentTool==='campaign'?currentAsset.includes('caption')?'Copy caption':currentAsset.includes('script')?'Copy script':'Copy asset':'Copy message';
 $('#downloadButton').textContent=currentTool==='campaign'?'Export campaign':'Export message';
 $('#draftMeta').textContent=`${profile().name} · ${currentTool==='review'?'Customer feedback':currentTool==='followup'?$('#followupPurpose').value:$('#goal').value}`;
 $('#versionSelect').replaceChildren();versions(activeEntry || {}).filter(v=>typeof v.copy==='string').forEach((version,index)=>{const option=document.createElement('option');option.value=index;option.textContent=`${version.label || 'Saved version'} · ${new Date(version.date).toLocaleString()}`;$('#versionSelect').append(option);});
 const selected=versions(activeEntry||{}).findIndex(v=>JSON.stringify(v.assets)===JSON.stringify(currentAssets));if(selected>=0)$('#versionSelect').value=selected;
}
async function saveVersion() {
 snapshotEditor();if(!activeEntry)return;
 if(versions(activeEntry).some(v=>canonical(v.assets)===canonical(currentAssets))){toast('This version is already saved.');return;}
 if(await persistVersion('Edited')){renderDraft();toast(client.offline?'Preview version saved in memory.':'Version committed to your workspace.');}
}
function restoreEntry(entry,id) {
 snapshotEditor();remember();
 const target=toolKey(entry.tool);working[target]={...entry,entryId:id,assets:{...(entry.assets || {message:entry.copy})},asset:Object.keys(entry.assets||{})[0]||'message'};
 selectTool(target,false);activeEntry={...entry,id,key:contextKey(entry.tool,entry,entry.profile)};currentAssets={...(entry.assets || {message:entry.copy})};currentAsset=Object.keys(currentAssets)[0];currentVariant=entry.variant===1?1:0;remember();renderDraft();$('#historyDrawer').close();
}
function renderHistory() {
 const list=$('#historyList');list.replaceChildren();const items=history();$('#undoHistory').hidden=!archivedCampaigns().length;$('#libraryCount').textContent=items.length;
 if(!items.length){const empty=document.createElement('p');empty.className='empty-history';empty.textContent='Create a draft to start your library.';list.append(empty);}
 items.forEach(entry=>{const button=document.createElement('button');button.type='button';button.className='history-item';for(const [tag,text]of [['strong',configs[entry.tool].title],['small',`${versions(entry).length} saved version(s) · ${entry.topic}`],['p',entry.copy]]){const child=document.createElement(tag);child.textContent=text;button.append(child);}button.onclick=()=>restoreEntry(entry,entry.id);
 const group=document.createElement('div');group.className='history-group';const archive=document.createElement('button');archive.type='button';archive.className='archive-button';archive.textContent='Archive';archive.onclick=()=>run(async()=>{
  const result=await client.write('archive',{campaignId:entry.id,expectedRevision:entry.revision});if(!result.ok){serviceError(result);return;}acceptCampaign(result.value);if(activeEntry?.id===entry.id){activeEntry=null;remember();}renderHistory();toast('Creation archived. You can restore it.');
 });group.append(button,archive);list.append(group);});
}
function archived(key) {const value=read(key,[]);return Array.isArray(value)?value:[];}
$('#undoHistory').onclick=()=>run(async()=>{const campaign=archivedCampaigns()[0];if(!campaign)return;const result=await client.write('restore',{campaignId:campaign.id,expectedRevision:campaign.revision});if(!result.ok){serviceError(result);return;}acceptCampaign(result.value);renderHistory();toast('Creation restored.');});
// Manual results remain outside the Campaign Service slice.
$('#undoResult').onclick=()=>{const items=archived('ff-removed-results');const entry=items.shift();if(!entry)return;if(store('ff-results',[entry,...results()])){store('ff-removed-results',items);renderResults();toast('Record restored.');}};
function loadProfile() {
 const p=profile();$('#sidebarBusiness').textContent=p.name;
 for(const [id,key]of [['businessName','name'],['businessType','type'],['businessDifference','difference'],['businessLocation','location'],['businessAudience','audience'],['businessVoice','voice'],['businessTagline','tagline'],['businessBooking','booking']])$('#'+id).value=p[key];
}
function download(content,name,type='text/plain;charset=utf-8') {const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// Results are manual records. Never substitute drafts produced for business outcomes.
function results() {const saved=read('ff-results',[]);return Array.isArray(saved)?saved.filter(x=>x && typeof x.id==='string' && typeof x.campaign==='string' && ['inquiries','bookings','booked','revenue','spend'].every(k=>Number.isFinite(x[k])&&x[k]>=0)).map(x=>({...x,currency:['USD','GBP','EUR','CAD','AUD'].includes(x.currency)?x.currency:'USD'})):[];}
function currency() {const value=read('ff-currency','USD');return ['USD','GBP','EUR','CAD','AUD'].includes(value)?value:'USD';}
function money(value) {return new Intl.NumberFormat(undefined,{style:'currency',currency:currency()}).format(value);}
function renderResults() {
 const items=results().filter(x=>x.currency===currency());const totals=items.reduce((sum,x)=>{for(const k of Object.keys(sum))sum[k]+=x[k];return sum;},{inquiries:0,bookings:0,booked:0,revenue:0,spend:0});
 const metrics=$('#resultsMetrics');metrics.replaceChildren();
 for(const [label,value]of [['Inquiries',totals.inquiries],['Bookings',totals.bookings],['Booked value',money(totals.booked)],['Completed-sale revenue',money(totals.revenue)],['Marketing spend',money(totals.spend)],['Revenue less spend',money(totals.revenue-totals.spend)]]){const card=document.createElement('div');card.className='overview-card';const title=document.createElement('small');title.textContent=label;const number=document.createElement('strong');number.textContent=items.length?value:'—';card.append(title,number);metrics.append(card);}
 const list=$('#resultsList');list.replaceChildren();$('#exportResults').hidden=!items.length;$('#undoResult').hidden=!archived('ff-removed-results').length;
 if(!items.length){const empty=document.createElement('div');empty.className='empty-results';empty.textContent='No outcomes recorded yet. Log results from an actual campaign to begin.';list.append(empty);}
 items.forEach(item=>{const row=document.createElement('article');row.className='result-row';const title=document.createElement('h3');title.textContent=item.campaign;const detail=document.createElement('p');detail.textContent=`${item.source} · period ending ${item.date} · ${item.inquiries} inquiries · ${item.bookings} bookings · revenue ${money(item.revenue)} · spend ${money(item.spend)}`;const edit=document.createElement('button');edit.type='button';edit.className='secondary-button';edit.textContent='Edit record';edit.onclick=()=>openResult(item);const remove=document.createElement('button');remove.className='secondary-button';remove.type='button';remove.textContent='Remove record';remove.onclick=()=>{if(!store('ff-removed-results',[item,...archived('ff-removed-results')]))return;if(store('ff-results',results().filter(x=>x.id!==item.id))){renderResults();toast('Record removed. Undo is available.');}};row.append(title,detail,edit,remove);list.append(row);});
}
function openResult(item=null) {
 editingResult=item?.id || null;$('#resultForm').reset();
 const defaultDate=new Date().toLocaleDateString('en-CA');
 for(const [suffix,key]of [['Campaign','campaign'],['Source','source'],['Date','date'],['Inquiries','inquiries'],['Bookings','bookings'],['Booked','booked'],['Revenue','revenue'],['Spend','spend']])$('#result'+suffix).value=item?.[key] ?? (key==='date'?defaultDate:['campaign','source'].includes(key)?'':0);
 $('#resultDialog').showModal();
}
$('#resultForm').addEventListener('submit',event=>{
 event.preventDefault();const item={id:editingResult || uid(),campaign:clean($('#resultCampaign').value),source:clean($('#resultSource').value),date:$('#resultDate').value,currency:currency()};
 for(const [suffix,key]of [['Inquiries','inquiries'],['Bookings','bookings'],['Booked','booked'],['Revenue','revenue'],['Spend','spend']])item[key]=Number($('#result'+suffix).value);
 if(!item.campaign || !item.source || !item.date || ['inquiries','bookings','booked','revenue','spend'].some(k=>!Number.isFinite(item[k]) || item[k]<0) || !Number.isInteger(item.inquiries) || !Number.isInteger(item.bookings)){toast('Use valid, non-negative numbers and complete the record.');return;}
 const items=results();if(items.some(x=>x.id!==item.id && x.currency===item.currency && x.date===item.date && x.campaign.toLowerCase()===item.campaign.toLowerCase() && x.source.toLowerCase()===item.source.toLowerCase())){toast('A matching record already exists. Edit it instead of counting it twice.');return;}const index=items.findIndex(x=>x.id===item.id);if(index<0)items.unshift(item);else items[index]=item;
 if(store('ff-results',items)){renderResults();$('#resultDialog').close();toast('Results saved.');}
});
$('#addResult').onclick=()=>openResult();$('#closeResult').onclick=()=>$('#resultDialog').close();
$('#currency').value=currency();$('#currency').onchange=()=>{store('ff-currency',$('#currency').value);renderResults();toast('Showing records for the selected currency. Amounts are not converted.');};
$('#exportResults').onclick=()=>{
 const cols=['campaign','source','date','inquiries','bookings','booked','revenue','spend'];
 const csvCell=value=>{let text=String(value);if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';};
 const csv=[cols.join(',')+',currency',...results().map(item=>[...cols.map(k=>csvCell(item[k])),item.currency].join(','))].join('\r\n');download(csv,'marketing-results.csv','text/csv;charset=utf-8');
};
$('#creatorForm').addEventListener('submit',event=>{event.preventDefault();run(()=>generate());});
$('#regenerateButton').onclick=()=>run(()=>generate(true));$('#saveVersionButton').onclick=()=>run(saveVersion);
$('#draftCopy').addEventListener('input',()=>{snapshotEditor();remember();});
fields.forEach(id=>$('#'+id).addEventListener('input',remember));
$('#assetSelect').onchange=()=>{snapshotEditor();currentAsset=$('#assetSelect').value;remember();renderDraft();};
$('#versionSelect').onchange=()=>{const version=versions(activeEntry)[Number($('#versionSelect').value)];if(!version)return;currentAssets={...(version.assets||{message:version.copy})};currentAsset=Object.keys(currentAssets)[0];currentVariant=version.variant===1?1:0;remember();renderDraft();};
$('#copyButton').onclick=async()=>{try{await navigator.clipboard.writeText($('#draftCopy').value);toast('Message copied.');}catch{toast('Copy unavailable. Select the text or export it.');}};
$('#downloadButton').onclick=()=>{snapshotEditor();const output=Object.entries(currentAssets).map(([name,text])=>`${name.toUpperCase()}\n\n${text}`).join('\n\n────────────────────\n\n');download(output,'marketing-draft.txt');};
$('#navHistory').onclick=()=>run(async()=>{if(await refreshCampaigns())$('#historyDrawer').showModal();});$('#closeHistory').onclick=()=>$('#historyDrawer').close();
$('#navProfile').onclick=()=>{loadProfile();$('#profileDialog').showModal();};
$('#profileForm').addEventListener('submit',event=>{
 if(event.submitter?.value!=='save')return;
 const p={};for(const [id,key]of [['businessName','name'],['businessType','type'],['businessDifference','difference'],['businessLocation','location'],['businessAudience','audience'],['businessVoice','voice'],['businessTagline','tagline'],['businessBooking','booking']])p[key]=clean($('#'+id).value);p.name ||= defaults.name;
 if(store('ff-profile',p)){loadProfile();$('#tone').value=tones.includes(p.voice)?p.voice:tones[0];remember();toast('Brand settings saved.');}
});
document.querySelectorAll('[data-tool]').forEach(button=>{
 button.onclick=()=>selectTool(button.dataset.tool);
 button.onkeydown=event=>{const visible=[...document.querySelectorAll('[data-tool]')].filter(b=>!b.hidden);const index=visible.indexOf(button);const next=event.key==='ArrowRight'?(index+1)%visible.length:event.key==='ArrowLeft'?(index+visible.length-1)%visible.length:event.key==='Home'?0:event.key==='End'?visible.length-1:null;if(next===null)return;event.preventDefault();selectTool(visible[next].dataset.tool);visible[next].focus();};
});
document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>{snapshotEditor();remember();if(button.dataset.view==='results')setView('results');else selectTool(button.dataset.view==='care'?'review':'social');});
async function importLegacy() {
 if(client.workspaceId!=='workspace-alice' && !client.offline)return;
 const records=[],notices=[];
 for(const [source,isArchived]of [['ff-history',false],['ff-archived-history',true]]){
  let raw;try{raw=localStorage.getItem(source);}catch{notices.push(`${source}: browser storage unavailable.`);continue;}if(raw===null)continue;
  try{const parsed=JSON.parse(raw);if(!Array.isArray(parsed))throw new Error('History must be an array.');records.push(...parsed.map(record=>isArchived && record && typeof record==='object' && !Array.isArray(record)?{...record,archived:true}:record));}
  catch{notices.push(`${source}: malformed history. It was retained unchanged; export the original before repairing it.`);}
 }
 if(records.length){
  const result=await client.write('import',{records});
  if(!result.ok)notices.push(result.error.message+' Original browser history was retained.');
  else if(result.value.rejected.length)notices.push(`${result.value.imported.length} imported; ${result.value.rejected.length} rejected. Original records were retained. Details: `+result.value.rejected.map(x=>`record ${x.index+1}: ${x.error.message}`).join('; '));
 }
 if(notices.length){$('#migrationNotice').hidden=false;$('#migrationMessage').textContent=notices.join(' ');}
}
$('#exportLegacy').onclick=()=>{try{download(JSON.stringify({history:localStorage.getItem('ff-history'),archivedHistory:localStorage.getItem('ff-archived-history')},null,2),'original-browser-history.json','application/json');}catch{toast('Browser storage unavailable. Original history could not be exported.');}};
async function initialize(username='alice',switchAccount=false){
 document.body.dataset.busy='true';globalThis.campaignReady=false;
 try{
  $('#migrationNotice').hidden=true;await client.connect(username,switchAccount);$('#identitySelect').value=client.actor.id==='actor-bob'?'bob':'alice';$('#identitySelect').disabled=client.offline;
  $('#serviceStatus').textContent=client.offline?'Offline preview — changes are in memory; no authenticated service.':`${client.actor.name} · ${client.workspaceId} · local test identity`;
  // Read per-tab working state; valid legacy working data is copied, never rewritten.
  working=sessionRead('campaign-working:'+client.workspaceId,null);
  if(!working || typeof working!=='object' || Array.isArray(working)){const legacy=client.workspaceId==='workspace-alice' || client.offline?read('ff-working',{}):{};working=legacy && typeof legacy==='object' && !Array.isArray(legacy)?legacy:{};}
  activeEntry=null;currentAssets={};currentAsset='message';campaignCache=[];
  if(!switchAccount)await importLegacy();
  if(!await refreshCampaigns())throw new Error('Campaign library unavailable. Your original browser data is unchanged.');
  loadProfile();$('#currency').value=currency();renderResults();
  const last=toolKey(sessionRead('campaign-last-tool:'+client.workspaceId,read('ff-last-tool','social')));selectTool(Object.hasOwn(configs,last)?last:'social',false);
  globalThis.campaignReady=true;
 }catch(error){$('#serviceStatus').textContent=error.message;toast(error.message);}
 finally{document.body.dataset.busy='false';}
}
$('#identitySelect').onchange=()=>run(async()=>{snapshotEditor();remember();await initialize($('#identitySelect').value,true);});
initialize();
