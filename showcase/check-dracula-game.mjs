import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {STAGES,createGame,start,update,retry,nextRoom,collides,solids,coverAt} from '../examples/dracula/play/engine.mjs';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4314/dracula/play/';
const out=new URL('../test-results/showcase/dracula-game/',import.meta.url);await mkdir(out,{recursive:true});
const SAVE_KEY='newreading-dracula-castle-v2',receipts=[];
const routes=[
 [[[495,500],[495,342]],[[300,342]],[[300,240],[107,240],[107,100]],[[107,240],[495,240],[495,95]]],
 [[[220,497],[220,355]],[[230,244]],[[174,244],[174,208],[107,208]],[[107,100]],[[107,208]],[[174,208],[174,244],[230,244]],[[352,244],[352,275]],[[352,382],[510,382],[510,490]],[[510,382],[505,300]],[[495,300],[495,95]]],
 [[[190,495],[190,350],[208,350]],[[300,350]],[[420,350]],[[420,240],[500,240]],[[500,100]],[[300,100],[105,100]],[[105,250]],[[208,250],[208,350]],[[300,350]],[[300,531]]]
];
// Predict departure windows in Node, then execute the route using real keys/touches.
// Browser game state, animation time and outcomes are never assigned by this check.
function traverse(g,points,limit=.65){
 let peak=g.warning;
 for(const [x,y] of points)for(const axis of ['x','y']){
  const target=axis==='x'?x:y;let count=0;
  while(Math.abs(g.player[axis]-target)>1.4&&g.phase==='playing'&&count++<1600){
   const sign=Math.sign(target-g.player[axis]);update(g,axis==='x'?{x:sign,y:0}:{x:0,y:sign},1/90);peak=Math.max(peak,g.warning);
   if(peak>limit)return false;
  }
  if(count>=1600)return false;
 }
 return g.phase!=='caught';
}
function departure(g,points){
 let wait=0,c=structuredClone(g);
 while(wait<45){
  const early=structuredClone(c),late=structuredClone(c);for(let n=0;n<18;n++)update(late,{},1/90);
  if(traverse(early,points)&&traverse(late,points))return wait+.1;
  for(let n=0;n<9;n++)update(c,{},1/90);
  assert.equal(c.phase,'playing','A route wait must be safe');wait+=.1;
 }
 throw Error('No sufficiently wide departure window from '+JSON.stringify(g.player));
}
const read=page=>page.evaluate(()=>{
 const s=document.querySelector('#castle'),p=document.querySelector('#harker').getAttribute('transform').match(/[\d.-]+/g).map(Number);
 return {phase:s.dataset.phase,stage:Number(s.dataset.stage),completed:Number(s.dataset.completed),gentle:s.dataset.gentle==='true',time:Number(s.dataset.time),patrolTime:Number(s.dataset.patrolTime),x:p[0],y:p[1],warning:Number(s.dataset.warning),cover:document.querySelector('#harker').dataset.cover,inventory:s.dataset.inventory.split(',').filter(Boolean),opened:s.dataset.opened.split(',').filter(Boolean),objective:document.querySelector('#objective').textContent};
});
function model(s){const g=createGame({stage:s.stage-1,completed:s.completed,gentle:s.gentle});return Object.assign(g,{phase:s.phase,time:s.time,patrolTime:s.patrolTime,player:{x:s.x,y:s.y,angle:0},warning:s.warning,inventory:s.inventory,opened:s.opened,cover:s.cover});}
const shot=async(page,name)=>page.screenshot({path:new URL(name+'.png',out).pathname});
async function unchanged(page,all=false){const a=await read(page);await page.waitForTimeout(240);const b=await read(page);if(all)assert.deepEqual(b,a);else{assert.equal(b.x,a.x);assert.equal(b.y,a.y);}}
async function move(page,axis,target,touch,{allowCaught=false}={}){
 const s=await read(page);if(s.phase!=='playing'||Math.abs(s[axis]-target)<2.5)return;
 const positive=target>s[axis],dir=axis==='x'?(positive?'right':'left'):(positive?'down':'up');
 const key={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[dir];
 if(touch)await touch.down(dir);else await page.keyboard.down(key);
 try{await page.waitForFunction(({axis,target,positive})=>{
  const s=document.querySelector('#castle');if(s.dataset.phase!=='playing')return true;
  const p=document.querySelector('#harker').getAttribute('transform').match(/[\d.-]+/g).map(Number),n=p[axis==='x'?0:1];return positive?n>=target:n<=target;
 },{axis,target,positive},{timeout:9000,polling:'raf'});}finally{if(touch)await touch.up();else await page.keyboard.up(key);}
 const after=await read(page);if(!allowCaught)assert.notEqual(after.phase,'caught',`caught in room ${after.stage} at ${after.x},${after.y} going ${dir}, t=${after.time}`);
}
async function winRoom(page,touch,label){
 const stage=(await read(page)).stage,legs=[];
 for(const points of routes[stage-1]){
  const s=await read(page);assert.equal(s.phase,'playing');
  const wait=departure(model(s),points),target=s.time+wait;
  await page.waitForFunction(t=>Number(document.querySelector('#castle').dataset.time)>=t,target,{polling:'raf',timeout:48000});
  for(const [x,y] of points){await move(page,'x',x,touch);await move(page,'y',y,touch);}
  const a=await read(page);legs.push({wait:+wait.toFixed(1),end:[a.x,a.y],time:a.time});
 }
 const a=await read(page);assert.equal(a.phase,stage===3?'escaped':'interlude');assert.equal(a.completed,stage);
 assert.ok(STAGES[stage-1].requires.every(k=>a.inventory.includes(k)));assert.equal(a.opened.length,STAGES[stage-1].doors.length);
 await unchanged(page,true);await shot(page,`${label}-room-${stage}-cleared`);
 if(touch){const size=page.viewportSize();await page.setViewportSize({width:320,height:568});await dimensions(page);await checkOverlay(page);await shot(page,`${label}-room-${stage}-small-interlude`);await page.setViewportSize(size);await unchanged(page,true);}
 receipts.push({case:'room-completion',label,stage,time:a.time,method:touch?'trusted touch holds':'trusted keyboard holds',legs});
 console.log(`${label}: room ${stage} cleared through actual ${touch?'touch':'keyboard'} controls in ${a.time.toFixed(1)} active seconds`);
}
async function makeTouch(page,context){
 const cdp=await context.newCDPSession(page);let points=[];
 return {
  async down(dir,id=1){const r=await page.locator(`[data-dir="${dir}"]`).boundingBox();points.push({x:r.x+r.width/2,y:r.y+r.height/2,id});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});},
  async up(id){const released=id?points.filter(p=>p.id===id):[];points=id?points.filter(p=>p.id!==id):[];await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:released});},
  async cancel(){points=[];await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});},
  async outside(){points=points.map(p=>({...p,x:6,y:6}));await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points});}
 };
}
async function dimensions(page){
 const d=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,scrollY,board:document.querySelector('#castle').getBoundingClientRect().toJSON(),footer:document.querySelector('footer').getBoundingClientRect().toJSON()}));
 assert.ok(d.scrollWidth<=d.width,JSON.stringify(d));assert.ok(d.scrollHeight<=d.height+2,JSON.stringify(d));assert.ok(d.footer.bottom<=d.height+2,JSON.stringify(d));
 for(const button of await page.locator('button:visible,a.back').all()){const r=await button.boundingBox();assert.ok(r.width>=44&&r.height>=44,`${await button.textContent()}: ${JSON.stringify(r)}`);}
 return d;
}
async function checkOverlay(page){
 const d=await page.locator('#screen').evaluate(el=>({overflow:getComputedStyle(el).overflowY,h:el.clientHeight,scroll:el.scrollHeight}));
 if(d.scroll>d.h)assert.equal(d.overflow,'auto');
 for(const button of await page.locator('#screen button:visible').all()){
  await button.scrollIntoViewIfNeeded();const r=await button.boundingBox(),outer=await page.locator('#screen').boundingBox();
  assert.ok(r.y>=outer.y-1&&r.y+r.height<=outer.y+outer.height+1,'Overlay button must be reachable by scrolling');
 }
}
async function failure(page,stage,touch){
 const targets=stage===1?[[200,500],[200,420]]:stage===2?[[190,497],[190,400]]:[[190,495],[190,397]];
 for(const [x,y] of targets){await move(page,'x',x,touch,{allowCaught:true});await move(page,'y',y,touch,{allowCaught:true});}
 await page.waitForFunction(()=>document.querySelector('#castle').dataset.phase==='caught',null,{timeout:17000});
 await unchanged(page,true);const s=await read(page);assert.equal(s.stage,stage);assert.equal(s.completed,stage-1);await checkOverlay(page);
 await page.locator('#screen-action')[touch?'tap':'click']();const a=await read(page);assert.equal(a.phase,'playing');assert.equal(a.stage,stage);assert.equal(a.completed,stage-1);assert.deepEqual(a.inventory,STAGES[stage-1].carry);
}
function invariants(){
 assert.equal(STAGES.length,3);
 for(let stage=0;stage<3;stage++){
  const g=createGame({stage,completed:stage});assert.ok(coverAt(stage,g.player.x,g.player.y));assert.equal(collides(g,g.player.x,g.player.y),false);
  for(const door of STAGES[stage].doors)assert.ok(solids(g).includes(door));
  // Taking the exit without completing the room cannot advance the checkpoint.
  start(g);g.player={...STAGES[stage].exit,angle:0};update(g,{},1/90);assert.equal(g.phase,'playing');assert.equal(g.completed,stage);
  g.inventory.push('temporary');g.opened=['temporary'];const fresh=retry(g);assert.equal(fresh.completed,stage);assert.equal(fresh.stage,stage);assert.deepEqual(fresh.inventory,STAGES[stage].carry);assert.deepEqual(fresh.opened,[]);
  if(stage<2){g.completed=stage+1;const n=nextRoom(g);assert.equal(n.stage,stage+1);assert.equal(n.completed,stage+1);}
 }
 // The chapel cannot be crossed without the iron key; the winch cannot precede the last key.
 const chapel=createGame({stage:1,completed:1});start(chapel);chapel.player={x:258,y:273,angle:0};for(let i=0;i<150;i++)update(chapel,{x:1,y:0},1/90);assert.ok(chapel.player.x<282);assert.deepEqual(chapel.opened,[]);
 const gate=createGame({stage:2,completed:2});start(gate);gate.player={x:107,y:100,angle:0};update(gate,{},1/90);assert.ok(!gate.inventory.includes('winch'));
 console.log('Model: guarded exits, gate collisions, item dependency, retry and next-room invariants passed');
}
invariants();
for(const engine of (process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'])){
 const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'];
 const browser=await ({chromium,webkit}[engine]).launch({headless:true,...(executablePath?{executablePath}:{})});
 const errors=[],requests=[];let context;
 try{
  context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));context.on('request',r=>requests.push(r.url()));
  await page.goto(base);await page.locator('#screen-action').waitFor();await dimensions(page);await shot(page,engine+'-desktop-ready');
  await page.evaluate(()=>localStorage.setItem('reader-preservation-sentinel','untouched'));
  await page.locator('#screen-action').click();await page.locator('#castle').focus();
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(150);await page.keyboard.up('ArrowUp');await unchanged(page);
  await page.keyboard.press('Space');assert.equal((await read(page)).phase,'paused');await unchanged(page,true);
  await page.locator('#help').click();await page.locator('#gentle').check();await page.locator('#close-notes').click();assert.equal((await read(page)).phase,'paused');
  await page.locator('#help').click();await page.locator('#gentle').uncheck();await page.keyboard.press('Escape');assert.equal(await page.locator('#notes').getAttribute('open'),null);
  await page.locator('#restart').click();await failure(page,1);await winRoom(page,null,engine+'-desktop');
  assert.equal(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).completed,1);
  await page.reload();assert.equal((await read(page)).stage,2);assert.equal((await read(page)).phase,'ready');await page.locator('#screen-action').click();
  await failure(page,2);await winRoom(page,null,engine+'-desktop');
  await page.reload();assert.equal((await read(page)).stage,3);assert.equal((await read(page)).phase,'ready');await page.locator('#screen-action').click();
  await failure(page,3);await winRoom(page,null,engine+'-desktop');
  assert.equal(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).completed,3);
  await page.reload();assert.equal((await read(page)).phase,'escaped');await page.locator('#screen-action').click();assert.equal((await read(page)).stage,1);assert.equal((await read(page)).completed,0);
  await page.locator('#about').click();assert.equal((await read(page)).phase,'paused');assert.equal((await page.locator('blockquote').textContent()).trim(),'“That key must be in the Count’s room; I must watch should his door be unlocked, so that I may get it and escape.”');await page.locator('#close-notes').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem('reader-preservation-sentinel')),'untouched');assert.equal(await page.evaluate(()=>localStorage.length),2);
  // Lifecycle events exercise handlers; this does not claim a physical app-switch test.
  await page.locator('#screen-action').click();await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await page.keyboard.up('ArrowRight');assert.equal((await read(page)).phase,'paused');await unchanged(page,true);
  await page.locator('#screen-action').click();await page.keyboard.down('ArrowRight');await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.keyboard.up('ArrowRight');assert.equal((await read(page)).phase,'paused');await unchanged(page,true);
  await context.close();context=null;
  assert.deepEqual(errors,[]);assert.ok(requests.every(u=>u.startsWith(new URL(base).origin+'/')));
  receipts.push({engine,case:'desktop-progress',result:'passed',failure:'All three rooms, real movement into patrol lane',checkpoint:'Room 2 and 3 reload, final reload, replay all',source:'Exact excerpt',readerStorage:'Unrelated sentinel unchanged',lifecycle:'pagehide and visibility handlers, synthetic events'});
  console.log(engine+': keyboard progression, three failures/retries, checkpoint reloads, replay, source and storage passed');

  context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'});
  const phone=await context.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base);await dimensions(phone);await shot(phone,engine+'-phone-ready');await phone.locator('#screen-action').tap();
  if(engine==='chromium'){
   const touch=await makeTouch(phone,context);
   await touch.down('up');await phone.waitForTimeout(180);await touch.up();assert.ok((await read(phone)).y<490);await unchanged(phone);
   await touch.down('right');await phone.waitForTimeout(100);await touch.cancel();await unchanged(phone);assert.equal(await phone.locator('.direction[aria-pressed="true"]').count(),0);
   await touch.down('left',1);await touch.down('up',2);await phone.waitForTimeout(110);await touch.up(1);const a=await read(phone);await phone.waitForTimeout(110);const b=await read(phone);assert.ok(b.y<a.y);assert.equal(b.x,a.x);await touch.up();await unchanged(phone);
   await touch.down('down');await touch.outside();await phone.waitForTimeout(100);await touch.up();await unchanged(phone);assert.equal(await phone.evaluate(()=>scrollY),0);
   await touch.down('right');await phone.setViewportSize({width:392,height:844});await touch.up();assert.equal((await read(phone)).phase,'paused');await unchanged(phone,true);await phone.setViewportSize({width:390,height:844});await phone.locator('#restart').tap();
   for(let stage=1;stage<=3;stage++){
    await shot(phone,`${engine}-phone-room-${stage}-play`);
    if(stage===3)await failure(phone,3,touch);
    await winRoom(phone,touch,engine+'-phone');if(stage<3)await phone.locator('#screen-action').tap();
   }
   await phone.locator('#screen-action').tap();await touch.down('up');await phone.setViewportSize({width:844,height:390});await touch.up();assert.equal((await read(phone)).phase,'paused');await unchanged(phone,true);await dimensions(phone);await shot(phone,engine+'-landscape-paused');
   await phone.locator('#screen-action').tap();await touch.down('up');await phone.waitForTimeout(100);await touch.cancel();await unchanged(phone);
  }else{
   const before=await read(phone);await phone.locator('[data-dir="up"]').tap();await unchanged(phone);assert.ok((await read(phone)).y<=before.y);
   await phone.setViewportSize({width:844,height:390});await phone.waitForFunction(()=>document.querySelector('#castle').dataset.phase==='paused');assert.equal((await read(phone)).phase,'paused');await dimensions(phone);await shot(phone,engine+'-landscape-paused');await phone.locator('#screen-action').tap();
  }
  await shot(phone,engine+'-landscape-play');
  await phone.setViewportSize({width:320,height:568});await dimensions(phone);await checkOverlay(phone);await shot(phone,engine+'-small-phone-paused');
  await phone.locator('#help').tap();await shot(phone,engine+'-small-phone-help');await phone.locator('#close-notes').tap();
  await phone.setViewportSize({width:820,height:1180});await dimensions(phone);await phone.locator('#screen-action').tap();await shot(phone,engine+'-tablet-play');await phone.locator('#pause').tap();
  assert.deepEqual(errors,[]);receipts.push({engine,case:'touch-layouts',result:'passed',sizes:['320×568','390×844','844×390','820×1180','1280×800'],targets:'All visible essential buttons at least 44×44',touch:engine==='chromium'?'All rooms completed with trusted holds; final-room loss/retry, multi-touch release/cancel, capture outside':'Trusted taps/release; WebKit public API has no touch-hold operation',rotation:'paused and cleared input',overlays:'Scrollable when content exceeds height',reducedMotion:true});
  await context.close();context=null;
  console.log(engine+': phone/tablet layouts, controls and rotation passed');

  context=await browser.newContext();let storage=await context.newPage();
  await storage.goto(base);await storage.evaluate(k=>{localStorage.setItem(k,'{broken');localStorage.setItem('reader-preservation-sentinel','untouched');},SAVE_KEY);await storage.reload();
  assert.match(await storage.locator('#save-status').textContent(),/could not be read/);await storage.locator('#screen-action').click();await storage.locator('#help').click();await storage.locator('#gentle').check();await storage.locator('#close-notes').click();assert.equal(await storage.evaluate(k=>localStorage.getItem(k),SAVE_KEY),'{broken');
  assert.ok(await storage.locator('#replay-all').isVisible());await storage.locator('#replay-all').click();
  assert.deepEqual(JSON.parse(await storage.evaluate(k=>localStorage.getItem(k),SAVE_KEY)),{version:2,completed:0,gentle:true});assert.equal(await storage.evaluate(()=>localStorage.getItem('reader-preservation-sentinel')),'untouched');
  await context.close();context=null;
  context=await browser.newContext();storage=await context.newPage();
  await storage.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Blocked in test','QuotaExceededError');};});
  await storage.goto(base);await storage.locator('#help').click();await storage.locator('#gentle').check();assert.ok(await storage.locator('#notes-save-status').isVisible());await storage.locator('#close-notes').click();assert.match(await storage.locator('#save-status').textContent(),/could not be saved/);await storage.setViewportSize({width:320,height:568});await dimensions(storage);await checkOverlay(storage);await shot(storage,engine+'-storage-warning-320');await storage.locator('#screen-action').click();await storage.keyboard.down('ArrowRight');await storage.waitForTimeout(150);await storage.keyboard.up('ArrowRight');assert.ok((await read(storage)).x>105);
  receipts.push({engine,case:'storage-failures',result:'passed',malformed:'Preserved verbatim while new run remains playable',writeFailure:'Visible warning; memory play works'});await context.close();context=null;
 }finally{if(context)await context.close();await browser.close();}
}
await writeFile(new URL('browser-receipt.json',out),JSON.stringify({date:new Date().toISOString(),base,receipts,limits:['Browser emulation; no physical phone/tablet test','WebKit trusted touch holds unavailable; full keyboard completion tested','Departure windows use the model in Node; browser completion uses real controls and real animation frames','No screen-reader playthrough or equivalent nonvisual mode','Offline service worker and full reader return are checked by the combined catalogue release check']},null,2)+'\n');
console.log('All Dracula progression checks passed.');
