import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=Number(process.env.TEST_PORT||4294),base=`http://127.0.0.1:${port}`,out=new URL('../.reader/reports/art-direction/',import.meta.url);
await mkdir(out,{recursive:true});
const records=[];let server;
const save=async(passed,extra={})=>writeFile(new URL('receipt.json',out),JSON.stringify({checkedAt:new Date().toISOString(),passed,records,...extra},null,2)+'\n');
await save(false,{status:'running'});
async function start(){server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});let stderr='';server.stderr.on('data',b=>stderr+=b);await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{if(b.toString().includes('local only'))resolve();});server.on('exit',()=>reject(Error(stderr)));});}
async function stop(){if(server&&server.exitCode===null){server.kill();await once(server,'exit');}server=null;}
async function settle(p){await p.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled([...document.images].map(i=>i.decode()));await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));});await p.waitForTimeout(80);}
async function shot(p,name,fullPage=false){await p.mouse.move(0,0);await settle(p);await p.waitForFunction(()=>!document.querySelector('#status')?.textContent,null,{timeout:6500});await p.screenshot({path:new URL(name+'.png',out).pathname,fullPage,animations:'disabled'});}
async function close(p){await p.getByRole('button',{name:'Close ×',exact:true}).click();}
async function preset(p,name){await p.getByRole('button',{name:'Reading settings'}).click();await p.getByRole('button',{name,exact:true}).click();await close(p);await settle(p);}
async function read(p,section='c10'){await p.goto(base+'/#read/hegel/'+section);await p.locator(`#reading-text[data-section="${section}"][data-position-ready=true]`).waitFor();await settle(p);}
async function measures(p){return p.evaluate(()=>{
 const rect=e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height,top:r.top,bottom:r.bottom};};
 const selectors='.masthead a,.masthead button,.hall-enter,.book-title,.question-row,.hall-switch button,.hall-actions button,.reader-tools button,.chapter-links a,.close-dialog,#focus-tools button,.session-heading>.text-link,.orientation summary,#reading-cue';
 const controls=[...document.querySelectorAll(selectors)].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>({label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,55),...rect(e)}));
 const small=controls.filter(r=>r.width<43.5||r.height<43.5);
 const fixed=[...document.querySelectorAll('.masthead,.reader-tools,#focus-tools')].filter(e=>e.getClientRects().length&&['fixed','sticky'].includes(getComputedStyle(e).position)).map(rect);
 const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),lum=c=>c.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((a,x,i)=>a+x*[.2126,.7152,.0722][i],0);
 const css=getComputedStyle(document.body),a=lum(rgb(css.color)),b=lum(rgb(css.backgroundColor)),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,controls:controls.length,small,chromeHeight:fixed.reduce((a,r)=>a+r.height,0),chromeOverlap:fixed.length>1?fixed[0].bottom-fixed[1].top:0,contrast};
});}
async function check(p){const m=await measures(p);assert.ok(m.scrollWidth<=m.width,JSON.stringify(m));assert.deepEqual(m.small,[]);assert.ok(m.contrast>=7);assert.ok(m.chromeOverlap<=1,'Reading controls overlap navigation: '+JSON.stringify(m));assert.equal(await p.locator('.masthead nav [aria-current=page]').count(),1);return m;}

