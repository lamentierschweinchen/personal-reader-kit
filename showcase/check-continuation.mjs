// Focused continuation journeys. --skip-build checks the existing mounted output.
// BASE_URL uses an already-served isolated candidate; evidence stays ignored.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import {buildShowcase} from './build.mjs';
import {serve} from './serve.mjs';
import {fileURLToPath} from 'node:url';
import {PUBLIC_WORKS,CONTINUATION_KEY} from './continuation.mjs';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
if(!process.env.BASE_URL&&!process.argv.includes('--skip-build'))await buildShowcase();
const server=process.env.BASE_URL?null:await serve();
const base=process.env.BASE_URL||'http://127.0.0.1:'+server.address().port,results=[];
const evidence=process.env.CONTINUATION_EVIDENCE||fileURLToPath(new URL('../test-results/continuation',import.meta.url));
const engines=process.env.CONTINUATION_ENGINES?.split(',')||['chromium','webkit'];
async function optionalModuleLoading(browser,engine){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),errors=[];
 let release,requests=0;const held=new Promise(resolve=>release=resolve);
 await context.route('**/continuation.mjs',async route=>{requests++;await held;await route.continue();});
 try{
  const library=await context.newPage();library.on('pageerror',error=>errors.push(String(error)));
  await library.goto(base+'/library/',{waitUntil:'domcontentloaded',timeout:10000});
  assert.equal(await library.locator('script[data-newreading-continuation]').getAttribute('type'),'application/json','configuration is inert');assert.equal(await library.locator('script[data-newreading-continuation]').getAttribute('src'),null,'no external script joins document load');
  await library.waitForFunction(()=>document.body.dataset.libraryReady==='true');
  await library.locator('#search').fill('Austen');assert.equal(await library.locator('.book:not([hidden])').count(),1);await library.locator('#search').fill('');
  await library.locator('[data-preview="alice"]').click();await library.locator('dialog[open]').waitFor();await library.locator('dialog[open] .close-dialog').click();
  const reader=await context.newPage();await reader.bringToFront();reader.on('pageerror',error=>errors.push(String(error)));
  await reader.goto(base+'/austen/#read/austen-pride-1894/chapter-1',{waitUntil:'domcontentloaded',timeout:10000});await reader.locator('#reading-text[data-position-ready="true"]').waitFor({timeout:10000});
  await reader.locator('[data-action="contents"]').click();await reader.locator('dialog[open]').waitFor();await reader.locator('dialog[open] [data-action="close"]').first().click();
  await reader.evaluate(()=>scrollTo(0,650));await reader.waitForTimeout(800);
  const saved=await reader.evaluate(async()=>{const {rawState}=await import('/austen/db.mjs');return (await rawState()).positions['austen-pride-1894'];});assert.ok(saved.blockId,'normal position saved while optional module held');
  assert.equal(await reader.evaluate(key=>localStorage.getItem(key),CONTINUATION_KEY),null);assert.ok(requests>=2,'both library and reader optional requests remained held');
  assert.equal(await reader.evaluate(()=>document.readyState),'complete','held optional import does not block document load');
  release();await Promise.all([reader.evaluate(()=>import('/continuation.mjs').then(()=>true)),library.evaluate(()=>import('/continuation.mjs').then(()=>true))]);
  assert.equal(await reader.evaluate(key=>localStorage.getItem(key),CONTINUATION_KEY),null,'late listener does not replay prior saves');
  await reader.evaluate(()=>scrollTo(0,1000));await reader.waitForFunction(key=>!!localStorage.getItem(key),CONTINUATION_KEY);await library.locator('[data-continuation-link]').waitFor({state:'visible'});
  await library.close();await reader.goto(base+'/library/');await reader.locator('[data-continuation-link]').click();await reader.waitForURL(url=>url.hash.startsWith('#read/'));await reader.locator('#reading-text[data-position-ready="true"]').waitFor();assert.ok(await reader.evaluate(()=>scrollY)>10,'released module enables later-save continuation');
  assert.deepEqual(errors,[]);
 }finally{release();await context.close();}
 // A failed optional download must also leave both primary applications usable.
 const failed=await browser.newContext({serviceWorkers:'block'});await failed.route('**/continuation.mjs',route=>route.abort('failed'));
 try{
  const reader=await failed.newPage();await reader.goto(base+'/austen/#read/austen-pride-1894/chapter-1');await reader.locator('#reading-text[data-position-ready="true"]').waitFor();await reader.evaluate(()=>scrollTo(0,650));await reader.waitForTimeout(800);
  assert.ok(await reader.evaluate(async()=>{const {rawState}=await import('/austen/db.mjs');return (await rawState()).positions['austen-pride-1894'].blockId;}));assert.equal(await reader.evaluate(key=>localStorage.getItem(key),CONTINUATION_KEY),null);
  await reader.goto(base+'/library/');await reader.locator('#search').fill('Austen');assert.equal(await reader.locator('.book:not([hidden])').count(),1);assert.equal(await reader.locator('[data-continuation]').isVisible(),false);
 }finally{await failed.close();}
 results.push({engine,heldModuleReadingUsable:true,heldModuleLibraryControlsUsable:true,lateListenerNoReplay:true,laterSaveAndContinue:true,failedModulePrimaryAppsUsable:true});console.log(engine,'held/failed optional-module checks passed');
}
try{
for(const engine of engines){
 const browser=await ({chromium,webkit})[engine].launch({executablePath:process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'],headless:true});
 const network=[];
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));context.on('request',request=>network.push({url:request.url(),method:request.method(),body:request.postData()}));
 try{
  await optionalModuleLoading(browser,engine);
  if(process.argv.includes('--module-loading-only'))continue;
  for(const [edition,ids] of Object.entries(PUBLIC_WORKS)){
   const started=Date.now(),books=await (await context.request.get(base+'/'+edition+'/library.json')).json(),book=books.find(book=>book.id===ids.at(-1));
   const section=book.sections.find(s=>s.id==='chapter-1')||book.sections.find(s=>s.blocks.reduce((n,b)=>n+(b.text?.length||0),0)>4000)||book.sections[0];
   await page.goto(base+'/'+edition+'/#read/'+book.id+'/'+section.id);await page.locator('#reading-text[data-position-ready="true"]').waitFor({timeout:95000});
   await page.waitForTimeout(350);const notice=page.locator('dialog[open] [data-action=close]').first();if(await notice.isVisible())await notice.click();await page.evaluate(()=>window.scrollTo(0,600));await page.waitForTimeout(800);await page.waitForFunction(({key,edition,work})=>{try{const p=JSON.parse(localStorage.getItem(key));return p.edition===edition&&p.work===work;}catch{return false;}},{key:CONTINUATION_KEY,edition,work:book.id},{timeout:15000});
   const marker=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),CONTINUATION_KEY);assert.deepEqual(Object.keys(marker).sort(),['at','edition','v','work']);
   await page.goto(base+'/library/');const link=page.locator('[data-continuation-link]');await link.waitFor({state:'visible'});assert.equal(await link.getAttribute('href'),'/'+edition+'/#continue/'+book.id);
   await link.focus();await page.keyboard.press('Enter');await page.waitForURL(url=>url.hash.startsWith('#read/'));await page.locator('#reading-text[data-position-ready="true"]').waitFor();assert.equal(new URL(page.url()).hash,'#read/'+book.id+'/'+section.id);assert.ok(await page.evaluate(()=>scrollY)>10,'restores actual scroll '+edition+' '+section.id);
   await page.goBack();await page.waitForURL(base+'/library/');await link.waitFor({state:'visible'});await link.click();await page.waitForURL(url=>url.hash.startsWith('#read/'));await page.reload();await page.locator('#reading-text[data-position-ready="true"]').waitFor();assert.ok(!page.url().includes('#continue/'));
   results.push({engine,edition,work:book.id,resumeBackRefresh:true,milliseconds:Date.now()-started});console.log(engine,edition,'resume/back/refresh passed');
  }
  // Opening companions and games is not a reading-position save.
  const before=await page.evaluate(key=>localStorage.getItem(key),CONTINUATION_KEY);
  await page.goto(base+'/alice/#companion');await page.waitForTimeout(400);assert.equal(await page.evaluate(key=>localStorage.getItem(key),CONTINUATION_KEY),before);
  await page.goto(base+'/alice/play/');assert.equal(await page.evaluate(key=>localStorage.getItem(key),CONTINUATION_KEY),before);
  // Inject an exact restored object, then a same-ID changed object, as storage fault fixtures.
  await page.goto(base+'/library/');await page.locator('[data-continuation-link]').waitFor({state:'visible'});
  const alter=async changed=>page.evaluate(async changed=>{const raw=(await (await fetch('/war-and-peace/library.json')).json())[0];if(changed)raw.title='Original adversarial changed title';const {saveBook}=await import('/war-and-peace/db.mjs');await saveBook(raw);},changed);
  await alter(false);await page.reload();await page.locator('[data-continuation-link]').waitFor({state:'visible'});
  await alter(true);await page.reload();await page.waitForTimeout(300);assert.equal(await page.locator('[data-continuation]').isVisible(),false);
  await alter(false);await page.reload();await page.locator('[data-continuation-link]').waitFor({state:'visible'});
  // Cross-tab marker updates refresh the displayed work; a malformed pointer hides it.
  const other=await context.newPage();await other.goto(base+'/library/');await other.evaluate(key=>localStorage.setItem(key,JSON.stringify({v:1,edition:'alice',work:'alice-rackham-28885',at:Date.now()})),CONTINUATION_KEY);
  await page.waitForFunction(()=>document.querySelector('[data-continuation-link]').getAttribute('href')==='/alice/#continue/alice-rackham-28885');
  await other.evaluate(key=>localStorage.setItem(key,'{"v":2}'),CONTINUATION_KEY);await page.waitForFunction(()=>document.querySelector('[data-continuation]').hidden);await other.close();
  // Cleared state hides its stale marker without creating or replacing saved records.
  await page.evaluate(async key=>{localStorage.setItem(key,JSON.stringify({v:1,edition:'war-and-peace',work:'war-and-peace-maude',at:Date.now()}));const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('newreading-war-and-peace-v1');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').delete('reader');tx.oncomplete=resolve;tx.onerror=reject;});db.close();},CONTINUATION_KEY);await page.reload();await page.waitForTimeout(300);assert.equal(await page.locator('[data-continuation]').isVisible(),false);
  // Fresh browser: reading the marker must not create an absent reader database.
  const fresh=await browser.newContext({serviceWorkers:'block'}),empty=await fresh.newPage();await empty.goto(base+'/library/');await empty.evaluate(key=>localStorage.setItem(key,JSON.stringify({v:1,edition:'austen',work:'austen-pride-1894',at:Date.now()})),CONTINUATION_KEY);await empty.reload();await empty.waitForTimeout(300);assert.equal(await empty.locator('[data-continuation]').isVisible(),false);assert.deepEqual(await empty.evaluate(()=>indexedDB.databases()),[]);await fresh.close();
  assert.ok(network.every(request=>request.method==='GET'&&request.body===null),'no private request payload');
  assert.deepEqual(errors,[],'browser runtime errors');results.push({engine,clearedStateHidden:true,missingDatabaseNotCreated:true,exactRestoreAccepted:true,sameIdMutationHidden:true,crossTabRefresh:true,companionAndGameNoMarker:true,noRequestPayload:true,pageErrors:errors});
 }finally{await browser.close();}
}
await mkdir(evidence,{recursive:true});await writeFile(evidence+'/browser.json',JSON.stringify({checkedAt:new Date().toISOString(),passed:true,results,limits:'Chromium/WebKit desktop-host emulation; no physical-device or assistive-technology acceptance. Storage failure/blocked cases use deterministic unit fixtures.'},null,2)+'\n');
console.log(JSON.stringify({passed:true,readerJourneys:results.filter(result=>result.edition).length,engines}));
}finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
