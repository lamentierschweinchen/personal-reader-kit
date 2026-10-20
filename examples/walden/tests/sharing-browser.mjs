import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {settledCapture} from './experience-browser.mjs';

export async function sharingContinuityChecks({browser,base,engine,out}) {
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();
  try {
    await page.goto(base);await page.locator('.pond-survey img').waitFor();
    const fixture=await page.evaluate(async()=>{
      const core=await import('/core.mjs'),db=await import('/db.mjs');
      const book=await core.fromText(Array.from({length:80},(_,i)=>`${i}. Original text for a reading-position check. `.repeat(5)).join('\n\n'),{title:'Original continuity fixture'});
      const late=await core.fromText('An original quotation whose exact edition arrives after the saved passages list.',{title:'Original late source',author:'A. Example'});
      const passage=core.passageAt(late,late.sections[0],late.sections[0].blocks[0],0,21);
      await db.saveBook(book);await db.updateState(s=>{s.notes=[{...passage,id:'late-source-note',updated:1,note:'Original saved fixture note.'}];return s;});
      return {book:book.id,section:book.sections[0].id,late};
    });
    await page.goto(`${base}/#read/${fixture.book}/${fixture.section}`);await page.reload();await page.locator(`#reading-text[data-book="${fixture.book}"][data-position-ready=true]`).waitFor();
    await page.evaluate(()=>{const block=document.querySelectorAll('#reading-text [data-block]')[8],range=document.createRange();range.setStart(block.firstChild,0);range.setEnd(block.firstChild,20);getSelection().removeAllRanges();getSelection().addRange(range);});
    await page.locator('#selection-save:not([hidden])').waitFor();
    await page.evaluate(()=>{scrollTo(0,1600);window.dispatchEvent(new Event('scroll'));document.querySelector('#selection-save').click();});
    await page.locator('#note-text').fill('Original unfinished thought.');
    await page.waitForFunction(async id=>!!(await(await import('/db.mjs')).loadState()).positions[id],fixture.book);
    const position=()=>page.evaluate(async id=>(await(await import('/db.mjs')).loadState()).positions[id],fixture.book),before=await position();
    await page.setViewportSize({width:844,height:390});await page.evaluate(()=>{window.dispatchEvent(new Event('scroll'));window.dispatchEvent(new Event('pagehide'));});await page.waitForTimeout(350);
    assert.deepEqual(await position(),before);assert.equal(await page.locator('#note-text').inputValue(),'Original unfinished thought.');
    await page.locator('#note-text').fill('');await page.getByRole('button',{name:'Close ×',exact:true}).click();await page.goto(base+'/#passages');
    let release;const gate=new Promise(resolve=>{release=resolve;});
    await context.route(base+'/library.json',async route=>{await gate;await route.fulfill({contentType:'application/json',body:JSON.stringify([fixture.late])});});
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('.passage .recovery').waitFor();release();
    await page.locator('[data-action="note-context"][data-note="late-source-note"]').waitFor();assert.equal(await page.locator('.passage .recovery').count(),0);
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Edit note',exact:true}).click();await page.locator('.passage-sharing').waitFor();
    assert.match(await page.locator('.passage-sharing .small').first().textContent(),/Original late source/);
    await settledCapture(page,{path:new URL(`${engine}-sharing-late-source-attribution.png`,out).pathname,animations:'disabled'});
    return {pendingPositionCapturedBeforeDialog:true,dialogResizeAndPageHideKeepPlace:true,lateEditionRefreshesSavedPassages:true,onlyOriginalFixtures:true};
  } finally {await context.close();}
}