async function hallReflow(browser,engine){
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 try{
  await p.goto(base+'/#companion/disagreement');await p.getByRole('button',{name:'Take a seat with Hegel',exact:false}).click();
  await p.locator('#reading-cue').selectOption('1');await p.setViewportSize({width:1280,height:900});await settle(p);
  const cuePositions=await p.locator('.hall-scroll').evaluateAll(panes=>panes.map(pane=>{const r=pane.getBoundingClientRect(),mark=pane.querySelector('mark.reading-cue').getBoundingClientRect();return {visible:!!pane.getClientRects().length,top:mark.top-r.top,height:r.height};}));
  assert.equal(cuePositions.length,2);for(const position of cuePositions)assert.ok(position.visible&&position.top>=0&&position.top<position.height,'Both halls must reveal the cue after widening: '+JSON.stringify(cuePositions));
  await p.setViewportSize({width:390,height:844});await settle(p);await p.locator('.hall-switch button[data-hall=schopenhauer][aria-pressed]').click();
  await p.locator('#reading-cue').selectOption('-1');await p.locator('.cross-action').click();
  assert.equal(await p.locator('.lecture-hall[data-hall=hegel] .hall-scroll').evaluate(e=>e.scrollTop),0,'From the beginning must also reset the hidden hall');
  assert.equal(await p.locator('mark.reading-cue').count(),0);

  await p.goto(base+'/#companion/winning');await p.getByRole('button',{name:'Take a seat with Hegel',exact:false}).click();await p.locator('#reading-cue').selectOption('0');
  const draft='An unfinished reflection across changes of hall and type.';
  await p.locator('#reflection').fill(draft);await p.locator('.hall-switch button[data-hall=hegel][aria-pressed]').click();
  const pane=p.locator('.lecture-hall[data-hall=hegel] .hall-scroll');await pane.evaluate(e=>e.scrollTop+=700);await settle(p);
  // Capture a source character after the reader has moved beyond the cue.
  // Successive reflows must retain this character, not choose each new line's start.
  const anchor=await pane.evaluate(e=>{
   const edge=e.getBoundingClientRect().top+18,block=[...e.querySelectorAll('[data-block]')].find(b=>b.textContent.length&&b.getBoundingClientRect().bottom>edge);
   const at=offset=>{const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){if(offset<node.length){const range=document.createRange();range.setStart(node,offset);range.setEnd(node,offset+1);return range;}offset-=node.length;}};
   let offset=0;while(offset<block.textContent.length-1&&at(offset).getBoundingClientRect().bottom<=edge)offset++;
   return {block:block.dataset.block,offset,top:at(offset).getBoundingClientRect().top-e.getBoundingClientRect().top};
  });
  const changes=[];
  async function assertPlace(change){
   await settle(p);
   const top=await pane.evaluate((e,a)=>{const block=[...e.querySelectorAll('[data-block]')].find(b=>b.dataset.block===a.block),walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let node,offset=a.offset;while((node=walker.nextNode())){if(offset<node.length){const range=document.createRange();range.setStart(node,offset);range.setEnd(node,offset+1);return range.getBoundingClientRect().top-e.getBoundingClientRect().top;}offset-=node.length;}},anchor);
   assert.ok(Math.abs(top-anchor.top)<3,`${change} lost the manually chosen character: ${JSON.stringify({anchor,top})}`);assert.equal(await p.locator('#reflection').inputValue(),draft);changes.push({change,top});
  }
  await p.setViewportSize({width:1280,height:900});await assertPlace('phone to desktop');
  await p.setViewportSize({width:390,height:844});await settle(p);await p.locator('.cross-action').click();await p.setViewportSize({width:740,height:320});await settle(p);await p.locator('.cross-action').click();await assertPlace('hidden hall after rotation');
  assert.equal(await pane.evaluate(e=>e===document.activeElement),true,'Cross must focus the receiving hall');
  await p.setViewportSize({width:390,height:844});await assertPlace('back to phone');
  await p.getByRole('button',{name:'Reading settings',exact:true}).click();await p.locator('#size').fill('36');await p.getByRole('button',{name:'Apply to my reader',exact:true}).click();await assertPlace('large type after manual reading');
  await pane.scrollIntoViewIfNeeded();await shot(p,`${engine}-manual-hall-reflow`);assert.deepEqual(errors,[]);
  return {cueShownInBothHalls:true,hiddenHallReset:true,anchor,changes,unfinishedReflectionPreserved:true,scriptErrors:errors};
 }finally{await ctx.close();}
}

