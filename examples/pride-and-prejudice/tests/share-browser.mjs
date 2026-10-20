import assert from 'node:assert/strict';

async function appReady(page) {
  // The first heading appears before edition loading finishes. Await the real
  // entry module before leaving the page, so navigation cannot abort that load.
  await page.waitForFunction(async()=>{await import('/app.mjs');return true;});
}

export async function sharingContinuityChecks({browser,base}) {
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();
  const state=()=>page.evaluate(async()=>(await import('/db.mjs')).loadState());
  try {
    await page.goto(base);await page.locator('.edition-intro').waitFor();await appReady(page);
    const fixture=await page.evaluate(async()=>{
      const core=await import('/core.mjs'),db=await import('/db.mjs');
      const source=await core.fromText('A short original source for a deliberately delayed edition download.',{title:'Original late edition',author:'A fixture author'});
      const passage=core.passageAt(source,source.sections[0],source.sections[0].blocks[0],0,24);
      await db.updateState(s=>{s.notes=[{...passage,id:'cached-original-source',note:'A saved original fixture.',updated:1}];return s;});
      const book=await core.fromText(Array.from({length:80},(_,i)=>`${i}. An original paragraph checks that a quotation dialog preserves the main reading place. `.repeat(3)).join('\n\n'),{title:'Original continuity fixture'});
      await db.saveBook(book);return {book,source};
    });
    await page.goto(`${base}/#read/${fixture.book.id}/${fixture.book.sections[0].id}`);await page.reload();await page.locator('#reading-text[data-position-ready=true]').waitFor();await appReady(page);
    await page.evaluate(()=>{const block=document.querySelectorAll('#reading-text [data-block]')[8],range=document.createRange();range.setStart(block.firstChild,0);range.setEnd(block.firstChild,20);getSelection().removeAllRanges();getSelection().addRange(range);});
    await page.locator('#selection-save:not([hidden])').waitFor();
    await page.evaluate(()=>{scrollTo(0,1600);window.dispatchEvent(new Event('scroll'));document.querySelector('#selection-save').click();});
    await page.locator('#note-text').fill('An unfinished original thought.');
    let before;for(let n=0;n<40&&!before;n++){before=(await state()).positions[fixture.book.id];if(!before)await page.waitForTimeout(50);}assert.ok(before?.blockId);
    await page.setViewportSize({width:844,height:390});
    await page.evaluate(()=>{scrollTo(0,4800);window.dispatchEvent(new Event('scroll'));Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;window.dispatchEvent(new Event('pagehide'));});
    await page.waitForTimeout(350); // Exceed the deliberately queued 250ms autosave.
    assert.deepEqual((await state()).positions[fixture.book.id],before);assert.equal(await page.locator('#note-text').inputValue(),'An unfinished original thought.');
    await page.locator('#note-text').fill('');await page.getByRole('button',{name:'Close ×',exact:true}).click();
    assert.ok(Math.abs(await page.evaluate(()=>scrollY)-1600)<1);

    let release;const gate=new Promise(resolve=>release=resolve);
    await context.route(base+'/library.json',async route=>{await gate;await route.fulfill({json:[fixture.source]});});
    await page.goto(base+'/#passages');await page.reload({waitUntil:'domcontentloaded'});await page.locator('.passage .recovery').waitFor();release();
    await page.locator('[data-action=note-context][data-note=cached-original-source]').waitFor();assert.equal(await page.locator('.passage .recovery').count(),0);
    await page.locator('[data-action=edit-note][data-note=cached-original-source]').click();await page.locator('[data-action=share-passage]').waitFor();
    assert.ok((await page.locator('.passage-sharing').textContent()).includes(fixture.source.edition));
    return {pendingPositionCapturedBeforeDialog:true,dialogResizeVisibilityAndPagehideKeepPlace:true,draftPreserved:true,lateEditionRefreshesSavedPassages:true,lateAttributionAvailable:true};
  } finally {await context.close();}
}

