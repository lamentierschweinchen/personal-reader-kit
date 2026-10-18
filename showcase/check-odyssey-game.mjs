import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const engines=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.BROWSER||'chromium';
assert.ok(['chromium','webkit'].includes(engine),'BROWSER must be chromium or webkit');
const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
const browser=await engines[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
const base=process.env.TEST_URL||'http://127.0.0.1:4314/odyssey/play/';
const evidence=process.env.OUTPUT_DIR?new URL('file://'+process.env.OUTPUT_DIR.replace(/\/$/,'')+'/'):new URL('../test-results/showcase/odyssey-game/',import.meta.url);
await mkdir(evidence,{recursive:true});
const receipts=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const key='newreading-homeward-days-v1';
const profiles=[[320,568],[390,844],[844,390],[820,1180],[1280,800]];
const selected=process.env.CAMPAIGN_WIDTHS?.split(',').map(Number);
const capture=(page,name)=>page.screenshot({path:new URL(engine+'-'+name+'.png',evidence).pathname});
async function read(page){
 return page.evaluate(()=>({
  mode:document.querySelector('#game').dataset.mode,day:Number(document.querySelector('#game').dataset.day),
  route:document.querySelector('#route-ship').style.left,remaining:document.querySelector('#remaining').textContent,
  x:parseFloat(document.querySelectorAll('.sailor')[2].style.left),message:document.querySelector('#message').textContent,
  gates:[...document.querySelectorAll('.channel-marker:not([hidden])')].map(e=>({x:parseFloat(e.style.left),y:parseFloat(e.style.top)})).sort((a,b)=>b.y-a.y),
  forecast:document.querySelector('#forecast').hidden?'':document.querySelector('#forecast').textContent,
  lightning:!document.querySelector('#lightning').hidden,
  active:[...document.querySelectorAll('.sailor.trouble')].map(el=>{const r=el.getBoundingClientRect();return{i:Number(el.dataset.sailor),x:r.x+r.width/2,y:r.y+r.height/2,spent:Number(el.style.getPropertyValue('--spent'))};}).sort((a,b)=>b.spent-a.spent)
 }));
}
async function center(page,selector){const b=await page.locator(selector).boundingBox();assert.ok(b);return{x:b.x+b.width/2,y:b.y+b.height/2};}
async function touch(cdp,type,points){
 // Chromium partial touchEnd lists the finger being lifted. The event receipt
 // checks that crew commands leave the steering finger down and are trusted.
 await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:5,radiusY:5,force:1}))});
}
async function setup(width,height,extra={}){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:width<1000,...extra});
 await context.addInitScript(()=>{
  window.qaInput=[];
  for(const type of ['pointerdown','pointerup','pointercancel','keydown'])document.addEventListener(type,e=>{
   window.qaInput.push({type:e.type,trusted:e.isTrusted,pointerType:e.pointerType,id:e.pointerId,target:e.target.closest('button')?.id||e.target.closest('button')?.dataset.sailor,key:e.key});
  });
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const cdp=engine==='chromium'?await context.newCDPSession(page):null;
 await page.goto(base);return{context,page,cdp,errors,width,height};
}
async function dimensions(page,selectors){
 const boxes=await page.locator(selectors).evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{id:e.id||e.className,width:r.width,height:r.height};}));
 for(const b of boxes){assert.ok(b.width>=44,b.id+' is too narrow');assert.ok(b.height>=44,b.id+' is too short');}
 assert.equal(await page.evaluate(()=>document.body.scrollWidth<=innerWidth),true,'Horizontal overflow');
 return boxes;
}
async function stable(page){const before=await read(page);await wait(350);const after=await read(page);assert.equal(after.route,before.route);assert.equal(after.x,before.x);assert.equal(after.mode,before.mode);}
async function intro(page,width,day){
 const r=await read(page);assert.equal(r.mode,'interlude');assert.equal(r.day,day);await stable(page);
 assert.equal(await page.locator('#day-source').getAttribute('target'),'_blank');
 assert.match(await page.locator('#day-source').getAttribute('href'),/\.\.\/#reference\/book-/);
 await dimensions(page,'#day-start,#day-source,#interlude .return-book');
 await capture(page,`${width}-day-${day}-intro`);
 // All narrative and the final return control must be reachable by normal scroll.
 await page.locator('#interlude .return-book').scrollIntoViewIfNeeded();
 await page.locator('#day-start').click();assert.equal((await read(page)).mode,'playing');
}
async function storage(page,seed=false){
 return page.evaluate(async seed=>{
  const fixture={place:'book-10-004',note:'An existing private reader note',revision:7};
  if(seed){localStorage.setItem('odyssey-notice-qa','shown');sessionStorage.setItem('newreading-game-return-odyssey','#read/odyssey/book-10');}
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('odyssey-reader-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('books',{keyPath:'id'});r.result.createObjectStore('state');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  if(seed)await new Promise((resolve,reject)=>{const t=db.transaction(['books','state'],'readwrite');t.objectStore('state').put(fixture,'reader');t.objectStore('books').put({id:'qa-existing-book',title:'Existing reader book'});t.oncomplete=resolve;t.onerror=()=>reject(t.error);});
  const records=await new Promise((resolve,reject)=>{const t=db.transaction(['books','state']);const a=t.objectStore('books').getAll(),b=t.objectStore('state').getAll();t.oncomplete=()=>resolve({books:a.result,state:b.result});t.onerror=()=>reject(t.error);});db.close();
  return{local:Object.fromEntries(Object.entries(localStorage).filter(([k])=>k!=='newreading-homeward-days-v1')),session:Object.fromEntries(Object.entries(sessionStorage)),records};
 },seed);
}
async function voyage(s,{steer=true,crew=true,label='win'}={}){
 const{page,cdp,width}=s,touchControls=cdp&&width<1000;
 const left=await center(page,'#left'),right=await center(page,'#right');
 let held=0,points=[],lastTap=0,lastMessage='',peakCrew=0,forecast=false,lightning=false,screen=false,events=[];
 const started=Date.now();
 while(Date.now()-started<60000){
  const r=await read(page);if(r.mode!=='playing')break;
  const target=steer?r.gates[0]?.x??r.x:r.x,desired=Math.abs(target-r.x)>4?Math.sign(target-r.x):0;
  if(desired!==held){
   if(held){if(touchControls)await touch(cdp,'touchEnd',[]);else await page.keyboard.up(held<0?'ArrowLeft':'ArrowRight');}
   held=desired;points=held?[{...(held<0?left:right),id:1}]:[];
   if(held){if(touchControls)await touch(cdp,'touchStart',points);else await page.keyboard.down(held<0?'ArrowLeft':'ArrowRight');}
  }
  peakCrew=Math.max(peakCrew,r.active.length);forecast ||=!!r.forecast;lightning ||=r.lightning;
  // Wait through part of the ring so later pairs really overlap; no game state,
  // timers, checkpoint values or victory conditions are injected.
  if(crew&&r.active[0]?.spent>45&&Date.now()-lastTap>400){
   const p=r.active[0];
   if(touchControls){await touch(cdp,'touchStart',[...points,{x:p.x,y:p.y,id:2}]);await touch(cdp,'touchEnd',[{x:p.x,y:p.y,id:2}]);}
   else if(width<1000)await page.touchscreen.tap(p.x,p.y);
   else await page.keyboard.press(String(p.i+1));
   lastTap=Date.now();
  }
  if(r.message&&r.message!==lastMessage){events.push({remaining:r.remaining,message:r.message});lastMessage=r.message;}
  if(!screen&&(r.active.length>1||r.lightning)){await capture(page,`${width}-day-${r.day}-${label}-hazards`);screen=true;}
  await wait(65);
 }
 if(held){if(touchControls)await touch(cdp,'touchEnd',[]);else await page.keyboard.up(held<0?'ArrowLeft':'ArrowRight');}
 const result=await read(page),title=await page.locator('#result-title').textContent();
 await capture(page,`${width}-day-${result.day}-${label}-result`);
 const receipt={width,height:s.height,day:result.day,label,mode:result.mode,title,wallSeconds:Math.round((Date.now()-started)/10)/100,peakCrew,forecast,lightning,events};
 receipts.push(receipt);console.log(JSON.stringify(receipt));return result;
}
async function campaign(width,height){
 const s=await setup(width,height),{page,context}=s;
 try{
  const originalStorage=await storage(page,true);await page.reload();
  await dimensions(page,'#start,.book-link,#sound');await capture(page,`${width}-ready`);await page.locator('#start').click();
  for(let day=1;day<=4;day++){
   await intro(page,width,day);await dimensions(page,'#left,#right,.sailor,#pause,#sound');
   if(width===390&&day===3){const lost=await voyage(s,{steer:false,label:'center-loss'});assert.equal(lost.mode,'lost');assert.equal(lost.day,3);assert.equal(await page.locator('#result-title').textContent(),'Shipwrecked.');await page.locator('#again').click();assert.equal((await read(page)).day,3);}
   if(width===390&&day===4){const lost=await voyage(s,{crew:false,label:'wind-loss'});assert.equal(lost.mode,'lost');assert.equal(await page.locator('#result-title').textContent(),'Blown off course.');await page.locator('#again').click();assert.equal((await read(page)).day,4);}
   const result=await voyage(s);assert.equal(result.mode,day<4?'cleared':'won');assert.equal(result.day,day);
   assert.equal(await page.locator('#restart').isVisible(),day<4,'Only one final-day replay action');
   const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);assert.deepEqual(saved,{version:1,day:Math.min(day,3),finished:day===4});await stable(page);
   await dimensions(page,'#again,#restart,#replay-all,#story,#curtain .return-book');
   if(day<4){
    if(width===390&&day===1){await page.reload();assert.equal((await read(page)).mode,'ready');assert.match(await page.locator('#start').textContent(),/day II/);await page.locator('#start').click();}
    else await page.locator('#again').click();
   }
  }
  assert.deepEqual(await storage(page),originalStorage,'Game changed reader storage');
  const input=await page.evaluate(()=>window.qaInput);assert.ok(input.length>20);assert.ok(input.every(e=>e.trusted),'Untrusted gameplay input');
  await page.reload();assert.equal((await read(page)).mode,'ready');assert.match(await page.locator('#start').textContent(),/final day/);
  await page.locator('#start').click();assert.equal((await read(page)).day,4);await intro(page,width,4);await page.locator('#pause').click();await stable(page);
  await page.locator('#replay-all').click();assert.equal((await read(page)).mode,'interlude');assert.equal((await read(page)).day,1);
  assert.deepEqual(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key),{version:1,day:0,finished:false});
  assert.deepEqual(await storage(page),originalStorage);assert.deepEqual(s.errors,[]);
  receipts.push({name:'campaign-complete',width,height,readerIsolation:true,reload:true,replayAll:true,trustedInputs:input.length,errors:s.errors});
 }finally{await context.close();}
}
async function lifecycle(){
 const s=await setup(390,844),{page,cdp}=s;
 try{
  await page.locator('#start').click();await intro(page,390,1);await page.waitForFunction(()=>document.querySelector('.sailor.trouble'));
  const left=await center(page,'#left'),right=await center(page,'#right');
  if(cdp){
   const before=(await read(page)).x;await touch(cdp,'touchStart',[{...left,id:1}]);await wait(160);let r=await read(page);const p=r.active[0];
   await touch(cdp,'touchStart',[{...left,id:1},{x:p.x,y:p.y,id:2}]);await touch(cdp,'touchEnd',[{x:p.x,y:p.y,id:2}]);await wait(100);
   assert.equal(await page.locator('.sailor.trouble').count(),0);assert.equal(await page.locator('#left.pressed').count(),1);assert.ok((await read(page)).x<before-10);
   await capture(page,'simultaneous-steer-and-crew');await touch(cdp,'touchCancel',[]);await wait(300);assert.equal(await page.locator('.steer.pressed').count(),0);
   const stopped=(await read(page)).x;await wait(200);assert.ok(Math.abs((await read(page)).x-stopped)<2);
   await touch(cdp,'touchStart',[{...right,id:3}]);await wait(150);await touch(cdp,'touchEnd',[]);await wait(100);assert.equal(await page.locator('.steer.pressed').count(),0);
   await touch(cdp,'touchStart',[{...left,id:4}]);
  }else await page.keyboard.down('ArrowLeft');
  await page.setViewportSize({width:844,height:390});await wait(100);assert.equal((await read(page)).mode,'paused');await stable(page);await capture(page,'rotation-paused');
  if(cdp)await touch(cdp,'touchCancel',[]);else await page.keyboard.up('ArrowLeft');
  await page.locator('#again').click();await wait(120);assert.equal((await read(page)).mode,'playing');assert.equal(await page.locator('.steer.pressed').count(),0);
  await page.locator('#pause').click();await stable(page);await page.locator('#story').click();assert.equal(await page.locator('#source').evaluate(e=>e.open),true);await stable(page);await page.locator('#source .close').click();
  for(let i=0;i<9;i++)await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('#curtain').contains(document.activeElement)),true);
  await page.locator('#again').click();
  // Real navigation runs pagehide. Capture its post-handler UI for the receipt.
  await page.evaluate(()=>addEventListener('pagehide',()=>sessionStorage.setItem('qa-pagehide',JSON.stringify({mode:document.querySelector('#game').dataset.mode,pressed:document.querySelectorAll('.steer.pressed').length})),{once:true}));
  await page.keyboard.down('ArrowRight');await page.goto(base+'?returned=1');await page.keyboard.up('ArrowRight');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('qa-pagehide'))),{mode:'paused',pressed:0});
  // Deterministic handler tests complement navigation; these are explicitly
  // synthetic lifecycle events, never counted as gameplay acceptance.
  await page.locator('#start').click();await page.locator('#day-start').click();await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.keyboard.up('ArrowRight');assert.equal((await read(page)).mode,'paused');await stable(page);
  await page.locator('#again').click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});assert.equal((await read(page)).mode,'paused');await stable(page);
  if(cdp){await page.locator('#again').click();await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await wait(1200);await cdp.send('Page.setWebLifecycleState',{state:'active'});await wait(200);receipts.push({name:'chromium-lifecycle-command',result:(await read(page)).mode});}
  assert.deepEqual(s.errors,[]);receipts.push({name:'lifecycle',engine,multiTouch:!!cdp,releaseCancel:!!cdp,rotation:true,pause:true,focusTrap:true,pagehide:true,syntheticBlurVisibility:true,errors:s.errors});
 }finally{await s.context.close();}
}
async function resilience(){
 const s=await setup(320,568,{reducedMotion:'reduce'}),{page}=s;
 try{
  await page.locator('#start').click();await intro(page,320,1);
  for(const [key,ms] of [['ArrowLeft',1200],['ArrowRight',2200]]){
   await page.keyboard.down(key);await wait(ms);await page.keyboard.up(key);
   const visible=await page.locator('.sailor').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));assert.equal(visible,true,'Crew target clipped at steering limit');
  }
  await page.locator('#pause').click();await capture(page,'reduced-motion-paused');
  // Fault injection is limited to persistence: never gameplay or progression.
  await page.evaluate(key=>localStorage.setItem(key,'malformed'),key);await page.reload();assert.match(await page.locator('#save-warning').textContent(),/could not read/);await page.locator('#start').click();assert.equal((await read(page)).day,1);
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Simulated storage denial','QuotaExceededError');};});await page.locator('#day-start').click();assert.match(await page.locator('#save-warning').textContent(),/could not keep/);await page.locator('#pause').click();await capture(page,'storage-denied');
  await dimensions(page,'#again,#restart,#replay-all,#curtain .return-book');assert.deepEqual(s.errors,[]);receipts.push({name:'resilience',reducedMotion:true,invalidSave:true,writeFailure:true,errors:s.errors});
 }finally{await s.context.close();}
}
try{
 await lifecycle();await resilience();
 const results=await Promise.allSettled(profiles.filter(([w])=>!selected||selected.includes(w)).map(([w,h])=>campaign(w,h)));
 for(const result of results)if(result.status==='rejected')throw result.reason;
}finally{await writeFile(new URL(engine+'-play-receipt.json',evidence),JSON.stringify(receipts,null,2)+'\n');await browser.close();}
