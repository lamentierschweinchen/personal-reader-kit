// Real mounted editions; source text is read from the admitted inputs, never copied here.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {serve} from './serve.mjs';
import {buildShowcase} from './build.mjs';
import {CONTINUATION_KEY} from './continuation.mjs';
import {settledRender} from '../tests/experience-browser.mjs';

const hosted=process.env.SHOWCASE_BASE_URL;
if(!hosted&&!process.argv.includes('--skip-build'))await buildShowcase();
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=path.resolve(process.env.REVIEW_OUTPUT||fileURLToPath(new URL('../test-results/douglass-poe/',import.meta.url)));
await mkdir(output,{recursive:true});
const entries=[
 {slug:'douglass',directory:'douglass-narrative',book:'douglass-1845',section:'chapter-xi',shelf:'.title-page'},
 {slug:'poe',directory:'fall-of-the-house-of-usher',book:'usher-1845',section:'story',shelf:'.usher-cover'},
];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let activePage;
const receipt={checkedAt:new Date().toISOString(),passed:false,mode:hosted?'existing remote origin':'own stoppable loopback origin',cases:[],errorMonitoring:[],limits:'Chromium/WebKit emulation and deterministic DOM selection; not physical touch, Home Screen installation, assistive-technology or human editorial acceptance. WebKit may report caught stopped-origin fetch transport diagnostics through Playwright pageerror; only exact demonstrated local URLs and caught app frames are separately recorded, while native errors/rejections and every online pageerror remain strict. Remote mode cannot establish stopped-origin operation.'};
const save=()=>writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
await save();
async function stage(engine,reader,label,run,timeout=90000){
 const start=Date.now();receipt.current={engine,reader,label,startedAt:new Date(start).toISOString()};await save();console.log(`[${engine}/${reader}] ${label}`);
 let timer;try{return await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`${label} exceeded ${timeout}ms`)),timeout);})]);}
 catch(error){receipt.failure={...receipt.current,message:error.stack,elapsedMs:Date.now()-start};if(activePage&&!activePage.isClosed())try{await activePage.screenshot({path:path.join(output,'failure.png'),timeout:5000});}catch{}await save();throw error;}
 finally{clearTimeout(timer);}
}
const state=(page,e)=>page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),e.slug);
const ready=(page,book,section)=>page.locator(`#reading-text[data-book="${book}"][data-section="${section}"][data-position-ready="true"]`).waitFor();
async function openSection(page,base,e,book,section){await page.goto(`${base}/${e.slug}/#read/${book}/${section}`);await ready(page,book,section);await settledRender(page);}
async function close(page){await page.keyboard.press('Escape');await page.locator('#dialog').waitFor({state:'hidden'});await settledRender(page);}
async function layout(page,label){
 await settledRender(page);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': page stays inside viewport');
 const modal=await page.locator('#dialog[open]').count();
 if(modal)assert.ok(await page.locator('#dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1;}),label+': modal inside viewport');
}
async function capture(page,name){await layout(page,name);await page.screenshot({path:path.join(output,name+'.png')});}
// Compare individual source blocks so adjacent editorial links cannot hide a source defect.
async function surface(page,selector,blocks){
 const actual=await page.locator(selector).evaluate((root,blocks)=>{
  const failures=[];
  if(root.querySelectorAll('[data-block]').length!==blocks.length)failures.push('block count');
  for(const b of blocks){
   const node=[...root.querySelectorAll('[data-block]')].find(n=>n.dataset.block===b.id);
   if(!node||node.textContent!==b.text){failures.push(b.id+': exact text');continue;}
   const walk=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let n,offset=0;
   while(n=walk.nextNode()){
    const kinds=['em','strong'].filter(kind=>n.parentElement.closest(kind)&&node.contains(n.parentElement.closest(kind)));
    for(let i=offset;i<offset+n.length;i++)for(const kind of ['em','strong'])if(kinds.includes(kind)!==(b.marks||[]).some(m=>m.kind===kind&&m.start<=i&&m.end>i)){failures.push(b.id+': emphasis at '+i);break;}
    offset+=n.length;
   }
   if(b.layout==='fixed'&&!node.classList.contains('fixed-lines'))failures.push(b.id+': fixed line layout');
   const at=element=>{const r=document.createRange();r.selectNodeContents(node);r.setEndBefore(element);return r.toString().length;};
   const refs=[...node.querySelectorAll('.source-note-call')].map(n=>({target:n.dataset.sourceNote,text:n.textContent,start:at(n)}));
   if(JSON.stringify(refs)!==JSON.stringify((b.references||[]).map(r=>({target:r.target,text:b.text.slice(r.start,r.end),start:r.start}))))failures.push(b.id+': source references');
   if(JSON.stringify([...node.querySelectorAll('[data-source-page]')].map(n=>({id:n.dataset.sourcePage,offset:at(n)})))!==JSON.stringify((b.pages||[]).map(p=>({id:p.id,offset:p.offset}))))failures.push(b.id+': page boundaries');
   let after='',next=node.nextSibling;while(next&&!(next.nodeType===1&&next.hasAttribute('data-block'))){if(next.nodeType===3)after+=next.textContent;next=next.nextSibling;}if(after!==b.after)failures.push(b.id+': source separator');
   if(b.lineIndents){const insets=[...node.querySelectorAll('.source-line-inset')].map(n=>parseFloat(n.style.marginLeft));if(JSON.stringify(insets)!==JSON.stringify(b.lineIndents.filter(Boolean)))failures.push(b.id+': witnessed line insets');}
  }
  return failures;
 },blocks);
 assert.deepEqual(actual,[],selector+': characters, emphasis, source references, pages and fixed lines');
}
async function imagePixels(page,src){return page.evaluate(async src=>{const im=new Image();im.src=src;await im.decode();return [im.naturalWidth,im.naturalHeight];},src);}
async function sourceProof(page,base,e,library){
 let sections=0,blocks=0,figures=0;
 for(const book of library)for(const section of book.sections){
  await openSection(page,base,e,book.id,section.id);await surface(page,'#reading-text',section.blocks);sections++;blocks+=section.blocks.length;
  for(const block of section.blocks.filter(b=>b.image)){
   const asset=book.assets.find(a=>a.id===block.image.assetId),img=page.locator(`#reading-text figure[data-asset="${asset.id}"] img`);
   assert.deepEqual(await imagePixels(page,await img.getAttribute('src')),[asset.width,asset.height]);assert.equal(await img.getAttribute('alt'),asset.alt);figures++;
  }
 }
 return {sections,blocks,figures,exactCharactersAndApparatus:true};
}
async function positioned(page,base,e,section=e.section,blockId){
 await openSection(page,base,e,e.book,section);
 await page.evaluate(blockId=>{const nodes=[...document.querySelectorAll('#reading-text [data-block]')],el=nodes.find(n=>n.dataset.block===blockId)||nodes.find(n=>n.textContent.length>400);if(!el)throw Error('No substantial real source block');const edge=Math.max(0,document.querySelector('.reader-tools').getBoundingClientRect().bottom)+20;scrollTo(0,scrollY+el.getBoundingClientRect().top+Math.min(150,el.clientHeight*.3)-edge);},blockId);
 await page.waitForTimeout(800);await settledRender(page);
 const s=await state(page,e);assert.equal(s.positions[e.book].sectionId,section);assert.equal(s.positions[e.book].revision,e.library.find(b=>b.id===e.book).source.sha256);
 return {hash:new URL(page.url()).hash,scroll:await page.evaluate(()=>scrollY),positions:s.positions};
}
async function unchanged(page,e,before,label){
 assert.equal(new URL(page.url()).hash,before.hash,label+': main route');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before.scroll)<=1,label+': exact same-layout reading scroll');assert.deepEqual((await state(page,e)).positions,before.positions,label+': reading records');
}
async function douglassDocuments(page,base,e,engine){
 const binding=await page.evaluate(()=>import('/douglass/edition-binding.mjs').then(m=>m.editionBinding)),checks=[];
 for(const width of [320,390,820,1280]){
  await page.setViewportSize({width,height:width>=820?1000:844});
  for(const ref of binding.references){
   const key=ref.id==='bingham-dialogue-1817'?'schoolbook':ref.id==='fugitive-act-1793'?'law':'escape',book=e.library.find(b=>b.id===ref.id);
   await positioned(page,base,e,ref.sectionId,ref.blockId);
   const launcher=page.locator(`#reading-text [data-action="${key==='schoolbook'?'schoolbook':'historical-document'}"]${key==='schoolbook'?'':`[data-document="${key}"]`}`).first();
   // Account for locator scrolling before recording the dialog origin.
   await launcher.scrollIntoViewIfNeeded();await launcher.focus();await page.waitForTimeout(800);const before={hash:new URL(page.url()).hash,scroll:await page.evaluate(()=>scrollY),positions:(await state(page,e)).positions};
   // WebKit pointer activation need not focus a button. Prove keyboard return
   // with keyboard activation, while retaining the exact source/place checks.
   await launcher.press('Enter');await page.locator('#dialog[open]').waitFor();
   const details=page.locator('#dialog details');if(await details.count())await details.first().locator('summary').click();
   if(key==='schoolbook')await surface(page,'#schoolbook-text',book.sections.flatMap(s=>s.blocks));
   else if(key==='law'){await surface(page,'#statute-text',book.sections.find(s=>s.id==='section-3').blocks);await surface(page,'#statute-penalties',book.sections.find(s=>s.id==='section-4').blocks);}
   else {await surface(page,'#escape-full',book.sections.flatMap(s=>s.blocks));const main=e.library.find(b=>b.id===e.book).sections.find(s=>s.id===ref.sectionId).blocks.find(b=>b.id===ref.blockId),excerpt=book.sections.find(s=>s.id===ref.excerpt.sectionId).blocks.find(b=>b.id===ref.excerpt.blockId);assert.equal(await page.locator('#withheld-text').textContent(),main.text.slice(ref.quote.start,ref.quote.end));assert.equal(await page.locator('#escape-excerpt').textContent(),excerpt.text.slice(ref.excerpt.start,ref.excerpt.end));}
   await capture(page,`${engine}-douglass-${key}-${width}`);
   await page.locator(`#dialog [data-action="${key==='schoolbook'?'dialogue-source':'document-source'}"]`).click();await page.locator('#dialog .context-item').first().waitFor();await layout(page,'document source');await close(page);await unchanged(page,e,before,key+' return');assert.equal(await launcher.evaluate(el=>el===document.activeElement),true,key+': launcher focus returns');
   checks.push({width,document:key,completeSource:true,exactReturn:true});
  }
 }
 // The original root-charm note belongs to Chapter X, not the earlier Covey passage.
 const main=e.library.find(b=>b.id===e.book);
 for(const section of main.sections)for(const b of section.blocks.filter(b=>b.references?.length)){
  await openSection(page,base,e,main.id,section.id);const call=page.locator(`[data-block="${b.id}"] .source-note-call`).first();await call.scrollIntoViewIfNeeded();await call.focus();await page.waitForTimeout(800);const before={hash:new URL(page.url()).hash,scroll:await page.evaluate(()=>scrollY),positions:(await state(page,e)).positions};await call.click();const target=main.sections.flatMap(s=>s.blocks).find(n=>n.sourceNote?.id===b.references[0].target);await surface(page,'#source-note-text',[target]);await close(page);await unchanged(page,e,before,'original note');
 }
 return checks;
}
async function poeWorks(page,base,e,engine){
 await page.goto(base+'/poe/#companion');await page.locator('.plate-button').first().waitFor();
 assert.equal(await page.locator('main img[src$="clarke.jpg"]').count(),0,'ending image initially hidden');
 await page.locator('[data-action="work"][data-work="clarke"]').first().click();await page.locator('#dialog [data-action="reveal-ending"]').waitFor();assert.equal(await page.locator('#dialog img').count(),0,'gate does not disclose image');await close(page);
 const works=await page.evaluate(()=>import('/poe/usher.mjs').then(m=>m.works)),book=e.library[0],checks=[];
 for(const width of [320,390,820,1280]){
  await page.setViewportSize({width,height:width>=820?1000:844});const before=await positioned(page,base,e,'story','u31');
  await page.goto(base+'/poe/#companion');await page.locator('.plate-button').first().waitFor();
  for(const work of works){
   const launcher=page.locator(`[data-action="work"][data-work="${work.id}"]`).first();await launcher.click();
   const reveal=page.locator('#dialog [data-action="reveal-ending"]');if(await reveal.count())await reveal.click();
   await page.locator('#dialog-title').filter({hasText:work.title}).waitFor();
   for(const [i,id]of work.blocks.entries()){const block=book.sections[0].blocks.find(b=>b.id===id),start=work.start?block.text.indexOf(work.start):0;let end=work.end?block.text.indexOf(work.end):block.text.length;while(end>start&&/\s/.test(block.text[end-1]))end--;assert.equal(await page.locator('#study-'+i).textContent(),block.text.slice(start,end));}
   if(work.image){assert.equal(await page.locator('.art-frame img').getAttribute('src'),'/poe/'+work.image);const dims=await imagePixels(page,'/poe/'+work.image);assert.ok(dims[0]>2000&&dims[1]>3000);await capture(page,`${engine}-poe-${work.id}-${width}`);for(const mode of ['detail','full','fit']){await page.locator(`[data-action="zoom-art"][data-mode="${mode}"]`).click();assert.equal(await page.locator('.art-frame').getAttribute('data-zoom'),mode);await layout(page,'artwork '+mode);}}
   await close(page);assert.equal(await page.locator(`[data-action="work"][data-work="${work.id}"]`).first().evaluate(el=>el===document.activeElement),true,'work launcher focus after close');assert.deepEqual((await state(page,e)).positions,before.positions,'study does not advance main reading records');
  }
  const toggle=page.locator('[data-action="spoilers"]');await toggle.focus();await page.keyboard.press('Enter');await page.getByRole('button',{name:'Ending material is hidden',exact:true}).waitFor();assert.equal(await toggle.evaluate(el=>el===document.activeElement),true,'hide-ending rerender retains equivalent toggle focus');assert.equal(await page.locator('main img[src$="clarke.jpg"]').count(),0,'hide-ending removes disclosed image');assert.deepEqual((await state(page,e)).positions,before.positions,'ending controls do not advance main place');
  await page.goto(`${base}/poe/${before.hash}`);await ready(page,e.book,'story');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before.scroll)<=2,'main place returns after companion');
  checks.push({width,works:works.length,exactExcerpts:true,fullAndDetailPixels:true,mainPlaceUnchanged:true});
 }
 await openSection(page,base,e,e.book,'story');const call=page.locator('[data-action="source-note"]');await call.scrollIntoViewIfNeeded();await call.focus();await page.waitForTimeout(800);const before={hash:new URL(page.url()).hash,scroll:await page.evaluate(()=>scrollY),positions:(await state(page,e)).positions};await call.click();await page.locator('#context-text[data-location-ready="true"]').waitFor();assert.equal(await page.locator('#context-text [data-block="u51"]').textContent(),book.sections[0].blocks.find(b=>b.id==='u51').text);await close(page);await unchanged(page,e,before,'Poe original footnote');
 return checks;
}
async function annotation(page,base,e){
 await page.setViewportSize({width:390,height:844});await positioned(page,base,e);
 const quote=await page.evaluate(()=>{const node=[...document.querySelectorAll('#reading-text [data-block]')].find(n=>n.textContent.length>200),walk=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let n;while((n=walk.nextNode())&&n.length<60){}if(!n)throw Error('No substantial source text node');const r=document.createRange();r.setStart(n,5);r.setEnd(n,55);r.getBoundingClientRect();const sel=getSelection();sel.removeAllRanges();sel.addRange(r);return sel.toString();});
 await page.locator('#selection-save').click();await page.locator('#note-text').fill(`Mounted ${e.slug} recovery check.`);await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});await ready(page,e.book,e.section);
 const before=await state(page,e);assert.equal(before.notes.length,1);assert.equal(before.notes[0].quote,quote);await page.reload();await ready(page,e.book,e.section);assert.deepEqual((await state(page,e)).notes,before.notes);await surface(page,'#reading-text',e.library.find(b=>b.id===e.book).sections.find(s=>s.id===e.section).blocks);
 return {quoteLength:quote.length,exactRecordAcrossReload:true};
}
async function continuation(page,base,e){
 const checks=[];
 for(const book of e.library){const section=book.id===e.book?book.sections.find(s=>s.id===e.section):book.sections.find(s=>s.blocks.some(b=>b.text.length>500))||book.sections[0];await openSection(page,base,e,book.id,section.id);await page.evaluate(()=>scrollTo(0,Math.min(650,document.documentElement.scrollHeight-innerHeight)));await page.waitForTimeout(800);await page.waitForFunction(({key,edition,work})=>{try{const p=JSON.parse(localStorage.getItem(key));return p.edition===edition&&p.work===work;}catch{return false;}},{key:CONTINUATION_KEY,edition:e.slug,work:book.id});const position=(await state(page,e)).positions[book.id];await page.goto(base+'/library/');const link=page.locator('[data-continuation-link]');await link.waitFor({state:'visible'});assert.equal(await link.getAttribute('href'),`/${e.slug}/#continue/${book.id}`);await link.focus();await page.keyboard.press('Enter');await ready(page,book.id,section.id);assert.equal(new URL(page.url()).hash,`#read/${book.id}/${section.id}`);assert.deepEqual((await state(page,e)).positions[book.id],position);checks.push(book.id);}
 return checks;
}
async function scopedAssets(page,base,e){
 const manifest=await (await page.request.get(`${base}/${e.slug}/manifest.webmanifest`)).json();for(const key of ['id','scope','start_url'])assert.equal(manifest[key],'/'+e.slug+'/');
 const apple=await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');assert.equal(apple,`/${e.slug}/apple-touch-icon.png`);assert.deepEqual(await imagePixels(page,apple),[180,180]);
 for(const icon of manifest.icons){const src=new URL(icon.src,base+'/'+e.slug+'/');assert.equal(src.origin,new URL(base).origin);assert.ok(src.pathname.startsWith('/'+e.slug+'/'));const size=icon.sizes.split('x').map(Number);if(size.every(Number.isFinite))assert.deepEqual(await imagePixels(page,src.href),size);}
 if(e.slug==='poe'){await page.evaluate(()=>document.fonts.load('italic 24px Fell'));const fonts=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>/woff2/.test(r.name)).map(r=>new URL(r.name).pathname));assert.deepEqual([...new Set(fonts)].sort(),['/poe/im-fell-italic.woff2','/poe/im-fell-normal.woff2']);}
 assert.equal(await page.evaluate(()=>new URL(navigator.serviceWorker.controller.scriptURL).pathname),`/${e.slug}/sw.js`);
 return {manifestAndIconsScoped:true,workerScoped:true,selfHostedFonts:e.slug==='poe'};
}
async function bundleRecovery(browser,page,base,e,engine,watchContext){
 await positioned(page,base,e);await page.locator('[data-action="settings"]').click();await page.locator('[data-action="bundle-export"]').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download private bundle',exact:true}).click();const file=path.join(output,`${engine}-${e.slug}-private-bundle.json`);await (await download).saveAs(file);const bundle=JSON.parse(await readFile(file));const original=await state(page,e);assert.deepEqual(bundle.state.notes,original.notes);assert.deepEqual(bundle.state.positions,original.positions);assert.deepEqual(bundle.books.map(b=>b.id).sort(),e.library.map(b=>b.id).sort());await close(page);
 const fresh=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});fresh.setDefaultTimeout(20000);
 await watchContext(fresh);
 // A fresh address may have no supplied editions. Exercise actual book restoration,
 // rather than accepting the already-present hosted copies as a bundle restore.
 await fresh.route(`**/${e.slug}/library.json`,route=>route.fulfill({contentType:'application/json',body:'[]'}));
 const p=await fresh.newPage();
 try{await p.goto(base+'/'+e.slug+'/');await p.locator(e.shelf).waitFor();assert.equal((await state(p,e)).notes.length,0);await p.locator('[data-action="settings"]').click();await p.locator('#bundle-file').setInputFiles(file);await p.locator('[data-action="bundle-apply"]').waitFor();assert.equal((await state(p,e)).notes.length,0,'preview makes no writes');await p.locator('[data-action="bundle-apply"]').click();await p.locator('#dialog').waitFor({state:'hidden'});const restored=await state(p,e);assert.deepEqual(restored.notes,original.notes);assert.deepEqual(restored.positions,original.positions);const actual=await p.evaluate(async slug=>{const {rawBooks}=await import('/'+slug+'/db.mjs');return rawBooks();},e.slug);assert.deepEqual(actual.sort((a,b)=>a.id.localeCompare(b.id)),bundle.books.sort((a,b)=>a.id.localeCompare(b.id)));await p.locator('[data-action="resume"]').first().click();await ready(p,e.book,e.section);await surface(p,'#reading-text',e.library.find(b=>b.id===e.book).sections.find(s=>s.id===e.section).blocks);return {allExactEditions:true,previewNoWrites:true,exactNotesAndPositions:true,freshBrowserContext:true,missingSuppliedLibraryFixture:true};}finally{await fresh.close();}
}

