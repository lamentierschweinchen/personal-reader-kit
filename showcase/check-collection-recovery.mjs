// Run against the already-built combined site. All downloads and evidence stay ignored.
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const engines=process.env.RECOVERY_ENGINES?.split(',')||['chromium','webkit'];
assert.ok(engines.length&&engines.every(e=>['chromium','webkit'].includes(e)),'Unknown recovery browser');
const fixtureRoot=process.env.SHOWCASE_FIXTURE_ROOT?pathToFileURL(path.resolve(process.env.SHOWCASE_FIXTURE_ROOT)+path.sep):new URL('./dist/',import.meta.url);
const slug='beside-the-bed',mount='/'+slug+'/',directory=new URL(slug+'/',fixtureRoot);
const sharedModule='/continuation.mjs',sharedBytes=await readFile(new URL(sharedModule.slice(1),fixtureRoot));
const out=process.env.REVIEW_OUTPUT?pathToFileURL(path.resolve(process.env.REVIEW_OUTPUT)+path.sep):new URL('../test-results/showcase/collection-recovery/',import.meta.url);await mkdir(out,{recursive:true});
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const hash=value=>createHash('sha256').update(value).digest('hex');
const books=JSON.parse(await readFile(new URL('library.json',directory))),notices=JSON.parse(await readFile(new URL('notices.json',directory)));
const noticeKeys={'nightingale-1898':'nightingale','whitman-specimen':'whitman'};
assert.deepEqual(books.map(b=>b.id).sort(),Object.keys(noticeKeys).sort(),'Reviewed recovery collection');
const missing=['library.json','studies.json','sources.json','notices.json'];
const allowed=new Set(await readdir(directory));
const payloads=new Map(await Promise.all([...allowed].map(async file=>[file,await readFile(new URL(file,directory))])));
const security=JSON.parse(await readFile(new URL('./vercel.json',import.meta.url))).routes.find(r=>r.headers?.['Content-Security-Policy']).headers;
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const result={checkedAt:new Date().toISOString(),passed:false,collection:slug,appSha256:hash(payloads.get('app.mjs')),workerSha256:hash(payloads.get('sw.js')),browsers:[],limits:'Developer regression at distinct loopback origins and separately launched browsers. Restores books, notes and full notices into a matching app. Missing companion data deliberately keeps complete-collection offline readiness false. Not an installed home-screen or physical-device test.'};
const save=()=>writeFile(new URL('receipt.json',out),JSON.stringify(result,null,2)+'\n');

