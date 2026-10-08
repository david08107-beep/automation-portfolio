import {chromium} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const html=await readFile(resolve(root,'dist/ai-os-demo.html'));
const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined});
 const page=await browser.newPage({viewport:{width:1440,height:1340},timezoneId:'America/New_York'});
 await page.clock.install();await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.getByRole('button',{name:'Load demo scenario'}).click();await page.clock.runFor(1800);
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));
 await page.screenshot({path:resolve(root,'dist/preview-overview.png')});
 await page.screenshot({path:resolve(root,'dist/preview-full.png'),fullPage:true});
 await page.locator('.workspace').scrollIntoViewIfNeeded();
 await page.evaluate(()=>document.querySelector('.workspace').scrollIntoView({behavior:'instant',block:'start'}));
 await page.screenshot({path:resolve(root,'dist/preview-workspace.png')});
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 await page.screenshot({path:resolve(root,'dist/preview-mobile.png')});
 console.log('Captured actual demo screenshots in dist/preview-*.png.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
