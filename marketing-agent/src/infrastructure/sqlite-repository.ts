import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID,scryptSync} from 'node:crypto';
import type {Actor,Campaign,CampaignVersion} from '../domain/contracts.js';
import {DomainError} from '../domain/validation.js';
export class SqliteRepository {
 readonly db: DatabaseSync;
 constructor(path:string,private readonly beforeCommit?:()=>void) {
  this.db=new DatabaseSync(path);this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;');
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS actors(id TEXT PRIMARY KEY,name TEXT NOT NULL,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES actors(id),name TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES actors(id),expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),revision INTEGER NOT NULL,archived INTEGER NOT NULL DEFAULT 0,data TEXT NOT NULL);
   CREATE INDEX IF NOT EXISTS campaigns_workspace ON campaigns(workspace_id);
   CREATE TABLE IF NOT EXISTS versions(id TEXT PRIMARY KEY,campaign_id TEXT NOT NULL REFERENCES campaigns(id),revision INTEGER NOT NULL,data TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS idempotency(actor_id TEXT NOT NULL,workspace_id TEXT NOT NULL,key TEXT NOT NULL,request_hash TEXT NOT NULL,response TEXT NOT NULL,PRIMARY KEY(actor_id,workspace_id,key));
   CREATE TABLE IF NOT EXISTS imports(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,raw TEXT NOT NULL,report TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS import_records(workspace_id TEXT NOT NULL,fingerprint TEXT NOT NULL,campaign_id TEXT NOT NULL,PRIMARY KEY(workspace_id,fingerprint));
  `);
  for(const [name,label]of [['alice','Alice'],['bob','Bob']]) {
   const actorId=`actor-${name}`,passwordHash=scryptSync(`local-${name}`,`fixture-${name}`,32).toString('hex');
   this.db.prepare('INSERT OR IGNORE INTO actors VALUES (?,?,?,?)').run(actorId,label!,name!,passwordHash);
   this.db.prepare('INSERT OR IGNORE INTO workspaces VALUES (?,?,?)').run(`workspace-${name}`,actorId,`${label} local workspace`);
  }
 }
 transaction<T>(action:()=>T):T {this.db.exec('BEGIN IMMEDIATE');try{const value=action();this.beforeCommit?.();this.db.exec('COMMIT');return value;}catch(error){try{this.db.exec('ROLLBACK');}catch{}throw error;}}
 authorize(actorId:string,workspaceId:string):void {const row=this.db.prepare('SELECT owner_id FROM workspaces WHERE id=?').get(workspaceId);if(!row || row.owner_id!==actorId)throw new DomainError('FORBIDDEN','You do not own this workspace.');}
 get(id:string,workspaceId:string):Campaign {const row=this.db.prepare('SELECT data FROM campaigns WHERE id=? AND workspace_id=?').get(id,workspaceId);if(!row)throw new DomainError('NOT_FOUND','Campaign not found.');const campaign=JSON.parse(String(row.data)) as Campaign;campaign.versions=this.db.prepare('SELECT data FROM versions WHERE campaign_id=? ORDER BY rowid').all(id).map(v=>JSON.parse(String(v.data)) as CampaignVersion);return campaign;}
 list(workspaceId:string):Campaign[] {return this.db.prepare('SELECT id FROM campaigns WHERE workspace_id=? ORDER BY rowid DESC').all(workspaceId).map(row=>this.get(String(row.id),workspaceId));}
 insert(campaign:Campaign):void {const {versions,...data}=campaign;this.db.prepare('INSERT INTO campaigns VALUES (?,?,?,?,?)').run(campaign.id,campaign.workspaceId,campaign.revision,Number(campaign.archived),JSON.stringify(data));for(const version of versions)this.insertVersion(version);}
 insertVersion(version:CampaignVersion):void {this.db.prepare('INSERT INTO versions VALUES (?,?,?,?)').run(version.id,version.campaignId,version.revision,JSON.stringify(version));}
 update(campaign:Campaign,expectedRevision:number):void {const {versions:_,...data}=campaign;const result=this.db.prepare('UPDATE campaigns SET revision=?,archived=?,data=? WHERE id=? AND workspace_id=? AND revision=?').run(campaign.revision,Number(campaign.archived),JSON.stringify(data),campaign.id,campaign.workspaceId,expectedRevision);if(result.changes!==1)throw new DomainError('REVISION_CONFLICT','Campaign changed. Reload before saving.');}
 updateVersion(version:CampaignVersion,expectedRevision:number):void {const result=this.db.prepare('UPDATE versions SET revision=?,data=? WHERE id=? AND campaign_id=? AND revision=?').run(version.revision,JSON.stringify(version),version.id,version.campaignId,expectedRevision);if(result.changes!==1)throw new DomainError('REVISION_CONFLICT','Version changed. Reload before saving.');}
 authenticate(username:string,password:string):Actor|null {const row=this.db.prepare('SELECT * FROM actors WHERE username=?').get(username);if(!row)return null;const hash=scryptSync(password,`fixture-${username}`,32).toString('hex');if(hash!==row.password_hash)return null;return {id:String(row.id),name:String(row.name)};}
 session(actor:Actor):string {const token=randomUUID()+randomUUID();this.db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(createHash('sha256').update(token).digest('hex'),actor.id,Date.now()+24*60*60*1000);return token;}
 actorForSession(token:string):Actor|null {const row=this.db.prepare('SELECT actors.id,actors.name FROM sessions JOIN actors ON actors.id=sessions.actor_id WHERE token_hash=? AND expires>?').get(createHash('sha256').update(token).digest('hex'),Date.now());return row?{id:String(row.id),name:String(row.name)}:null;}
 workspaces(actor:Actor) {return this.db.prepare('SELECT id,owner_id as ownerId,name FROM workspaces WHERE owner_id=?').all(actor.id);}
 close():void{if(this.db.isOpen)this.db.close();}
}
