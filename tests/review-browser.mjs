import assert from 'node:assert/strict';
import {settledCapture,settledRender} from './experience-browser.mjs';
import {readFile,writeFile} from 'node:fs/promises';

export async function saveErrorVisibilityChecks({browser,base,engine,output}) {
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}}),page=await context.newPage();
  try {
    await page.goto(base);await page.getByRole('button',{name:'The distance of a bell',exact:true}).waitFor();
    const original=await page.evaluate(async()=>{
      const core=await import('/core.mjs'),db=await import('/db.mjs'),book=(await (await fetch('/library.json')).json())[0],section=book.sections[0];
      const first=core.passageAt(book,section,section.blocks[0],10),second=core.passageAt(book,section,section.blocks[1],0,35);
      const note={...first,segments:[...first.segments,...second.segments],quote:first.quote+section.blocks[0].after+second.quote,id:'save-error-visibility',note:'Original saved comment.',updated:1};
      await db.updateState(s=>{s.notes=[note];s.prefs={...s.prefs,size:28,leading:1.8,theme:'dusk'};return s;});return note;
    });
    await page.goto(base+'/#passages');await page.reload();await page.locator('[data-action="edit-note"]').click();
    const draft='A changed comment retained after a synthetic storage failure.';
    await page.locator('#note-text').fill(draft);await settledRender(page);
    const save=page.getByRole('button',{name:'Save on this device',exact:true});await save.focus();
    const before=await page.evaluate(()=>{window.visibilityFocus=document.activeElement;return {scroll:scrollY};});
    await page.evaluate(()=>{window.realVisibilityPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(this.name==='state'&&key==='reader')throw new DOMException('Synthetic note quota failure','QuotaExceededError');return window.realVisibilityPut.call(this,value,key);};});
    await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#dialog-error').textContent.includes('quota'));
    const visible=await page.evaluate(()=>{
      const dialog=document.querySelector('#dialog'),alert=document.querySelector('#dialog-error'),r=alert.getBoundingClientRect(),d=dialog.getBoundingClientRect(),header=dialog.querySelector('.dialog-header').getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,clipTop:Math.max(d.top+dialog.clientTop,header.bottom),clipBottom:d.top+dialog.clientTop+dialog.clientHeight,scroll:scrollY,focusRetained:document.activeElement===window.visibilityFocus,role:alert.getAttribute('role')};
    });
    await settledCapture(page,{path:new URL(`${engine}-phone-note-save-error.png`,output).pathname});
    assert.ok(visible.top>=visible.clipTop&&visible.bottom<=visible.clipBottom,JSON.stringify(visible));
    assert.equal(visible.scroll,before.scroll,'A dialog failure must not scroll the reading background');
    assert.equal(visible.focusRetained,true,'A dialog failure must retain keyboard focus');assert.equal(visible.role,'alert');
    assert.equal(await page.locator('#note-text').inputValue(),draft);
    assert.deepEqual(await page.evaluate(async()=> (await (await import('/db.mjs')).loadState()).notes),[original]);
    await page.evaluate(()=>{IDBObjectStore.prototype.put=window.realVisibilityPut;});
    await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('#dialog').open);
    assert.equal((await page.evaluate(async()=> (await (await import('/db.mjs')).loadState()).notes))[0].note,draft);
    return {syntheticFailure:true,visible,draftRetained:true,oldNoteUnchanged:true,focusRetained:true,backgroundUnchanged:true,retrySaved:true};
  }finally{await context.close();}
}

