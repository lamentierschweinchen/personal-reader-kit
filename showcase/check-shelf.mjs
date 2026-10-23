// Exercise the actual homepage shelf, including its static recovery path.
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {buildShowcase} from './build.mjs';
import {serve} from './serve.mjs';

if(!process.argv.includes('--skip-build'))await buildShowcase();
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=new URL('../test-results/shelf/',import.meta.url);
await mkdir(output,{recursive:true});
const receiptFile=new URL('receipt.json',output);
await writeFile(receiptFile,JSON.stringify({passed:false,reason:'Shelf checks have not completed.'})+'\n');
const metadata=JSON.parse(await readFile(new URL('./library/entries.json',import.meta.url),'utf8'));
const runtimeFiles=['index.html','home.mjs','style.css','shelf/app.mjs','shelf/style.css','shelf/covers.css'];
const buildHashes=()=>Promise.all(runtimeFiles.map(async file=>({file,sha256:createHash('sha256').update(await readFile(new URL('./dist/'+file,import.meta.url))).digest('hex')})));
const testedFiles=await buildHashes();
const order=['alice','mountains','at-table','beside-the-bed','dracula','poe','inward-life','learning-to-see','douglass','nietzsche','odyssey','austen','two-halls','walden','war-and-peace','music-and-feeling'];
const titles=new Map(metadata.editions.map(b=>[b.id,b.title]));
const sizes=[{width:320,height:740},{width:390,height:844},{width:844,height:390},{width:768,height:1024},{width:1024,height:768},{width:1280,height:900},{width:1281,height:900},{width:1366,height:900},{width:1440,height:1000}];
const server=await serve(),base='http://127.0.0.1:'+server.address().port,receipts=[];
const pick=(page,id)=>page.locator(`#samples [data-shelf-book="${id}"]`);
const selected=page=>page.locator('#samples .book-pick[aria-pressed="true"]').getAttribute('data-shelf-book');

async function settled(page,{scripted=true}={}){
 await page.evaluate(()=>document.fonts.ready);
 // A context with JavaScript disabled does not dispatch main-world animation
 // frame callbacks, even though the automation can inspect its DOM.
 if(!scripted)return;
 await page.evaluate(async()=>{
  await Promise.allSettled([...document.images].filter(i=>i.complete).map(i=>i.decode()));
  await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 });
 // CSSOM smooth scrolling is not returned by getAnimations(). Wait for the
 // native shelf viewport to stop, without assigning scroll positions.
 await page.evaluate(async()=>{
  const shelf=document.querySelector('#samples .bookcase');if(!shelf)return;
  let last=shelf.scrollLeft,same=0;
  for(let i=0;i<120&&same<6;i++){
   await new Promise(requestAnimationFrame);
   const next=shelf.scrollLeft;same=Math.abs(next-last)<.25?same+1:0;last=next;
  }
 });
}

async function ready(page){
 await page.locator('#samples .shelf-interactive:not([hidden])').waitFor();
 await page.locator('#samples').scrollIntoViewIfNeeded();await settled(page);
}

function monitor(page){
 const errors=[],external=[],badResponses=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('request',request=>{if(!request.url().startsWith(base+'/')&&!request.url().startsWith('data:'))external.push(request.url());});
 page.on('response',response=>{if(response.status()>=400)badResponses.push({url:response.url(),status:response.status()});});
 return {errors,external,badResponses};
}

