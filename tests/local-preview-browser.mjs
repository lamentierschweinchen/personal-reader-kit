import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir,mkdtemp,copyFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {assets} from '../scripts/build.mjs';
import {startLocalPreview} from '../scripts/preview-local.mjs';
import {fromText} from '../site/core.mjs';
import {setTimeout as delay} from 'node:timers/promises';

const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'test-results/local-preview');
const playwright=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const engines=process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'];
const reports=[];await mkdir(output,{recursive:true});
const appReady=page=>page.waitForFunction(async()=>{await import('/app.mjs');return true;});
const state=page=>page.evaluate(async()=>(await import('/db.mjs')).loadState());
async function controlledCache(page,version) {
  const deadline=Date.now()+15000;let checked;
  // Poll an awaited reply: some browser runtimes accept a Promise itself as
  // truthy in waitForFunction, even when it later resolves to false.
  do {
    checked=await page.evaluate(async()=>{
      const worker=navigator.serviceWorker.controller;
      if(!worker)return {controller:null};
      const status=await new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},1000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};worker.postMessage('CHECK_OFFLINE',[channel.port2]);});
      return {controller:worker.scriptURL,state:worker.state,status};
    });
    if(checked.state==='activated'&&checked.status?.ready&&checked.status?.version===version)break;
    await delay(100);
  }while(Date.now()<deadline);
  assert.equal(checked.state,'activated',JSON.stringify(checked));assert.equal(checked.status?.ready,true,JSON.stringify(checked));assert.equal(checked.status?.version,version,JSON.stringify(checked));
  return await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.ready,worker=navigator.serviceWorker.controller;
    const status=await new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},1000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};worker.postMessage('CHECK_OFFLINE',[channel.port2]);});
    return {controller:{url:worker.scriptURL,state:worker.state},active:registration.active&&{url:registration.active.scriptURL,state:registration.active.state},waiting:registration.waiting?.state,installing:registration.installing?.state,status,caches:await Promise.all((await caches.keys()).map(async name=>({name,library:await(await(await caches.open(name)).match('/library.json'))?.json()}))),library:await(await fetch('/library.json')).json()};
  });
}
async function exportBundle(page,name) {
  await page.getByRole('button',{name:'Reading settings'}).click();
  await page.getByRole('button',{name:'Export a private reading bundle',exact:true}).click();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download private bundle',exact:true}).click();
  const download=await pending,file=path.join(output,name);await download.saveAs(file);
  return {file,bundle:JSON.parse(await readFile(file,'utf8'))};
}
async function selectedNote(page,note) {
  const quote=await page.evaluate(()=>{
    const block=document.querySelector('#reading-text [data-block]'),range=document.createRange();range.selectNodeContents(block);
    const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));return selection.toString();
  });
  await page.locator('#selection-save').click();
  if(await page.getByRole('button',{name:'Keep as a new passage',exact:true}).isVisible())await page.getByRole('button',{name:'Keep as a new passage',exact:true}).click();
  await page.locator('#note-text').fill(note);
  await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
  return quote;
}