export async function dialogReflowChecks({browser,base,engine,output}) {
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),checks=[];
  const load=()=>page.evaluate(async()=> (await import('/db.mjs')).loadState());
  const ready=()=>page.locator('#reading-text[data-position-ready="true"]').waitFor();
  const close=async()=>{await page.getByRole('button',{name:'Close ×',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});};
  try {
    await page.goto(base);await page.getByRole('button',{name:'The distance of a bell',exact:true}).waitFor();
    const fixture=await page.evaluate(async()=>{
      const core=await import('/core.mjs'),db=await import('/db.mjs');
      const text=Array.from({length:24},(_,i)=>`Paragraph ${String(i+1).padStart(2,'0')}. `+Array.from({length:38},(_,j)=>`Original sentence ${j+1} carries its own ${i+1} reading marker across the page. `).join('')).join('\n\n');
      const book=await core.fromText(text,{title:'Original dialog reflow fixture'});
      book.context=[{label:'Original context',kind:'author',through:null,text:'Original context for checking a return to reading.'}];
      const next=await core.fromText('A separate original section is the intended navigation destination.');
      book.sections.push({...next.sections[0],id:'next',title:'Next original section'});
      book.source.sha256=await core.sha256(new TextEncoder().encode(core.bookText(book)));await db.saveBook(book);
      const note={...core.passageAt(book,book.sections[0],book.sections[0].blocks[11],200,260),id:'dialog-reflow-note',note:'Original saved dialog note.',updated:1};
      await db.updateState(s=>{s.notes=[note];return s;});return {id:book.id,revision:book.source.sha256};
    });
    const landmark=()=>page.evaluate(()=>{
      const block=document.querySelector('#reading-text [data-block="b12"]'),walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let node,offset=221;
      while((node=walker.nextNode())){if(offset<node.length)break;offset-=node.length;}
      const range=document.createRange();range.setStart(node,offset);range.setEnd(node,offset+1);const r=range.getBoundingClientRect(),edge=document.querySelector('.reader-tools').getBoundingClientRect().bottom+20;
      return {character:node.textContent[offset],top:r.top,bottom:r.bottom,edge,height:innerHeight,scroll:scrollY};
    });
    const visible=async label=>{const p=await landmark();assert.equal(p.character,'p');assert.ok(p.top>=p.edge&&p.bottom<=p.height,label+': '+JSON.stringify(p));return p;};
    const prepare=async()=>{
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(async()=>{await (await import('/db.mjs')).updateState(s=>{s.prefs={...s.prefs,size:24,leading:1.7,theme:'paper',focus:false};return s;});});
      await page.goto(`${base}/#read/${fixture.id}/text`);await page.reload();await ready();await settledRender(page);
      for(let i=0;i<2;i++){const p=await landmark();await page.evaluate(delta=>scrollBy(0,delta),p.top-p.edge-24);}
      await page.waitForTimeout(350);await visible('Original source letter before dialog');assert.equal((await load()).positions[fixture.id].blockId,'b12');
    };
    const rotate=async()=>{await page.setViewportSize({width:844,height:390});await settledRender(page);};
    const continued=async()=>{await page.evaluate(()=>scrollBy(0,1));await page.waitForTimeout(350);assert.equal((await load()).positions[fixture.id].blockId,'b12');};
    await prepare();const same=await landmark();await page.getByRole('button',{name:'About this work',exact:true}).click();await close();assert.equal((await landmark()).scroll,same.scroll,'Unchanged layout returns to the exact old pixel');checks.push('same-layout exact scroll');
    await prepare();const before=await landmark();
    await page.evaluate(()=>{window.dialogClickScroll=null;document.addEventListener('click',event=>{if(event.target.closest('[data-action="background"]'))window.dialogClickScroll=scrollY;},true);});
    await page.getByRole('button',{name:'About this work',exact:true}).click();assert.equal(await page.evaluate(()=>window.dialogClickScroll),before.scroll,'Locator did not scroll before opening');
    await rotate();await close();const returned=await visible('Source letter after dialog rotation');await continued();await settledCapture(page,{path:new URL(`${engine}-dialog-rotation-return.png`,output).pathname});checks.push('rotation source letter and continued save');
    await prepare();await page.getByRole('button',{name:'Contents',exact:true}).click();await rotate();await page.locator(`#dialog a[href="#read/${fixture.id}/next"]`).click();await page.locator('#reading-text[data-section="next"][data-position-ready="true"]').waitFor();
    assert.ok(await page.locator('.reader-heading h1').evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.reader-tools').getBoundingClientRect().bottom),'Contents destination heading is exposed');checks.push('Contents destination wins');
    await prepare();await page.getByRole('button',{name:'About this work',exact:true}).click();await rotate();await page.evaluate(()=>{location.hash='#read/bell/crossing';});await page.locator('#reading-text[data-book="bell"][data-section="crossing"][data-position-ready="true"]').waitFor();await page.waitForTimeout(350);
    assert.equal((await load()).positions[fixture.id].blockId,'b12','Navigation does not save the reflowed covered background');assert.equal(await page.locator('#reading-text').getAttribute('data-book'),'bell');checks.push('changed-book destination wins');
    await prepare();await page.locator('mark[data-note="dialog-reflow-note"]').click();await page.locator('#note-text').fill('Saved after dialog rotation.');await rotate();await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});await ready();await visible('Note save and rerender');await continued();assert.equal((await load()).notes[0].note,'Saved after dialog rotation.');checks.push('note save and rerender');
    // Header locator scrolling would redefine the source place before entry.
    await prepare();await page.getByRole('button',{name:'Reading settings'}).evaluate(el=>el.click());await page.locator('#settings-form').waitFor();await rotate();await page.getByRole('button',{name:'Large print',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#size')?.value==='29'&&document.querySelector('#reading-text')?.dataset.positionReady==='true');await close();await visible('Preset after rotation');await continued();checks.push('preset after rotation');
    await prepare();await page.getByRole('button',{name:'Reading settings'}).evaluate(el=>el.click());await page.locator('#settings-form').waitFor();await rotate();await page.locator('#size').fill('28');await page.locator('#measure').selectOption('wide');await page.getByRole('button',{name:'Apply to my reader',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});await ready();await visible('Custom settings after rotation');await continued();checks.push('custom settings after rotation');
    await prepare();await page.locator('mark[data-note="dialog-reflow-note"]').click();await page.locator('#note-text').fill('An unfinished original dialog draft.');await rotate();page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Close ×',exact:true}).click();assert.equal(await page.locator('#dialog').evaluate(el=>el.open),true);assert.equal(await page.locator('#note-text').inputValue(),'An unfinished original dialog draft.');assert.equal((await load()).notes[0].note,'Saved after dialog rotation.');page.once('dialog',d=>d.accept());await close();await visible('Discard after cancelled close');checks.push('cancelled draft exit');
    await page.getByRole('link',{name:'Passages',exact:true}).click();await page.locator('[data-action="edit-note"]').waitFor();await page.evaluate(()=>scrollTo(0,180));const listScroll=await page.evaluate(()=>scrollY);
    // Dispatch without bringing an offscreen header control into view first.
    await page.getByRole('button',{name:'Reading settings'}).evaluate(el=>el.click());await page.locator('#settings-form').waitFor();await close();assert.equal(await page.evaluate(()=>scrollY),listScroll,'Nonreading list returns to its exact old pixel');checks.push('nonreading list return');
    return {checks,returned,sourceRevision:fixture.revision,sourceLetter:'b12/221 p',schemaUnchanged:true};
  }finally{await context.close();}
}

