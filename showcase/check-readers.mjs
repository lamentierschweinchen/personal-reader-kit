import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {serve} from './serve.mjs';
import {buildShowcase} from './build.mjs';
if(!process.argv.includes('--skip-build'))await buildShowcase();
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=Number(process.env.SHOWCASE_TEST_PORT||4321),base='http://127.0.0.1:'+port,out=new URL('../test-results/showcase/readers/',import.meta.url);await mkdir(out,{recursive:true});
const entries=[['austen','austen-pride-1894','chapter-1','chapter-2'],['alice','alice-rackham-28885','chapter-01','chapter-02'],['walden','walden','chap02','chap03'],['two-halls','hegel','section-3','section-4'],['odyssey','odyssey-butler-1727','book-01','book-02'],['dracula','dracula','chap01','chap02']];
const result={checkedAt:new Date().toISOString(),passed:false,browsers:[],limits:'Combined-site developer check in Chromium/WebKit. Real stopped-origin reloads; not native home-screen installation, physical iOS or deployed HTTPS verification.'};
const save=()=>writeFile(new URL('receipt.json',out),JSON.stringify(result,null,2)+'\n');
const ready=(p,b,s)=>p.locator(`#reading-text[data-book="${b}"][data-section="${s}"][data-position-ready="true"]`).waitFor();
async function stableChrome(page,label){
 const heights=await page.evaluate(async()=>{const values=[];for(let i=0;i<12;i++){await new Promise(requestAnimationFrame);values.push(document.querySelector('.masthead').getBoundingClientRect().height)}return values});
 assert.ok(Math.max(...heights)-Math.min(...heights)<.1,label+' header stays still between frames: '+heights);
}

