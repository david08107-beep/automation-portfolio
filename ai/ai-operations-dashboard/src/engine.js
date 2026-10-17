/** Pure workflow domain. A future server can replace scheduling/storage without changing the UI contract. */
import {LIMITS,capacityFailure,snapshotFailure} from './limits.js';
export const MAX_RESULT_LENGTH=LIMITS.resultChars;
export const STORAGE_KEY = 'dave-ai-os-v1';
export const statuses = ['queued', 'running', 'awaiting review', 'completed', 'failed', 'cancelled'];
export const agents = [
  {id:'planner', name:'Planner', role:'Turns requests into executable plans', symbol:'P'},
  {id:'analyst', name:'Analyst', role:'Reviews fictional project and operations data', symbol:'A'},
  {id:'triage', name:'Triage', role:'Classifies fictional software requests', symbol:'T'},
  {id:'writer', name:'Writer', role:'Prepares results for Dave’s review', symbol:'W'},
];
export const recipes = {
  brief: {name:'Operations brief', label:'Prepare a weekly operations brief', icon:'◈', description:'Turn a fictional operations snapshot into a clear weekly brief.', plan:['Define the reporting scope','Analyze operations and identify risks','Prepare a weekly brief'], agents:['planner','analyst','writer'], approval:'Approve brief locally'},
  update: {name:'Project update', label:'Draft a project update for the team', icon:'◇', description:'Prepare an unsent team update from fictional project milestones.', plan:['Define the audience and update scope','Review project milestones and blockers','Draft an unsent team update'], agents:['planner','analyst','writer'], approval:'Approve draft locally'},
  backlog: {name:'Request triage', label:'Review the software request backlog', icon:'▤', description:'Classify fictional requests and flag decisions for owner review.', plan:['Define request-review criteria','Classify requests and flag exceptions','Prepare a triage recommendation'], agents:['planner','triage','writer'], approval:'Approve review locally'},
};
export const suggestions = Object.values(recipes).map(r=>r.label);
export const createState = () => ({version:2, workflows:[], activity:[]});
const now = () => new Date().toISOString();
function recordUnchecked(state,message,workflowId,kind='execution') {
  if(typeof message!=='string'||message.length>LIMITS.eventChars||(workflowId!=null&&!state.workflows.some(w=>w.id===workflowId)))return false;
  state.activity.unshift({id:crypto.randomUUID(), workflowId:workflowId??null, message, kind:['request','execution','edit','demo'].includes(kind)?kind:'execution', time:now()});return true;
}
export function recipeFor(request) {
  return /software|backlog|triage/i.test(request)?'backlog':/draft|project|team|update/i.test(request)?'update':'brief';
}
function enqueueUnchecked(state,request,type) {
  if(typeof request!=='string')return null;
  type??=recipeFor(request);request=request.trim(); if(!request || request.length>LIMITS.requestChars || !Object.hasOwn(recipes,type)) return null;
  const w={id:crypto.randomUUID(),request,type,status:'queued',step:0,created:now(),timeline:[],result:'',decision:null,failure:null,
    tasks:recipes[type].plan.map((title,index)=>({id:crypto.randomUUID(),title,agent:recipes[type].agents[index],status:'pending'}))};
  state.workflows.unshift(w); recordUnchecked(state,'Dave queued a request',w.id,'request');return w;
}
function event(state,w,text) {w.timeline.push({text,time:now()});recordUnchecked(state,text,w.id);}
export function preparedResult(w) {
  const pre=`Prepared for Dave · SIMULATED / FICTIONAL DATA\nRequest: ${w.request}\n\n`;
  const body={
    brief:`WEEKLY OPERATIONS BRIEF\n\nOverview\n12 fictional requests reviewed: 9 routine, 3 awaiting owner decisions.\nAtlas: documentation milestone ready for review.\nBeacon: dependency delay of two days; revised delivery estimate not approved.\n\nAttention needed\n• Confirm Beacon’s owner and estimate.\n• Review the three flagged requests before prioritizing work.\n\nSuggested next step\nUse this brief to prepare Dave’s next planning session.`,
    update:`UNSENT TEAM UPDATE\n\nSubject: Atlas & Beacon — weekly project update\n\nHi team,\n\nAtlas documentation is ready for review. Beacon’s fictional dependency is delayed by two days, so its revised delivery estimate needs owner confirmation.\n\nProposed next steps:\n• Atlas owner: review documentation by the next planning session.\n• Beacon owner: confirm the dependency and revised estimate.\n• Dave: review these proposals before communicating changes.\n\nThanks,\nDave`,
    backlog:`SOFTWARE REQUEST TRIAGE\n\nFictional queue: 12 requests\n\nRoutine review (9)\nStandard catalog requests appear complete and are recommended for the normal review path. No approvals or installations have been performed.\n\nOwner decisions (3)\nREQ-104 · Design tool · Nonstandard license — confirm budget.\nREQ-108 · Reporting add-on · Missing justification — request more detail.\nREQ-112 · Remote utility · Elevated access — security review required.\n\nRecommendation\nDave should review each exception before changing its priority or approval state.`,
  }[w.type];
  return pre+body+'\n\nLocal demo only. Nothing has been sent, shared, installed, rescheduled, or changed externally.';
}
/** One tick completes current tasks, then assigns available agents. Each agent runs at most one task. */
function tickUnchecked(state) {
  let changed=false;
  for(const w of state.workflows) {
    if(w.status!=='running') continue;
    const task=w.tasks.find(t=>t.status==='running');if(!task)continue;
    task.status='completed';w.step++;changed=true;event(state,w,`${agents.find(a=>a.id===task.agent).name} completed: ${task.title}`);
    if(w.step===w.tasks.length) {w.status='awaiting review';w.result=preparedResult(w);event(state,w,'Prepared result ready for Dave’s review');}
  }
  const occupied=new Set();
  // Oldest requests receive the first available agents. Other ready tasks wait without claiming execution.
  for(const w of [...state.workflows].reverse()) {
    if(!['queued','running'].includes(w.status))continue;
    const next=w.tasks.find(t=>t.status==='pending');if(!next||occupied.has(next.agent))continue;
    next.status='running';occupied.add(next.agent);w.status='running';changed=true;
    event(state,w,`${agents.find(a=>a.id===next.agent).name} started: ${next.title}`);
  }
  return changed;
}
function decideUnchecked(state,id,action) {
  const w=state.workflows.find(w=>w.id===id);if(!w||!['complete','cancel'].includes(action))return false;
  if(action==='complete') {
    if(w.status!=='awaiting review'||!w.result.trim())return false;
    w.status='completed';w.decision='Dave approved the edited result for this demo. Nothing was sent.';
  } else {
    if(!['queued','running','awaiting review','failed'].includes(w.status))return false;
    w.status='cancelled';w.decision='Dave cancelled the workflow.';
    w.tasks.forEach(t=>{if(t.status!=='completed')t.status='cancelled';});
  }
  event(state,w,w.decision);return true;
}
function failUnchecked(state,id) {
  const w=state.workflows.find(w=>w.id===id);if(!w||!['queued','running'].includes(w.status))return false;
  w.status='failed';w.failure='A simulated data source stopped responding. No real service was contacted.';
  const next=w.tasks.find(t=>['running','pending'].includes(t.status));if(next)next.status='failed';
  w.tasks.forEach(t=>{if(t.status==='pending')t.status='blocked';});
  event(state,w,'Simulated execution failed; remaining tasks are blocked');return true;
}
function retryUnchecked(state,id) {
  const w=state.workflows.find(w=>w.id===id);if(w?.status!=='failed')return false;
  w.status=w.step?'running':'queued';w.result='';w.failure=null;w.decision=null;
  w.tasks.forEach(t=>{if(t.status!=='completed')t.status='pending';});
  event(state,w,'Dave retried the failed task; completed work was retained');return true;
}
function editResultUnchecked(state,id,value) {
  const w=state.workflows.find(w=>w.id===id);if(w?.status!=='awaiting review'||typeof value!=='string'||value.length>MAX_RESULT_LENGTH)return false;
  w.result=value;return true;
}
function regenerateUnchecked(state,id) {
  const w=state.workflows.find(w=>w.id===id);if(w?.status!=='awaiting review')return false;
  w.drafts??=[];w.drafts.push({result:w.result,request:w.request,type:w.type,time:now()});
  w.revision=(w.revision??0)+1;
  const source=preparedResult(w).split('\n\n');
  const intro=source.splice(0,2),footer=source.pop();
  const offset=w.revision%source.length;
  const sections=[...source.slice(offset),...source.slice(0,offset)];
  const lead=w.type==='backlog'?'Decision focus: review security and budget exceptions before routine requests.':w.type==='update'?'Decision focus: confirm the Beacon blocker before communicating proposed dates.':'Decision focus: resolve the Beacon dependency and owner decisions before the next planning session.';
  w.result=[...intro,`Alternative ${w.revision} · ${lead}`,...sections,footer].join('\n\n');
  event(state,w,'Dave generated an alternative; the previous draft was retained');return true;
}
function restoreDraftUnchecked(state,id,index) {
  const w=state.workflows.find(w=>w.id===id),draft=w?.drafts?.[index];
  if(w?.status!=='awaiting review'||!Number.isInteger(index)||index<0||!draft)return false;
  w.drafts.push({result:w.result,request:w.request,type:w.type,time:now()});
  w.result=draft.result;event(state,w,'Dave restored a saved draft version');return true;
}
export function agentAssignments(state) {
  const fleet=agents.map(a=>({...a,assignments:[]})),byId=new Map(fleet.map(a=>[a.id,a]));
  for(const workflow of state.workflows)if(workflow.status==='running')for(const task of workflow.tasks)if(task.status==='running')byId.get(task.agent).assignments.push({workflow,task});
  return fleet;
}

