import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';

// Only original, generated prose is selected or saved by this regression.
// Programmatic source ranges plus genuine browser touch activation are distinct
// from physical-device long presses and native selection-handle acceptance.
const root=fileURLToPath(new URL('../',import.meta.url));
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=new URL('../test-results/selection-touch/',import.meta.url);
await mkdir(output,{recursive:true});
const projects=['.','examples/pride-and-prejudice','examples/alice-in-wonderland','examples/walden','examples/schopenhauer-hegel','examples/odyssey','examples/dracula'].filter(project=>!process.env.SELECTION_PROJECTS||process.env.SELECTION_PROJECTS.split(',').includes(project));
assert.ok(projects.length,'Select at least one known reader project');
const reports=[];
async function serve(project) {
  const folder=path.join(root,project),{build}=await import(pathToFileURL(path.join(folder,'scripts/build.mjs')));await build();
  const server=http.createServer(async(req,res)=>{
    try {
      const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
      if(!/^[a-zA-Z0-9_.-]+$/.test(name)||name.startsWith('.'))throw Error('Not found');
      const bytes=await readFile(path.join(folder,'dist',name));
      const types={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
      res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.end(bytes);
    }catch{res.writeHead(404);res.end('Not found');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,base:'http://127.0.0.1:'+server.address().port};
}
async function ready(page,id) {
  await page.locator(`#reading-text[data-book="${id}"][data-position-ready="true"]`).waitFor();
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
}
async function select(page,long=false) {
  return page.evaluate(long=>{
    const blocks=[...document.querySelectorAll('#reading-text [data-block]')],first=blocks[0],last=long?blocks.at(-1):first;
    const edge=document.body.classList.contains('focus')?30:document.querySelector('.reader-tools').getBoundingClientRect().bottom+30;
    scrollTo(0,scrollY+first.getBoundingClientRect().top-edge);
    const point=(el,offset)=>{const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){if(offset<=node.length)return [node,offset];offset-=node.length;}throw Error('Fixture offset unavailable');};
    const range=document.createRange();range.setStart(...point(first,7));range.setEnd(...point(last,long?36:53));getSelection().removeAllRanges();getSelection().addRange(range);return range.toString();
  },long);
}
async function rejectGesture(page,kind,collapse=false,compatibilityClick=true) {
  await page.locator('#selection-save').waitFor();const box=await page.locator('#selection-save').boundingBox();
  const pointer={pointerId:77,pointerType:'touch',isPrimary:true,button:0,clientX:box.x+box.width/2,clientY:box.y+box.height/2};
  await page.locator('#selection-save').dispatchEvent('pointerdown',pointer);
  if(collapse){await page.evaluate(()=>getSelection().removeAllRanges());await page.waitForTimeout(30);assert.equal(await page.locator('#selection-save').isVisible(),true,'Pending touch retains its action until resolved');}
  if(kind==='cancel'||kind==='cancel-up')await page.locator('#selection-save').dispatchEvent('pointercancel',pointer);
  if(kind==='drag'){
    await page.locator('#selection-save').dispatchEvent('pointermove',{...pointer,clientX:pointer.clientX+30});
    await page.locator('#selection-save').dispatchEvent('pointermove',pointer);
  }
  if(kind==='hold')await page.waitForTimeout(550);
  if(kind!=='cancel')await page.locator('#selection-save').dispatchEvent('pointerup',pointer);
  // A rejected touch must not be revived by a later compatibility click.
  if(compatibilityClick)await page.locator('#selection-save').dispatchEvent('click',{detail:1});
  assert.equal(await page.locator('#dialog[open]').count(),0,kind+' must not open an editor');
  if(!compatibilityClick)await page.waitForTimeout(750);
  assert.equal(await page.locator('#selection-save').isVisible(),!collapse,kind+' discards only the cancelled snapshot');
}
for(const engine of process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit']) {
  const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
  const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  try {
    for(const project of projects) {
      const {server,base}=await serve(project),context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      try {
        await page.goto(base);await page.locator('[data-action="resume"]').first().waitFor();
        if(project==='examples/dracula') {
          await page.locator('#dialog[open] [data-action="notice-read"]').waitFor();
          await page.locator('#dialog [data-action="notice-read"]').tap();await page.locator('#dialog').waitFor({state:'hidden'});
        }
        const fixture=await page.evaluate(async()=>{
          const core=await import('/core.mjs'),db=await import('/db.mjs');
          const text='Original first paragraph: café, Greek αβγ, and an exact beginning. '.repeat(4)+'\n\n'+'Original middle paragraph with preserved words and punctuation; no borrowed book content. '.repeat(90)+'\n\n'+'Original final paragraph keeps its ending and a final distinction.';
          const book=await core.fromText(text,{title:'Original touch selection regression'});await db.saveBook(book);
          return {id:book.id,section:book.sections[0].id,title:book.sections[0].title,text};
        });
        await page.evaluate(()=>{window.selectionDialogOpens=0;const original=HTMLDialogElement.prototype.showModal;HTMLDialogElement.prototype.showModal=function(...args){window.selectionDialogOpens++;return original.apply(this,args);};});
        const cases=[['normal-short',false,false],['normal-long',false,true],['focus-short',true,false],['focus-long',true,true]];
        for(const [label,focus,long]of cases) {
          await page.evaluate(async focus=>(await import('/db.mjs')).updateState(state=>{state.notes=[];state.prefs.focus=focus;return state;}),focus);
          await page.goto(base+`/#read/${fixture.id}/${fixture.section}`);await page.reload();await ready(page,fixture.id);
          assert.equal(await page.locator('#reading-text').textContent(),fixture.text);
          assert.equal(await page.locator('.reader-heading h1').textContent(),fixture.title);
          assert.equal(await page.evaluate(()=>document.body.classList.contains('focus')),focus);
          const quote=await select(page,long);await page.locator('#selection-save').waitFor();
          const target=await page.locator('#selection-save').boundingBox();assert.ok(target.width>=44&&target.height>=44);
          if(focus)assert.equal(await page.locator('#focus-tools').isVisible(),false);
          if(label==='normal-short')for(const kind of ['cancel','drag','hold']){await rejectGesture(page,kind);assert.equal(await page.evaluate(()=>getSelection().toString()),quote);}
          if(label==='normal-short') {
            // Native browsers can collapse the range at touchstart. A rejected
            // gesture then discards its snapshot; a fresh selection is required.
            for(const kind of ['cancel','drag','hold']) {
              await select(page);await rejectGesture(page,kind,true);
              assert.equal(await page.evaluate(()=>getSelection().toString()),'');
              const fresh=await select(page);await page.locator('#selection-save').tap();await page.locator('#dialog[open] #note-text').waitFor({timeout:5000});assert.equal(await page.locator('.dialog-quote').textContent(),fresh);await page.locator('#dialog [data-action="close"]').tap();
            }
            await select(page);await rejectGesture(page,'cancel',true,false);
            // Even a delayed compatibility click cannot revive an expired range.
            await page.locator('#selection-save').dispatchEvent('click',{detail:1});assert.equal(await page.locator('#dialog[open]').count(),0);
            assert.equal(await select(page,long),quote);
            // Robustness against a malformed cancel+up sequence: an older
            // cleanup must never clear a later gesture's collapsed range.
            await rejectGesture(page,'cancel-up');await select(page);
            const box=await page.locator('#selection-save').boundingBox(),pending={pointerId:88,pointerType:'touch',isPrimary:true,button:0,clientX:box.x+box.width/2,clientY:box.y+box.height/2};
            await page.locator('#selection-save').dispatchEvent('pointerdown',pending);await page.evaluate(()=>getSelection().removeAllRanges());await page.waitForTimeout(750);
            assert.equal(await page.locator('#selection-save').isVisible(),true,'Older cleanup cannot discard the current gesture');assert.equal(await page.locator('#dialog[open]').count(),0);
            await page.locator('#selection-save').dispatchEvent('pointercancel',pending);await page.locator('#selection-save').dispatchEvent('click',{detail:1});assert.equal(await page.locator('#selection-save').isVisible(),false);
            assert.equal(await select(page,long),quote);
          }
          await page.evaluate(long=>{window.selectionDialogOpens=0;const original=HTMLDialogElement.prototype.showModal;HTMLDialogElement.prototype.showModal=function(...args){window.selectionDialogOpens++;return original.apply(this,args);};if(long)document.querySelector('#selection-save').addEventListener('touchstart',()=>getSelection().removeAllRanges(),{once:true});},label==='focus-long');await page.locator('#selection-save').tap();
          await page.locator('#dialog[open] #note-text').waitFor({timeout:5000});
          assert.equal(await page.locator('.dialog-quote').textContent(),quote);
          await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.selectionDialogOpens),1,'Touch opens exactly one editor');
          const note=`Original ${engine} ${project} ${label} note. αβγ café`;
          await page.locator('#note-text').fill(note);
          if(label==='focus-long') {
            await page.evaluate(()=>{window.savedPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='state')throw new DOMException('Original retry fixture','QuotaExceededError');return window.savedPut.apply(this,args);};});
            await page.getByRole('button',{name:'Save on this device',exact:true}).tap();await page.locator('#dialog-error').filter({hasText:/./}).waitFor();
            assert.equal(await page.locator('#note-text').inputValue(),note);assert.equal(await page.locator('.dialog-quote').textContent(),quote);
            await page.evaluate(()=>{IDBObjectStore.prototype.put=window.savedPut;});
          }
          await page.getByRole('button',{name:'Save on this device',exact:true}).tap();await page.locator('#dialog').waitFor({state:'hidden'});await ready(page,fixture.id);
          if(focus)assert.equal(await page.locator('#focus-tools').isVisible(),false);
          await page.reload();await ready(page,fixture.id);
          const saved=await page.evaluate(async()=>(await (await import('/db.mjs')).loadState()).notes);assert.equal(saved.length,1);assert.equal(saved[0].quote,quote);assert.equal(saved[0].note,note);
          await page.goto(base+'/#passages');await page.locator('[data-action="edit-note"]').tap();await page.locator('#note-text').waitFor();assert.equal(await page.locator('#note-text').inputValue(),note);assert.equal(await page.locator('.dialog-quote').textContent(),quote);
          await page.locator('#dialog [data-action="close"]').tap();
          reports.push({engine,project,label,quoteLength:quote.length,exactQuoteAndNoteReload:true,oneActivation:true,focusControlsHidden:focus||undefined});
        }
        // Native mouse and keyboard activation remain available immediately after
        // rejected touch gestures; each re-selection uses fresh original ranges.
        await page.evaluate(async()=>(await import('/db.mjs')).updateState(state=>{state.notes=[];state.prefs.focus=false;return state;}));
        await page.goto(base+`/#read/${fixture.id}/${fixture.section}`);await page.reload();await ready(page,fixture.id);
        for(const action of ['mouse','Enter','Space']) {
          const quote=await select(page);await page.locator('#selection-save').waitFor();await rejectGesture(page,'cancel');
          if(action==='mouse')await page.locator('#selection-save').click();else{await page.locator('#selection-save').focus();await page.keyboard.press(action);}
          await page.locator('#dialog[open] #note-text').waitFor({timeout:5000});assert.equal(await page.locator('.dialog-quote').textContent(),quote);await page.locator('#dialog [data-action="close"]').click();
        }
        assert.deepEqual(errors,[]);reports.push({engine,project,rejectedGestures:['cancel','drag-return','hold'],collapsedRejectedSelectionDiscarded:true,boundedSnapshotCleanup:true,olderCleanupCannotClearNewGesture:true,freshSelectionTouchRetry:true,mouseAndKeyboard:true,storageRetryPreservesDraft:true,errors});
        await writeFile(new URL('receipt.json',output),JSON.stringify(reports,null,2)+'\n');
        console.log(engine+' '+project+': touch in normal/focus, exact long selection, saves/reloads, rejection/retry and mouse/keyboard passed.');
      }finally{await context.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    }
  }finally{await browser.close();}
}
