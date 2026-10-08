// Playwright is an environment test tool, not a shipped application dependency.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.ORBIT_CHROMIUM || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  const base = process.env.ORBIT_TEST_URL || 'http://127.0.0.1:8000/';
  try {
    for (const file of ['index.html', 'preview.html']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(new URL(file, base).href);
      await page.evaluate(() => { state.monitoringPaused = true; saveState(); });
      const open = () => page.evaluate(() => openMessage(0, document.querySelector('#try-orbit'), true));
      const switchTo = async workspace => {
        await page.locator('#workspace-toggle').click();
        await page.locator(`[data-workspace="${workspace}"]`).click();
      };
      await open();
      await page.locator('#reply-body').fill('Personal draft: preserve my original notes.');
      await page.locator('#reply-save').click();
      const personal = await page.evaluate(() => structuredClone(state.replyCore));
      assert.equal(personal.drafts.length, 1);
      assert.equal(personal.executions.length, 0);
      await page.keyboard.press('Escape');
      await switchTo('work');
      await open();
      await page.locator('#reply-body').fill('Work draft: initial wording.');
      await page.locator('#reply-save').click();
      await page.locator('#reply-body').fill('Work draft: Dave explicitly confirms this exact edited version.');
      await page.evaluate(() => replyExecutors.get(activeWorkspace).failNext());
      await page.locator('#reply-send').click();
      assert.match(await page.locator('#reply-validation').innerText(), /EXECUTION_FAILED/);
      assert.equal(await page.evaluate(() => state.replyCore.executions.length), 0);
      await page.locator('#reply-send').click();
      const executed = await page.evaluate(() => structuredClone(state.replyCore));
      assert.equal(executed.executions.length, 1);
      const execution = executed.executions[0];
      const draft = executed.drafts[0];
      const version = draft.versions.find(v => v.id === execution.versionId);
      const approval = executed.approvals.find(a => a.id === execution.approvalId);
      assert.equal(execution.payload.body, version.body);
      assert.equal(version.revision, draft.currentRevision);
      assert.equal(approval.status, 'executed');
      assert.equal(execution.workspaceId, 'work');
      assert.equal(execution.actorId, 'demo-dave');
      assert.equal(executed.activity.filter(e => e.kind === 'reply.executed').length, 1);
      await page.evaluate(() => document.querySelector('#reply-composer').requestSubmit(document.querySelector('#reply-send')));
      assert.equal(await page.evaluate(() => state.replyCore.executions.length), 1);
      await page.keyboard.press('Escape');
      await page.evaluate(() => { delete state.executions.reply; delete state.messages[0].status; delete state.messages[0].sentBody; saveState(); });
      await page.reload();
      assert.deepEqual(await page.evaluate(() => state.replyCore), executed);
      assert.equal(await page.evaluate(() => state.messages[0].status), 'Replied');
      assert.equal(await page.evaluate(() => state.executions.reply.payload.body), execution.payload.body);
      await switchTo('personal');
      assert.deepEqual(await page.evaluate(() => state.replyCore), personal);
      await open();
      assert.equal(await page.locator('#reply-body').inputValue(), 'Personal draft: preserve my original notes.');
      for (const width of [320, 390]) {
        await page.setViewportSize({width, height: 900});
        await page.locator('#draft-history-open').click();
        await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth);
        assert(await page.locator('#draft-history-close').isVisible());
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.keyboard.press('Escape');
      }
      await page.keyboard.press('Escape');
      await page.evaluate(() => { document.querySelector('#reset-demo').closest('details').open = true; });
      await page.locator('#reset-demo').click();
      assert(await page.evaluate(() => ['personal','work'].every(ws => !workspaceStates[ws].replyCore)));
      // Malformed domain data must be retained and blocked, not replaced with an empty history.
      await page.evaluate(() => { state.replyCore = {schemaVersion:1,drafts:[null],reviews:[],approvals:[],executions:[],activity:[]}; saveState(); });
      await page.reload();
      await open();
      await page.locator('#reply-save').click();
      assert.match(await page.locator('#reply-validation').innerText(), /PERSISTENCE_FAILED/);
      assert.deepEqual(await page.evaluate(() => state.replyCore.drafts), [null]);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`PASS ${file}: exact-version UI execution, failure/retry, no duplicate, reload, isolated workspaces, mobile history, reset, corrupt-core preservation`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
