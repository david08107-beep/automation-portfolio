import {createServer, type IncomingMessage,type ServerResponse} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {CampaignService} from '../application/campaign-service.js';
import {SqliteRepository} from '../infrastructure/sqlite-repository.js';
import {DomainError,id,keys,object,text} from '../domain/validation.js';
import type {ActorContext,ServiceResult} from '../domain/contracts.js';
const status:Record<string,number>={VALIDATION_ERROR:422,UNAUTHENTICATED:401,FORBIDDEN:403,NOT_FOUND:404,REVISION_CONFLICT:409,IDEMPOTENCY_CONFLICT:409,ID_CONFLICT:409,ARCHIVED:409,PERSISTENCE_ERROR:503};
function send(res:ServerResponse,result:ServiceResult<unknown>):void {res.statusCode=result.ok?200:status[result.error.code]||500;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(result));}
async function body(req:IncomingMessage):Promise<unknown> {if(!req.headers['content-type']?.startsWith('application/json'))throw new DomainError('VALIDATION_ERROR','JSON body required.');let size=0;const parts:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>5*1024*1024)throw new DomainError('VALIDATION_ERROR','Request is too large.');parts.push(chunk);}try{return JSON.parse(Buffer.concat(parts).toString());}catch{throw new DomainError('VALIDATION_ERROR','Malformed JSON.');}}
export function createHttpServer(repository:SqliteRepository,service:CampaignService,staticDirectory:string) {
 return createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
  try{
   const url=new URL(req.url||'/',`http://${req.headers.host}`);
   if(url.pathname.startsWith('/api/')){
    if(!['GET','POST'].includes(req.method||''))throw new DomainError('VALIDATION_ERROR','Unsupported method.');
    if(req.method==='POST'){
     const origin=req.headers.origin;
     if(origin && origin!==`http://${req.headers.host}`)throw new DomainError('FORBIDDEN','Cross-origin writes are not allowed.');
     if(req.headers['x-campaign-client']!=='1')throw new DomainError('FORBIDDEN','Missing same-origin client header.');
    }
    if(url.pathname==='/api/session' && req.method==='POST'){
     const data=object(await body(req));keys(data,['username','password']);const actor=repository.authenticate(text(data.username,'Username',100),text(data.password,'Password',100));if(!actor)throw new DomainError('UNAUTHENTICATED','Invalid local test credentials.');
     res.setHeader('Set-Cookie',`campaign_session=${repository.session(actor)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);
     send(res,{ok:true,value:{actor,workspaces:repository.workspaces(actor)}});return;
    }
    const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('campaign_session='))?.slice('campaign_session='.length)||'';
    const actor=repository.actorForSession(token);if(!actor)throw new DomainError('UNAUTHENTICATED','Sign in to the local workspace.');
    if(url.pathname==='/api/session'&&req.method==='GET'){send(res,{ok:true,value:{actor,workspaces:repository.workspaces(actor)}});return;}
    if(url.pathname==='/api/campaigns'&&req.method==='GET'){const context:ActorContext={actor,workspaceId:id(url.searchParams.get('workspaceId'))};send(res,service.listCampaigns(context));return;}
    if(url.pathname==='/api/campaigns/get'&&req.method==='GET'){send(res,service.getCampaign({actor,workspaceId:id(url.searchParams.get('workspaceId'))},url.searchParams.get('campaignId')));return;}
    if(req.method==='POST'&&url.pathname.startsWith('/api/campaigns/')){
     const data=object(await body(req));keys(data,['workspaceId','input','idempotencyKey']);const context:ActorContext={actor,workspaceId:id(data.workspaceId)};const methods={create:service.createCampaign,saveVersion:service.saveCampaignVersion,updateVersion:service.updateCampaignVersion,archive:service.archiveCampaign,restore:service.restoreCampaign,import:service.importHistory};const method:((context:ActorContext,input:unknown,key:unknown)=>ServiceResult<unknown>)|undefined=methods[url.pathname.slice('/api/campaigns/'.length) as keyof typeof methods];if(!method)throw new DomainError('NOT_FOUND','Unknown operation.');send(res,method.call(service,context,data.input,data.idempotencyKey));return;
    }
    throw new DomainError('NOT_FOUND','API route not found.');
   }
   if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end();return;}
   const base=resolve(staticDirectory),path=resolve(base,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(base+sep))throw new DomainError('FORBIDDEN','Invalid path.');
   const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.map':'application/json'};
   if(!mime[extname(path)]){res.statusCode=404;res.end();return;}
   let file:Buffer;try{file=readFileSync(path);}catch{res.statusCode=404;res.end();return;}res.setHeader('Content-Type',mime[extname(path)]!);res.end(req.method==='HEAD'?undefined:file);
  }catch(error){send(res,{ok:false,error:error instanceof DomainError?error.toStructured():{code:'PERSISTENCE_ERROR',message:'The local service is unavailable.',retryable:true}});}
 });
}
