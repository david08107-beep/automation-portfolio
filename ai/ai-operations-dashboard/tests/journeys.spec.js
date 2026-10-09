import packageInfo from '../package.json' with {type:'json'};
const {version}=packageInfo;
import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const advance=async(page,ticks=12)=>page.clock.runFor(1800*ticks);
const create=async(page,request)=>{await page.getByLabel('What would you like to prepare?').fill(request);await page.getByRole('button',{name:'Create workflow'}).click();};
test.beforeEach(async({page})=>{await page.clock.install();await page.goto('/');});
test('request, execute, edit, review exact result, approve, persist and reset',async({page})=>{
 await page.locator('[data-type="brief"]').click();await page.getByRole('button',{name:'Create workflow'}).click();await advance(page,4);
 await expect(page.getByRole('textbox',{name:'Prepared result',exact:true})).toBeVisible();await page.getByRole('textbox',{name:'Prepared result',exact:true}).fill('Dave’s reviewed brief');await page.getByRole('button',{name:'Review approval'}).click();
 await expect(page.getByRole('dialog')).toContainText('Nothing will be sent');await expect(page.locator('#confirm-result')).toHaveText('Dave’s reviewed brief');
 await page.getByRole('button',{name:'Keep working'}).click();await expect(page.getByRole('textbox',{name:'Prepared result',exact:true})).toHaveValue('Dave’s reviewed brief');
 await page.getByRole('button',{name:'Review approval'}).click();await page.getByRole('button',{name:'Approve brief locally'}).click();await expect(page.locator('.result pre')).toHaveText('Dave’s reviewed brief');
 await page.reload();await expect(page.locator('.result pre')).toHaveText('Dave’s reviewed brief');await expect(page.locator('.history')).toContainText('Dave approved');
 await page.getByRole('button',{name:'Reset demo'}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.getByText('No workflows here yet')).toBeVisible();
 await page.reload();await expect(page.getByText('No workflows here yet')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('multi-process overview, agent capacity, tasks, distinct results and contextual review',async({page})=>{
 await page.getByRole('button',{name:'Load demo scenario'}).click();await expect(page.locator('.workflow')).toHaveCount(3);await expect(page.locator('#workflows')).toContainText('Inspect failure');await expect(page.locator('#system')).toContainText('Not connected');
 await expect(page.locator('#tasks')).toContainText('Blocked');await advance(page);await expect(page.getByRole('button',{name:'Review result'})).toHaveCount(2);
 await page.locator('.workflow').filter({hasText:'Draft a project update'}).click();await expect(page.getByRole('textbox',{name:'Prepared result',exact:true})).toContainText('UNSENT TEAM UPDATE');await expect(page.getByRole('textbox',{name:'Prepared result',exact:true})).toBeFocused();
 await page.locator('#filter').selectOption('failed');await expect(page.locator('.workflow')).toHaveCount(1);await page.locator('.workflow').click();await page.getByRole('button',{name:'Retry workflow'}).click();await advance(page);
 await expect(page.getByRole('textbox',{name:'Prepared result',exact:true})).toContainText('REQ-104');await expect(page.locator('#workflows').getByRole('button',{name:'Review result'})).toHaveCount(3);
 await page.getByLabel('Filter tasks').selectOption('completed');await expect(page.locator('.task-row')).toHaveCount(9);
 await page.getByLabel('Filter activity').selectOption('selected');await expect(page.locator('.history')).not.toContainText('Draft a project update');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('failure, retry, cancellation and hostile request safety',async({page})=>{
 await create(page,'<img src=x onerror=alert(1)>');await page.getByRole('button',{name:'Simulate failure'}).click();await expect(page.getByRole('heading',{name:'Simulated execution failure'})).toBeVisible();
 await page.getByRole('button',{name:'Retry workflow'}).click();await page.getByRole('button',{name:'Cancel workflow',exact:true}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();
 await advance(page);await expect(page.locator('.detail .section-head .status')).toHaveText('Cancelled');await expect(page.locator('img')).toHaveCount(0);
});
test('keyboard submission, dialog Escape and empty approval protection',async({page})=>{
 await page.getByLabel('What would you like to prepare?').focus();await page.keyboard.type('Review backlog');await page.keyboard.press('Enter');await advance(page,4);
 await page.getByRole('button',{name:'Review approval'}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:'Review approval'})).toBeFocused();
 await page.getByRole('textbox',{name:'Prepared result',exact:true}).fill('   ');await expect(page.getByRole('button',{name:'Review approval'})).toBeDisabled();await page.reload();await expect(page.getByRole('button',{name:'Review approval'})).toBeDisabled();
});
test('reload resumes in-flight work and approval dialog survives background execution',async({page})=>{
 await create(page,'Weekly brief');await advance(page,2);await page.reload();await advance(page);await expect(page.getByRole('textbox',{name:'Prepared result',exact:true})).toBeVisible();
 await create(page,'Draft a project update');await page.locator('.workflow').filter({hasText:'Weekly brief'}).click();await page.getByRole('button',{name:'Review approval'}).click();await advance(page);
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('button',{name:'Keep working'})).toBeFocused();await page.getByRole('button',{name:'Approve brief locally'}).click();await expect(page.locator('#workflows')).toContainText('Draft a project update');
});
test('storage failure is visible and simulated work still runs',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('denied');}});});await page.reload();await expect(page.locator('#notice')).toContainText('session');await expect(page.locator('#system')).toContainText('Unavailable');
 await create(page,'Weekly brief');await advance(page,4);await expect(page.getByRole('textbox',{name:'Prepared result',exact:true})).toBeVisible();
});
test('corrupt saved state is explained and reset preserves other project storage',async({page})=>{
 await page.evaluate(()=>{localStorage.setItem('dave-ai-os-v1','{broken');localStorage.setItem('orbit-do-not-touch','preserved');});await page.reload();await expect(page.locator('#notice')).toContainText('could not be read');await expect(page.getByText('No workflows here yet')).toBeVisible();
 await page.getByRole('button',{name:'Reset demo'}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();expect(await page.evaluate(()=>localStorage.getItem('orbit-do-not-touch'))).toBe('preserved');
});

test('seeded control center meets automated WCAG AA checks and fits narrow screens',async({page})=>{
 await page.getByRole('button',{name:'Load demo scenario'}).click();await advance(page);
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(result.violations).toEqual([]);
 await page.setViewportSize({width:320,height:800});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Review approval'}).click();const modal=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(modal.violations).toEqual([]);
});
test('scheduler preserves the focused workflow control and restored identifiers stay inert',async({page})=>{
 await create(page,'Weekly brief');await create(page,'Draft project update');const control=page.locator('.workflow').filter({hasText:'Weekly brief'});await control.focus();const key=await control.getAttribute('data-focus');await advance(page,1);expect(await page.evaluate(()=>document.activeElement.dataset.focus)).toBe(key);
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('dave-ai-os-v1'));const oldId=s.workflows[0].id;s.workflows[0].id='bad" onclick="alert(1)';s.activity.forEach(a=>{if(a.workflowId===oldId)a.workflowId=s.workflows[0].id;});localStorage.setItem('dave-ai-os-v1',JSON.stringify(s));});await page.reload();await expect(page.locator('[onclick]')).toHaveCount(0);await expect(page.locator('.workflow')).toHaveCount(2);
});
test('background execution preserves editor identity, native undo and scroll position',async({page})=>{
 await create(page,'Weekly brief');await advance(page,4);await create(page,'Draft project update');await page.locator('.workflow').filter({hasText:'Weekly brief'}).click();
 const editor=page.getByRole('textbox',{name:'Prepared result',exact:true}),original=await editor.inputValue();await editor.focus();await page.keyboard.press('Control+End');await page.keyboard.insertText('\nDave: security review required.');
 await page.evaluate(()=>{window.editorBefore=document.querySelector('#result');window.editorScroll=window.editorBefore.scrollTop;});await advance(page,1);
 expect(await page.evaluate(()=>window.editorBefore===document.querySelector('#result'))).toBe(true);expect(await editor.evaluate(el=>el.scrollTop)).toBe(await page.evaluate(()=>window.editorScroll));
 await page.keyboard.press('Control+z');await expect(editor).toHaveValue(original);
});
test('IT operator chooses a process, retries a filtered failure, and retains completed work',async({page})=>{
 await page.getByLabel('Demo process',{exact:true}).selectOption('backlog');await create(page,'Investigate a project security review');await expect(page.locator('.detail-title')).toContainText('REQUEST TRIAGE');await advance(page,2);
 await page.getByRole('button',{name:'Simulate failure'}).click();await page.getByLabel('Filter workflows').selectOption('failed');await page.getByRole('button',{name:'Retry workflow'}).click();
 await expect(page.getByLabel('Filter workflows')).toHaveValue('all');await expect(page.locator('.workflow')).toHaveCount(1);await expect(page.locator('.task-plan li').first()).toContainText('Completed');await advance(page);
 await expect(page.getByRole('textbox',{name:'Prepared result',exact:true})).toContainText('REQ-112');await page.locator('.timeline-details summary').click();await expect(page.locator('.timeline')).toContainText('completed work was retained');
});
test('selected review and filters survive reload; next review requires its own approval',async({page})=>{
 await create(page,'Weekly brief');await create(page,'Draft project update');await advance(page);await page.locator('.workflow').filter({hasText:'Weekly brief'}).click();await page.getByLabel('Filter workflows').selectOption('awaiting review');
 await page.getByRole('textbox',{name:'Prepared result',exact:true}).fill('Dave: approved planning brief');await page.reload();await expect(page.locator('#detail-title')).toHaveText('Weekly brief');await expect(page.getByLabel('Filter workflows')).toHaveValue('awaiting review');await expect(page.getByRole('textbox',{name:'Prepared result',exact:true})).toHaveValue('Dave: approved planning brief');
 await page.getByRole('button',{name:'Review approval'}).click();await page.getByRole('button',{name:'Approve brief locally'}).click();await page.getByRole('button',{name:'Review next result'}).click();await expect(page.locator('#detail-title')).toHaveText('Draft project update');await expect(page.getByRole('textbox',{name:'Prepared result',exact:true})).toContainText('UNSENT TEAM UPDATE');await expect(page.locator('.workflow').filter({hasText:'Completed'})).toHaveCount(1);
});
test('composition does not suspend agent execution or destroy the active command control',async({page})=>{
 await create(page,'Weekly brief');await page.locator('#command').focus();await page.locator('#command').dispatchEvent('compositionstart');await advance(page,4);await page.locator('#command').dispatchEvent('compositionend');await expect(page.getByRole('textbox',{name:'Prepared result',exact:true})).toBeVisible();
});
test('changing view preferences does not overwrite an unreadable saved workspace',async({page})=>{
 await page.evaluate(()=>localStorage.setItem('dave-ai-os-v1','{broken'));await page.reload();await page.getByLabel('Demo process',{exact:true}).selectOption('backlog');await page.getByLabel('Filter workflows').selectOption('failed');expect(await page.evaluate(()=>localStorage.getItem('dave-ai-os-v1'))).toBe('{broken');await expect(page.locator('#notice')).toContainText('could not be read');
});