for(const engine of engines) {
  const project=await mkdtemp(path.join(tmpdir(),'reader-preview-browser-'));
  let preview,browser,page,phase='setup';const errors=[],external=[],security=[];
  try {
    for(const name of ['package.json','publication.json','.gitignore','.vercelignore','vercel.json','scripts/build.mjs','samples/library.json',...assets.map(name=>'site/'+name)]) {
      await mkdir(path.dirname(path.join(project,name)),{recursive:true});await copyFile(path.join(root,name),path.join(project,name));
    }
    const books=[await fromText('The original window kept its blue shadow.\n\n  The cup waited on the table.\n\nThe last line stays here.',{title:'Window: an original fixture'}),await fromText('A folded cloth.\nA quiet bowl.\n\nA second original work.',{title:'Table: an original fixture',kind:'verse'})];
    books[0].sections[0].blocks[0].marks=[{kind:'em',start:4,end:12}];
    books[0].context=[{label:'About this original fixture',text:'Its source note remains with the exact edition.',kind:'source',through:null}];
    const inputs=books.map((book,index)=>`.reader/prepared/book-${index+1}.reader.json`);
    await mkdir(path.join(project,'.reader/prepared'),{recursive:true});
    for(let index=0;index<books.length;index++)await writeFile(path.join(project,inputs[index]),JSON.stringify(books[index]));
    preview=await startLocalPreview({projectRoot:project,inputs,port:0});
    const origin=preview.origin,port=Number(new URL(origin).port),firstVersion=preview.receipt.version;
    const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'];
    browser=await playwright[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
    const originalContext=await browser.newContext({serviceWorkers:'block'}),originalPage=await originalContext.newPage();originalPage.on('pageerror',error=>errors.push(error.message));
    await originalContext.route('**/library.json',async route=>route.fulfill({status:200,contentType:'application/json',body:await readFile(path.join(project,'samples/library.json'),'utf8')}));
    await originalPage.goto(origin+'/#companion');await appReady(originalPage);
    assert.equal(await originalPage.locator('[data-experiment=walk]').getAttribute('aria-pressed'),'true','Direct sample Companion keeps its listening-walk default');
    await originalPage.goto(origin+'/#shelf');assert.ok((await originalPage.locator('.shelf-bottom').innerText()).includes('The two opening works are original sample writing.'));await originalContext.close();
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,acceptDownloads:true});
    page=await context.newPage();page.setDefaultTimeout(15000);
    page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(origin)&&!request.url().startsWith('data:')&&!request.url().startsWith('blob:'))external.push(request.url());});
    await page.exposeFunction('previewSecurityViolation',value=>security.push(value));
    await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',event=>window.previewSecurityViolation({directive:event.effectiveDirective,uri:event.blockedURI})));
    phase='prepared reading';await page.goto(origin);await page.getByRole('button',{name:books[0].title,exact:true}).waitFor();await appReady(page);
    for(const book of books)assert.equal(await page.getByRole('button',{name:book.title,exact:true}).count(),1);
    const preparedShelf=await page.locator('.shelf-bottom').innerText();
    await page.goto(origin+'/#companion');await page.locator('.companion-heading').waitFor();
    const preparedCompanion=await page.locator('.companion-heading').innerText();
    assert.ok(!preparedShelf.includes('original sample writing'));assert.ok(!preparedShelf.includes('three ways'));assert.ok(!preparedCompanion.includes('fictional listening walk'));assert.equal(await page.locator('[data-experiment=walk]').count(),0);
    await writeFile(path.join(output,`${engine}-prepared-copy.json`),JSON.stringify({preparedShelf,preparedCompanion},null,2)+'\n');
    await page.goto(origin+'/#shelf');await page.getByRole('button',{name:books[0].title,exact:true}).waitFor();
    await page.getByRole('button',{name:books[0].title,exact:true}).click();await page.locator('#reading-text[data-position-ready="true"]').waitFor();
    const exact=books[0].sections[0].blocks.map(block=>block.text+block.after).join('');assert.equal(await page.locator('#reading-text').textContent(),exact);
    assert.equal(await page.locator('#reading-text em').textContent(),'original');
    const quote=await selectedNote(page,'An original note before a local rebuild.');
    const before=await state(page);assert.equal(before.notes[0].quote,quote);
    const firstCache=await controlledCache(page,firstVersion);await writeFile(path.join(output,`${engine}-first-cache.json`),JSON.stringify(firstCache,null,2)+'\n');assert.deepEqual(firstCache.library,books);
    await page.screenshot({path:path.join(output,`${engine}-reading.png`),fullPage:true,animations:'disabled'});
    const initial=await exportBundle(page,`${engine}-before.reader-bundle.json`);assert.deepEqual(initial.bundle.books,books);assert.deepEqual(initial.bundle.state.notes,before.notes);
    phase='same-origin rebuild';await preview.stop();
    books[1].context[0].text='An explicitly updated original context in the second work.';await writeFile(path.join(project,inputs[1]),JSON.stringify(books[1]));
    preview=await startLocalPreview({projectRoot:project,inputs,port});assert.equal(preview.origin,origin);assert.notEqual(preview.receipt.version,firstVersion);
    await page.reload();await appReady(page);
    await page.evaluate(async()=>{const registration=await navigator.serviceWorker.ready;await registration.update();});
    const updatedCache=await controlledCache(page,preview.receipt.version);await writeFile(path.join(output,`${engine}-updated-cache.json`),JSON.stringify(updatedCache,null,2)+'\n');assert.deepEqual(updatedCache.library,books);
    await page.reload();await page.locator('#reading-text[data-position-ready="true"]').waitFor();await appReady(page);
    const reloadedCache=await controlledCache(page,preview.receipt.version);assert.equal(reloadedCache.status.version,preview.receipt.version);assert.deepEqual(reloadedCache.library,books);
    assert.deepEqual((await state(page)).notes,before.notes);assert.deepEqual((await state(page)).positions,before.positions);
    phase='stopped-origin reading';await preview.stop();
    await assert.rejects(()=>page.request.get(origin+'/network-negative-control',{timeout:2000}));
    await page.reload();await page.locator('#reading-text[data-position-ready="true"]').waitFor();await appReady(page);
    assert.equal(await page.evaluate(async()=>{try{await fetch('/network-negative-control',{cache:'no-store'});return false;}catch{return true;}}),true);
    assert.equal(await page.locator('#reading-text').textContent(),exact);assert.deepEqual((await state(page)).notes,before.notes);
    await selectedNote(page,'Another original note saved with the server stopped.');
    await page.reload();await page.locator('#reading-text[data-position-ready="true"]').waitFor();await appReady(page);
    const offlineState=await state(page);assert.equal(offlineState.notes.length,2);assert.deepEqual(offlineState.positions,before.positions);
    const transfer=await exportBundle(page,`${engine}-offline.reader-bundle.json`);assert.deepEqual(transfer.bundle.books,books);assert.deepEqual(transfer.bundle.state.notes,offlineState.notes);
    phase='fresh-origin recovery';preview=await startLocalPreview({projectRoot:project,inputs,port:0});assert.notEqual(preview.origin,origin);
    const recovery=await browser.newContext({serviceWorkers:'block',acceptDownloads:true,viewport:{width:820,height:1180}}),other=await recovery.newPage();other.setDefaultTimeout(15000);other.on('pageerror',error=>errors.push(error.message));
    await recovery.route('**/library.json',route=>route.fulfill({status:503,body:'Original fixture library deliberately unavailable.'}));
    await other.goto(preview.origin);await other.locator('#main h1').waitFor();await appReady(other);
    await other.getByRole('button',{name:'Reading settings'}).click();await other.locator('#bundle-file').setInputFiles(transfer.file);
    await other.getByRole('heading',{name:'Review your reading bundle.',exact:true}).waitFor();
    assert.equal((await state(other)).notes.length,0);
    await other.getByRole('button',{name:'Restore on this device',exact:true}).click();await other.locator('#dialog').waitFor({state:'hidden'});
    await other.reload();await appReady(other);await other.getByRole('button',{name:books[0].title,exact:true}).click();await other.locator('#reading-text[data-position-ready="true"]').waitFor();
    assert.equal(await other.locator('#reading-text').textContent(),exact);assert.deepEqual((await state(other)).notes,transfer.bundle.state.notes);assert.deepEqual((await state(other)).positions,transfer.bundle.state.positions);
    assert.deepEqual(await other.evaluate(async()=>(await(await import('/db.mjs')).loadBooks()).books),books);
    await other.getByRole('button',{name:'About this work',exact:true}).click();assert.ok((await other.locator('#dialog').textContent()).includes(books[0].context[0].text));await other.getByRole('button',{name:'Close ×',exact:true}).click();
    await other.screenshot({path:path.join(output,`${engine}-restored.png`),fullPage:true,animations:'disabled'});
    phase='library returns after recovery';await recovery.unroute('**/library.json');await other.goto(preview.origin+'/#shelf');await other.reload();await appReady(other);
    const counts=await Promise.all(books.map(book=>other.getByRole('button',{name:book.title,exact:true}).count()));
    const report={engine,originalSampleCompanionPreserved:true,firstCache,updatedCache,reloadedCache,preparedExact:true,sameOriginUpdate:true,workerVersionChanged:true,notesAndPlacePreserved:true,stoppedOriginReload:true,networkNegativeControl:true,offlineNoteSaved:true,actualPrivateBundleExport:true,freshOriginRecoveryWithoutLibrary:true,recoveredContextAndEmphasis:true,returnedLibraryShelfCounts:counts,errors,external,security};
    reports.push(report);await writeFile(path.join(output,'receipt.json'),JSON.stringify({complete:false,reports},null,2)+'\n');
    assert.deepEqual(counts,[1,1],'Returning prepared library must not duplicate recovered books');
    phase='conflicting supplied edition returns';
    const supplied=structuredClone(books);supplied[0]={...await fromText('A different original edition of the window.\n\nIts wording must not replace the saved work.',{title:books[0].title}),id:books[0].id};
    await writeFile(path.join(project,inputs[0]),JSON.stringify(supplied[0]));const recoveryPort=Number(new URL(preview.origin).port);await preview.stop();preview=await startLocalPreview({projectRoot:project,inputs,port:recoveryPort});
    await other.reload();await appReady(other);assert.equal(await other.getByRole('button',{name:books[0].title,exact:true}).count(),1);assert.ok((await other.locator('#edition-warning').innerText()).includes('You are reading the saved edition'));
    await other.getByRole('button',{name:books[0].title,exact:true}).click();await other.locator('#reading-text[data-position-ready="true"]').waitFor();assert.equal(await other.locator('#reading-text').textContent(),exact);
    assert.deepEqual((await state(other)).notes,transfer.bundle.state.notes);assert.deepEqual((await state(other)).positions,transfer.bundle.state.positions);
    await other.getByRole('button',{name:'Reading settings'}).click();
    for(const [label,expected,suffix] of [['Export saved edition: ',books[0],'saved'],['Export supplied edition: ',supplied[0],'supplied']]) {
      const pending=other.waitForEvent('download');await other.getByRole('button',{name:label+books[0].title,exact:true}).click();const download=await pending,file=path.join(output,`${engine}-${suffix}.reader.json`);await download.saveAs(file);assert.deepEqual(JSON.parse(await readFile(file,'utf8')),expected);
    }
    await other.getByRole('button',{name:'Close ×',exact:true}).click();
    const conflictingExport=await exportBundle(other,`${engine}-conflict.reader-bundle.json`);assert.deepEqual(conflictingExport.bundle.books,books);assert.deepEqual(conflictingExport.bundle.state.notes,transfer.bundle.state.notes);
    await other.getByRole('button',{name:'Reading settings'}).click();await other.locator('#bundle-file').setInputFiles(conflictingExport.file);await other.getByRole('heading',{name:'Review your reading bundle.',exact:true}).waitFor();assert.equal(await other.getByRole('button',{name:'Restore on this device',exact:true}).isEnabled(),true);await other.getByRole('button',{name:'Restore on this device',exact:true}).click();await other.locator('#dialog').waitFor({state:'hidden'});assert.deepEqual((await state(other)).notes,transfer.bundle.state.notes);
    const incoming=await other.evaluate(async books=>(await import('/bundle.mjs')).createBundle({books,state:await(await import('/db.mjs')).loadState()}),supplied),incomingFile=path.join(output,`${engine}-divergent.reader-bundle.json`);await writeFile(incomingFile,JSON.stringify(incoming));
    await other.getByRole('button',{name:'Reading settings'}).click();await other.locator('#bundle-file').setInputFiles(incomingFile);await other.getByRole('heading',{name:'Review your reading bundle.',exact:true}).waitFor();assert.equal(await other.getByRole('button',{name:'Restore on this device',exact:true}).isDisabled(),true);assert.ok((await other.locator('#dialog').innerText()).includes('Nothing will be restored'));assert.deepEqual(await other.evaluate(async()=>(await(await import('/db.mjs')).loadBooks()).books),books);await other.getByRole('button',{name:'Close ×',exact:true}).click();
    await other.goto(preview.origin+'/#shelf');const remove=other.locator('.book-row').filter({has:other.getByRole('button',{name:books[0].title,exact:true})}).getByRole('button',{name:'Remove from device',exact:true});
    other.once('dialog',dialog=>dialog.dismiss());await remove.click();assert.deepEqual(await other.evaluate(async()=>(await(await import('/db.mjs')).loadBooks()).books),books);
    let removalPrompt='';other.once('dialog',dialog=>{removalPrompt=dialog.message();return dialog.accept();});await remove.click();await other.locator('#edition-warning').waitFor({state:'hidden'});assert.ok(removalPrompt.includes('different supplied edition'));assert.deepEqual((await state(other)).notes,transfer.bundle.state.notes);
    await other.getByRole('button',{name:books[0].title,exact:true}).click();await other.locator('#reading-text[data-position-ready="true"]').waitFor();assert.equal(await other.locator('#reading-text').textContent(),supplied[0].sections[0].blocks.map(block=>block.text+block.after).join(''));
    await other.goto(preview.origin+'/#passages');assert.equal(await other.getByRole('button',{name:'Read in context',exact:true}).count(),0);assert.equal(await other.locator('.passage blockquote').count(),2);
    Object.assign(report,{conflictStoredEditionPreserved:true,exactBothEditionExports:true,conflictBundleRetainsNotes:true,matchingBundleRestore:true,divergentBundleRefused:true,explicitRemovalRetainsQuotations:true});
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(security,[]);
    await writeFile(path.join(output,`${engine}-receipt.json`),JSON.stringify(report,null,2)+'\n');await recovery.close();await context.close();console.log(`${engine}: prepared preview, same-origin update, offline notes and fresh-origin recovery passed.`);
  }catch(error){
    console.error(JSON.stringify({engine,phase,error:error.message}));
    const cacheState=await page?.evaluate(async()=>({controller:navigator.serviceWorker.controller?.scriptURL,caches:await Promise.all((await caches.keys()).map(async name=>({name,library:await(await(await caches.open(name)).match('/library.json'))?.json()})))})).catch(()=>null);
    const networkLibrary=preview?await fetch(preview.origin+'/library.json').then(response=>response.json()).catch(()=>null):null;
    await page?.screenshot({path:path.join(output,`${engine}-failure.png`),fullPage:true,animations:'disabled'}).catch(()=>{});
    await writeFile(path.join(output,`${engine}-failure.json`),JSON.stringify({engine,phase,error:error.message,errors,external,security,expectedWorkerVersion:preview?.receipt.version,networkLibrary,cacheState},null,2)+'\n');throw error;
  }finally{await browser?.close();await preview?.stop();await rm(project,{recursive:true,force:true});}
}
await writeFile(path.join(output,'receipt.json'),JSON.stringify({complete:true,reports},null,2)+'\n');
