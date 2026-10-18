import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {settledCapture} from './experience-browser.mjs';

// Design and shared-fix regression checks use a separate browser library, so
// original import fixtures cannot leak into the real-edition bundle journey.
export async function designChecks({browser,base,engine,out}) {
  const context=await browser.newContext(),page=await context.newPage(),receipt={engine,viewports:[]};
  const ready=async(book,section)=>page.locator(`#reading-text[data-book="${book}"][data-section="${section}"][data-position-ready="true"]`).waitFor();
  const go=async(book,section)=>{await page.goto(`${base}/#read/${book}/${section}`);await ready(book,section);};
  const state=()=>page.evaluate(async()=>(await import('/db.mjs')).loadState());
  const close=()=>page.getByRole('button',{name:'Close ×',exact:true}).click();
  const capture=async name=>{await page.waitForFunction(()=>!document.querySelector('#status')?.textContent);await settledCapture(page,{path:new URL(`${engine}-design-${name}.png`,out).pathname,animations:'disabled'});};
  async function touchTargets(scope) {
    const small=await page.locator(scope).evaluateAll(elements=>elements.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute('aria-label')||e.textContent.trim(),width:r.width,height:r.height};}).filter(r=>r.width<43.9||r.height<43.9));
    assert.deepEqual(small,[],'Touch targets below 44px');
  }
  try {
    for(const [name,width,height] of [['phone',390,844],['phone-landscape',844,390],['tablet',820,1180],['tablet-landscape',1180,820]]) {
      await page.setViewportSize({width,height});await page.goto(base);await page.locator('.pond-survey img').waitFor();await page.locator('.pond-survey img').evaluate(img=>img.decode());assert.equal(await page.getByRole('link',{name:'All readers',exact:true}).getAttribute('href'),'https://newreading.app/');await capture('home-'+name);
      const first=await page.locator('.opening-action .primary').boundingBox();assert.ok(first.y+first.height<height,JSON.stringify(first));
      assert.equal(await page.locator('h1').textContent(),'Walden');
      assert.equal(await page.locator('.book-row .book-title').first().textContent(),'On The Duty Of Civil Disobedience');
      assert.deepEqual(await page.locator('.pond-survey img').evaluate(e=>[e.naturalWidth,e.naturalHeight]),[731,412]);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await touchTargets('.masthead a,.masthead button,.field-shelf button,.field-shelf a,.site-footer button,#catalogue-return');
      const labelSizes=await page.locator('.field-shelf .eyebrow,.field-shelf .small,.pond-survey figcaption').evaluateAll(es=>es.map(e=>parseFloat(getComputedStyle(e).fontSize)));assert.ok(labelSizes.every(size=>size>=11),JSON.stringify(labelSizes));
      await page.getByRole('button',{name:'Enlarge the original pond survey',exact:true}).click();
      assert.deepEqual(await page.locator('.image-view img').evaluate(e=>[e.naturalWidth,e.naturalHeight]),[731,412]);
      await touchTargets('.close-dialog');await close();assert.equal(new URL(page.url()).hash,'');
      await page.locator('.book-row [data-action=resume]').last().click();await ready('civil-disobedience','chap20');assert.equal(await page.locator('#catalogue-return').isVisible(),false);
      assert.equal(await page.locator('.reader-heading h1').textContent(),'ON THE DUTY OF CIVIL DISOBEDIENCE');
      await page.getByRole('link',{name:'Works',exact:true}).click();
      await page.locator('.opening-action button').click();await page.locator('#reading-text[data-book=walden][data-position-ready=true]').waitFor();
      await go('walden','chap02');await capture('reading-start-'+name);
      await page.evaluate(()=>scrollTo(0,1200));await page.waitForTimeout(350);
      const geometry=await page.evaluate(()=>({height:innerHeight,toolbar:document.querySelector('.reader-tools').getBoundingClientRect().toJSON(),masthead:document.querySelector('.masthead').getBoundingClientRect().toJSON(),overflow:document.documentElement.scrollWidth>innerWidth}));
      assert.equal(geometry.overflow,false);assert.ok(geometry.height-geometry.toolbar.bottom>=height*.65,JSON.stringify(geometry));
      if(name==='phone-landscape')assert.ok(geometry.height-geometry.toolbar.bottom>=330,JSON.stringify(geometry));
      await touchTargets('.reader-tools button,.edition-links button,.chapter-links a');await capture('reading-scrolled-'+name);
      receipt.viewports.push({name,width,height,firstReadingActionBottom:first.y+first.height,readingHeightAfterChrome:height-geometry.toolbar.bottom});
    }
    // The source survey on the shelf is a reference excursion, never a new place.
    const saved=(await state()).positions.walden;
    // Use the already-visible target: Playwright's locator auto-scroll can move
    // a sticky ancestor before pointerdown, which is a different reading place.
    const works=await page.getByRole('link',{name:'Works',exact:true}).boundingBox();
    assert.ok(works.y>=0&&works.y+works.height<page.viewportSize().height);
    await page.mouse.click(works.x+works.width/2,works.y+works.height/2);
    await page.getByRole('button',{name:'Enlarge the original pond survey',exact:true}).click();await close();
    await page.locator('.opening-action button').click();await ready('walden','chap02');assert.deepEqual((await state()).positions.walden,saved);
    receipt.shelfSurveyPreservesPlace=true;

    // Import must snapshot the latest reading position before its modal blocks
    // the debounced scroll save. A stationary queued scroll cannot hide recall.
    await page.evaluate(()=>{scrollTo(0,4000);document.querySelector('[data-action="import"]').click();});
    await page.locator('#book-file').waitFor();const beforeImport=(await state()).positions.walden;
    assert.notDeepEqual(beforeImport,saved);
    await page.locator('#book-file').setInputFiles({name:'design-check.json',mimeType:'application/json',buffer:Buffer.from('{invalid')});
    await page.getByRole('button',{name:'Add on this device',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('#dialog-error').textContent.length>0);
    await page.setViewportSize({width:390,height:844});await page.locator('#dialog-error').scrollIntoViewIfNeeded();await capture('awkward-import-error-phone');
    await page.locator('#book-file').setInputFiles({name:'design-check.txt',mimeType:'text/plain',buffer:Buffer.from('Original local design-check fixture.\n\nA second original paragraph.')});
    await page.getByRole('button',{name:'Add on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
    assert.deepEqual((await state()).positions.walden,beforeImport);
    await page.locator('.opening-action button').click();await ready('walden','chap02');
    await page.getByRole('button',{name:'Focus',exact:true}).click();await page.waitForFunction(()=>document.body.classList.contains('focus'));
    await page.locator('#reading-text[data-position-ready="true"]').waitFor();
    await page.keyboard.press('c');await page.locator('#focus-tools').waitFor();
    await page.evaluate(()=>document.dispatchEvent(new Event('scroll')));await page.waitForTimeout(40);
    assert.equal(await page.locator('#focus-tools').isVisible(),true);
    await touchTargets('#focus-tools button');await capture('focus-recalled-phone');
    await page.evaluate(()=>scrollBy(0,100));await page.locator('#focus-tools').waitFor({state:'hidden'});
    await page.keyboard.press('c');await page.locator('#focus-tools').waitFor();
    await page.evaluate(()=>document.querySelector('.fixed-lines').dispatchEvent(new Event('scroll')));await page.locator('#focus-tools').waitFor({state:'hidden'});
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('focus'));
    receipt.sharedFixes={importSavesLatestPlace:true,importErrorRetainsDialog:true,successfulImportPreservesPlace:true,stationaryScrollKeepsRecall:true,realScrollHidesRecall:true,nestedScrollHidesRecall:true};

    await go('walden','chap03');await page.getByRole('button',{name:'Reading settings',exact:true}).click();
    await page.locator('#size').fill('36');await page.locator('#theme').selectOption('dusk');await page.getByRole('button',{name:'Apply to my reader',exact:true}).click();
    await page.evaluate(()=>scrollTo(0,0));await capture('night-large-phone');
    assert.equal(await page.locator('#reading-text').evaluate(e=>getComputedStyle(e).fontSize),'36px');
    await page.setViewportSize({width:844,height:390});await page.evaluate(()=>scrollTo(0,1800));await page.waitForTimeout(350);await capture('night-large-landscape');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.setViewportSize({width:820,height:1180});await page.getByRole('button',{name:'Reading settings',exact:true}).click();await page.locator('#size').fill('21');await page.locator('#theme').selectOption('paper');await page.getByRole('button',{name:'Apply to my reader',exact:true}).click();
    await page.getByRole('link',{name:'Companion',exact:true}).click();await page.locator('[data-action=boundaries]').first().click();
    await page.locator('#boundary-walden').selectOption('18');await page.locator('#boundary-civil-disobedience').selectOption('0');await page.getByRole('button',{name:'Set my boundaries',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.locked-reading').length===0);
    await capture('companion-tablet');await touchTargets('.companion-page button,.bibliography a');
    await page.locator('.source-passages').first().scrollIntoViewIfNeeded();await capture('companion-source-links-tablet');
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await capture('companion-phone');
    // The redesigned account reads from the exact edition and never changes
    // reading position or permission as the reader compares its scopes.
    const accountPlace=(await state()).positions.walden,permissions=(await state()).boundaries;
    const edition=await page.evaluate(async()=>await(await fetch('/library.json')).json());
    const {accountSheets}=await import('../site/companion.mjs');
    for(const sheet of accountSheets){
      await page.locator('#account-sheet').selectOption(sheet.id);
      assert.equal(await page.evaluate(()=>document.activeElement.id),'account-sheet');
      assert.equal(await page.locator('.account-total').textContent(),sheet.total);
      assert.deepEqual(await page.locator('.account-evidence blockquote').allTextContents(),sheet.evidence.map(r=>r.needle));
      await page.locator('.account-original summary').click();
      const ledger=edition[0].sections.find(s=>s.id==='chap02').blocks.find(b=>b.id===sheet.ledger);
      assert.equal(await page.locator('.account-original [data-block]').textContent(),ledger.text);
      await page.locator('.account-evidence button').last().click();await page.locator('#context-text[data-location-ready=true]').waitFor();
      assert.equal(await page.locator('#context-text mark').allTextContents().then(x=>x.join('')),sheet.evidence.at(-1).needle);
      await page.keyboard.press('Escape');assert.equal(await page.locator('.account-original').getAttribute('open'),'');
      assert.deepEqual((await state()).positions.walden,accountPlace);assert.deepEqual((await state()).boundaries,permissions);
    }
    await page.locator('#account-sheet').selectOption('house');
    for(const [name,width,height] of [['desktop',1280,900],['small-phone',320,740],['phone',390,844],['tablet',820,1180],['short-landscape',740,320]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));await capture('accounts-'+name);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await touchTargets('.account-desk button,.account-desk select,.account-desk summary');
      await page.locator('.account-evidence').first().scrollIntoViewIfNeeded();await capture('account-evidence-'+name);
    }
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Reading settings',exact:true}).click();await page.locator('#size').fill('36');await page.getByRole('button',{name:'Apply to my reader',exact:true}).click();
    await page.locator('.account-evidence').first().scrollIntoViewIfNeeded();await capture('account-evidence-large');
    assert.equal(await page.locator('.account-evidence blockquote').first().evaluate(e=>getComputedStyle(e).fontSize),'36px');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.getByRole('button',{name:'Enlarge the original survey for this reading',exact:true}).click();assert.deepEqual(await page.locator('#image-view img').evaluate(e=>[e.naturalWidth,e.naturalHeight]),[731,412]);await capture('companion-survey-detail');await page.keyboard.press('Escape');
    await page.locator('[data-action=boundaries]').first().click();await page.locator('#boundary-walden').selectOption('-1');await page.getByRole('button',{name:'Set my boundaries',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.account-desk,.account-survey').length===0);assert.equal(await page.locator('.account-desk,.account-survey').count(),0);
    receipt.accountDesk={exactQuotations:true,exactLedgers:true,allThreeScopes:true,sourceRoundTrips:true,selectorFocus:true,positionPreserved:true,permissionsPreserved:true,revocationHidesEvidence:true,largeText:true};
    receipt.nightLarge=true;receipt.companionSources=true;
    await writeFile(new URL(`${engine}-design-receipt.json`,out),JSON.stringify(receipt,null,2)+'\n');
    return receipt;
  } finally {await context.close();}
}
