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
for(const engine of ['chromium','webkit']){
 let server=await serve();const port=server.address().port,base='http://127.0.0.1:'+port;
 const browser=await pw[engine].launch({headless:true,...((engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH)?{executablePath:engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),pages=[],errors=[],bad=[];
 context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(30000);
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 context.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url());});
 try{
  for(const e of entries){
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
   receipt.cases.push({engine,reader:e.slug,entranceWidths:[320,390,768,1440],exactSource:true,savedNote:true,companionPreservesPlace:true,scopedIconAndWorker:true});await save();
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