async function layout(page,label,{fallback=false}={}){
 const metrics=await page.locator('#samples').evaluate((root,fallback)=>{
  const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
  const controls=[...root.querySelectorAll('a,button')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return{label:e.getAttribute('aria-label')||e.textContent.trim(),width:r.width,height:r.height};});
  const text=[...root.querySelectorAll('.shelf-heading h2,.chosen-author,.chosen-bibliography h3,.chosen-feature')].filter(visible).map(e=>({label:e.textContent.trim(),width:e.clientWidth,scroll:e.scrollWidth}));
  const images=[...root.querySelectorAll('img')].filter(visible).map(e=>({src:e.getAttribute('src'),complete:e.complete,width:e.naturalWidth}));
  const box=root.querySelector('.bookcase')?.getBoundingClientRect();
  const book=root.querySelector('.shelf-volume.is-selected .book-front')?.getBoundingClientRect();
  return{width:innerWidth,scroll:document.documentElement.scrollWidth,controls,text,images,selectedVisible:fallback||!book||!box||book.left>=Math.max(0,box.left)-1&&book.right<=Math.min(innerWidth,box.right)+1};
 },fallback);
 const invalid=metrics.scroll>metrics.width||metrics.controls.some(c=>c.width<43.9||c.height<43.9)||metrics.text.some(t=>t.scroll>t.width+1)||metrics.images.some(i=>!i.complete||!i.width)||(!fallback&&!metrics.selectedVisible);
 if(invalid)await page.locator('#samples').screenshot({path:fileURLToPath(new URL('failure-'+label.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.png',output))});
 assert.ok(metrics.scroll<=metrics.width,label+' page overflow: '+JSON.stringify(metrics));
 assert.ok(metrics.controls.every(c=>c.width>=43.9&&c.height>=43.9),label+' small target: '+JSON.stringify(metrics.controls.filter(c=>c.width<43.9||c.height<43.9)));
 assert.ok(metrics.text.every(t=>t.scroll<=t.width+1),label+' clipped interface text: '+JSON.stringify(metrics.text));
 assert.ok(metrics.images.every(i=>i.complete&&i.width>0),label+' missing cover image: '+JSON.stringify(metrics.images));
 if(!fallback)assert.ok(metrics.selectedVisible,label+' selected book is not wholly visible');
 return{width:metrics.width,targets:metrics.controls.length,loadedImages:metrics.images.length};
}

async function state(page,id,label){
 assert.equal(await selected(page),id,label+' selected control');
 assert.equal(await page.locator('#samples .shelf-volume.is-selected').getAttribute('data-volume'),id,label+' selected volume');
 assert.equal(await page.locator('#chosen-book h3').textContent(),titles.get(id),label+' title');
 assert.equal(new URL(await page.locator('#chosen-book .chosen-read').getAttribute('href'),base).pathname,'/'+id+'/',label+' reader path');
 assert.equal(await page.locator('#samples .shelf-volume.is-faceout').count(),page.viewportSize().width<=1280?1:3,label+' face-out count');
 assert.equal(await page.locator('#samples .shelf-fallback').isVisible(),false,label+' fallback hidden after enhancement');
}

async function screenshot(page,name,options){
 await page.locator('#samples').scrollIntoViewIfNeeded();await settled(page,options);
 await page.locator('#samples').screenshot({path:fileURLToPath(new URL(name+'.png',output))});
}

async function keyboardJourney(page){
 await pick(page,'dracula').focus();await settled(page);
 await state(page,'alice','Plain focus preserves selection');
 await page.keyboard.press('Space');await settled(page);await state(page,'dracula','Space activates');
 await page.keyboard.press('ArrowRight');await settled(page);await state(page,'poe','Right arrow');
 await page.keyboard.press('Home');await settled(page);await state(page,'alice','Home');
 await page.keyboard.press('End');await settled(page);await state(page,'music-and-feeling','End');
 await page.keyboard.press('ArrowLeft');await settled(page);await state(page,'war-and-peace','Left arrow');
 await pick(page,'at-table').focus();await page.keyboard.press('Enter');await settled(page);await state(page,'at-table','Enter activates');
 assert.equal(await page.locator('#selection-status').getAttribute('aria-live'),'polite');
 assert.match(await page.locator('#selection-status').textContent(),/At Table/);
 assert.equal(await pick(page,'at-table').evaluate(e=>e===document.activeElement),true,'Selection keeps keyboard focus');
}

async function swipe(cdp,{x,y,dx,dy}){
 const point=(x,y)=>[{id:1,x,y,radiusX:5,radiusY:5,force:1}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:point(x,y)});
 for(let i=1;i<=12;i++){
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:point(x+dx*i/12,y+dy*i/12)});
  await new Promise(resolve=>setTimeout(resolve,16));
 }
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}

