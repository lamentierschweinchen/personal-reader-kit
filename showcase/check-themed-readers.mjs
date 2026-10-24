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
const output=path.resolve(process.env.REVIEW_OUTPUT||fileURLToPath(new URL('../test-results/themed-readers/',import.meta.url)));
await mkdir(output,{recursive:true});
const entries=[
 {slug:'ballads',directory:'ballads-and-a-play',book:'iphigenie-de',section:'a1s1',shelf:'.collection-jacket',sourceHeading:'Sources and rights',sourceAnchors:['erlkoenig-de','iphigenie-en']},
 {slug:'shakespeare',directory:'kingdom-for-a-stage',book:'folger-julius-caesar',section:'a1-s1',shelf:'.stage-entrance',sourceHeading:'Sources and licenses',sourceAnchors:['julius-caesar','henry-v','the-tempest']},
 {slug:'pictures-after-dark',directory:'pictures-after-dark',book:'pictures-fr',section:'ronde',shelf:'.folio-cover',sourceHeading:'Sources & credits',sourceAnchors:['french','english','windows','pictures']},
 {slug:'rome',directory:'caesar-and-the-emperors',book:'caesar-vii-en',section:'vii-1',shelf:'.roman-shelf',sourceHeading:'Sources and licenses',sourceAnchors:['caesar-english','augustus-latin','marcus-greek','pliny']},
];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let activePage;
const receipt={checkedAt:new Date().toISOString(),passed:false,mode:hosted?'existing remote origin':'own stoppable loopback origin',cases:[],errorMonitoring:[],limits:'First/final/designated sections are sampled for every exact work; this is not complete proofreading or an exhaustive meaningful-sign review. Chromium/WebKit emulation and deterministic DOM selection do not establish physical touch, Home Screen installation, assistive-technology or human editorial acceptance. WebKit may report caught stopped-origin fetch transport diagnostics through Playwright pageerror; only exact demonstrated local URLs and caught app frames are separately recorded, while native errors/rejections and every online pageerror remain strict. Remote mode cannot establish stopped-origin operation.'};
const save=()=>writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
receipt.sourceNoticeActions=[];
await save();
async function stage(engine,reader,label,run,timeout=90000){
 const start=Date.now();receipt.current={engine,reader,label,startedAt:new Date(start).toISOString()};await save();console.log(`[${engine}/${reader}] ${label}`);
 let timer;try{return await Promise.race([run(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`${label} exceeded ${timeout}ms`)),timeout);})]);}
 catch(error){receipt.failure={...receipt.current,message:error.stack,elapsedMs:Date.now()-start};if(activePage&&!activePage.isClosed())try{await activePage.screenshot({path:path.join(output,'failure.png'),timeout:5000});}catch{}await save();throw error;}
 finally{clearTimeout(timer);}
}
const state=(page,e)=>page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),e.slug);
const ready=(page,book,section)=>page.locator(`#reading-text[data-book="${book}"][data-section="${section}"][data-position-ready="true"]`).waitFor();
async function openSection(page,base,e,book,section){await page.goto(`${base}/${e.slug}/#read/${book}/${section}`);await ready(page,book,section);await notices(page);await settledRender(page);}
async function close(page){await page.keyboard.press('Escape');await page.locator('#dialog').waitFor({state:'hidden'});await settledRender(page);}
async function layout(page,label){
 await settledRender(page);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+': page stays inside viewport');
 const modal=await page.locator('#dialog[open]').count();
 if(modal)assert.ok(await page.locator('#dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1&&el.scrollWidth<=el.clientWidth;}),label+': modal and its content inside viewport');
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
   if(b.lineInsets){const lines=[...node.querySelectorAll('.drama-line')];if(lines.length!==b.text.split('\n').length||lines.some((line,i)=>parseFloat(line.style.getPropertyValue('--source-inset'))!==(b.lineInsets.find(x=>x.line===i)?.em||0)))failures.push(b.id+': drama line insets');}
  }
  return failures;
 },blocks);
 assert.deepEqual(actual,[],selector+': characters, emphasis, source references, pages and fixed lines');
}
async function imagePixels(page,src){return page.evaluate(async src=>{const im=new Image();im.src=src;await im.decode();return [im.naturalWidth,im.naturalHeight];},src);}
async function sourceProof(page,base,e,library){
 let sections=0,blocks=0,figures=0;const coverage=[];
 const designated=book=>book.sections.find(s=>s.id===({
  'folger-julius-caesar':'a1-s1','folger-henry-v':'a5-chorus','folger-the-tempest':'a1-s2',
  'pictures-fr':'ronde','pictures-en':'ronde','caesar-vii-en':'vii-44','caesar-vii-la':'vii-44',
  'augustus-en':'rg-34','augustus-la':'rg-34','marcus-ii-iii-en':'ii-3','marcus-ii-iii-grc':'ii-3',
  'sallust-51':'catiline-51','tacitus-annals-1':'annals-1-2','pliny-trajan':'letter-37',
 }[book.id]||(book.id.startsWith('iphigenie-')?'a1s1':'poem')));
 for(const book of library){const chosen=designated(book);assert.ok(chosen,book.id+': designated real source section');const sampled=[...new Map([book.sections[0],book.sections.at(-1),chosen].map(s=>[s.id,s])).values()];coverage.push({book:book.id,totalSections:book.sections.length,sampledSections:sampled.map(s=>s.id)});for(const section of sampled){
  await openSection(page,base,e,book.id,section.id);await surface(page,'#reading-text',section.blocks);sections++;blocks+=section.blocks.length;
  for(const block of section.blocks.filter(b=>b.image)){
   const asset=book.assets.find(a=>a.id===block.image.assetId),img=page.locator(`#reading-text figure[data-asset="${asset.id}"] img`);
   assert.deepEqual(await imagePixels(page,await img.getAttribute('src')),[asset.width,asset.height]);assert.equal(await img.getAttribute('alt'),asset.alt);figures++;
  }
 }}
 return {sections,blocks,figures,sampledCharactersAndApparatus:true,coverage};
}
async function positioned(page,base,e,section=e.section,blockId){
 await openSection(page,base,e,e.book,section);
 await page.evaluate(blockId=>{const nodes=[...document.querySelectorAll('#reading-text [data-block]')],el=nodes.find(n=>n.dataset.block===blockId)||nodes.find(n=>n.textContent.length>180);if(!el)throw Error('No substantial real source block');const edge=Math.max(0,document.querySelector('.reader-tools').getBoundingClientRect().bottom)+20;scrollTo(0,scrollY+el.getBoundingClientRect().top+Math.min(150,el.clientHeight*.3)-edge);},blockId);
 await page.waitForTimeout(800);await settledRender(page);
 const s=await state(page,e);assert.equal(s.positions[e.book].sectionId,section);assert.equal(s.positions[e.book].revision,e.library.find(b=>b.id===e.book).source.sha256);
 return {hash:new URL(page.url()).hash,scroll:await page.evaluate(()=>scrollY),positions:s.positions};
}
async function unchanged(page,e,before,label){
 assert.equal(new URL(page.url()).hash,before.hash,label+': main route');assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before.scroll)<=1,label+': exact same-layout reading scroll');assert.deepEqual((await state(page,e)).positions,before.positions,label+': reading records');
}
async function notices(page){
 const pg=page.locator('#dialog[open] #pg-notice-body [data-action="close"]');if(await pg.count()){assert.equal(await page.locator('#pg-notice-body a').getAttribute('href'),'/ballads/sources/#iphigenie-en');receipt.sourceNoticeActions.push({engine:page.context().browser().browserType().name(),url:page.url(),action:'Continue reading'});await pg.click();await page.locator('#dialog').waitFor({state:'hidden'});}
 const button=page.locator('#dialog[open] [data-action="notice-continue"],#dialog[open] [data-action="notice-read"]');if(await button.count()){await button.first().click();await page.locator('#dialog').waitFor({state:'hidden'});}
 const inline=page.locator('[data-action="dismiss-source-notice"]');if(await inline.count())await inline.first().click();
}
async function contexts(page,base,e,engine){
 const results=[];
 for(const width of [320,390,820,1280]){
  await page.setViewportSize({width,height:width>=820?1000:844});await openSection(page,base,e,e.book,e.section);
  let before,reflowOrigin;
  if(e.slug==='ballads'){if(width<760){assert.equal(await page.getByRole('button',{name:'Both',exact:true}).isVisible(),false,'parallel opener is intentionally desktop-only');await page.getByRole('button',{name:'English',exact:true}).click();await ready(page,'iphigenie-en',e.section);await surface(page,'#reading-text',e.library.find(b=>b.id==='iphigenie-en').sections.find(s=>s.id===e.section).blocks);await page.getByRole('button',{name:'Deutsch',exact:true}).click();await ready(page,e.book,e.section);await surface(page,'#reading-text',e.library.find(b=>b.id===e.book).sections.find(s=>s.id===e.section).blocks);await page.setViewportSize({width:820,height:1000});await settledRender(page);}await page.getByRole('button',{name:'Both',exact:true}).scrollIntoViewIfNeeded();before={hash:new URL(page.url()).hash,scroll:await page.evaluate(()=>scrollY)};await page.getByRole('button',{name:'Both',exact:true}).click();await page.getByRole('heading',{name:'German and English',exact:true}).waitFor();before.positions=(await state(page,e)).positions;for(const lang of ['de','en']){const section=e.library.find(b=>b.id==='iphigenie-'+lang).sections.find(s=>s.id===e.section);assert.deepEqual(await page.locator(`#dialog .parallel-reading article[lang="${lang}"] [data-block]`).evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.block,text:n.textContent}))),section.blocks.map(b=>({id:b.id,text:b.text})));}if(width<760){reflowOrigin=before;before=null;await page.setViewportSize({width,height:844});await settledRender(page);}}
  else if(e.slug==='shakespeare'){await page.locator('[data-action="scene-context"]').scrollIntoViewIfNeeded();before={hash:new URL(page.url()).hash,scroll:await page.evaluate(()=>scrollY)};await page.locator('[data-action="scene-context"]').click();await page.locator('#dialog[open]').waitFor();await page.waitForFunction(async slug=>(await import('/'+slug+'/db.mjs')).loadState().then(s=>s.positions['folger-julius-caesar']?.sectionId==='a1-s1'),e.slug);before.positions=(await state(page,e)).positions;assert.deepEqual(await page.locator('#dialog .companion-reading').allTextContents(),e.library.find(b=>b.id===e.book).context.filter(c=>c.through===e.section).map(c=>c.text));}
  else if(e.slug==='pictures-after-dark'){await page.getByRole('button',{name:'English',exact:true}).click();await ready(page,'pictures-en',e.section);await page.getByRole('button',{name:'Français',exact:true}).click();await ready(page,e.book,e.section);await page.locator('[data-nav="companion"]').click();await page.locator('[data-action="folio-windows"]').click();await page.locator('#window-language').selectOption('en');assert.deepEqual(await page.locator('#window-passages p').allTextContents(),[e.folio.windows.en.bertrand,...e.folio.windows.en.baudelaire]);}
  else {await page.locator('[data-nav="companion"]').click();await page.locator('[data-action="roman-essay"][data-essay="augustus-power"]').click();await page.locator('#dialog').getByRole('heading',{name:'What does a ruler count?',exact:true}).waitFor();assert.equal(await page.locator('#dialog [data-action="roman-support"][data-book="tacitus-annals-1"]').count(),1);}
  await capture(page,engine+'-'+e.slug+'-context-'+width);await close(page);if(before)await unchanged(page,e,before,'parallel context return');if(reflowOrigin){assert.equal(new URL(page.url()).hash,reflowOrigin.hash,'comparison reflow returns to the main route');assert.equal((await state(page,e)).positions[e.book].sectionId,e.section,'comparison reflow retains work/section');await surface(page,'#reading-text',e.library.find(b=>b.id===e.book).sections.find(s=>s.id===e.section).blocks);}results.push(width);
 }
 if(e.slug==='shakespeare'){await page.setViewportSize({width:390,height:844});await openSection(page,base,e,'folger-the-tempest','a1-s2');await page.locator('[data-action="scene-context"]').click();await page.locator('#dialog [data-action="plate"]').click();await page.locator('.plate-full').waitFor();const asset=e.library.find(b=>b.id==='folger-the-tempest').assets[0];assert.equal(await page.locator('.plate-full figcaption').textContent(),asset.credit);assert.deepEqual(await imagePixels(page,await page.locator('.plate-full img').getAttribute('src')),[asset.width,asset.height]);await capture(page,engine+'-shakespeare-Miranda-full-credit-390');await close(page);}
 await openSection(page,base,e,e.book,e.section);await page.locator('.reader-tools [data-action="focus"]').click();await page.waitForFunction(()=>document.body.classList.contains('focus'));await settledRender(page);await page.locator('#main').focus();await page.keyboard.press('c');await page.locator('#focus-tools').waitFor({state:'visible'});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('focus'));
 return {widths:results,comparisonVisible:true,focusExit:true,...(e.slug==='ballads'?{mobileLanguageSwitchWidths:[320,390],parallelOpenedAtWidthForMobile:820,mobileReturnCheck:'route and exact section; desktop checks exact same-layout scroll and records; independent rotation suite checks visible source anchor'}:{})};
}
async function annotation(page,base,e){
 await page.setViewportSize({width:390,height:844});await positioned(page,base,e);
 const quote=await page.evaluate(()=>{const node=[...document.querySelectorAll('#reading-text [data-block]')].find(n=>n.textContent.length>200);if(!node)throw Error('No substantial source block');const walk=document.createTreeWalker(node,NodeFilter.SHOW_TEXT),r=document.createRange();let n,offset=0,started=false,ended=false;while((n=walk.nextNode())){if(!started&&offset+n.length>5){r.setStart(n,5-offset);started=true;}if(offset+n.length>=55){r.setEnd(n,55-offset);ended=true;break;}offset+=n.length;}if(!started||!ended)throw Error('Source range could not be located');r.getBoundingClientRect();const sel=getSelection();sel.removeAllRanges();sel.addRange(r);return sel.toString();});
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
 assert.equal(await page.evaluate(()=>new URL(navigator.serviceWorker.controller.scriptURL).pathname),`/${e.slug}/sw.js`);
 let embedded=0;const seen=new Set();for(const book of e.library)for(const asset of book.assets||[]){if(seen.has(asset.sha256))continue;seen.add(asset.sha256);const src=asset.data.startsWith('data:')?asset.data:`data:${asset.type||asset.mediaType};base64,${asset.data}`;assert.deepEqual(await imagePixels(page,src),[asset.width,asset.height]);embedded++;}
 const cache=await page.evaluate(async({slug,pins})=>{const keys=(await caches.keys()).filter(k=>k.startsWith('newreading-'+slug+'-'));if(keys.length!==1)return {keys,failures:['current scoped cache']};const c=await caches.open(keys[0]),failures=[];for(const pin of pins){const response=await c.match(pin.path);if(!response){failures.push(pin.path+': absent');continue;}const b=await response.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');if(b.byteLength!==pin.bytes||hash!==pin.sha256)failures.push(pin.path+': bytes');}return {keys,failures};},{slug:e.slug,pins:e.cachePins});assert.deepEqual(cache.failures,[],'complete current mounted cache has exact built bytes');
 return {manifestAndIconsScoped:true,workerScoped:true,declaredFontFiles:e.cachePins.filter(p=>/\.(woff2?|ttf)$/.test(p.path)).map(p=>p.path),embeddedImagesDecoded:embedded,completeCacheFilesChecked:e.cachePins.length};
}
async function sourcePage(page,base,e){
 await page.goto(base+'/'+e.slug+'/sources/');await page.getByRole('heading',{name:e.sourceHeading,exact:true,level:1}).waitFor();
 for(const id of e.sourceAnchors)assert.equal(await page.locator('#'+id).count(),1,'source anchor '+e.slug+'/'+id);
 if(e.slug==='shakespeare')for(const [i,id]of ['julius-caesar','henry-v','the-tempest'].entries())assert.equal(await page.locator('#'+id+' p').nth(1).textContent(),e.library[i].context[0].text);
 assert.ok((await page.locator('main').innerText()).length>500);return {url:'/'+e.slug+'/sources/',heading:e.sourceHeading,anchors:e.sourceAnchors};
}
async function bundleRecovery(browser,page,base,e,engine,watchContext){
 await positioned(page,base,e);await page.getByRole('button',{name:'Reading settings',exact:true}).click();await page.locator('[data-action="bundle-export"]').click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download private bundle',exact:true}).click();const file=path.join(output,`${engine}-${e.slug}-private-bundle.json`);await (await download).saveAs(file);const bundle=JSON.parse(await readFile(file));const original=await state(page,e);assert.deepEqual(bundle.state.notes,original.notes);assert.deepEqual(bundle.state.positions,original.positions);assert.deepEqual([...bundle.books].sort((a,b)=>a.id.localeCompare(b.id)),[...e.library].sort((a,b)=>a.id.localeCompare(b.id)),'complete exact editions, notices and embedded assets in bundle');await close(page);
 const fresh=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});fresh.setDefaultTimeout(20000);
 await watchContext(fresh);
 // A fresh address may have no supplied editions. Exercise actual book restoration,
 // rather than accepting the already-present hosted copies as a bundle restore.
 await fresh.route(`**/${e.slug}/library.json`,route=>route.fulfill({contentType:'application/json',body:'[]'}));
 const p=await fresh.newPage(),previousPage=activePage;activePage=p;
 try{await p.goto(base+'/'+e.slug+'/');await p.locator('main').waitFor();assert.equal((await state(p,e)).notes.length,0);await p.getByRole('button',{name:'Reading settings',exact:true}).click();await p.locator('#bundle-file').setInputFiles(file);await p.locator('[data-action="bundle-apply"]').waitFor();assert.equal((await state(p,e)).notes.length,0,'preview makes no writes');await p.locator('[data-action="bundle-apply"]').click();await p.locator('#dialog').waitFor({state:'hidden'});const restored=await state(p,e);assert.deepEqual(restored.notes,original.notes);assert.deepEqual(restored.positions,original.positions);const actual=await p.evaluate(async slug=>{const {rawBooks}=await import('/'+slug+'/db.mjs');return rawBooks();},e.slug);assert.deepEqual(actual.sort((a,b)=>a.id.localeCompare(b.id)),bundle.books.sort((a,b)=>a.id.localeCompare(b.id)));await p.goto(base+'/'+e.slug+'/#read/'+e.book+'/'+e.section);await notices(p);await ready(p,e.book,e.section);await surface(p,'#reading-text',e.library.find(b=>b.id===e.book).sections.find(s=>s.id===e.section).blocks);return {allExactEditions:true,previewNoWrites:true,exactNotesAndPositions:true,freshBrowserContext:true,missingSuppliedLibraryFixture:true};}finally{await fresh.close();activePage=previousPage;}
}

for(const engine of ['chromium','webkit']){
 let server=hosted?null:await serve();const port=server?.address().port,base=(hosted||'http://127.0.0.1:'+port).replace(/\/$/,'');
 const browser=await pw[engine].launch({headless:true,...(process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH']?{executablePath:process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH']}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});context.setDefaultTimeout(20000);context.setDefaultNavigationTimeout(30000);
 const pages=[],errors=[],nativeErrors=[],bad=[],network=[],transport=[];let online=true;
 const marker='Original reader error monitor control';let controlReported;
 const nativeControl=new Promise(resolve=>controlReported=resolve);
 const caughtLines=Object.fromEntries(await Promise.all(entries.map(async e=>{const lines=(await readFile(new URL(`dist/${e.slug}/app.mjs`,import.meta.url),'utf8')).split('\n');return[e.slug,{library:lines.findIndex(line=>line.includes(`fetch('/${e.slug}/library.json'`))+1,...(e.slug==='pictures-after-dark'?{folio:(await readFile(new URL('dist/pictures-after-dark/folio.mjs',import.meta.url),'utf8')).split('\n').findIndex(line=>line.includes(`fetch('/pictures-after-dark/folio.json'`))+1}: {})}];})));
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
    const folio=e.slug==='pictures-after-dark'&&first===`Fetch API cannot load ${base}/${e.slug}/folio.json due to access control checks.`&&error.stack.includes(`at loadFolio (${base}/${e.slug}/folio.mjs:${caughtLines[e.slug].folio}:`);return library||folio;
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
    const lock=JSON.parse(await readFile(new URL(`../examples/${e.directory}/edition-lock.json`,import.meta.url)));
    assert.equal(sha(bytes),lock.librarySha256,'mounted library matches exact standalone lock');
    e.library=JSON.parse(bytes);result.librarySha256=sha(bytes);
    const worker=await readFile(new URL(`dist/${e.slug}/sw.js`,import.meta.url),'utf8'),files=JSON.parse(worker.match(/const FILES=(\[[^\n]+\]);/)[1]);e.cachePins=await Promise.all(files.map(async assetPath=>{const b=await readFile(new URL('dist'+assetPath,import.meta.url));return {path:assetPath,bytes:b.length,sha256:sha(b)};}));
    if(e.slug==='pictures-after-dark')e.folio=await (await page.request.get(base+'/'+e.slug+'/folio.json')).json();
    await page.goto(base+'/'+e.slug+'/');await page.locator(e.shelf).waitFor();await notices(page);await page.locator('#offline-status').filter({hasText:'Available offline'}).waitFor({timeout:90000});
    for(const width of [320,390,820,1280]){await page.setViewportSize({width,height:width>=820?1000:844});await capture(page,`${engine}-${e.slug}-entrance-${width}`);}
   });
   result.sourcePage=await stage(engine,e.slug,'Mounted source page and exact notice routes',async()=>{const proof=await sourcePage(page,base,e);for(const width of [320,390,820,1280]){await page.setViewportSize({width,height:width>=820?1000:844});await capture(page,engine+'-'+e.slug+'-sources-'+width);}return {...proof,widths:[320,390,820,1280]};});
   result.source=await stage(engine,e.slug,'First, final and designated sampled section of every exact work',()=>sourceProof(page,base,e,e.library),150000);
   await stage(engine,e.slug,'Reading layouts',async()=>{for(const width of [320,390,820,1280]){await page.setViewportSize({width,height:width>=820?1000:844});await openSection(page,base,e,e.book,e.section);await capture(page,`${engine}-${e.slug}-reading-${width}`);}});
   result.contexts=await stage(engine,e.slug,'Exact companions, context return and focus',()=>contexts(page,base,e,engine),180000);
   result.note=await stage(engine,e.slug,'Selection, annotation and reload',()=>annotation(page,base,e));
   result.continuation=await stage(engine,e.slug,'Library Continue for every admitted work',()=>continuation(page,base,e));
   result.assets=await stage(engine,e.slug,'Scoped fonts, icons and worker',()=>scopedAssets(page,base,e));
   result.recovery=await stage(engine,e.slug,'Private bundle and exact fresh-browser recovery',()=>bundleRecovery(browser,page,base,e,engine,watchContext));
   receipt.cases.push(result);await save();
  }
  assert.equal(receipt.sourceNoticeActions.filter(n=>n.engine===engine).length,1,'one exact PG first-use notice in this browser');
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
   for(const {e,page}of pages)await stage(engine,e.slug,'Stopped-origin cold reload and negative network control',async()=>{activePage=page;await page.goto(`${base}/${e.slug}/#read/${e.book}/${e.section}`);await page.reload();await ready(page,e.book,e.section);await surface(page,'#reading-text',e.library.find(b=>b.id===e.book).sections.find(s=>s.id===e.section).blocks);assert.equal(await page.evaluate(async()=>{try{await fetch('/uncached-themed-reader-proof',{cache:'no-store',signal:AbortSignal.timeout(3000)});return false;}catch{return true;}}),true,'raw uncached network request fails while origin stopped');assert.equal((await state(page,e)).notes[0].note,`Mounted ${e.slug} recovery check.`);await page.goto(base+'/'+e.slug+'/#shelf');await page.reload();await page.locator(e.shelf).waitFor();await settledRender(page);await sourcePage(page,base,e);await page.reload();await page.getByRole('heading',{name:e.sourceHeading,exact:true,level:1}).waitFor();if(e.slug==='pictures-after-dark')assert.deepEqual(await imagePixels(page,'/pictures-after-dark/hugo-burg.jpg'),[300,216]);await capture(page,`${engine}-${e.slug}-stopped-origin`);receipt.cases.find(r=>r.engine===engine&&r.reader===e.slug).stoppedOrigin={coldReload:true,negativeRawNetwork:true,sourcePageReload:true,retainedNote:true,artwork:e.slug==='pictures-after-dark'};});
   // Finish stopped-page requests and queued diagnostics before changing the monitor phase.
   await Promise.all(pages.map(({page})=>page.waitForLoadState('networkidle')));
   await Promise.all(pages.map(({page})=>page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,250)))));await save();
   server=await serve(port);online=true;
   for(const {e,page}of pages)await stage(engine,e.slug,'Origin recovery with retained private records',async()=>{activePage=page;await page.goto(base+'/'+e.slug+'/');await page.locator(e.shelf).waitFor();await page.waitForLoadState('networkidle');await page.reload();await page.locator(e.shelf).waitFor();await page.waitForLoadState('networkidle');assert.ok((await page.request.get(base+'/'+e.slug+'/build.json?network=1')).ok(),'direct network request succeeds after origin recovery');assert.equal((await state(page,e)).notes[0].note,`Mounted ${e.slug} recovery check.`);receipt.cases.find(r=>r.engine===engine&&r.reader===e.slug).originRecovery=true;});
  }else for(const result of receipt.cases.filter(r=>r.engine===engine))result.stoppedOrigin={notAttempted:'Remote origin is not controlled by this test.'};
  await save();await stage(engine,'monitor','Final runtime monitoring after offline/recovery',async()=>{assert.deepEqual(errors,[],'runtime exceptions after offline/recovery');assert.deepEqual(nativeErrors,[],'native window errors and unhandled rejections after offline/recovery');});await save();
 }finally{await context.close();await browser.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
}
receipt.passed=true;delete receipt.current;await save();console.log(JSON.stringify({passed:true,cases:receipt.cases.length,output,mode:receipt.mode}));