export function matchesFilter(w,filter) {return filter==='all'||(filter==='active'?['queued','running'].includes(w.status):w.status===filter);}
export function decisionQueue(state) {
  return [...state.workflows].reverse().filter(w=>['awaiting review','failed'].includes(w.status)).sort((a,b)=>(a.status==='failed'?0:1)-(b.status==='failed'?0:1)||Date.parse(a.created)-Date.parse(b.created));
}
export function waitingReason(state,w) {
  if(!['queued','running'].includes(w.status)||w.tasks.some(t=>t.status==='running'))return null;
  const task=w.tasks.find(t=>t.status==='pending');if(!task)return null;
  const owner=agents.find(a=>a.id===task.agent);
  const other=state.workflows.find(other=>other.id!==w.id&&other.status==='running'&&other.tasks.some(t=>t.status==='running'&&t.agent===task.agent));
  return other?`${owner.name} is busy on “${other.request}”. This task will start when the agent is available.`:`Ready for ${owner.name} on the next simulation tick.`;
}

function seedDemoUnchecked(state) {
  if(state.workflows.length)return false;
  enqueueUnchecked(state,recipes.brief.label,'brief');for(let i=0;i<4;i++)tickUnchecked(state);
  enqueueUnchecked(state,recipes.update.label,'update');enqueueUnchecked(state,recipes.backlog.label,'backlog');tickUnchecked(state);
  failUnchecked(state,state.workflows.find(w=>w.type==='backlog').id);recordUnchecked(state,'Dave loaded the fictional demo scenario',null,'demo');return true;
}
export function restore(raw) {
  if(raw===null)return {state:createState(),notice:''};
  try {
    if(typeof raw!=='string'||snapshotFailure(raw))throw Error();
    const s=JSON.parse(raw);
    if(![1,2].includes(s?.version)||!Array.isArray(s.workflows)||!Array.isArray(s.activity))throw Error();
    const bounded=(value,max)=>typeof value==='string'&&value.length<=max;
    const ids=new Set();
    for(const w of s.workflows) {
      if(!w||typeof w.id!=='string'||ids.has(w.id)||typeof w.request!=='string'||!statuses.includes(w.status)||!Number.isInteger(w.step)||w.step<0||w.step>3||!Array.isArray(w.timeline)||!w.timeline.every(t=>t&&typeof t.text==='string'&&Number.isFinite(Date.parse(t.time)))||!Number.isFinite(Date.parse(w.created))||typeof w.result!=='string'||(w.decision!=null&&typeof w.decision!=='string'))throw Error();
      if(!bounded(w.id,LIMITS.idChars)||!bounded(w.request,LIMITS.requestChars)||!bounded(w.result,MAX_RESULT_LENGTH)||!w.timeline.every(t=>bounded(t.text,LIMITS.eventChars)))throw Error();
      ids.add(w.id);
      if(w.revision!==undefined&&(!Number.isSafeInteger(w.revision)||w.revision<0))throw Error();
      if(w.drafts!==undefined&&(!Array.isArray(w.drafts)||!w.drafts.every(d=>d&&bounded(d.result,MAX_RESULT_LENGTH)&&d.request===w.request&&d.type===w.type&&Number.isFinite(Date.parse(d.time)))))throw Error();
      if(s.version===1) {
        w.type=recipeFor(w.request);w.failure=w.status==='failed'?'Previously simulated failure. Retry to restart.':null;
        w.tasks=recipes[w.type].plan.map((title,i)=>({id:crypto.randomUUID(),title,agent:recipes[w.type].agents[i],status:i<w.step?'completed':w.status==='cancelled'?'cancelled':w.status==='failed'?(i===w.step?'failed':'blocked'):'pending'}));
      }
      if(!Object.hasOwn(recipes,w.type)||!Array.isArray(w.tasks)||w.tasks.length!==3||!w.tasks.every((t,i)=>t&&typeof t.id==='string'&&t.title===recipes[w.type].plan[i]&&t.agent===recipes[w.type].agents[i]&&['pending','running','completed','failed','blocked','cancelled'].includes(t.status))||w.tasks.filter(t=>t.status==='completed').length!==w.step)throw Error();
      if(!w.tasks.slice(0,w.step).every(t=>t.status==='completed') || new Set(w.tasks.map(t=>t.id)).size!==3)throw Error();
      if(['completed','awaiting review'].includes(w.status)&&w.step!==3)throw Error();
      if(['queued','running'].includes(w.status) && (w.step===3 || !w.tasks.slice(w.step).every(t=>['pending','running'].includes(t.status)) || w.tasks.filter(t=>t.status==='running').length>1 || w.tasks.some((t,i)=>t.status==='running'&&i!==w.step)))throw Error();
      if(w.status==='queued'&&w.step!==0)throw Error();
      if(w.status==='failed'&&(w.step===3||w.tasks[w.step].status!=='failed'||!w.tasks.slice(w.step+1).every(t=>t.status==='blocked')))throw Error();
      if(w.status==='cancelled'&&!w.tasks.slice(w.step).every(t=>t.status==='cancelled'))throw Error();
      if(w.status==='completed'&&!w.result.trim())throw Error();
      if(w.failure!=null&&typeof w.failure!=='string')throw Error();
    }
    if(!s.activity.every(a=>a&&bounded(a.id,LIMITS.idChars)&&bounded(a.message,LIMITS.eventChars)&&Number.isFinite(Date.parse(a.time))&&(a.workflowId==null||ids.has(a.workflowId))))throw Error();
    // Processes do not survive reload; return unfinished task claims to the local dispatcher.
    for(const w of s.workflows)for(const t of w.tasks)if(t.status==='running')t.status='pending';
    // Allowlist the demo model. Unknown identity, credential or policy fields are never adopted.
    const workflows=s.workflows.map(w=>({id:w.id,request:w.request,type:w.type,status:w.status,step:w.step,created:w.created,result:w.result,decision:w.decision??null,failure:w.failure??null,
      tasks:w.tasks.map(t=>({id:t.id,title:t.title,agent:t.agent,status:t.status})),timeline:w.timeline.map(t=>({text:t.text,time:t.time})),
      ...(w.revision!==undefined?{revision:w.revision}:{}),...(w.drafts?{drafts:w.drafts.map(d=>({result:d.result,request:d.request,type:d.type,time:d.time}))}:{})}));
    const activity=s.activity.map(a=>({id:a.id,workflowId:a.workflowId??null,message:a.message,time:a.time,kind:['request','execution','edit','demo'].includes(a.kind)?a.kind:'execution'}));
    const view=Object.fromEntries(Object.entries(s.view&&typeof s.view==='object'?s.view:{}).filter(([key,value])=>['selected','filter','taskFilter','historyFilter','process','timelineOpen'].includes(key)&&(typeof value==='boolean'||bounded(value,LIMITS.idChars))));
    const state={version:2,workflows,activity,view},overLimit=capacityFailure(state);
    return {state,notice:overLimit?'Saved workspace exceeds current admission limits. Existing content is available for review and download; changes that exceed a limit are rejected.':''};
  }catch {return {state:createState(),notice:'Saved demo data could not be read. An empty workspace was opened; the old data remains until you make a change or reset.'};}
}

