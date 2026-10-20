import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fromText,selectionQuote} from '../site/core.mjs';
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=new URL('../',import.meta.url),out=new URL('../.reader/reports/',import.meta.url),port=Number(process.env.TEST_PORT||4292),base=`http://127.0.0.1:${port}`;
const text='  A lamp waits by the door, λόγος →\n    its light resting on the stair.\n\n\n\nA second original stanza begins here.\n  The window keeps its quiet square. <script> stays literal text.';
const book=await fromText(text,{title:'Original sharing fixture',author:'A fixture author',kind:'verse'});
book.edition='Original fixture edition';book.source.description='PRIVATE_METADATA_SENTINEL';
const section=book.sections[0],segments=section.blocks.map(b=>({blockId:b.id,start:0,end:b.text.length,quote:b.text,prefix:'',suffix:''})),quote=selectionQuote(section,segments);
const expected={title:book.title,text:quote+'\n\n— '+book.author+' · '+book.title+'\n'+section.title+'\n'+book.edition};
const draft='PRIVATE_DRAFT_SENTINEL — do not share this note.';
const viewports=[['phone',402,874],['phone-landscape',874,402],['tablet',820,1180],['tablet-landscape',1180,820],['narrow',320,740]],receipts=[];
await mkdir(out,{recursive:true});
const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});let serverErrors='';server.stderr.on('data',d=>serverErrors+=d);
await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('local only'))resolve();});server.on('exit',()=>reject(Error(serverErrors||'Test server exited before ready')));});
const state=p=>p.evaluate(async()=>await(await import('/db.mjs')).loadState());
const close=p=>p.getByRole('button',{name:'Close ×',exact:true}).click();
async function capture(p,name){await p.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));});await p.waitForFunction(()=>!document.querySelector('#status').textContent);await p.screenshot({path:new URL(name+'.png',out).pathname,animations:'disabled'});}
async function status(p,pattern){await p.locator('#share-status').filter({hasText:pattern}).waitFor();}
async function sharingContinuityChecks(browser,engine){
 const context=await browser.newContext({viewport:{width:402,height:874},serviceWorkers:'block'}),page=await context.newPage();
 try{
  await context.addInitScript(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:()=>{throw Error('No device handoff belongs in the continuity check');}});Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});});
  await context.route(base+'/library.json',route=>route.fulfill({json:[book]}));
  await page.goto(base);await page.waitForFunction(()=>document.body.dataset.editionReady==='true');
  const fixture=await page.evaluate(async note=>{const core=await import('/core.mjs'),db=await import('/db.mjs');await db.updateState(s=>{s.notes=[note];return s;});const b=await core.fromText(Array.from({length:80},(_,i)=>`${i}. An original paragraph for checking that a quotation dialog preserves the main reading place. `.repeat(3)).join('\n\n'),{title:'Original position fixture'});await db.saveBook(b);return{id:b.id,section:b.sections[0].id};},{bookId:book.id,sectionId:section.id,revision:book.source.sha256,segments,quote,id:'cached-original-note',note:'A saved original passage.',updated:1});
  await page.goto(`${base}/#read/${fixture.id}/${fixture.section}`);await page.reload();await page.locator('#reading-text[data-position-ready="true"]').waitFor();
  await page.evaluate(()=>{const b=document.querySelectorAll('#reading-text [data-block]')[8],r=document.createRange();r.setStart(b.firstChild,0);r.setEnd(b.firstChild,20);getSelection().removeAllRanges();getSelection().addRange(r);});await page.locator('#selection-save:not([hidden])').waitFor();
  await page.evaluate(()=>{scrollTo(0,1600);window.dispatchEvent(new Event('scroll'));document.querySelector('#selection-save').click();});await page.locator('#note-text').fill('An unfinished original thought.');
  let before;const deadline=Date.now()+5000;while(Date.now()<deadline){before=(await state(page)).positions[fixture.id];if(before?.blockId)break;await new Promise(r=>setTimeout(r,50));}assert.ok(before?.blockId,'The pending reading location is captured before the dialog');
  await page.setViewportSize({width:874,height:402});await page.evaluate(()=>{window.dispatchEvent(new Event('scroll'));window.dispatchEvent(new Event('pagehide'));});
  // Allow the deliberately queued 250 ms save to run if it was not cancelled.
  await new Promise(r=>setTimeout(r,350));assert.deepEqual((await state(page)).positions[fixture.id],before);assert.equal(await page.locator('#note-text').inputValue(),'An unfinished original thought.');await capture(page,engine+'-share-dialog-continuity');
  await page.locator('#note-text').fill('');await close(page);await page.goto(base+'/#passages');await page.locator('[data-action="note-context"][data-note="cached-original-note"]').waitFor();
  let release;const gate=new Promise(resolve=>release=resolve);await context.route(base+'/library.json',async route=>{await gate;await route.fulfill({json:[book]});});
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.passage .recovery').waitFor();release();await page.locator('[data-action="note-context"][data-note="cached-original-note"]').waitFor();assert.equal(await page.locator('.passage .recovery').count(),0);assert.equal(await page.locator('.passage-meta .eyebrow').textContent(),book.title);
  return{pendingPositionCapturedBeforeDialog:true,dialogResizeAndPageHideKeepPlace:true,lateEditionRefreshesSavedPassages:true};
 }finally{await context.close();}
}
try{
 for(const engine of (process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'])){
  const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'],browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  try{
   const context=await browser.newContext({viewport:{width:402,height:874},serviceWorkers:'block',isMobile:true,hasTouch:true});
   // Every external-device API is replaced before the application loads.
   // Only the original writing above is passed to these in-memory stubs.
   await context.addInitScript(()=>{
    window.shareQA={mode:'success',copyMode:'success',calls:[],writes:[]};
    window.shareStub=async data=>{const q=window.shareQA;q.calls.push(structuredClone(data));if(q.mode==='cancel')throw new DOMException('Dismissed','AbortError');if(q.mode==='failure')throw new DOMException('Denied','NotAllowedError');};
    Object.defineProperty(navigator,'share',{configurable:true,value:window.shareStub});
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>window.shareQA.mode!=='unsupported'});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.shareQA.writes.push(value);if(window.shareQA.copyMode==='failure')throw new DOMException('Denied','NotAllowedError');}}});
   });
   const page=await context.newPage(),errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
   await page.goto(base);await page.waitForFunction(()=>document.body.dataset.editionReady==='true');if(await page.locator('#dialog').evaluate(e=>e.open))await close(page);
   await page.getByRole('button',{name:'Add a book',exact:false}).click();await page.locator('#book-file').setInputFiles({name:'original-sharing-fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(book))});await page.getByRole('button',{name:'Add on this device',exact:false}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
   await page.getByRole('button',{name:/Open this book/}).click();await page.locator('#reading-text[data-position-ready="true"]').waitFor();assert.equal(await page.locator('#reading-text').textContent(),text);
   await page.locator('#reading-text [data-block]').last().scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Reading settings'}).click();await close(page);const position=(await state(page)).positions[book.id],scroll=await page.evaluate(()=>scrollY);
   const selected=await page.locator('#reading-text').evaluate(e=>{const r=document.createRange();r.selectNodeContents(e);getSelection().removeAllRanges();getSelection().addRange(r);return r.toString();});assert.equal(selected,quote);
   await page.getByRole('button',{name:/Keep or share passage/}).click();assert.equal(await page.locator('.dialog-quote').textContent(),quote);assert.ok((await page.locator('.passage-sharing .small').first().textContent()).includes(book.edition));await page.locator('#note-text').fill(draft);
   await page.getByRole('button',{name:'Share passage',exact:true}).click();await status(page,/Share menu opened/);assert.deepEqual(await page.evaluate(()=>shareQA.calls),[expected]);assert.equal(await page.locator('#note-text').inputValue(),draft);
   await page.evaluate(()=>shareQA.mode='cancel');await page.getByRole('button',{name:'Share passage',exact:true}).click();await status(page,/Share dismissed/);assert.deepEqual(await page.evaluate(()=>shareQA.writes),[]);assert.equal(await page.locator('#share-fallback').isVisible(),false);assert.equal(await page.locator('#note-text').inputValue(),draft);
   await page.evaluate(()=>shareQA.mode='failure');await page.getByRole('button',{name:'Share passage',exact:true}).click();await status(page,/Sharing is unavailable/);assert.equal(await page.locator('#share-text').inputValue(),expected.text);
   await page.evaluate(()=>shareQA.mode='unsupported');const calls=await page.evaluate(()=>shareQA.calls.length);await page.getByRole('button',{name:'Share passage',exact:true}).click();await status(page,/Sharing is unavailable/);assert.equal(await page.evaluate(()=>shareQA.calls.length),calls);
   await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));await page.getByRole('button',{name:'Share passage',exact:true}).click();await status(page,/Sharing is unavailable/);assert.equal(await page.evaluate(()=>shareQA.calls.length),calls);
   await page.getByRole('button',{name:'Copy passage',exact:true}).click();await status(page,/Passage and attribution copied/);assert.deepEqual(await page.evaluate(()=>shareQA.writes),[expected.text]);
   await page.evaluate(()=>shareQA.copyMode='failure');await page.getByRole('button',{name:'Copy passage',exact:true}).click();await status(page,/Automatic copy is unavailable/);assert.equal(await page.locator('#share-text').inputValue(),expected.text);assert.deepEqual(await page.locator('#share-text').evaluate(e=>[e.selectionStart,e.selectionEnd]),[0,expected.text.length]);assert.equal(await page.locator('#note-text').inputValue(),draft);
   await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));await page.getByRole('button',{name:'Copy passage',exact:true}).click();await status(page,/Automatic copy is unavailable/);assert.equal(await page.locator('#share-text').inputValue(),expected.text);assert.equal(await page.locator('#note-text').inputValue(),draft);
   assert.deepEqual((await state(page)).positions[book.id],position);assert.equal(await page.evaluate(()=>scrollY),scroll);
   await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);assert.equal((await state(page)).notes[0].note,draft);
   await page.getByRole('link',{name:'Passages',exact:true}).click();await page.getByRole('button',{name:'Edit note',exact:true}).click();assert.equal(await page.locator('#note-text').inputValue(),draft);
   await page.evaluate(()=>{shareQA.mode='success';Object.defineProperty(navigator,'share',{configurable:true,value:shareStub});});await page.getByRole('button',{name:'Share passage',exact:true}).click();await status(page,/Share menu opened/);assert.deepEqual(await page.evaluate(()=>shareQA.calls.at(-1)),expected);await close(page);
   const geometry=[];
   for(const size of [21,36]){
    if(size===36){await page.getByRole('button',{name:'Reading settings'}).click();await page.locator('#size').focus();await page.keyboard.press('End');await page.getByRole('button',{name:'Apply to my reader'}).click();}
    for(const [label,width,height] of viewports){
     await page.setViewportSize({width,height});await page.getByRole('button',{name:'Edit note',exact:true}).click();await page.getByRole('button',{name:'Copy passage',exact:true}).click();await status(page,/Automatic copy is unavailable/);
     await page.locator('.passage-sharing').evaluate(e=>{const d=e.closest('dialog');d.scrollTop+=e.getBoundingClientRect().top-d.querySelector('.dialog-header').getBoundingClientRect().bottom-12;});
     await capture(page,engine+'-share-'+label+'-'+size);
     const buttons=page.locator('.passage-sharing').getByRole('button',{name:/^(Share passage|Copy passage|Make card)$/});assert.equal(await buttons.count(),3,'Share, copy and card actions are visible');
     const g=await buttons.evaluateAll(buttons=>{const d=buttons[0].closest('dialog'),head=d.querySelector('.dialog-header').getBoundingClientRect(),bounds=d.getBoundingClientRect();return{overflow:document.documentElement.scrollWidth>innerWidth||d.scrollWidth>d.clientWidth,buttons:buttons.map(b=>{const r=b.getBoundingClientRect();return{label:b.textContent,width:r.width,height:r.height,visible:r.top>=head.bottom-1&&r.bottom<=bounds.bottom+1};})};});
     assert.equal(g.overflow,false,engine+' '+label+' '+size);for(const b of g.buttons){assert.ok(b.width>=44&&b.height>=44,JSON.stringify(b));assert.equal(b.visible,true,'Share/copy/card remain visible below the dialog header');}geometry.push({view:label,size,...g});assert.equal(await page.locator('#share-text').inputValue(),expected.text);assert.equal(await page.locator('#note-text').inputValue(),draft);await close(page);
    }
   }
   await page.evaluate(async id=>{const db=await import('/db.mjs'),{books}=await db.loadBooks(),b=books.find(b=>b.id===id);b.source.sha256='f'.repeat(64);await db.saveBook(b);},book.id);await page.reload();await page.getByRole('button',{name:'Edit note',exact:true}).click();assert.equal(await page.locator('[data-action="share-passage"],[data-action="copy-passage"]').count(),0);assert.match(await page.locator('#dialog').textContent(),/Restore the exact edition to share/);assert.equal(await page.locator('.dialog-quote').textContent(),quote);await capture(page,engine+'-share-edition-mismatch');
   const continuity=await sharingContinuityChecks(browser,engine);
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);receipts.push({engine,exactQuotationAndAttribution:true,noNoteMetadataOrDeviceURL:true,nativeResolutionNotDelivery:true,nativeAbortWithoutCopy:true,nativeFailureUnsupportedAndAbsent:true,copyFailureAndAbsentManualText:true,savedPassageShare:true,draftAndReadingPlacePreserved:true,sourceMismatchRefused:true,continuity,geometry,scriptErrors:errors,externalRequests:external,limits:'Original writing and in-memory API stubs only. No real native sheet, recipient, clipboard write, or physical-device delivery test.'});console.log(engine,'sharing outcomes passed');
  }finally{await browser.close();await writeFile(new URL('sharing-browser.json',out),JSON.stringify({checkedAt:new Date().toISOString(),receipts},null,2)+'\n');}
 }
}finally{if(server.exitCode===null){server.kill('SIGTERM');await once(server,'exit');}}
