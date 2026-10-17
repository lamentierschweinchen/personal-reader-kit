import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const base=process.env.TEST_URL||'http://127.0.0.1:4314/odyssey/play/';
const evidence=new URL('../test-results/showcase/odyssey-game/',import.meta.url);await mkdir(evidence,{recursive:true});
const receipts=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function setup(width,height){
 const context=await browser.newContext({viewport:{width,height},hasTouch:true,isMobile:width<1000});
 const page=await context.newPage();const cdp=await context.newCDPSession(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('#start').tap();
 return {context,page,cdp,errors,width,height};
}
async function read(page){return page.evaluate(()=>({mode:document.querySelector('#game').dataset.mode,time:parseFloat(document.querySelector('#route-ship').style.left)*.72,x:parseFloat(document.querySelectorAll('.sailor')[2].style.left),message:document.querySelector('#message').textContent,active:[...document.querySelectorAll('.sailor.trouble')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})}));}
async function capture(page,name){await page.screenshot({path:new URL(name+'.png',evidence).pathname});}
async function touch(cdp,type,points){
 // For partial touchEnd, this installed Chromium expects the finger to lift.
 // qa-input.mjs verifies the resulting trusted pointerup and remaining touch list.
 await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({...p,radiusX:5,radiusY:5,force:1}))});
}
async function center(page,selector){const b=await page.locator(selector).boundingBox();return{x:b.x+b.width/2,y:b.y+b.height/2};}

async function gestures(){
 const s=await setup(390,844),{page,cdp}=s;
 await page.evaluate(()=>{window.qaEvents=[];for(const type of ['pointerdown','pointerup','pointercancel'])document.addEventListener(type,e=>window.qaEvents.push({type:e.type,trusted:e.isTrusted,pointerType:e.pointerType,id:e.pointerId,target:e.target.closest('button')?.id||e.target.closest('button')?.dataset.sailor}));});
 await page.waitForFunction(()=>document.querySelector('.sailor.trouble'));
 const left=await center(page,'#left');let p=await read(page);const before=p.x;
 await touch(cdp,'touchStart',[{...left,id:1}]);await wait(160);
 p=await read(page);const crew=p.active[0];
 await touch(cdp,'touchStart',[{...left,id:1},{...crew,id:2}]);await wait(55);
 await touch(cdp,'touchEnd',[{...crew,id:2}]);await wait(100);
 assert.equal(await page.locator('.sailor.trouble').count(),0);
 assert.equal(await page.locator('#left').getAttribute('class'),'steer pressed');
 assert.ok((await read(page)).x<before-10);
 await capture(page,'touch-steering-and-crew');
 await touch(cdp,'touchCancel',[]);await wait(350);
 assert.equal(await page.locator('#left').getAttribute('class'),'steer');
 const stopped=(await read(page)).x;await wait(250);assert.ok(Math.abs((await read(page)).x-stopped)<2);
 const right=await center(page,'#right');await touch(cdp,'touchStart',[{...right,id:3}]);await wait(240);await touch(cdp,'touchEnd',[]);await wait(150);
 assert.equal(await page.locator('#right').getAttribute('class'),'steer');
 // Turning the device deliberately pauses, including a held steering touch.
 await touch(cdp,'touchStart',[{...left,id:4}]);await page.setViewportSize({width:844,height:390});await wait(200);
 assert.equal((await read(page)).mode,'paused');
 const t=(await read(page)).time;await wait(200);assert.equal((await read(page)).time,t);
 await capture(page,'touch-rotation-paused');await touch(cdp,'touchCancel',[]);
 await page.locator('#again').tap();await wait(120);assert.equal((await read(page)).mode,'playing');
 assert.equal(await page.locator('.steer.pressed').count(),0);
 // Chrome's lifecycle command actually suspends the page; this is not a DOM-dispatched blur.
 await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await wait(1400);
 await cdp.send('Page.setWebLifecycleState',{state:'active'});await wait(250);
 const backgroundMode=(await read(page)).mode;
 const events=await page.evaluate(()=>window.qaEvents);assert.ok(events.filter(e=>e.pointerType==='touch').every(e=>e.trusted));assert.ok(events.some(e=>e.type==='pointercancel'));
 receipts.push({name:'gestures',multiTouch:true,holdRelease:true,cancel:true,rotation:true,backgroundMode,events,errors:s.errors});
 await s.context.close();
}

