// Requires Playwright as an environment test tool; it is not shipped as an app dependency.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.ORBIT_CHROMIUM || '/usr/bin/chromium',args:['--no-sandbox']});
 const base=process.env.ORBIT_TEST_URL || 'http://127.0.0.1:8000/';
 for(const file of ['index.html','preview.html']){
  const context=await browser.newContext();const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.goto(new URL(file,base).href);
  await page.evaluate(()=>{state.monitoringPaused=true;saveState();window.injected=false;const script=document.createElement('script');script.textContent='window.injected=true';document.body.append(script);});
  assert.equal(await page.evaluate(()=>window.injected),false,'CSP blocks untrusted inline script');
  assert.equal(await page.evaluate(async()=>{try{await fetch('/index.html');return false;}catch{return true;}}),true,'CSP blocks even same-origin connector requests in this disconnected demo');
  const baseBefore=await page.evaluate(()=>document.baseURI);await page.evaluate(()=>{const base=document.createElement('base');base.href='https://example.invalid/';document.head.append(base)});assert.equal(await page.evaluate(()=>document.baseURI),baseBefore,'CSP rejects injected base URL');
  assert.equal(await page.evaluate(()=>validLocalTime('2026-02-31T10:00')),false);
  assert.equal(await page.evaluate(()=>validLocalTime('2026-10-09T10:30')),true);
  assert.equal(await page.evaluate(()=>safeHeader('Re: hello\nBcc: someone@example.com')),false);
  assert.equal(await page.evaluate(()=>safeAddress('javascript:alert(1)')),false);
  await page.evaluate(()=>openMessage(0,document.querySelector('#try-orbit'),true));
  const hostile='<img src=x onerror="window.injected=true"><script>window.injected=true</script>';
  await page.locator('#reply-body').fill(hostile);await page.locator('#draft-brief').fill(hostile);await page.locator('#reply-save').click();
  await page.locator('#draft-history-open').click();assert.equal(await page.locator('#draft-history-items img,#draft-history-items script').count(),0);assert((await page.locator('#draft-history-items').innerText()).includes(hostile));await page.keyboard.press('Escape');
  await page.evaluate(()=>document.querySelector('#reply-composer').requestSubmit());assert.equal(await page.evaluate(()=>Object.keys(state.executions).length),0);
  await page.evaluate(()=>document.querySelector('#message-dialog').close());await page.evaluate(()=>document.querySelector('#reply-composer').requestSubmit(document.querySelector('#reply-send')));assert.equal(await page.evaluate(()=>Object.keys(state.executions).length),0,'closed review cannot execute');
  await page.evaluate(()=>openMessage(0,document.querySelector('#try-orbit'),true));await page.locator('#reply-send').click();const first=await page.evaluate(()=>state.executions.reply);assert(first);await page.evaluate(()=>document.querySelector('#reply-composer').requestSubmit(document.querySelector('#reply-send')));assert.deepEqual(await page.evaluate(()=>state.executions.reply),first,'duplicate does not replace execution');
  await page.evaluate(()=>document.querySelector('#message-dialog').close());await page.locator('#workspace-toggle').click();await page.locator('[data-workspace="work"]').click();assert.equal(await page.evaluate(()=>Object.keys(state.executions).length),0);
  await page.evaluate(()=>openAction(document.querySelector('[data-approval="report"]'),document.querySelector('#try-orbit')));await page.evaluate(()=>document.querySelector('#action-form').requestSubmit());assert.equal(await page.evaluate(()=>Object.keys(state.executions).length),0);await page.evaluate(()=>document.querySelector('#review-dialog').close());await page.evaluate(()=>document.querySelector('#action-form').requestSubmit(document.querySelector('#dialog-execute')));assert.equal(await page.evaluate(()=>Object.keys(state.executions).length),0);
  await page.evaluate(()=>openAction(document.querySelector('[data-approval="report"]'),document.querySelector('#try-orbit')));await page.locator('#dialog-execute').click();const shared=await page.evaluate(()=>state.executions.report);await page.evaluate(()=>document.querySelector('#action-form').requestSubmit(document.querySelector('#dialog-execute')));assert.deepEqual(await page.evaluate(()=>state.executions.report),shared);
  assert.deepEqual(errors,[]);await context.close();console.log('PASS '+file+': CSP, literal hostile text, invalid metadata/dates, explicit/open review, duplicate guards, local context separation');
 }
 // Oversize storage must recover before parsing/rendering it.
 const context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('orbit.executive-assistant.workspaces.v1','x'.repeat(4*1024*1024+1)));const page=await context.newPage();await page.goto(new URL('preview.html',base).href);assert((await page.locator('#toast').textContent()).includes('invalid'));assert.equal(await page.evaluate(()=>Object.keys(state.executions).length),0);await context.close();
 await browser.close();console.log('PASS oversized-state recovery; server auth/OAuth/tenant-security checks are NOT IMPLEMENTED');
})().catch(error=>{console.error(error);process.exit(1);});