export async function reviewChecks({browser,base,engine,output}) {
  const saveErrorVisibility=await saveErrorVisibilityChecks({browser,base,engine,output});
  const dialogReflow=await dialogReflowChecks({browser,base,engine,output});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:402,height:874}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const download=async(page,action,name)=>{const pending=page.waitForEvent('download');await action();const item=await pending;const file=new URL(`${engine}-${name}.json`,output);await item.saveAs(file.pathname);return JSON.parse(await readFile(file,'utf8'));};
  const lockedContext=await browser.newContext({serviceWorkers:'block'}),locked=await lockedContext.newPage();
  try {
    await locked.goto(base);await locked.getByRole('button',{name:'The distance of a bell',exact:true}).waitFor();await locked.getByRole('link',{name:'Companion',exact:true}).click();await locked.getByRole('button',{name:'03 Facing pages',exact:false}).click();
    await locked.locator('#reflection').fill('An original draft before choosing passages.');
    const draft=await download(locked,()=>locked.getByRole('button',{name:'Export connection draft',exact:true}).click(),'locked-draft');assert.deepEqual(draft.connections,[]);assert.equal(draft.reflections['facing-pages'],'An original draft before choosing passages.');
  }finally{await lockedContext.close();}
  const data=await (async()=>{
    await page.goto(base);await page.waitForSelector('.shelf');
    return page.evaluate(async()=>{
      const core=await import('/core.mjs'),db=await import('/db.mjs');
      const book=await core.fromText('First stanza\n\nSecond stanza\n\n\n\n    Third room room\nA fixed long line that must remain on one line.',{title:'Original recovery and fidelity fixture',kind:'verse'});
      book.sections[0].blocks[0].marks=[{kind:'em',start:0,end:5}];book.sections[0].blocks[2].layout='fixed';book.sections[0].blocks[2].marks=[{kind:'strong',start:4,end:9}];
      await db.saveBook(book);
      const refs=[0,2].map(i=>core.passageAt(book,book.sections[0],book.sections[0].blocks[i]));
      const saved=await db.updateState(s=>{s.notes=refs.map((p,i)=>({...p,id:`original-note-${i}`,note:'Original test note.',updated:1}));s.boundaries[book.id]={index:0,revision:book.source.sha256};s.positions[book.id]={sectionId:'text',blockId:null,ratio:0,revision:book.source.sha256};s.lastBook=book.id;return s;});
      return {book,saved,refs};
    });
  })();
  try {
    // Healthy local reading survives an optional sample fetch failure on reload.
    await context.route('**/library.json',route=>route.abort());
    await page.goto(`${base}/#read/${data.book.id}/text`);await page.reload();await page.waitForSelector('#reading-text');
    assert.equal(await page.locator('#reading-text').textContent(),data.book.sections[0].blocks.map(b=>b.text+b.after).join(''));
    await page.waitForFunction(()=>document.querySelector('#storage-warning').textContent.includes('supplied library is unavailable'));
    assert.equal(await page.locator('#reading-text em').textContent(),'First');
    const geometry=await page.evaluate(()=>{const b=[...document.querySelectorAll('#reading-text [data-block]')],lh=parseFloat(getComputedStyle(document.querySelector('#reading-text')).lineHeight);return {two:b[1].getBoundingClientRect().top-b[0].getBoundingClientRect().top,four:b[2].getBoundingClientRect().top-b[1].getBoundingClientRect().top,lh};});
    assert.ok(geometry.four>geometry.two+geometry.lh,JSON.stringify(geometry));
    await page.getByRole('button',{name:'Focus',exact:true}).click();await page.waitForFunction(()=>document.body.classList.contains('focus'));assert.equal(await page.locator('.boundary-button').isVisible(),false);assert.equal(await page.locator('.reader-heading h1').isVisible(),true);assert.equal(await page.locator('.chapter-links').isVisible(),true);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('focus'));
    await page.getByRole('link',{name:'Companion',exact:true}).click();await page.getByRole('button',{name:'02 An echo index',exact:false}).click();await page.locator('#echo-term').fill('room');await page.getByRole('button',{name:'Find occurrences'}).click();
    assert.equal(await page.locator('.echo-list li').count(),2);assert.equal(await page.locator('.echo-list mark').count(),2);assert.equal(await page.locator('.echo-list strong').count(),2);assert.equal(await page.locator('.echo-list .fixed-lines').count(),2);
    await page.getByRole('button',{name:'03 Facing pages',exact:false}).click();await page.locator('#facing-0').selectOption('0');await page.locator('#facing-1').selectOption('1');
    assert.equal(await page.locator('#facing-0').evaluate(el=>el.getBoundingClientRect().height>=44&&el.getBoundingClientRect().width>=44),true);
    assert.equal(await page.locator('.facing-pages .fixed-lines').evaluate(el=>getComputedStyle(el).whiteSpace==='pre'&&el.scrollWidth>el.clientWidth&&el.tabIndex===0),true);
    assert.equal(await page.locator('.facing-pages em').textContent(),'First');assert.equal(await page.locator('.facing-pages strong').textContent(),'Third');
    for(const [label,width,height] of [['phone',402,874],['ipad',820,1180],['narrow',320,740]]) {await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${label} comparison overflow`);await settledCapture(page,{path:new URL(`${engine}-${label}-comparison.png`,output).pathname,animations:'disabled',fullPage:true});}
    await page.setViewportSize({width:402,height:874});
    await page.locator('#reflection').fill('Their difference matters more than their similarity.');await page.getByRole('button',{name:'Keep this connection',exact:false}).click();await page.waitForFunction(()=>document.querySelector('#reflection-status').textContent.includes('Connection saved'));
    await page.getByRole('link',{name:'Passages',exact:true}).click();assert.equal(await page.locator('.saved-connection em').textContent(),'First');
    const saved=await page.evaluate(async()=> (await import('/db.mjs')).loadState());assert.deepEqual(saved.connections[0].passages,data.refs);
    console.log(`${engine}: optional sample failure, companion fidelity and chosen connections passed`);
    // Simulate unreadable state. A failed repair must roll back the archive too.
    await page.evaluate(async()=>{const db=await (await import('/db.mjs')).openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('state','readwrite');tx.objectStore('state').put({schema:999,original:'Keep this synthetic damaged object'},'reader');tx.oncomplete=resolve;tx.onerror=reject;});});
    await page.reload();await page.getByRole('button',{name:'Reading settings'}).click();await page.getByRole('button',{name:'Repair unreadable state'}).click();
    await page.locator('#repair-file').setInputFiles({name:'valid-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
    await page.waitForFunction(()=>!document.querySelector('#repair-apply').disabled);assert.match(await page.locator('#repair-preview').textContent(),/2 passages, 1 connections/);
    await page.evaluate(()=>{window.savedPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(this.name==='state'&&key==='reader')throw new DOMException('Synthetic repair quota failure','QuotaExceededError');return window.savedPut.call(this,value,key);};});
    await page.locator('#repair-apply').click();await page.waitForFunction(()=>document.querySelector('#dialog-error').textContent.includes('quota'));
    assert.deepEqual(await page.evaluate(async()=> (await import('/db.mjs')).recoveryArchives()),[]);
    assert.equal((await page.evaluate(async()=> (await import('/db.mjs')).rawState())).schema,999);
    await page.evaluate(()=>{IDBObjectStore.prototype.put=window.savedPut;});await page.locator('#repair-apply').click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
    const repaired=await page.evaluate(async()=>{const db=await import('/db.mjs');return {state:await db.loadState(),books:await db.rawBooks(),archives:await db.recoveryArchives()};});
    assert.equal(repaired.state.notes.length,2);assert.deepEqual(repaired.books,[data.book]);assert.deepEqual(repaired.archives[0].original,{schema:999,original:'Keep this synthetic damaged object'});
    // Recovery actually returns to writable operation through the normal interface.
    await page.locator('[data-action="edit-note"]').first().click();await page.locator('#note-text').fill('Saved after recovery.');await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
    assert.ok((await page.evaluate(async()=> (await import('/db.mjs')).loadState())).notes.some(n=>n.note==='Saved after recovery.'));
    assert.equal(await page.evaluate(async()=>{try{const db=await import('/db.mjs');await db.recoverState(await db.loadState());return false;}catch{return true;}}),true,'stale recovery cannot replace healthy state');
    await page.getByRole('button',{name:'Reading settings'}).click();
    const edition=await download(page,()=>page.getByRole('button',{name:'Export exact edition:',exact:false}).click(),'exact-edition');assert.deepEqual(edition,data.book);
    const backup=await download(page,()=>page.getByRole('button',{name:'Export passages & progress',exact:false}).click(),'migration-backup');
    const raw=await download(page,()=>page.getByRole('button',{name:'Export original recovery data',exact:true}).click(),'quarantine');assert.equal(raw.archives.length,1);
    const otherOrigin=await context.newPage();await otherOrigin.goto(base.replace('127.0.0.1','localhost'));await otherOrigin.waitForSelector('.shelf');assert.deepEqual(await otherOrigin.evaluate(async()=> (await import('/db.mjs')).rawBooks()),[]);await otherOrigin.close();
    await context.close();
    // A fresh browser context AND a different origin have no library until import.
    const fresh=await browser.newContext({serviceWorkers:'block'}),destination=await fresh.newPage(),newOrigin=base.replace('127.0.0.1','localhost');
    try {
      await destination.goto(newOrigin);await destination.waitForSelector('.shelf');assert.equal(await destination.getByRole('button',{name:data.book.title,exact:true}).count(),0);
      await destination.getByRole('button',{name:'Bring a book',exact:false}).click();await destination.locator('#book-file').setInputFiles({name:'exact.reader.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(edition))});await destination.getByRole('button',{name:'Add on this device',exact:false}).click();
      await destination.getByRole('button',{name:'Reading settings'}).click();await destination.locator('#restore-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await destination.waitForFunction(()=>!document.querySelector('#dialog').open);
      const migrated=await destination.evaluate(async()=>{const db=await import('/db.mjs'),core=await import('/core.mjs'),state=await db.loadState(),book=(await db.loadBooks()).books[0];return {state,book,notesValid:state.notes.every(n=>core.anchorStatus(n,book).valid),connectionsValid:state.connections.every(c=>c.passages.every(p=>core.anchorStatus(p,book).valid))};});
      assert.deepEqual(migrated.book,edition);assert.deepEqual(migrated.state.notes,backup.notes);assert.deepEqual(migrated.state.connections,backup.connections);assert.deepEqual(migrated.state.positions,backup.positions);assert.deepEqual(migrated.state.boundaries,{});assert.equal(migrated.notesValid&&migrated.connectionsValid,true);
      await destination.getByRole('button',{name:data.book.title,exact:true}).click();await destination.waitForSelector('#reading-text em');assert.equal(await destination.locator('#reading-text').textContent(),data.book.sections[0].blocks.map(b=>b.text+b.after).join(''));
      await destination.reload();await destination.waitForSelector('#reading-text em');
    }finally{await fresh.close();}
    console.log(`${engine}: transactional recovery and exact-edition origin migration passed`);
    const lifecycle=await lifecycleChecks({browser,base});
    assert.deepEqual(errors,[]);
    return {saveErrorVisibility,dialogReflow,lifecycle,optionalSamplesFailure:true,visibleGapGeometry:true,companionEmphasis:true,allLiteralOccurrences:true,chosenPassageConnections:true,recoveryRollback:true,recoveryWritable:true,quarantinePreserved:true,staleRepairRejected:true,exactEditionExport:true,freshBrowserNewOriginRestore:true,spoilersNotExpanded:true};
  }finally{await context.close();}
}

async function lifecycleChecks({browser,base}) {
  const context=await browser.newContext(),page=await context.newPage(),workerFile=new URL('../dist/sw.js',import.meta.url),original=await readFile(workerFile,'utf8');
  try {
    await page.goto(base);await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Available offline'));
    const fixture=await page.evaluate(async()=>{
      const core=await import('/core.mjs'),db=await import('/db.mjs');
      const text=Array.from({length:15000},(_,i)=>`${i}: ${'An original long-form fixture keeps its exact words. '.repeat(8)}`).join('\n\n');
      const book=await core.fromText(text,{title:'Long original lifecycle fixture'});await db.saveBook(book);
      const ref=core.passageAt(book,book.sections[0],book.sections[0].blocks[0],0,12);
      await db.updateState(s=>{s.notes=[{...ref,id:'lifecycle-note',note:'Retained through cache change.',updated:1}];return s;});
      return {id:book.id,characters:text.length};
    });
    const initialStart=Date.now();
    await page.goto(`${base}/#read/${fixture.id}/text`);await page.reload({waitUntil:'domcontentloaded',timeout:90000});await page.waitForSelector('#reading-text mark',{timeout:90000});
    const initialMs=Date.now()-initialStart;console.log(`Long fixture initial render: ${initialMs} ms`);
    assert.equal(await page.locator('#reading-text [data-block]').count(),15000);assert.equal((await page.locator('#reading-text').textContent()).length,fixture.characters);
    const oldCaches=await page.evaluate(()=>caches.keys());
    const upgraded=original.replace(/reading-kit-[a-f0-9]+/g,'reading-kit-qa-lifecycle');
    await writeFile(workerFile,upgraded);
    await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
    await page.waitForFunction(async()=>{const keys=await caches.keys();return keys.includes('reading-kit-qa-lifecycle')&&!keys.some(k=>k.startsWith('reading-kit-')&&k!=='reading-kit-qa-lifecycle');});
    assert.ok(oldCaches.some(k=>k!=='reading-kit-qa-lifecycle'));
    // An interrupted precache cannot activate a half-installed version or discard
    // the last complete cache. This tests lifecycle, not arbitrary future schemas.
    await writeFile(workerFile,upgraded.replaceAll('reading-kit-qa-lifecycle','reading-kit-qa-incomplete').replace('const FILES=[','const FILES=["/missing-upgrade-fixture",'));
    await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
    await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return (await caches.keys()).includes('reading-kit-qa-incomplete')&&!r.installing;});
    assert.equal((await page.request.get(base+'/missing-upgrade-fixture')).status(),404);
    assert.ok((await page.evaluate(()=>caches.keys())).includes('reading-kit-qa-lifecycle'));
    // Check the actual active worker from a small client in the same storage
    // context, independently of the deliberately large reader DOM. The reader
    // still has to reload all 15,000 blocks and retain its note below.
    const probe=await context.newPage();let readiness;
    try {
      await probe.goto(`${base}/robots.txt`,{waitUntil:'domcontentloaded',timeout:10000});
      assert.equal(await probe.evaluate(()=>document.contentType),'text/plain','The readiness client must not load the reader shell');
      assert.equal(await probe.locator('script, #reading-text').count(),0);
      assert.equal((await probe.locator('body').textContent()).trim(),(await readFile(new URL('../dist/robots.txt',import.meta.url),'utf8')).trim());
      readiness=await probe.evaluate(async()=>{
        const r=await navigator.serviceWorker.getRegistration();
        if(!r?.active)throw new Error('The previous complete worker is no longer active.');
        const states={active:r.active.state,installing:r.installing?.state??null,waiting:r.waiting?.state??null,controller:navigator.serviceWorker.controller?.state??null};
        const started=performance.now();
        return new Promise((resolve,reject)=>{
          const channel=new MessageChannel();
          // Keep the port rooted and retain the existing bounded worker reply.
          const timer=setTimeout(()=>{channel.port1.close();reject(new Error('The active worker did not answer the lightweight cache-readiness probe within 10 seconds: '+JSON.stringify(states)));},10000);
          channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve({ready:e.data.ready,elapsedMs:Math.round(performance.now()-started),states});};
          try{r.active.postMessage('CHECK_OFFLINE',[channel.port2]);}
          catch(error){clearTimeout(timer);channel.port1.close();reject(error);}
        });
      });
      assert.equal(readiness.ready,true);
      console.log('Active cache readiness: '+JSON.stringify(readiness));
    }finally{await probe.close();}
    assert.equal(await page.locator('#reading-text [data-block]').count(),15000,'The large reader remains open during the isolated readiness probe');
    await writeFile(workerFile,upgraded);const reloadStart=Date.now();await page.reload({waitUntil:'domcontentloaded',timeout:90000});await page.waitForSelector('#reading-text mark',{timeout:90000});
    const reloadMs=Date.now()-reloadStart;console.log(`Long fixture after cache upgrade: ${reloadMs} ms`);
    assert.equal(await page.locator('#reading-text [data-block]').count(),15000);
    assert.equal((await page.evaluate(async()=> (await import('/db.mjs')).loadState())).notes[0].note,'Retained through cache change.');
    return {blocks:15000,characters:fixture.characters,initialMs,reloadMs,cacheReadiness:readiness,functionalTimeoutMs:90000,successfulCacheUpgrade:true,failedPrecacheKeepsActiveVersion:true,libraryAndNotesRetained:true};
  }finally{await writeFile(workerFile,original);await context.close();}
}
