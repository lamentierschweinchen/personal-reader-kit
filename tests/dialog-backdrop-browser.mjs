// Real input against the shipped runtimes; all imported text and notes below are original fixtures.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url)),output=path.resolve(process.env.REVIEW_OUTPUT||path.join(root,'test-results/dialog-backdrop'));
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const engines=process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'];
const wanted=process.env.BACKDROP_TARGETS?.split(',');
let examples=[];try{examples=(await readdir(path.join(root,'examples'),{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name);}catch(error){if(error.code!=='ENOENT')throw error;}
const targets=[{name:'starter',root},...examples.map(name=>({name,root:path.join(root,'examples',name)}))].filter(t=>!wanted||wanted.includes(t.name));
const games=[{name:'alice-in-wonderland',module:'game.mjs',dialog:'#about-dialog',close:'#close-about'},{name:'dracula',module:'app.mjs',dialog:'#notes',close:'#close-notes'},{name:'odyssey',module:'game.mjs',dialog:'#source',close:'#source form[method="dialog"] button'}].filter(t=>examples.includes(t.name)&&(!wanted||wanted.includes(t.name+'/play')));
const types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff2':'font/woff2','.ttf':'font/ttf'};
await mkdir(output,{recursive:true});const receipt={passed:false,results:[],fixture:'Original prose, source context, saved note and synthetic figure; no added historical text.'};
const settle=page=>page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
const state=page=>page.evaluate(async()=>(await import('/db.mjs')).loadState());
async function outside(page,selector='#dialog'){
 const point=await page.locator(selector).evaluate(modal=>{const r=modal.getBoundingClientRect();if(r.left>2)return{x:r.left/2,y:Math.min(innerHeight-2,Math.max(2,r.top+r.height/2))};if(r.top>2)return{x:innerWidth/2,y:r.top/2};if(r.right<innerWidth-2)return{x:(innerWidth+r.right)/2,y:innerHeight/2};if(r.bottom<innerHeight-2)return{x:innerWidth/2,y:(innerHeight+r.bottom)/2};return null;});
 assert.ok(point,'This dialog must have an actual outside area: '+selector);return point;
}
async function backdrop(page,{touch=false,selector='#dialog'}={}){const p=await outside(page,selector);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);}
async function serverFor(target,book){
 const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);if(name.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Path');
  let bytes;if(name==='backdrop-setup.html')bytes=Buffer.from('<!doctype html><title>Original fixture setup</title><p>Preparing an original local edition.</p>');else if(name==='library.json')bytes=Buffer.from(JSON.stringify([book]));else if(name==='backdrop-fixture.svg')bytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="60"><rect width="80" height="60" fill="#467b84"/></svg>');else bytes=await readFile(name.startsWith('play/')?path.join(target.root,name):path.join(target.root,'site',name));
  res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
 }catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return{origin:'http://127.0.0.1:'+server.address().port,stop:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
async function readerChecks(browser,engine,target){
 const core=await import(pathToFileURL(path.join(target.root,'site/core.mjs')));
 const book=await core.fromText(Array.from({length:40},(_,i)=>`An original window frames a blue cup. The reader keeps this sentence in view. This is fixture paragraph ${i+1}.`).join('\n\n'),{title:'Original backdrop fixture',author:'Original test writing'});
 book.id='original-backdrop-fixture';book.context=[{label:'Original source context',text:'An original source note stays beside this original paragraph. '.repeat(12),kind:'source',through:null}];core.validateBook(book);
 const note={...core.passageAt(book,book.sections[0],book.sections[0].blocks[0],0,32),id:'original-backdrop-note',note:'Original saved fixture note.',updated:1};
 const server=await serverFor(target,book),context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(10000);
 await page.addInitScript(()=>{window.__backdropEvents=[];for(const type of ['pointerdown','pointerup','pointercancel','click','scroll','close','cancel'])document.addEventListener(type,e=>{window.__backdropEvents.push({type,target:e.target?.id||e.target?.className||e.target?.nodeName,pointerId:e.pointerId,pointerType:e.pointerType,primary:e.isPrimary,button:e.button,x:e.clientX,y:e.clientY,detail:e.detail,trusted:e.isTrusted});if(window.__backdropEvents.length>100)window.__backdropEvents.shift();},true);});
 page.on('pageerror',error=>errors.push(error.message));
 const modal=page.locator('#dialog'),open=async()=>{const button=page.locator('[data-action="settings"]').first();await button.focus();await button.click();await modal.waitFor({state:'visible'});await settle(page);};
 const retained=async label=>assert.equal(await modal.evaluate(el=>el.open),true,target.name+' '+label);
 try{
  // These runtimes correctly refuse a fixture masquerading as their pinned supplied edition.
  // Exercise the same original work through their existing browser-local import contract.
  if(['beside-the-bed','fall-of-the-house-of-usher','odyssey'].includes(target.name)){await page.goto(server.origin+'/backdrop-setup.html');await page.evaluate(async book=>{await(await import('/db.mjs')).saveBook(book);},book);}
  await page.goto(server.origin+'/#read/'+book.id+'/'+book.sections[0].id,{waitUntil:'domcontentloaded'});
  await page.locator(`#reading-text[data-book="${book.id}"]`).waitFor({timeout:15000});await settle(page);
  await page.evaluate(async note=>{await(await import('/db.mjs')).updateState(s=>{s.notes=[note];return s;});},note);
  const focusState=()=>page.evaluate(()=>({tag:document.activeElement.tagName,id:document.activeElement.id,action:document.activeElement.dataset.action||null}));
  await open();await page.locator('#dialog [data-action="close"]').click();await modal.waitFor({state:'hidden'});await settle(page);const closeFocus=await focusState();
  await open();const origin=await page.evaluate(()=>({hash:location.hash,scroll:scrollY}));
  await backdrop(page);await modal.waitFor({state:'hidden',timeout:2500});await settle(page);
  assert.deepEqual(await page.evaluate(()=>({hash:location.hash,scroll:scrollY})),origin,target.name+' preserves reading place');
  assert.deepEqual(await focusState(),closeFocus,target.name+' preserves the existing Close focus return');
  await open();await backdrop(page,{touch:true});await modal.waitFor({state:'hidden'});

  await open();const p=await outside(page),inner=await page.locator('#dialog .dialog-inner > p').first().boundingBox();assert.ok(inner);
  await page.mouse.move(inner.x+30,inner.y+8);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:12});await page.mouse.up();await retained('interior selection drag remains open');
  assert.ok(await page.evaluate(()=>getSelection().toString().length>0),'The interior drag must actually select text');
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(inner.x+20,inner.y+10,{steps:8});await page.mouse.up();await retained('outside-to-inside drag remains open');
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x,p.y+35,{steps:8});await page.mouse.up();await retained('moved backdrop gesture remains open');
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.wheel(0,120);await page.mouse.up();await retained('wheel gesture remains open');
  if(engine==='chromium'&&target.name==='starter'){
   const touch=await context.newCDPSession(page),point={x:p.x,y:p.y,id:1,radiusX:1,radiusY:1,force:1};
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await touch.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await retained('real canceled touch remains open');
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point,{...point,id:2,y:p.y+30}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await retained('real multitouch remains open');await touch.detach();
  }
  await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
  await open();await page.locator('#dialog [data-action="close"]').click();await modal.waitFor({state:'hidden'});

  // Release over the newly opened backdrop must not count as a second gesture.
  await page.evaluate(()=>{window.__underlyingClicks=0;const button=document.createElement('button');button.id='backdrop-opening-fixture';button.textContent='Original opener';button.style.cssText='position:fixed;left:0;top:220px;width:12px;height:44px;z-index:10000;padding:0';button.addEventListener('pointerdown',()=>document.querySelector('[data-action="settings"]').click());button.addEventListener('click',()=>window.__underlyingClicks++);document.body.append(button);});
  await page.mouse.move(4,240);await page.mouse.down();await modal.waitFor({state:'visible'});await page.mouse.up();await retained('opening gesture remains open');
  await backdrop(page);await modal.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>window.__underlyingClicks),0,'Backdrop dismissal does not click through');await page.locator('#backdrop-opening-fixture').evaluate(el=>el.remove());
  if(target.name==='starter'){
   await open();await modal.evaluate(el=>el.addEventListener('pointerup',()=>{el.close();el.showModal();},{once:true}));await backdrop(page);await retained('a reopened modal is not dismissed by the old release');await backdrop(page);await modal.waitFor({state:'hidden'});
   await open();await modal.evaluate(el=>el.addEventListener('pointerup',()=>{const next=document.createElement('dialog');next.id='original-next-modal';next.textContent='Original new dialog.';document.body.append(next);next.showModal();},{once:true}));await backdrop(page);assert.equal(await page.locator('#original-next-modal').evaluate(el=>el.open),true,'The releasing gesture cannot dismiss its newly opened modal');await retained('a new top modal retains the original modal');await backdrop(page,{selector:'#original-next-modal'});await page.locator('#original-next-modal').waitFor({state:'hidden'});await backdrop(page);await modal.waitFor({state:'hidden'});
  }

  // Use the real guarded note editor; Cancel must preserve the draft and saved note.
  await page.goto(server.origin+'/#passages');await page.locator('[data-action="edit-note"][data-note="'+note.id+'"]').click();await page.locator('#note-text').fill('Original unsaved draft to retain.');
  let prompt;page.once('dialog',async dialog=>{prompt=dialog.message();await dialog.dismiss();});await backdrop(page);await retained('Cancel retains editor');
  assert.match(prompt,/unsaved|discard/i);assert.equal(await page.locator('#note-text').inputValue(),'Original unsaved draft to retain.');assert.deepEqual((await state(page)).notes,[note]);
  page.once('dialog',dialog=>dialog.accept());await backdrop(page,{touch:true});await modal.waitFor({state:'hidden'});assert.deepEqual((await state(page)).notes,[note]);

  await open();await page.locator('[data-action="bundle-export"]').click();await page.locator('#bundle-export-form').waitFor();await backdrop(page);await modal.waitFor({state:'hidden'});
  if(target.name==='pictures-after-dark'){
   await open();await page.evaluate(()=>{const b=document.createElement('button');b.textContent='Original fixture figure';b.dataset.folioImage='backdrop-fixture.svg';b.dataset.folioCaption='Original fixture figure';document.querySelector('.dialog-inner').append(b);});
   const figure=page.getByRole('button',{name:'Original fixture figure',exact:true}),openImage=async()=>{await figure.focus();await figure.click();await page.locator('.folio-image-dialog').waitFor({state:'visible'});await settle(page);};
   await openImage();const image=page.locator('.folio-image-dialog');await page.locator('[data-image-close]').click();await image.waitFor({state:'hidden'});await settle(page);const imageCloseFocus=await focusState(),imageCloseScroll=await modal.evaluate(el=>el.scrollTop);
   await openImage();await backdrop(page,{selector:'.folio-image-dialog',touch:true});await image.waitFor({state:'hidden'});await settle(page);await retained('secondary image returns to main modal');assert.deepEqual(await focusState(),imageCloseFocus,'Image return retains its existing focus behavior');assert.equal(await modal.evaluate(el=>el.scrollTop),imageCloseScroll,'Image return retains main dialog scroll');await backdrop(page);await modal.waitFor({state:'hidden'});
  }
  assert.deepEqual((await state(page)).notes,[note]);assert.deepEqual(errors,[]);
  return{name:target.name,engine,version:browser.version(),mouseBackdrop:true,touchBackdrop:true,interiorSelection:true,movedAndWheelGesturesRetained:true,openingGestureRetained:true,noClickThrough:true,dirtyNoteCancel:true,confirmedDismissal:true,secondaryDialog:true,readingPlaceAndFocus:true,...(target.name==='starter'?{reopenedAndNewModalRetained:true}:{}),...(engine==='chromium'&&target.name==='starter'?{realCanceledTouch:true,realMultitouch:true}:{}),...(target.name==='pictures-after-dark'?{dynamicFolio:true}:{})};
 }catch(error){await page.screenshot({path:path.join(output,engine+'-'+target.name+'-failure.png'),animations:'disabled'}).catch(()=>{});await writeFile(path.join(output,engine+'-'+target.name+'-events.json'),JSON.stringify(await page.evaluate(()=>window.__backdropEvents),null,2)+'\n');throw new Error(engine+' '+target.name+': '+error.message,{cause:error});}
 finally{await context.close();await server.stop();}
}
async function gameChecks(browser,engine,target){
 const server=await serverFor({root:path.join(root,'examples',target.name)},null),context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(10000);
 page.on('pageerror',e=>errors.push(e.message));const modal=page.locator(target.dialog),open=async()=>{await page.locator('#about').focus();await page.locator('#about').click();await modal.waitFor({state:'visible'});await settle(page);};
 const observed=()=>page.evaluate(()=>({hash:location.hash,focus:{tag:document.activeElement.tagName,id:document.activeElement.id}}));
 try{
  await page.goto(server.origin+'/play/index.html',{waitUntil:'domcontentloaded'});await page.evaluate(module=>import('/play/'+module),target.module);await settle(page);
  await open();await page.locator(target.close).click();await modal.waitFor({state:'hidden'});await settle(page);const closed=await observed();
  await open();await backdrop(page,{selector:target.dialog});await modal.waitFor({state:'hidden'});await settle(page);assert.deepEqual(await observed(),closed,target.name+' existing close route/focus');
  await open();await backdrop(page,{selector:target.dialog,touch:true});await modal.waitFor({state:'hidden'});await settle(page);assert.deepEqual(await observed(),closed,target.name+' touch close route/focus');
  await open();const p=await outside(page,target.dialog),r=await modal.boundingBox();await page.mouse.move(r.x+20,r.y+70);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:8});await page.mouse.up();assert.equal(await modal.evaluate(el=>el.open),true,target.name+' inside drag stays open');
  await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});assert.deepEqual(errors,[]);
  return{name:target.name+'/play',engine,version:browser.version(),mouseBackdrop:true,touchBackdrop:true,interiorDragRetained:true,escape:true,existingCloseRouteAndFocus:true};
 }catch(error){await page.screenshot({path:path.join(output,engine+'-'+target.name+'-play-failure.png'),animations:'disabled'}).catch(()=>{});throw new Error(engine+' '+target.name+'/play: '+error.message,{cause:error});}
 finally{await context.close();await server.stop();}
}
let browser;const failures=[];
try{
 for(const engine of engines){const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'];browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});for(const target of targets){try{receipt.results.push(await readerChecks(browser,engine,target));console.log(engine+' '+target.name+' backdrop passed');}catch(error){failures.push(error.message);console.error(error.message);}}for(const target of games){try{receipt.results.push(await gameChecks(browser,engine,target));console.log(engine+' '+target.name+'/play backdrop passed');}catch(error){failures.push(error.message);console.error(error.message);}}await browser.close();browser=null;}
 assert.deepEqual(failures,[],'All selected backdrop paths must pass');
 receipt.passed=true;
}catch(error){receipt.failure=error.message;throw error;}finally{await browser?.close();await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
