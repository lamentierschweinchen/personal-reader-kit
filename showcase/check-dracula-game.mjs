import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {STAGES,VIEW,cameraFor,createGame,start,update,retry,nextRoom,collides,solids,coverAt} from '../examples/dracula/play/engine.mjs';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4314/dracula/play/';
const out=new URL('../test-results/showcase/dracula-game/',import.meta.url);await mkdir(out,{recursive:true});
import {SAVE_KEY,LEGACY_KEY} from '../examples/dracula/play/progress.mjs';
import {STORY} from '../examples/dracula/play/story.mjs';
import {newState,validateState} from '../examples/dracula/site/core.mjs';
const receipts=[],book=JSON.parse(await readFile(new URL('../examples/dracula/edition/library.json',import.meta.url)))[0];
const readerState=validateState({...newState(),lastBook:'dracula',positions:{dracula:{sectionId:'chap03',blockId:'chap03-b030',ratio:.37,revision:book.source.sha256}},boundaries:{dracula:{index:2,revision:book.source.sha256}},reflections:{private:'Reader preservation test'}});
const routes=[
 [[[495,500],[495,342]],[[300,342]],[[300,240],[107,240],[107,100]],[[107,240],[495,240],[495,95]]],
 [[[300,615],[300,480]],[[300,350]],[[335,244]],[[190,244],[190,208],[107,208]],[[107,100]],[[107,208]],[[190,208],[190,244],[335,244]],[[465,244],[465,275]],[[465,475],[550,475]],[[795,475],[795,610]],[[795,375]],[[795,95]]],
 [[[300,680]],[[500,680]],[[740,680]],[[950,680]],[[950,460]],[[800,460]],[[455,460]],[[455,330]],[[300,330]],[[105,330]],[[105,100]],[[500,100]],[[950,100]]],
 [[[350,740]],[[350,500]],[[350,270]],[[100,270]],[[100,100]],[[100,270]],[[350,270],[430,260]],[[550,260]],[[800,260]],[[1015,260]],[[1015,500]],[[1015,740]],[[1015,500]],[[1015,260]],[[1015,100]]],
 [[[250,795],[250,510]],[[415,535]],[[600,550]],[[815,535]],[[900,510]],[[900,380],[1100,380]],[[1100,100]],[[600,100]],[[105,100]],[[105,380]],[[260,380],[260,510]],[[415,535]],[[600,550]],[[600,831]]]
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
 return {phase:s.dataset.phase,stage:Number(s.dataset.stage),worldWidth:Number(s.dataset.worldWidth),worldHeight:Number(s.dataset.worldHeight),cameraX:Number(s.dataset.cameraX),cameraY:Number(s.dataset.cameraY),view:s.getAttribute('viewBox').split(' ').map(Number),completed:Number(s.dataset.completed),gentle:s.dataset.gentle==='true',time:Number(s.dataset.time),patrolTime:Number(s.dataset.patrolTime),x:p[0],y:p[1],warning:Number(s.dataset.warning),cover:document.querySelector('#harker').dataset.cover,inventory:s.dataset.inventory.split(',').filter(Boolean),opened:s.dataset.opened.split(',').filter(Boolean),objective:document.querySelector('#objective').textContent};
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
 const stage=(await read(page)).stage,legs=[];await checkPlan(page,touch,label);await cameraCheck(page);
 for(const points of routes[stage-1]){
  const s=await read(page);assert.equal(s.phase,'playing');
  const wait=departure(model(s),points),target=s.time+wait;
  await page.waitForFunction(t=>Number(document.querySelector('#castle').dataset.time)>=t,target,{polling:'raf',timeout:48000});
  for(const [x,y] of points){await move(page,'x',x,touch);await move(page,'y',y,touch);}
  const a=await read(page);await cameraCheck(page);if(legs.length===0||legs.length===Math.floor(routes[stage-1].length/2))await shot(page,`${label}-room-${stage}-camera-${legs.length}`);legs.push({wait:+wait.toFixed(1),end:[a.x,a.y],time:a.time});
 }
 const a=await read(page);assert.equal(a.phase,stage===STAGES.length?'escaped':'interlude');assert.equal(a.completed,stage);
 assert.ok(STAGES[stage-1].requires.every(k=>a.inventory.includes(k)));assert.equal(a.opened.length,STAGES[stage-1].doors.length);if(stage>1)assert.ok(legs.some(l=>l.end[0]>STAGES[stage-1].width-160),'Actual play must reach the far eastern floor');
 await unchanged(page,true);await shot(page,`${label}-room-${stage}-cleared`);
 if(touch){const size=page.viewportSize();await page.setViewportSize({width:320,height:568});await dimensions(page);await checkOverlay(page);await shot(page,`${label}-room-${stage}-small-interlude`);await page.setViewportSize(size);await unchanged(page,true);}
 receipts.push({case:'room-completion',label,stage,time:a.time,method:touch?'trusted touch holds':'trusted keyboard holds',legs});
 console.log(`${label}: room ${stage} cleared through actual ${touch?'touch':'keyboard'} controls in ${a.time.toFixed(1)} active seconds`);
}
async function cameraCheck(page){
 const s=await read(page),room=STAGES[s.stage-1],expected=cameraFor(model(s));
 assert.equal(s.worldWidth,room.width);assert.equal(s.worldHeight,room.height);assert.deepEqual(s.view.slice(2),[VIEW,VIEW]);
 assert.ok(Math.abs(s.cameraX-expected.x)<.02&&Math.abs(s.cameraY-expected.y)<.02);
 const d=await page.evaluate(()=>{const svg=document.querySelector('#castle');return {width:svg.getBoundingClientRect().width,scale:svg.getScreenCTM().a};});
 assert.ok(Math.abs(d.scale*VIEW-d.width)<.1,'Larger rooms must not shrink the active game scale');
}
async function checkPlan(page,touch,label){
 const before=await read(page),method=touch?'tap':'click';await page.locator('#map')[method]();
 assert.equal((await read(page)).phase,'paused');await unchanged(page,true);
 assert.deepEqual((await page.locator('#floor-plan').getAttribute('viewBox')).split(' ').map(Number),[0,0,before.worldWidth,before.worldHeight]);
 assert.match(await page.locator('#map-panel').textContent(),/Whole room · play paused/);
 await shot(page,`${label}-room-${before.stage}-plan`);await page.locator('#close-notes')[method]();
 assert.equal((await read(page)).phase,'paused');await page.locator('#screen-action')[method]();
 const after=await read(page);assert.equal(after.x,before.x);assert.equal(after.y,before.y);assert.ok(after.time-before.time<.25);
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
 for(const button of await page.locator('button:visible,a.back,a.chapter-source:visible').all()){const r=await button.boundingBox();assert.ok(r.width>=44&&r.height>=44,`${await button.textContent()}: ${JSON.stringify(r)}`);}
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
 const targets=[[[200,500],[200,420]],[[285,615],[285,550]],[[300,680],[300,590]],[[270,740],[270,620]],[[250,795],[250,600]]][stage-1];
 for(const [x,y] of targets){await move(page,'x',x,touch,{allowCaught:true});await move(page,'y',y,touch,{allowCaught:true});}
 await page.waitForFunction(()=>document.querySelector('#castle').dataset.phase==='caught',null,{timeout:24000});
 await unchanged(page,true);const s=await read(page);assert.equal(s.stage,stage);assert.equal(s.completed,stage-1);await checkOverlay(page);
 await page.locator('#screen-action')[touch?'tap':'click']();const a=await read(page);assert.equal(a.phase,'playing');assert.equal(a.stage,stage);assert.equal(a.completed,stage-1);assert.deepEqual(a.inventory,STAGES[stage-1].carry);
}
function invariants(){
 assert.equal(STAGES.length,5);
 for(let stage=0;stage<STAGES.length;stage++){
  const g=createGame({stage,completed:stage});assert.ok(coverAt(stage,g.player.x,g.player.y));assert.equal(collides(g,g.player.x,g.player.y),false);
  for(const door of STAGES[stage].doors)assert.ok(solids(g).includes(door));
  // Taking the exit without completing the room cannot advance the checkpoint.
  start(g);g.player={...STAGES[stage].exit,angle:0};update(g,{},1/90);assert.equal(g.phase,'playing');assert.equal(g.completed,stage);
  g.inventory.push('temporary');g.opened=['temporary'];const fresh=retry(g);assert.equal(fresh.completed,stage);assert.equal(fresh.stage,stage);assert.deepEqual(fresh.inventory,STAGES[stage].carry);assert.deepEqual(fresh.opened,[]);
  if(stage<STAGES.length-1){g.completed=stage+1;const n=nextRoom(g);assert.equal(n.stage,stage+1);assert.equal(n.completed,stage+1);}
 }
 // The chapel cannot be crossed without the crowbar; the winch cannot precede the last key.
 const chapel=createGame({stage:1,completed:1});start(chapel);chapel.player={x:368,y:273,angle:0};for(let i=0;i<150;i++)update(chapel,{x:1,y:0},1/90);assert.ok(chapel.player.x<392);assert.deepEqual(chapel.opened,[]);
 const gate=createGame({stage:4,completed:4});start(gate);gate.player={x:107,y:100,angle:0};update(gate,{},1/90);assert.ok(!gate.inventory.includes('winch'));
 console.log('Model: guarded exits, gate collisions, item dependency, retry and next-room invariants passed');
}
async function readerRecord(page,write=false){
 return page.evaluate(({state,write})=>new Promise((resolve,reject)=>{
  const request=indexedDB.open('dracula-reader-v1',1);
  request.onupgradeneeded=()=>{request.result.createObjectStore('books',{keyPath:'id'});request.result.createObjectStore('state');};
  request.onerror=()=>reject(request.error);
  request.onsuccess=()=>{const db=request.result,tx=db.transaction('state',write?'readwrite':'readonly'),store=tx.objectStore('state');
   if(write)store.put(state,'reader');let result;const get=store.get('reader');get.onsuccess=()=>{result=get.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>reject(tx.error);
  };
 }),{state:readerState,write});
}
async function checkReference(page,story,trigger,touch=false,{back=false}={}){
 const before=await read(page),reader=await readerRecord(page),method=touch?'tap':'click';
 await page.locator(trigger)[method]();await page.waitForURL('**/'+story.href);await page.locator('#notes').waitFor({state:'visible'});await page.locator('#source-passage [data-block="'+story.block+'"]').waitFor();await page.locator('#source-loading').waitFor({state:'hidden'});
 const expected=story.context.map(id=>book.sections.find(s=>s.id===story.section).blocks.find(b=>b.id===id).text);
 assert.deepEqual(await page.locator('#source-passage p').allTextContents(),expected);assert.match(await page.locator('#source-citation').textContent(),new RegExp(story.date));
 assert.equal(await page.locator('#source-excerpt').textContent(),story.quote);
 const detail=await page.locator('#source-detail').textContent();if(STORY.indexOf(story)<2)assert.equal(detail,'');if(story===STORY[2])assert.match(detail,/no further outlet/);if(story===STORY[4])assert.match(detail,/castle wall/);
 const paused=await read(page);assert.equal(paused.phase,before.phase==='playing'?'paused':before.phase);await unchanged(page,true);
 if(back)await page.goBack();else await page.locator('#close-notes')[method]();
 await page.locator('#notes').waitFor({state:'hidden'});const after=await read(page);assert.equal(after.x,before.x);assert.equal(after.y,before.y);assert.equal(after.phase,paused.phase);assert.deepEqual(await readerRecord(page),reader);
 assert.ok(!new URL(page.url()).hash);receipts.push({case:'source-reference',stage:STORY.indexOf(story)+1,route:story.href,return:back?'browser Back':'Close',phase:before.phase,reader:'IndexedDB reading position, chapter limit and reflection unchanged',exactParagraphs:story.context});
}
async function enterOpening(page,touch,label){
 const state=await read(page),story=STORY[state.stage-1];assert.equal(state.phase,'ready');assert.equal(state.time,0);await page.locator('#chapter-start').waitFor();
 assert.equal(await page.locator('#chapter-quote').textContent(),story.quote);await dimensions(page);await unchanged(page,true);
 await page.keyboard.press('ArrowUp');await unchanged(page,true);assert.equal((await read(page)).phase,'ready','Movement must never skip the opening');
 const method=touch?'tap':'click';await page.locator('#map')[method]();assert.match(await page.locator('#plan-state').textContent(),/not started/);await page.locator('#close-notes')[method]();assert.equal((await read(page)).phase,'ready');
 await checkReference(page,story,'#chapter-source',touch);await shot(page,`${label}-room-${state.stage}-opening`);
 const r=await page.locator('#chapter-start').boundingBox(),height=page.viewportSize().height;assert.ok(r.y>=0&&r.y+r.height<height-35,'Start must remain visible');
 await page.locator('#chapter-start')[method]();assert.equal((await read(page)).phase,'playing');
}
invariants();
for(const engine of (process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'])){
 const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'];
 const browser=await ({chromium,webkit}[engine]).launch({headless:true,...(executablePath?{executablePath}:{})});
 const errors=[],requests=[];let context;
 try{
  context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));context.on('request',r=>requests.push(r.url()));
  await page.goto(base);await readerRecord(page,true);await page.evaluate(()=>localStorage.setItem('reader-preservation-sentinel','untouched'));
  await enterOpening(page,false,engine+'-desktop');
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(150);await page.keyboard.up('ArrowUp');await unchanged(page);
  await page.keyboard.press('Space');assert.equal((await read(page)).phase,'paused');await unchanged(page,true);
  await page.locator('#help').click();await page.locator('#gentle').check();await page.locator('#close-notes').click();assert.equal((await read(page)).phase,'paused');
  await page.locator('#help').click();await page.locator('#gentle').uncheck();await page.keyboard.press('Escape');assert.equal(await page.locator('#notes').getAttribute('open'),null);
  await page.locator('#restart').click();
  for(let stage=1;stage<=STAGES.length;stage++){
   await failure(page,stage);await winRoom(page,null,engine+'-desktop');
   assert.equal(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).completed,stage);
   if(stage<STAGES.length){
    if(stage%2)await page.reload();else await page.locator('#screen-action').click();
    assert.equal((await read(page)).stage,stage+1);await enterOpening(page,false,engine+'-desktop');
   }
  }
  await page.reload();assert.equal((await read(page)).phase,'escaped');await page.locator('#screen-action').click();assert.equal((await read(page)).stage,1);assert.equal((await read(page)).completed,0);
  await enterOpening(page,false,engine+'-replay');await checkReference(page,STORY[0],'#about',false,{back:true});assert.equal((await read(page)).phase,'paused');
  assert.deepEqual(await readerRecord(page),readerState);assert.equal(await page.evaluate(()=>localStorage.getItem('reader-preservation-sentinel')),'untouched');assert.equal(await page.evaluate(()=>localStorage.length),2);
  // Lifecycle dispatch exercises handlers; it is not a physical app-switch test.
  await page.locator('#screen-action').click();await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));await page.keyboard.up('ArrowRight');assert.equal((await read(page)).phase,'paused');await unchanged(page,true);
  await page.locator('#screen-action').click();await page.keyboard.down('ArrowRight');await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.keyboard.up('ArrowRight');assert.equal((await read(page)).phase,'paused');await unchanged(page,true);
  await context.close();context=null;
  assert.deepEqual(errors,[]);assert.ok(requests.every(u=>u.startsWith(new URL(base).origin+'/')));
  receipts.push({engine,case:'desktop-progress',result:'passed',failure:'All five rooms, actual movement into patrol lane; Retry starts play without repeating prose',checkpoint:'Alternating reloads and explicit next-room controls; final reload and replay',source:'Five exact excerpts and full paragraph reference visits',readerStorage:'IndexedDB state and unrelated localStorage unchanged',lifecycle:'pagehide and visibility handlers, synthetic events'});
  console.log(engine+': five keyboard rooms, five failures/retries, openings, references and checkpoints passed');

  context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'});
  const phone=await context.newPage();phone.on('pageerror',e=>errors.push(e.message));await phone.goto(base);await readerRecord(phone,true);await enterOpening(phone,true,engine+'-phone');
  if(engine==='chromium'){
   const touch=await makeTouch(phone,context);
   await touch.down('up');await phone.waitForTimeout(180);await touch.up();assert.ok((await read(phone)).y<490);await unchanged(phone);
   await touch.down('right');await phone.waitForTimeout(100);await touch.cancel();await unchanged(phone);assert.equal(await phone.locator('.direction[aria-pressed="true"]').count(),0);
   await touch.down('left',1);await touch.down('up',2);await phone.waitForTimeout(110);await touch.up(1);const a=await read(phone);await phone.waitForTimeout(110);const b=await read(phone);assert.ok(b.y<a.y);assert.equal(b.x,a.x);await touch.up();await unchanged(phone);
   await touch.down('down');await touch.outside();await phone.waitForTimeout(100);await touch.up();await unchanged(phone);assert.equal(await phone.evaluate(()=>scrollY),0);
   await touch.down('right');await phone.setViewportSize({width:392,height:844});await touch.up();assert.equal((await read(phone)).phase,'paused');await unchanged(phone,true);await phone.setViewportSize({width:390,height:844});await phone.locator('#restart').tap();
   for(let stage=1;stage<=STAGES.length;stage++){
    await shot(phone,`${engine}-phone-room-${stage}-play`);if(stage===3||stage===5)await failure(phone,stage,touch);
    await winRoom(phone,touch,engine+'-phone');if(stage<STAGES.length){await phone.locator('#screen-action').tap();await enterOpening(phone,true,engine+'-phone');}
   }
   await phone.locator('#screen-action').tap();await enterOpening(phone,true,engine+'-phone-replay');await touch.down('up');await phone.setViewportSize({width:844,height:390});await touch.up();assert.equal((await read(phone)).phase,'paused');await unchanged(phone,true);await dimensions(phone);await shot(phone,engine+'-landscape-paused');
   await phone.locator('#screen-action').tap();await touch.down('up');await phone.waitForTimeout(100);await touch.cancel();await unchanged(phone);
  }else{
   const before=await read(phone);await phone.locator('[data-dir="up"]').tap();await unchanged(phone);assert.ok((await read(phone)).y<=before.y);
   await phone.setViewportSize({width:844,height:390});await phone.waitForFunction(()=>document.querySelector('#castle').dataset.phase==='paused');await dimensions(phone);await shot(phone,engine+'-landscape-paused');await phone.locator('#screen-action').tap();
  }
  await shot(phone,engine+'-landscape-play');await phone.setViewportSize({width:320,height:568});await dimensions(phone);await checkOverlay(phone);await shot(phone,engine+'-small-phone-paused');
  await phone.locator('#help').tap();await shot(phone,engine+'-small-phone-help');await phone.locator('#close-notes').tap();
  await phone.setViewportSize({width:820,height:1180});await dimensions(phone);await phone.locator('#screen-action').tap();await shot(phone,engine+'-tablet-play');await phone.locator('#pause').tap();
  assert.deepEqual(await readerRecord(phone),readerState);assert.deepEqual(errors,[]);receipts.push({engine,case:'touch-layouts',result:'passed',sizes:['320×568','390×844','844×390','820×1180','1280×800'],targets:'All visible essential buttons at least 44×44',touch:engine==='chromium'?'Five rooms completed with trusted holds; chapel and gatehouse loss/retry, multi-touch release/cancel, capture outside':'Trusted taps/release; WebKit public API has no touch-hold operation',rotation:'paused and cleared input',overlays:'Scrollable when content exceeds height',reducedMotion:true});
  await context.close();context=null;
  console.log(engine+': phone/tablet layouts, controls and rotation passed');

  // Checkpoint fixtures below test migration/layout, never serve as game-completion proof.
  context=await browser.newContext({viewport:{width:320,height:568},hasTouch:true,isMobile:true});let storage=await context.newPage();await storage.goto(base);
  for(let completed=0;completed<5;completed++){
   await storage.evaluate(({k,completed})=>localStorage.setItem(k,JSON.stringify({version:3,completed,gentle:false})),{k:SAVE_KEY,completed});await storage.reload();await dimensions(storage);await shot(storage,`${engine}-opening-${completed+1}-320`);
   const r=await storage.locator('#chapter-start').boundingBox();assert.ok(r.y+r.height<535);await unchanged(storage,true);
  }
  for(const completed of [0,1,2,3]){
   const legacy=JSON.stringify({version:2,completed,gentle:true});await storage.evaluate(({k,old,legacy})=>{localStorage.removeItem(k);localStorage.setItem(old,legacy);},{k:SAVE_KEY,old:LEGACY_KEY,legacy});await storage.reload();
   const state=await read(storage);assert.equal(state.completed,Math.min(completed,2));assert.equal(state.stage,Math.min(completed,2)+1);assert.equal(state.phase,'ready');assert.equal(state.gentle,true);assert.equal(await storage.evaluate(k=>localStorage.getItem(k),LEGACY_KEY),legacy);
   assert.equal(JSON.parse(await storage.evaluate(k=>localStorage.getItem(k),SAVE_KEY)).version,3);await shot(storage,`${engine}-legacy-${completed}-320`);
  }
  await storage.evaluate(({k,old})=>{localStorage.removeItem(k);localStorage.setItem(old,'{legacy broken');},{k:SAVE_KEY,old:LEGACY_KEY});await storage.reload();assert.match(await storage.locator('#chapter-save-status').textContent(),/left untouched/);
  await storage.locator('#help').tap();await storage.locator('#gentle').check();await storage.locator('#close-notes').tap();assert.equal(await storage.evaluate(k=>localStorage.getItem(k),LEGACY_KEY),'{legacy broken');
  await storage.evaluate(k=>localStorage.setItem(k,'{broken'),SAVE_KEY);await storage.reload();assert.match(await storage.locator('#chapter-save-status').textContent(),/could not be read/);
  await storage.locator('#chapter-start').tap();await storage.locator('#help').tap();await storage.locator('#gentle').check();await storage.locator('#close-notes').tap();assert.equal(await storage.evaluate(k=>localStorage.getItem(k),SAVE_KEY),'{broken');
  await storage.locator('#replay-all').tap();assert.deepEqual(JSON.parse(await storage.evaluate(k=>localStorage.getItem(k),SAVE_KEY)),{version:3,completed:0,gentle:true});assert.equal(await storage.evaluate(k=>localStorage.getItem(k),LEGACY_KEY),'{legacy broken');assert.equal(await storage.evaluate(k=>localStorage.getItem(k+'-recovery'),SAVE_KEY),'{broken');
  receipts.push({engine,case:'checkpoint-migration',result:'passed',legacy:'v2 completed 0/1/2/3 maps to v3 0/1/2/2, legacy raw value unchanged',malformed:'Malformed legacy preserved while new campaign writes separate key; malformed current preserved until explicit Replay'});
  await context.close();context=null;

  context=await browser.newContext();storage=await context.newPage();await storage.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Blocked in test','QuotaExceededError');};});
  await storage.goto(base);await storage.locator('#help').click();await storage.locator('#gentle').check();assert.ok(await storage.locator('#notes-save-status').isVisible());await storage.locator('#close-notes').click();assert.match(await storage.locator('#chapter-save-status').textContent(),/could not be saved/);await storage.setViewportSize({width:320,height:568});await dimensions(storage);await shot(storage,engine+'-storage-warning-320');await storage.locator('#chapter-start').click();await storage.keyboard.down('ArrowRight');await storage.waitForTimeout(150);await storage.keyboard.up('ArrowRight');assert.ok((await read(storage)).x>105);
  receipts.push({engine,case:'write-failure',result:'passed',warning:'Visible warning; memory play works'});await context.close();context=null;

  context=await browser.newContext();storage=await context.newPage();await storage.route('**/library.json',r=>r.abort());await storage.goto(base);await readerRecord(storage,true);
  await storage.locator('#chapter-source').click();await storage.locator('#source-retry').waitFor();assert.match(await storage.locator('#source-loading').textContent(),/could not be opened/);assert.equal(await storage.locator('#source-passage').textContent(),STORY[0].quote);await unchanged(storage,true);
  await storage.unroute('**/library.json');await storage.locator('#source-retry').click();await storage.locator('#source-loading').waitFor({state:'hidden'});await storage.locator('#close-notes').click();assert.equal((await read(storage)).phase,'ready');assert.deepEqual(await readerRecord(storage),readerState);
  receipts.push({engine,case:'source-fetch-recovery',result:'passed',fallback:'Exact short excerpt retained; retry loads full pinned paragraph; reader state unchanged'});await context.close();context=null;
 }finally{if(context)await context.close();await browser.close();}
}
await writeFile(new URL(process.env.QA_ENGINE?'browser-receipt-'+process.env.QA_ENGINE+'.json':'browser-receipt.json',out),JSON.stringify({date:new Date().toISOString(),base,receipts,limits:['Browser emulation; no physical phone/tablet test','WebKit trusted touch holds unavailable; full keyboard completion tested','Departure windows use the model in Node; browser completion uses real controls and real animation frames','No screen-reader playthrough or equivalent nonvisual mode','Offline service worker and full reader return are checked by the combined catalogue release check']},null,2)+'\n');
console.log('All five-room Dracula checks passed.');
