const tools={
 social:{title:'Create a social post',label:'What do you want to share?',placeholder:'e.g. We have three weekend grooming spots left and want to fill them...',badge:'INSTAGRAM'},
 campaign:{title:'Dream up a campaign',label:'What are we promoting?',placeholder:'e.g. A spring refresh package for muddy pups...',badge:'CAMPAIGN'},
 review:{title:'Reply to a review',label:'Paste the customer review',placeholder:'e.g. Milo usually hates grooming, but the team was so patient...',badge:'RESPONSE'},
 calendar:{title:'Plan your content week',label:'What should this week focus on?',placeholder:'e.g. Educate customers about coat care and promote weekend availability...',badge:'7-DAY PLAN'},
 followup:{title:'Write a follow-up',label:'Who are you following up with?',placeholder:'e.g. A customer whose puppy had their first groom yesterday...',badge:'EMAIL'}
};
const $=s=>document.querySelector(s); let currentTool='social'; let lastDraft='';
const defaults={name:'Paws & Polish',type:'Boutique dog grooming and spa care',difference:'Gentle one-on-one care, stress-free appointments, and a personal touch for every pup.',location:'our neighborhood'};
function readLocal(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
const profile=()=>{const saved=readLocal('ff-profile',{});return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,typeof saved?.[key]==='string'&&saved[key].trim()?saved[key]:value]));};
function historyRecords(){const saved=readLocal('ff-history',[]);return Array.isArray(saved)?saved.filter(x=>x&&Object.hasOwn(tools,x.tool)&&typeof x.topic==='string'&&typeof x.copy==='string'&&typeof x.date==='string').slice(0,20):[];}
function writeLocal(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{toast('Browser storage is unavailable. Your draft remains on screen.');return false}}
const esc=s=>String(s||'').trim();
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function selectTool(key){currentTool=key;document.querySelectorAll('.tool-card').forEach(btn=>{const on=btn.dataset.tool===key;btn.classList.toggle('active',on);btn.setAttribute('aria-selected',on)});const c=tools[key];$('#formTitle').textContent=c.title;$('#topicLabel').childNodes[0].textContent=c.label;$('#topic').placeholder=c.placeholder;$('#outputType').textContent=c.badge;$('#topic').focus()}
document.querySelectorAll('.tool-card').forEach(b=>b.addEventListener('click',()=>selectTool(b.dataset.tool)));
document.querySelectorAll('[data-prompt]').forEach(b=>b.addEventListener('click',()=>{$('#topic').value=b.dataset.prompt;$('#topic').focus()}));
function drafts(tool,topic,goal,tone,p){
 const name=p.name,place=p.location,why=p.difference;
 const library={
  social:[`A fresh pup feeling is hard to beat. ✨\n\n${topic}\n\nAt ${name}, we believe every appointment should feel as good as the final look. ${why}\n\nReady for your pup’s turn? Send us a message to save a spot. 🐾\n\n#DogGrooming #HappyPup #ShopLocal`,`Today’s little reminder: great care shows—in the wag, the strut, and the proud ride home. 🐶\n\n${topic}\n\nThat’s the ${name} difference: ${why.toLowerCase()}\n\nTag a dog parent who deserves an easier grooming day.\n\n#DogCare #LocalBusiness #FreshlyGroomed`],
  campaign:[`CAMPAIGN: The Feel-Good Fresh Start\n\nBig idea\nTurn “grooming day” into a celebration of the happy, comfortable pup waiting on the other side.\n\nOffer\n${topic}\n\n3-part rollout\n1. TEASE — Share a close-up “before” detail and ask followers to guess the transformation.\n2. REVEAL — Post the joyful after moment with a short care tip.\n3. INVITE — Open a limited number of appointments with a clear booking deadline.\n\nSignature line\nA little care. A lot more tail wag.\n\nBest fit: ${goal} · Tone: ${tone}`],
  review:[`Thank you so much for sharing this—it made our day! We know every pup has their own comfort level, so hearing that your visit felt patient and positive means the world to us. We loved caring for your pup and can’t wait to welcome you both back to ${name}. 🐾`],
  calendar:[`MONDAY · EDUCATE\nQuick tip: one small at-home habit that makes the next groom easier.\n\nTUESDAY · SHOW THE WORK\nA behind-the-scenes detail that reflects: ${why}\n\nWEDNESDAY · BUILD TRUST\nShare a customer question and your honest, helpful answer.\n\nTHURSDAY · CREATE JOY\nPost a before-and-after moment with the pup’s personality in the caption.\n\nFRIDAY · INVITE\n${topic}\n\nSATURDAY · COMMUNITY\nAsk followers to share their dog’s funniest habit.\n\nSUNDAY · PREPARE\nPreview the week ahead and offer one clear way to book.\n\nWeekly goal: ${goal}`],
  followup:[`Subject: A quick check-in from ${name} 🐾\n\nHi there,\n\nWe loved having your pup visit us! ${topic}\n\nIf you have a moment, we’d love to hear how everything is going. And if there’s anything we can do to make the next visit even better, just reply—we’re always happy to help.\n\nWarmly,\nThe ${name} team\n${place}`]
 };return library[tool];
}
function generate(){const topic=esc($('#topic').value);if(!topic){$('#topic').focus();$('#topic').animate([{transform:'translateX(-5px)'},{transform:'translateX(5px)'},{transform:'translateX(0)'}],{duration:220});return}const options=drafts(currentTool,topic,$('#goal').value,$('#tone').value,profile());lastDraft=options[Math.floor(Math.random()*options.length)];$('#draftCopy').textContent=lastDraft;$('#draftMeta').textContent=`Made for ${profile().name} · ${$('#tone').value} · ${new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'})}`;$('#emptyState').classList.add('hidden');$('#draft').classList.remove('hidden');saveHistory(topic,lastDraft)}
$('#creatorForm').addEventListener('submit',e=>{e.preventDefault();generate()});
$('#regenerateButton').addEventListener('click',generate);
$('#copyButton').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(lastDraft);toast('Draft copied')}catch{toast('Copy unavailable. Select the draft text and copy it manually.')}});
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),1800)}
function saveHistory(topic,copy){const history=historyRecords();history.unshift({tool:currentTool,topic,copy,date:new Date().toISOString()});writeLocal('ff-history',history.slice(0,20));renderHistory()}
function renderHistory(){const h=historyRecords();$('#historyList').innerHTML=h.length?h.map((x,i)=>`<button class="history-item" data-history="${i}"><strong>${tools[x.tool].title}</strong><small>${new Date(x.date).toLocaleDateString()} · ${escapeHtml(x.topic)}</small><p>${escapeHtml(x.copy)}</p></button>`).join(''):'<p class="empty-history">Your best ideas will live here.<br/>Create your first draft to get started.</p>';document.querySelectorAll('[data-history]').forEach(btn=>btn.onclick=()=>{const x=h[+btn.dataset.history];selectTool(x.tool);lastDraft=x.copy;$('#draftCopy').textContent=x.copy;$('#draftMeta').textContent=`Saved draft · ${new Date(x.date).toLocaleDateString()}`;$('#emptyState').classList.add('hidden');$('#draft').classList.remove('hidden');closeHistory()})}
function openHistory(){$('#historyDrawer').classList.add('open');$('#scrim').classList.add('open');$('#historyDrawer').setAttribute('aria-hidden','false')}
function closeHistory(){$('#historyDrawer').classList.remove('open');$('#scrim').classList.remove('open');$('#historyDrawer').setAttribute('aria-hidden','true')}
$('#historyButton').onclick=openHistory;$('#closeHistory').onclick=closeHistory;$('#scrim').onclick=closeHistory;
function loadProfile(){const p=profile();$('#businessName').value=p.name;$('#businessType').value=p.type;$('#businessDifference').value=p.difference;$('#businessLocation').value=p.location;$('#profileInitials').textContent=p.name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()}
$('#profileButton').onclick=()=>{$('#profileDialog').showModal()};
$('#profileForm').addEventListener('submit',e=>{if(e.submitter?.value!=='save')return;const p={name:esc($('#businessName').value)||defaults.name,type:esc($('#businessType').value),difference:esc($('#businessDifference').value),location:esc($('#businessLocation').value)};if(writeLocal('ff-profile',p)){loadProfile();toast('Business profile saved')}});
$('#nudgeButton').onclick=()=>{selectTool('social');$('#topic').value='Share a real client win from this week: what changed for the pup, how the owner felt, and the small care detail that made it possible.';document.querySelector('.workspace').scrollIntoView({behavior:'smooth'})};
loadProfile();renderHistory();