async function fixture(blockOptional){
 const requests=[];
 const server=createServer(async(req,res)=>{
  let pathname,status=404;const arrival={path:new URL(req.url,'http://localhost').pathname,status:null,destination:req.headers['sec-fetch-dest']||''};requests.push(arrival);
  try{
   pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const shared=pathname===sharedModule;
   const file=pathname===mount?'index.html':pathname.startsWith(mount)?pathname.slice(mount.length):'';
   // This is an HTTP response rule, including requests made by the service worker.
   if(req.method==='GET'&&(shared||allowed.has(file)&&(!blockOptional||!missing.includes(file)))){
    const bytes=shared?sharedBytes:payloads.get(file);status=200;
    res.writeHead(status,{'Content-Type':types[path.extname(shared?sharedModule:file)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store',...security});res.end(bytes);
   }else{res.writeHead(status,{'Content-Type':'text/plain','Content-Length':9,'Cache-Control':'no-store'});res.end('Not found');}
  }catch{if(!res.headersSent){res.writeHead(404);res.end('Not found');}}
  finally{Object.assign(arrival,{path:pathname,status});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 const origin='http://127.0.0.1:'+server.address().port;
 return {origin,requests,async stop(){if(server.listening){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))}}};
}
function launch(engine){const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;return pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})})}
async function trackedPage(browser,origin){
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:402,height:874}}),page=await context.newPage(),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));context.on('request',r=>{const url=new URL(r.url());if(!['data:','blob:'].includes(url.protocol)&&url.origin!==origin)external.push(r.url())});
 return {page,context,errors,external};
}
const snapshot=page=>page.evaluate(async mount=>(await import(mount+'db.mjs')).librarySnapshot(),mount);
const ready=(page,book,section)=>page.locator(`#reading-text[data-book="${book}"][data-section="${section}"][data-position-ready="true"]`).waitFor();
async function controlled(page){
 // First activation deliberately reloads the app. Wait for its completed check,
 // rather than inspecting the old document between controllerchange and reload.
 for(let attempt=0;attempt<5;attempt++){
  try{
   await page.waitForFunction(()=>!!navigator.serviceWorker.controller&&/Available offline|Offline copy (incomplete|not verified)/.test(document.querySelector('#offline-status')?.textContent||''),{},{timeout:60000});
   await page.waitForTimeout(150);
   const worker=await page.evaluate(async()=>({script:new URL(navigator.serviceWorker.controller.scriptURL).pathname,scopes:(await navigator.serviceWorker.getRegistrations()).map(r=>new URL(r.scope).pathname)}));
   assert.equal(worker.script,mount+'sw.js');assert.deepEqual(worker.scopes,[mount]);return;
  }catch(error){if(!/Execution context was destroyed|navigation/.test(error.message)||attempt===4)throw error;}
 }
}
async function workerReadiness(page){
 return page.evaluate(()=>new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(Error('Worker readiness response timed out')),5000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data)};navigator.serviceWorker.controller.postMessage('CHECK_OFFLINE',[channel.port2])}));
}
async function fontLoaded(page){
 const fonts=await page.evaluate(async()=>{await document.fonts.load('400 22px Bitter');await document.fonts.load('italic 400 22px Bitter');await document.fonts.ready;return [...document.fonts].filter(f=>f.family.replace(/["']/g,'')==='Bitter').map(f=>({style:f.style,status:f.status}))});
 assert.ok(['normal','italic'].every(style=>fonts.some(f=>f.style===style&&f.status==='loaded')),'The real upright and italic Bitter fonts load');return fonts;
}
function exactBooks(actual,expected,label){
 assert.deepEqual(actual.map(b=>b.id).sort(),expected.map(b=>b.id).sort(),label+' book identities');
 for(const book of expected)assert.ok(canonical(actual.find(b=>b.id===book.id))===canonical(book),label+' exact edition '+book.id);
}
async function noticesUI(page,expectedBooks){
 await page.goto(new URL(mount+'#shelf',page.url()).href);await page.locator('.bedside-shelf').waitFor();
 await page.locator('main [data-action="collection-about"]').click();await page.locator('#dialog[open] .source-terms summary').click();
 assert.equal(await page.locator('[data-source-notice]').count(),expectedBooks.length);
 for(const book of expectedBooks){const notice=page.locator(`[data-source-notice="${book.id}"]`);assert.equal(await notice.isVisible(),true);assert.ok(await notice.textContent()===notices[noticeKeys[book.id]],'Sources UI recovers every notice character for '+book.id)}
 await page.locator('#dialog [data-action="close"]').click();await page.locator('#dialog').waitFor({state:'hidden'});
}
async function verifyStorage(page,bundle,label){
 const stored=await snapshot(page);exactBooks(stored.books,bundle.books,label);
 assert.deepEqual(stored.state.notes,bundle.state.notes,label+' saved notes');
 assert.deepEqual(stored.sourceNotices.map(n=>n.bookId).sort(),bundle.books.map(b=>b.id).sort(),label+' persisted notice identities');
 for(const book of bundle.books)assert.ok(stored.sourceNotices.find(n=>n.bookId===book.id).text===notices[noticeKeys[book.id]],label+' full stored notice '+book.id);
 const anchors=await page.evaluate(async mount=>{const db=await import(mount+'db.mjs'),core=await import(mount+'core.mjs'),s=await db.librarySnapshot();return {database:(await db.openDB()).name,notes:s.state.notes.map(n=>({id:n.id,valid:core.anchorStatus(n,s.books.find(b=>b.id===n.bookId)).valid}))}},mount);
 assert.equal(anchors.database,'newreading-'+slug+'-v1');assert.ok(anchors.notes.every(n=>n.valid),label+' all recovered notes have exact source anchors');
 return {books:stored.books.length,notes:anchors.notes.length,notices:stored.sourceNotices.length,anchoredNotes:anchors.notes.filter(n=>n.valid).length};
}
async function actualReading(page,origin,book){
 const section=book.id==='nightingale-1898'?book.sections.find(s=>s.id==='id00210'):book.sections.find(s=>s.blocks.some(b=>b.text.length>100));assert.ok(section,'Substantial complete reading section');
 await page.goto(origin+mount+'#read/'+book.id+'/'+section.id);await ready(page,book.id,section.id);
 assert.ok(await page.locator('#reading-text').textContent()===section.blocks.map(b=>b.text+b.after).join(''),'Recovered source renders exactly: '+book.id);
 assert.match(await page.locator('#reading-text').evaluate(e=>getComputedStyle(e).fontFamily),/^['"]?Bitter/);
 return section.id;
}

for(const engine of engines){
 let healthy,browser;const report={engine,exports:[],restores:[]};result.inProgress=report;
 try{
  healthy=await fixture(false);
  for(const denied of ['/unreviewed-shared.mjs','/analytics.mjs','/another-reader/index.html'])assert.equal((await fetch(healthy.origin+denied)).status,404,'Fixture still excludes '+denied);
  browser=await launch(engine);const source=await trackedPage(browser,healthy.origin),page=source.page;
  await page.goto(healthy.origin+mount+'#read/nightingale-1898/id00210');await ready(page,'nightingale-1898','id00210');
  await controlled(page);await page.waitForFunction(()=>document.querySelector('#offline-status')?.textContent.includes('Available offline'),{},{timeout:60000});assert.equal((await workerReadiness(page)).ready,true);
  await fontLoaded(page);
  await page.evaluate(()=>{const block=[...document.querySelectorAll('#reading-text [data-block]')].find(e=>e.textContent.length>60),walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())&&node.length<35){};const range=document.createRange();range.setStart(node,0);range.setEnd(node,30);getSelection().removeAllRanges();getSelection().addRange(range)});
  await page.locator('#selection-save').click();await page.locator('#note-text').fill('Original collection recovery regression note.');await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
  // Hosted editions may remain in the worker cache until exported; the UI merges
  // them with locally imported editions. Persisted records/notices are separate.
  const original=await snapshot(page);assert.equal(original.state.notes.length,1);assert.equal(original.sourceNotices.length,books.length);
  const engineOut=new URL(engine+'/',out);await mkdir(engineOut,{recursive:true});
  await page.locator('[data-action="settings"]').first().click();await page.locator('[data-action="bundle-export"]').click();await page.locator('#bundle-export-form').waitFor();
  const fullEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download private bundle',exact:true}).click();const full=await fullEvent;assert.equal(await full.failure(),null);const fullPath=fileURLToPath(new URL('full.reader-bundle.json',engineOut));await full.saveAs(fullPath);
  await page.locator('[data-action="settings"]').first().click();const singleEvent=page.waitForEvent('download');await page.locator('[data-action="export-edition"][data-book="nightingale-1898"]').click();const single=await singleEvent;assert.equal(await single.failure(),null);const singlePath=fileURLToPath(new URL('one-edition.reader-bundle.json',engineOut));await single.saveAs(singlePath);
  const fullBundle=JSON.parse(await readFile(fullPath)),singleBundle=JSON.parse(await readFile(singlePath));
  for(const [kind,bundle,expected]of [['full',fullBundle,books],['one-edition',singleBundle,books.filter(b=>b.id==='nightingale-1898')]]){
   assert.equal(bundle.format,'personal-reader-bundle');assert.equal(bundle.noticeProfile,'beside-the-bed/source-notices@1');exactBooks(bundle.books,expected,'Downloaded '+kind);
   assert.deepEqual(bundle.sourceNotices.map(n=>n.bookId).sort(),expected.map(b=>b.id).sort());for(const book of expected)assert.ok(bundle.sourceNotices.find(n=>n.bookId===book.id).text===notices[noticeKeys[book.id]],'Downloaded full notice bytes');
   assert.deepEqual(bundle.state.notes,kind==='full'?original.state.notes:[]);report.exports.push({kind,books:bundle.books.length,notes:bundle.state.notes.length,notices:bundle.sourceNotices.length,bundleSha256:hash(canonical(bundle))});
  }
  assert.deepEqual(source.errors,[]);assert.deepEqual(source.external,[]);await browser.close();browser=null;
  const seenOrigins=new Set([healthy.origin]);
  for(const [kind,bundle,bundlePath]of [['full',fullBundle,fullPath],['one-edition',singleBundle,singlePath]]){
   let target,recovery;
   try{
    target=await fixture(true);assert.ok(!seenOrigins.has(target.origin),'Every recovery target has a new origin');seenOrigins.add(target.origin);
    browser=await launch(engine);recovery=await trackedPage(browser,target.origin);const p=recovery.page;await p.goto(target.origin+mount);await controlled(p);
    await p.waitForFunction(()=>document.querySelector('#offline-status')?.textContent==='Offline copy incomplete',{},{timeout:60000});assert.equal((await workerReadiness(p)).ready,false);
    const empty=await snapshot(p);assert.equal(empty.books.length,0,'Fresh recovery browser has no books');assert.equal(empty.state.notes.length,0);assert.equal(empty.sourceNotices.length,0);
    await p.locator('[data-action="settings"]').first().click();await p.locator('#bundle-file').setInputFiles(bundlePath);await p.locator('[data-action="bundle-apply"]').waitFor();assert.equal(await p.locator('[data-action="bundle-apply"]').isEnabled(),true);await p.locator('[data-action="bundle-apply"]').click();await p.locator('#dialog').waitFor({state:'hidden'});
    const stored=await verifyStorage(p,bundle,engine+' '+kind);await noticesUI(p,bundle.books);let lastSection,lastBook;
    for(const book of bundle.books){lastBook=book;lastSection=await actualReading(p,target.origin,book)}
    const fonts=await fontLoaded(p);await controlled(p);
    const cache=await p.evaluate(async()=>{const names=await caches.keys();return Promise.all(names.map(async name=>({name,paths:(await (await caches.open(name)).keys()).map(r=>new URL(r.url).pathname)})))});
    assert.equal(cache.length,1);assert.match(cache[0].name,/^newreading-beside-the-bed-[a-f0-9]{16}$/);assert.ok(cache[0].paths.every(p=>p.startsWith(mount)||p===sharedModule),'Only this reader and the exact shared continuation module enter its cache');assert.ok(cache[0].paths.includes(sharedModule),'The recovery shell includes continuation offline');
    assert.equal(await p.evaluate(async name=>(await(await(await caches.open(name)).match('/continuation.mjs')).text()),cache[0].name),sharedBytes.toString(),'Cached shared module matches this built candidate');for(const file of missing)assert.ok(!cache[0].paths.includes(mount+file),'Absent data never enters the worker cache');
    for(const file of ['index.html','app.mjs','bitter-normal.woff2','bitter-italic.woff2'])assert.ok(cache[0].paths.includes(mount+file),'Recovery shell caches '+file);
    assert.equal((await workerReadiness(p)).ready,false,'A book bundle cannot certify unavailable companions');assert.equal(await p.locator('#offline-status').textContent(),'Offline copy incomplete');
    await target.stop();await p.reload();await ready(p,lastBook.id,lastSection);
    assert.equal(await p.evaluate(async()=>{try{await fetch('/uncached-recovery-control-'+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(5000)});return false}catch{return true}}),true,'Stopped-origin negative control fails at the network');
    await verifyStorage(p,bundle,engine+' '+kind+' offline');for(const book of bundle.books)await actualReading(p,target.origin,book);await fontLoaded(p);await noticesUI(p,bundle.books);
    await p.goto(target.origin+mount+'#companion');await p.getByRole('heading',{name:'Companion unavailable',exact:true}).waitFor();assert.equal(await p.locator('[data-study-text]').count(),0);assert.equal((await workerReadiness(p)).ready,false);assert.equal(await p.locator('#offline-status').textContent(),'Offline copy incomplete');
    await p.screenshot({path:fileURLToPath(new URL(kind+'-offline.png',engineOut))});assert.deepEqual(recovery.errors,[]);assert.deepEqual(recovery.external,[]);
    const failures=Object.fromEntries(missing.map(file=>[file,target.requests.filter(r=>r.path===mount+file&&r.status===404).length]));for(const file of missing)assert.ok(failures[file]>=2,'HTTP fixture blocks both initial page fetches and worker-install optional fetches: '+file);
    report.restores.push({kind,...stored,freshOrigin:true,separateBrowser:true,serverLevel404s:failures,scope:mount,cachePrefix:'newreading-'+slug+'-',loadedFonts:fonts,stoppedOriginReload:true,uncachedNetworkControlFailed:true,exactOfflineReading:true,fullNoticesRecoveredOffline:true,completeCollectionReady:false,missingCompanionReported:true,exactSharedModuleCached:true,otherRootAndReaderPathsExcluded:true,externalRequests:0});await save();
   }catch(error){
    const diagnostic={engine,kind,error:error.stack,requests:target?.requests,errors:recovery?.errors};
    if(recovery?.page){await recovery.page.screenshot({path:fileURLToPath(new URL(kind+'-failure.png',engineOut))}).catch(()=>{});diagnostic.page=await recovery.page.evaluate(async()=>({text:document.body.innerText.slice(0,3000),controller:navigator.serviceWorker.controller?.scriptURL,registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:r.active?.state,waiting:r.waiting?.state,installing:r.installing?.state})),caches:await caches.keys()})).catch(e=>({error:e.message}))}
    await writeFile(new URL(kind+'-failure.json',engineOut),JSON.stringify(diagnostic,null,2)+'\n');throw error;
   }finally{await browser?.close();browser=null;await target?.stop()}
  }
  result.browsers.push(report);delete result.inProgress;await save();console.log(engine+': full and one-edition bundles recover exact books and notices at fresh data-less origins, with stopped-origin reading; complete-collection readiness stays false.');
 }catch(error){result.failure=error.stack;await save();throw error}finally{await browser?.close();browser=null;await healthy?.stop()}
}
result.passed=true;await save();