try{
 await start();
 for(const engine of process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit']){
  const browser=await pw[engine].launch({headless:true,...((engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH)?{executablePath:engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH}:{})});
  try{
   const ctx=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true,serviceWorkers:'block'}),p=await ctx.newPage(),errors=[],external=[],matrix=[];
   p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
   await p.goto(base);await p.locator('.hall-entrance').nth(1).waitFor();
   for(const [label,width,height] of [['phone',402,874],['phone-landscape',874,402],['tablet',820,1180],['tablet-landscape',1180,820],['narrow',320,740]]){
    await p.setViewportSize({width,height});await p.goto(base+'/#shelf');await p.locator('.hall-entrance').nth(1).waitFor();await preset(p,'Paper');await p.evaluate(()=>scrollTo(0,0));
    const hallGeometry=await p.locator('.hall-entrance').evaluateAll(a=>a.map(e=>{const r=e.getBoundingClientRect(),h=e.querySelector('h2');return {top:r.top,bottom:r.bottom,width:r.width,font:getComputedStyle(h).fontSize};}));assert.equal(hallGeometry[0].font,hallGeometry[1].font);if(width>700){assert.ok(Math.abs(hallGeometry[0].top-hallGeometry[1].top)<1);assert.ok(Math.abs(hallGeometry[0].width-hallGeometry[1].width)<1);}else assert.ok(hallGeometry[1].top>hallGeometry[0].bottom);
    assert.equal(await p.locator('.wordmark').evaluate(e=>getComputedStyle(e).fontStyle),'normal');assert.equal(await p.locator('.masthead nav [aria-current=page]').textContent(),'Books');matrix.push({label,state:'home',...await check(p)});await shot(p,`${engine}-${label}-home`);if(['phone','tablet'].includes(label))await shot(p,`${engine}-${label}-home-full`,true);
    if(label==='tablet'){const gray=await p.addStyleTag({content:'html{filter:grayscale(1)}'});await shot(p,`${engine}-tablet-home-grayscale`);await gray.evaluate(e=>e.remove());}
    await preset(p,'Dusk');await p.evaluate(()=>scrollTo(0,0));matrix.push({label,state:'night-home',...await check(p)});await shot(p,`${engine}-${label}-night-home`);
    await preset(p,'Paper');await read(p);await p.locator('#reading-text [data-block=h0077]').evaluate(el=>{const tools=document.querySelector('.reader-tools'),edge=getComputedStyle(tools).position==='sticky'?parseFloat(getComputedStyle(tools).top)+tools.getBoundingClientRect().height+16:20;scrollTo(0,scrollY+el.getBoundingClientRect().top-edge);});matrix.push({label,state:'reading',...await check(p)});await shot(p,`${engine}-${label}-reading`);
    await preset(p,'Dusk');matrix.push({label,state:'night-reading',...await check(p)});await shot(p,`${engine}-${label}-night-reading`);
    await preset(p,'Large print');matrix.push({label,state:'large-reading',...await check(p)});await shot(p,`${engine}-${label}-large-reading`);
    if(height<500)assert.ok((await measures(p)).chromeHeight<80,'Landscape chrome consumes the reading height');
   }
   await p.setViewportSize({width:402,height:874});await preset(p,'Paper');await read(p);await p.getByRole('button',{name:'Focus',exact:true}).click();await p.waitForFunction(()=>document.body.classList.contains('focus')&&document.querySelector('#reading-text')?.dataset.positionReady==='true');await p.evaluate(()=>document.querySelector('#main').focus({preventScroll:true}));await p.keyboard.press('c');await p.locator('#focus-tools').waitFor({state:'visible'});
   await p.evaluate(async()=>{document.dispatchEvent(new Event('scroll'));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});assert.equal(await p.locator('#focus-tools').isVisible(),true);await check(p);await shot(p,`${engine}-phone-focus-recall`);
   await p.evaluate(()=>scrollBy(0,100));await p.locator('#focus-tools').waitFor({state:'hidden'});await p.keyboard.press('Escape');
   await p.goto(base+'/#companion/disagreement');await p.getByRole('button',{name:'Take a seat with Hegel',exact:false}).click();
   for(const [label,width,height] of [['phone',402,874],['phone-landscape',874,402],['tablet',820,1180],['tablet-landscape',1180,820],['narrow',320,740]]){
    await p.setViewportSize({width,height});await p.locator('.hall-switch').evaluate(el=>scrollTo(0,scrollY+el.getBoundingClientRect().top-(innerHeight<500?10:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--masthead-height'))+12)));await p.locator('.hall-scroll').evaluateAll(a=>a.forEach(e=>e.scrollTop=0));
    const switchHeight=await p.locator('.hall-switch').evaluate(e=>e.getBoundingClientRect().height);assert.ok(switchHeight<=60);assert.equal(await p.locator('.lecture-hall:visible').count(),width<=700||height<500?1:2);matrix.push({label,state:'companion',switchHeight,...await check(p)});await shot(p,`${engine}-${label}-companion`);
   }
   await p.setViewportSize({width:820,height:1180});await preset(p,'Dusk');await p.locator('.lecture-halls').evaluate(el=>scrollTo(0,scrollY+el.getBoundingClientRect().top-80));await shot(p,`${engine}-tablet-night-companion`);await check(p);
   await p.setViewportSize({width:402,height:874});await preset(p,'Large print');await read(p);await p.evaluate(()=>{const e=document.querySelector('[data-block=h0077]'),w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),n=w.nextNode(),r=document.createRange();r.setStart(n,0);r.setEnd(n,80);getSelection().removeAllRanges();getSelection().addRange(r);});await p.locator('#selection-save').click();await p.locator('#note-text').fill('This draft must remain available after a failed save.');
   await p.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...a){if(this.name==='state')throw new DOMException('Storage unavailable for this test','QuotaExceededError');return window.originalPut.apply(this,a);};});await p.getByRole('button',{name:'Save on this device',exact:true}).click();await p.locator('#dialog-error').filter({hasText:'Storage unavailable'}).waitFor();assert.equal(await p.locator('#note-text').inputValue(),'This draft must remain available after a failed save.');assert.equal(await p.evaluate(async()=>(await(await import('/db.mjs')).loadState()).notes.length),0);await p.locator('#dialog-error').scrollIntoViewIfNeeded();await shot(p,`${engine}-phone-save-failure`);await p.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut;});p.once('dialog',d=>d.accept());await close(p);
   // The imported original fixture must not steal the Hegel place before debounce.
   await preset(p,'Paper');await read(p);const next=p.getByRole('link',{name:/Next/}),newSection=decodeURIComponent((await next.getAttribute('href')).split('/').at(-1));await next.click();await p.locator(`#reading-text[data-book=hegel][data-section="${newSection}"][data-position-ready=true]`).waitFor();await p.locator('.site-footer [data-action=import]').evaluate(e=>e.click());await p.locator('#import-form').waitFor();const atImport=await p.evaluate(async()=>(await(await import('/db.mjs')).loadState()).positions.hegel);assert.equal(atImport.sectionId,newSection);
   await p.locator('#book-file').setInputFiles({name:'original-design-check.txt',mimeType:'text/plain',buffer:Buffer.from('An original test paragraph for import continuity.')});await p.getByRole('button',{name:'Add on this device',exact:false}).click();await p.locator('.personal-shelf').waitFor();assert.deepEqual(await p.evaluate(async()=>(await(await import('/db.mjs')).loadState()).positions.hegel),atImport);
   await p.emulateMedia({reducedMotion:'reduce'});await settle(p);assert.equal(await p.locator('.noticeboard').evaluate(e=>getComputedStyle(e).animationName),'none');assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   const reflow=await hallReflow(browser,engine);
   records.push({engine,version:browser.version(),matrix,reflow,importPreservesPlace:true,queuedScrollRecall:true,actualScrollHides:true,failedSaveRetainsDraft:true,unexpectedRequests:external,scriptErrors:errors,physicalDeviceTested:false});console.log(engine+' art-direction checks passed');await ctx.close();
  }finally{await browser.close();}
 }
 await save(true);
}catch(error){await save(false,{error:error.message});throw error;}finally{await stop();}
