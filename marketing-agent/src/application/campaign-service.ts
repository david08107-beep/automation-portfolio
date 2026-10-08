import {createHash,randomUUID} from 'node:crypto';
import type {ActorContext,Assets,Campaign,CampaignVersion,ContentGenerator,ImportReport,ServiceResult} from '../domain/contracts.js';
import {DomainError,assets,brief,canonical,id,keys,kind,object,profile,revision,text,timestamp,variant} from '../domain/validation.js';
import {SqliteRepository} from '../infrastructure/sqlite-repository.js';
export class CampaignService {
 constructor(private readonly repository:SqliteRepository,private readonly generator:ContentGenerator) {}
 private execute<T>(action:()=>T):ServiceResult<T> {try{return {ok:true,value:action()};}catch(error){return {ok:false,error:error instanceof DomainError?error.toStructured():{code:'PERSISTENCE_ERROR',message:'The operation could not be committed. Your saved data was not changed.',retryable:true}};}}
 private authorize(context:ActorContext):void {id(context?.actor?.id);id(context?.workspaceId);this.repository.authorize(context.actor.id,context.workspaceId);}
 private write<T>(context:ActorContext,key:unknown,operation:string,request:unknown,action:()=>T):ServiceResult<T> {
  return this.execute(()=>this.repository.transaction(()=>{
   this.authorize(context);const validKey=text(key,'Idempotency key',128);const hash=createHash('sha256').update(canonical({operation,request})).digest('hex');
   const stored=this.repository.db.prepare('SELECT request_hash,response FROM idempotency WHERE actor_id=? AND workspace_id=? AND key=?').get(context.actor.id,context.workspaceId,validKey);
   if(stored){if(stored.request_hash!==hash)throw new DomainError('IDEMPOTENCY_CONFLICT','This key was already used for a different request.');return JSON.parse(String(stored.response)) as T;}
   const value=action();this.repository.db.prepare('INSERT INTO idempotency VALUES (?,?,?,?,?)').run(context.actor.id,context.workspaceId,validKey,hash,JSON.stringify(value));return value;
  }));
 }
 private checked<T>(validation:()=>ServiceResult<T>):ServiceResult<T> {try{return validation();}catch(error){return {ok:false,error:error instanceof DomainError?error.toStructured():{code:'VALIDATION_ERROR',message:'Invalid request.',retryable:false}};}}
 private current(context:ActorContext,campaignId:string,expected:number):Campaign {const campaign=this.repository.get(campaignId,context.workspaceId);if(campaign.revision!==expected)throw new DomainError('REVISION_CONFLICT','Campaign changed. Reload before saving.',{currentRevision:campaign.revision});return campaign;}
 private version(campaignId:string,context:ActorContext,value:Assets,selection:0|1,label:string,createdAt=new Date().toISOString()):CampaignVersion {return {id:randomUUID(),campaignId,revision:1,assets:value,variant:selection,label,createdBy:context.actor.id,createdAt,updatedAt:createdAt};}
 createCampaign(context:ActorContext,input:unknown,key:unknown):ServiceResult<Campaign> {
  return this.checked(()=>{const data=object(input);keys(data,['id','kind','brief','profile','variant']);const checked={...(data.id!==undefined?{id:id(data.id)}:{}),kind:kind(data.kind),brief:brief(data.brief),profile:profile(data.profile),variant:variant(data.variant)};
   return this.write(context,key,'createCampaign',checked,()=>{const campaignId=checked.id || randomUUID();if(this.repository.db.prepare('SELECT id FROM campaigns WHERE id=?').get(campaignId))throw new DomainError('ID_CONFLICT','Campaign identifier is unavailable.');const now=new Date().toISOString();const generated=assets(this.generator.generate(checked.kind,checked.brief,checked.profile,checked.variant));const campaign:Campaign={id:campaignId,workspaceId:context.workspaceId,kind:checked.kind,brief:checked.brief,profile:checked.profile,revision:1,archived:false,createdBy:context.actor.id,createdAt:now,updatedAt:now,versions:[this.version(campaignId,context,generated,checked.variant,`Template ${checked.variant+1}`,now)]};this.repository.insert(campaign);return campaign;});
  });
 }
 getCampaign(context:ActorContext,campaignId:unknown):ServiceResult<Campaign> {return this.checked(()=>{const validId=id(campaignId);return this.execute(()=>this.repository.transaction(()=>{this.authorize(context);return this.repository.get(validId,context.workspaceId);}));});}
 listCampaigns(context:ActorContext):ServiceResult<Campaign[]> {return this.execute(()=>this.repository.transaction(()=>{this.authorize(context);return this.repository.list(context.workspaceId);}));}
 saveCampaignVersion(context:ActorContext,input:unknown,key:unknown):ServiceResult<Campaign> {
  return this.checked(()=>{const data=object(input);keys(data,['campaignId','expectedRevision','assets','variant','label']);const checked={campaignId:id(data.campaignId),expectedRevision:revision(data.expectedRevision),assets:assets(data.assets),variant:variant(data.variant),label:text(data.label,'Label',160)};
   return this.write(context,key,'saveCampaignVersion',checked,()=>{const campaign=this.current(context,checked.campaignId,checked.expectedRevision);if(campaign.archived)throw new DomainError('ARCHIVED','Restore the campaign before editing.');if(campaign.versions.some(v=>canonical(v.assets)===canonical(checked.assets)))return campaign;const version=this.version(campaign.id,context,checked.assets,checked.variant,checked.label);this.repository.insertVersion(version);const next={...campaign,revision:campaign.revision+1,updatedAt:version.updatedAt,versions:[...campaign.versions,version]};this.repository.update(next,campaign.revision);return next;});
  });
 }
 updateCampaignVersion(context:ActorContext,input:unknown,key:unknown):ServiceResult<Campaign> {
  return this.checked(()=>{const data=object(input);keys(data,['campaignId','versionId','expectedRevision','expectedVersionRevision','assets','variant','label']);const checked={campaignId:id(data.campaignId),versionId:id(data.versionId),expectedRevision:revision(data.expectedRevision),expectedVersionRevision:revision(data.expectedVersionRevision),assets:assets(data.assets),variant:variant(data.variant),label:text(data.label,'Label',160)};
   return this.write(context,key,'updateCampaignVersion',checked,()=>{const campaign=this.current(context,checked.campaignId,checked.expectedRevision);if(campaign.archived)throw new DomainError('ARCHIVED','Restore the campaign before editing.');const original=campaign.versions.find(v=>v.id===checked.versionId);if(!original)throw new DomainError('NOT_FOUND','Version not found.');if(original.revision!==checked.expectedVersionRevision)throw new DomainError('REVISION_CONFLICT','Version changed. Reload before saving.',{currentRevision:original.revision});const nextVersion={...original,assets:checked.assets,variant:checked.variant,label:checked.label,revision:original.revision+1,updatedAt:new Date().toISOString()};this.repository.updateVersion(nextVersion,original.revision);const next={...campaign,revision:campaign.revision+1,updatedAt:nextVersion.updatedAt,versions:campaign.versions.map(v=>v.id===original.id?nextVersion:v)};this.repository.update(next,campaign.revision);return next;});
  });
 }
 private setArchived(context:ActorContext,input:unknown,key:unknown,archived:boolean):ServiceResult<Campaign> {
  return this.checked(()=>{const data=object(input);keys(data,['campaignId','expectedRevision']);const checked={campaignId:id(data.campaignId),expectedRevision:revision(data.expectedRevision)};
   return this.write(context,key,archived?'archiveCampaign':'restoreCampaign',checked,()=>{const campaign=this.current(context,checked.campaignId,checked.expectedRevision);if(campaign.archived===archived)return campaign;const next={...campaign,archived,revision:campaign.revision+1,updatedAt:new Date().toISOString()};this.repository.update(next,campaign.revision);return next;});
  });
 }
 archiveCampaign(context:ActorContext,input:unknown,key:unknown):ServiceResult<Campaign>{return this.setArchived(context,input,key,true);}
 restoreCampaign(context:ActorContext,input:unknown,key:unknown):ServiceResult<Campaign>{return this.setArchived(context,input,key,false);}
 importHistory(context:ActorContext,input:unknown,key:unknown):ServiceResult<ImportReport> {
  return this.checked(()=>{const data=object(input);keys(data,['records']);if(!Array.isArray(data.records)||data.records.length>2000)throw new DomainError('VALIDATION_ERROR','History must be an array of at most 2000 records.');const records=data.records;
   return this.write(context,key,'importHistory',{records},()=>{
    const report:ImportReport={imported:[],unchanged:[],rejected:[],batchId:randomUUID()};
    records.forEach((raw,index)=>{
     let checked:Campaign;let fingerprint='';
     try {
      const legacy=object(raw,'History record');fingerprint=createHash('sha256').update(canonical(raw)).digest('hex');
      const prior=this.repository.db.prepare('SELECT campaign_id FROM import_records WHERE workspace_id=? AND fingerprint=?').get(context.workspaceId,fingerprint);if(prior){report.unchanged.push(String(prior.campaign_id));return;}
      const originalKind=legacy.tool;const mapped=['pack','calendar'].includes(originalKind as string)?'campaign':originalKind;const normalizedKind=kind(mapped);
      text(legacy.copy,'Copy',500000,true);const normalizedBrief=brief(legacy,true);const campaignId=legacy.id===undefined?`import-${fingerprint.slice(0,40)}`:id(legacy.id);
      if(this.repository.db.prepare('SELECT id FROM campaigns WHERE id=?').get(campaignId))throw new DomainError('ID_CONFLICT','Imported identifier already exists; existing data was not overwritten.');
      const createdAt=legacy.date===undefined?new Date().toISOString():timestamp(legacy.date);if(legacy.archived!==undefined && typeof legacy.archived!=='boolean')throw new DomainError('VALIDATION_ERROR','Invalid archived flag.');
      let sourceVersions:unknown[];
      if(legacy.versions!==undefined){if(!Array.isArray(legacy.versions)||!legacy.versions.length||legacy.versions.length>500)throw new DomainError('VALIDATION_ERROR','Invalid versions.');sourceVersions=legacy.versions;}else sourceVersions=[legacy];
      const usedVersionIds=new Set<string>();
      const normalizedVersions=sourceVersions.map(rawVersion=>{const v=object(rawVersion,'Version');if(v.copy!==undefined)text(v.copy,'Version copy',500000,true);const value=v.assets!==undefined?assets(v.assets):assets({message:text(v.copy??legacy.copy,'Version copy',500000,true)});const version=this.version(campaignId,context,value,v.variant===undefined?0:variant(v.variant),v.label===undefined?'Imported':text(v.label,'Version label',160),v.date===undefined?createdAt:timestamp(v.date));if(v.id!==undefined)version.id=id(v.id);if(usedVersionIds.has(version.id)||this.repository.db.prepare('SELECT id FROM versions WHERE id=?').get(version.id))throw new DomainError('ID_CONFLICT','Imported version identifier already exists.');usedVersionIds.add(version.id);return version;});
      checked={id:campaignId,workspaceId:context.workspaceId,kind:normalizedKind,brief:normalizedBrief,profile:legacy.profile===undefined?profile({}):profile(legacy.profile),revision:1,archived:legacy.archived===true,createdBy:context.actor.id,createdAt,updatedAt:createdAt,versions:normalizedVersions,...(legacy.id!==undefined?{legacyId:campaignId}:{})};
      // Preserve distinct current assets if older snapshots do not include them.
      const current=legacy.assets!==undefined?assets(legacy.assets):assets({message:String(legacy.copy)});
      if(!normalizedVersions.some(v=>canonical(v.assets)===canonical(current)))checked.versions.push(this.version(campaignId,context,current,0,'Imported current',createdAt));
     }catch(error){if(!(error instanceof DomainError))throw error;report.rejected.push({index,error:error.toStructured()});return;}
     // Database failures abort the complete batch instead of masquerading as invalid records.
     this.repository.insert(checked);this.repository.db.prepare('INSERT INTO import_records VALUES (?,?,?)').run(context.workspaceId,fingerprint,checked.id);report.imported.push(checked.id);
    });
    this.repository.db.prepare('INSERT INTO imports VALUES (?,?,?,?)').run(report.batchId,context.workspaceId,JSON.stringify(records),JSON.stringify(report));return report;
   });
  });
 }
}
