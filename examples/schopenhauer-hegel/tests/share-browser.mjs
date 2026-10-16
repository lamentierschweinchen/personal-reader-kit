import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fromText} from '../site/core.mjs';

const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=Number(process.env.TEST_PORT||4294),base=`http://127.0.0.1:${port}`,out=new URL('../.reader/reports/sharing/',import.meta.url);
const book=await fromText('  A window holds the afternoon, λόγος →\n    and leaves the margin open.\n\n\n\nThe second stanza keeps its space. <script> is only text.\n\n'+Array(24).fill('Another original line leaves room to return to the same reading place.').join('\n'),{title:'Original passage sharing fixture',author:'A fixture author',kind:'verse'});
book.edition='Original browser fixture · 2026';
const section=book.sections[0],quote=section.blocks[0].text+section.blocks[0].after+section.blocks[1].text;
const payload={title:book.title,text:quote+'\n\n— '+book.author+' · '+book.title+'\n'+section.title+'\n'+book.edition};
const draft='PRIVATE NOTE SENTINEL\nThis reflection must stay on this device.';
const viewports=[['phone',402,874],['phone-landscape',874,402],['tablet',820,1180],['tablet-landscape',1180,820],['narrow',320,740]];
const records=[];let server;
await mkdir(out,{recursive:true});
const receipt=(passed,extra={})=>writeFile(new URL('receipt.json',out),JSON.stringify({checkedAt:new Date().toISOString(),passed,records,...extra},null,2)+'\n');
const state=p=>p.evaluate(async()=>(await import('/db.mjs')).loadState());
async function savedPlace(p,id){for(let attempt=0;attempt<100;attempt++){const value=(await state(p)).positions[id];if(value)return value;await p.waitForTimeout(50);}throw Error('Reading place was not persisted');}
async function start(){server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});let stderr='';server.stderr.on('data',b=>stderr+=b);await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{if(b.toString().includes('local only'))resolve();});server.on('exit',()=>reject(Error(stderr)));});}
async function stop(){if(server&&server.exitCode===null){server.kill();await once(server,'exit');}server=null;}
async function settle(p){await p.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));});await p.waitForTimeout(80);}
async function shot(p,name){await p.mouse.move(0,0);await settle(p);await p.screenshot({path:new URL(name+'.png',out).pathname,animations:'disabled'});}
async function close(p){await p.getByRole('button',{name:'Close ×',exact:true}).click();}
async function select(p){await p.evaluate(({first,last})=>{const a=document.querySelector(`[data-block="${first}"]`),b=document.querySelector(`[data-block="${last}"]`),range=document.createRange();range.setStart(a,0);range.setEnd(b,b.childNodes.length);getSelection().removeAllRanges();getSelection().addRange(range);scrollBy(0,range.getBoundingClientRect().top-200);},{first:section.blocks[0].id,last:section.blocks[1].id});await p.locator('#selection-save').waitFor({state:'visible'});}
async function checkDialog(p){
  const geometry=await p.evaluate(()=>{
    const d=document.querySelector('#dialog'),r=d.getBoundingClientRect();
    const controls=[...d.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();return {label:e.textContent.trim(),width:b.width,height:b.height};});
    return {width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,dialogWidth:d.clientWidth,dialogScrollWidth:d.scrollWidth,left:r.left,right:r.right,controls};
  });
  assert.ok(geometry.pageWidth<=geometry.width&&geometry.dialogScrollWidth<=geometry.dialogWidth+1,JSON.stringify(geometry));
  assert.ok(geometry.left>=0&&geometry.right<=geometry.width+1,JSON.stringify(geometry));
  assert.deepEqual(geometry.controls.filter(c=>c.width<43.5||c.height<43.5),[]);
  assert.equal(await p.locator('#note-text').inputValue(),draft);
  return geometry;
}
async function continuityChecks(browser,engine){
  const ctx=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true,serviceWorkers:'block'}),p=await ctx.newPage();
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
    await ctx.addInitScript(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:undefined});Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});});
    await ctx.route('**/library.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([book])}));
    await p.goto(base);await p.getByRole('button',{name:book.title,exact:true}).waitFor();
    const local=await p.evaluate(async source=>{
      const core=await import('/core.mjs'),db=await import('/db.mjs');
      const passage=core.passageAt(source,source.sections[0],source.sections[0].blocks[0],0,20);
      await db.updateState(s=>{s.notes=[{...passage,id:'cached-source-note',updated:1,note:'An original saved source.'}];return s;});
      const local=await core.fromText(Array.from({length:80},(_,i)=>`${i}. An original paragraph for checking that a quotation dialog preserves the main reading place. `.repeat(3)).join('\n\n'),{title:'Original position fixture'});
      await db.saveBook(local);return {id:local.id,section:local.sections[0].id};
    },book);
    await p.goto(`${base}/#read/${local.id}/${local.section}`);await p.reload();await p.locator(`#reading-text[data-book="${local.id}"][data-position-ready=true]`).waitFor();
    await p.evaluate(()=>{const block=document.querySelectorAll('#reading-text [data-block]')[8],r=document.createRange();r.setStart(block.firstChild,0);r.setEnd(block.firstChild,20);getSelection().removeAllRanges();getSelection().addRange(r);});
    await p.locator('#selection-save').waitFor({state:'visible'});
    // Open in the same task as scrolling, before the 250ms position debounce can run.
    await p.evaluate(()=>{scrollTo(0,1600);window.dispatchEvent(new Event('scroll'));document.querySelector('#selection-save').click();});
    await p.locator('#note-text').fill('An unfinished local thought.');const before=await savedPlace(p,local.id);assert.ok(before.blockId);
    await p.setViewportSize({width:874,height:402});await p.evaluate(()=>{window.dispatchEvent(new Event('scroll'));window.dispatchEvent(new Event('pagehide'));});
    await p.waitForTimeout(350);const after=(await state(p)).positions[local.id];
    assert.deepEqual(after,before,'Dialog resize/pagehide changed the main place');assert.equal(await p.locator('#note-text').inputValue(),'An unfinished local thought.');
    await shot(p,`${engine}-dialog-resize-continuity`);
    await p.setViewportSize({width:402,height:874});await p.locator('#note-text').fill('');await close(p);
    await p.goto(base+'/#passages');await p.locator('[data-action=note-context][data-note=cached-source-note]').waitFor();
    let release;const gate=new Promise(resolve=>release=resolve);
    await ctx.route('**/library.json',async r=>{await gate;await r.fulfill({contentType:'application/json',body:JSON.stringify([book])});});
    await p.reload({waitUntil:'domcontentloaded'});await p.locator('.passage .recovery').waitFor();release();
    await p.locator('[data-action=note-context][data-note=cached-source-note]').waitFor();assert.equal(await p.locator('.passage .recovery').count(),0);assert.deepEqual(errors,[]);
    return {pendingPositionCapturedBeforeDialog:true,dialogResizeAndPageHideKeepPlace:true,lateEditionRefreshesSavedPassages:true};
  }finally{await ctx.close();}
}
await receipt(false,{status:'running'});
try{
  await start();
  for(const engine of process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit']){
    const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
    const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
    try{
      const continuity=await continuityChecks(browser,engine);
      const ctx=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true,serviceWorkers:'block'});
      await ctx.route('**/library.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([book])}));
      // Every sharing and clipboard API is stubbed before application code runs.
      await ctx.addInitScript(()=>{
        window.shareProbe={mode:'resolve',copyMode:'resolve',calls:[],copies:[]};
        window.stubShare=data=>{const p=window.shareProbe;p.calls.push(structuredClone(data));if(p.mode==='cancel')return Promise.reject(new DOMException('Dismissed','AbortError'));if(p.mode==='fail')return Promise.reject(new DOMException('Denied','NotAllowedError'));if(p.mode==='pending')return new Promise(resolve=>window.finishShare=resolve);return Promise.resolve();};
        Object.defineProperty(navigator,'share',{configurable:true,value:window.stubShare});
        Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>window.shareProbe.mode!=='unsupported'});
        Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:text=>{window.shareProbe.copies.push(text);return window.shareProbe.copyMode==='fail'?Promise.reject(new DOMException('Denied','NotAllowedError')):Promise.resolve();}}});
      });
      const p=await ctx.newPage(),errors=[],external=[],matrix=[];
      p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});
      await p.goto(base);await p.getByRole('button',{name:book.title,exact:true}).click();
      await p.locator(`#reading-text[data-book="${book.id}"][data-position-ready=true]`).waitFor();
      await select(p);const place=await savedPlace(p,book.id),scroll=await p.evaluate(()=>scrollY);
      const selectionTarget=await p.locator('#selection-save').boundingBox();assert.ok(selectionTarget.width>=44&&selectionTarget.height>=44);
      await shot(p,`${engine}-phone-selection`);await p.locator('#selection-save').click();
      assert.equal(await p.locator('.dialog-quote').textContent(),quote);
      assert.equal(await p.locator('.passage-sharing > p').first().innerText(),book.author+' · '+book.title+'\n'+section.title+'\n'+book.edition);
      await p.locator('#note-text').fill(draft);
      await p.getByRole('button',{name:'Share passage',exact:true}).click();await p.locator('#share-status').filter({hasText:'Delivery depends'}).waitFor();
      assert.deepEqual(await p.evaluate(()=>window.shareProbe.calls),[payload]);
      assert.equal(await p.locator('#note-text').inputValue(),draft);assert.equal((await state(p)).notes.length,0);
      assert.doesNotMatch(JSON.stringify(payload),/PRIVATE NOTE SENTINEL|127\.0\.0\.1|deviceUrl|source|sha256/);
      assert.equal(payload.text.includes(book.source.sha256),false);
      await p.evaluate(()=>window.shareProbe.mode='cancel');await p.getByRole('button',{name:'Share passage',exact:true}).click();
      await p.locator('#share-status').filter({hasText:'Share dismissed'}).waitFor();assert.equal(await p.locator('#share-fallback').isVisible(),false);
      assert.deepEqual(await p.evaluate(()=>window.shareProbe.copies),[]);assert.equal(await p.locator('#note-text').inputValue(),draft);
      await p.evaluate(()=>window.shareProbe.mode='fail');await p.getByRole('button',{name:'Share passage',exact:true}).click();
      await p.locator('#share-fallback').waitFor({state:'visible'});assert.equal(await p.locator('#share-text').inputValue(),payload.text);assert.deepEqual(await p.evaluate(()=>window.shareProbe.copies),[]);
      await p.evaluate(()=>window.shareProbe.mode='unsupported');const callCount=await p.evaluate(()=>window.shareProbe.calls.length);
      await p.getByRole('button',{name:'Share passage',exact:true}).click();assert.equal(await p.evaluate(()=>window.shareProbe.calls.length),callCount);
      await p.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));
      await p.getByRole('button',{name:'Share passage',exact:true}).click();assert.equal(await p.locator('#share-text').inputValue(),payload.text);
      await p.getByRole('button',{name:'Copy passage',exact:true}).click();await p.locator('#share-status').filter({hasText:'attribution copied'}).waitFor();
      assert.deepEqual(await p.evaluate(()=>window.shareProbe.copies),[payload.text]);assert.equal(await p.locator('#share-fallback').isVisible(),false);
      await p.evaluate(()=>window.shareProbe.copyMode='fail');await p.getByRole('button',{name:'Copy passage',exact:true}).click();await p.locator('#share-fallback').waitFor({state:'visible'});
      assert.equal(await p.locator('#share-text').inputValue(),payload.text);
      assert.deepEqual(await p.locator('#share-text').evaluate(e=>({start:e.selectionStart,end:e.selectionEnd})),{start:0,end:payload.text.length});
      // Keep the draft while a device response is pending; prevent duplicate actions.
      await p.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:window.stubShare});window.shareProbe.mode='pending';});
      await p.getByRole('button',{name:'Share passage',exact:true}).click();assert.equal(await p.locator('[data-action=copy-passage]').isDisabled(),true);
      await p.evaluate(()=>window.finishShare());await p.locator('#share-status').filter({hasText:'Delivery depends'}).waitFor();assert.equal(await p.locator('#note-text').inputValue(),draft);
      let dismissals=0;const dismiss=d=>{dismissals++;return d.dismiss();};p.on('dialog',dismiss);await close(p);await p.keyboard.press('Escape');p.off('dialog',dismiss);
      assert.equal(dismissals,2);assert.equal(await p.locator('#note-text').inputValue(),draft);
      await p.getByRole('button',{name:'Save on this device',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('#dialog').open);
      assert.ok(Math.abs((await p.evaluate(()=>scrollY))-scroll)<=1);assert.deepEqual((await state(p)).positions[book.id],place);
      const saved=(await state(p)).notes[0];assert.equal(saved.quote,quote);assert.equal(saved.note,draft);
      await p.getByRole('link',{name:'Passages',exact:true}).click();await p.getByRole('button',{name:'Edit note',exact:true}).click();
      await p.evaluate(()=>window.shareProbe.mode='resolve');await p.getByRole('button',{name:'Share passage',exact:true}).click();await p.locator('#share-status').filter({hasText:'Delivery depends'}).waitFor();
      assert.deepEqual(await p.evaluate(()=>window.shareProbe.calls.at(-1)),payload);assert.equal(await p.locator('#note-text').inputValue(),draft);await close(p);
      for(const [label,width,height] of viewports)for(const preset of ['Paper','Large print']){
        await p.setViewportSize({width,height});await p.getByRole('button',{name:'Reading settings'}).click();await p.getByRole('button',{name:preset,exact:true}).click();await close(p);
        await p.getByRole('button',{name:'Edit note',exact:true}).click();await settle(p);
        matrix.push({label,preset,state:'share',...await checkDialog(p)});await shot(p,`${engine}-${label}-${preset==='Paper'?'paper':'large'}-share`);
        await p.getByRole('button',{name:'Copy passage',exact:true}).click();await p.locator('#share-fallback').waitFor({state:'visible'});
        assert.equal(await p.locator('#share-text').inputValue(),payload.text);matrix.push({label,preset,state:'manual-copy',...await checkDialog(p)});
        await shot(p,`${engine}-${label}-${preset==='Paper'?'paper':'large'}-manual-copy`);await close(p);
      }
      // Keep a saved quotation, but invalidate its edition identity in local state.
      await p.evaluate(async()=>{await(await import('/db.mjs')).updateState(s=>{s.notes[0].revision='0'.repeat(64);return s;});});
      await p.reload();await p.locator('.passage-meta .eyebrow').filter({hasText:book.title}).waitFor();await p.getByRole('button',{name:'Edit note',exact:true}).click();
      await p.getByText('Restore the exact edition to share this passage with attribution.',{exact:false}).waitFor();assert.equal(await p.locator('[data-action=share-passage],[data-action=copy-passage]').count(),0);
      assert.equal(await p.locator('.dialog-quote').textContent(),quote);assert.equal(await p.locator('#note-text').inputValue(),draft);
      // Even a forged UI event cannot bypass the module's attribution check.
      await p.evaluate(()=>{const b=document.createElement('button');b.dataset.action='share-passage';document.querySelector('#dialog').append(b);b.click();b.remove();});
      await p.locator('#dialog-error').filter({hasText:'exact edition'}).waitFor();assert.deepEqual(await p.evaluate(()=>window.shareProbe.calls),[]);
      assert.deepEqual(await p.evaluate(()=>window.shareProbe.copies),[]);await shot(p,`${engine}-mismatched-edition`);
      assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
      records.push({engine,version:browser.version(),fixture:'Original writing only; native and clipboard APIs stubbed',exactPayload:true,privateNoteExcluded:true,cancelWithoutCopy:true,unavailableAndDeniedManualText:true,savedPassageSharing:true,draftAndPlacePreserved:true,mismatchedEditionRefused:true,continuity,matrix,externalRequests:external,scriptErrors:errors,physicalDeviceTested:false,nativeDeliveryTested:false});
      console.log(engine+' sharing checks passed');await ctx.close();
    }finally{await browser.close();}
  }
  await receipt(true);
}catch(error){await receipt(false,{error:error.message});throw error;}finally{await stop();}
