import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../',import.meta.url),out=new URL('../.reader/reports/',import.meta.url);
const book=JSON.parse(await readFile(new URL('edition/library.json',root),'utf8'))[0],id=book.id;
const port=Number(process.env.TEST_PORT||4292),base=`http://127.0.0.1:${port}`;
await mkdir(out,{recursive:true});
const receipts=[];
const viewports=[['phone',402,874],['phone-landscape',874,402],['tablet',820,1180],['tablet-landscape',1180,820],['narrow',320,740]];
const navigationTargets='.wordmark,.masthead nav a,.type-button';
const exact=s=>s.blocks.map(b=>b.text+b.after).join('');
const section=id=>book.sections.find(s=>s.id===id);
const frontispiece=book.assets.find(a=>a.id==='f0002-image-jpg'),correctedFrontispiece='Frontispiece: Alice stands facing the viewer with her hands behind her back.';
const state=p=>p.evaluate(async()=>await(await import('/db.mjs')).loadState());
const close=p=>p.getByRole('button',{name:'Close ×',exact:true}).click();
async function persistedPosition(page,bookId,blockId){
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){const position=(await state(page)).positions[bookId];if(position?.blockId===blockId)return position;await new Promise(resolve=>setTimeout(resolve,50));}
  throw new Error('The requested reading block was not persisted: '+blockId);
}
async function clickVisible(page,locator){
  // Locator auto-scrolling can move a sticky navigation link's document before
  // the click. Hit its already-visible viewport box as a reader would.
  const box=await locator.boundingBox(),view=page.viewportSize();
  assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=view.width&&box.y+box.height<=view.height,'Navigation target is fully visible');
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
}
function sameReadingPlace(actual,expected,blockHeight){
  assert.deepEqual({...actual,ratio:0},{...expected,ratio:0});
  assert.ok(Math.abs(actual.ratio-expected.ratio)*blockHeight<1,'Reading offset changes by less than one CSS pixel');
}
async function ready(page,s){await page.locator(`#reading-text[data-section="${s}"][data-position-ready="true"]`).waitFor();assert.equal(await page.locator('#catalogue-return').isVisible(),false);}
async function dismissNotice(page){await page.waitForFunction(()=>document.body.dataset.editionReady==='true');if(await page.evaluate(()=>document.querySelector('#dialog').open&&document.querySelector('#dialog-title')?.textContent==='Source edition notice'))await close(page);}
async function go(page,s){await page.goto(`${base}/#read/${id}/${s}`);await ready(page,s);await dismissNotice(page);}
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled([...document.images].map(i=>i.decode()));await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));});}
async function capture(page,name){await settle(page);await page.waitForFunction(()=>!document.querySelector('#status')?.textContent);await page.screenshot({path:new URL(name+'.png',out).pathname,animations:'disabled'});}
async function overflow(page,label){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label+' document overflow');}
async function targets(page,selector,label){
  const boxes=await page.locator(selector).evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{label:e.textContent.trim(),width:r.width,height:r.height};}));
  assert.ok(boxes.length,label+' targets exist');for(const b of boxes)assert.ok(b.width>=43.5&&b.height>=43.5,label+' touch target '+JSON.stringify(b));return boxes;
}
async function readingHeight(page,label){
  const geometry=await page.evaluate(()=>{const chrome=[...document.querySelectorAll('.masthead,.reader-tools,.reading>.verse-controls')].filter(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return ['fixed','sticky'].includes(s.position)&&r.height&&r.top<innerHeight&&r.bottom>0;});const bottom=Math.max(0,...chrome.map(e=>e.getBoundingClientRect().bottom));return{height:innerHeight,chrome:bottom,usable:innerHeight-bottom};});
  assert.ok(geometry.usable/geometry.height>=.7,label+' usable reading height '+JSON.stringify(geometry));return geometry;
}
async function tailMode(page,mode){await page.getByRole('button',{name:'Tail type',exact:true}).click();await page.locator('.dialog-inner>.verse-controls button').first().waitFor({state:'visible'});await targets(page,'.dialog-inner>.verse-controls button','tail type choices');await page.getByRole('button',{name:mode,exact:true}).click();await page.locator('#reading-text[data-position-ready="true"]').waitFor();await close(page);}
async function scrollTail(page){await page.locator('.tail-poem').evaluate(e=>{const t=document.querySelector('.reader-tools');scrollTo(0,scrollY+e.getBoundingClientRect().top-(parseFloat(getComputedStyle(t).top)+t.offsetHeight+16));});await settle(page);}
async function theme(page,value){await page.getByRole('button',{name:'Reading settings'}).click();await page.locator('#theme').selectOption(value);await page.getByRole('button',{name:'Apply to my reader'}).click();}
async function select(page,blockId,start,end){
  return page.evaluate(({blockId,start,end})=>{const b=[...document.querySelectorAll('#reading-text [data-block]')].find(e=>e.dataset.block===blockId);
    const point=offset=>{const w=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(offset<=n.length)return[n,offset];offset-=n.length;}throw Error('offset missing');};
    const r=document.createRange();r.setStart(...point(start));r.setEnd(...point(end));getSelection().removeAllRanges();getSelection().addRange(r);return r.toString();},{blockId,start,end});
}
async function serverStart(){
  const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});let errors='';
  server.stderr.on('data',d=>errors+=d);
  await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('local only'))resolve();});server.on('exit',()=>reject(Error(errors||'Server stopped before ready')));});
  return server;
}
async function stopServer(server){if(server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}}
for(const engine of (process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'])){
  let server=await serverStart(),context,browser;
  const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'];
  const launch={headless:true,...(executablePath?{executablePath}:{})};
  const profile=new URL(`.reader/private/qa-${engine}-${Date.now()}/`,root).pathname;
  const errors=[],requests=[],ergonomics=[];
  try{
    context=await pw[engine].launchPersistentContext(profile,{...launch,viewport:{width:402,height:874},isMobile:true,hasTouch:true});
    const page=context.pages()[0]||await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))requests.push(r.url());});
    await page.goto(base);await page.locator('.edition-drawing img').waitFor();await dismissNotice(page);assert.equal(await page.getByRole('link',{name:'All readers',exact:true}).getAttribute('href'),'https://newreading.app/');await capture(page,engine+'-home');await overflow(page,'home');
    await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Available offline'));
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
    // The entrance and actual reading must remain composed in both orientations.
    // Source-inline correction links are excluded from this chrome target check.
    for(const [label,width,height] of viewports){
      await page.setViewportSize({width,height});await page.goto(base);await page.locator('.edition-drawing img').waitFor();await capture(page,engine+'-'+label+'-home');await overflow(page,label+' home');
      await targets(page,navigationTargets+',.edition-entry button,.edition-entry a,.edition-bottom a,.edition-details summary,#catalogue-return',label+' home');assert.equal(await page.locator('.edition-intro .eyebrow,.edition-credit>span,.edition-drawing figcaption').evaluateAll(nodes=>nodes.every(e=>parseFloat(getComputedStyle(e).fontSize)>=11)),true,'Readable authored credits');
      await go(page,'chapter-01');await page.evaluate(()=>scrollTo(0,0));await capture(page,engine+'-'+label+'-reading');await overflow(page,label+' reading');
      await targets(page,navigationTargets+',.reader-tools button,.chapter-links a',label+' reading');
      await page.evaluate(()=>scrollTo(0,650));await settle(page);ergonomics.push({view:label,mode:'reading',...await readingHeight(page,label)});
    }
    for(const [label,width,height] of [viewports[0],viewports[2]]){
      await page.setViewportSize({width,height});await page.goto(base+'/#companion');await page.locator('.looking-exercises').waitFor();await capture(page,engine+'-'+label+'-companion');await overflow(page,label+' companion');
      assert.equal(await page.locator('.plate-choice').count(),1,'Only the frontispiece is initially permitted');
      assert.equal(await page.locator('.plate-choice img').getAttribute('alt'),correctedFrontispiece);
      await page.locator('.plate-choice').click();assert.equal(await page.locator('#enlarged-image').getAttribute('alt'),correctedFrontispiece);assert.equal(await page.locator('.image-description').textContent(),correctedFrontispiece);await close(page);
      await targets(page,navigationTargets+',.page-head button,.companion-top button,.experiment-tabs button,.plate-choice',label+' companion');assert.equal(await page.locator('.close-looking .eyebrow,.plate-caption').evaluateAll(nodes=>nodes.every(e=>parseFloat(getComputedStyle(e).fontSize)>=11)),true,'Readable editorial labels');
    }
    await page.setViewportSize({width:402,height:874});
    // Exercise all actual literary and legal sections, all source pictures and
    // every source block's DOM text, not only the kit's original fixtures.
    for(const s of book.sections){
      await go(page,s.id);assert.equal(await page.locator('#reading-text').textContent(),exact(s),s.id+' exact DOM text');
      await settle(page);
      if(s.id==='front'){assert.equal(await page.locator('[data-asset="f0002-image-jpg"] img').getAttribute('alt'),correctedFrontispiece);assert.equal(await page.locator('[data-asset="f0002-image-jpg"]').getAttribute('aria-label'),'Enlarge illustration: '+correctedFrontispiece);}
      const imageCount=s.blocks.reduce((n,b)=>n+Number(!!b.figure)+Number(!!b.initial),0);
      assert.equal(await page.locator('#reading-text img').count(),imageCount);
      assert.equal(await page.locator('#reading-text img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);
    }
    console.log(engine,'all 19 sections and all image uses render exactly');
    // Source corrections retain the edition's words and give a touch-accessible
    // explanation rather than an invisible desktop-only hover tooltip.
    await go(page,'chapter-01');await page.getByRole('button',{name:'About this work'}).click();
    const rights=page.locator('#dialog .context-item').filter({has:page.getByRole('heading',{name:'Rights and source terms',exact:true})});
    assert.match(await rights.textContent(),/This reader is an independent, free adaptation\./);assert.doesNotMatch(await rights.textContent(),/No publication destination has yet been approved/);await capture(page,engine+'-about-editorial-copy');await close(page);
    const correction=page.locator('#reading-text .source-note').first();
    await correction.click();assert.match(await page.locator('#dialog').textContent(),/opening quotation mark was added/);await close(page);
    const prose=section('chapter-01').blocks.find(b=>b.text.startsWith('Down, down, down. There was nothing'));
    const start=prose.text.length-100,end=prose.text.length-20;
    const quote=await select(page,prose.id,start,end);await page.locator('#selection-save').click();
    assert.equal(await page.locator('.dialog-quote').textContent(),quote);
    await page.locator('#note-text').fill('Notice the interruption. <em>Literal note text.</em>');
    const dismiss=d=>d.dismiss();page.on('dialog',dismiss);await close(page);assert.equal(await page.locator('#dialog').evaluate(e=>e.open),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#dialog').evaluate(e=>e.open),true);page.off('dialog',dismiss);
    await page.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...a){if(this.name==='state')throw new DOMException('QA quota failure','QuotaExceededError');return window.originalPut.apply(this,a);};});
    await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog-error').filter({hasText:/./}).waitFor();assert.equal(await page.locator('#note-text').inputValue(),'Notice the interruption. <em>Literal note text.</em>');
    await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut;delete window.originalPut;});
    await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
    await page.reload();await ready(page,'chapter-01');assert.equal((await state(page)).notes.length,1);assert.equal(await page.locator('#reading-text').textContent(),exact(section('chapter-01')));
    const beforeLicence=(await state(page)).positions[id];await page.evaluate(()=>{const button=document.createElement('button');button.dataset.action='licence';document.body.append(button);button.click();button.remove();});await page.locator('#context-text[data-section="source-notice"][data-location-ready="true"]').waitFor();assert.equal(await page.locator('#context-text').textContent(),exact(section('source-notice')));await close(page);assert.deepEqual((await state(page)).positions[id],beforeLicence);
    // Enlarged type and a late-paragraph exact passage return inside the dialog.
    await page.getByRole('button',{name:'Reading settings'}).click();await page.locator('#size').focus();await page.keyboard.press('End');await page.getByRole('button',{name:'Apply to my reader'}).click();
    assert.equal((await state(page)).prefs.size,36);
    await page.getByRole('link',{name:'Passages',exact:true}).click();await page.getByRole('button',{name:/Read in context/}).click();await page.locator('#context-text[data-location-ready="true"]').waitFor();
    const range=await page.evaluate(()=>{const d=document.querySelector('#dialog'),marks=[...d.querySelectorAll('mark')],r=document.createRange();r.setStart(marks[0],0);r.setEnd(marks.at(-1),marks.at(-1).childNodes.length);const rects=[...r.getClientRects()].filter(x=>x.width&&x.height),header=d.querySelector('.dialog-header').getBoundingClientRect();return{first:rects[0].top,last:Math.max(...rects.map(x=>x.bottom)),top:header.bottom,bottom:d.getBoundingClientRect().bottom};});
    assert.ok(range.first>=range.top-1,JSON.stringify(range));assert.ok(range.first<range.bottom-15,JSON.stringify(range));
    if(range.last-range.first<range.bottom-range.top-32)assert.ok(range.last<=range.bottom+1,JSON.stringify(range));
    await capture(page,engine+'-exact-context-large');await close(page);
    await page.getByRole('button',{name:/Return to your book/}).click();await ready(page,'chapter-01');
    // Focus controls can be deliberately recalled; selection does not recall them.
    await page.getByRole('button',{name:'Focus',exact:true}).click();await page.waitForFunction(()=>document.body.classList.contains('focus')&&document.activeElement.id==='main'&&document.querySelector('#reading-text').dataset.positionReady==='true');await settle(page);assert.equal(await page.locator('#focus-tools').isVisible(),false);
    await page.keyboard.press('c');assert.equal(await page.locator('#focus-tools').isVisible(),true);
    await page.evaluate(()=>{document.dispatchEvent(new Event('scroll'));window.dispatchEvent(new Event('scroll'));});assert.equal(await page.locator('#focus-tools').isVisible(),true,'Stationary queued document/window scroll does not erase recall');
    await targets(page,'#focus-tools button','focus recall');await capture(page,engine+'-focus-recalled');
    await page.evaluate(()=>scrollBy(0,100));await page.waitForFunction(()=>document.querySelector('#focus-tools').hidden);await page.keyboard.press('c');
    await page.getByRole('button',{name:'Hide controls',exact:true}).click();await select(page,prose.id,5,25);assert.equal(await page.locator('#focus-tools').isVisible(),false);
    await page.evaluate(()=>getSelection().removeAllRanges());await page.reload();await ready(page,'chapter-01');assert.equal(await page.locator('#focus-tools').isVisible(),false);
    assert.equal(await page.locator('#reading-text .heading').first().textContent(),'CHAPTER I');assert.equal(await page.locator('.chapter-links').count(),1);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('focus'));assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('focus')),false);
    // Companion permission is explicit. Context and images must not advance a
    // source reading place, including returning after zooming an image.
    await page.getByRole('link',{name:'Looking closer',exact:true}).click();await page.locator('.looking-exercises').waitFor();
    const before=(await state(page)).positions[id];assert.equal(await page.locator('[data-action="context"]').count(),0);
    await page.getByRole('button',{name:'Choose what I’ve read'}).click();await page.locator(`#boundary-${id}`).selectOption(String(book.sections.findIndex(s=>s.id==='chapter-03')));await page.getByRole('button',{name:'Set my boundaries'}).click();
    await page.getByRole('button',{name:/Open the tail in context/}).click();await page.locator('#context-text[data-location-ready="true"]').waitFor();
    const tailText=await page.locator('#context-text .tail-poem').textContent();await page.getByRole('button',{name:'Uniform type',exact:true}).click();assert.equal(await page.locator('#context-text .tail-poem').textContent(),tailText);await capture(page,engine+'-tail-uniform-large');await close(page);
    assert.deepEqual((await state(page)).positions[id],before);
    await page.locator('.plate-choice').first().click();await page.locator('#image-zoom').focus();await page.keyboard.press('End');
    assert.equal(await page.locator('#image-zoom-value').textContent(),'300%');await capture(page,engine+'-illustration-zoom');await close(page);assert.deepEqual((await state(page)).positions[id],before);
    await page.locator('.plate-choice[data-section="chapter-01"]').first().click();await page.getByRole('button',{name:/Read around this illustration/}).click();await page.locator('#context-text[data-section="chapter-01"][data-location-ready="true"]').waitFor();assert.equal(await page.locator('#context-text').textContent(),exact(section('chapter-01')));await close(page);assert.deepEqual((await state(page)).positions[id],before);
    await page.evaluate(()=>scrollTo(0,0));await capture(page,engine+'-phone-companion-large');await overflow(page,'large companion');assert.equal(await page.locator('.masthead [aria-current="page"]').getAttribute('data-nav'),'companion');
    await page.getByRole('button',{name:'Find a phrase',exact:true}).click();await page.locator('#echo-term').fill('curious');await page.getByRole('button',{name:'Find occurrences'}).click();assert.ok(await page.locator('.echo-list li').count()>0);
    const excerpt=page.locator('.fragment-surface[data-omitted-start][data-omitted-end]').first();await excerpt.waitFor();
    const excerptReceipt=await excerpt.evaluate(e=>({text:e.textContent,match:[...e.querySelectorAll('mark')].map(m=>m.textContent).join(''),before:getComputedStyle(e,'::before').content,after:getComputedStyle(e,'::after').content,description:e.getAttribute('aria-description')}));
    assert.equal(excerptReceipt.match,'curious');assert.ok(excerptReceipt.before.includes('…')&&excerptReceipt.after.includes('…'));assert.equal(excerptReceipt.description,'Earlier text omitted. Later text omitted.');
    const sourceHit=await page.evaluate(async quote=>{const {findOccurrences,anchorStatus}=await import('/core.mjs'),{loadState}=await import('/db.mjs'),books=await(await fetch('/library.json')).json();const hit=findOccurrences(books,await loadState(),'curious').hits.find(h=>h.passage.quote===quote);return hit&&anchorStatus(hit.passage,books[0]).valid;},excerptReceipt.text);assert.equal(sourceHit,true,'Editorial omissions leave source quotation and anchor exact');
    await excerpt.evaluate(e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-document.querySelector('.masthead').getBoundingClientRect().height-20));await capture(page,engine+'-search-omission-large');
    await excerpt.locator('..').getByRole('button',{name:/Read around this occurrence/}).click();await page.locator('#context-text[data-location-ready="true"]').waitFor();assert.equal(await page.locator('#context-text mark').allTextContents().then(parts=>parts.join('')),'curious');assert.equal(await page.locator('#context-text[data-omitted-start],#context-text[data-omitted-end]').count(),0);await close(page);assert.deepEqual((await state(page)).positions[id],before);
    // Portrait and landscape on both simulated phone/tablet families. Each
    // capture is settled and includes actual source material at 36px type.
    for(const [label,width,height]of viewports){
      await page.setViewportSize({width,height});await go(page,'chapter-01');await page.evaluate(()=>scrollTo(0,0));await capture(page,engine+'-'+label+'-chapter-large');await overflow(page,label+' chapter');
      await go(page,'chapter-03');await tailMode(page,'Source shape');
      await scrollTail(page);
      await capture(page,engine+'-'+label+'-tail-shape-large');await overflow(page,label+' tail');
      await targets(page,'.reader-tools button',label+' tail');ergonomics.push({view:label,mode:'tail-large',...await readingHeight(page,label+' tail')});
      // Geometry may exceed a narrow viewport, but remains locally scrollable
      // and can be read at uniform size without changing text or anchors.
      assert.equal(await page.locator('.tail-poem').textContent(),tailText);
    }
    await tailMode(page,'Uniform type');await scrollTail(page);assert.equal(await page.locator('.tail-poem').textContent(),tailText);await capture(page,engine+'-narrow-tail-uniform-large');await overflow(page,'narrow uniform tail');await tailMode(page,'Source shape');
    await theme(page,'dusk');
    for(const [label,width,height]of viewports){
      await page.setViewportSize({width,height});await go(page,'chapter-03');await scrollTail(page);
      await capture(page,engine+'-'+label+'-night-tail-large');await overflow(page,label+' night tail');ergonomics.push({view:label,mode:'night-tail-large',...await readingHeight(page,label+' night tail')});
    }
    await page.setViewportSize({width:820,height:1180});await go(page,'chapter-01');await page.locator('#reading-text .source-illustration').first().click();await capture(page,engine+'-night-illustration-study');assert.equal(await page.locator('#enlarged-image').evaluate(e=>getComputedStyle(e).filter),'none');await close(page);
    await page.goto(base);await page.locator('.edition-drawing img').waitFor();await capture(page,engine+'-tablet-home-night');await theme(page,'paper');
    await page.setViewportSize({width:820,height:1180});await go(page,'proem');await capture(page,engine+'-proem-large');await overflow(page,'proem');
    // Real multi-block selection spanning a source paragraph break.
    await go(page,'chapter-02');const blockIds=section('chapter-02').blocks.filter(b=>b.kind==='prose'&&b.text.length>100).slice(1,3).map(b=>b.id);
    const multi=await page.evaluate(ids=>{const nodes=ids.map(id=>document.querySelector(`[data-block="${id}"]`)),range=document.createRange();const point=(e,end)=>{const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){if(end<=n.length)return[n,end];end-=n.length;}};range.setStart(...point(nodes[0],20));range.setEnd(...point(nodes[1],40));getSelection().removeAllRanges();getSelection().addRange(range);return range.toString();},blockIds);
    await page.locator('#selection-save').click();assert.equal(await page.locator('.dialog-quote').textContent(),multi);await page.locator('#note-text').fill('A second note across paragraphs.');await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);assert.equal((await state(page)).notes.length,2);
    // Add an exact illustrated local edition with a non-builtin ID, so fresh
    // restore must actually install its image payloads instead of relying only
    // on the already bundled public edition.
    const portable={...book,id:'qa-portable-alice',title:'Portable Alice copy (QA)'};
    await page.getByRole('button',{name:'Add a book',exact:false}).click();await page.locator('#book-file').setInputFiles({name:'qa-portable-alice.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(portable))});await page.getByRole('button',{name:'Add on this device',exact:false}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
    // Export through the UI and restore twice in a fresh browser context.
    await page.getByRole('button',{name:'Reading settings'}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:/Export passages & progress/}).click();const recordsDownload=await downloadPromise,recordsPath=new URL(engine+'-records.json',out).pathname;await recordsDownload.saveAs(recordsPath);
    await page.getByRole('button',{name:'Export a private reading bundle',exact:true}).click();const bundleDownloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download private bundle'}).click();const bundleDownload=await bundleDownloadPromise,bundlePath=new URL(engine+'-bundle.json',out).pathname;await bundleDownload.saveAs(bundlePath);
    const exported=JSON.parse(await readFile(bundlePath,'utf8'));assert.equal(exported.books.length,2);assert.equal(exported.books[0].assets.length,38);assert.equal(exported.state.notes.length,2);assert.deepEqual(exported.books.find(b=>b.id===id),book,'Presentation corrections must not change the exported exact edition');if(await page.locator('#dialog').evaluate(e=>e.open))await close(page);
    browser=await pw[engine].launch(launch);const fresh=await browser.newContext({viewport:{width:402,height:874}}),other=await fresh.newPage();await other.goto(base);await other.locator('.edition-drawing img').waitFor();await dismissNotice(other);
    for(let i=0;i<2;i++){await other.getByRole('button',{name:'Reading settings'}).click();await other.locator('#bundle-file').setInputFiles(bundlePath);await other.getByRole('button',{name:'Restore on this device',exact:true}).click();await other.waitForFunction(()=>!document.querySelector('#dialog').open);}
    assert.equal((await state(other)).notes.length,2);assert.deepEqual(await other.evaluate(async()=>{const {books}=await(await import('/db.mjs')).loadBooks();return books.find(b=>b.id==='qa-portable-alice');}),portable);assert.equal((await state(other)).boundaries[id],undefined);assert.deepEqual((await state(other)).positions[id],exported.state.positions[id]);
    await other.reload();await other.locator('.edition-drawing img').waitFor();await dismissNotice(other);assert.equal((await state(other)).notes.length,2);
    await other.getByRole('button',{name:'Continue reading',exact:false}).first().click();await ready(other,'chapter-02');assert.equal(await other.locator('#reading-text').textContent(),exact(section('chapter-02')));
    await fresh.close();await browser.close();browser=null;
    // A damaged optional library download cannot disable an independently
    // stored local book. This is a separate context with no service worker.
    browser=await pw[engine].launch(launch);const failContext=await browser.newContext({serviceWorkers:'block'});await failContext.route('**/library.json',r=>r.abort());const failurePage=await failContext.newPage();await failurePage.goto(base);await failurePage.locator('#storage-warning').filter({hasText:/unavailable/}).waitFor();
    await failurePage.evaluate(async()=>{const {fromText}=await import('/core.mjs'),{saveBook}=await import('/db.mjs');await saveBook(await fromText('Original QA text.\n\nA second paragraph.',{title:'Local fallback',author:'Test'}));});await failurePage.reload();await failurePage.getByRole('button',{name:/Open this book/}).click();await failurePage.locator('#reading-text').waitFor();assert.match(await failurePage.locator('#reading-text').textContent(),/Original QA text/);await failContext.close();
    // The release-specific About copy belongs only to the exact built-in bytes.
    // Matching ID/source fields alone must not rewrite a modified or imported book.
    const changedContext=await browser.newContext({serviceWorkers:'block'}),changedBook={...book,title:book.title+' (modified QA edition)'};
    await changedContext.route(base+'/library.json',r=>r.fulfill({json:[changedBook]}));const changedPage=await changedContext.newPage();await changedPage.goto(`${base}/#read/${id}/chapter-01`);await ready(changedPage,'chapter-01');await dismissNotice(changedPage);await changedPage.getByRole('button',{name:'About this work'}).click();assert.ok((await changedPage.locator('#dialog').textContent()).includes(book.context[3].text));await close(changedPage);await changedPage.goto(`${base}/#read/${id}/front`);await ready(changedPage,'front');assert.equal(await changedPage.locator('[data-asset="f0002-image-jpg"] img').getAttribute('alt'),frontispiece.alt);await changedPage.goto(`${base}/#companion`);await changedPage.locator('.plate-choice img').waitFor();assert.equal(await changedPage.locator('.plate-choice img').getAttribute('alt'),frontispiece.alt);await changedContext.close();
    const importedContext=await browser.newContext({serviceWorkers:'block'}),importedPage=await importedContext.newPage(),importedBook={...book,id:'qa-context-copy',title:'Imported context copy (QA)'};await importedPage.goto(base);await dismissNotice(importedPage);await importedPage.evaluate(async b=>{await(await import('/db.mjs')).saveBook(b);},importedBook);await importedPage.goto(`${base}/#read/${importedBook.id}/chapter-01`);await importedPage.reload();await ready(importedPage,'chapter-01');await importedPage.getByRole('button',{name:'About this work'}).click();assert.ok((await importedPage.locator('#dialog').textContent()).includes(book.context[3].text));await close(importedPage);await importedPage.goto(`${base}/#read/${importedBook.id}/front`);await ready(importedPage,'front');assert.equal(await importedPage.locator('[data-asset="f0002-image-jpg"] img').getAttribute('alt'),frontispiece.alt);await importedContext.close();
    await browser.close();browser=null;
    // Stop the origin and the browser. Reopen its persistent profile from disk,
    // then navigate with no server. Both raw and browser uncached requests must fail.
    await go(page,'chapter-02');await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Available offline'));await context.close();context=null;await stopServer(server);server=null;
    let negativeControl=false;try{await fetch(base+'/uncached-network-control',{signal:AbortSignal.timeout(3000)});}catch{negativeControl=true;}assert.equal(negativeControl,true,'Stopped-origin raw network request must fail');
    context=await pw[engine].launchPersistentContext(profile,{...launch,viewport:{width:402,height:874}});const cold=context.pages()[0]||await context.newPage();await cold.goto(`${base}/#read/${id}/chapter-02`);await ready(cold,'chapter-02');await dismissNotice(cold);
    assert.equal(await cold.locator('#reading-text').textContent(),exact(section('chapter-02')));assert.equal((await state(cold)).notes.length,2);
    await cold.getByRole('button',{name:'About this work'}).click();assert.match(await cold.locator('#dialog').textContent(),/This reader is an independent, free adaptation\./);assert.doesNotMatch(await cold.locator('#dialog').textContent(),/No publication destination has yet been approved/);await close(cold);
    assert.equal(await cold.evaluate(async()=>{try{await fetch('/uncached-browser-control-'+Date.now());return false;}catch{return true;}}),true,'Cold browser uncached network request must fail too');
    const decoded=await cold.evaluate(async()=>{const records=await(await fetch('/library.json')).json();for(const a of records[0].assets){const i=new Image();i.src=`data:${a.mime};base64,${a.data}`;await i.decode();if(i.naturalWidth!==a.width||i.naturalHeight!==a.height)throw Error('Wrong image dimensions');}return records[0].assets.length;});assert.equal(decoded,38);
    await cold.goto(`${base}/#read/${id}/chapter-12`);await ready(cold,'chapter-12');assert.equal(await cold.locator('#reading-text').textContent(),exact(section('chapter-12')));await capture(cold,engine+'-cold-offline');
    // A reading-only outage is insufficient: create and then edit an annotation
    // with the origin still stopped, reloading the exact stored result each time.
    const offlineBlock=section('chapter-12').blocks.find(b=>b.kind==='prose'&&!b.initial&&b.text.length>200),offlineQuote=offlineBlock.text.slice(10,90),createdText='Created while the origin is unavailable.\nAn exact offline note.',editedText='Edited while the origin is unavailable.\nRetained after another offline reload.';
    await cold.locator(`#reading-text [data-block="${offlineBlock.id}"]`).evaluate(e=>scrollTo(0,scrollY+e.getBoundingClientRect().top-document.querySelector('.reader-tools').getBoundingClientRect().bottom-20));
    const offlinePosition=await persistedPosition(cold,id,offlineBlock.id);
    assert.equal(await select(cold,offlineBlock.id,10,90),offlineQuote);await cold.locator('#selection-save').click();await cold.locator('#note-text').fill(createdText);await cold.getByRole('button',{name:'Save on this device',exact:true}).click();await cold.waitForFunction(()=>!document.querySelector('#dialog').open);
    let offlineState=await state(cold),offlineNote=offlineState.notes.find(n=>n.sectionId==='chapter-12'&&n.quote===offlineQuote);assert.ok(offlineNote);assert.equal(offlineNote.note,createdText);assert.equal(offlineState.notes.length,3);
    await cold.reload();await ready(cold,'chapter-12');await settle(cold);offlineState=await state(cold);assert.equal(offlineState.notes.find(n=>n.id===offlineNote.id)?.note,createdText);assert.equal(offlineState.notes.find(n=>n.id===offlineNote.id)?.quote,offlineQuote);assert.deepEqual(offlineState.positions[id],offlinePosition);
    const offlineGeometry=await cold.locator(`#reading-text [data-block="${offlineBlock.id}"]`).evaluate(e=>({top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height,edge:document.querySelector('.reader-tools').getBoundingClientRect().bottom+20,bottom:innerHeight}));assert.ok(Math.abs(offlineGeometry.top-offlineGeometry.edge)<2,JSON.stringify(offlineGeometry));
    await clickVisible(cold,cold.getByRole('link',{name:'Looking closer',exact:true}));await cold.locator('.looking-exercises').waitFor();await cold.getByRole('button',{name:/Read Alice’s first paragraph/}).click();await cold.locator('#context-text[data-location-ready="true"]').waitFor();assert.equal(await cold.locator('#context-text').textContent(),exact(section('chapter-01')));await close(cold);sameReadingPlace((await state(cold)).positions[id],offlinePosition,offlineGeometry.height);await capture(cold,engine+'-offline-companion');
    await cold.getByRole('button',{name:/Return to your book/}).click();await ready(cold,'chapter-12');sameReadingPlace((await state(cold)).positions[id],offlinePosition,offlineGeometry.height);
    await clickVisible(cold,cold.getByRole('link',{name:'Passages',exact:true}));await cold.locator('.passage').filter({hasText:createdText}).getByRole('button',{name:'Edit note',exact:true}).click();await cold.locator('#note-text').fill(editedText);await cold.getByRole('button',{name:'Save on this device',exact:true}).click();await cold.waitForFunction(()=>!document.querySelector('#dialog').open);
    await cold.reload();await cold.locator('.passage-list').waitFor();offlineState=await state(cold);offlineNote=offlineState.notes.find(n=>n.id===offlineNote.id);assert.equal(offlineNote.note,editedText);assert.equal(offlineNote.quote,offlineQuote);assert.equal(offlineState.notes.length,3);sameReadingPlace(offlineState.positions[id],offlinePosition,offlineGeometry.height);await capture(cold,engine+'-offline-note-persisted');
    await cold.getByRole('button',{name:/Return to your book/}).click();await ready(cold,'chapter-12');await cold.reload();await ready(cold,'chapter-12');sameReadingPlace((await state(cold)).positions[id],offlinePosition,offlineGeometry.height);assert.equal(await cold.locator('#reading-text').textContent(),exact(section('chapter-12')));
    assert.equal(await cold.evaluate(async()=>{try{await fetch('/uncached-after-offline-write-'+Date.now());return false;}catch{return true;}}),true,'Origin remains unavailable after annotation writes');
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    receipts.push({engine,sections:19,imageAssets:38,imageUses:43,exactDOM:true,savedNotes:3,multiBlock:true,latePassageAt36px:range,focusRecall:true,stationaryScrollRecall:true,spoilerPermission:true,companionPreservesPlace:true,illustrationContext:true,sourceSafeExcerptOmissions:true,touchTargets44px:true,ergonomics,backupRestoreTwice:true,freshBrowserRestore:true,missingIllustratedEditionRestored:true,optionalLibraryFailure:true,coldBrowserRestartOffline:true,offlineAnnotation:{created:true,edited:true,exactQuoteAndNoteReloaded:true,readingPosition:offlinePosition,restoredGeometry:offlineGeometry,companionReturnPreserved:true,networkStillUnavailable:true},negativeNetworkControlFailed:negativeControl,externalRequests:requests,scriptErrors:errors,viewports:viewports.map(([,w,h])=>`${w}×${h}`),limits:'Browser emulation only; no physical iOS/e-ink or human pilot. Touch target checks cover interface chrome, not inline source correction text.'});
    console.log(engine,'passed: complete edition, interaction, recovery, responsive and cold offline checks');
  }finally{if(context)await context.close();if(browser)await browser.close();if(server)await stopServer(server);await writeFile(new URL('alice-browser.json',out),JSON.stringify({checkedAt:new Date().toISOString(),receipts},null,2)+'\n');}
}
