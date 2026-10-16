import assert from 'node:assert/strict';
import {settledCapture} from './experience-browser.mjs';

export async function sharingContinuityChecks({browser,base}) {
  const context=await browser.newContext({viewport:{width:402,height:874},serviceWorkers:'block'}),page=await context.newPage();
  try {
    await page.goto(base);await page.getByRole('button',{name:'Open the book',exact:false}).first().waitFor();
    const fixture=await page.evaluate(async()=>{
      const core=await import('/core.mjs'),db=await import('/db.mjs'),samples=await (await fetch('/library.json')).json();
      const sample=samples[0],section=sample.sections[0],passage=core.passageAt(sample,section,section.blocks[0],0,20);
      await db.updateState(state=>{state.notes=[{...passage,id:'cached-source-note',updated:1,note:'A saved original sample.'}];return state;});
      const book=await core.fromText(Array.from({length:80},(_,i)=>`${i}. An original paragraph for checking that a quotation dialog preserves the main reading place. `.repeat(3)).join('\n\n'),{title:'Original position fixture'});await db.saveBook(book);return {book:book.id,section:book.sections[0].id};
    });
    await page.goto(`${base}/#read/${fixture.book}/${fixture.section}`);await page.reload();await page.locator('#reading-text[data-position-ready="true"]').waitFor();
    await page.evaluate(()=>{
      const block=document.querySelectorAll('#reading-text [data-block]')[8],range=document.createRange();range.setStart(block.firstChild,0);range.setEnd(block.firstChild,20);getSelection().removeAllRanges();getSelection().addRange(range);
    });
    await page.locator('#selection-save:not([hidden])').waitFor();
    await page.evaluate(()=>{scrollTo(0,1600);window.dispatchEvent(new Event('scroll'));document.querySelector('#selection-save').click();});
    await page.locator('#note-text').fill('An unfinished local thought.');
    await page.waitForFunction(async id=>!!(await (await import('/db.mjs')).loadState()).positions[id],fixture.book);
    const before=await page.evaluate(async id=>(await (await import('/db.mjs')).loadState()).positions[id],fixture.book);
    await page.setViewportSize({width:874,height:402});
    await page.evaluate(()=>{window.dispatchEvent(new Event('scroll'));window.dispatchEvent(new Event('pagehide'));});
    // Give the deliberately queued 250ms debounce a chance to corrupt the place.
    await page.waitForTimeout(350);
    const after=await page.evaluate(async id=>(await (await import('/db.mjs')).loadState()).positions[id],fixture.book);
    assert.deepEqual(after,before);assert.equal(await page.locator('#note-text').inputValue(),'An unfinished local thought.');
    await page.locator('#note-text').fill('');await page.getByRole('button',{name:'Close ×',exact:true}).click();
    await page.goto(base+'/#passages');await page.locator('[data-action="note-context"][data-note="cached-source-note"]').waitFor();
    let release;const gate=new Promise(resolve=>release=resolve);
    await context.route(base+'/library.json',async route=>{await gate;await route.continue();});
    await page.reload({waitUntil:'domcontentloaded'});await page.locator('.passage .recovery').waitFor();release();
    await page.locator('[data-action="note-context"][data-note="cached-source-note"]').waitFor();assert.equal(await page.locator('.passage .recovery').count(),0);
    return {pendingPositionCapturedBeforeDialog:true,dialogResizeAndPageHideKeepPlace:true,lateEditionRefreshesSavedPassages:true};
  } finally {await context.close();}
}

