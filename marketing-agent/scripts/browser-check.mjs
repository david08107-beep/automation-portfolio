import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {SqliteRepository} from '../build/src/infrastructure/sqlite-repository.js';
import {CampaignService} from '../build/src/application/campaign-service.js';
import {TemplateContentGenerator} from '../build/src/content/template-generator.js';
import {createHttpServer} from '../build/src/server/http.js';
mkdirSync('.cache',{recursive:true});const dir=mkdtempSync(join(resolve('.cache'),'browser-'));
const repository=new SqliteRepository(join(dir,'campaigns.sqlite'));
const server=createHttpServer(repository,new CampaignService(repository,new TemplateContentGenerator()),resolve('dist'));
function run(file){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,[file],{stdio:'inherit',env:{...process.env,APP_URL:`http://127.0.0.1:${server.address().port}`}});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`${file} failed with ${code}`)));});}
try{await new Promise(r=>server.listen(0,'127.0.0.1',r));await run('checks/browser.cjs');await run('checks/campaign-browser.cjs');}finally{await new Promise(r=>server.close(r));repository.close();rmSync(dir,{recursive:true,force:true});}
