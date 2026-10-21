import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from '../scripts/build.mjs';
import {startServer} from '../scripts/serve.mjs';
import {appReady,dismissNotice,watch,policyWatch,assertClean} from './harness.mjs';
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'test-results/offline');await mkdir(output,{recursive:true});
const book=JSON.parse(await readFile(path.join(root,'edition/library.json'),'utf8'))[0];
const engines=(process.env.QA_ENGINE||'chromium,webkit').split(','),receipts=[];
const sectionText=id=>book.sections.find(s=>s.id===id).blocks.map(p=>p.text+p.after).join('');
async function stop(server){if(server)await server.close();}
async function ready(page,id){await appReady(page);await page.locator(`#reading-text[data-section="${id}"][data-position-ready="true"]`).waitFor();assert.equal(await page.locator('#reading-text').textContent(),sectionText(id));}
async function loadState(page){return page.evaluate(async()=>(await import('/db.mjs')).loadState());}
async function select(page,single=false){
  return page.evaluate(single=>{const nodes=[...document.querySelectorAll('#reading-text [data-block]')];const r=document.createRange();r.setStart(nodes[0].firstChild,5);if(single)r.setEnd(nodes[0].firstChild,Math.min(185,nodes[0].firstChild.length));else r.setEnd(nodes[1].firstChild,25);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));return r.toString();},single);
}
async function tap(page,selector){const locator=page.locator(selector);await locator.scrollIntoViewIfNeeded();const box=await locator.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=page.viewportSize().height,'Touch action must be in view');await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);}
async function screen(page,name){await page.evaluate(async()=>{await document.fonts.ready;const scope=document.querySelector('dialog[open]')||document;await Promise.all([...scope.querySelectorAll('img')].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).map(i=>{i.loading='eager';return i.decode();}));});await page.screenshot({path:path.join(output,name+'.png')});}

