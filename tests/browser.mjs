import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let playwright;
try {playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');}catch{throw new Error('Install Playwright for optional browser tests: npm install --no-save --package-lock=false playwright@1.62.1');}
const port=Number(process.env.TEST_PORT||4175),base=`http://127.0.0.1:${port}`,output=new URL('../test-results/',import.meta.url);
await mkdir(output,{recursive:true});
const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
let serverErrors='';server.stderr.on('data',x=>serverErrors+=x);
await new Promise((resolve,reject)=>{server.stdout.on('data',x=>{if(x.toString().includes('local only'))resolve();});server.on('exit',()=>reject(new Error('Preview server failed: '+serverErrors)));});
const engines=process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'];const receipts=[];
const state=page=>page.evaluate(async()=> (await import('/db.mjs')).loadState());
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
      const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:'))external.push(r.url());});
      await page.goto(base);await page.getByRole('button',{name:'Open the book',exact:false}).first().click();await page.waitForSelector('#reading-text');
      await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Available offline'));
      const canonical=await page.locator('#reading-text').textContent();
      const sample=JSON.parse(await readFile(new URL('../samples/library.json',import.meta.url),'utf8'))[0];
      assert.equal(canonical,sample.sections[0].blocks.map(b=>b.text+b.after).join(''));
      const quote=await select(page);await page.locator('#selection-save').click();assert.equal(await page.locator('.dialog-quote').textContent(),quote);
      await page.locator('#note-text').fill('An exact note. <img src=x onerror=alert(1)>');
      await page.evaluate(()=>{window.oldPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='state')throw new DOMException('Test quota failure','QuotaExceededError');return window.oldPut.apply(this,args);};});
      await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#dialog-error').textContent.length>0);
      assert.equal(await page.locator('#dialog').evaluate(el=>el.open),true);assert.match(await page.locator('#note-text').inputValue(),/exact note/);
      await page.evaluate(()=>{IDBObjectStore.prototype.put=window.oldPut;delete window.oldPut;});await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.waitForSelector('#reading-text mark');
      assert.equal(await page.locator('#reading-text').textContent(),canonical);assert.equal((await state(page)).notes.length,1);
      // Focus mode and appearance changes preserve the same logical block.
      await page.evaluate(()=>{const block=document.querySelector('[data-block="bell-4"]');scrollTo(0,scrollY+block.getBoundingClientRect().top-165);});
      const position=(await waitState(page,s=>s.positions.bell?.blockId && s.positions.bell.blockId!=='bell-1')).positions.bell;
      await page.getByRole('button',{name:'Focus ↗',exact:true}).click();await page.waitForFunction(()=>document.body.classList.contains('focus'));
      await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('focus'));
      await page.reload();await page.waitForSelector('#reading-text mark');assert.equal((await state(page)).positions.bell.blockId,position.blockId);
      // Exploration opens in context, and only explicit boundaries unlock passages.
      await page.getByRole('link',{name:'Companion',exact:true}).click();await page.waitForSelector('.experiment');
      assert.equal(await page.getByRole('button',{name:'Open the passage',exact:false}).count(),0);
      const before=(await state(page)).positions.bell;
      await page.getByRole('button',{name:'Choose what I’ve read'}).click();await page.locator('#boundary-bell').selectOption('3');await page.locator('#boundary-rain').selectOption('2');await page.getByRole('button',{name:'Set my boundaries'}).click();
      await page.getByRole('button',{name:'Open the passage',exact:false}).click();await page.waitForSelector('#context-text');await page.getByRole('button',{name:'Close ×',exact:true}).click();assert.deepEqual((await state(page)).positions.bell,before);
      await page.getByRole('button',{name:'02 An echo index',exact:false}).click();assert.ok(await page.locator('.echo-list li').count()>0);
      await page.getByRole('button',{name:'03 Facing pages',exact:false}).click();await page.locator('#reflection').fill('An original connection.');await page.getByRole('button',{name:'Keep this connection',exact:false}).click();assert.equal((await state(page)).reflections['facing-pages'],'An original connection.');
      await page.getByRole('button',{name:'Return to your book',exact:false}).click();await page.waitForSelector('#reading-text');assert.deepEqual((await state(page)).positions.bell,before);
      // Concurrent tabs do not overwrite each other's note collection.
      const second=await context.newPage();await second.goto(base+'/#read/bell/arrival');await second.waitForSelector('#reading-text');await select(second);await second.locator('#selection-save').click();await second.locator('#note-text').fill('A second tab’s thought.');await second.getByRole('button',{name:'Save on this device',exact:true}).click();await second.waitForFunction(()=>!document.querySelector('#dialog').open);await second.close();
      await page.getByRole('button',{name:'Reading settings'}).click();await page.getByRole('button',{name:'Dusk',exact:true}).click();assert.equal((await state(page)).notes.length,2);await page.getByRole('button',{name:'Close ×',exact:true}).click();
      // Local import: exact Unicode/whitespace, markup inert, no external requests.
      await page.getByRole('link',{name:'Books',exact:true}).click();await page.getByRole('button',{name:'Bring a book',exact:false}).click();
      const text='ὁδός — café <script>window.bad=true</script>\r\n    line two\r\n\r\n\r\nA final line.  \n';
      await page.locator('#book-file').setInputFiles({name:'original-test.txt',mimeType:'text/plain',buffer:Buffer.from(text)});await page.locator('#book-title').fill('A local test <script>');await page.locator('#book-form').selectOption('verse');await page.getByRole('button',{name:'Add on this device',exact:false}).click();
      await page.getByRole('button',{name:'A local test <script>',exact:true}).click();await page.waitForSelector('#reading-text');assert.equal(await page.locator('#reading-text').textContent(),text);assert.equal(await page.evaluate(()=>window.bad),undefined);
      await page.reload();await page.waitForSelector('#reading-text');assert.equal(await page.locator('#reading-text').textContent(),text);
      // Importing malformed backups cannot replace existing state.
      await page.getByRole('button',{name:'Reading settings'}).click();const beforeBad=(await state(page)).notes;
      await page.locator('#restore-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schema":999}')});await page.waitForFunction(()=>document.querySelector('#dialog-error').textContent.length>0);assert.deepEqual((await state(page)).notes,beforeBad);await page.getByRole('button',{name:'Close ×',exact:true}).click();
      // Responsive samples: phone, phone landscape, iPad portrait/landscape, narrow phone.
      for(const [label,width,height] of [['phone',402,874],['phone-landscape',874,402],['ipad',820,1180],['ipad-landscape',1180,820],['small',320,740]]) {
        await page.setViewportSize({width,height});await page.goto(base+'/#shelf');await page.waitForSelector('.shelf');
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label+' shelf overflow');
        await page.screenshot({path:new URL(`${engine}-${label}-shelf.png`,output).pathname,animations:'disabled'});
        await page.goto(base+'/#read/bell/arrival');await page.waitForSelector('#reading-text');await page.getByRole('button',{name:'Reading settings'}).click();await page.getByRole('button',{name:'Large print',exact:true}).click();await page.getByRole('button',{name:'Close ×',exact:true}).click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label+' reading overflow');assert.equal(await page.locator('#reading-text').textContent(),canonical);
        await page.screenshot({path:new URL(`${engine}-${label}-reading.png`,output).pathname,animations:'disabled'});
        await page.goto(base+'/#companion');await page.waitForSelector('.experiment');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,label+' companion overflow');
      }
      await page.setViewportSize({width:1180,height:820});await page.screenshot({path:new URL(`${engine}-companion.png`,output).pathname,animations:'disabled',fullPage:true});
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
      await page.getByRole('button',{name:'Close ×',exact:true}).click();
      // Corrupted persistent data remains available for recovery and is never zeroed on load.
      const brokenContext=await browser.newContext(),broken=await brokenContext.newPage();await broken.goto(base);await broken.waitForSelector('.shelf');
      await broken.evaluate(async()=>{const db=await (await import('/db.mjs')).openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({schema:999,original:'Preserve this fixture'},'reader');tx.oncomplete=resolve;tx.onerror=reject;});});
      await broken.reload();await broken.waitForSelector('#storage-warning:not([hidden])');await broken.getByRole('button',{name:'Open the book',exact:false}).first().click();await broken.waitForSelector('#reading-text');await select(broken);await broken.locator('#selection-save').click();await broken.locator('#note-text').fill('A recovery draft.');await broken.getByRole('button',{name:'Save on this device',exact:true}).click();await broken.waitForFunction(()=>document.querySelector('#dialog-error').textContent.length>0);
      assert.deepEqual(await broken.evaluate(async()=> (await import('/db.mjs')).rawState()),{schema:999,original:'Preserve this fixture'});await brokenContext.close();
      if(engine==='chromium') {
        await context.setOffline(true);await page.reload();await page.waitForSelector('.passage');assert.equal(await page.locator('.passage').count(),2);
        await page.getByRole('link',{name:'Books',exact:true}).click();await page.getByRole('button',{name:'A local test <script>',exact:true}).click();await page.waitForSelector('#reading-text');assert.equal(await page.locator('#reading-text').textContent(),text);await context.setOffline(false);
      }
      assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
      receipts.push({engine,viewports:5,textFidelity:true,annotations:true,failedStorageDraftRetained:true,independentProgress:true,spoilerBoundaries:true,multiTab:true,conflictingDraftPreserved:true,corruptDataPreserved:true,privateImport:true,backupValidation:true,offline:engine==='chromium'?'reload including local book':'pending stopped-origin check',errors,external});
      if(engine==='webkit') {
        // WebKit's emulated offline mode can reject worker responses. Stop the origin instead.
        server.kill();await once(server,'exit');await page.reload();await page.waitForSelector('.passage');assert.equal(await page.locator('.passage').count(),2);
        await page.getByRole('link',{name:'Books',exact:true}).click();await page.getByRole('button',{name:'A local test <script>',exact:true}).click();await page.waitForSelector('#reading-text');assert.equal(await page.locator('#reading-text').textContent(),text);
        await assert.rejects(()=>page.request.get(base,{timeout:2000}));receipts.at(-1).offline='stopped-origin reload including local book; direct network negative control passed';
      }
      console.log(JSON.stringify(receipts.at(-1)));
    } finally {await browser.close();}
  }
  await writeFile(new URL('browser-receipt.json',output),JSON.stringify(receipts,null,2));
} finally {if(server.exitCode===null)server.kill();}
