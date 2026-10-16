import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {settledCapture} from './experience-browser.mjs';

export async function bundleChecks({browser,base,engine,output}) {
  const source=await browser.newContext({serviceWorkers:'block',viewport:{width:402,height:874}}),page=await source.newPage();
  const destination=await browser.newContext({serviceWorkers:'block',viewport:{width:402,height:874}}),other=await destination.newPage();
  const load=page=>page.evaluate(async()=> (await import('/db.mjs')).librarySnapshot());
  const choose=async value=>{
    await other.getByRole('button',{name:'Reading settings'}).click();
    await other.locator('#bundle-file').setInputFiles({name:'fixture.reader-bundle.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(value))});
  };
  try {
    await page.goto(base);await page.getByRole('button',{name:'The distance of a bell',exact:true}).waitFor();
    const fixture=await page.evaluate(async()=>{
      const core=await import('/core.mjs'),db=await import('/db.mjs'),book=await core.fromText('Original transfer words 🕯\n    a second line\n\n\nAnother stanza.',{title:'Original portable edition',kind:'verse'});
      book.sections[0].blocks[0].marks=[{kind:'em',start:0,end:8}];await db.saveBook(book);
      const p=core.passageAt(book,book.sections[0],book.sections[0].blocks[0]);
      await db.updateState(s=>{s.notes=[{...p,id:'portable-note',updated:1,note:'Original portable comment.'}];s.connections=[{id:'portable-connection',updated:1,note:'Original pair.',passages:[p,p]}];s.positions[book.id]={revision:book.source.sha256,sectionId:'text',blockId:'b1',ratio:0.3};s.lastBook=book.id;s.prefs.theme='dusk';s.boundaries[book.id]={revision:book.source.sha256,index:0};return s;});
      return book;
    });
    await page.reload();await page.getByRole('button',{name:fixture.title,exact:true}).waitFor();
    await page.getByRole('button',{name:'Reading settings'}).click();await page.getByRole('button',{name:'Export a private reading bundle',exact:true}).click();
    await settledCapture(page,{path:new URL(`${engine}-bundle-export-phone.png`,output).pathname});
    const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download private bundle',exact:true}).click();const file=await pending,path=new URL(`${engine}-transfer.reader-bundle.json`,output);await file.saveAs(path.pathname);
    const bundle=JSON.parse(await readFile(path,'utf8'));assert.deepEqual(bundle.books.find(b=>b.id===fixture.id),fixture);assert.equal(bundle.books.length,3);
    await other.goto(base.replace('127.0.0.1','localhost'));await other.getByRole('button',{name:'The distance of a bell',exact:true}).waitFor();assert.equal((await load(other)).books.length,0);
    await choose(bundle);await other.getByRole('heading',{name:'Review your reading bundle.',exact:true}).waitFor();
    assert.equal((await load(other)).books.length,0);assert.equal((await load(other)).state.notes.length,0);
    for(const size of [{width:402,height:874},{width:820,height:1180}]) {
      await other.setViewportSize(size);const target=await other.locator('.bundle-choice').boundingBox();assert.ok(target.width>=44&&target.height>=44);assert.equal(await other.locator('.bundle-choice').evaluate(el=>getComputedStyle(el).display),'flex');
      assert.equal(await other.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await settledCapture(other,{path:new URL(`${engine}-bundle-preview-${size.width}.png`,output).pathname});
    }
    // A state write failing after edition puts must roll back both stores.
    await other.evaluate(()=>{window.bundlePut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(this.name==='state'&&key==='reader')throw new DOMException('Synthetic bundle quota failure','QuotaExceededError');return window.bundlePut.call(this,value,key);};});
    await other.getByRole('button',{name:'Restore on this device',exact:true}).click();await other.waitForFunction(()=>document.querySelector('#dialog-error').textContent.includes('quota'));
    assert.equal((await load(other)).books.length,0);assert.equal((await load(other)).state.notes.length,0);assert.equal(await other.locator('#dialog').isVisible(),true);
    await other.evaluate(()=>{IDBObjectStore.prototype.put=window.bundlePut;});await other.locator('#bundle-appearance').check();await other.getByRole('button',{name:'Restore on this device',exact:true}).click();await other.waitForFunction(()=>!document.querySelector('#dialog').open);
    const restored=await load(other);assert.deepEqual(restored.books,[fixture]);assert.deepEqual(restored.state.notes,bundle.state.notes);assert.deepEqual(restored.state.connections,bundle.state.connections);assert.deepEqual(restored.state.positions,bundle.state.positions);assert.deepEqual(restored.state.boundaries,{});assert.equal(restored.state.prefs.theme,'dusk');
    await other.reload();await other.getByRole('button',{name:fixture.title,exact:true}).waitFor();assert.deepEqual((await load(other)).state.notes,bundle.state.notes);
    await choose(bundle);await other.getByRole('button',{name:'Restore on this device',exact:true}).click();await other.waitForFunction(()=>!document.querySelector('#dialog').open);assert.equal((await load(other)).state.notes.length,1);
    // A concurrent state edit invalidates review; it cannot be overwritten.
    await choose(bundle);await other.getByRole('button',{name:'Restore on this device',exact:true}).waitFor();
    await other.evaluate(async()=>{await (await import('/db.mjs')).updateState(s=>{s.notes[0].note='A concurrent original note.';return s;});});
    await other.getByRole('button',{name:'Restore on this device',exact:true}).click();await other.waitForFunction(()=>document.querySelector('#dialog-error').textContent.includes('changed after this preview'));assert.equal((await load(other)).state.notes[0].note,'A concurrent original note.');await other.getByRole('button',{name:'Close ×',exact:true}).click();
    // Edition writes have their own concurrency guard even without a state revision.
    await choose(bundle);await other.getByRole('button',{name:'Restore on this device',exact:true}).waitFor();
    await other.evaluate(async book=>{book.sections[0].blocks[0].layout='fixed';await (await import('/db.mjs')).saveBook(book);},fixture);
    await other.getByRole('button',{name:'Restore on this device',exact:true}).click();await other.waitForFunction(()=>document.querySelector('#dialog-error').textContent.includes('changed after this preview'));await other.getByRole('button',{name:'Close ×',exact:true}).click();
    await choose(bundle);await other.getByRole('heading',{name:'Review your reading bundle.',exact:true}).waitFor();assert.equal(await other.getByRole('button',{name:'Restore on this device',exact:true}).isDisabled(),true);assert.match(await other.locator('#dialog-content').textContent(),/different edition content/);await other.getByRole('button',{name:'Close ×',exact:true}).click();
    const corrupt=structuredClone(bundle);corrupt.books[0].title='Changed after export';await choose(corrupt);await other.waitForFunction(()=>document.querySelector('#dialog-error').textContent.includes('checksum'));assert.equal(await other.getByRole('button',{name:'Restore on this device',exact:true}).count(),0);
    await other.getByRole('button',{name:'Close ×',exact:true}).click();await other.route('**/library.json',route=>route.abort());await other.reload();await other.getByRole('button',{name:fixture.title,exact:true}).waitFor();
    await choose(bundle);await other.waitForFunction(()=>document.querySelector('#dialog-error').textContent.includes('sample is unavailable'));assert.equal((await load(other)).state.notes.length,1);
    return {freshOrigin:true,exactEditions:true,recordsAndConnections:true,previewBeforeWrites:true,transactionRollback:true,repeatRestore:true,concurrentStateAndBookGuards:true,editionConflict:true,checksumRejection:true,unavailableSampleGuard:true,spoilerPermissionsUnchanged:true,appearanceOptIn:true};
  }finally{await source.close();await destination.close();}
}