/** Commit only admitted candidates; retain workflow identity for existing callers and UI selections. */
const mutations={record:recordUnchecked,enqueue:enqueueUnchecked,tick:tickUnchecked,decide:decideUnchecked,fail:failUnchecked,retry:retryUnchecked,editResult:editResultUnchecked,regenerate:regenerateUnchecked,restoreDraft:restoreDraftUnchecked,seedDemo:seedDemoUnchecked};
export function perform(state,operation,...args) {
 if(!Object.hasOwn(mutations,operation))return {ok:false,reason:{code:'unknown_operation',message:'Unknown workspace operation.'}};
 const input=operation==='enqueue'?args[0]?.trim?.():operation==='editResult'?args[1]:null;
 const limit=operation==='enqueue'?LIMITS.requestChars:LIMITS.resultChars;
 if(typeof input==='string'&&input.length>limit)return {ok:false,reason:{code:operation==='enqueue'?'request_limit':'result_limit',actual:input.length,limit,message:`Text exceeds the ${limit.toLocaleString('en-US')}-character limit. Existing content is retained.`}};
 const candidate=structuredClone(state),value=mutations[operation](candidate,...args);
 if(!value)return {ok:false,reason:{code:'invalid_operation',message:'This operation is not available for the current input or workflow state.'}};
 const reason=capacityFailure(candidate);if(reason)return {ok:false,reason};
 const existing=new Map(state.workflows.map(w=>[w.id,w]));
 state.workflows=candidate.workflows.map(w=>{const original=existing.get(w.id);if(original){Object.assign(original,w);return original;}return w;});
 state.activity=candidate.activity;
 return {ok:true,value:operation==='enqueue'?state.workflows.find(w=>w.id===value.id):value};
}
export function record(state,...args){return perform(state,'record',...args).ok;}
export function enqueue(state,...args){const result=perform(state,'enqueue',...args);return result.ok?result.value:null;}
export function tick(state){return perform(state,'tick').ok;}
export function decide(state,...args){return perform(state,'decide',...args).ok;}
export function fail(state,...args){return perform(state,'fail',...args).ok;}
export function retry(state,...args){return perform(state,'retry',...args).ok;}
export function editResult(state,...args){return perform(state,'editResult',...args).ok;}
export function regenerate(state,...args){return perform(state,'regenerate',...args).ok;}
export function restoreDraft(state,...args){return perform(state,'restoreDraft',...args).ok;}
export function seedDemo(state){return perform(state,'seedDemo').ok;}