test('whitespace request feedback clears for a valid request and the exact version is visible',async({page})=>{
 await page.locator('#command').fill('   ');await page.getByRole('button',{name:'Create workflow'}).click();expect(await page.locator('#command').evaluate(el=>el.checkValidity())).toBe(false);expect(await page.locator('#command').evaluate(el=>el.validationMessage)).toContain('non-space');await expect(page.locator('.workflow')).toHaveCount(0);
 await create(page,'Weekly brief');await expect(page.locator('.workflow')).toHaveCount(1);await expect(page.locator('.intro .eyebrow')).toContainText('V'+version.replace('-demo',' DEMO'));
});
test('another tab cannot erase saved workflows and confirmed reload resumes from latest',async({page})=>{
 await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));const other=await page.context().newPage();await other.goto('/');
 await create(page,'Brief from first tab');await expect(other.locator('#notice')).toContainText('Another tab changed');await expect(other.getByRole('button',{name:'Create workflow'})).toBeDisabled();await expect(other.locator('#system')).toContainText('Paused here');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('dave-ai-os-v1')).workflows.map(w=>w.request))).toEqual(['Brief from first tab']);
 await page.clock.resume();const scan=await new AxeBuilder({page:other}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(scan.violations).toEqual([]);
 await other.getByRole('button',{name:'Reload latest workspace'}).click();await expect(other.getByRole('dialog')).toContainText('unsaved edits');await other.getByRole('button',{name:'Reload latest',exact:true}).click();await expect(other.locator('.workflow')).toHaveCount(1);await create(other,'Backlog from refreshed tab');await expect(other.locator('.workflow')).toHaveCount(2);expect(await other.evaluate(()=>JSON.parse(localStorage.getItem('dave-ai-os-v1')).workflows.length)).toBe(2);await other.close();
});
test('a workspace change closes stale approval and pauses further scheduling',async({page})=>{
 await create(page,'Weekly brief');await advance(page,4);await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now()+1000)));const other=await page.context().newPage();await other.goto('/');
 await page.getByRole('button',{name:'Review approval'}).click();await expect(page.getByRole('dialog')).toBeVisible();await create(other,'Draft a project update');await expect(page.locator('#notice')).toContainText('Another tab changed');await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('button',{name:'Review approval'})).toBeDisabled();await expect(page.locator('#result')).toHaveAttribute('readonly','');
 await other.close();const saved=await page.evaluate(()=>localStorage.getItem('dave-ai-os-v1'));await advance(page,4);expect(await page.evaluate(()=>localStorage.getItem('dave-ai-os-v1'))).toBe(saved);expect(JSON.parse(saved).workflows.filter(w=>w.status==='completed').length).toBe(0);
});
test('all retained activity is browsable and filter changes reset the page size',async({page})=>{
 await create(page,'Weekly brief');
 await page.evaluate(()=>{
  const state=JSON.parse(localStorage.getItem('dave-ai-os-v1'));
  state.activity=Array.from({length:125},(_,i)=>({id:crypto.randomUUID(),workflowId:state.workflows[0].id,message:`Retained event ${125-i}`,kind:'execution',time:new Date(Date.now()-i*1000).toISOString()}));
  localStorage.setItem('dave-ai-os-v1',JSON.stringify(state));
 });
 await page.reload();await expect(page.locator('#activity li')).toHaveCount(60);
 await page.getByRole('button',{name:'Show older activity'}).click();await expect(page.locator('#activity li')).toHaveCount(120);
 await page.getByRole('button',{name:'Show older activity'}).click();await expect(page.locator('#activity li')).toHaveCount(125);await expect(page.getByRole('button',{name:'Show older activity'})).toHaveCount(0);await expect(page.locator('#activity')).toContainText('Retained event 1');
 await page.getByLabel('Filter activity').selectOption('selected');await expect(page.locator('#activity li')).toHaveCount(60);await expect(page.locator('.history-pagination')).toContainText('Showing 60 of 125 events');
});
test('keyboard users can skip navigation into the workspace',async({page})=>{
 await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Skip to workspace'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('main')).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Load demo scenario'})).toBeFocused();
});