await build();
for(const engine of engines){
  let origin,restoreOrigin,browser;
  let base,restoreBase;
  const record={engine,checks:[]};
  try{
    origin=await startServer();restoreOrigin=await startServer();base=origin.url;restoreBase=restoreOrigin.url;
    record.buildIdentity=JSON.parse(await readFile(path.join(root,'dist','build.json'),'utf8'));
    record.offlineMethod=engine==='chromium'?'Origin stopped and browser network emulation disabled connectivity':'Origin stopped; WebKit offline-emulation flag not used';
    const executablePath=engine==='chromium'?process.env.CHROMIUM_PATH:process.env.WEBKIT_PATH;
    browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});record.version=browser.version();
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce',acceptDownloads:true});const observed=watch(context);await policyWatch(context);const page=await context.newPage();
    const id='part-07-chapter-10';await page.goto(base+`/#read/${book.id}/${id}`);await ready(page,id);await dismissNotice(page);
    record.controlledBeforeOffline=await page.evaluate(()=>!!navigator.serviceWorker.controller);await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Available offline'));
    const cache=await page.evaluate(async()=>{const registration=await navigator.serviceWorker.ready,c=new MessageChannel();return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Cache proof timed out')),5000);c.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data);};registration.active.postMessage('CHECK_OFFLINE',[c.port2]);});});assert.equal(cache.ready,true);assert.equal(cache.version,record.buildIdentity.version);record.cache=cache;
    // Stop the origin, then reopen the very same URL. APIRequestContext bypasses
    // service workers and supplies an independent failed-network control.
    await stop(origin);origin=null;if(engine==='chromium')await context.setOffline(true);
    await assert.rejects(context.request.get(base+'/network-negative-control',{timeout:3000}));
    await page.reload();await ready(page,id);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    assert.equal(await page.evaluate(()=>document.fonts.check('21px Literata')),true);
    // Await real browser promises and assert bytes explicitly. The installed
    // Playwright runtime is not a reliable gate for async waitForFunction.
    const runtimeNames=['app.mjs','edition.mjs','edition.css','library.json','companion.json'];
    record.loadedAssets=await page.evaluate(async names=>{
      const result={};for(const name of names){const response=await fetch('/'+name);if(!response.ok)throw Error('Offline asset unavailable: '+name);result[name]=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await response.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');}return result;
    },runtimeNames);
    for(const name of runtimeNames)assert.equal(record.loadedAssets[name],createHash('sha256').update(await readFile(path.join(root,'dist',name))).digest('hex'));
    record.reopenedCache=await page.evaluate(async()=>{const c=new MessageChannel();return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker proof timed out')),5000);c.port1.onmessage=e=>{clearTimeout(timer);resolve(e.data);};navigator.serviceWorker.controller.postMessage('CHECK_OFFLINE',[c.port2]);});});
    assert.equal(record.reopenedCache.ready,true);assert.equal(record.reopenedCache.version,record.buildIdentity.version);
    const quotation=await select(page);await tap(page,'#selection-save');await page.locator('#note-text').fill('Saved while the origin is stopped.');await tap(page,'#note-form [type="submit"]');await page.locator('#dialog').waitFor({state:'hidden'});
    let state=await loadState(page);assert.equal(state.notes.length,1);assert.equal(state.notes[0].quote,quotation);
    await page.reload();await ready(page,id);state=await loadState(page);assert.equal(state.notes[0].note,'Saved while the origin is stopped.');assert.equal(state.notes[0].quote,quotation);
    await page.locator('[data-action="at-hand"]').click();await page.locator('#dialog [data-action="reveal-picture"]').click();await page.locator('[data-action="allow-picture"]').click();await page.locator('.picture-viewport img').evaluate(i=>i.decode());await screen(page,`${engine}-offline-sleigh`);
    await page.locator('[data-action="picture-context"]').click();await page.locator('#context-text[data-location-ready="true"]').waitFor();assert.equal(await page.locator('#context-text').textContent(),sectionText(id));
    await page.locator('#dialog [data-action="close"]').click();await page.locator('#reading-text[data-position-ready="true"]').waitFor();
    await page.goto(base+`/#read/${book.id}/part-17-chapter-12`);await ready(page,'part-17-chapter-12');await page.reload();await ready(page,'part-17-chapter-12');
    await screen(page,`${engine}-offline-second-epilogue`);
    record.checks.push('Stopped origin plus failed direct-network negative control; cold reload, full novel, fonts, image/source excursion and repeated epilogue navigation work from the active worker cache.');
    record.checks.push('Touch tap on the real selection action and save writes an exact multi-block quote offline; another reload preserves the note. This is browser touch emulation, not physical iOS selection.');

    // Make the first quotation card only after the origin is unavailable.
    await select(page,true);await tap(page,'#selection-save');await page.locator('[data-card-action="make"]').click();
    await page.locator('[data-card-state="ready"]').waitFor();assert.ok(await page.locator('.passage-card-image').evaluate(i=>i.naturalWidth>0));await screen(page,`${engine}-first-card-offline`);
    await page.locator('#dialog [data-action="close"]').click();await page.locator('#dialog').waitFor({state:'hidden'});
    record.checks.push('The first local quotation-card PNG is generated with the origin stopped and is inspected as an image; no native delivery claim.');

    await page.locator('[data-action="settings"]').click();await page.locator('[data-action="bundle-export"]').click();
    const download=page.waitForEvent('download');await page.locator('#bundle-export-form [type="submit"]').click();const file=await download,bundleFile=path.join(output,`${engine}-private.reader-bundle.json`);await file.saveAs(bundleFile);
    const bundle=JSON.parse(await readFile(bundleFile,'utf8'));assert.deepEqual(bundle.books[0],book);assert.equal(bundle.state.notes.length,1);assert.ok(bundle.books[0].context.some(c=>c.text.includes('FULL PROJECT GUTENBERG LICENSE')));
    // Different origin and empty browser storage. Refuse all library/apparatus
    // requests, including worker requests by blocking workers in this context.
    const empty=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
    await empty.route('**/library.json',r=>r.fulfill({status:404,body:'Intentionally unavailable'}));
    await empty.route('**/structure.json',r=>r.fulfill({status:404,body:'Intentionally unavailable'}));
    await empty.route('**/companion.json',r=>r.fulfill({status:404,body:'Intentionally unavailable'}));
    const restoredObserved=watch(empty);await policyWatch(empty);const recovered=await empty.newPage();await recovered.goto(restoreBase);await appReady(recovered);await recovered.locator('[data-action="settings"]').click();await recovered.locator('#bundle-file').setInputFiles(bundleFile);await recovered.locator('[data-action="bundle-apply"]').click();await recovered.locator('#dialog').waitFor({state:'hidden'});
    await dismissNotice(recovered);await recovered.locator('.begin-reading').click();await recovered.locator('#reading-text[data-position-ready="true"]').waitFor();assert.equal(await recovered.locator('#reading-text').textContent(),sectionText('part-17-chapter-12'));
    const recoveredState=await loadState(recovered);assert.deepEqual(recoveredState.notes,bundle.state.notes);assert.deepEqual(recoveredState.boundaries,{});
    await recovered.locator('[data-action="edition-about"]').first().click();assert.ok((await recovered.locator('#source-notices').textContent()).includes('FULL PROJECT GUTENBERG LICENSE'));await screen(recovered,`${engine}-restored-source-notices`);
    record.checks.push('Exact text edition and complete source notices restore at a different origin with library/structure/companion endpoints genuinely 404 and workers blocked. Notes agree exactly; picture scope does not widen. Art and fonts are explicitly outside the text bundle.');
    await assertClean(page,observed);await assertClean(recovered,restoredObserved);record.pageErrors=[...observed.errors,...restoredObserved.errors];record.externalRequests=[...observed.external,...restoredObserved.external];record.passed=true;
  }catch(error){record.passed=false;record.error=error.stack;throw error;}
  finally{receipts.push(record);await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipts,null,2)+'\n');await browser?.close();await stop(origin);await stop(restoreOrigin);}
}
console.log(JSON.stringify(receipts.map(r=>({engine:r.engine,passed:r.passed,checks:r.checks.length})),null,2));
