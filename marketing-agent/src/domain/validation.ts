import type {Assets, Brief, Profile, CampaignKind, ErrorCode, StructuredError} from './contracts.js';
export class DomainError extends Error {
 constructor(public readonly code: ErrorCode, message: string, public readonly details?: Record<string,unknown>) { super(message); }
 toStructured(): StructuredError {return {code:this.code,message:this.message,retryable:this.code==='PERSISTENCE_ERROR',...(this.details?{details:this.details}:{})};}
}
export function invalid(message:string):never {throw new DomainError('VALIDATION_ERROR',message);}
export function object(value:unknown, name='Input'):Record<string,unknown> {if(!value || typeof value!=='object' || Array.isArray(value))invalid(`${name} must be an object.`);return value as Record<string,unknown>;}
export function keys(value:Record<string,unknown>,allowed:string[]):void {if(Object.keys(value).some(k=>!allowed.includes(k)))invalid('Unexpected input fields.');}
export function text(value:unknown,name:string,max=10000,empty=false):string {if(typeof value!=='string' || value.length>max || (!empty&&!value.trim()))invalid(`${name} must be a valid string.`);return value;}
export function id(value:unknown):string {const result=text(value,'ID',128);if(!/^[A-Za-z0-9_-]+$/.test(result))invalid('Invalid identifier.');return result;}
export function revision(value:unknown):number {if(!Number.isSafeInteger(value) || (value as number)<1)invalid('Revision must be a positive integer.');return value as number;}
export function variant(value:unknown):0|1 {if(value!==0&&value!==1)invalid('Variant must be 0 or 1.');return value;}
export function kind(value:unknown):CampaignKind {if(!['social','campaign','review','followup'].includes(value as string))invalid('Unknown campaign kind.');return value as CampaignKind;}
export function assets(value:unknown):Assets {const map=object(value,'Assets');if(Object.keys(map).length<1 || Object.keys(map).length>32)invalid('Assets must have between 1 and 32 entries.');const result:Assets={};let total=0;for(const [name,content]of Object.entries(map)){text(name,'Asset name',160);if(['__proto__','constructor','prototype'].includes(name))invalid('Reserved asset name.');result[name]=text(content,'Asset text',50000,true);total+=result[name]!.length;}if(total>500000)invalid('Assets are too large.');return result;}
export const briefDefaults:Brief={topic:'',goal:'Get bookings',platform:'Instagram',tone:'Warm & playful',offer:'',deadline:'',reviewSentiment:'Mixed or unsure',followupPurpose:'Check in after a visit',customerName:''};
export function brief(value:unknown,legacy=false):Brief {
 const data=object(value,'Brief');if(!legacy)keys(data,Object.keys(briefDefaults));const result={...briefDefaults};
 for(const key of Object.keys(result) as (keyof Brief)[]) {if(data[key]!==undefined)result[key]=text(data[key],key,key==='topic'?10000:1000,key!=='topic');}
 text(result.topic,'Topic');
 for(const [key,options]of Object.entries({goal:['Get bookings','Build awareness','Start conversations','Thank customers'],platform:['Instagram','Facebook','TikTok'],tone:['Warm & playful','Polished & helpful','Bold & punchy','Neighborly & sincere'],reviewSentiment:['Mixed or unsure','Positive','Negative'],followupPurpose:['Check in after a visit','Invite a rebooking','Follow up on a concern']}))if(!options.includes(result[key as keyof Brief]))invalid(`Invalid ${key}.`);
 if(result.deadline && (!/^\d{4}-\d{2}-\d{2}$/.test(result.deadline)||(!Number.isFinite(Date.parse(result.deadline))||new Date(result.deadline).toISOString().slice(0,10)!==result.deadline)))invalid('Invalid deadline.');
 return result;
}
export const profileDefaults:Profile={name:'Paws & Polish',type:'Boutique dog grooming and spa care',difference:'Gentle one-on-one care and a personal touch for every pup.',location:'our neighborhood',voice:'Warm & playful',tagline:'',booking:'',audience:'Local dog parents'};
export function profile(value:unknown):Profile {const data=object(value,'Profile');keys(data,Object.keys(profileDefaults));const result={...profileDefaults};for(const key of Object.keys(result) as (keyof Profile)[])if(data[key]!==undefined)result[key]=text(data[key],key,1000,key!=='name');return result;}
export function timestamp(value:unknown):string {const result=text(value,'Timestamp',64);if(!Number.isFinite(Date.parse(result)))invalid('Invalid timestamp.');return new Date(result).toISOString();}
export function canonical(value:unknown):string {if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';return JSON.stringify(value) ?? 'null';}