async function run(name,width,height,policy){
 const s=await setup(width,height),{page,cdp}=s, field=Math.min(width,760),offset=(width-field)/2;
 const left=await center(page,'#left'),right=await center(page,'#right');
 let held=0,points=[],samples=[],lastSample=-5,gotWind=false;
 const started=Date.now();
 while(Date.now()-started<95000){
  let r=await read(page);if(r.mode!=='playing')break;
  const target=policy(r.time);
  const x=(r.x-offset)/field;
  const desired=target===null?0:Math.abs(target-x)>.012?Math.sign(target-x):0;
  if(desired!==held){
   if(held)await touch(cdp,'touchEnd',[]);
   held=desired;points=held?[{...(held<0?left:right),id:1}]:[];
   if(held)await touch(cdp,'touchStart',points);
  }
  if(name!=='wind-loss'&&r.active.length){
   // Keep the steering finger down and command the moving crew with another.
   await touch(cdp,'touchStart',[...points,{...r.active[0],id:2}]);
   await touch(cdp,'touchEnd',[{...r.active[0],id:2}]);
  }
  if(r.time-lastSample>5){samples.push({time:+r.time.toFixed(2),x:+x.toFixed(3),message:r.message});lastSample=r.time;}
  if(r.message.includes('Wind loose')&&!gotWind){gotWind=true;await capture(page,name+'-gust');}
  if(r.time>30&&r.time<30.2)await capture(page,name+'-midrun');
  await wait(65);
 }
 if(held)await touch(cdp,'touchEnd',[]);
 const result=await read(page);await capture(page,name+'-result');
 const title=await page.locator('#result-title').textContent(),copy=await page.locator('#result-copy').textContent();
 receipts.push({name,width,height,mode:result.mode,title,copy,duration:result.time,wallSeconds:(Date.now()-started)/1000,samples,errors:s.errors});
 console.log(JSON.stringify({name,mode:result.mode,title,copy}));
 assert.equal(result.mode,name.endsWith('-win')?'won':'lost');
 if(name==='wind-loss')assert.equal(title,'Blown off course.');
 if(name==='rock-loss')assert.equal(title,'Shipwrecked.');
 // A genuine retry resets through the visible button, with no runtime hook.
 await page.locator('#again').tap();const retried=await read(page);assert.equal(retried.mode,'playing');assert.ok(retried.time<1);
 await page.locator('#pause').tap();await page.keyboard.press('Tab');
 for(let i=0;i<8;i++)await page.keyboard.press('Tab');
 assert.equal(await page.evaluate(()=>document.querySelector('#curtain').contains(document.activeElement)),true);
 await s.context.close();
}

try{
 await gestures();
 const results=await Promise.allSettled([
  run('phone-win',390,844,t=>t<8.9?.68:t<12.4?.45:t<18.8?.79:t<26.5?.64:t<32.6?.80:t<37?.28:t<40.8?.64:t<51.5?.79:t<61.6?.64:.80),
  run('desktop-win',1280,850,t=>t<8.5?.68:t<12.8?.51:t<33?.68:t<37.4?.82:.68),
  run('wind-loss',390,844,()=>null),
  run('rock-loss',390,844,t=>t<8.7?.4:t<12.3?.75:.56)
 ]);
 for(const result of results)if(result.status==='rejected')throw result.reason;
}finally{
 await writeFile(new URL('play-receipt.json',evidence),JSON.stringify(receipts,null,2)+'\n');
 await browser.close();
}
