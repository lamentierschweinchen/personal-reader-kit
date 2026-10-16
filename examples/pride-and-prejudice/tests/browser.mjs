import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {bundleChecks} from './bundle-browser.mjs';
import {reviewChecks} from './review-browser.mjs';
import {experienceChecks,handoffChecks,quietFocusChecks,settledCapture} from './experience-browser.mjs';
const require=createRequire(import.meta.url);
let playwright;
try {playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');}catch{throw new Error('Install Playwright for optional browser tests: npm install --no-save --package-lock=false playwright@1.62.1');}
const port=Number(process.env.TEST_PORT||4175),base=`http://127.0.0.1:${port}`,output=new URL('../test-results/',import.meta.url);
await mkdir(output,{recursive:true});
const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),READER_FIXTURES:'1'},stdio:['ignore','pipe','pipe']});
let serverErrors='';server.stderr.on('data',x=>serverErrors+=x);
await new Promise((resolve,reject)=>{server.stdout.on('data',x=>{if(x.toString().includes('local only'))resolve();});server.on('exit',()=>reject(new Error('Preview server failed: '+serverErrors)));});
const engines=process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'];const receipts=[];
const state=page=>page.evaluate(async()=> (await import('/db.mjs')).loadState());
async function checkOverflow(page,label,engine) {
  const report=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].map(el=>({tag:el.tagName,class:el.className,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width})).filter(x=>x.width>0&&(x.right>innerWidth+1||x.left< -1)).slice(0,16)}));
  if(report.documentWidth>report.viewport)await settledCapture(page,{path:new URL(`${engine}-${label}-overflow.png`,output).pathname,animations:'disabled',fullPage:true});
  assert.ok(report.documentWidth<=report.viewport,label+' overflow: '+JSON.stringify(report));
}

async function offlineJourney(page,sample) {
  await page.goto(base+'/#read/bell/arrival');await page.locator('#reading-text[data-section="arrival"]').waitFor();
  assert.equal(await page.locator('#reading-text').textContent(),sample.sections[0].blocks.map(b=>b.text+b.after).join(''));
  await page.getByRole('link',{name:/Next/}).click();await page.locator('#reading-text[data-section="crossing"]').waitFor();
  assert.equal(await page.locator('#reading-text').textContent(),sample.sections[1].blocks.map(b=>b.text+b.after).join(''));
  await page.getByRole('link',{name:'Words',exact:true}).click();await page.getByRole('button',{name:'01 A listening walk',exact:false}).click();
  const before=(await state(page)).positions.bell;await page.locator('[data-action="stop"][data-stop="1"]').click();await page.getByRole('button',{name:'Open the passage',exact:false}).click();await page.locator('#context-text[data-location-ready="true"]').waitFor();assert.equal(await page.locator('#context-text').textContent(),sample.sections[1].blocks.map(b=>b.text+b.after).join(''));
  await page.getByRole('button',{name:'Close ×',exact:true}).click();await page.getByRole('button',{name:'Return to your book',exact:false}).click();await page.locator('#reading-text[data-section="crossing"]').waitFor();assert.deepEqual((await state(page)).positions.bell,before);
}

async function checkUIIcons(page) {
  const icons=await page.locator('svg.ui-icon').evaluateAll(nodes=>nodes.filter(el=>el.getBoundingClientRect().width>0).map(el=>{
    const style=getComputedStyle(el),use=el.querySelector('use'),box=use?.getBBox();
    return {hidden:el.getAttribute('aria-hidden'),focusable:el.getAttribute('focusable'),tabindex:el.getAttribute('tabindex'),text:el.textContent,href:use?.getAttribute('href'),drawn:box?.width>0&&box?.height>0,stroke:style.stroke,color:getComputedStyle(el.parentElement).color,strokeWidth:style.strokeWidth,width:parseFloat(style.width),font:parseFloat(style.fontSize)};
  }));
  assert.ok(icons.length>0,'Expected visible interface SVGs');
  for(const icon of icons){assert.equal(icon.hidden,'true');assert.equal(icon.focusable,'false');assert.equal(icon.tabindex,null);assert.equal(icon.text,'');assert.equal(icon.href,'#ui-arrow');assert.equal(icon.drawn,true);assert.equal(icon.stroke,icon.color);assert.equal(icon.strokeWidth,'1.5px');assert.ok(Math.abs(icon.width-.95*icon.font)<.1);}
}

