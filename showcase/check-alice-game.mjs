import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4314/alice/play/';
const out=new URL(process.env.TEST_OUTPUT||'../.reader/game-clarity/alice/browser/',import.meta.url);await mkdir(out,{recursive:true});
const receipts=[],viewports=[[320,568],[390,844],[844,390],[820,1180],[1280,800]];
async function read(page){return page.evaluate(()=>({
 phase:document.querySelector('#table').dataset.phase,course:Number(document.querySelector('#table').dataset.course),time:Number(document.querySelector('#table').dataset.time),
 reading:document.querySelector('#table').dataset.reading,lastReading:document.querySelector('#table').dataset.lastReading,eyebrow:document.querySelector('#result-eyebrow').textContent,dialogue:document.querySelector('#course-dialogue').textContent,instruction:document.querySelector('#result-description').textContent,kettleLabel:document.querySelector('#kettle-state').textContent,
 completed:Number(document.querySelector('#table').dataset.completed),service:document.querySelector('#table').dataset.service,
 cups:[...document.querySelectorAll('.cup')].map((n,i)=>({id:i,tea:(133-Number(n.querySelector('.tea-fill').getAttribute('y')))/.82,seat:Number(n.querySelector('kbd').textContent),disabled:n.disabled,pouring:n.classList.contains('pouring'),dirty:n.classList.contains('dirty'),chewing:document.querySelectorAll('.guest')[i].classList.contains('chewing')})),
 orders:[...document.querySelectorAll('.order')].filter(n=>!n.hidden).map(n=>({id:Number(n.dataset.id),kind:n.dataset.kind,left:Number(n.dataset.left),disabled:n.disabled})),
 refill:document.querySelector('#refill').classList.contains('brewing'),kettle:Number(document.querySelector('#kettle-state').textContent.match(/^(\d+)%/)?.[1]||0)*2.1,
 score:Number(document.querySelector('#table').dataset.score),total:document.querySelector('#score').textContent,chances:Number(document.querySelector('#chances-label').textContent[0])
}));}
async function frozen(page){const before=await read(page);await page.waitForTimeout(400);assert.deepEqual(await read(page),before);}
async function geometry(page,label){const g=await page.evaluate(()=>{const r=n=>{const b=n.getBoundingClientRect();return{x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom};};const overlay=document.querySelector('#overlay');return{width:innerWidth,height:innerHeight,body:document.body.scrollWidth,main:r(document.querySelector('main')),table:r(document.querySelector('#table')),overlay:{...r(overlay),scroll:overlay.scrollHeight,client:overlay.clientHeight,hidden:overlay.hidden},primary:r(document.querySelector('#primary-action')),controls:[...document.querySelectorAll('button,a')].filter(n=>n.getBoundingClientRect().width&&n.getBoundingClientRect().height&&!n.closest('dialog:not([open])')&&!n.closest('#overlay')).map(n=>({id:n.id||n.className,...r(n)})),cups:[...document.querySelectorAll('.cup')].map(r),orders:[...document.querySelectorAll('.order:not([hidden])')].map(r)};});assert.ok(g.body<=g.width,`${label}: horizontal overflow`);if(!g.overlay.hidden){assert.ok(g.primary.y>=g.overlay.y&&g.primary.bottom<=g.overlay.bottom,`${label}: primary action needs scrolling`);}for(const c of g.controls){assert.ok(c.w>=43.9&&c.h>=43.9,`${label}: small target ${c.id} ${c.w}x${c.h}`);assert.ok(c.x>=-1&&c.right<=g.width+1,`${label}: clipped ${c.id}`);}for(const o of g.orders){assert.ok(o.bottom<=g.table.bottom+1,`${label}: request below table`);for(const c of g.cups)assert.ok(o.y>=c.bottom-1||o.right<=c.x||o.x>=c.right,`${label}: request overlaps cup`);}return g;}
for(const engine of (process.env.ENGINES||'chromium,webkit').split(',')){
 const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'];
 const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],courseReceipts=[],layouts=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base);await page.locator('.cup').first().waitFor();assert.equal((await read(page)).phase,'intro');await frozen(page);
  for(const [width,height] of viewports){await page.setViewportSize({width,height});layouts.push(await geometry(page,`${engine} ${width}x${height} intro`));await page.screenshot({path:new URL(`${engine}-${width}x${height}-intro.png`,out).pathname});}
  await page.setViewportSize({width:390,height:844});
  async function layoutSweep(label){for(const [width,height] of viewports){await page.setViewportSize({width,height});await geometry(page,`${engine} ${width}x${height} ${label}`);await page.screenshot({path:new URL(`${engine}-${width}x${height}-${label}.png`,out).pathname});}await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);}
  const cdp=engine==='chromium'?await context.newCDPSession(page):null;
  let held=null,keyboardHeld=null;
  const release=async()=>{if(held===null)return;if(keyboardHeld){await page.keyboard.up(keyboardHeld);keyboardHeld=null;}else if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();held=null;};
  const hold=async id=>{await release();const r=await page.locator('.cup[data-id="'+id+'"]').boundingBox(),point={x:r.x+r.width/2,y:r.y+r.height*.4};if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});else{await page.mouse.move(point.x,point.y);await page.mouse.down();}held=id;};
  // These actions use trusted input and visible DOM only. No game state or clock writes.
  async function playCourse(){const started=Date.now(),log=[],seen=new Set();let swaps=0,lastSeats='',services={toast:0,clean:0},readingChecks=[],forcedHold=false,laterRecap=null;
   while(Date.now()-started<95000){
    const s=await read(page);
    if(s.phase==='reading'){
     if(s.course===1)assert.ok(forcedHold,'Held input must span the reading boundary');
     assert.equal(s.time,[18,5,10][s.course-1]);assert.equal(s.reading,['places','bread','clean'][s.course-1]);assert.ok(s.cups.every(c=>!c.pouring&&c.disabled));
     if(keyboardHeld){await page.keyboard.down(keyboardHeld);await frozen(page);}
     await release();assert.equal((await read(page)).phase,'reading');await frozen(page);await page.waitForTimeout(900);assert.deepEqual(await read(page),s);
     for(const key of ['p','Escape','r','q','1']){await page.keyboard.press(key);assert.equal((await read(page)).phase,'reading');}await frozen(page);
     await page.locator('#about').tap();await page.locator('#about-dialog').waitFor({state:'visible'});await frozen(page);await page.locator('#close-about').tap();assert.equal((await read(page)).phase,'reading');
     await layoutSweep(`reading-${s.reading}`);assert.deepEqual(await read(page),s);
     const speech=s.dialogue,instruction=s.instruction;
     if(s.course===1)await page.keyboard.press('Enter');else await page.locator('#primary-action').tap();
     assert.equal((await read(page)).phase,'playing');await page.waitForTimeout(60);assert.equal(await page.locator('.cup.pouring').count(),0);
     await page.keyboard.press('p');const recap=await read(page);assert.equal(recap.phase,'paused');assert.equal(recap.dialogue,speech);assert.equal(recap.instruction,instruction);assert.match(recap.eyebrow,/last reading break$/);await frozen(page);await page.screenshot({path:new URL(`${engine}-recap-${s.reading}.png`,out).pathname});
     if(s.reading==='bread')assert.ok(recap.orders.some(o=>o.kind==='toast'&&o.left>5.8));else assert.deepEqual(recap.cups.map(c=>c.seat),[2,3,1]);
     if(s.reading==='clean')assert.equal(recap.cups[0].dirty,true);
     await page.keyboard.press('p');forcedHold=false;readingChecks.push({kind:s.reading,at:s.time,frozen:true,heldInputReleased:true,explicitContinue:true,recap:true,pendingDemandAfterContinue:true});log.push([s.time,'reading',s.reading]);continue;
    }
    if(s.phase!=='playing')break;
    // Allow the result to arrive before starting another coordinate-based hold.
    if(s.time>[32,36,40][s.course-1]-.25){await release();await page.waitForTimeout(100);continue;}
    const seats=s.cups.map(c=>c.seat).join();if(lastSeats&&seats!==lastSeats)swaps++;lastSeats=seats;
    if(!forcedHold&&held!==null&&(s.cups[held].tea>=88||s.cups[held].disabled||!s.cups[held].pouring))await release();
    if(s.course===1&&s.time>=17.45&&s.time<18&&!forcedHold&&!s.cups[0].disabled){await release();const id=s.cups.reduce((a,c)=>c.tea<a.tea?c:a,s.cups[0]).id;if(engine==='webkit'){await page.locator(`.cup[data-id="${id}"]`).focus();keyboardHeld='Space';await page.keyboard.down(keyboardHeld);held=id;}else await hold(id);forcedHold=true;assert.equal((await read(page)).cups[id].pouring,true);}
    if(!laterRecap&&s.lastReading&&((s.course===2&&s.orders.some(o=>o.kind==='toast'&&o.id!==1))||(s.course===3&&s.cups.some(c=>c.dirty&&c.id!==0)))){
     await release();await page.keyboard.press('p');const recap=await read(page);assert.equal(recap.phase,'paused');assert.match(recap.eyebrow,/last reading break$/);assert.doesNotMatch(recap.instruction,/March Hare|Hatter|Dormouse/);assert.equal(recap.instruction,s.instruction);await frozen(page);await layoutSweep(`later-recap-${s.lastReading}`);assert.deepEqual(await read(page),recap);laterRecap={kind:s.lastReading,at:s.time,differentGuest:true,genericRule:true};await page.keyboard.press('p');continue;
    }
    if(s.orders.length&&!seen.has(s.orders.some(o=>o.kind==='clean')?'clean':'toast')){const kind=s.orders.some(o=>o.kind==='clean')?'clean':'toast';seen.add(kind);await page.screenshot({path:new URL(`${engine}-course${s.course}-${kind}.png`,out).pathname});await geometry(page,`${engine} course${s.course} ${kind}`);if(kind==='clean'){await release();await page.locator('#pause').tap();await frozen(page);for(const [width,height] of viewports){await page.setViewportSize({width,height});await page.waitForTimeout(150);await geometry(page,`${engine} ${width}x${height} clean request paused`);await page.screenshot({path:new URL(`${engine}-${width}x${height}-paused.png`,out).pathname});await page.locator('#primary-action').tap();await geometry(page,`${engine} ${width}x${height} clean request playing`);await page.screenshot({path:new URL(`${engine}-${width}x${height}-playing.png`,out).pathname});await page.locator('#pause').tap();}await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await page.locator('#primary-action').tap();continue;}}
    if(held===null&&!s.refill&&!s.service&&!s.cups[0].disabled){
     const cs=s.cups.map(c=>({...c,dry:c.tea/([8,10,6][c.id]*[1,1.05,1.12][s.course-1]*(1+.12*s.time/[32,36,40][s.course-1])*(c.chewing?.35:1))}));
     const clean=cs.filter(c=>c.dirty).sort((a,b)=>a.dry-b.dry)[0],order=s.orders.filter(o=>o.kind==='toast').sort((a,b)=>a.left-b.left)[0],needy=cs.filter(c=>!c.dirty).sort((a,b)=>a.dry-b.dry)[0],dry=Math.min(...cs.map(c=>c.dry));
     const request=async(id,kind)=>{await page.locator('.order[data-id="'+id+'"]').tap();services[kind]++;log.push([s.time,kind,id]);};
     if(clean&&clean.tea<25)await request(clean.id,'clean');
     else if(order&&(order.left<2.8||dry>2.2))await request(order.id,'toast');
     else if(s.kettle<8||(s.kettle<75&&dry>2.2)){await page.locator('#refill').tap();log.push([s.time,'refill']);}
     else if(needy&&needy.tea<65){await hold(needy.id);log.push([s.time,'pour',needy.id]);}
     else if(order)await request(order.id,'toast');
     else if(clean&&clean.tea<55)await request(clean.id,'clean');
    }
    await page.waitForTimeout(45);
   }
   await release();const result=await read(page);await writeFile(new URL(`${engine}-course${result.course}-actions.json`,out),JSON.stringify(log,null,2)+'\n');assert.equal(result.phase,result.course===3?'won':'interlude',`${engine} course ${result.course} failed: ${JSON.stringify(result)}`);assert.equal(swaps,[1,1,3][result.course-1]);assert.ok(result.score>800);if(result.course>1){assert.equal(services.toast,4);assert.ok(laterRecap);}if(result.course===3)assert.equal(services.clean,3);assert.equal(readingChecks.length,1);return{...result,swaps,services,readingChecks,laterRecap};
  }
  for(let course=1;course<=3;course++){
   if(course>1){await frozen(page);await layoutSweep(`interlude${course}`);await page.screenshot({path:new URL(`${engine}-interlude${course}.png`,out).pathname});await page.reload();assert.equal((await read(page)).phase,'intro');assert.equal((await read(page)).course,course);assert.equal((await read(page)).completed,course-1);}
   const bank=(await read(page)).total;
   await page.locator('#primary-action').tap();for(let stop=0;stop<2;stop++){await page.waitForFunction(()=>['lost','reading'].includes(document.querySelector('#table').dataset.phase),null,{timeout:25000});if((await read(page)).phase==='lost')break;await page.locator('#primary-action').tap();}
   const lost=await read(page);assert.equal(lost.course,course);assert.equal(lost.completed,course-1);await page.screenshot({path:new URL(`${engine}-course${course}-loss.png`,out).pathname});await frozen(page);
   await page.locator('#primary-action').tap();const retry=await read(page);assert.equal(retry.phase,'playing');assert.equal(retry.course,course);assert.equal(retry.completed,course-1);assert.equal(retry.score,0);assert.equal(retry.total,bank);
   if(course===1){
    await hold(0);await page.waitForTimeout(180);if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});held=null;}else await release();assert.equal(await page.locator('.cup.pouring').count(),0);
    await hold(1);await page.waitForTimeout(120);await page.setViewportSize({width:844,height:390});await release();await page.locator('#table[data-phase="paused"]').waitFor({timeout:2000});assert.equal((await read(page)).phase,'paused');assert.equal(await page.locator('.cup.pouring').count(),0);await frozen(page);await page.setViewportSize({width:390,height:844});
    await page.locator('#retry-course').tap();assert.equal((await read(page)).phase,'intro');await page.locator('#primary-action').tap();
   }
   const win=await playCourse();courseReceipts.push({course,naturalLoss:true,retryPreservedEarlier:true,checkpointRestore:course>1,seconds:win.time,score:win.score,chances:win.chances,seatChanges:win.swaps,services:win.services,readingBreaks:win.readingChecks,laterRecap:win.laterRecap});
   console.log(`${engine}: course ${course} loss, current-course retry and full ${win.time}s win passed (${win.chances} chances left).`);
  }
  await frozen(page);await page.screenshot({path:new URL(`${engine}-all-clear.png`,out).pathname});
  await page.reload();assert.equal((await read(page)).phase,'won');assert.equal((await read(page)).completed,3);
  await page.locator('#retry-course').tap();assert.equal((await read(page)).phase,'intro');assert.equal((await read(page)).course,3);assert.equal((await read(page)).completed,2);
  await page.locator('#replay-all').tap();assert.equal((await read(page)).phase,'intro');assert.equal((await read(page)).course,1);assert.equal((await read(page)).total,'0');
  await page.locator('#primary-action').tap();await hold(0);await page.waitForTimeout(150);await release();await page.locator('#about').tap();await page.locator('#about-dialog').waitFor({state:'visible'});assert.equal((await read(page)).phase,'paused');await frozen(page);await page.locator('#close-about').tap();assert.equal((await read(page)).phase,'paused');
  await page.locator('#primary-action').tap();await page.locator('#restart').tap();assert.equal((await read(page)).phase,'intro');assert.equal((await read(page)).score,0);
  assert.deepEqual(errors,[]);receipts.push({engine,courses:courseReceipts,layouts:layouts.map(g=>({width:g.width,height:g.height,noHorizontalOverflow:true,targets44px:true,interludeScrollable:g.overlay.scroll>g.overlay.client})),cancel:true,rotationPauses:true,aboutPauses:true,replayAll:true,completeRestore:true,input:cdp?'trusted touch holds and taps':'mouse holds; trusted touch taps'});
 }catch(error){await page.screenshot({path:new URL(engine+'-failure.png',out).pathname});throw error;}finally{await context.close();await browser.close();}
}
await writeFile(new URL('receipt.json',out),JSON.stringify({checkedAt:new Date().toISOString(),base,passed:true,receipts,limits:'Normal browser input and visible state only; no timer acceleration or game-state writes. Emulated touch is not a physical-device test. WebKit uses mouse holds and touch taps.'},null,2)+'\n');
