import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.TEST_URL||'http://127.0.0.1:4314/alice/play/';
const out=new URL('../test-results/showcase/alice-game/',import.meta.url);await mkdir(out,{recursive:true});
const receipts=[];
async function read(page){return page.evaluate(()=>({
 phase:document.querySelector('#table').dataset.phase,time:Number(document.querySelector('#table').dataset.time),
 cups:[...document.querySelectorAll('.cup')].map((n,i)=>({id:i,tea:(133-Number(n.querySelector('.tea-fill').getAttribute('y')))/.82,drain:[6,7.8,4.3][i],disabled:n.disabled,pouring:n.classList.contains('pouring')})),
 refill:document.querySelector('#refill').classList.contains('brewing'),kettle:Number(document.querySelector('#kettle-state').textContent.match(/^(\d+)%/)?.[1]||0)*2.6,
 score:Number(document.querySelector('#table').dataset.score)
}));}
for(const engine of ['chromium','webkit']){
 const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'];
 const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base);await page.locator('.cup').first().waitFor();
  const cdp=engine==='chromium'?await context.newCDPSession(page):null;
  let held=null;
  const release=async()=>{if(held===null)return;if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.mouse.up();held=null;};
  const hold=async id=>{await release();const r=await page.locator('.cup[data-id="'+id+'"]').boundingBox(),point={x:r.x+r.width/2,y:r.y+r.height/2};if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,id:1}]});else{await page.mouse.move(point.x,point.y);await page.mouse.down();}held=id;};
  await hold(0);const started=Date.now();let swaps=0,lastSeats='';
  while(Date.now()-started<110000){
   const s=await read(page);if(!['playing','ready'].includes(s.phase))break;
   const seats=await page.locator('.cup kbd').allTextContents();if(lastSeats&&seats.join()!==lastSeats)swaps++;lastSeats=seats.join();
   if(held!==null&&(s.cups[held].tea>=88||s.cups[held].disabled||!s.cups[held].pouring))await release();
   if(held===null&&!s.refill&&!s.cups[0].disabled){
    const driest=[...s.cups].sort((a,b)=>a.tea/a.drain-b.tea/b.drain)[0];
    if(s.kettle<10||(s.kettle<90&&Math.min(...s.cups.map(c=>c.tea/c.drain))>3.5))await page.locator('#refill').tap();
    else if(driest.tea<62)await hold(driest.id);
   }
   await page.waitForTimeout(45);
  }
  await release();const won=await read(page);assert.equal(won.phase,'won');assert.equal(swaps,4);assert.ok(won.score>1500);
  await page.screenshot({path:new URL(engine+'-win.png',out).pathname});
  await page.locator('#primary-action').tap();assert.equal((await read(page)).phase,'ready');assert.equal((await read(page)).score,0);
  await page.locator('.cup').first().tap();await page.waitForFunction(()=>document.querySelector('#table').dataset.phase==='lost',null,{timeout:25000});
  await page.screenshot({path:new URL(engine+'-loss.png',out).pathname});await page.locator('#restart').tap();assert.equal((await read(page)).phase,'ready');
  // Pointer cancellation must stop a held pour without sticky input.
  await hold(0);await page.waitForTimeout(150);
  if(cdp){await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});held=null;}else await release();
  assert.equal(await page.locator('.cup.pouring').count(),0);
  await page.locator('#pause').tap();const paused=await read(page);await page.waitForTimeout(350);assert.deepEqual(await read(page),paused);
  assert.deepEqual(errors,[]);
  receipts.push({engine,win:true,seconds:won.time,score:won.score,seatChanges:swaps,naturalLoss:true,replay:true,cancel:true,pause:true,input:cdp?'trusted touch holds':'mouse holds; trusted touch taps'});
  console.log(engine+': full 75-second Alice win, natural loss, replay, cancel and pause passed.');
 }finally{await context.close();await browser.close();}
}
await writeFile(new URL('receipt.json',out),JSON.stringify({checkedAt:new Date().toISOString(),base,passed:true,receipts,limits:'Normal browser input and visible state only; no timer acceleration or game-state writes. Emulated touch is not a physical-device test.'},null,2)+'\n');
