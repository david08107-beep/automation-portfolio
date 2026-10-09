(function(root){
  'use strict';
  const contexts=Object.freeze({
    personal:Object.freeze({title:'Personal · Life & home',subtitle:'Family messages, appointments, bills, errands, and personal plans.',scope:'Changes here stay in Personal. Work emails, business campaigns, and work decisions belong in Work.',inbox:'Personal inbox',calendar:'Personal calendar',tasks:'Personal to-dos',research:'Personal planning',placeholder:'Ask about family messages, appointments, bills, or errands…'}),
    work:Object.freeze({title:'Work · Business & team',subtitle:'Work emails, client meetings, projects, team decisions, and business content.',scope:'Changes here stay in Work. Family messages, household reminders, and personal plans belong in Personal.',inbox:'Work inbox',calendar:'Work calendar',tasks:'Work tasks',research:'Work research',placeholder:'Ask about work emails, client meetings, projects, or deadlines…'})
  });
  function context(id){if(!Object.hasOwn(contexts,id))throw new Error('Unknown workspace');return contexts[id];}
  function businessAllowed(id){return id==='work';}
  function reset(saved,id,fresh){context(id);return {...saved,[id]:fresh()};}
  const policy=Object.freeze({context,businessAllowed,reset});
  if(typeof module==='object' && module.exports)module.exports=policy;
  else root.OrbitWorkspacePolicy=policy;
})(typeof globalThis!=='undefined'?globalThis:this);
