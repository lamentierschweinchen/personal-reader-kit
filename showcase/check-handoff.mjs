import {createRequire} from 'node:module';
import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {buildShowcase} from './build.mjs';
import {serve} from './serve.mjs';

if (!process.argv.includes('--skip-build')) await buildShowcase();
const require = createRequire(import.meta.url), pw = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const output = new URL('../test-results/showcase-handoff/', import.meta.url);
await mkdir(output, {recursive: true});
const server = await serve(), base = 'http://127.0.0.1:' + server.address().port, receipts = [];
const storageKey = 'newreading-starting-point-v1';
async function enhanced(page) { await page.locator('header [data-copy]:not([hidden])').waitFor(); }
async function copied(page) { return page.evaluate(() => window.copiedPrompt); }
async function copyStub(page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async text => {window.copiedPrompt = text;}}}));
}
async function focusIs(page, selector) { await page.waitForFunction(selector => document.activeElement === document.querySelector(selector), selector); }

try {
  for (const engine of ['chromium', 'webkit']) {
    const executablePath = engine === 'chromium' ? process.env.CHROME_PATH : process.env.WEBKIT_PATH;
    const browser = await pw[engine].launch({headless: true, ...(executablePath ? {executablePath} : {})});
    try {
      const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: 'reduce'});
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await copyStub(page); await page.goto(base); await enhanced(page);
      assert.equal(await page.locator('[data-cover-motion]').isVisible(), false);
      assert.equal(await page.locator('[data-covers]').evaluate(el => getComputedStyle(el).animationName), 'none');
      const book = 'Walden — gift edition', originalIdea = 'Keep the original line breaks.';
      await page.locator('#book').fill(book); await page.locator('#idea').fill(originalIdea);
      let navigations = 0;
      page.on('framenavigated', frame => {if (frame === page.mainFrame()) navigations++;});
      await page.locator('#book').focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('.status').textContent.startsWith('Copied.'));
      assert.equal(navigations, 0, 'Enter copies without navigating');
      assert.ok((await copied(page)).includes(book)); assert.ok((await copied(page)).includes(originalIdea));
      await page.locator('#idea').fill(originalIdea + ' Keep illustrations too.');
      assert.equal(await page.locator('.status').textContent(), '', 'Editing clears copied feedback');
      const chip = page.locator('[data-idea]').first(), suggestion = await chip.getAttribute('data-idea');
      const beforeSuggestion = await page.locator('#idea').inputValue();
      await chip.click(); const idea = beforeSuggestion + '\n' + suggestion;
      assert.equal(await page.locator('#idea').inputValue(), idea, 'Suggestion preserves original words');
      await chip.click(); assert.equal(await page.locator('#idea').inputValue(), idea, 'A suggestion is not duplicated');
      await page.locator('#prompt-box summary').click();
      for (const button of await page.locator('[data-copy]').all()) {
        await button.click(); assert.equal(await copied(page), await page.locator('#starter').inputValue());
      }
      await page.locator('a.newbie').click(); await enhanced(page);
      const guidePrompt = await page.locator('#starter').inputValue();
      assert.ok(guidePrompt.includes(book) && guidePrompt.includes(idea), 'The guide carries the draft into its instruction');
      for (const button of await page.locator('[data-copy]').all()) {await button.click(); assert.equal(await copied(page), guidePrompt);}
      await page.locator('input[value="claude"]').check({force: true});
      assert.equal(await page.locator('[data-route="claude"]').isVisible(), true);
      // Browsers may restore a radio without firing change when showing a history entry.
      await page.evaluate(() => {document.querySelector('input[value="gemini"]').checked = true; window.dispatchEvent(new Event('pageshow'));});
      assert.equal(await page.locator('[data-route="antigravity"]').isVisible(), true);
      assert.equal(await page.locator('[data-route]:visible').count(), 1);
      await page.locator('a[href="/#make"]').click(); await enhanced(page);
      assert.equal(await page.locator('#book').inputValue(), book); assert.equal(await page.locator('#idea').inputValue(), idea);
      await page.reload(); await enhanced(page);
      assert.equal(await page.locator('#book').inputValue(), book); assert.equal(await page.locator('#idea').inputValue(), idea);
      assert.equal(new URL(page.url()).search, '', 'Drafts never enter the URL');

      // A pending clipboard permission cannot produce duplicate writes or stale success.
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: text => {window.copyCalls = (window.copyCalls || 0) + 1; return new Promise(resolve => {window.finishCopy = resolve;});}}}));
      await page.locator('header [data-copy]').click(); await page.locator('header [data-copy]').click();
      assert.equal(await page.evaluate(() => window.copyCalls), 1);
      await page.locator('#idea').fill(idea + '\nA new preference.');
      await page.evaluate(() => window.finishCopy());
      await page.waitForFunction(() => !document.querySelector('header [data-copy]').hasAttribute('aria-busy'));
      assert.equal(await page.locator('.toast').textContent(), ''); assert.equal(await page.locator('.status').textContent(), '');
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async () => {throw Error('Denied');}}}));
      await page.locator('[data-copy="personal"]').click(); await page.locator('.fallback[open]').waitFor();
      const manual = await page.locator('.fallback textarea').inputValue();
      assert.equal(manual, await page.locator('#starter').inputValue());
      assert.equal(await page.locator('.status').textContent(), '');
      assert.deepEqual(await page.locator('.fallback textarea').evaluate(el => [el.selectionStart, el.selectionEnd]), [0, manual.length]);
      const close = await page.locator('.fallback button').boundingBox(); assert.ok(close.width >= 44 && close.height >= 44, 'Manual-copy close is a usable touch target');
      await page.screenshot({path: fileURLToPath(new URL(`${engine}-manual-copy.png`, output)), animations: 'disabled'});
      await page.setViewportSize({width: 874, height: 402});
      const landscape = await page.evaluate(() => {
        const dialog = document.querySelector('.fallback').getBoundingClientRect(), close = document.querySelector('.fallback button').getBoundingClientRect();
        return {dialog: {top: dialog.top, bottom: dialog.bottom}, close: {top: close.top, bottom: close.bottom}, height: innerHeight};
      });
      assert.ok(landscape.dialog.top >= 0 && landscape.dialog.bottom <= landscape.height, 'Manual copying fits a short landscape viewport');
      assert.ok(landscape.close.top >= 0 && landscape.close.bottom <= landscape.height, 'Close stays reachable in landscape');
      await page.screenshot({path: fileURLToPath(new URL(`${engine}-manual-copy-landscape.png`, output)), animations: 'disabled'});
      await page.setViewportSize({width: 390, height: 844});
      await page.keyboard.press('Escape'); await focusIs(page, '[data-copy="personal"]');
      assert.equal(await page.locator('.fallback').getAttribute('open'), null);
      await page.locator('a.newbie').click(); await enhanced(page);
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable: true, value: undefined}));
      await page.locator('#paste [data-copy]').click(); await page.locator('.fallback[open]').waitFor();
      await page.locator('.fallback button').click(); await focusIs(page, '#paste [data-copy]');
      await page.goto(base); await enhanced(page);
      await page.locator('[data-explore="closer"]').click();
      const plate = page.locator('.plate-open');
      assert.equal(await plate.getAttribute('href'), '/assets/alice-rabbit.png');
      for (const [viewport, dismissal] of [[{width: 390, height: 844}, 'Escape'], [{width: 874, height: 402}, 'Close']]) {
        await page.setViewportSize(viewport); await plate.scrollIntoViewIfNeeded();
        const place = await page.evaluate(() => ({x: scrollX, y: scrollY, url: location.href}));
        await plate.click(); await page.locator('.illustration-dialog[open]').waitFor();
        const geometry = await page.evaluate(() => {
          const dialog = document.querySelector('.illustration-dialog'), rect = dialog.getBoundingClientRect(), close = dialog.querySelector('button').getBoundingClientRect(), image = dialog.querySelector('img');
          return {top: rect.top, bottom: rect.bottom, close: {width: close.width, height: close.height, top: close.top, bottom: close.bottom}, imageLoaded: image.complete && image.naturalWidth > 0, height: innerHeight};
        });
        assert.equal(geometry.imageLoaded, true);
        assert.ok(geometry.top >= 0 && geometry.bottom <= geometry.height, 'The illustration dialog fits the viewport');
        assert.ok(geometry.close.width >= 44 && geometry.close.height >= 44 && geometry.close.top >= 0 && geometry.close.bottom <= geometry.height, 'The illustration close stays reachable');
        assert.equal(page.url(), place.url, 'Opening an illustration keeps the current page');
        if (dismissal === 'Escape') await page.keyboard.press('Escape'); else await page.locator('.illustration-dialog button').click();
        await focusIs(page, '.plate-open');
        await page.waitForFunction(place => Math.abs(scrollX - place.x) < 1 && Math.abs(scrollY - place.y) < 1, place);
        assert.equal(await page.locator('[data-explore="closer"]').getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('#panel-closer').isVisible(), true);
      }
      // If a browser cannot open the dialog, leave the original native image link intact.
      await page.evaluate(() => {document.querySelector('.illustration-dialog').showModal = () => {throw Error('Dialog unavailable');};});
      await plate.click(); await page.waitForURL(base + '/assets/alice-rabbit.png');
      assert.deepEqual(errors, []); await context.close();

      // Storage refusal must not prevent typing, suggestions, or manual copying.
      const blocked = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: 'reduce'}), blockedPage = await blocked.newPage();
      const blockedErrors = []; blockedPage.on('pageerror', error => blockedErrors.push(error.message));
      await blockedPage.addInitScript(() => {
        Object.defineProperty(window, 'sessionStorage', {configurable: true, get() {throw Error('Storage blocked');}});
        Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async () => {throw Error('Clipboard blocked');}}});
      });
      await blockedPage.goto(base); await enhanced(blockedPage);
      await blockedPage.locator('#book').fill('A private title'); await blockedPage.locator('#idea').fill('x'.repeat(1000));
      await blockedPage.locator('[data-idea]').first().click();
      assert.equal(await blockedPage.locator('#idea').inputValue(), 'x'.repeat(1000), 'A full idea is never truncated to insert a suggestion');
      assert.match(await blockedPage.locator('.status').textContent(), /Edit it/);
      await blockedPage.locator('#idea').fill('Keep my words.');
      assert.equal(await blockedPage.locator('.status').textContent(), '');
      await blockedPage.locator('#book').focus(); await blockedPage.keyboard.press('Enter'); await blockedPage.locator('.fallback[open]').waitFor();
      assert.match(await blockedPage.locator('.fallback textarea').inputValue(), /A private title/);
      assert.equal(new URL(blockedPage.url()).search, ''); assert.deepEqual(blockedErrors, []); await blocked.close();

      const bounded = await browser.newContext({reducedMotion: 'reduce'}), boundedPage = await bounded.newPage();
      await boundedPage.addInitScript(key => sessionStorage.setItem(key, JSON.stringify({book: 'b'.repeat(500), idea: 'i'.repeat(2000)})), storageKey);
      await boundedPage.goto(base); await enhanced(boundedPage);
      assert.equal((await boundedPage.locator('#book').inputValue()).length, 200); assert.equal((await boundedPage.locator('#idea').inputValue()).length, 1000);
      await bounded.close();

      // Missing observers and keyboard movement must never strand invisible content.
      const noObserver = await browser.newContext({viewport: {width: 1280, height: 900}}), observerPage = await noObserver.newPage();
      await observerPage.addInitScript(() => {window.IntersectionObserver = undefined; window.ResizeObserver = undefined;});
      await observerPage.goto(base); await enhanced(observerPage);
      assert.equal(await observerPage.locator('.reveal:not(.in)').count(), 0);
      const motion = observerPage.locator('[data-cover-motion]');
      assert.equal(await motion.isVisible(), true);
      await motion.focus(); await observerPage.keyboard.press('Space');
      await focusIs(observerPage, '[data-cover-motion]');
      assert.equal(await motion.textContent(), 'Resume covers');
      assert.equal(await motion.getAttribute('aria-pressed'), null);
      assert.equal(await observerPage.locator('[data-covers]').evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
      await observerPage.keyboard.press('Enter');
      assert.equal(await motion.textContent(), 'Pause covers');
      assert.equal(await observerPage.locator('[data-covers]').evaluate(el => getComputedStyle(el).animationPlayState), 'running');
      await observerPage.keyboard.press('Space');
      await observerPage.emulateMedia({reducedMotion: 'reduce'}); await motion.waitFor({state: 'hidden'});
      assert.equal(await observerPage.locator('[data-covers]').evaluate(el => getComputedStyle(el).animationName), 'none');
      await observerPage.emulateMedia({reducedMotion: 'no-preference'}); await motion.waitFor({state: 'visible'});
      assert.equal(await motion.textContent(), 'Resume covers');
      assert.equal(await observerPage.locator('[data-covers]').evaluate(el => getComputedStyle(el).animationPlayState), 'paused');
      await observerPage.evaluate(() => {window.tabKeys = []; window.addEventListener('keydown', e => {if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) window.tabKeys.push([e.key, e.defaultPrevented]);});});
      await observerPage.locator('[data-explore="word"]').focus();
      for (const [key, id] of [['End', 'places'], ['Home', 'word'], ['ArrowLeft', 'places'], ['ArrowRight', 'word'], ['ArrowRight', 'accounts']]) {
        await observerPage.keyboard.press(key);
        assert.equal(await observerPage.locator(`[data-explore="${id}"]`).getAttribute('aria-selected'), 'true');
        assert.equal(await observerPage.locator(`#panel-${id}`).isVisible(), true);
      }
      assert.ok((await observerPage.evaluate(() => window.tabKeys)).every(([, prevented]) => prevented));
      await observerPage.keyboard.press('Tab'); await focusIs(observerPage, '#panel-accounts');
      await noObserver.close();
      const pending = await browser.newContext(), pendingPage = await pending.newPage();
      await pendingPage.addInitScript(() => {window.IntersectionObserver = class {observe() {} unobserve() {}};});
      await pendingPage.goto(base); await enhanced(pendingPage);
      assert.equal(await pendingPage.locator('.sample.in').count(), 0);
      await pendingPage.locator('.sample').first().focus();
      assert.equal(await pendingPage.locator('.sample').first().evaluate(el => el.classList.contains('in')), true);
      await pending.close();

      const noScript = await browser.newContext({javaScriptEnabled: false}), plain = await noScript.newPage();
      await plain.goto(base + '/learn/');
      assert.equal(await plain.locator('.learn-q').isVisible(), false, 'Static guidance offers no inert chooser');
      assert.equal(await plain.locator('[data-route]:visible').count(), 3, 'Every app route is readable without JavaScript');
      assert.equal(await plain.locator('[data-copy]:visible').count(), 0);
      await noScript.close();
      receipts.push({engine,submitCopies:true,draftRoundTrip:true,nonDestructiveSuggestions:true,allCopyControls:true,boundedStorage:true,blockedStorage:true,copyRecovery:true,landscapeDialog:true,focusReturn:true,illustrationReturn:true,illustrationLinkFallback:true,coverMotionControl:true,keyboardTabs:true,observerFallback:true,staticRoutes:true});
    } finally { await browser.close(); }
  }
  await writeFile(new URL('receipt.json', output), JSON.stringify({checkedAt: new Date().toISOString(), passed: true, receipts, limits: 'Automated Chromium/WebKit behavior checks with controlled clipboard and storage failures; not physical-device or screen-reader acceptance.'}, null, 2) + '\n');
  console.log(JSON.stringify({passed: true, engines: receipts.map(r => r.engine), checks: 'Draft, copy, keyboard and enhancement recovery'}));
} finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