try{
 for(const engine of ['chromium','webkit']){
  const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'];
  const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  try{
   for(const viewport of sizes){
    const context=await browser.newContext({viewport,hasTouch:viewport.width<=1280,reducedMotion:'reduce'});
    try{
     const page=await context.newPage(),network=monitor(page);await page.goto(base);await ready(page);
     assert.deepEqual(await page.locator('#samples .book-pick').evaluateAll(es=>es.map(e=>e.dataset.shelfBook)),order,'Alphabetical title order');
     assert.deepEqual(await page.locator('#samples .shelf-volume.is-faceout').evaluateAll(es=>es.map(e=>e.dataset.volume)),viewport.width<=1280?['alice']:['alice','at-table','walden'],'Approved starting covers');
     await state(page,'alice','Initial');await layout(page,engine+' '+viewport.width+' initial');
     assert.ok(await page.locator('#samples .book-object').evaluateAll(es=>es.every(e=>getComputedStyle(e).transitionDuration.split(',').every(s=>parseFloat(s)===0))),'Reduced motion removes book transitions');
     await screenshot(page,`${engine}-${viewport.width}x${viewport.height}`);
     // Both components must retain independent state and typography.
     await page.locator('.hero [data-pick="money"]').click();await ready(page);await state(page,'alice','Hero leaves shelf alone');
     await keyboardJourney(page);
     for(const id of order){
      await pick(page,id).click();await settled(page);await state(page,id,id);await layout(page,engine+' '+viewport.width+' '+id);
      assert.equal(await page.locator('.hero').getAttribute('data-thread'),'money','Shelf leaves hero alone');
     }
     if(viewport.width<=1280){
      assert.equal(await page.locator('[data-shelf-step="1"]').isDisabled(),true,'Last book disables Next');
      await page.locator('[data-shelf-step="-1"]').click();await settled(page);await state(page,'war-and-peace','Previous control');
      await pick(page,'alice').focus();await page.keyboard.press('Home');await settled(page);
      assert.equal(await page.locator('[data-shelf-step="-1"]').isDisabled(),true,'First book disables Previous');
      await page.locator('[data-shelf-step="1"]').click();await settled(page);await state(page,'mountains','Next control');
     }
     assert.deepEqual(network,{errors:[],external:[],badResponses:[]});
     receipts.push({engine,viewport,allSelections:true,keyboard:true,heroIsolation:true,layout:true,reducedMotion:true});
     console.log(JSON.stringify({engine,viewport,allSelections:'passed'}));
    }finally{await context.close();}
   }

   // Normal animation: hover changes only elevation; rapid navigation and a
   // breakpoint crossing must end with the selected cover and link aligned.
   const animated=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
   try{
    const page=await animated.newPage(),network=monitor(page);await page.goto(base);await ready(page);
    await page.mouse.move(0,0);await settled(page);
    const inward=pick(page,'inward-life'),object=inward.locator('.book-object');
    const before=await object.evaluate(e=>({transform:getComputedStyle(e).transform,y:e.getBoundingClientRect().y}));
    await inward.hover();await settled(page);
    const after=await object.evaluate(e=>({transform:getComputedStyle(e).transform,y:e.getBoundingClientRect().y}));
    assert.equal(after.transform,before.transform,'Hover preserves the book rotation');
    assert.ok(Math.abs(after.y-before.y+5)<.75,'Hover lifts the whole book by 5px');
    await state(page,'alice','Hover is not selection');
    await inward.click();await settled(page);await state(page,'inward-life','Click turns');
    await screenshot(page,engine+'-desktop-inward');
    await pick(page,'alice').focus();await page.keyboard.press('Home');
    for(let i=0;i<order.length-1;i++)await page.keyboard.press('ArrowRight');
    await settled(page);await state(page,'music-and-feeling','Rapid keyboard changes');await layout(page,engine+' rapid desktop');
    for(const width of [1280,1281,390,1280]){
     await page.setViewportSize({width,height:900});await settled(page);await state(page,'music-and-feeling','Resize '+width);await layout(page,engine+' resize '+width);
    }
    await page.setViewportSize({width:390,height:844});await settled(page);
    await pick(page,'austen').click();await settled(page);await page.locator('#chosen-book .chosen-read').click();
    await page.locator('#offline-status').filter({hasText:'Available offline'}).waitFor({timeout:60000});
    assert.equal(new URL(page.url()).pathname,'/austen/','Reading link opens the chosen reader');
    await page.goBack();await ready(page);await layout(page,engine+' reader return');
    assert.deepEqual(network,{errors:[],external:[],badResponses:[]});
    receipts.push({engine,animated:true,hoverLift:true,rapidKeys:true,breakpointContinuity:true,readerRoundTrip:true});
   }finally{await animated.close();}

   // Decorative jackets retain their artwork sizing; all actual shelf copy
   // doubles, including fixed-pixel labels, to exercise readable reflow.
   for(const width of [320,390,768]){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    try{
     const page=await context.newPage();await page.goto(base);await ready(page);await pick(page,'two-halls').click();await settled(page);
     await page.locator('#samples').evaluate(root=>{
      const es=[root,...root.querySelectorAll('*')].filter(e=>!e.closest('.book-object,.shelf-fallback,template'));
      const sizes=es.map(e=>parseFloat(getComputedStyle(e).fontSize));es.forEach((e,i)=>e.style.fontSize=sizes[i]*2+'px');
     });
     await settled(page);await layout(page,engine+' '+width+' doubled text');
     await screenshot(page,`${engine}-${width}-text-200`);receipts.push({engine,width,text200:true});
    }finally{await context.close();}
   }

   for(const fallback of ['no-javascript','blocked-module'])for(const width of [390,1280]){
    const context=await browser.newContext({viewport:{width,height:900},javaScriptEnabled:fallback!=='no-javascript',reducedMotion:'reduce'});
    try{
     const page=await context.newPage();if(fallback==='blocked-module')await page.route('**/shelf/app.mjs',route=>route.abort());
     await page.goto(base);await page.locator('#samples .shelf-fallback').waitFor();await page.locator('#samples').scrollIntoViewIfNeeded();await settled(page,{scripted:fallback!=='no-javascript'});
     assert.equal(await page.locator('#samples .shelf-interactive').isVisible(),false,'No dead shelf controls');
     assert.deepEqual(await page.locator('#samples .shelf-fallback a').evaluateAll(es=>es.map(e=>new URL(e.href).pathname)),order.map(id=>'/'+id+'/'),'All reader links survive '+fallback);
     await layout(page,engine+' '+width+' '+fallback,{fallback:true});
     await screenshot(page,`${engine}-${width}-${fallback}`,{scripted:fallback!=='no-javascript'});
     await page.locator('#samples .shelf-fallback a[href="/alice/"]').click();await page.waitForURL('**/alice/');
     assert.equal(new URL(page.url()).pathname,'/alice/','Static link navigates');
     receipts.push({engine,width,fallback,allLinks:true});
    }finally{await context.close();}
   }

   const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
   try{
    const page=await touch.newPage(),network=monitor(page);await page.goto(base);await ready(page);
    if(engine==='chromium'){
     const cdp=await touch.newCDPSession(page),box=await page.locator('.bookcase').boundingBox();
     const start=await page.locator('.bookcase').evaluate(e=>e.scrollLeft);
     await swipe(cdp,{x:box.x+box.width-30,y:box.y+box.height*.5,dx:-230,dy:0});await settled(page);
     const finish=await page.locator('.bookcase').evaluate(e=>e.scrollLeft);
     assert.ok(finish>start+60,'Native touch drag scrolls the shelf');await state(page,'alice','Swiping does not select');
     const yBefore=await page.evaluate(()=>scrollY),nextBox=await page.locator('.bookcase').boundingBox();
     await swipe(cdp,{x:195,y:Math.min(700,nextBox.y+nextBox.height*.6),dx:0,dy:-130});await settled(page);
     assert.ok(await page.evaluate(()=>scrollY)>yBefore+30,'A vertical touch drag over the shelf scrolls the page');
     await cdp.detach();
    }
    await pick(page,'inward-life').tap();await settled(page);await state(page,'inward-life','Touch activates');await layout(page,engine+' touch');
    await screenshot(page,engine+'-phone-touch-inward');assert.deepEqual(network,{errors:[],external:[],badResponses:[]});
    receipts.push({engine,touchTap:true,nativeTouchDrag:engine==='chromium',dragScope:engine==='chromium'?'Chromium protocol touch input, not physical-device evidence':'WebKit tap and layout only; no native drag API'});
   }finally{await touch.close();}
  }finally{await browser.close();}
 }
 assert.deepEqual(await buildHashes(),testedFiles,'The tested homepage build stayed unchanged during the run');
 const receipt={checkedAt:new Date().toISOString(),passed:true,testedFiles,receipts,
  screenshots:{chromium:'Captured pixels require separate visual review.',webkit:process.platform==='darwin'?'macOS WebKit snapshot capture can flatten nested 3D and show blank/mirrored book backs. The same defect was reproduced in an isolated 3D control while the actual native window rendered correctly. These snapshot PNGs are not shelf visual acceptance; inspect the native window separately. See https://github.com/microsoft/playwright/issues/21620.':'Captured pixels require separate visual review; geometry checks do not prove 3D painting.'},
  limits:'Chromium/WebKit browser automation, including Chromium native scrolling driven by protocol touch events. Screenshots require separate visual review and the documented WebKit capture limit applies. This does not establish physical iOS gestures, screen-reader acceptance or device performance.'};
 await writeFile(receiptFile,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:true,checks:receipts.length,engines:['chromium','webkit']}));
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