// Stub OS handoff and clipboard: this suite never contacts a recipient.
export async function shareChecks({browser,base,engine,output}) {
  const context=await browser.newContext({viewport:{width:402,height:874},serviceWorkers:'block'}),page=await context.newPage(),external=[];
  page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:'))external.push(r.url());});
  await page.addInitScript(()=>{
    window.sharingQA={mode:'success',copy:'success',sent:[],copied:[]};
    Object.defineProperty(navigator,'share',{configurable:true,get:()=>sharingQA.mode==='absent'?undefined:async data=>{
      sharingQA.sent.push(structuredClone(data));
      if(sharingQA.mode==='cancel')throw new DOMException('Dismissed','AbortError');
      if(sharingQA.mode==='blocked')throw new DOMException('Denied','NotAllowedError');
    }});
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{
      if(sharingQA.copy==='denied')throw new DOMException('Denied','NotAllowedError');
      sharingQA.copied.push(text);
    }}});
  });
  try {
    await page.goto(base);await page.locator('.shelf').waitFor();
    const fixture=await page.evaluate(async()=>{
      const {fromText}=await import('/core.mjs'),db=await import('/db.mjs');
      const book=await fromText('  An original verse, λόγος →\n    a second line.\n\n\n\nThe final stanza. <script> is ordinary text.',{title:'Passages for a friend',author:'An original fixture author',kind:'verse'});
      book.edition='Original QA edition';book.sections[0].title='A stanza and a thought';await db.saveBook(book);
      return {id:book.id,section:book.sections[0].id,attribution:`— ${book.author} · ${book.title}\n${book.sections[0].title}\n${book.edition}`};
    });
    const route=`/#read/${fixture.id}/${fixture.section}`;
    await page.goto(base+route);await page.reload();await page.locator('#reading-text[data-position-ready="true"]').waitFor();
    const quote=await page.evaluate(()=>{
      const blocks=[...document.querySelectorAll('#reading-text [data-block]')],first=blocks[0],last=blocks.at(-1),range=document.createRange();
      range.setStart(first.firstChild,0);range.setEnd(last,last.childNodes.length);getSelection().removeAllRanges();getSelection().addRange(range);
      return document.querySelector('#reading-text').textContent;
    });
    await page.locator('#selection-save').click();assert.equal(await page.locator('.dialog-quote').textContent(),quote);
    const expected=quote+'\n\n'+fixture.attribution,privateNote='PRIVATE UNSAVED NOTE: never send this.';
    await page.locator('#note-text').fill(privateNote);
    await page.getByRole('button',{name:'Share passage',exact:true}).click();
    await page.getByText('Share menu opened. Delivery depends on the app you choose.',{exact:true}).waitFor();
    const sent=await page.evaluate(()=>sharingQA.sent);assert.deepEqual(sent,[{title:'Passages for a friend',text:expected}]);assert.doesNotMatch(JSON.stringify(sent),/PRIVATE UNSAVED|127\.0\.0\.1|revision/);
    assert.equal(await page.locator('#note-text').inputValue(),privateNote);
    assert.equal((await page.evaluate(async()=> (await (await import('/db.mjs')).loadState()).notes)).length,0);
    await page.evaluate(()=>sharingQA.mode='cancel');await page.getByRole('button',{name:'Share passage',exact:true}).click();
    await page.getByText('Share dismissed. Your passage and note are unchanged.',{exact:true}).waitFor();
    assert.equal(await page.locator('#share-fallback').isVisible(),false);assert.deepEqual(await page.evaluate(()=>sharingQA.copied),[]);
    for(const mode of ['blocked','absent']) {
      await page.evaluate(mode=>sharingQA.mode=mode,mode);await page.getByRole('button',{name:'Share passage',exact:true}).click();await page.locator('#share-fallback:not([hidden])').waitFor();
      assert.equal(await page.locator('#share-text').inputValue(),expected);assert.equal(await page.locator('#note-text').inputValue(),privateNote);
    }
    await page.getByRole('button',{name:'Copy passage',exact:true}).click();
    await page.getByText('Passage and attribution copied. Your note was not included.',{exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>sharingQA.copied),[expected]);
    await page.evaluate(()=>sharingQA.copy='denied');await page.getByRole('button',{name:'Copy passage',exact:true}).click();await page.locator('#share-fallback:not([hidden])').waitFor();
    assert.equal(await page.locator('#share-text').inputValue(),expected);assert.deepEqual(await page.locator('#share-text').evaluate(el=>[el.selectionStart,el.selectionEnd]),[0,expected.length]);
    for(const [label,width,height] of [['phone',402,874],['landscape',874,402],['tablet',820,1180],['tablet-landscape',1180,820]]) {
      await page.setViewportSize({width,height});
      await page.evaluate(()=>{document.documentElement.style.setProperty('--size','36px');document.documentElement.dataset.theme='dusk';});
      await page.getByRole('button',{name:'Share passage',exact:true}).scrollIntoViewIfNeeded();
      const geometry=await page.locator('.passage-sharing button').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};}));
      assert.ok(geometry.every(r=>r.width>=44&&r.height>=44),JSON.stringify(geometry));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#dialog').scrollWidth<=document.querySelector('#dialog').clientWidth+1));
      await settledCapture(page,{path:new URL(`${engine}-share-${label}.png`,output).pathname});
    }
    await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
    await page.reload();await page.locator('#reading-text[data-position-ready="true"]').waitFor();
    await page.getByRole('link',{name:'Passages',exact:true}).click();await page.locator('[data-action="edit-note"]').first().click();assert.equal(await page.locator('#note-text').inputValue(),privateNote);
    await page.getByRole('button',{name:'Copy passage',exact:true}).click();await page.getByText('Passage and attribution copied. Your note was not included.',{exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>sharingQA.copied),[expected]);
    await page.getByRole('button',{name:'Close ×',exact:true}).click();
    await page.evaluate(async()=>{await (await import('/db.mjs')).updateState(state=>{state.notes[0].revision='0'.repeat(64);return state;});});
    await page.reload();await page.locator('[data-action="edit-note"]').first().click();assert.equal(await page.getByRole('button',{name:'Share passage',exact:true}).count(),0);
    await page.getByText('Restore the exact edition to share this passage with attribution. Your saved quotation remains available.',{exact:true}).waitFor();assert.equal(await page.locator('.dialog-quote').textContent(),quote);
    assert.deepEqual(external,[]);
    return {exactWhitespaceAndAttribution:true,noPrivateNoteOrURL:true,nativeHandoffStubbed:true,cancellationPreservesDraft:true,unavailableAndDeniedFallback:true,savedPassage:true,changedEditionRefused:true,largeTextViewports:4,noUnexpectedExternalRequests:true,physicalShareSheetTested:false};
  } finally {await context.close();}
}