// Only original fixture writing reaches these API stubs. No native share sheet
// or real clipboard is invoked, and no recipient or external service is used.
export async function sharingChecks({browser,base,engine,out}) {
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.addInitScript(()=>{
    window.shareProbe={shares:[],copies:[],mode:'success',copyMode:'success'};
    window.setShareMode=mode=>{
      shareProbe.mode=mode;
      Object.defineProperty(navigator,'share',{configurable:true,value:mode==='absent'?undefined:async data=>{
        shareProbe.shares.push(JSON.parse(JSON.stringify(data)));
        if(mode==='cancel')throw new DOMException('Test dismissal','AbortError');
        if(mode==='failure')throw new DOMException('Test denial','NotAllowedError');
        if(mode==='pending')await new Promise(resolve=>{shareProbe.finish=resolve;});
      }});
      Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>mode!=='unsupported'});
    };
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{
      shareProbe.copies.push(text);
      if(shareProbe.copyMode==='failure')throw new DOMException('Test clipboard denial','NotAllowedError');
    }}});
    setShareMode('success');
  });
  const page=await context.newPage(),errors=[],network=[],receipt={engine,apiStubsOnly:true,viewports:[]};
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))network.push(r.url());});
  const state=()=>page.evaluate(async()=>(await import('/db.mjs')).loadState());
  const capture=async name=>{await page.waitForFunction(()=>!document.querySelector('#status')?.textContent);await settledCapture(page,{path:new URL(`${engine}-sharing-${name}.png`,out).pathname,animations:'disabled'});};
  try {
    await page.goto(base);await page.locator('.pond-survey img').waitFor();
    const fixture=await page.evaluate(async()=>{
      const core=await import('/core.mjs'),db=await import('/db.mjs');
      const text='  An original field note: λόγος →.\n    A second indented line.\n\n\n\nAnother original stanza.\n<script> remains literal writing.';
      const book=await core.fromText(text,{title:'Original sharing fixture',author:'A. Example',kind:'verse'});
      book.edition='Original browser-test edition · 2026';book.source.description='PRIVATE LIBRARY METADATA https://private.invalid/device';
      await db.saveBook(book);
      return {id:book.id,section:book.sections[0].id,text,title:book.title,author:book.author,sectionTitle:book.sections[0].title,edition:book.edition};
    });
    const expected={title:fixture.title,text:fixture.text+'\n\n— '+fixture.author+' · '+fixture.title+'\n'+fixture.sectionTitle+'\n'+fixture.edition};
    await page.reload();await page.locator('.book-title').filter({hasText:fixture.title}).waitFor();
    await page.goto(`${base}/#read/${fixture.id}/${fixture.section}`);
    const ready=()=>page.locator(`#reading-text[data-book="${fixture.id}"][data-position-ready=true]`).waitFor();await ready();
    async function appearance(size) {
      await page.getByRole('button',{name:'Reading settings',exact:true}).click();await page.locator('#size').fill(String(size));await page.getByRole('button',{name:'Apply to my reader',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
    }
    async function selection() {
      assert.equal(await page.evaluate(()=>{const range=document.createRange();range.selectNodeContents(document.querySelector('#reading-text'));getSelection().removeAllRanges();getSelection().addRange(range);return range.toString();}),fixture.text);
      await page.locator('#selection-save').waitFor();assert.match(await page.locator('#selection-save').textContent(),/Keep or share passage/);
      await page.locator('#selection-save').click();await page.locator('.passage-sharing').waitFor();assert.match(await page.locator('.passage-sharing .small').first().textContent(),/Original browser-test edition · 2026/);assert.equal(await page.locator('.dialog-quote').textContent(),fixture.text);assert.equal(await page.locator('.dialog-quote script').count(),0);
    }
    async function geometry() {
      const controls=page.locator('.passage-sharing button:visible,.close-dialog:visible');
      assert.deepEqual(await controls.allTextContents(),['Close ×','Share passage','Copy passage','Make card']);
      const targets=await controls.evaluateAll(nodes=>nodes.map(e=>({name:e.textContent,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));
      const result={overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.querySelector('#dialog').scrollWidth>document.querySelector('#dialog').clientWidth+1),targets};
      assert.equal(result.overflow,false);for(const target of result.targets)assert.ok(target.width>=44&&target.height>=44,JSON.stringify(target));return result;
    }
    for(const [name,width,height,size] of [['phone',390,844,21],['phone-landscape-large',844,390,36],['tablet-large',820,1180,36],['tablet-landscape-large',1180,820,36]]) {
      await page.setViewportSize({width,height});await appearance(size);await selection();
      await page.locator('.passage-sharing').scrollIntoViewIfNeeded();await capture(name);const initial=await geometry();
      await page.evaluate(()=>{shareProbe.copyMode='failure';});await page.getByRole('button',{name:'Copy passage',exact:true}).click();await page.locator('#share-fallback').waitFor();
      assert.equal(await page.locator('#share-text').inputValue(),expected.text);
      assert.deepEqual(await page.locator('#share-text').evaluate(e=>[e.readOnly,e.selectionStart,e.selectionEnd]),[true,0,expected.text.length]);
      await capture(name+'-manual-copy');await geometry();
      receipt.viewports.push({name,width,height,size,targets:initial.targets,manualTextExact:true,noOverflow:true});
      await page.getByRole('button',{name:'Close ×',exact:true}).click();
    }
    await page.setViewportSize({width:390,height:844});await appearance(21);
    await page.evaluate(()=>scrollTo(0,200));await page.waitForTimeout(350);const positionBefore=(await state()).positions[fixture.id];assert.ok(positionBefore);
    await selection();await page.locator('#note-text').fill('PRIVATE UNSAVED NOTE SENTINEL');
    const draft=()=>page.locator('#note-text').inputValue();
    const calls=()=>page.evaluate(()=>({shares:shareProbe.shares,copies:shareProbe.copies}));
    const before=await calls();
    await page.evaluate(()=>setShareMode('pending'));await page.getByRole('button',{name:'Share passage',exact:true}).click();
    await page.waitForFunction(()=>typeof shareProbe.finish==='function');assert.equal(await page.getByRole('button',{name:'Share passage',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Copy passage',exact:true}).isDisabled(),true);
    assert.deepEqual((await calls()).shares.at(-1),expected);assert.equal(await draft(),'PRIVATE UNSAVED NOTE SENTINEL');
    await page.evaluate(()=>shareProbe.finish());await page.waitForFunction(()=>document.querySelector('#share-status').textContent.includes('Delivery depends'));
    assert.equal((await calls()).copies.length,before.copies.length);assert.equal(await page.getByRole('button',{name:'Share passage',exact:true}).isEnabled(),true);
    await page.evaluate(()=>setShareMode('cancel'));await page.getByRole('button',{name:'Share passage',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#share-status').textContent.includes('dismissed'));
    assert.equal(await page.locator('#share-fallback').isVisible(),false);assert.equal((await calls()).copies.length,before.copies.length);assert.equal(await draft(),'PRIVATE UNSAVED NOTE SENTINEL');await capture('cancelled-draft-phone');
    for(const mode of ['failure','unsupported','absent']) {
      const count=(await calls()).shares.length;await page.evaluate(mode=>setShareMode(mode),mode);await page.getByRole('button',{name:'Share passage',exact:true}).click();await page.locator('#share-fallback').waitFor();
      assert.equal(await page.locator('#share-text').inputValue(),expected.text);assert.equal((await calls()).copies.length,before.copies.length);assert.equal(await draft(),'PRIVATE UNSAVED NOTE SENTINEL');
      if(mode!=='failure')assert.equal((await calls()).shares.length,count);
    }
    await capture('unavailable-manual-phone');
    await page.evaluate(()=>{shareProbe.copyMode='failure';});await page.getByRole('button',{name:'Copy passage',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#share-status').textContent.includes('Automatic copy is unavailable'));
    assert.equal(await page.locator('#share-text').inputValue(),expected.text);
    await page.evaluate(()=>{shareProbe.copyMode='success';});await page.getByRole('button',{name:'Copy passage',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#share-status').textContent.includes('copied'));
    assert.equal((await calls()).copies.at(-1),expected.text);assert.equal(await page.locator('#share-fallback').isVisible(),false);assert.equal(await draft(),'PRIVATE UNSAVED NOTE SENTINEL');assert.equal((await state()).notes.length,0);assert.deepEqual((await state()).positions[fixture.id],positionBefore);
    for(const payload of (await calls()).shares){assert.deepEqual(payload,expected);assert.deepEqual(Object.keys(payload).sort(),['text','title']);assert.doesNotMatch(JSON.stringify(payload),/PRIVATE|private\.invalid|127\.0\.0\.1/);}
    for(const text of (await calls()).copies)assert.equal(text,expected.text);
    await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});assert.equal((await state()).notes[0].note,'PRIVATE UNSAVED NOTE SENTINEL');
    await page.getByRole('link',{name:'Passages',exact:true}).click();await page.getByRole('button',{name:'Edit note',exact:true}).click();assert.equal(await draft(),'PRIVATE UNSAVED NOTE SENTINEL');
    await page.locator('#note-text').fill('PRIVATE EDIT DRAFT SENTINEL');await page.evaluate(()=>setShareMode('success'));await page.getByRole('button',{name:'Share passage',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#share-status').textContent.includes('Delivery depends'));
    assert.deepEqual((await calls()).shares.at(-1),expected);assert.equal(await draft(),'PRIVATE EDIT DRAFT SENTINEL');
    await page.getByRole('button',{name:'Copy passage',exact:true}).click();assert.equal((await calls()).copies.at(-1),expected.text);
    page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Close ×',exact:true}).click();assert.equal(await page.locator('#dialog').isVisible(),true);assert.equal(await draft(),'PRIVATE EDIT DRAFT SENTINEL');
    await capture('saved-passage-draft-phone');await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
    await page.evaluate(async()=>{await(await import('/db.mjs')).updateState(s=>{s.notes[0].revision='0'.repeat(64);return s;});});await page.reload();await page.getByRole('button',{name:'Edit note',exact:true}).click();
    assert.equal(await page.locator('[data-action=share-passage],[data-action=copy-passage]').count(),0);assert.match(await page.locator('#dialog').textContent(),/Restore the exact edition/);assert.equal(await page.locator('.dialog-quote').textContent(),fixture.text);await capture('edition-mismatch-phone');
    assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
    Object.assign(receipt,{exactWhitespaceAndAttribution:true,noPrivateNoteOrDeviceURL:true,cancelDoesNotCopy:true,failureAndUnavailableManualFallback:true,copyDenialManualFallback:true,pendingDisablesRepeat:true,draftPreserved:true,savedPassageSharing:true,mismatchedEditionRefused:true,readingPositionPreserved:true,pageErrors:errors,unexpectedNetwork:network});
    await writeFile(new URL(`${engine}-sharing-receipt.json`,out),JSON.stringify(receipt,null,2)+'\n');return receipt;
  } finally {await context.close();}
}
