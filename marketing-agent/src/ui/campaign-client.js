import { brief, profile, assets, kind, id, timestamp, canonical } from '../domain/validation.ts';
import {createAssets} from '../content/template-generator.ts';
export class CampaignClient {
 constructor(){this.workspaceId=null;this.actor=null;this.pending=new Map();this.offline=globalThis.MARKETING_OFFLINE_DEMO===true;this.demoCampaigns=[];this.demoReplies=new Map();}
 async connect(username='alice',switchAccount=false){
  if(this.offline){this.workspaceId='workspace-demo';this.actor={id:'offline-demo',name:'Offline preview'};return;}
  let result=switchAccount?null:await this.fetch('/api/session');
  if(!result?.ok){result=await this.fetch('/api/session',{username,password:`local-${username}`});}
  if(!result.ok)throw new Error(result.error.message);this.actor=result.value.actor;this.workspaceId=result.value.workspaces[0]?.id;
  if(!this.workspaceId)throw new Error('No owned workspace is available.');
 }
 async fetch(path,body){
  try{const response=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json','X-Campaign-Client':'1'}:{},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(typeof data?.ok!=='boolean')throw new Error('Unexpected response');return data;}
  catch{return {ok:false,error:{code:'PERSISTENCE_ERROR',message:'The local Campaign Service could not be reached. Run npm start; your edits are kept.',retryable:true}};}
 }
 async list(){if(this.offline)return {ok:true,value:structuredClone(this.demoCampaigns)};return this.fetch(`/api/campaigns?workspaceId=${encodeURIComponent(this.workspaceId)}`);}
 async write(operation,input){
  const signature=canonical({workspaceId:this.workspaceId,operation,input});
  let key=this.pending.get(signature);if(!key){key=crypto.randomUUID();this.pending.set(signature,key);}
  const result=this.offline?this.demoWrite(operation,input,key):await this.fetch(`/api/campaigns/${operation}`,{workspaceId:this.workspaceId,input,idempotencyKey:key});
  // Preserve the key after ambiguous transport/persistence failures so a retry is safe.
  if(result.ok || !result.error.retryable)this.pending.delete(signature);
  return result;
 }
 demoWrite(operation,input,key){
  // Deliberately isolated preview adapter, never a trusted authenticated service.
  const signature=canonical({operation,input});const previous=this.demoReplies.get(key);if(previous)return previous;
  const next=structuredClone(this.demoCampaigns);const now=new Date().toISOString();
  try{
   let value;
   if(operation==='import'){
    value={imported:[],unchanged:[],rejected:[],batchId:crypto.randomUUID()};
    if(!Array.isArray(input.records))throw new Error('History must be an array.');
    input.records.forEach((raw,index)=>{try{
     const tool=kind(['pack','calendar'].includes(raw?.tool)?'campaign':raw?.tool);const campaignId=raw.id===undefined?crypto.randomUUID():id(raw.id);
     if(next.some(c=>c.id===campaignId)){value.unchanged.push(campaignId);return;}
     if(typeof raw.copy!=='string')throw new Error('Invalid copy.');
     const created=raw.date===undefined?now:timestamp(raw.date);const versions=raw.versions===undefined?[raw]:raw.versions;if(!Array.isArray(versions)||!versions.length)throw new Error('Invalid versions.');
     const entries=versions.map(v=>{if(!v||typeof v!=='object')throw new Error('Invalid version.');return {id:crypto.randomUUID(),campaignId,revision:1,assets:assets(v.assets??{message:v.copy??raw.copy}),variant:v.variant===1?1:0,label:v.label||'Imported',createdBy:this.actor.id,createdAt:created,updatedAt:created};});
     next.push({id:campaignId,workspaceId:this.workspaceId,kind:tool,brief:brief(raw,true),profile:profile(raw.profile??{}),revision:1,archived:raw.archived===true,createdBy:this.actor.id,createdAt:created,updatedAt:created,versions:entries});value.imported.push(campaignId);
    }catch(error){value.rejected.push({index,error:{code:'VALIDATION_ERROR',message:error.message,retryable:false}});}});
   }else if(operation==='create'){
    const campaignId=input.id||crypto.randomUUID();if(next.some(c=>c.id===campaignId))throw new Error('Identifier already exists.');
    const s=brief(input.brief),p=profile(input.profile),tool=kind(input.kind);const generated=assets(createAssets(tool,s,p,input.variant));
    value={id:campaignId,workspaceId:this.workspaceId,kind:tool,brief:s,profile:p,revision:1,archived:false,createdBy:this.actor.id,createdAt:now,updatedAt:now,versions:[{id:crypto.randomUUID(),campaignId,revision:1,assets:generated,variant:input.variant,label:`Template ${input.variant+1}`,createdBy:this.actor.id,createdAt:now,updatedAt:now}]};next.unshift(value);
   }else{
    value=next.find(c=>c.id===input.campaignId);if(!value)throw new Error('Campaign not found.');if(value.revision!==input.expectedRevision)return {ok:false,error:{code:'REVISION_CONFLICT',message:'Preview changed. Reload the creation.',retryable:false}};
    if(operation==='archive'||operation==='restore'){const archived=operation==='archive';if(value.archived!==archived){value.archived=archived;value.revision++;}}
    else if(operation==='saveVersion'){
     if(value.archived)throw new Error('Restore before editing.');const checked=assets(input.assets);if(!value.versions.some(v=>canonical(v.assets)===canonical(checked))){value.versions.push({id:crypto.randomUUID(),campaignId:value.id,revision:1,assets:checked,variant:input.variant,label:input.label,createdBy:this.actor.id,createdAt:now,updatedAt:now});value.revision++;}
    }else throw new Error('Unknown preview operation.');value.updatedAt=now;
   }
   this.demoCampaigns=next;const result={ok:true,value:structuredClone(value)};this.demoReplies.set(key,{...result,signature});return result;
  }catch(error){return {ok:false,error:{code:'VALIDATION_ERROR',message:error.message,retryable:false}};}
 }
}
export function campaignToHistory(campaign){
 const last=campaign.versions.at(-1);
 return {id:campaign.id,revision:campaign.revision,tool:campaign.kind,...campaign.brief,profile:campaign.profile,date:campaign.createdAt,copy:Object.values(last.assets).join('\n\n'),assets:last.assets,variant:last.variant,versions:campaign.versions.map(v=>({...v,copy:Object.values(v.assets).join('\n\n'),date:v.createdAt})),_campaign:campaign};
}
