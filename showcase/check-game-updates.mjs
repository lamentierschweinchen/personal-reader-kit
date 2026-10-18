// Exercise the browser's real worker lifecycle. No test calls registration.update().
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {buildShowcase} from './build.mjs';
if(!process.argv.includes('--skip-build'))await buildShowcase();
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=new URL('../test-results/showcase/game-updates/',import.meta.url);await mkdir(out,{recursive:true});
const entries=[
 {slug:'alice',state:'#table',start:'#primary-action',resume:'#primary-action'},
 {slug:'odyssey',state:'#game',start:'#start',resume:'#again'},
 {slug:'dracula',state:'#castle',start:'#chapter-start',resume:'#screen-action'}
];
const types={html:'text/html',mjs:'text/javascript',js:'text/javascript',json:'application/json',svg:'image/svg+xml',css:'text/css',woff2:'font/woff2'};
const receipts=[];
for(const engine of (process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'])){
 const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'];
 const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
 try{for(const e of entries){
  let revision=1,workerRequests=0;
  const server=createServer(async(req,res)=>{
   try{
    let name=new URL(req.url,'http://localhost').pathname;
    if(!name.startsWith('/'+e.slug+'/')||name.includes('..'))throw Error('Outside fixture');
    if(name.endsWith('/'))name+='index.html';
    let bytes=await readFile(new URL('./dist'+name,import.meta.url));
    if(name.endsWith('/sw.js')){
     workerRequests++;
     bytes=Buffer.from(bytes.toString().replace(/CACHE=PREFIX\+"[^"]+"/,'CACHE=PREFIX+"update-fixture-'+revision+'"'));
    }
    if(name.endsWith('/play/index.html'))bytes=Buffer.from(bytes.toString().replace('<html ','<html data-update-fixture="'+revision+'" '));
    res.writeHead(200,{'Content-Type':types[name.split('.').at(-1)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
   }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
   await page.goto(base+'/'+e.slug+'/play/');await page.locator(e.start).waitFor();
   await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60000});
   assert.equal(await page.locator('#game-update').count(),0,'First offline installation is not an update');
   // Alice stays on its first visit, which becomes controlled after installation.
   // The other two start with an existing controller, like a returning player.
   if(e.slug!=='alice'){await page.reload();await page.locator(e.start).waitFor();}
   await page.locator(e.start).tap();if(e.slug==='odyssey')await page.locator('#day-start').tap();
   await page.locator('#pause').tap();
   const held=await page.locator(e.state).evaluate(n=>({time:n.dataset.time,phase:n.dataset.phase,mode:n.dataset.mode}));
   const storage=await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));
   // A different tab and return is an ordinary user action, not a worker API.
   const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();
   revision=2;
   await page.bringToFront();
   await page.getByRole('button',{name:'Reload game',exact:true}).waitFor({timeout:75000});
   assert.deepEqual(await page.locator(e.state).evaluate(n=>({time:n.dataset.time,phase:n.dataset.phase,mode:n.dataset.mode})),held,'Installing a release leaves the paused round intact');
   assert.equal(await page.locator('html').getAttribute('data-update-fixture'),'1','No forced reload');
   assert.deepEqual(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}})),storage);
   for(const [width,height] of [[320,568],[390,844],[844,390],[820,1180]]){
    await page.setViewportSize({width,height});
    const b=await page.getByRole('button',{name:'Reload game',exact:true}).boundingBox();
    assert.ok(b&&b.width>=44&&b.height>=44&&b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height,'Reload fits '+width+'×'+height);
    const later=await page.getByRole('button',{name:'Later',exact:true}).boundingBox();
    assert.ok(later&&later.width>=44&&later.height>=44&&later.x>=0&&later.x+later.width<=width,'Later remains reachable');
    await page.screenshot({path:new URL(engine+'-'+e.slug+'-'+width+'.png',out).pathname});
   }
   await page.setViewportSize({width:390,height:844});
   await page.locator(e.resume).tap();
   await page.locator('#game-update').waitFor({state:'hidden'});
   await page.locator('#pause').tap();
   await page.getByRole('button',{name:'Reload game',exact:true}).tap();
   await page.waitForFunction(()=>document.documentElement.dataset.updateFixture==='2');
   await page.locator(e.start).waitFor();
   assert.equal(await page.locator('#game-update').count(),0,'Reload consumes the update');
   assert.deepEqual(await page.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}})),storage);
   if(e.slug==='dracula'){
    await page.locator(e.start).tap();await page.locator('#pause').tap();
    await other.bringToFront();revision=3;await page.bringToFront();
    await page.getByRole('button',{name:'Later',exact:true}).waitFor({timeout:75000});
    await page.getByRole('button',{name:'Later',exact:true}).press('Space');
    await page.locator('#game-update').waitFor({state:'hidden'});
    assert.equal(await page.locator(e.state).getAttribute('data-phase'),'paused','Keyboard notice actions do not resume the game');
    assert.equal(await page.locator('html').getAttribute('data-update-fixture'),'2','Later keeps this version open');
    await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.updateFixture==='3');
   }
   assert.deepEqual(errors,[]);
   receipts.push({engine,slug:e.slug,workerRequests,ordinaryTabReturnFoundUpdate:true,pausedGameUnchanged:true,playingHidesNotice:true,oneExplicitReloadLoadsNewVersion:true,storageUnchanged:true});
   console.log(engine+' '+e.slug+': open-tab update and explicit reload passed.');
  }catch(error){await page.screenshot({path:new URL(engine+'-'+e.slug+'-failure.png',out).pathname});throw error;}
  finally{await context.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
 }}finally{await browser.close();}
}
await writeFile(new URL('receipt.json',out),JSON.stringify({checkedAt:new Date().toISOString(),passed:true,receipts},null,2)+'\n');