test('alternative drafts retain edits, restore settings, stay safe and persist',async({page})=>{
 await page.getByLabel('Demo process').selectOption('backlog');await create(page,'Review <img src=x onerror=alert(1)> software');await advance(page,4);
 const original=await page.locator('#result').inputValue();expect(original).toContain('SOFTWARE REQUEST TRIAGE');
 await page.locator('#result').fill(original+'\nDave edit <script>window.bad=true</script>');
 await page.getByRole('button',{name:'Generate alternative',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 expect(await page.locator('#result').inputValue()).not.toBe(original);await expect(page.locator('#result')).toHaveValue(/Decision focus/);
 await page.locator('.draft-history summary').click();await expect(page.locator('.draft-history')).toContainText('Dave edit <script>');expect(await page.locator('.draft-history script,.draft-history img').count()).toBe(0);
 await page.getByLabel('Demo process').selectOption('brief');await page.getByRole('button',{name:'Restore version 1',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.locator('#result')).toHaveValue(original+'\nDave edit <script>window.bad=true</script>');await expect(page.getByLabel('Demo process')).toHaveValue('backlog');
 await page.reload();await expect(page.locator('#result')).toHaveValue(original+'\nDave edit <script>window.bad=true</script>');await page.locator('.draft-history summary').click();await expect(page.getByRole('button',{name:'Close draft history'})).toBeVisible();await page.getByRole('button',{name:'Close draft history'}).click();await expect(page.locator('.draft-history')).not.toHaveAttribute('open','');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('draft download contains exact edits and clipboard denial is explained',async({page})=>{
 await create(page,'Weekly brief');await advance(page,4);await page.locator('#result').fill('Dave’s downloadable edited draft <b>literal</b>');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download draft'}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('ai-os-brief-draft.txt');
 const {readFile}=await import('node:fs/promises');expect(await readFile(await download.path(),'utf8')).toBe('Dave’s downloadable edited draft <b>literal</b>');
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('denied'))}}));await page.getByRole('button',{name:'Copy draft'}).click();await expect(page.locator('.result')).toContainText('Clipboard access was denied');
 const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();expect(scan.violations).toEqual([]);
});

