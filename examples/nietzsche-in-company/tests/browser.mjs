import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {serve} from '../scripts/serve.mjs';
import {canonical,validateBundle} from '../site/bundle.mjs';
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),output=path.resolve(process.env.BROWSER_OUTPUT||path.join(root,'test-results/browser'));
const books=JSON.parse(await readFile(path.join(root,'edition/library.json'))),company=JSON.parse(await readFile(path.join(root,'edition/company.json')));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex'),receipts=[];
await mkdir(output,{recursive:true});
async function poll(read,accept,label){let last;const until=Date.now()+20000;while(Date.now()<until){last=await read();if(accept(last))return last;await new Promise(resolve=>setTimeout(resolve,100));}throw Error(label+': '+JSON.stringify(last));}
const state=page=>page.evaluate(async()=> (await import('/db.mjs')).loadState());
async function ready(page){await page.locator('#reading-text[data-position-ready="true"]').waitFor();await settle(page);}
async function close(page){await page.locator('#dialog .close-dialog').click();await page.locator('#dialog').waitFor({state:'hidden'});}
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));});}
async function shot(page,name,fullPage=false){await settle(page);await page.screenshot({path:path.join(output,name+'.png'),animations:'disabled',fullPage});}
async function overflow(page,label){const value=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(value.document<=value.width+1&&value.body<=value.width+1,label+': '+JSON.stringify(value));}
async function go(page,hash){await page.evaluate(hash=>{location.hash=hash;},hash);await page.waitForFunction(hash=>location.hash===hash,hash);if(hash.startsWith('#read/')){const [,book,section]=hash.split('/');await page.locator('#reading-text[data-book="'+book+'"][data-section="'+section+'"]').waitFor();}}
async function openInitial(page,base){await page.goto(base);await page.locator('.company-book').first().waitFor();await page.getByRole('button',{name:'Continue',exact:true}).waitFor();}
async function clickVisible(page,locator){const box=await locator.boundingBox(),viewport=page.viewportSize();assert.ok(box&&box.y>=0&&box.y+box.height<=viewport.height,'Control must already be visible');await page.mouse.click(box.x+box.width/2,box.y+box.height/2);}
async function notice(page,book){await clickVisible(page,page.locator('[data-action="background"]')); await page.locator('.source-notices>summary').click();assert.deepEqual(await page.locator('.notice-copy').allTextContents(),book.context.filter(c=>c.label.startsWith('Digital source notices')).map(c=>c.text));if(book.id==='nietzsche'){assert.match(await page.locator('#dialog').textContent(),/Edition rights/);assert.doesNotMatch(await page.locator('#dialog').textContent(),/private and local; publication is not authorized/);}await close(page);}
async function selectPassage(page){
  return page.evaluate(()=>{const block=[...document.querySelectorAll('#reading-text [data-block]')].find(n=>n.classList.contains('prose')&&n.textContent.length>100),walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT),range=document.createRange();let n,start,end,remaining=96;while(n=walker.nextNode()){if(!start)start=n;if(n.textContent.length>=remaining){end=n;break;}remaining-=n.textContent.length;}range.setStart(start,0);range.setEnd(end,remaining);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));document.dispatchEvent(new MouseEvent('pointerup',{bubbles:true}));return selection.toString();});
}
async function saveNote(page,text){const quote=await selectPassage(page);await page.locator('#selection-save').click();await page.locator('#note-text').fill(text);await page.locator('#note-form button[type="submit"]').click();await page.locator('#dialog').waitFor({state:'hidden'});return quote;}
async function worker(page){return page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration(),w=navigator.serviceWorker.controller||r?.active;if(!w)return null;return new Promise(resolve=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},1500);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve({...e.data,controlled:!!navigator.serviceWorker.controller});};w.postMessage('CHECK_OFFLINE',[channel.port2]);});});}
async function exportBundle(page,file){await page.getByRole('button',{name:'Reading settings'}).click();await page.locator('[data-action="bundle-export"]').click();const pending=page.waitForEvent('download');await page.locator('#bundle-export-form button[type="submit"]').click();await (await pending).saveAs(file);await page.locator('#dialog').waitFor({state:'hidden'});return JSON.parse(await readFile(file));}
async function verifyReorderedComparison(browser,base,bundle,engine){
  const original=structuredClone(bundle.state.connections[0]),file=path.join(output,engine+'-canonical.reader-bundle.json');
  assert.deepEqual(original.passages,company.encounters[0].alternate.passages);
  const reordered=canonical(bundle);
  assert.equal(canonical(await validateBundle(JSON.parse(reordered))),canonical(bundle),'Key reordering keeps the original bundle integrity and values');
  await writeFile(file,reordered);
  const fresh=await browser.newContext({serviceWorkers:'block',acceptDownloads:true}),page=await fresh.newPage();
  try{
    await openInitial(page,base);await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.getByRole('button',{name:'Reading settings'}).click();await page.locator('#bundle-file').setInputFiles(file);
    await page.locator('[data-action="bundle-apply"]').waitFor();assert.equal(await page.locator('[data-action="bundle-apply"]').isEnabled(),true);
    await page.locator('[data-action="bundle-apply"]').click();await page.locator('#dialog').waitFor({state:'hidden'});
    assert.deepEqual((await state(page)).connections,bundle.state.connections);
    await go(page,'#companion');await page.locator('.comparison-spread').waitFor();await page.locator('[data-action="compare-revision"]').click();
    assert.equal(await page.locator('#reflection').inputValue(),original.note,'The restored exact pair recalls its saved note regardless of JSON key order');
    await page.locator('.connection-drawer>summary').click();await page.locator('#reflection').fill('Original restored comparison revision.');
    await page.locator('[data-action="save-reflection"]').click();
    const edited=await poll(()=>state(page),s=>s.connections.some(c=>c.note==='Original restored comparison revision.'),'restored comparison edit');
    assert.equal(edited.connections.length,bundle.state.connections.length,'Editing the same pair does not create a duplicate');
    const current=edited.connections.find(c=>c.id===original.id);assert.ok(current,'The original comparison record id is retained');
    assert.equal(current.note,'Original restored comparison revision.');assert.equal(canonical(current.passages),canonical(original.passages));
    assert.deepEqual(edited.notes,bundle.state.notes);assert.deepEqual(edited.positions,bundle.state.positions);
    await page.reload();await page.locator('.comparison-spread').waitFor();await page.locator('[data-action="compare-revision"]').click();
    assert.equal(await page.locator('#reflection').inputValue(),current.note);assert.deepEqual((await state(page)).connections,edited.connections);
  }finally{await fresh.close();}
}
async function verifyDialogReflow(browser,base,engine){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}}),page=await context.newPage(),checks=[];
  const letter=pos=>page.evaluate(pos=>{
    const node=document.querySelector(`#reading-text [data-block="${pos.blockId}"]`),walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let text,total=0;
    while(text=walker.nextNode())if(pos.offset<total+text.length){const range=document.createRange();range.setStart(text,pos.offset-total);range.setEnd(text,pos.offset-total+1);const rect=range.getBoundingClientRect();return {text:range.toString(),top:rect.top,bottom:rect.bottom,edge:document.body.classList.contains('focus')?12:document.querySelector('.reader-tools').getBoundingClientRect().bottom+20,height:innerHeight,y:scrollY};}else total+=text.length;
    throw Error('Source letter unavailable');
  },pos);
  const exposed=async(pos,label)=>{const actual=await letter(pos),source=books.find(b=>b.id==='epicurus').sections[0].blocks.find(b=>b.id===pos.blockId);assert.equal(actual.text,source.text[pos.offset]);assert.ok(actual.top>=actual.edge-1&&actual.bottom<=actual.height,label+': '+JSON.stringify(actual));return actual;};
  const opener=async action=>{await page.locator(`[data-action="${action}"]`).dispatchEvent('click');await page.locator('#dialog').waitFor({state:'visible'});};
  const place=async()=>{
    await page.setViewportSize({width:390,height:844});await go(page,'#read/epicurus/letter');await ready(page);
    await page.evaluate(async()=>{await new Promise(resolve=>setTimeout(resolve,150));const node=document.querySelector('[data-block="e-letter-8"]'),walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let text,total=0;while(text=walker.nextNode()){if(650<total+text.length){const range=document.createRange();range.setStart(text,650-total);range.setEnd(text,651-total);for(let pass=0;pass<2;pass++)scrollTo(0,scrollY+range.getBoundingClientRect().top-document.querySelector('.reader-tools').getBoundingClientRect().bottom-26);break;}total+=text.length;}});
    await page.waitForTimeout(350);
    const saved=await poll(()=>state(page),s=>s.positions.epicurus?.blockId==='e-letter-8'&&Number.isInteger(s.positions.epicurus.offset)&&Math.abs(s.positions.epicurus.offset-650)<120,'source-letter place saved');
    await exposed(saved.positions.epicurus,'source letter starts visible');return structuredClone(saved.positions.epicurus);
  };
  try{
    await openInitial(page,base);await page.getByRole('button',{name:'Continue',exact:true}).click();await go(page,'#read/epicurus/letter');await ready(page);
    await opener('settings');await page.locator('#size').fill('36');await page.locator('#settings-form button[type="submit"]').click();await page.locator('#dialog').waitFor({state:'hidden'});await ready(page);
    let pos=await place();const pixels=await page.evaluate(()=>scrollY);await opener('background');await close(page);assert.equal(await page.evaluate(()=>scrollY),pixels,'Same-layout dialog return keeps exact pixels');checks.push('same-layout exact pixels');
    pos=await place();await opener('background');await page.setViewportSize({width:844,height:390});await close(page);const restoredLetter=await exposed(pos,'Rotated source dialog restores the actual source letter');
    await page.evaluate(()=>scrollBy(0,1));const continued=await poll(()=>state(page),s=>s.positions.epicurus?.blockId===pos.blockId&&s.positions.epicurus.ratio!==pos.ratio&&Math.abs(s.positions.epicurus.offset-pos.offset)<120,'continued source-letter position');await exposed(pos,'Source letter remains visible while continued place saves');checks.push('rotated source letter and continued save');
    await shot(page,engine+'-dialog-rotation-letter');
    pos=await place();await opener('settings');await page.locator('#settings-form').waitFor();await page.setViewportSize({width:844,height:390});await page.locator('[data-preset="large"]').click();await poll(()=>page.locator('#size').inputValue(),v=>v==='29','preset applied');await ready(page);await close(page);await exposed(pos,'Preset retains the entry source letter');checks.push('rotated preset');
    pos=await place();await opener('settings');await page.setViewportSize({width:844,height:390});await page.locator('#size').fill('34');await page.locator('#measure').selectOption('wide');await page.locator('#settings-form button[type="submit"]').click();await page.locator('#dialog').waitFor({state:'hidden'});await ready(page);await exposed(pos,'Custom settings retain the entry source letter');checks.push('rotated custom settings');
    pos=await place();await opener('contents');await page.setViewportSize({width:844,height:390});await go(page,'#read/nietzsche/book-2');await page.locator('#dialog').waitFor({state:'hidden'});await ready(page);assert.equal(await page.locator('#reading-text').getAttribute('data-book'),'nietzsche');assert.equal(await page.locator('#reading-text').getAttribute('data-section'),'book-2');assert.deepEqual((await state(page)).positions.epicurus,pos);assert.ok(await page.evaluate(()=>scrollY<5));checks.push('changed-book navigation wins');
    await go(page,'#read/nietzsche/book-1');await ready(page);await opener('contents');await page.setViewportSize({width:390,height:844});await page.locator('.contents-list a[href="#read/nietzsche/book-3"]').click();await page.locator('#dialog').waitFor({state:'hidden'});await page.locator('#reading-text[data-section="book-3"]').waitFor();await ready(page);assert.equal(await page.locator('#reading-text').getAttribute('data-section'),'book-3');assert.ok(await page.evaluate(()=>scrollY<5));checks.push('explicit Contents destination wins');
    pos=await place();await page.evaluate(()=>{const node=document.querySelector('[data-block="e-letter-8"]'),walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),range=document.createRange();let text,total=0;while(text=walker.nextNode()){if(total+text.length>650){range.setStart(text,650-total);range.setEnd(text,Math.min(text.length,674-total));break;}total+=text.length;}getSelection().removeAllRanges();getSelection().addRange(range);document.dispatchEvent(new Event('selectionchange'));});await page.locator('#selection-save').click();await page.locator('#note-text').fill('Original rotation note fixture.');await page.setViewportSize({width:844,height:390});page.once('dialog',dialog=>dialog.dismiss());await page.locator('#dialog .close-dialog').click();assert.equal(await page.locator('#dialog').evaluate(d=>d.open),true);assert.equal(await page.locator('#note-text').inputValue(),'Original rotation note fixture.');checks.push('cancel keeps rotated draft');await page.locator('#note-form button[type="submit"]').click();await page.locator('#dialog').waitFor({state:'hidden'});await ready(page);await exposed(pos,'Note rerender retains the entry source letter');assert.ok((await state(page)).notes.some(n=>n.note==='Original rotation note fixture.'));checks.push('rotated note save and rerender');
    await page.setViewportSize({width:390,height:844});await go(page,'#shelf');await page.locator('.company-book').first().waitFor();await page.evaluate(()=>scrollTo(0,200));const shelfPixels=await page.evaluate(()=>scrollY);await opener('collection-about');await close(page);assert.equal(await page.evaluate(()=>scrollY),shelfPixels);checks.push('nonreading exact pixels');
    await writeFile(path.join(output,engine+'-dialog-reflow.json'),JSON.stringify({engine,checks,sameLayoutPixels:pixels,restoredLetter,continued:continued.positions.epicurus},null,2)+'\n');
  }finally{await context.close();}
}
async function stop(server){if(!server.listening)return;await new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeAllConnections();});}
for(const engine of (process.env.BROWSER_ENGINES||'chromium,webkit').split(',')){
  assert.ok(['chromium','webkit'].includes(engine));
  const running=await serve({port:0}),{server,base,built}=running;
  const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
  const browser=await pw[engine].launch(executablePath?{executablePath}:{}),context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true}),page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(base+'/'))external.push(r.url());});
  await page.addInitScript(()=>{globalThis.__csp=[];document.addEventListener('securitypolicyviolation',e=>globalThis.__csp.push(e.violatedDirective));});
  try{
    await openInitial(page,base);
    const exactNotice=books[0].context.find(c=>c.label==='Digital source notices · Complete Gutenberg header').text.split('\n\n')[1];
    assert.equal(await page.locator('.source-license-notice').textContent(),exactNotice);
    await page.locator('[data-action="source-notices"]').click();assert.deepEqual(await page.locator('.notice-copy').allTextContents(),books.flatMap(b=>b.context.filter(c=>c.label.startsWith('Digital source notices')).map(c=>c.text)));await close(page);
    assert.equal(await page.locator('.company-book').count(),2);assert.doesNotMatch(await page.locator('#main').textContent(),/Rihani|Luzumiyat|Earlier comparisons/);
    await page.reload();await page.locator('.company-book').first().waitFor();assert.equal(await page.locator('#dialog').evaluate(d=>d.open),false);
    const served={};for(const name of built.files){const response=await context.request.get(base+'/'+name);assert.equal(response.status(),200,name);const actual=await response.body();assert.deepEqual(actual,await readFile(path.join(root,'dist',name)),name);served[name]=sha(actual);assert.match(response.headers()['content-security-policy'],/img-src 'self' data:/);if(name.endsWith('.png'))assert.equal(response.headers()['content-type'],'image/png');}
    for(const name of ['.reader/INTAKE.md','edition/library.json','package.json','site/app.mjs','not-in-build.json'])assert.equal((await context.request.get(base+'/'+name)).status(),404,name);
    await shot(page,engine+'-shelf-desktop',true);
    await page.getByRole('button',{name:'Begin the book',exact:false}).click();await ready(page);assert.equal(await page.locator('#reading-text').getAttribute('data-section'),'book-1');
    const quote=await saveNote(page,'Original publication-check note.');const saved=(await state(page)).notes[0];assert.equal(saved.quote,quote);
    await page.getByRole('button',{name:'Contents',exact:true}).click();await page.locator('#aphorism-number').fill('45');await page.locator('#aphorism-form button[type="submit"]').click();await ready(page);
    await clickVisible(page,page.getByRole('link',{name:'Epicurus',exact:true}));await page.locator('.comparison-spread').waitFor();const before=structuredClone((await state(page)).positions);
    assert.equal(await page.locator('.comparison-voice blockquote').first().textContent(),company.encounters[0].passages[0].quote);
    await page.locator('[data-action="compare-revision"]').click();assert.equal(await page.locator('.comparison-voice blockquote').first().textContent(),company.encounters[0].alternate.passages[0].quote);
    await page.locator('.comparison-voice [data-action="context"]').first().click();await page.locator('#context-text[data-location-ready="true"]').waitFor();assert.equal(await page.locator('#context-text').textContent(),books[0].sections.find(s=>s.id==='book-5').blocks.map(b=>b.text+b.after).join(''));await close(page);assert.deepEqual((await state(page)).positions,before);
    await page.locator('.connection-drawer>summary').click();await page.locator('#reflection').fill('Original comparison-check note.');await page.locator('[data-action="save-reflection"]').click();await poll(()=>state(page),s=>s.connections.length===1,'comparison save');assert.deepEqual((await state(page)).connections[0].passages,company.encounters[0].alternate.passages);
    await page.locator('.comparison-return [data-action="resume"]').click();await ready(page);assert.deepEqual((await state(page)).positions,before);
    const geometryBefore=await page.evaluate(()=>({y:scrollY,edge:document.querySelector('.reader-tools').getBoundingClientRect().bottom,source:document.querySelector('[data-action=background]').getBoundingClientRect().toJSON()}));
    await notice(page,books[0]);await writeFile(path.join(output,engine+'-source-position.json'),JSON.stringify({before,after:(await state(page)).positions,geometryBefore,geometryAfter:await page.evaluate(()=>({y:scrollY,edge:document.querySelector('.reader-tools').getBoundingClientRect().bottom}))},null,2));assert.deepEqual((await state(page)).positions,before);
    // Render every source section, including all poetry and the complete letter.
    for(const book of books)for(const section of book.sections){await go(page,`#read/${book.id}/${section.id}`);await ready(page);assert.equal(await page.locator('#reading-text').textContent(),section.blocks.map(b=>b.text+b.after).join(''),book.id+'/'+section.id);}
    await notice(page,books[1]);
    for(const [label,width,height] of [['phone',390,844],['narrow',320,740],['landscape',844,390],['tablet',820,1180]]){
      await page.setViewportSize({width,height});await go(page,'#shelf');await page.locator('.company-book').first().waitFor();await overflow(page,label+' shelf');if(label==='phone')await shot(page,engine+'-shelf-phone',true);
      await go(page,'#companion');await page.locator('.comparison-spread').waitFor();await overflow(page,label+' companion');if(label==='phone')await shot(page,engine+'-companion-phone',true);
      await go(page,'#read/epicurus/letter');await ready(page);await page.getByRole('button',{name:'Reading settings'}).click();await page.getByRole('button',{name:'Large print',exact:true}).click();await close(page);await overflow(page,label+' large reading');
      await page.getByRole('button',{name:'Focus',exact:true}).click();await page.locator('body.focus').waitFor();await page.keyboard.press('Escape');await page.locator('body:not(.focus)').waitFor();await ready(page);
    }
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Reading settings'}).click();await page.getByRole('button',{name:'Paper',exact:true}).click();await close(page);await shot(page,engine+'-reading-phone');
    // A local import remains exact, inert and independent of the supplied books.
    await page.locator('[data-action="import"]').click();const imported='Original local fixture — ὁδός.\r\n    A second line.\r\n\r\n<script>not executable</script>\n';
    await page.locator('#book-file').setInputFiles({name:'original-fixture.txt',mimeType:'text/plain',buffer:Buffer.from(imported)});await page.locator('#book-title').fill('Original import fixture');await page.locator('#import-form button[type="submit"]').click();await page.locator('#dialog').waitFor({state:'hidden'});
    const local=await page.evaluate(async()=> (await (await import('/db.mjs')).loadBooks()).books.find(b=>b.title==='Original import fixture'));assert.ok(local);
    await go(page,`#read/${local.id}/text`);await ready(page);assert.equal(await page.locator('#reading-text').textContent(),imported);
    const bundlePath=path.join(output,engine+'-fixture.reader-bundle.json'),bundle=await exportBundle(page,bundlePath);
    for(const book of books)assert.equal(canonical(bundle.books.find(b=>b.id===book.id)),canonical(book));assert.deepEqual(bundle.state.notes[0],saved);assert.equal(bundle.state.connections[0].note,'Original comparison-check note.');
    const fresh=await browser.newContext({serviceWorkers:'block',acceptDownloads:true}),restored=await fresh.newPage();await openInitial(restored,base);await restored.getByRole('button',{name:'Continue',exact:true}).click();await restored.getByRole('button',{name:'Reading settings'}).click();await restored.locator('#bundle-file').setInputFiles(bundlePath);await restored.locator('[data-action="bundle-apply"]').click();await restored.locator('#dialog').waitFor({state:'hidden'});assert.deepEqual((await state(restored)).notes,bundle.state.notes);assert.deepEqual((await state(restored)).connections,bundle.state.connections);assert.deepEqual((await state(restored)).positions,bundle.state.positions);
    await verifyReorderedComparison(browser,base,bundle,engine);
    await verifyDialogReflow(browser,base,engine);
    // When source downloads fail, the restored personal book still opens.
    await restored.route('**/library.json',route=>route.abort());await restored.route('**/company.json',route=>route.abort());await restored.reload();await restored.locator('.book-row').filter({hasText:'Original import fixture'}).waitFor();await go(restored,`#read/${local.id}/text`);await ready(restored);assert.equal(await restored.locator('#reading-text').textContent(),imported);assert.deepEqual((await state(restored)).notes,bundle.state.notes);await fresh.close();
    // Notice-memory failure is honest, without blocking reading or rewriting records.
    const noMemory=await browser.newContext(),noticePage=await noMemory.newPage();await noticePage.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Original fixture denied','QuotaExceededError');};});await openInitial(noticePage,base);assert.equal(await noticePage.locator('#source-notice-storage').isVisible(),true);await noticePage.getByRole('button',{name:'Continue',exact:true}).click();await noticePage.getByRole('button',{name:'Begin the book',exact:false}).click();await ready(noticePage);assert.equal(await noticePage.locator('#dialog').evaluate(d=>d.open),false);await noMemory.close();
    // First offline raster: no card has been generated in this browser before the origin stops.
    const checked=await poll(()=>worker(page),s=>s?.ready&&s.version===built.version,'complete matching offline cache');assert.equal(checked.version,built.version);
    await stop(server);await assert.rejects(()=>context.request.get(base+'/uncached-network-control',{timeout:1500}));await page.reload();await ready(page);assert.ok(await page.evaluate(()=>!!navigator.serviceWorker.controller));assert.equal(await page.locator('#reading-text').textContent(),imported);
    assert.deepEqual(await page.evaluate(async()=> (await fetch('/library.json')).json()),books);
    await go(page,'#read/nietzsche/book-1');await ready(page);await page.getByRole('link',{name:'Passages',exact:true}).click();await page.locator('[data-action="edit-note"]').first().click();await page.locator('#note-text').fill('Original offline draft survives card generation.');await page.locator('[data-card-action="make"]').click();await page.locator('.passage-card-preview[data-card-state="ready"]').waitFor();
    const image=await page.locator('img.passage-card-image').evaluate(async image=>{await image.decode();return {width:image.naturalWidth,height:image.naturalHeight,src:image.currentSrc.slice(0,22)};});assert.equal(image.width,1080);assert.ok(image.height>=1080&&image.height<=1920);assert.equal(image.src,'data:image/png;base64,');assert.equal(await page.locator('#note-text').inputValue(),'Original offline draft survives card generation.');
    const download=page.waitForEvent('download');await page.locator('[data-card-action="save"]').click();const cardPath=path.join(output,engine+'-offline-card.png');await (await download).saveAs(cardPath);assert.equal((await readFile(cardPath)).subarray(0,8).toString('hex'),'89504e470d0a1a0a');await page.locator('#note-form button[type="submit"]').click();await page.locator('#dialog').waitFor({state:'hidden'});await page.reload();await page.locator('.passage').first().waitFor();assert.equal((await state(page)).notes[0].note,'Original offline draft survives card generation.');
    await go(page,'#companion');await page.locator('.comparison-spread').waitFor();await page.locator('.comparison-voice [data-action="context"]').first().click();await page.locator('#context-text[data-location-ready="true"]').waitFor();await close(page);await go(page,'#read/nietzsche/songs');await ready(page);assert.equal(await page.locator('#reading-text').textContent(),books[0].sections.at(-1).blocks.map(b=>b.text+b.after).join(''));await notice(page,books[0]);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(await page.evaluate(()=>globalThis.__csp),[]);
    const receipt={engine,applicationBuild:built.version,sourceHashes:Object.fromEntries(books.map(b=>[b.id,sha(canonical(b))])),served,exactSections:11,viewports:5,firstUseNoticeOnce:true,fullNotices:true,noticeMemoryFailure:true,annotations:true,contextReturn:true,comparisonSaved:true,sourceTextExact:true,importExact:true,bundleRestoreExact:true,canonicalComparisonRestoreEditReload:true,dialogReflowSourceReturn:true,missingLibraryPersonalRecovery:true,stoppedOriginOffline:true,offlineFirstCard:image,offlineNoteSurvivesReload:true,pageErrors:errors,externalRequests:external};receipts.push(receipt);await writeFile(path.join(output,engine+'-receipt.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({engine,passed:true,applicationBuild:built.version,exactSections:11,servedFiles:built.files.length,viewports:5,offline:true}));
  }catch(error){await writeFile(path.join(output,engine+'-failure.json'),JSON.stringify({message:error.message,stack:error.stack,errors,url:page.url(),worker:await worker(page).catch(()=>null)},null,2)+'\n');await shot(page,engine+'-failure').catch(()=>{});throw error;}
  finally{await browser.close();await stop(server);}
}
await writeFile(path.join(output,'receipt.json'),JSON.stringify({at:new Date().toISOString(),passed:true,results:receipts,limits:'Chromium/WebKit developer regression. Physical touch, Home Screen installation and screen-reader acceptance are separate.'},null,2)+'\n');
