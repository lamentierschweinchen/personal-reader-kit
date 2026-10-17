import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {serve} from './serve.mjs';
import {buildShowcase} from './build.mjs';
if(!process.argv.includes('--skip-build'))await buildShowcase();
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=Number(process.env.SHOWCASE_TEST_PORT||4321),base='http://127.0.0.1:'+port,out=new URL('../test-results/showcase/readers/',import.meta.url);await mkdir(out,{recursive:true});
const entries=[['austen','austen-pride-1894','chapter-1','chapter-2'],['alice','alice-rackham-28885','chapter-01','chapter-02'],['walden','walden','chap02','chap03'],['two-halls','hegel','section-3','section-4']];
const result={checkedAt:new Date().toISOString(),passed:false,browsers:[],limits:'Combined-site developer check in Chromium/WebKit. Real stopped-origin reloads; not native home-screen installation, physical iOS or deployed HTTPS verification.'};
const save=()=>writeFile(new URL('receipt.json',out),JSON.stringify(result,null,2)+'\n');
const ready=(p,b,s)=>p.locator(`#reading-text[data-book="${b}"][data-section="${s}"][data-position-ready="true"]`).waitFor();
for(const engine of ['chromium','webkit']){
 let server=await serve(port),browser;
 try{
  browser=await pw[engine].launch({headless:true,...((engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH)?{executablePath:engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH}:{})});
  const context=await browser.newContext({viewport:{width:402,height:874}}),pages=[],errors=[],requests=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));context.on('request',r=>requests.push(r.url()));
  for(const [slug,book,first] of entries){
   const page=await context.newPage();pages.push(page);const url=base+'/'+slug+'/';await page.goto(url+'#read/'+book+'/'+first);await ready(page,book,first);
   if(slug==='alice'&&await page.locator('#dialog[open]').count())await page.getByRole('button',{name:'Close ×',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Available offline'),{},{timeout:60000});
   const canonical=JSON.parse(await readFile(new URL('dist/'+slug+'/library.json',import.meta.url))).find(b=>b.id===book).sections.find(s=>s.id===first).blocks.map(b=>b.text+b.after).join('');
   assert.equal(await page.locator('#reading-text').textContent(),canonical);
   await page.evaluate(()=>{const block=[...document.querySelectorAll('#reading-text [data-block]')].find(e=>e.textContent.length>60),walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let n;while((n=walker.nextNode())&&n.length<35){};const r=document.createRange();r.setStart(n,0);r.setEnd(n,30);getSelection().removeAllRanges();getSelection().addRange(r);});
   await page.locator('#selection-save').click();await page.locator('#note-text').fill('Original '+slug+' combined-site test note.');await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
   await page.reload();await ready(page,book,first);
   assert.equal(await page.evaluate(()=>new URL(navigator.serviceWorker.controller.scriptURL).pathname),'/'+slug+'/sw.js');
   const manifest=await (await page.request.get(url+'manifest.webmanifest')).json();assert.equal(manifest.scope,'/'+slug+'/');assert.equal(manifest.start_url,'/'+slug+'/');assert.equal(manifest.id,'/'+slug+'/');
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));});
   await page.screenshot({path:new URL(engine+'-'+slug+'.png',out).pathname});
   const beforeExit=await page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),slug);
   assert.equal(await page.locator('#catalogue-return').isVisible(),false,'Catalogue link stays outside reading');
   await page.locator('[data-nav="shelf"]').click();await page.locator('#catalogue-return').waitFor();
   assert.equal(await page.locator('#catalogue-return').getAttribute('href'),'https://newreading.app/');
   // Production is same-origin. Only map the production entrance to this test server.
   await page.locator('#catalogue-return').evaluate((a,base)=>a.href=base+'/',base);
   await page.locator('#catalogue-return').click();await page.locator('.hero').waitFor();
   await page.goBack();await page.locator('#catalogue-return').waitFor();
   const afterExit=await page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),slug);
   assert.deepEqual(afterExit.notes,beforeExit.notes,'Catalogue roundtrip preserves notes');
   assert.deepEqual(afterExit.positions,beforeExit.positions,'Catalogue roundtrip preserves reading places');
   await page.goto(url+'#read/'+book+'/'+first);await ready(page,book,first);

  }
  const cacheKeys=await pages[0].evaluate(()=>caches.keys());assert.equal(cacheKeys.length,4);for(const [slug]of entries)assert.equal(cacheKeys.filter(k=>k.startsWith('newreading-'+slug+'-')).length,1);
  const scopes=await pages[0].evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).map(r=>new URL(r.scope).pathname).sort());assert.deepEqual(scopes,entries.map(e=>'/'+e[0]+'/').sort());
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;
  for(let i=0;i<entries.length;i++){
   const [slug,book,first,next]=entries[i],page=pages[i];await page.reload();await ready(page,book,first);
   assert.equal(await page.evaluate(async()=>{try{await fetch('/uncached-'+Date.now(),{signal:AbortSignal.timeout(5000)});return false}catch{return true}}),true);
   let state=await page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),slug);assert.equal(state.notes.length,1);assert.equal(state.notes[0].note,'Original '+slug+' combined-site test note.');
   await page.locator('[data-nav="companion"]').click();await page.waitForFunction(()=>location.hash==='#companion'&&!document.querySelector('#reading-text'));
   await page.goto(base+'/'+slug+'/#read/'+book+'/'+next);await ready(page,book,next);
   await page.locator('[data-nav="passages"]').click();await page.locator('[data-action="edit-note"]').first().click();
   await page.locator('#note-text').fill('Saved offline in '+slug);await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
   await page.goto(base+'/'+slug+'/#read/'+book+'/'+next);await ready(page,book,next);
   await page.reload();await ready(page,book,next);state=await page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),slug);assert.equal(state.notes.length,1);assert.equal(state.notes[0].note,'Saved offline in '+slug);
  }
  assert.deepEqual(errors,[]);assert.equal(requests.filter(u=>!u.startsWith(base)&&!u.startsWith('data:')&&!u.startsWith('blob:')).length,0);
  assert.equal(requests.filter(u=>['/app.mjs','/db.mjs','/library.json','/sw.js'].includes(new URL(u).pathname)).length,0);
  result.browsers.push({engine,readers:4,independentCaches:4,independentScopes:4,independentNotes:true,catalogueRoundTrips:4,exactFirstSections:true,stoppedOriginReloads:8,offlineChapterAndCompanion:true,offlineWritesPersist:true,manifestInstallPaths:true,externalRequests:0});await save();console.log(engine+': four readers share one origin without cache or storage collisions; stopped-origin reading and saves passed.');
 }catch(error){result.failure=error.stack;await save();throw error}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await browser?.close();}
}
result.passed=true;await save();
