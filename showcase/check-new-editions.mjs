// The three 21 October editions at their mounted addresses, sharing one origin.
// Their standalone journeys cover the bespoke companions and bundle recovery.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {serve} from './serve.mjs';
import {buildShowcase} from './build.mjs';
import {settledRender} from '../tests/experience-browser.mjs';
if(!process.argv.includes('--skip-build'))await buildShowcase();
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const entries=[
 {slug:'nietzsche',book:'nietzsche',section:'book-1',next:'book-2',shelf:'.company-entrance',companion:'#companion',companionText:'Epicurus'},
 {slug:'mountains',book:'conway-alps-1904',section:'chapter-01',next:'chapter-02',shelf:'.mountain-entrance',companion:'#companion',companionText:'Snow'},
 {slug:'war-and-peace',book:'war-and-peace-maude',section:'part-01-chapter-01',next:'part-01-chapter-02',shelf:'.book-entrance',companion:'#companion',companionText:'Pictures'},
];
const out=new URL('../test-results/new-editions/',import.meta.url);await mkdir(out,{recursive:true});
const receipt={checkedAt:new Date().toISOString(),passed:false,cases:[],limits:'Chromium/WebKit emulation, source bytes and stopped-origin reloads; not physical Home Screen or native touch acceptance.'};
const save=()=>writeFile(new URL('receipt.json',out),JSON.stringify(receipt,null,2)+'\n');
await save();
async function bounded(promise,ms,label){
 let timer;
 try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} exceeded ${ms}ms`)),ms);})]);}
 finally{clearTimeout(timer);}
}
async function stage(engine,e,label,run,ms=45000){
 const started=Date.now();
 receipt.currentStage={engine,reader:e?.slug??'all',label,startedAt:new Date(started).toISOString()};await save();
 console.log(`[${engine}/${receipt.currentStage.reader}] ${label}`);
 try{
  const result=await bounded(Promise.resolve().then(run),ms,`${engine}/${receipt.currentStage.reader}: ${label}`);
  receipt.currentStage.elapsedMs=Date.now()-started;await save();return result;
 }catch(error){receipt.failure={...receipt.currentStage,elapsedMs:Date.now()-started,message:error.message};await save();throw error;}
}
const ready=(p,e,section=e.section)=>p.locator(`#reading-text[data-book="${e.book}"][data-section="${section}"][data-position-ready="true"]`).waitFor();
async function dismissNotice(page){
 if(!await page.locator('#dialog[open]').count())return;
 const controls=page.locator('#dialog [data-action="notice-continue"],#dialog [data-action="notice-read"]');
 if(await controls.count())await controls.first().click();else await page.locator('#dialog [data-action="close"]').first().click();
 await page.locator('#dialog').waitFor({state:'hidden'});
}
async function source(page,e,section=e.section){
 const library=JSON.parse(await readFile(new URL(`dist/${e.slug}/library.json`,import.meta.url)));
 const blocks=library.find(b=>b.id===e.book).sections.find(s=>s.id===section).blocks.filter(b=>typeof b.text==='string');
 for(const block of blocks){
  const actual=await page.locator(`#reading-text [data-block="${block.id}"]`).textContent();
  assert.equal(actual,block.text,`${e.slug}/${section}/${block.id}: exact rendered source`);
 }
}
async function layout(page,label){
 await settledRender(page);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' horizontal overflow');
}
// Mountains settings must retain source characters even after a manual scroll.
const mountainsState=p=>p.evaluate(()=>import('/mountains/db.mjs').then(m=>m.loadState()));
async function mountainsPoll(check,message){for(let i=0;i<100;i++){if(await check())return;await new Promise(r=>setTimeout(r,70));}throw Error(message);}
async function mountainsTap(p,locator){const r=await locator.boundingBox();assert.ok(r&&r.y>=0&&r.y+r.height<=p.viewportSize().height);await p.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}
async function mountainsCharacterGeometry(p,pos){return p.evaluate(pos=>{const el=document.querySelector(`#reading-text [data-block="${pos.blockId}"]`),walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n,off=pos.offset;while((n=walk.nextNode())){if(off<n.length){const r=document.createRange();r.setStart(n,off);r.setEnd(n,off+1);const q=r.getBoundingClientRect(),edge=Math.max(0,document.querySelector('.reader-tools').getBoundingClientRect().bottom)+20;return{character:n.textContent[off],top:q.top,edge,inset:q.top-edge};}off-=n.length;}throw Error('Saved source character is unavailable');},pos);}
async function mountainsTypeChanges(browser,base,e){
 const checks=[];
 for(const presets of [[],['large'],['large','paper','dusk']]){
  const context=await browser.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true,serviceWorkers:'block'}),p=await context.newPage();
  try{
   await p.goto(`${base}/mountains/#read/${e.book}/chapter-02`);await ready(p,e,'chapter-02');await dismissNotice(p);await settledRender(p);
   // Start after a genuine scroll, not a restoration that already cached the anchor.
   await p.evaluate(()=>{const el=document.querySelector('#reading-text [data-block="b0155"]'),walk=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n,offset=2600;while((n=walk.nextNode())){if(offset<n.length){const r=document.createRange();r.setStart(n,offset);r.setEnd(n,offset+1);scrollTo(0,scrollY+r.getBoundingClientRect().top-document.querySelector('.reader-tools').getBoundingClientRect().bottom-20);return;}offset-=n.length;}throw Error('Review character unavailable');});
   await mountainsPoll(async()=>{const pos=(await mountainsState(p)).positions[e.book];return pos?.blockId==='b0155'&&Number.isInteger(pos.offset);},'Scrolled character was not saved');
   const before=(await mountainsState(p)).positions[e.book],geometry=await mountainsCharacterGeometry(p,before),presetGeometry=[];
   await mountainsTap(p,p.locator('[data-action="settings"]'));
   for(const preset of presets){
    await p.locator(`[data-preset="${preset}"]`).click();
    await mountainsPoll(async()=>(await mountainsState(p)).prefs.size===({large:29,paper:21,dusk:22})[preset],'Preset did not apply');
    await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.locator('#reading-text[data-position-ready="true"]').waitFor();
    const g=await mountainsCharacterGeometry(p,before);assert.ok(Math.abs(g.inset-geometry.inset)<=2,JSON.stringify({preset,before,geometry,g}));presetGeometry.push({preset,...g});
   }
   await p.locator('#size').press('End');assert.equal(await p.locator('#size').inputValue(),'36');await p.getByRole('button',{name:'Apply to my reader',exact:true}).click();await p.locator('#dialog').waitFor({state:'hidden'});await p.locator('#reading-text[data-position-ready="true"]').waitFor();
   const afterGeometry=await mountainsCharacterGeometry(p,before);assert.ok(Math.abs(afterGeometry.inset-geometry.inset)<=2,JSON.stringify({presets,before,geometry,afterGeometry}));
   // A subsequent action must persist the exact anchor, not a coarse paragraph ratio.
   await mountainsTap(p,p.locator('[data-action="background"]'));await p.locator('#dialog-title').waitFor();await mountainsPoll(async()=>Number.isInteger((await mountainsState(p)).positions[e.book]?.offset),'Custom size lost the saved character');const after=(await mountainsState(p)).positions[e.book];assert.deepEqual(after,before);
   await p.locator('.close-dialog').click();await p.locator('#dialog').waitFor({state:'hidden'});await p.reload();await p.locator('#reading-text[data-position-ready="true"]').waitFor();assert.equal(await p.locator('[data-edition-notice]').count(),0);const reloaded=await mountainsCharacterGeometry(p,before);assert.ok(Math.abs(reloaded.inset-geometry.inset)<=2,JSON.stringify({before,reloaded}));
   checks.push({presets,before,geometry,presetGeometry,afterGeometry,after,reloaded});
  }finally{await context.close();}
 }
 return checks;
}
async function mountainsFirstCompanion(browser,base,e){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await context.newPage();
 try{
  const library=await (await p.request.get(`${base}/mountains/library.json`)).json(),book=library.find(b=>b.id===e.book),licence=book.sections.at(-1).blocks[0].text;
  const start=licence.indexOf('This eBook is for the use of anyone anywhere',licence.indexOf('1.E.1.')),notice=licence.slice(start,licence.indexOf('\n\n1.E.2.',start));
  await p.goto(`${base}/mountains/#companion`);await p.locator('[data-edition-notice]').waitFor();assert.equal(await p.locator('[data-edition-notice]').textContent(),notice);assert.equal(await p.locator('[data-study-excerpt]').count(),0);
  await p.getByRole('button',{name:'Continue to reading',exact:true}).click();await p.locator('[data-action="study"]').first().click();await p.locator('[data-action="allow-study"]').click();await p.locator('[data-study-excerpt]').first().waitFor();assert.equal(await p.locator('[data-study-excerpt]').count(),3);
  await p.locator('[data-action="study-context"]').click();await p.locator('#context-text[data-location-ready="true"]').waitFor();assert.equal(await p.locator('#context-text').textContent(),book.sections.find(s=>s.id==='chapter-02').blocks.map(b=>b.text+b.after).join(''));await p.locator('.close-dialog').click();
  await p.reload();await p.locator('.plate-cabinet').waitFor();assert.equal(await p.locator('[data-edition-notice]').count(),0);
  await p.goto(`${base}/mountains/#read/${e.book}/chapter-02`);await ready(p,e,'chapter-02');assert.equal(await p.locator('[data-edition-notice]').count(),0);
  await p.goto(`${base}/mountains/#companion`);await p.locator('.plate-cabinet').waitFor();assert.equal(await p.locator('[data-edition-notice]').count(),0);
  return {directCompanionNotice:true,exactNotice:true,fullStudyContext:true,rememberedAcrossReloadAndRead:true};
 }finally{await context.close();}
}
for(const engine of ['chromium','webkit']){
 let server=await serve();const port=server.address().port,base='http://127.0.0.1:'+port;
 const browser=await pw[engine].launch({headless:true,...((engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH)?{executablePath:engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),pages=[],errors=[],bad=[];
 context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(30000);
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 context.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url());});
 try{
  for(const e of entries){
   let mountainsRegressions;
   if(e.slug==='mountains')mountainsRegressions=await stage(engine,e,'First Plates notice and exact type-change anchors',async()=>({notice:await mountainsFirstCompanion(browser,base,e),typeChanges:await mountainsTypeChanges(browser,base,e)}),90000);
   const page=await context.newPage();pages.push(page);
   await stage(engine,e,'Entrance and offline cache',async()=>{
    await page.goto(`${base}/${e.slug}/`);await page.locator(e.shelf).waitFor();await dismissNotice(page);
    await page.locator('#offline-status').filter({hasText:'Available offline'}).waitFor({timeout:90000});
   },105000);
   for(const width of [320,390,768,1440]){
    await stage(engine,e,'Entrance '+width,async()=>{
     await page.setViewportSize({width,height:width===1440?1000:844});await layout(page,e.slug+' entrance '+width);
     await page.screenshot({path:new URL(`${engine}-${e.slug}-entrance-${width}.png`,out).pathname});
    });
   }
   await stage(engine,e,'Exact source and reading layout',async()=>{
    await page.goto(`${base}/${e.slug}/#read/${e.book}/${e.section}`);await ready(page,e);await dismissNotice(page);await source(page,e);await layout(page,e.slug+' source');
   });
   await stage(engine,e,'Save annotation and reopen',async()=>{
   await page.setViewportSize({width:390,height:844});
   await page.evaluate(()=>{const b=[...document.querySelectorAll('#reading-text [data-block]')].find(e=>e.textContent.length>80),w=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())&&n.length<40){}const r=document.createRange();r.setStart(n,0);r.setEnd(n,30);getSelection().removeAllRanges();getSelection().addRange(r);});
   await page.locator('#selection-save').click();await page.locator('#note-text').fill(`Original ${e.slug} mounting check.`);await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
   await page.reload();await ready(page,e);assert.equal(await page.locator('#dialog[open]').count(),0,e.slug+' does not repeat notice');
   });
   await stage(engine,e,'Companion preserves reading place',async()=>{
   const before=await page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),e.slug);
   await page.goto(`${base}/${e.slug}/${e.companion}`);await page.waitForFunction(()=>!document.querySelector('#reading-text'));
   assert.match(await page.locator('main').innerText(),new RegExp(e.companionText,'i'));await layout(page,e.slug+' companion');
   await page.screenshot({path:new URL(`${engine}-${e.slug}-companion.png`,out).pathname});
   const after=await page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),e.slug);assert.deepEqual(after.positions,before.positions);
   });
   await stage(engine,e,'Scoped icon and worker',async()=>{
   const manifest=await (await page.request.get(`${base}/${e.slug}/manifest.webmanifest`)).json();for(const k of ['id','scope','start_url'])assert.equal(manifest[k],'/'+e.slug+'/');
   const apple=await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');assert.equal(apple,'/'+e.slug+'/apple-touch-icon.png');
   const dims=await page.evaluate(async src=>{const im=new Image();im.src=src;await im.decode();return [im.naturalWidth,im.naturalHeight]},apple);assert.deepEqual(dims,[180,180]);
   assert.equal(await page.evaluate(()=>new URL(navigator.serviceWorker.controller.scriptURL).pathname),'/'+e.slug+'/sw.js');
   });
   receipt.cases.push({engine,reader:e.slug,...(mountainsRegressions?{mountainsRegressions}:{}),entranceWidths:[320,390,768,1440],exactSource:true,savedNote:true,companionPreservesPlace:true,scopedIconAndWorker:true});await save();
  }
  assert.deepEqual(await pages[0].evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).map(r=>new URL(r.scope).pathname).sort()),entries.map(e=>'/'+e.slug+'/').sort());
  const names=await pages[0].evaluate(async()=>(await indexedDB.databases()).map(d=>d.name));for(const e of entries)assert.ok(names.includes('newreading-'+e.slug+'-v1'));
  server.closeAllConnections();await new Promise(r=>server.close(r));server=null;
  for(const [i,e]of entries.entries()){
   await stage(engine,e,'Stopped-origin source, artwork, icon and saved note',async()=>{
   const page=pages[i];await page.goto(`${base}/${e.slug}/#read/${e.book}/${e.next}`);await page.reload();await ready(page,e,e.next);await source(page,e,e.next);await layout(page,e.slug+' offline');
   assert.equal(await page.evaluate(async()=>{try{await fetch('/uncached-proof',{signal:AbortSignal.timeout(3000)});return false}catch{return true}}),true);
   const state=await page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),e.slug);assert.equal(state.notes.length,1);assert.equal(state.notes[0].note,`Original ${e.slug} mounting check.`);
   await page.goto(`${base}/${e.slug}/#shelf`);await page.reload();await page.locator(e.shelf).waitFor();await settledRender(page);
   const apple=await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');assert.equal(await page.evaluate(async src=>(await fetch(src)).ok,apple),true);
   receipt.cases.find(c=>c.engine===engine&&c.reader===e.slug).stoppedOriginTextArtIconAndNote=true;
   });
  }
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);await save();
 }finally{await context.close();await browser.close();if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
}
receipt.passed=true;await save();console.log(JSON.stringify(receipt));
