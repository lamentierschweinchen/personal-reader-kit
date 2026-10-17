import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.TEST_URL||'http://127.0.0.1:4314/dracula/play/';
const out=new URL('../test-results/showcase/dracula-game/',import.meta.url);await mkdir(out,{recursive:true});
const receipts=[];
const read=page=>page.evaluate(()=>{
  const s=document.querySelector('#castle'),p=document.querySelector('#harker').getAttribute('transform').match(/[\d.-]+/g).map(Number);
  return {phase:s.dataset.phase,time:Number(s.dataset.time),patrolTime:Number(s.dataset.patrolTime),x:p[0],y:p[1],cover:document.querySelector('#harker').dataset.cover,objective:document.querySelector('#objective').textContent};
});
const shot=async(page,name)=>{await page.screenshot({path:new URL(name+'.png',out).pathname});};
const unchanged=async(page)=>{const a=await read(page);await page.waitForTimeout(220);const b=await read(page);assert.equal(b.x,a.x);assert.equal(b.y,a.y);};
async function move(page,axis,target,touch){
  const s=await read(page),positive=target>s[axis],dir=axis==='x'?(positive?'right':'left'):(positive?'down':'up');
  const key={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[dir];
  if(touch)await touch.down(dir);else await page.keyboard.down(key);
  await page.waitForFunction(({axis,target,positive})=>{
    const s=document.querySelector('#castle');if(s.dataset.phase!=='playing')return true;
    const p=document.querySelector('#harker').getAttribute('transform').match(/[\d.-]+/g).map(Number),n=p[axis==='x'?0:1];return positive?n>=target:n<=target;
  },{axis,target,positive},{timeout:6500,polling:'raf'});
  if(touch)await touch.up();else await page.keyboard.up(key);
  const after=await read(page);assert.notEqual(after.phase,'caught',`caught at ${after.x},${after.y} going ${dir}, t=${after.time}`);
}
async function waitLeft(page,i,limit){
  await page.waitForFunction(({i,limit})=>{
    const el=document.querySelector('#patrol-'+i),x=Number(el.getAttribute('transform').match(/[\d.-]+/g)[0]);
    const angle=Number(el.querySelector('.cloak').getAttribute('transform').match(/[\d.-]+/g)[0]);return x<limit&&Math.abs(angle-270)<.01;
  },{i,limit},{timeout:18000,polling:'raf'});
}
async function win(page,touch){
  await move(page,'y',285,touch);await move(page,'y',105,touch);await waitLeft(page,1,250);
  await move(page,'x',397,touch);assert.equal((await read(page)).objective,'Reach the gate');
  await move(page,'x',500,touch);await move(page,'y',285,touch);await waitLeft(page,0,350);
  await move(page,'y',495,touch);await move(page,'x',300,touch);await move(page,'y',531,touch);
  assert.equal((await read(page)).phase,'escaped');
}
async function makeTouch(page,context){
  const cdp=await context.newCDPSession(page);
  let points=[];
  return {
    cdp,
    async down(dir,id=1){const r=await page.locator(`[data-dir="${dir}"]`).boundingBox();points.push({x:r.x+r.width/2,y:r.y+r.height/2,id});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});},
    async up(id){const released=id?points.filter(p=>p.id===id):[];points=id?points.filter(p=>p.id!==id):[];await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:released});},
    async cancel(){points=[];await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});},
    async outside(){points=points.map(p=>({...p,x:6,y:6}));await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points});}
  };
}
async function dimensions(page){
  const d=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,scrollY,board:document.querySelector('#castle').getBoundingClientRect().toJSON(),footer:document.querySelector('footer').getBoundingClientRect().toJSON()}));
  assert.ok(d.scrollWidth<=d.width,JSON.stringify(d));assert.ok(d.scrollHeight<=d.height+2,JSON.stringify(d));assert.ok(d.footer.bottom<=d.height+2,JSON.stringify(d));
  return d;
}
for(const engine of (process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'])){
  const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'];
  const browser=await ({chromium,webkit}[engine]).launch({headless:true,...(executablePath?{executablePath}:{})});
  const errors=[],requests=[];
  const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));context.on('request',r=>requests.push(r.url()));
  try{
    await page.goto(base);await page.locator('#screen-action').waitFor();await dimensions(page);await shot(page,engine+'-desktop-ready');
    // No user record may be read, cleared or overwritten by this standalone module.
    await page.evaluate(()=>localStorage.setItem('reader-preservation-sentinel','untouched'));
    await page.locator('#screen-action').click();await page.locator('#castle').focus();
    await page.keyboard.down('ArrowUp');await page.waitForTimeout(180);await page.keyboard.up('ArrowUp');await unchanged(page);
    await page.keyboard.press('Space');assert.equal((await read(page)).phase,'paused');const paused=await read(page);await page.waitForTimeout(230);assert.deepEqual(await read(page),paused);
    await page.locator('#help').click();await page.locator('#gentle').check();await page.locator('#close-notes').click();assert.equal((await read(page)).phase,'paused');
    await page.locator('#help').click();await page.locator('#gentle').uncheck();await page.keyboard.press('Escape');assert.equal(await page.locator('#notes').getAttribute('open'),null);
    await page.locator('#restart').click();await win(page);await shot(page,engine+'-desktop-win');
    await page.locator('#screen-action').click();assert.equal((await read(page)).objective,'Take the key');
    // Walk into the central patrol lane and linger. Loss must freeze the room.
    await move(page,'x',200);await move(page,'y',313);await page.waitForFunction(()=>document.querySelector('#castle').dataset.phase==='caught',null,{timeout:16000});
    const caught=await read(page);await page.waitForTimeout(200);assert.deepEqual(await read(page),caught);await shot(page,engine+'-desktop-loss');
    await page.locator('#screen-action').click();assert.equal((await read(page)).phase,'playing');assert.equal((await read(page)).objective,'Take the key');
    await page.locator('#about').click();assert.equal((await read(page)).phase,'paused');assert.match(await page.locator('blockquote').textContent(),/That key must be in the Count’s room/);await page.locator('#close-notes').click();
    assert.equal(await page.evaluate(()=>localStorage.getItem('reader-preservation-sentinel')),'untouched');assert.equal(await page.evaluate(()=>localStorage.length),1);
    assert.deepEqual(errors,[]);assert.ok(requests.every(u=>u.startsWith(new URL(base).origin+'/')));receipts.push({engine,case:'desktop',result:'passed',win:'normal keyboard route',loss:'walked to patrol lane',pause:true,source:true,readerStorage:'sentinel unchanged'});
    console.log(engine+': desktop win, loss, retry, pause, source and storage passed');
  }finally{await context.close();}

  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,reducedMotion:'reduce'});
  const phone=await mobile.newPage();phone.on('pageerror',e=>errors.push(e.message));
  try{
    await phone.goto(base);await dimensions(phone);await shot(phone,engine+'-phone-ready');
    for(const b of await phone.locator('.direction').all()){const r=await b.boundingBox();assert.ok(r.width>=44&&r.height>=44);}
    await phone.locator('#screen-action').tap();
    if(engine==='chromium'){
      const touch=await makeTouch(phone,mobile);
      await touch.down('up');await phone.waitForTimeout(220);await touch.up();const p=await read(phone);assert.ok(p.y<490);await unchanged(phone);
      await touch.down('right');await phone.waitForTimeout(100);await touch.cancel();await unchanged(phone);assert.equal(await phone.locator('.direction[aria-pressed="true"]').count(),0);
      await touch.down('left',1);await touch.down('up',2);await phone.waitForTimeout(120);await touch.up(1);const a=await read(phone);await phone.waitForTimeout(120);const b=await read(phone);assert.ok(b.y<a.y);assert.equal(b.x,a.x);await touch.up();await unchanged(phone);
      await touch.down('down');await touch.outside();await phone.waitForTimeout(100);await touch.up();await unchanged(phone);assert.equal(await phone.evaluate(()=>scrollY),0);
      await phone.locator('#pause').tap();await phone.locator('#restart').tap();await win(phone,touch);await shot(phone,engine+'-phone-touch-win');console.log(engine+': full trusted-touch escape passed');
      await phone.locator('#screen-action').tap();await touch.down('up');await phone.setViewportSize({width:844,height:390});await touch.up();assert.equal((await read(phone)).phase,'paused');await unchanged(phone);await dimensions(phone);await shot(phone,engine+'-landscape-paused');
      await phone.locator('#screen-action').tap();await touch.down('up');await phone.waitForTimeout(160);await touch.cancel();await unchanged(phone);await shot(phone,engine+'-landscape-play');
    } else {
      // WebKit's public touchscreen API supplies trusted taps, not touch holds.
      const before=await read(phone);await phone.locator('[data-dir="up"]').tap();await unchanged(phone);const after=await read(phone);assert.ok(after.y<=before.y);
      await phone.setViewportSize({width:844,height:390});assert.equal((await read(phone)).phase,'paused');await dimensions(phone);await shot(phone,engine+'-landscape-paused');
      await phone.locator('#screen-action').tap();await phone.keyboard.down('ArrowUp');await phone.waitForTimeout(160);await phone.keyboard.up('ArrowUp');await unchanged(phone);await shot(phone,engine+'-landscape-play');
    }
    await phone.setViewportSize({width:375,height:667});await dimensions(phone);await shot(phone,engine+'-small-phone-paused');
    await phone.locator('#help').tap();await shot(phone,engine+'-phone-help');await phone.locator('#close-notes').tap();
    await phone.setViewportSize({width:820,height:1180});await dimensions(phone);await phone.locator('#screen-action').tap();await shot(phone,engine+'-tablet-play');await phone.locator('#pause').tap();
    assert.deepEqual(errors,[]);receipts.push({engine,case:'touch-layouts',result:'passed',sizes:['390×844','844×390','375×667','820×1180'],touch:engine==='chromium'?'trusted multi-touch holds, release, cancel, capture outside, full win':'trusted taps and release; holds not supported by WebKit automation',rotation:'paused and cleared input',reducedMotion:true});
    console.log(engine+': mobile/tablet sizing, touch controls, rotation and reduced motion passed');
  }finally{await mobile.close();await browser.close();}
}
await writeFile(new URL('browser-receipt.json',out),JSON.stringify({date:'2026-10-17',base,receipts,limits:['Emulation; no physical phone/tablet test','No screen-reader playthrough','Manual play acceptance is separate from automated reachability','No offline service worker or persisted game progress']},null,2)+'\n');
console.log('All browser checks passed.');
