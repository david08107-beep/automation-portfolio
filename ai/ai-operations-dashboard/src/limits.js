/** Canonical local-demo admission limits. Snapshot size is measured in JS string characters, not bytes. */
export const LIMITS=Object.freeze({workflows:500,draftsPerWorkflow:1000,activity:20_000,timelinePerWorkflow:10_000,snapshotChars:10_000_000,viewReserveChars:2000,requestChars:500,resultChars:100_000,idChars:200,eventChars:5000});
export function capacityFailure(state) {
 const checks=[['workflow_limit',state.workflows.length,LIMITS.workflows,'Workflow limit reached. Existing workflows are retained.'],['activity_limit',state.activity.length,LIMITS.activity,'Activity history limit reached. Existing history is retained.']];
 for(const w of state.workflows){
  checks.push(['draft_limit',w.drafts?.length??0,LIMITS.draftsPerWorkflow,'Saved draft limit reached. Existing drafts are retained.'],['timeline_limit',w.timeline.length,LIMITS.timelinePerWorkflow,'Workflow timeline limit reached. Existing events are retained.']);
  if(!Number.isSafeInteger(w.revision??0))return {code:'revision_limit',message:'Draft revision limit reached.'};
 }
 for(const [code,actual,limit,message] of checks)if(actual>limit)return {code,actual,limit,message};
 const {view,...domain}=state;
 const actual=JSON.stringify(domain).length,limit=LIMITS.snapshotChars-LIMITS.viewReserveChars;
 if(actual>limit)return {code:'snapshot_limit',actual,limit,message:'Workspace size limit reached. No existing content was removed.'};
 return null;
}
export function snapshotFailure(snapshot) {
 return snapshot.length>LIMITS.snapshotChars?{code:'snapshot_limit',actual:snapshot.length,limit:LIMITS.snapshotChars,message:'Saved workspace exceeds the snapshot size limit.'}:null;
}