test('one queue opens the actual decision and summary cards go straight to work',async({page})=>{
 await page.getByRole('button',{name:'Load demo scenario'}).click();await advance(page,12);
 await expect(page.locator('#approvals')).toHaveCount(0);await expect(page.locator('.workflow')).toHaveCount(3);await expect(page.locator('.workflow').first()).toContainText('Failed');
 await page.locator('.overview a[data-summary="awaiting review"]').click();await expect(page.getByLabel('Filter workflows')).toHaveValue('awaiting review');await expect(page.locator('#result')).toBeFocused();
 const positions=await page.evaluate(()=>({editor:document.querySelector('#result').getBoundingClientRect().top,approval:document.querySelector('#approve').getBoundingClientRect().bottom,height:innerHeight}));expect(positions.editor).toBeGreaterThanOrEqual(0);expect(positions.editor).toBeLessThan(150);expect(positions.approval).toBeLessThan(positions.height);
 await expect(page.locator('.plan-details')).not.toHaveAttribute('open','');await page.locator('.plan-details summary').click();await expect(page.locator('.task-plan')).toBeVisible();
 await page.locator('.overview a[data-summary="failed"]').click();await expect(page.getByLabel('Filter workflows')).toHaveValue('failed');await expect(page.getByRole('button',{name:'Retry workflow'})).toBeFocused();expect(await page.getByRole('button',{name:'Retry workflow'}).evaluate(el=>el.getBoundingClientRect().bottom<innerHeight)).toBe(true);
 await page.getByRole('button',{name:'Retry workflow'}).click();await expect(page.locator('#execution')).toContainText('Plan & tasks');
});
test('approval rejects a draft changed after preview and requires a fresh review',async({page})=>{
 await create(page,'Weekly brief');await advance(page,4);await page.getByRole('button',{name:'Review approval'}).click();
 await page.evaluate(()=>{const result=document.querySelector('#result');result.value='Changed after confirmation preview';result.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.getByRole('button',{name:'Approve brief locally'}).click();await expect(page.locator('.result')).toContainText('Draft changed');await expect(page.locator('.workflow')).toContainText('Awaiting review');
 await page.getByRole('button',{name:'Review approval'}).click();await expect(page.getByRole('dialog')).toContainText('Changed after confirmation preview');await page.getByRole('button',{name:'Approve brief locally'}).click();await expect(page.locator('.workflow')).toContainText('Completed');
});
test('stored text stays literal and unknown credential metadata is not adopted or exported',async({page})=>{
 const logs=[];page.on('console',message=>logs.push(message.text()));await create(page,'Weekly brief');await advance(page,4);
 await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('dave-ai-os-v1'));s.providerToken='synthetic-provider-marker';s.workflows[0].connectionSecret='synthetic-connection-marker';s.workflows[0].result='<img src=x onerror="window.injected=true"> Literal draft';s.workflows[0].timeline[0].text='<svg onload="window.injected=true">';s.activity[0].message='<script>window.injected=true</script>';localStorage.setItem('dave-ai-os-v1',JSON.stringify(s));});
 await page.reload();await expect(page.locator('#result')).toHaveValue(/Literal draft/);await page.locator('.timeline-details summary').click();await expect(page.locator('.timeline')).toContainText('<svg');expect(await page.evaluate(()=>window.injected)).toBeUndefined();expect(await page.locator('#app svg,#app script,#app img').count()).toBe(0);
 await page.getByLabel('Filter tasks').selectOption('all');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('dave-ai-os-v1')));expect(saved.providerToken).toBeUndefined();expect(saved.workflows[0].connectionSecret).toBeUndefined();
 const promise=page.waitForEvent('download');await page.getByRole('button',{name:'Download draft'}).click();const download=await promise;const {readFile}=await import('node:fs/promises');const content=await readFile(await download.path(),'utf8');expect(content).toBe('<img src=x onerror="window.injected=true"> Literal draft');expect(logs.join('\n')).not.toContain('synthetic-provider-marker');expect(logs.join('\n')).not.toContain('Literal draft');
});