// Only original fixtures reach these API stubs. No native share or clipboard
// implementation is called, and no recipient is selected by this test.
export async function shareChecks({browser,base,engine,output}) {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(()=>{
    window.shareProbe={mode:'success',copyMode:'success',shares:[],copies:[],supported:true};
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
      shareProbe.shares.push(structuredClone(data));
      if(shareProbe.mode==='cancel')throw new DOMException('Dismissed','AbortError');
      if(shareProbe.mode==='fail')throw new DOMException('Denied','NotAllowedError');
    }});
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>shareProbe.supported});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{
      shareProbe.copies.push(text);
      if(shareProbe.copyMode==='fail')throw new DOMException('Denied','NotAllowedError');
    }}});
  });
  const page=await context.newPage(),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:'))external.push(r.url());});
  const state=()=>page.evaluate(async()=>(await import('/db.mjs')).loadState());
  const close=()=>page.getByRole('button',{name:'Close ×',exact:true}).click();
  async function settled(){await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
  async function capture(name){await settled();await page.screenshot({path:new URL(`${engine}-share-${name}.png`,output).pathname,animations:'disabled'});}
  async function mode(value){await page.evaluate(value=>Object.assign(shareProbe,value),value);}
  async function share(){await page.getByRole('button',{name:'Share passage',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-action=share-passage]').disabled);}
  async function copy(){await page.getByRole('button',{name:'Copy passage',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[data-action=copy-passage]').disabled);}
  try {
    await page.goto(base);await page.locator('.edition-intro').waitFor();await appReady(page);
    const fixture=await page.evaluate(async()=>{
      const core=await import('/core.mjs'),db=await import('/db.mjs');
      const text='Original opening context. '.repeat(45)+'\n\n  An original line, λόγος →\n    still indented.\n\n\n\nThe next stanza. <script> remains text.\n\n'+'More original reading follows. '.repeat(180);
      const book=await core.fromText(text,{title:'Original sharing fixture',author:'A fixture author',kind:'verse'});
      book.edition='Original browser test edition';book.sections[0].title='A selected stanza';book.source.description='Private preparation details are not an attribution.';
      await db.saveBook(book);
      return {book,from:book.sections[0].blocks[1].id,to:book.sections[0].blocks[2].id};
    });
    const url=`${base}/#read/${fixture.book.id}/${fixture.book.sections[0].id}`;
    await page.goto(base);await page.locator('.edition-intro').waitFor();await appReady(page);await page.evaluate(hash=>location.hash=hash,new URL(url).hash);await page.locator('#reading-text[data-position-ready=true]').waitFor();await settled();
    const quote=await page.evaluate(({from,to})=>{
      const a=document.querySelector(`[data-block="${from}"]`),b=document.querySelector(`[data-block="${to}"]`);
      a.scrollIntoView({block:'center'});const range=document.createRange();range.setStart(a,0);range.setEnd(b,b.childNodes.length);
      getSelection().removeAllRanges();getSelection().addRange(range);return range.toString();
    },fixture);
    assert.ok(quote.startsWith('  An original line'));assert.ok(quote.includes('\n\n\n\n'));
    const expected={title:fixture.book.title,text:`${quote}\n\n— ${fixture.book.author} · ${fixture.book.title}\n${fixture.book.sections[0].title}\n${fixture.book.edition}`};
    const keep=page.getByRole('button',{name:'Keep or share passage',exact:false});await keep.waitFor();
    await keep.click();assert.equal(await page.locator('.dialog-quote').textContent(),quote);
    const privateNote='PRIVATE DRAFT — never share this note';await page.locator('#note-text').fill(privateNote);
    let before;for(let n=0;n<40&&!before;n++){before=(await state()).positions[fixture.book.id];if(!before)await page.waitForTimeout(50);}assert.ok(before,'Initial reading position must be persisted before sharing');
    await settled();const readingY=await page.evaluate(()=>scrollY);
    await share();
    assert.deepEqual(await page.evaluate(()=>shareProbe.shares),[expected]);
    assert.match(await page.locator('#share-status').textContent(),/Delivery depends/);
    assert.deepEqual(await page.evaluate(()=>shareProbe.copies),[]);
    assert.equal(await page.locator('#note-text').inputValue(),privateNote);
    assert.equal(await page.evaluate(()=>scrollY),readingY);
    assert.deepEqual((await state()).positions[fixture.book.id],before);

    await mode({mode:'cancel'});await share();
    assert.match(await page.locator('#share-status').textContent(),/dismissed/);
    assert.equal(await page.locator('#share-fallback').isVisible(),false);
    assert.deepEqual(await page.evaluate(()=>shareProbe.copies),[]);
    assert.equal(await page.locator('#note-text').inputValue(),privateNote);

    await mode({mode:'fail'});await share();
    assert.equal(await page.locator('#share-text').inputValue(),expected.text);
    assert.equal(await page.locator('#share-text').evaluate(el=>el.readOnly),true);
    assert.deepEqual(await page.locator('#share-text').evaluate(el=>[el.selectionStart,el.selectionEnd]),[0,expected.text.length]);
    assert.deepEqual(await page.evaluate(()=>shareProbe.copies),[]);
    const attempts=await page.evaluate(()=>shareProbe.shares.length);
    await mode({supported:false});await share();assert.equal(await page.evaluate(()=>shareProbe.shares.length),attempts);
    await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));await share();
    assert.equal(await page.locator('#share-text').inputValue(),expected.text);
    assert.deepEqual(await page.evaluate(()=>shareProbe.copies),[]);

    await copy();assert.equal(await page.evaluate(()=>shareProbe.copies.at(-1)),expected.text);
    assert.match(await page.locator('#share-status').textContent(),/attribution copied/);
    await mode({copyMode:'fail'});await copy();
    assert.match(await page.locator('#share-status').textContent(),/Automatic copy is unavailable/);
    assert.equal(await page.locator('#share-text').inputValue(),expected.text);
    assert.equal(await page.locator('#note-text').inputValue(),privateNote);
    assert.equal(await page.evaluate(()=>scrollY),readingY);
    assert.deepEqual((await state()).positions[fixture.book.id],before);
    assert.doesNotMatch(JSON.stringify(await page.evaluate(()=>({shares:shareProbe.shares,copies:shareProbe.copies}))),/PRIVATE DRAFT|Private preparation|127\.0\.0\.1|source|sha256/);
    await capture('manual-copy-phone');
    page.once('dialog',d=>d.dismiss());await page.keyboard.press('Escape');assert.equal(await page.locator('#note-text').inputValue(),privateNote);
    await page.getByRole('button',{name:'Save on this device',exact:true}).click();
    await page.waitForFunction(async()=>(await (await import('/db.mjs')).loadState()).notes.length===1);await page.waitForFunction(()=>!document.querySelector('dialog').open);
    await page.goto(base);await page.locator('.edition-intro').waitFor();await appReady(page);
    await page.getByRole('link',{name:'Passages',exact:true}).click();await page.locator('[data-action=edit-note]').click();
    assert.equal(await page.locator('#note-text').inputValue(),privateNote);await share();
    assert.deepEqual(await page.evaluate(()=>shareProbe.shares),[expected]);
    assert.equal((await state()).notes[0].quote,quote);
    assert.equal((await state()).notes[0].note,privateNote);await close();

    const layouts=[];
    for(const [label,width,height,size] of [['phone',390,844,21],['phone-landscape',844,390,21],['tablet',820,1180,21],['tablet-landscape',1180,820,21],['phone-large',390,844,36],['phone-landscape-large',844,390,36],['tablet-large',820,1180,36],['tablet-landscape-large',1180,820,36]]){
      await page.setViewportSize({width,height});await page.getByRole('button',{name:'Reading settings',exact:true}).click();
      await page.locator('#theme').selectOption(size===36?'dusk':'paper');
      await page.locator('#size').evaluate((el,size)=>{el.value=String(size);el.dispatchEvent(new Event('input',{bubbles:true}));},size);
      await page.getByRole('button',{name:'Apply to my reader',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('dialog').open);
      await page.locator('[data-action=edit-note]').click();await settled();
      assert.equal(await page.locator('.dialog-quote').evaluate(el=>getComputedStyle(el).fontSize),`${size}px`);
      const controls=page.locator('.passage-sharing button:visible');
      assert.deepEqual(await controls.allTextContents(),['Share passage','Copy passage','Make card']);
      const targets=await controls.evaluateAll(xs=>xs.map(x=>({label:x.textContent,width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height})));
      assert.ok(targets.every(x=>x.width>=43.99&&x.height>=43.99),JSON.stringify(targets));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('dialog').scrollWidth<=document.querySelector('dialog').clientWidth),true);
      await page.locator('.passage-sharing').evaluate(el=>el.scrollIntoView({block:'center'}));await settled();
      for(const control of ['share-passage','copy-passage']){
        const b=await page.locator(`[data-action=${control}]`).boundingBox(),header=await page.locator('.dialog-header').boundingBox();
        assert.ok(b.y>=header.y+header.height-1&&b.y+b.height<=height,`${label}: share action must be reachable below sticky header`);
      }
      await capture(label);layouts.push({label,width,height,size,targets});await close();
    }

    // A saved quote survives an edition mismatch, but must not borrow attribution.
    await page.evaluate(async book=>{book.source.sha256='e'.repeat(64);await (await import('/db.mjs')).saveBook(book);},fixture.book);
    await page.goto(base);await page.locator('.edition-intro').waitFor();await appReady(page);await page.getByRole('link',{name:'Passages',exact:true}).click();await page.locator('[data-action=edit-note]').click();
    assert.equal(await page.locator('[data-action=share-passage],[data-action=copy-passage]').count(),0);
    assert.match(await page.locator('dialog').textContent(),/Restore the exact edition/);
    assert.equal(await page.locator('#note-text').inputValue(),privateNote);
    assert.equal(await page.locator('.dialog-quote').textContent(),quote);
    const refused=await page.evaluate(async()=>{const db=await import('/db.mjs'),{passageShareData}=await import('/share.mjs'),state=await db.loadState(),book=(await db.loadBooks()).books.find(b=>b.id===state.notes[0].bookId);try{passageShareData(state.notes[0],book);return false;}catch(e){return e.message.includes('exact edition');}});
    assert.equal(refused,true);assert.deepEqual(await page.evaluate(()=>shareProbe.shares),[]);
    await capture('edition-mismatch');
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    return {exactWhitespaceAndAttribution:true,noPrivateNoteMetadataOrDeviceURL:true,nativeAPIsStubbed:true,resolvedShareDoesNotClaimDelivery:true,cancelWithoutCopy:true,unavailableAndFailureManualText:true,copySuccessAndDenied:true,savedPassageSharing:true,draftAndReadingPlacePreserved:true,mismatchAttributionRefused:true,layouts,errors,external,physicalNativeShareDelivery:false};
  } finally {await context.close();}
}