for(const engine of ['chromium','webkit']){
 let server=await serve(port),browser;
 try{
  browser=await pw[engine].launch({headless:true,...((engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH)?{executablePath:engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH}:{})});
  const context=await browser.newContext({viewport:{width:402,height:874}}),pages=[],errors=[],requests=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));context.on('request',r=>requests.push(r.url()));
  for(const [slug,book,first] of entries){
   const page=await context.newPage();pages.push(page);const url=base+'/'+slug+'/';await page.goto(url+'#read/'+book+'/'+first);await ready(page,book,first);
   if(await page.locator('#dialog[open]').count()){
    const notice=page.locator('[data-action="notice-read"]');
    if(await notice.isVisible())await notice.click();
    else await page.locator('#dialog [data-action="close"]').click();
    await page.locator('#dialog').waitFor({state:'hidden'});
   }
   await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Available offline'),{},{timeout:60000});
   const canonical=JSON.parse(await readFile(new URL('dist/'+slug+'/library.json',import.meta.url))).find(b=>b.id===book).sections.find(s=>s.id===first).blocks.map(b=>b.text+b.after).join('');
   assert.equal(await page.locator('#reading-text').textContent(),canonical);
   await stableChrome(page,slug+' normal type');
   for(const width of [320,390]){
    await page.setViewportSize({width,height:844});await page.evaluate(()=>document.fonts.ready);
    await page.locator('[data-action="settings"]').first().click();
    await page.evaluate(()=>Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished)));
    await page.locator('#dialog[open] #settings-form').waitFor();
    const menuHeights=await page.locator('#settings-form select').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
    assert.ok(menuHeights.length>0&&menuHeights.every(h=>h>=43.5),slug+' settings menus retain full touch targets: '+menuHeights);
    await page.locator('#dialog [data-action="close"]').click();
    await page.evaluate(()=>{const es=[...document.querySelectorAll('body,body *')],sizes=es.map(e=>parseFloat(getComputedStyle(e).fontSize));window.zoomRestore=es.map(e=>[e,e.style.fontSize]);es.forEach((e,i)=>e.style.fontSize=sizes[i]*2+'px')});
    await page.waitForTimeout(100);
    await stableChrome(page,slug+' enlarged type');
    assert.ok(await page.locator('.masthead').evaluate(e=>{const a=e.querySelector('.wordmark').getBoundingClientRect(),b=e.querySelector('.type-button').getBoundingClientRect();return b.top>=a.bottom-1||b.left>=a.right+3}),slug+' settings target clears the title');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),slug+' reflows at 200% text on '+width+'px');
    assert.ok(await page.locator('.masthead').evaluate(e=>{const brand=e.querySelector('.wordmark').getBoundingClientRect(),nav=e.querySelector('nav').getBoundingClientRect();return nav.top>=brand.bottom-1||nav.left>=brand.right}),slug+' navigation does not overlap its title');
    await page.screenshot({path:new URL(engine+'-'+slug+'-'+width+'-text-200.png',out).pathname});
    await page.evaluate(()=>{for(const[e,size]of window.zoomRestore)e.style.fontSize=size;delete window.zoomRestore});
   }
   await page.setViewportSize({width:402,height:874});await page.waitForTimeout(100);
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
  const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});
  for(const [slug]of entries){const p=await noJS.newPage();await p.goto(base+'/'+slug+'/');assert.equal(await p.locator('.loading').isVisible(),false);assert.equal(await p.locator('#offline-status').isVisible(),false);await p.locator('noscript .catalogue-return').waitFor();assert.match(await p.locator('noscript').textContent(),/needs JavaScript/);await p.screenshot({path:new URL(engine+'-'+slug+'-no-js.png',out).pathname});await p.close()}
  await noJS.close();
  const cacheKeys=await pages[0].evaluate(()=>caches.keys());assert.equal(cacheKeys.length,entries.length);for(const [slug]of entries)assert.equal(cacheKeys.filter(k=>k.startsWith('newreading-'+slug+'-')).length,1);
  const scopes=await pages[0].evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).map(r=>new URL(r.scope).pathname).sort());assert.deepEqual(scopes,entries.map(e=>'/'+e[0]+'/').sort());
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;
  for(let i=0;i<entries.length;i++){
   const [slug,book,first,next]=entries[i],page=pages[i];await page.reload();await ready(page,book,first);
   assert.equal(await page.evaluate(async()=>{try{await fetch('/uncached-'+Date.now(),{signal:AbortSignal.timeout(5000)});return false}catch{return true}}),true);
   let state=await page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),slug);assert.equal(state.notes.length,1);assert.equal(state.notes[0].note,'Original '+slug+' combined-site test note.');
   await page.goto(base+'/'+slug+'/#companion');await page.waitForFunction(()=>location.hash==='#companion'&&!document.querySelector('#reading-text'));
   await page.goto(base+'/'+slug+'/#read/'+book+'/'+next);await ready(page,book,next);
   await page.locator('[data-nav="passages"]').click();await page.locator('[data-action="edit-note"]').first().click();
   await page.locator('#note-text').fill('Saved offline in '+slug);await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
   await page.goto(base+'/'+slug+'/#read/'+book+'/'+next);await ready(page,book,next);
   await page.reload();await ready(page,book,next);state=await page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),slug);assert.equal(state.notes.length,1);assert.equal(state.notes[0].note,'Saved offline in '+slug);
  }
  assert.deepEqual(errors,[]);assert.equal(requests.filter(u=>!u.startsWith(base)&&!u.startsWith('data:')&&!u.startsWith('blob:')).length,0);
  assert.equal(requests.filter(u=>['/app.mjs','/db.mjs','/library.json','/sw.js'].includes(new URL(u).pathname)).length,0);
  result.browsers.push({engine,readers:entries.length,independentCaches:entries.length,independentScopes:entries.length,independentNotes:true,catalogueRoundTrips:entries.length,exactFirstSections:true,stoppedOriginReloads:entries.length*2,offlineChapterAndCompanion:true,offlineWritesPersist:true,manifestInstallPaths:true,externalRequests:0});await save();console.log(engine+': six readers share one origin without cache or storage collisions; stopped-origin reading and saves passed.');
 }catch(error){result.failure=error.stack;await save();throw error}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await browser?.close();}
}
result.passed=true;await save();
