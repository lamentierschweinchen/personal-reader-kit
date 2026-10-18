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
      assert.equal(await page.locator('[data-marquee]').getAttribute('role'), null);
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

      // Real touch contexts expose clipped controls that desktop-sized boxes can miss.
      for (const route of ['/', '/learn/']) {
        const enlarged = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true, reducedMotion: 'reduce'}), largePage = await enlarged.newPage();
        await copyStub(largePage); await largePage.goto(base + route); await enhanced(largePage);
        await largePage.evaluate(async () => {
          await document.fonts.ready;
          const elements = [...document.querySelectorAll('body, body *')], sizes = elements.map(el => parseFloat(getComputedStyle(el).fontSize));
          elements.forEach((el, i) => el.style.setProperty('font-size', `${sizes[i] * 2}px`, 'important'));
        });
        await largePage.waitForFunction(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-clearance')) >= document.querySelector('header.top').getBoundingClientRect().height);
        const controls = await largePage.locator('header a:visible, header button:visible').evaluateAll(elements => elements.map(el => {const r = el.getBoundingClientRect(); return {label: el.textContent.trim(), left: r.left, right: r.right};}));
        assert.ok(controls.every(r => r.left >= 0 && r.right <= 390), `Enlarged text leaves every header control reachable: ${JSON.stringify(controls)}`);
        await largePage.locator('header [data-copy]').tap(); assert.ok((await copied(largePage)).length > 30);
        await largePage.screenshot({path: fileURLToPath(new URL(`${engine}-large-${route === '/' ? 'home' : 'guide'}.png`, output)), animations: 'disabled'});
        await enlarged.close();
      }
      const short = await browser.newContext({viewport: {width: 667, height: 375}, isMobile: true, hasTouch: true, reducedMotion: 'reduce'}), shortPage = await short.newPage();
      await shortPage.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async () => {throw Error('Denied');}}}));
      await shortPage.goto(base); await enhanced(shortPage); await shortPage.locator('header [data-copy]').tap(); await shortPage.locator('.fallback[open]').waitFor();
      const visibleClose = await shortPage.evaluate(() => {
        const dialog = document.querySelector('.fallback').getBoundingClientRect(), close = document.querySelector('.fallback button').getBoundingClientRect();
        return {width: close.width, height: Math.min(dialog.bottom, close.bottom, innerHeight) - Math.max(dialog.top, close.top, 0)};
      });
      assert.ok(visibleClose.width >= 44 && visibleClose.height >= 44, 'The entire manual-copy close target survives dialog scrolling');
      await shortPage.locator('.fallback button').tap(); assert.equal(await shortPage.locator('.fallback').getAttribute('open'), null); await short.close();

      // A late font load must not restart the demonstration over a visitor's choice.
      const delayed = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true}), delayedPage = await delayed.newPage();
      await delayedPage.addInitScript(() => {const pending = new Promise(resolve => {window.releaseFonts = resolve;}); Object.defineProperty(document.fonts, 'ready', {get: () => pending});});
      await delayedPage.goto(base); await enhanced(delayedPage); await delayedPage.locator('[data-pick="money"]').tap();
      await delayedPage.evaluate(() => window.releaseFonts()); await delayedPage.waitForTimeout(5600);
      assert.equal(await delayedPage.locator('.hero').getAttribute('data-thread'), 'money', 'Late fonts preserve an explicit choice'); await delayed.close();

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
      const motion = observerPage.locator('[data-marquee]'), playState = () => observerPage.locator('[data-covers]').evaluate(el => getComputedStyle(el).animationPlayState);
      assert.equal(await motion.getAttribute('role'), 'button');
      await motion.focus(); await observerPage.keyboard.press('Space');
      await focusIs(observerPage, '[data-marquee]');
      assert.equal(await motion.getAttribute('aria-pressed'), 'true');
      assert.equal(await playState(), 'paused');
      await observerPage.keyboard.press('Enter');
      assert.equal(await motion.getAttribute('aria-pressed'), 'false');
      assert.equal(await playState(), 'running');
      await observerPage.keyboard.press('Space');
      await observerPage.emulateMedia({reducedMotion: 'reduce'}); await observerPage.waitForFunction(() => !document.querySelector('[data-marquee]').hasAttribute('role'));
      assert.equal(await observerPage.locator('[data-covers]').evaluate(el => getComputedStyle(el).animationName), 'none');
      await observerPage.emulateMedia({reducedMotion: 'no-preference'}); await observerPage.waitForFunction(() => document.querySelector('[data-marquee]').getAttribute('role') === 'button');
      assert.equal(await motion.getAttribute('aria-pressed'), 'true');
      assert.equal(await playState(), 'paused');
      await observerPage.evaluate(() => {window.tabKeys = []; window.addEventListener('keydown', e => {if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) window.tabKeys.push([e.key, e.defaultPrevented]);});});
      await observerPage.locator('[data-explore="word"]').focus();
      for (const [key, id] of [['End', 'play'], ['Home', 'word'], ['ArrowLeft', 'play'], ['ArrowRight', 'word'], ['ArrowRight', 'accounts']]) {
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
      receipts.push({engine,submitCopies:true,draftRoundTrip:true,nonDestructiveSuggestions:true,allCopyControls:true,boundedStorage:true,blockedStorage:true,copyRecovery:true,landscapeDialog:true,touchManualClose:true,enlargedHeader:true,lateFontsPreserveChoice:true,focusReturn:true,illustrationReturn:true,illustrationLinkFallback:true,coverMotionControl:true,keyboardTabs:true,observerFallback:true,staticRoutes:true});
    } finally { await browser.close(); }
  }
  await writeFile(new URL('receipt.json', output), JSON.stringify({checkedAt: new Date().toISOString(), passed: true, receipts, limits: 'Automated Chromium/WebKit behavior checks with controlled clipboard and storage failures; not physical-device or screen-reader acceptance.'}, null, 2) + '\n');
  console.log(JSON.stringify({passed: true, engines: receipts.map(r => r.engine), checks: 'Draft, copy, keyboard and enhancement recovery'}));
} finally {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