test('workflow capacity rejects a new command visibly and preserves the saved workspace',async({page})=>{
 await create(page,'Brief');await advance(page,4);
 await page.evaluate(()=>{const key='dave-ai-os-v1',s=JSON.parse(localStorage.getItem(key)),w=s.workflows[0];s.workflows=Array.from({length:500},(_,i)=>({...structuredClone(w),id:i===0?w.id:`maximum-${i}`}));localStorage.setItem(key,JSON.stringify(s));});
 await page.reload();const before=await page.evaluate(()=>localStorage.getItem('dave-ai-os-v1'));
 await create(page,'Extra request');await expect(page.locator('#notice')).toContainText('Workflow limit reached');await expect(page.locator('#command')).toHaveValue('Extra request');
 expect(await page.evaluate(()=>localStorage.getItem('dave-ai-os-v1'))).toBe(before);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('draft capacity rejects regeneration visibly and retains the prepared result after reload',async({page})=>{
 await create(page,'Brief');await advance(page,4);
 await page.evaluate(()=>{const key='dave-ai-os-v1',s=JSON.parse(localStorage.getItem(key)),w=s.workflows[0];w.drafts=Array.from({length:1000},()=>({result:'Retained draft',request:w.request,type:w.type,time:w.created}));localStorage.setItem(key,JSON.stringify(s));});
 await page.reload();const before=await page.evaluate(()=>localStorage.getItem('dave-ai-os-v1'));
 await page.locator('[data-action="regenerate"]').click();await expect(page.locator('#notice')).toContainText('Saved draft limit reached');expect(await page.evaluate(()=>localStorage.getItem('dave-ai-os-v1'))).toBe(before);
 await page.reload();await expect(page.locator('#result')).toContainText('WEEKLY OPERATIONS BRIEF');
});
