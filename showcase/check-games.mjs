import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {serve} from './serve.mjs';
import {buildShowcase} from './build.mjs';
if(!process.env.TEST_BASE&&!process.argv.includes('--skip-build'))await buildShowcase();
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
let server=process.env.TEST_BASE?null:await serve();
const localPort=server?.address().port;
const base=(process.env.TEST_BASE||'http://127.0.0.1:'+localPort).replace(/\/$/,'');
const out=new URL('../test-results/showcase/games/',import.meta.url);await mkdir(out,{recursive:true});
const entries=[
 {slug:'alice',book:'alice-rackham-28885',chapter:'chapter-01',start:'#primary-action',state:'#table',resume:'#primary-action',about:'#about',dialog:'#about-dialog',close:'#close-about'},
 {slug:'odyssey',book:'odyssey-butler-1727',chapter:'book-01',start:'#start',state:'#game',resume:'#again',about:'#story',dialog:'#source',close:'#source button'},
 {slug:'dracula',book:'dracula',chapter:'chap01',start:'#chapter-start',state:'#castle',resume:'#screen-action',about:'#about',dialog:'#notes',close:'#close-notes'}
];
const sizes=[[320,568],[320,740],[375,812],[390,844],[430,932],[768,1024],[1024,768],[874,402],[1440,1000]],receipts=[],problems=[];
const phase=(p,e)=>p.locator(e.state).evaluate(n=>n.dataset.phase||n.dataset.mode);
async function begin(page,e){
 await page.locator(e.start).tap();
 if(e.slug==='odyssey'){
  await page.locator('#day-start').waitFor();
  const intro=await page.locator(e.state).evaluate(n=>({...n.dataset}));
  await page.waitForTimeout(350);
  assert.deepEqual(await page.locator(e.state).evaluate(n=>({...n.dataset})),intro,'The sea waits during the day introduction');
  await page.locator('#day-start').tap();
 }
 await page.waitForTimeout(180);assert.equal(await phase(page,e),'playing');
}
async function dimensions(page,label){
 const r=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('button,a')].filter(n=>n.getClientRects().length&&!n.closest('dialog')&&!n.closest('noscript')&&getComputedStyle(n).visibility!=='hidden').map(n=>{const r=n.getBoundingClientRect();return{text:(n.textContent||n.getAttribute('aria-label')).trim().slice(0,40),x:r.x,y:r.y,w:r.width,h:r.height};})}));
 assert.ok(r.scroll<=r.width+1,label+' horizontal overflow');
 assert.deepEqual(r.targets.filter(t=>t.w<43.5||t.h<43.5),[],label+' small touch targets');
 assert.deepEqual(r.targets.filter(t=>t.x<-.5||t.x+t.w>r.width+.5||t.y<-.5||t.y+t.h>r.height+2),[],label+' controls outside viewport');
 if(label.endsWith('ready'))assert.ok(await page.locator('h1').evaluateAll(es=>es.every(e=>{const range=document.createRange();range.selectNodeContents(e);const b=range.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth})),label+' heading is fully visible');
 return r;
}
async function dismissNotice(page){
 if(await page.locator('#dialog[open]').count()){
  const notice=page.locator('[data-action="notice-read"]');
  if(await notice.isVisible())await notice.click();else await page.locator('#dialog [data-action="close"]').click();
  await page.locator('#dialog').waitFor({state:'hidden'});
 }
 if(await page.locator('[data-action="notice-dismiss"]').isVisible())await page.locator('[data-action="notice-dismiss"]').click();
}
const ready=page=>page.locator('#reading-text[data-position-ready="true"]').waitFor();
async function state(page,slug){return page.evaluate(async slug=>(await import('/'+slug+'/db.mjs')).loadState(),slug);}
async function launchFromReading(page){
 // Locator auto-scroll can move a sticky link's original flow box. Tap its
 // visible on-screen centre, as a finger does, without changing the saved place.
 await page.waitForTimeout(400); // Separate two page-changing touch gestures.
 const b=await page.locator('nav [data-action="play-game"]').boundingBox();
 assert.ok(b&&b.y>=0&&b.y+b.height<=page.viewportSize().height);
 await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);
}
try{
 for(const engine of (process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'])){
  const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'];
  const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  try{
   for(const [width,height]of (process.env.QA_PHASE==='returns'?[]:sizes))for(const e of entries){
    const context=await browser.newContext({viewport:{width,height},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],outside=[];
    page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    page.on('request',r=>{if(!r.url().startsWith(base+'/')&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))outside.push(r.url());});
    try{
     await page.goto(base+'/'+e.slug+'/play/');await page.locator(e.start).waitFor();await page.evaluate(()=>document.fonts.ready);
     await dimensions(page,engine+' '+e.slug+' '+width+' ready');
     await begin(page,e);
     await page.locator('#pause').tap();assert.equal(await phase(page,e),'paused');
     const held=await page.locator(e.state).evaluate(n=>({time:n.dataset.time,phase:n.dataset.phase,mode:n.dataset.mode}));await page.waitForTimeout(220);
     assert.deepEqual(await page.locator(e.state).evaluate(n=>({time:n.dataset.time,phase:n.dataset.phase,mode:n.dataset.mode})),held);
     await dimensions(page,engine+' '+e.slug+' '+width+' pause');
     await page.locator(e.resume).tap();assert.equal(await phase(page,e),'playing');
     if(e.slug==='odyssey')await page.locator('#pause').tap();
     await page.locator(e.about).tap();await page.locator(e.dialog).waitFor();assert.equal(await phase(page,e),'paused');
     await page.locator(e.close).first().tap();assert.equal(await phase(page,e),'paused');
     await page.locator(e.resume).tap();await page.waitForTimeout(300);
     await page.screenshot({path:new URL(engine+'-'+e.slug+'-'+width+'x'+height+'.png',out).pathname});
     await page.locator('#pause').tap();
     assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
     receipts.push({engine,slug:e.slug,width,height,layout:true,touchStartPauseResume:true,sourcePauses:true,externalRequests:0});
    }catch(error){problems.push({engine,slug:e.slug,width,height,error:error.message});console.log(JSON.stringify(problems.at(-1)));await page.screenshot({path:new URL('failure-'+engine+'-'+e.slug+'-'+width+'.png',out).pathname});}finally{await context.close();}
   }
   // Exercise the reader UI, a note, a scrolled position, game navigation,
   // and both surfaces without a network.
   for(const e of (process.env.QA_PHASE==='layouts'?[]:entries)){
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),page=await context.newPage();
    try{
     const route='#read/'+e.book+'/'+e.chapter;
     await page.goto(base+'/'+e.slug+'/'+route);await ready(page);await dismissNotice(page);
     await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Available offline'),null,{timeout:60000});
     await page.evaluate(()=>{const b=[...document.querySelectorAll('#reading-text [data-block]')].find(n=>n.textContent.length>80),walker=document.createTreeWalker(b,NodeFilter.SHOW_TEXT);let n;while((n=walker.nextNode())&&n.length<35){}const range=document.createRange();range.setStart(n,0);range.setEnd(n,30);getSelection().removeAllRanges();getSelection().addRange(range);});
     await page.locator('#selection-save').click();await page.locator('#note-text').fill('Preserve this reading note during a game.');await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
     await page.evaluate(()=>{getSelection().removeAllRanges();scrollTo(0,650);});await page.waitForTimeout(650);
     const before=await state(page,e.slug),y=await page.evaluate(()=>scrollY);
     await launchFromReading(page);await page.locator(e.start).waitFor();
     const back=page.locator('a[href="../'+route+'"]:visible');await back.first().waitFor({state:'visible',timeout:10000});assert.ok(await back.count());
     await begin(page,e);await page.locator('#pause').tap();
     await back.last().tap();await ready(page);
     const after=await state(page,e.slug);assert.deepEqual(after.notes,before.notes);assert.deepEqual(after.boundaries,before.boundaries);assert.deepEqual(after.positions,before.positions);
     assert.equal(new URL(page.url()).hash,route);const returnedY=await page.evaluate(()=>scrollY);assert.ok(Math.abs(returnedY-y)<60,e.slug+' reading scroll restored '+JSON.stringify({beforeY:y,returnedY,before:before.positions,after:after.positions}));
     // This WebKit build reports an internal error for cached navigations with
     // setOffline(). Stopping the local origin tests a real outage instead.
     // Production WebKit uses that local evidence plus exact deployed bytes.
     const offlineMode=engine==='webkit'?(process.env.TEST_BASE?'verified-at-stopped-local-origin':'stopped-origin'):'browser-offline';
     if(offlineMode!=='verified-at-stopped-local-origin'){
      if(offlineMode==='stopped-origin'){server.closeAllConnections();await new Promise(r=>server.close(r));server=null;}
      else await context.setOffline(true);
      await launchFromReading(page);await page.locator(e.start).waitFor();await page.reload();await page.locator(e.start).waitFor();
      await begin(page,e);await page.locator('#pause').tap();
      assert.equal(await page.evaluate(async()=>{try{await fetch('/uncached-game-control-'+Date.now(),{signal:AbortSignal.timeout(4000)});return false;}catch{return true;}}),true);
      await page.locator('a[href="../'+route+'"]:visible').last().tap();await ready(page);await page.reload();await ready(page);
      assert.deepEqual((await state(page,e.slug)).notes,before.notes);
     }
     receipts.push({engine,slug:e.slug,readerRoundTrip:true,notesUnchanged:true,readingPlaceRestored:true,offlineMode,offlineGameReloadAndPlay:offlineMode!=='verified-at-stopped-local-origin',offlineReaderReturn:offlineMode!=='verified-at-stopped-local-origin'});
    }catch(error){console.log(JSON.stringify({engine,slug:e.slug,url:page.url(),error:error.message}));await page.screenshot({path:new URL('return-failure-'+engine+'-'+e.slug+'.png',out).pathname});throw error;}finally{await context.close();if(!server&&!process.env.TEST_BASE)server=await serve(localPort);}
   }
   for(const e of entries){const c=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:740}}),p=await c.newPage();await p.goto(base+'/'+e.slug+'/play/');assert.match(await p.locator('noscript').textContent(),/needs JavaScript/);const back=p.locator('noscript a');await back.waitFor();assert.equal(await back.getAttribute('href'),'../');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await p.locator('button:visible').count(),0,'No inert game controls without JavaScript');await p.screenshot({path:new URL(engine+'-'+e.slug+'-no-js.png',out).pathname});await c.close()}
   console.log(engine+': game checks passed for '+(process.env.QA_PHASE||'layouts and reader roundtrips')+'.');
  }finally{await browser.close();}
 }
 await writeFile(new URL('receipt.json',out),JSON.stringify({checkedAt:new Date().toISOString(),base,passed:!problems.length,receipts,problems,limits:'Browser emulation in Chromium and WebKit; no physical-device or screen-reader playthrough. Full win/loss journeys are checked separately.'},null,2)+'\n');
 assert.deepEqual(problems,[]);
}finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