for(const engine of ['chromium','webkit']){
 let server=hosted?null:await serve();const port=server?.address().port,base=(hosted||'http://127.0.0.1:'+port).replace(/\/$/,'');
 const browser=await pw[engine].launch({headless:true,...(process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH']?{executablePath:process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH']}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});context.setDefaultTimeout(20000);context.setDefaultNavigationTimeout(30000);
 const pages=[],errors=[],nativeErrors=[],bad=[],network=[],transport=[];let online=true;
 const marker='Original reader error monitor control';let controlReported;
 const nativeControl=new Promise(resolve=>controlReported=resolve);
 const caughtLines=Object.fromEntries(await Promise.all(entries.map(async e=>{const lines=(await readFile(new URL(`dist/${e.slug}/app.mjs`,import.meta.url),'utf8')).split('\n');return[e.slug,{library:lines.findIndex(line=>line.includes(`const response=await fetch('/${e.slug}/library.json'`))+1,probe:lines.findIndex(line=>line.includes(`fetch('/${e.slug}/build.json?network=1'`))+1}];})));
 const monitor={engine,expectedStoppedOriginTransport:transport,nativeErrors,unexpectedPageErrors:errors,negativeControl:false};receipt.errorMonitoring.push(monitor);
 async function watchContext(target){
  await target.exposeBinding('__readerReviewRuntimeError',({page},event)=>{nativeErrors.push({url:page.url(),offline:!online,...event});if(event.message?.includes(marker))controlReported();});
  await target.addInitScript(()=>{
   const report=value=>void window.__readerReviewRuntimeError(value).catch(()=>{});
   addEventListener('error',event=>{if(event.error||event.message)report({type:'error',message:event.message,stack:event.error?.stack});});
   addEventListener('unhandledrejection',event=>report({type:'unhandledrejection',message:String(event.reason),stack:event.reason?.stack}));
  });
  target.on('page',page=>page.on('pageerror',error=>{
   const event={url:page.url(),offline:!online,name:error.name,message:error.message,stack:error.stack},first=error.stack?.split('\n')[0];
   // WebKit also reports caught transport failures as pageerror. Native window
   // errors/rejections stay strict; this exception requires our stopped origin,
   // an exact demonstrated URL and the known caught fetch's source line.
   const expected=engine==='webkit'&&!hosted&&!online&&error.name==='Fetch API cannot load http'&&entries.some(e=>{
    if(!page.url().startsWith(base+'/'+e.slug+'/'))return false;
    const library=first===`Fetch API cannot load ${base}/${e.slug}/library.json due to access control checks.`&&error.stack.includes(`at module code (${base}/${e.slug}/app.mjs:${caughtLines[e.slug].library}:`);
    const probe=e.slug==='poe'&&first===`Fetch API cannot load ${base}/poe/build.json?network=1 due to access control checks.`&&error.stack.includes(`at offline (${base}/poe/app.mjs:${caughtLines.poe.probe}:`);
    return library||probe;
   });
   (expected?transport:errors).push(event);
  }));
 }
 await watchContext(context);
 context.on('response',response=>{if(online&&response.status()>=400)bad.push(response.status()+' '+response.url());});
 context.on('request',request=>{if(['image','font','script','stylesheet'].includes(request.resourceType())){let documentURL;try{documentURL=request.frame().url();}catch{}network.push({url:request.url(),type:request.resourceType(),documentURL});}});
 try{
  // Prove both monitors still reject an actual uncaught script error.
  const controlURL=base+'/__reader-review-control/',controlPattern=controlURL+'**';
  await context.route(controlPattern,route=>route.fulfill({contentType:route.request().url().endsWith('/throw.js')?'text/javascript':'text/html',body:route.request().url().endsWith('/throw.js')?`setTimeout(()=>{throw Error(${JSON.stringify(marker)});},0);`:'<!doctype html><title>Original error monitor control</title><script src="./throw.js"></script>'}));
  const control=await context.newPage();activePage=control;
  const pageControl=control.waitForEvent('pageerror',{predicate:error=>error.message===marker,timeout:15000});
  await stage(engine,'monitor','Uncaught original-script negative control',async()=>{await control.goto(controlURL);await Promise.all([pageControl,nativeControl]);},15000);
  assert.ok(errors.some(e=>e.message===marker));assert.ok(nativeErrors.some(e=>e.message?.includes(marker)));
  errors.splice(errors.findIndex(e=>e.message===marker),1);nativeErrors.splice(nativeErrors.findIndex(e=>e.message?.includes(marker)),1);await control.close();await context.unroute(controlPattern);monitor.negativeControl=true;
  for(const entry of entries){const e={...entry},page=await context.newPage();activePage=page;pages.push({e,page});const result={engine,reader:e.slug};
   await stage(engine,e.slug,'Exact admitted library and entrance',async()=>{
    const response=await page.request.get(`${base}/${e.slug}/library.json`);assert.ok(response.ok());const bytes=await response.body();
    const inventory=JSON.parse(await readFile(new URL(`../examples/${e.directory}/docs/EDITION-INVENTORY.json`,import.meta.url)));
    if(e.slug==='douglass'){
     assert.equal(sha(bytes),inventory.librarySha256,'mounted library matches admitted inventory');
     const expected=[];for(const edition of inventory.editions){const raw=await readFile(new URL(`../examples/${e.directory}/${edition.preparedFile.path}`,import.meta.url));assert.equal(sha(raw),edition.preparedFile.sha256);expected.push(JSON.parse(raw));}assert.deepEqual(JSON.parse(bytes),expected,'all four prepared editions remain exact');
    }else{const pin=inventory.files.find(file=>file.name==='library.json');assert.equal(sha(bytes),pin.sha256);const input=await readFile(new URL(`../examples/${e.directory}/${pin.path}`,import.meta.url));assert.equal(sha(bytes),sha(input));}
    e.library=JSON.parse(bytes);result.librarySha256=sha(bytes);await page.goto(base+'/'+e.slug+'/');await page.locator(e.shelf).waitFor();await page.locator('#offline-status').filter({hasText:'Available offline'}).waitFor({timeout:90000});
    for(const width of [320,390,820,1280]){await page.setViewportSize({width,height:width>=820?1000:844});await capture(page,`${engine}-${e.slug}-entrance-${width}`);}
   });
   result.source=await stage(engine,e.slug,'Every section and original figure',()=>sourceProof(page,base,e,e.library),150000);
   await stage(engine,e.slug,'Reading layouts',async()=>{for(const width of [320,390,820,1280]){await page.setViewportSize({width,height:width>=820?1000:844});await openSection(page,base,e,e.book,e.section);await capture(page,`${engine}-${e.slug}-reading-${width}`);}});
   result.contexts=await stage(engine,e.slug,'Exact companions, context return and focus',()=>e.slug==='douglass'?douglassDocuments(page,base,e,engine):poeWorks(page,base,e,engine),180000);
   result.note=await stage(engine,e.slug,'Selection, annotation and reload',()=>annotation(page,base,e));
   result.continuation=await stage(engine,e.slug,'Library Continue for every admitted work',()=>continuation(page,base,e));
   result.assets=await stage(engine,e.slug,'Scoped fonts, icons and worker',()=>scopedAssets(page,base,e));
   result.recovery=await stage(engine,e.slug,'Private bundle and exact fresh-browser recovery',()=>bundleRecovery(browser,page,base,e,engine,watchContext));
   receipt.cases.push(result);await save();
  }
  assert.deepEqual(errors,[],'runtime exceptions');assert.deepEqual(nativeErrors,[],'native window errors and unhandled rejections');assert.deepEqual(bad,[],'unexpected online HTTP failures');
  // Library visits deliberately load the whole catalogue's covers and fonts.
  // Attribute requests to their document before checking reader-local paths.
  const misplaced=network.filter(r=>{
   const url=new URL(r.url),documentURL=r.documentURL&&new URL(r.documentURL);
   if(url.origin!==new URL(base).origin||url.pathname.startsWith('/_vercel/'))return false;
   const edition=entries.find(e=>documentURL?.pathname.startsWith('/'+e.slug+'/'));
   return edition&&!url.pathname.startsWith('/'+edition.slug+'/')&&!['/continuation.mjs','/analytics.mjs'].includes(url.pathname);
  });assert.deepEqual(misplaced,[],'reader assets stay in their own mount');
  const external=network.filter(r=>!r.url.startsWith('data:')&&new URL(r.url).origin!==new URL(base).origin);assert.deepEqual(external,[],'no external automatic font/image/script requests');
  if(server){online=false;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;
   for(const {e,page}of pages)await stage(engine,e.slug,'Stopped-origin cold reload and negative network control',async()=>{await page.goto(`${base}/${e.slug}/#read/${e.book}/${e.section}`);await page.reload();await ready(page,e.book,e.section);await surface(page,'#reading-text',e.library.find(b=>b.id===e.book).sections.find(s=>s.id===e.section).blocks);assert.equal(await page.evaluate(async()=>{try{await fetch('/uncached-douglass-poe-proof',{cache:'no-store',signal:AbortSignal.timeout(3000)});return false;}catch{return true;}}),true,'raw uncached network request fails while origin stopped');assert.equal((await state(page,e)).notes[0].note,`Mounted ${e.slug} recovery check.`);await page.goto(base+'/'+e.slug+'/#shelf');await page.reload();await page.locator(e.shelf).waitFor();await settledRender(page);if(e.slug==='poe'){await page.locator('[data-action="work"][data-work="beardsley"]').first().click();assert.deepEqual(await imagePixels(page,'/poe/beardsley.jpg'),[2314,3645]);await close(page);}else assert.ok((await page.locator('.portrait img').evaluate(im=>im.naturalWidth))>0);await capture(page,`${engine}-${e.slug}-stopped-origin`);receipt.cases.find(r=>r.engine===engine&&r.reader===e.slug).stoppedOrigin={coldReload:true,negativeRawNetwork:true,sourceNoteAndArtwork:true};});
   server=await serve(port);online=true;
   for(const {e,page}of pages)await stage(engine,e.slug,'Origin recovery with retained private records',async()=>{activePage=page;await page.reload();await page.locator(e.shelf).waitFor();assert.ok((await page.request.get(base+'/'+e.slug+'/build.json?network=1')).ok(),'direct network request succeeds after origin recovery');assert.equal((await state(page,e)).notes[0].note,`Mounted ${e.slug} recovery check.`);receipt.cases.find(r=>r.engine===engine&&r.reader===e.slug).originRecovery=true;});
  }else for(const result of receipt.cases.filter(r=>r.engine===engine))result.stoppedOrigin={notAttempted:'Remote origin is not controlled by this test.'};
  assert.deepEqual(errors,[],'runtime exceptions after offline/recovery');assert.deepEqual(nativeErrors,[],'native window errors and unhandled rejections after offline/recovery');await save();
 }finally{await context.close();await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
}
receipt.passed=true;delete receipt.current;await save();console.log(JSON.stringify({passed:true,cases:receipt.cases.length,output,mode:receipt.mode}));