async function waitState(page,predicate) {for(let i=0;i<100;i++){const value=await state(page);if(predicate(value))return value;await page.waitForTimeout(50);}throw new Error('Reader state did not reach the expected value.');}
const select=page=>page.evaluate(()=>{
  const blocks=document.querySelectorAll('#reading-text [data-block]'),range=document.createRange();
  const point=(element,offset)=>{const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){if(offset<=node.length)return [node,offset];offset-=node.length;}throw new Error('Text offset outside source.');};
  range.setStart(...point(blocks[0],10));range.setEnd(...point(blocks[1],35));const sel=getSelection();sel.removeAllRanges();sel.addRange(range);
  return blocks[0].textContent.slice(10)+'\n\n'+blocks[1].textContent.slice(0,35);
});
try {
  for(const engine of engines) {
    const executable=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
    const browser=await playwright[engine].launch({headless:true,...(executable?{executablePath:executable}:{})});
    try {
      const context=await browser.newContext({viewport:{width:402,height:874},isMobile:true,hasTouch:true}),page=await context.newPage();
      const errors=[],external=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Reader script error:',e.message);});page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:'))external.push(r.url());});
      await page.goto(base);await page.getByRole('button',{name:'Open the book',exact:false}).first().click();await page.waitForSelector('#reading-text');
      await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Available offline'));
      const canonical=await page.locator('#reading-text').textContent();
      const sample=JSON.parse(await readFile(new URL('../samples/library.json',import.meta.url),'utf8'))[0];
      assert.equal(canonical,sample.sections[0].blocks.map(b=>b.text+b.after).join(''));
      const quote=await select(page);await page.locator('#selection-save').click();assert.equal(await page.locator('.dialog-quote').textContent(),quote);
      await page.locator('#note-text').fill('An exact note. <img src=x onerror=alert(1)>');
      // Closing, Escape and browser navigation must not silently discard a draft.
      const dismissDraft=d=>d.dismiss();page.on('dialog',dismissDraft);
      await page.getByRole('button',{name:'Close ×',exact:true}).click();assert.equal(await page.locator('#dialog').evaluate(el=>el.open),true);
      await page.keyboard.press('Escape');assert.match(await page.locator('#note-text').inputValue(),/exact note/);
      const noteURL=page.url();await page.evaluate(()=>{location.hash='#shelf';});await page.waitForURL(noteURL);
      assert.match(await page.locator('#note-text').inputValue(),/exact note/);page.off('dialog',dismissDraft);
      await page.evaluate(()=>{window.oldPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='state')throw new DOMException('Test quota failure','QuotaExceededError');return window.oldPut.apply(this,args);};});
      await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#dialog-error').textContent.length>0);
      assert.equal(await page.locator('#dialog').evaluate(el=>el.open),true);assert.match(await page.locator('#note-text').inputValue(),/exact note/);
      await page.evaluate(()=>{IDBObjectStore.prototype.put=window.oldPut;delete window.oldPut;});await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.waitForSelector('#reading-text mark');
      assert.equal(await page.locator('#reading-text').textContent(),canonical);assert.equal((await state(page)).notes.length,1);
      // Focus mode and appearance changes preserve the same logical block.
      await page.evaluate(()=>{const block=document.querySelector('[data-block="bell-4"]');scrollTo(0,scrollY+block.getBoundingClientRect().top-165);});
      const position=(await waitState(page,s=>s.positions.bell?.blockId && s.positions.bell.blockId!=='bell-1')).positions.bell;
      await page.getByRole('button',{name:'Focus',exact:true}).click();await page.waitForFunction(()=>document.body.classList.contains('focus'));
      await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('focus'));
      await page.reload();await page.waitForSelector('#reading-text mark');assert.equal((await state(page)).positions.bell.blockId,position.blockId);
      // Exploration opens in context, and only explicit boundaries unlock passages.
      await page.getByRole('link',{name:'Words',exact:true}).click();await page.waitForSelector('.experiment');
      assert.equal(await page.getByRole('button',{name:'Open the passage',exact:false}).count(),0);
      const before=(await state(page)).positions.bell;
      await page.getByRole('button',{name:'Choose what I’ve read'}).click();await page.locator('#boundary-bell').selectOption('3');await page.locator('#boundary-rain').selectOption('2');await page.getByRole('button',{name:'Set my boundaries'}).click();
      await page.getByRole('button',{name:'Open the passage',exact:false}).click();await page.waitForSelector('#context-text');await page.getByRole('button',{name:'Close ×',exact:true}).click();assert.deepEqual((await state(page)).positions.bell,before);
      await page.getByRole('button',{name:'02 An echo index',exact:false}).click();assert.ok(await page.locator('.echo-list li').count()>0);
      await page.getByRole('button',{name:'03 Facing pages',exact:false}).click();await page.locator('#reflection').fill('An original connection.');await page.getByRole('button',{name:'Keep this connection',exact:false}).click();assert.equal((await state(page)).connections[0].note,'An original connection.');
      await page.getByRole('button',{name:'Return to your book',exact:false}).click();await page.waitForSelector('#reading-text');assert.deepEqual((await state(page)).positions.bell,before);
      // Concurrent tabs do not overwrite each other's note collection.
      const second=await context.newPage();await second.goto(base+'/#read/bell/arrival');await second.waitForSelector('#reading-text');await select(second);await second.locator('#selection-save').click();await second.getByRole('button',{name:'Keep as a new passage',exact:true}).click();await second.locator('#note-text').fill('A second tab’s thought.');await second.getByRole('button',{name:'Save on this device',exact:true}).click();await second.waitForFunction(()=>!document.querySelector('#dialog').open);await second.close();
      await page.getByRole('button',{name:'Reading settings'}).click();await page.getByRole('button',{name:'Dusk',exact:true}).click();assert.equal((await state(page)).notes.length,2);await page.getByRole('button',{name:'Close ×',exact:true}).click();
      // Local import: exact Unicode/whitespace, markup inert, no external requests.
      await page.getByRole('link',{name:'Book',exact:true}).click();await page.getByRole('button',{name:'Bring a book',exact:false}).click();
      const text='ὁδός — café <script>window.bad=true</script>\r\n    line two\r\n\r\n\r\nA final line.  \nSource-book arrows stay: ↗ → ➡️\n';
      await page.locator('#book-file').setInputFiles({name:'original-test.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await page.locator('#book-title').fill('A local test <script>');await page.locator('#book-form').selectOption('verse');await page.getByRole('button',{name:'Add on this device',exact:false}).click();
      await page.getByRole('button',{name:'A local test <script>',exact:true}).click();await page.waitForSelector('#reading-text');assert.equal(await page.locator('#reading-text').textContent(),text);assert.equal(await page.evaluate(()=>window.bad),undefined);
      await page.reload();await page.waitForSelector('#reading-text');assert.equal(await page.locator('#reading-text').textContent(),text);
      // Bibliographic links stay plain and underlined; source-book arrows stay exact.
      await page.evaluate(async()=>{const db=await import('/db.mjs'),{books}=await db.loadBooks(),book=books.find(b=>b.title==='A local test <script>');book.context.push({label:'Original source-link fixture',text:'Original writing for interface verification.',kind:'source',through:null,url:'https://example.invalid/original-fixture'});await db.saveBook(book);});
      await page.reload();await page.waitForSelector('#reading-text');await page.getByRole('button',{name:'About this work',exact:true}).click();
      const source=page.getByRole('link',{name:'Source',exact:true});assert.equal(await source.count(),1);assert.equal(await source.locator('svg').count(),0);assert.equal(await source.textContent(),'Source');assert.match(await source.evaluate(el=>getComputedStyle(el).textDecorationLine),/underline/);
      for(const [label,width,height] of [['phone',402,874],['ipad',820,1180]]){await page.setViewportSize({width,height});await settledCapture(page,{path:new URL(`${engine}-${label}-plain-source.png`,output).pathname,animations:'disabled'});}
      await page.getByRole('button',{name:'Close ×',exact:true}).click();assert.equal(await page.locator('#reading-text').textContent(),text);
      // Importing malformed backups cannot replace existing state.
      await page.getByRole('button',{name:'Reading settings'}).click();const beforeBad=(await state(page)).notes;
      await page.locator('#restore-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schema":999}')});await page.waitForFunction(()=>document.querySelector('#dialog-error').textContent.length>0);assert.deepEqual((await state(page)).notes,beforeBad);await page.getByRole('button',{name:'Close ×',exact:true}).click();
      // Responsive samples: phone, phone landscape, iPad portrait/landscape, narrow phone.
      for(const [label,width,height] of [['phone',402,874],['phone-landscape',874,402],['ipad',820,1180],['ipad-landscape',1180,820],['small',320,740]]) {
        await page.setViewportSize({width,height});await page.goto(base+'/#shelf');await page.waitForSelector('.shelf');
        await checkOverflow(page,label+'-shelf',engine);
        await checkUIIcons(page);assert.equal(await page.getByRole('button',{name:'Bring a book',exact:true}).count(),1);
        await settledCapture(page,{path:new URL(`${engine}-${label}-shelf.png`,output).pathname,animations:'disabled'});
        await page.goto(base+'/#read/bell/arrival');await page.waitForSelector('#reading-text');await page.getByRole('button',{name:'Reading settings'}).click();await page.getByRole('button',{name:'Large print',exact:true}).click();await page.getByRole('button',{name:'Close ×',exact:true}).click();
        await checkOverflow(page,label+'-reading',engine);assert.equal(await page.locator('#reading-text').textContent(),canonical);
        await checkUIIcons(page);assert.equal(await page.getByRole('button',{name:'Focus',exact:true}).count(),1);
        await settledCapture(page,{path:new URL(`${engine}-${label}-reading.png`,output).pathname,animations:'disabled'});
        if(label==='phone'||label==='ipad') {
          await page.locator('.chapter-links').scrollIntoViewIfNeeded();await settledCapture(page,{path:new URL(`${engine}-${label}-continuation.png`,output).pathname,animations:'disabled'});
          await page.getByRole('button',{name:'Focus',exact:true}).click();await page.waitForFunction(()=>document.body.classList.contains('focus'));await checkUIIcons(page);assert.equal(await page.getByRole('button',{name:'Exit focus',exact:true}).isVisible(),false);
          await settledCapture(page,{path:new URL(`${engine}-${label}-focus.png`,output).pathname,animations:'disabled'});await page.keyboard.press('Escape');
          await page.goto(base+'/#read/bell/crossing');await page.waitForSelector('#reading-text');await page.locator('.chapter-links').scrollIntoViewIfNeeded();await checkUIIcons(page);
          assert.equal(await page.locator('.chapter-links .ui-icon--left').count(),1);assert.equal(await page.locator('.chapter-links .ui-icon--right').count(),1);
          assert.equal(await page.getByRole('link',{name:/Previous/}).count(),1);assert.equal(await page.getByRole('link',{name:/Next/}).count(),1);
          await settledCapture(page,{path:new URL(`${engine}-${label}-both-directions.png`,output).pathname,animations:'disabled'});
        }
        await page.goto(base+'/#companion');await page.waitForSelector('.experiment');await checkOverflow(page,label+'-companion',engine);
      }
      await page.setViewportSize({width:1180,height:820});await settledCapture(page,{path:new URL(`${engine}-companion.png`,output).pathname,animations:'disabled',fullPage:true});
      await page.goto(base+'/#passages');await page.waitForSelector('.passage');assert.equal(await page.locator('.passage').count(),2);assert.equal(await page.locator('.passage img').count(),0);
      // A concurrent edit of the SAME note rejects stale replacement and keeps the draft.
      const firstNote=(await state(page)).notes[0];
      await page.locator(`[data-action="edit-note"][data-note="${firstNote.id}"]`).click();await page.locator('#note-text').fill('My unsaved concurrent draft.');
      await page.evaluate(async id=>{await (await import('/db.mjs')).updateState(s=>{const n=s.notes.find(x=>x.id===id);n.note='A newer committed edit.';n.updated+=1;return s;});},firstNote.id);
      await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#dialog-error').textContent.includes('another tab'));
      assert.equal(await page.locator('#note-text').inputValue(),'My unsaved concurrent draft.');assert.equal((await state(page)).notes.find(n=>n.id===firstNote.id).note,'A newer committed edit.');
      const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export draft',exact:true}).click();const download=await downloadPromise;
      await download.saveAs(new URL(`${engine}-private-fixture.reader-backup.json`,output).pathname);
      const draft=JSON.parse(await readFile(new URL(`${engine}-private-fixture.reader-backup.json`,output),'utf8'));assert.equal(draft.schema,1);assert.equal(draft.notes[0].note,'My unsaved concurrent draft.');
      page.once('dialog',d=>d.accept());
      await page.getByRole('button',{name:'Close ×',exact:true}).click();
      // Empty source blocks retain both visible gap size and exact selected words.
      const gaps=await page.evaluate(async()=>{
        const {renderText,readSelection}=await import('/text.mjs');
        const host=document.createElement('article');host.className='reading-surface';document.body.append(host);
        const section={id:'gap',blocks:[{id:'a',kind:'verse',text:'One',after:'\n\n',marks:[]},{id:'empty',kind:'verse',text:'',after:'\n\n',marks:[]},{id:'b',kind:'verse',text:'Two',after:'',marks:[]}]};
        const spacing=()=>host.lastElementChild.getBoundingClientRect().top-host.firstElementChild.getBoundingClientRect().top;
        renderText(host,section);const four=spacing(),leading=parseFloat(getComputedStyle(host).lineHeight);
        const range=document.createRange();range.setStart(host.firstElementChild.firstChild,0);range.setEnd(host.lastElementChild.firstChild,3);getSelection().removeAllRanges();getSelection().addRange(range);
        const quote=readSelection(host,{id:'gap-book',source:{sha256:'a'.repeat(64)}},section).quote;
        section.blocks[1].after='';renderText(host,section);const two=spacing();getSelection().removeAllRanges();host.remove();return {four,two,leading,quote};
      });
      assert.equal(gaps.quote,'One\n\n\n\nTwo');assert.ok(Math.abs(gaps.four-gaps.two-2*gaps.leading)<1,JSON.stringify(gaps));
      // A connection survives rerenders/navigation; a stale tab cannot replace it.
      const draftContext=await browser.newContext(),connection=await draftContext.newPage();await connection.goto(base+'/#companion');await connection.waitForSelector('.experiment');await connection.evaluate(async()=>{const samples=await (await fetch('/library.json')).json();await (await import('/db.mjs')).updateState(s=>{for(const b of samples)s.boundaries[b.id]={index:b.sections.length-1,revision:b.source.sha256};return s;});});await connection.reload();await connection.getByRole('button',{name:'Choose what I’ve read'}).waitFor();
      await connection.getByRole('button',{name:'03 Facing pages',exact:false}).click();await connection.locator('#reflection').fill('A connection still being written.');
      await connection.locator('[data-action="choose-prototype"]').click();assert.equal(await connection.locator('#reflection').inputValue(),'A connection still being written.');
      await connection.getByRole('link',{name:'Book',exact:true}).click();await connection.getByRole('link',{name:'Words',exact:true}).click();assert.equal(await connection.locator('#reflection').inputValue(),'A connection still being written.');
      await connection.evaluate(async()=>{const books=await (await fetch('/library.json')).json(),{passageAt}=await import('/core.mjs');const refs=[['bell','crossing','bell-8'],['rain','table','rain-4']].map(([id,sid,bid])=>{const b=books.find(b=>b.id===id),s=b.sections.find(s=>s.id===sid);return passageAt(b,s,s.blocks.find(x=>x.id===bid));});await (await import('/db.mjs')).updateState(s=>{s.connections.push({id:'concurrent-pair',passages:refs,note:'A newer connection from another tab.',updated:1});return s;});});
      await connection.getByRole('button',{name:'Keep this connection',exact:false}).click();await connection.waitForFunction(()=>document.querySelector('#status').textContent.includes('another tab'));
      assert.equal(await connection.locator('#reflection').inputValue(),'A connection still being written.');assert.equal((await state(connection)).connections[0].note,'A newer connection from another tab.');
      const connectionDownload=connection.waitForEvent('download');await connection.getByRole('button',{name:'Export connection draft',exact:true}).click();const connectionFile=await connectionDownload;
      await connectionFile.saveAs(new URL(`${engine}-connection.reader-backup.json`,output).pathname);
      assert.equal(JSON.parse(await readFile(new URL(`${engine}-connection.reader-backup.json`,output),'utf8')).connections[0].note,'A connection still being written.');await draftContext.close();
      // Corrupted persistent data remains available for recovery and is never zeroed on load.
      const brokenContext=await browser.newContext(),broken=await brokenContext.newPage();await broken.goto(base);await broken.waitForSelector('.shelf');
      await broken.evaluate(async()=>{const dbm=await import('/db.mjs'),core=await import('/core.mjs');await dbm.saveBook(await core.fromText('A healthy original fixture.',{title:'Healthy fixture'}));const db=await dbm.openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('books','readwrite');tx.objectStore('books').put({id:'damaged-fixture',schema:999,original:'Do not delete this record'});tx.oncomplete=resolve;tx.onerror=reject;});});
      await broken.reload();await broken.getByRole('button',{name:'Healthy fixture',exact:true}).waitFor();await broken.waitForSelector('#storage-warning:not([hidden])');
      await broken.getByRole('button',{name:'Reading settings'}).click();const recoveryDownload=broken.waitForEvent('download');await broken.getByRole('button',{name:'Export original recovery data',exact:true}).click();const recoveryFile=await recoveryDownload;
      await recoveryFile.saveAs(new URL(`${engine}-raw-recovery.json`,output).pathname);const recovery=JSON.parse(await readFile(new URL(`${engine}-raw-recovery.json`,output),'utf8'));
      assert.deepEqual(recovery.books.find(b=>b.id==='damaged-fixture'),{id:'damaged-fixture',schema:999,original:'Do not delete this record'});assert.ok(recovery.books.some(b=>b.title==='Healthy fixture'));await broken.getByRole('button',{name:'Close ×',exact:true}).click();
      await broken.evaluate(async()=>{const db=await (await import('/db.mjs')).openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({schema:999,original:'Preserve this fixture'},'reader');tx.oncomplete=resolve;tx.onerror=reject;});});
      await broken.reload();await broken.waitForSelector('#storage-warning:not([hidden])');await broken.getByRole('button',{name:'Open the book',exact:false}).first().click();await broken.waitForSelector('#reading-text');await select(broken);await broken.locator('#selection-save').click();await broken.locator('#note-text').fill('A recovery draft.');await broken.getByRole('button',{name:'Save on this device',exact:true}).click();await broken.waitForFunction(()=>document.querySelector('#dialog-error').textContent.length>0);
      assert.deepEqual(await broken.evaluate(async()=> (await import('/db.mjs')).rawState()),{schema:999,original:'Preserve this fixture'});await brokenContext.close();
      const independentReview=await reviewChecks({browser,base,engine,output});
      const readingExperience=await experienceChecks({browser,base,engine,output});
      const reciprocalHandoff=await handoffChecks({browser,base,engine,output});
      const quietFocus=await quietFocusChecks({browser,base,engine,output});
      const portableBundle=await bundleChecks({browser,base,engine,output});
      if(engine==='chromium') {
        await context.setOffline(true);await page.reload();await page.waitForSelector('.passage');assert.equal(await page.locator('.passage').count(),2);
        await page.getByRole('link',{name:'Book',exact:true}).click();await page.getByRole('button',{name:'A local test <script>',exact:true}).click();await page.waitForSelector('#reading-text');assert.equal(await page.locator('#reading-text').textContent(),text);await offlineJourney(page,sample);assert.equal(await page.evaluate(async()=>{try{await fetch('/network-negative-control');return false;}catch{return true;}}),true);await context.setOffline(false);
      }
      assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
      receipts.push({engine,portableBundle,independentReview,readingExperience,reciprocalHandoff,quietFocus,viewports:5,uiIcons:{sharedPath:true,decorative:true,textualNames:true,currentColor:true,plainSourceLinks:true,sourceArrowsPreserved:true},textFidelity:true,visibleStanzaGaps:true,annotations:true,draftNavigationGuard:true,connectionDraftRecovery:true,failedStorageDraftRetained:true,independentProgress:true,spoilerBoundaries:true,multiTab:true,conflictingDraftPreserved:true,corruptDataPreserved:true,partialBookRecovery:true,privateImport:true,backupValidation:true,offline:engine==='chromium'?'reload, local book, chapter navigation and companion round trip; failed direct fetch negative control':'pending stopped-origin check',errors,external});
      if(engine==='webkit') {
        // WebKit's emulated offline mode can reject worker responses. Stop the origin instead.
        server.kill();await once(server,'exit');await page.reload();await page.waitForSelector('.passage');assert.equal(await page.locator('.passage').count(),2);
        await page.getByRole('link',{name:'Book',exact:true}).click();await page.getByRole('button',{name:'A local test <script>',exact:true}).click();await page.waitForSelector('#reading-text');assert.equal(await page.locator('#reading-text').textContent(),text);
        await assert.rejects(()=>page.request.get(base,{timeout:2000}));await offlineJourney(page,sample);receipts.at(-1).offline='stopped-origin reload, local book, chapters and companion round trip; direct network negative control passed';
      }
      console.log(JSON.stringify(receipts.at(-1)));
    } finally {await browser.close();}
  }
  await writeFile(new URL('browser-receipt.json',output),JSON.stringify(receipts,null,2));
} finally {if(server.exitCode===null)server.kill();}
