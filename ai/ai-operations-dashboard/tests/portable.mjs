import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const html=await readFile('dist/ai-os-demo.html');
const server=createServer((req,res)=>{if(req.url!=='/'){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html'});res.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const url=`http://127.0.0.1:${server.address().port}/`;
let browser;
try {
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
 const page=await browser.newPage({viewport:{width:1440,height:1200}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const extraRequests=[];page.on('request',r=>{if(/^https?:/.test(r.url())&&r.url()!==url)extraRequests.push(r.url());});
 await page.clock.install();await page.goto(url);await page.getByRole('button',{name:'Load demo scenario'}).click();assert.equal(await page.locator('.workflow').count(),3);
 await page.clock.runFor(1800*12);await page.getByRole('textbox',{name:'Prepared result',exact:true}).fill('Portable demo verified by Dave');
 await page.getByRole('button',{name:'Review approval'}).click();await page.getByRole('button',{name:'Approve brief locally'}).click();assert.equal(await page.locator('.result pre').textContent(),'Portable demo verified by Dave');
 await page.reload();assert.equal(await page.locator('.workflow').count(),3);assert.equal(await page.locator('.workflow').filter({hasText:'Completed'}).count(),1);
 assert.deepEqual(errors,[]);assert.deepEqual(extraRequests,[]);
 console.log('PASS: single-file artifact works, preserves approval on reload, and makes no asset/API requests. Tested over loopback HTTP; managed Chromium blocks file:// navigation.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
