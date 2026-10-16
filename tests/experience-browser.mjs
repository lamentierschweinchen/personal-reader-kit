import assert from 'node:assert/strict';

export async function settledCapture(page,options) {
  const parts=new URL(page.url()).hash.slice(1).split('/').map(decodeURIComponent);
  if(parts[0]==='read')await page.waitForFunction(([book,section])=>{const el=document.querySelector('#reading-text');return el?.dataset.book===book&&el.dataset.section===section&&el.dataset.positionReady==='true';},parts.slice(1));
  if(await page.locator('#dialog[open] #context-text').count())await page.locator('#context-text[data-location-ready="true"]').waitFor();
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  return page.screenshot(options);
}

async function rangeInViewport(page) {
  await page.locator('#context-text[data-location-ready="true"]').waitFor();
  const geometry=await page.evaluate(()=>{
    const dialog=document.querySelector('#dialog'),header=dialog.querySelector('.dialog-header'),marks=[...dialog.querySelectorAll('#context-text mark')],range=document.createRange();
    range.setStart(marks[0],0);range.setEnd(marks.at(-1),marks.at(-1).childNodes.length);
    const viewport=dialog.getBoundingClientRect(),sticky=['sticky','fixed'].includes(getComputedStyle(header).position),top=Math.max(0,viewport.top+dialog.clientTop,sticky?header.getBoundingClientRect().bottom:0),bottom=Math.min(innerHeight,viewport.bottom-dialog.clientTop);
    return {top,bottom,left:viewport.left+dialog.clientLeft,right:viewport.right-dialog.clientLeft,rects:[...range.getClientRects()].filter(r=>r.width&&r.height).map(r=>({top:r.top,bottom:r.bottom,left:r.left,right:r.right})),quote:marks.map(m=>m.textContent).join('')};
  });
  assert.ok(geometry.rects.length);
  for(const rect of geometry.rects)assert.ok(rect.top>=geometry.top-1&&rect.bottom<=geometry.bottom+1&&rect.left>=geometry.left-1&&rect.right<=geometry.right+1,JSON.stringify(geometry));
  return geometry;
}

export async function experienceChecks({browser,base,engine,output}) {
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage(),needle='the particular late words',sizes=[];
  try {
    await page.goto(base);await page.waitForSelector('.shelf');
    const fixture=await page.evaluate(async needle=>{
      const core=await import('/core.mjs'),db=await import('/db.mjs'),text='Original words in one deliberately tall paragraph. '.repeat(220)+needle+' End of the paragraph. '.repeat(25),book=await core.fromText(text,{title:'Original long-paragraph fixture'}),section=book.sections[0],block=section.blocks[0],start=block.text.indexOf(needle),passage=core.passageAt(book,section,block,start,start+needle.length);
      await db.saveBook(book);await db.updateState(s=>{s.notes=[{...passage,id:'late-range',note:'Original fixture note.',updated:1}];s.boundaries[book.id]={index:0,revision:book.source.sha256};s.prefs.size=36;return s;});
      return {id:book.id,title:section.title,text};
    },needle);
    await page.reload();await page.waitForSelector('.shelf');
    for(const [label,width,height,sticky] of [['phone',402,874,true],['ipad',820,1180,true],['landscape',874,402,true]]) {
      await page.setViewportSize({width,height});
      await page.goto(base+'/#passages');await page.getByRole('button',{name:'Read in context',exact:true}).waitFor();
      await page.getByRole('button',{name:'Read in context',exact:true}).click();
      assert.equal((await rangeInViewport(page)).quote,needle);
      await settledCapture(page,{path:new URL(`${engine}-${label}-late-context.png`,output).pathname,animations:'disabled'});
      await page.getByRole('button',{name:'Close ×',exact:true}).click();
      await page.getByRole('link',{name:'Companion',exact:true}).click();await page.getByRole('button',{name:'02 An echo index',exact:false}).click();await page.locator('#echo-term').fill(needle);await page.getByRole('button',{name:'Find occurrences',exact:true}).click();
      const target=await page.getByRole('button',{name:'Find occurrences',exact:true}).boundingBox();assert.ok(target.width>=44&&target.height>=44,JSON.stringify(target));
      const occurrence=page.getByRole('button',{name:'Read around this occurrence',exact:true});await occurrence.scrollIntoViewIfNeeded();const searchScroll=await page.evaluate(()=>scrollY);await occurrence.click();assert.equal((await rangeInViewport(page)).quote,needle);
      assert.equal(await page.locator('#context-text').textContent(),fixture.text);
      await page.getByRole('button',{name:'Close ×',exact:true}).click();assert.equal(await page.locator('#echo-term').inputValue(),needle);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-searchScroll)<=1);sizes.push({label,rangeWithinViewport:true,findWidth:target.width,findHeight:target.height,stickyHeader:sticky});
    }
    await page.goto(`${base}/#read/${fixture.id}/text`);await page.locator(`#reading-text[data-book="${fixture.id}"][data-position-ready="true"]`).waitFor();await page.evaluate(()=>scrollTo(0,1000));
    const landscape=await page.evaluate(()=>{const header=document.querySelector('.masthead'),tools=document.querySelector('.reader-tools'),rect=tools.getBoundingClientRect();return {height:innerHeight,mastheadPosition:getComputedStyle(header).position,toolbarPosition:getComputedStyle(tools).position,persistentHeight:Math.max(0,Math.min(innerHeight,rect.bottom)-Math.max(0,rect.top))};});
    assert.equal(landscape.mastheadPosition,'relative');assert.equal(landscape.toolbarPosition,'sticky');
    await settledCapture(page,{path:new URL(`${engine}-landscape-reading-space.png`,output).pathname,animations:'disabled'});
    await page.getByRole('button',{name:'Focus',exact:true}).click();await page.waitForFunction(()=>document.body.classList.contains('focus'));await page.reload();await page.locator(`#reading-text[data-book="${fixture.id}"]`).waitFor();await page.waitForFunction(()=>document.body.classList.contains('focus'));
    assert.equal(await page.locator('.reader-heading h1').textContent(),fixture.title);assert.equal(await page.locator('.chapter-links').isVisible(),true);assert.equal(await page.getByRole('button',{name:'Exit focus',exact:true}).isVisible(),false);await page.keyboard.press('c');assert.equal(await page.getByRole('button',{name:'Exit focus',exact:true}).isVisible(),true);
    const selected=await page.evaluate(()=>{const block=document.querySelector('#reading-text [data-block]'),range=document.createRange();range.selectNodeContents(block);getSelection().removeAllRanges();getSelection().addRange(range);return getSelection().toString();});assert.equal(selected,fixture.text);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('focus'));
    return {sizes,landscape,focusReload:true,focusDOMSelection:true,settledCaptures:true};
  } finally {await context.close();}
}

// Original fixtures exercise the reciprocal-review lessons against the actual
// IndexedDB representation and reader UI; no reference-reader content is used.
export async function handoffChecks({browser,base,engine,output}) {
  const ctx=await browser.newContext({viewport:{width:402,height:874},serviceWorkers:'block'}),page=await ctx.newPage();
  const saved=()=>page.evaluate(async()=> (await import('/db.mjs')).loadState());
  const close=()=>page.getByRole('button',{name:'Close ×',exact:true}).click();
  async function selectRange(from,to) {
    return page.evaluate(([from,to])=>{
      const blocks=[...document.querySelectorAll('#reading-text [data-block]')],point=([index,offset])=>{const walker=document.createTreeWalker(blocks[index],NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode()){if(offset<=node.length)return [node,offset];offset-=node.length;}throw new Error('Missing original fixture offset');},range=document.createRange();
      range.setStart(...point(from));range.setEnd(...point(to));getSelection().removeAllRanges();getSelection().addRange(range);return range.toString();
    },[from,to]);
  }
  try {
    await page.goto(base);await page.waitForSelector('.shelf');
    const fixture=await page.evaluate(async()=>{
      const core=await import('/core.mjs'),db=await import('/db.mjs'),text='An original paragraph with a smaller kept phrase and room around it.\n\n\nA second paragraph keeps its own emphasis and exact words.\n\n'+('More original reading follows. '.repeat(150)),book=await core.fromText(text,{title:'Original integration fixture'});
      book.sections[0].title='A deliberately long original section heading, with a second thought, a return to the first thought, and a final clause that must remain complete wherever the source heading is read.';
      book.sections[0].blocks[0].marks=[{kind:'em',start:12,end:35}];book.sections[0].blocks[1].marks=[{kind:'strong',start:0,end:18}];
      book.context=[{kind:'editorial',label:'An original substantial reading',through:null,text:'This original test essay checks adjustable reading size rather than historical claims. '.repeat(80)}];
      await db.saveBook(book);const p=core.passageAt(book,book.sections[0],book.sections[0].blocks[0],28,47);
      await db.updateState(s=>{s.notes=[{...p,id:'overlap',note:'An existing thought to preserve.',updated:1}];s.boundaries[book.id]={index:0,revision:book.source.sha256};s.prefs.size=36;return s;});return {id:book.id,title:book.sections[0].title,text};
    });
    const url=`${base}/#read/${fixture.id}/text`;await page.goto(url);await page.reload();await page.locator(`#reading-text[data-book="${fixture.id}"]`).waitFor();
    assert.equal(await page.locator('.reader-heading h1').textContent(),fixture.title);
    await page.getByRole('button',{name:'Contents',exact:true}).click();await page.getByText('Full section title',{exact:true}).click();assert.equal(await page.locator('.contents-list details p').textContent(),fixture.title);await close();
    await page.getByRole('button',{name:'About this work',exact:true}).click();assert.equal(await page.locator('.companion-reading').evaluate(el=>getComputedStyle(el).fontSize),'36px');
    await page.locator('.companion-reading').evaluate(el=>el.scrollIntoView({block:'end'}));assert.equal(await page.getByRole('button',{name:'Close ×',exact:true}).isVisible(),true);
    await settledCapture(page,{path:new URL(`${engine}-large-companion-reading.png`,output).pathname,animations:'disabled'});await close();
    const selected=await selectRange([0,10],[1,18]);await page.locator('#selection-save').click();assert.equal(await page.locator('.dialog-quote').first().textContent(),selected);
    await page.getByRole('button',{name:'Extend this passage',exact:true}).click();assert.equal(await page.locator('.dialog-quote').textContent(),selected);assert.equal(await page.locator('#note-text').inputValue(),'An existing thought to preserve.');
    page.once('dialog',d=>d.dismiss());await close();assert.equal(await page.locator('#note-text').isVisible(),true); // range-only changes are a draft too
    await page.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='state')throw new DOMException('Synthetic extension write failure','QuotaExceededError');return window.originalPut.apply(this,args);};});
    await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.getByText('Synthetic extension write failure',{exact:true}).waitFor();assert.notEqual((await saved()).notes[0].quote,selected);assert.equal(await page.locator('.dialog-quote').textContent(),selected);
    await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut;});await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
    let state=await saved();assert.equal(state.notes.length,1);assert.equal(state.notes[0].quote,selected);assert.equal(state.notes[0].note,'An existing thought to preserve.');
    // Keep a different, overlapping selection without narrowing to the old note.
    const separate=await selectRange([0,5],[0,50]);await page.locator('#selection-save').click();await page.getByRole('button',{name:'Keep as a new passage',exact:true}).click();assert.equal(await page.locator('.dialog-quote').textContent(),separate);
    await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);assert.equal((await saved()).notes.length,2);
    await page.getByRole('button',{name:'Focus',exact:true}).click();await page.waitForFunction(()=>document.body.classList.contains('focus'));
    await page.locator('#reading-text[data-position-ready="true"]').waitFor();await page.waitForFunction(()=>!document.querySelector('#status').textContent);
    const focus=[];
    for(const [width,height] of [[402,874],[874,402],[820,1180]]) {
      await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,1000));await page.waitForFunction(()=>document.querySelector('#focus-tools').hidden);await settledCapture(page,{path:new URL(`${engine}-focus-hidden-${width}.png`,output).pathname,animations:'disabled'});await page.keyboard.press('c');
      const geometry=await page.evaluate(()=>{const rail=document.querySelector('#focus-tools').getBoundingClientRect(),exit=document.querySelector('#focus-exit').getBoundingClientRect();return {top:rail.top,bottom:rail.bottom,left:rail.left,right:rail.right,width:innerWidth,height:innerHeight,exitTop:exit.top,exitBottom:exit.bottom,exitWidth:exit.width,exitHeight:exit.height};});
      assert.equal(geometry.top,0);assert.equal(geometry.left,0);assert.equal(geometry.right,geometry.width);assert.ok(geometry.exitTop>=geometry.top&&geometry.exitBottom<=geometry.bottom);assert.ok(geometry.bottom<height*.2&&geometry.exitWidth>=44&&geometry.exitHeight>=44);focus.push(geometry);
      await settledCapture(page,{path:new URL(`${engine}-focus-rail-${width}.png`,output).pathname,animations:'disabled'});await page.getByRole('button',{name:'Hide controls',exact:true}).click();
    }
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('focus'));await page.setViewportSize({width:402,height:874});
    await page.getByRole('link',{name:'Passages',exact:true}).click();await page.locator('[data-action="note-context"][data-note="overlap"]').click();await rangeInViewport(page);assert.ok(await page.locator('#context-text mark em').count());assert.ok(await page.locator('#context-text mark strong').count());await close();await page.locator('[data-action="edit-note"][data-note="overlap"]').click();
    await page.evaluate(()=>{IDBObjectStore.prototype.put=function(...args){if(this.name==='state')throw new DOMException('Synthetic removal failure','QuotaExceededError');return window.originalPut.apply(this,args);};});page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove passage',exact:true}).click();await page.getByText('Synthetic removal failure',{exact:true}).waitFor();assert.ok((await saved()).notes.some(n=>n.id==='overlap'));
    await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut;});page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Remove passage',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);assert.equal((await saved()).notes.some(n=>n.id==='overlap'),false);
    await page.getByRole('link',{name:'Books',exact:true}).click();await page.evaluate(()=>{window.originalDelete=IDBObjectStore.prototype.delete;IDBObjectStore.prototype.delete=function(...args){if(this.name==='books')throw new DOMException('Synthetic book removal failure','QuotaExceededError');return window.originalDelete.apply(this,args);};});
    page.once('dialog',d=>d.accept());await page.locator(`[data-action="remove-book"][data-book="${fixture.id}"]`).click();await page.getByText('Synthetic book removal failure',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Original integration fixture',exact:true}).count(),1);assert.equal(await page.evaluate(async id=>(await (await import('/db.mjs')).loadBooks()).books.some(b=>b.id===id),fixture.id),true);
    await page.evaluate(()=>{IDBObjectStore.prototype.delete=window.originalDelete;});
    // A multi-megabyte state is stored in the same representation as real notes.
    const bytes=await page.evaluate(async()=>{const db=await import('/db.mjs'),s=await db.updateState(s=>{const source=s.notes[0];s.notes=Array.from({length:1200},(_,i)=>({...source,id:`payload-${i}`,note:`Original record ${i}. `+'An original personal observation. '.repeat(45)}));return s;});return new TextEncoder().encode(JSON.stringify(s)).length;});
    const second=await ctx.newPage();await second.goto(base);await second.waitForSelector('.shelf');
    await Promise.all([page.evaluate(async()=> (await import('/db.mjs')).updateState(s=>{s.notes[0].note='First tab saved this change.';return s;})),second.evaluate(async()=> (await import('/db.mjs')).updateState(s=>{s.notes[1].note='Second tab saved this change.';return s;}))]);
    state=await saved();assert.equal(state.notes.length,1200);assert.equal(state.notes[0].note,'First tab saved this change.');assert.equal(state.notes[1].note,'Second tab saved this change.');await second.close();
    await page.getByRole('button',{name:'Reading settings'}).click();const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export passages & progress',exact:false}).click();const download=await downloading,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const exported=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert.deepEqual(exported.notes,state.notes);assert.deepEqual(exported.positions,state.positions);await close();
    return {explicitOverlapChoices:true,extendedExactMultiBlockRange:true,multiNodeContextVisible:true,extensionFailureRetainsDraft:true,failedNoteAndBookRemovalTruthful:true,longTitlePreserved:true,largeCompanionType:36,focusRail:focus,concurrentRecordCount:state.notes.length,payloadBytes:bytes,fullExportVerified:true};
  } finally {await ctx.close();}
}

export async function quietFocusChecks({browser,base,engine,output}) {
  const ctx=await browser.newContext({viewport:{width:402,height:874},hasTouch:true,isMobile:true,serviceWorkers:'block'}),page=await ctx.newPage();
  const hidden=()=>page.waitForFunction(()=>document.querySelector('#focus-tools').hidden);
  const recalled=()=>page.waitForFunction(()=>!document.querySelector('#focus-tools').hidden);
  const tap=async()=>{const text=page.locator('#reading-text [data-block]').first();await text.scrollIntoViewIfNeeded();await text.click({position:{x:8,y:12}});};
  try {
    await page.goto(base+'/#read/bell/arrival');await page.locator('#reading-text[data-section="arrival"][data-position-ready="true"]').waitFor();await page.getByRole('button',{name:'Focus',exact:true}).click();await page.waitForFunction(()=>document.body.classList.contains('focus')&&document.querySelector('#reading-text')?.dataset.positionReady==='true');await hidden();
    await page.reload();await page.locator('#reading-text[data-position-ready="true"]').waitFor();await hidden();assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('focus')),true);
    await tap();await recalled();await tap();await hidden(); // separate short clicks recall and dismiss
    await tap();await recalled();await page.evaluate(()=>scrollBy(0,180));await hidden();
    // A hold and a moving pointer are not a deliberate recall gesture.
    const block=page.locator('#reading-text [data-block]').first();await block.scrollIntoViewIfNeeded();let box=await block.boundingBox();await page.mouse.move(box.x+8,box.y+12);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();await hidden();
    await page.mouse.move(box.x+8,box.y+12);await page.mouse.down();await page.mouse.move(box.x+65,box.y+30,{steps:5});await page.mouse.up();await hidden();
    await page.evaluate(()=>{const block=document.querySelector('#reading-text [data-block]'),range=document.createRange();range.selectNodeContents(block);getSelection().removeAllRanges();getSelection().addRange(range);});await page.locator('#selection-save:not([hidden])').waitFor();await hidden();
    await tap();await hidden(); // clearing an existing selection must not recall chrome
    await page.evaluate(()=>{const block=document.querySelector('#reading-text [data-block]'),range=document.createRange();range.selectNodeContents(block);getSelection().removeAllRanges();getSelection().addRange(range);});await page.locator('#selection-save').click();await page.locator('#note-text').fill('An original quiet-mode note.');await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);await hidden();
    assert.equal(await page.evaluate(async()=> (await (await import('/db.mjs')).loadState()).notes[0].note),'An original quiet-mode note.');
    // A stand-in source-note link checks the event exclusion; the kit does not
    // claim a source-footnote renderer. This adds no text to the source surface.
    await page.evaluate(()=>{const a=document.createElement('a');a.id='source-note-fixture';a.href='#fixture-note';a.textContent='Original source-note link fixture';a.addEventListener('click',e=>{e.preventDefault();a.dataset.visited='true';});document.querySelector('.reader-heading').append(a);});
    await page.locator('#source-note-fixture').click();await hidden();assert.equal(await page.locator('#source-note-fixture').getAttribute('data-visited'),'true');
    await page.getByRole('link',{name:/Next/}).click();await page.locator('#reading-text[data-section="crossing"][data-position-ready="true"]').waitFor();await hidden();
    const touchBlock=page.locator('#reading-text [data-block]').first();await touchBlock.scrollIntoViewIfNeeded();const touchBox=await touchBlock.boundingBox();await page.touchscreen.tap(touchBox.x+8,touchBox.y+12);await recalled();
    // Ordinary source blocks are inline; make this original fixture a real
    // fixed-line scroll container before checking the nested scroll event.
    await touchBlock.evaluate(el=>{el.style.cssText='display:block;white-space:pre;overflow:auto;width:200px';el.scrollLeft=40;});assert.ok(await touchBlock.evaluate(el=>el.scrollLeft)>0);await hidden();await touchBlock.evaluate(el=>el.removeAttribute('style'));
    await page.evaluate(()=>document.querySelector('#main').focus({preventScroll:true}));await page.keyboard.press('Shift+Tab');let keyboardPath='Shift+Tab';if(await page.evaluate(()=>document.activeElement.id)!=='focus-reveal'){await page.evaluate(()=>document.querySelector('#main').focus({preventScroll:true}));await page.keyboard.press('Alt+Shift+Tab');keyboardPath='Alt+Shift+Tab';}assert.equal(await page.evaluate(()=>document.activeElement.id),'focus-reveal');const target=await page.locator('#focus-reveal').boundingBox();assert.ok(target.width>=44&&target.height>=44);await page.keyboard.press('Enter');await recalled();assert.equal(await page.evaluate(()=>document.activeElement.id),'focus-exit');
    await settledCapture(page,{path:new URL(`${engine}-quiet-recalled.png`,output).pathname,animations:'disabled'});await page.getByRole('button',{name:'Hide controls',exact:true}).click();await hidden();assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
    await page.waitForFunction(()=>!document.querySelector('#status').textContent);await settledCapture(page,{path:new URL(`${engine}-quiet-hidden.png`,output).pathname,animations:'disabled'});
    await page.keyboard.press('c');await recalled();await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('focus')&&document.querySelector('#reading-text')?.dataset.positionReady==='true'&&document.activeElement===document.querySelector('#main [data-action="focus"]'));
    return {hiddenOnEntryAndReload:true,deliberateClickToggle:true,emulatedTouchRecall:true,scrollHides:true,nestedScrollHides:true,holdAndDragExcluded:true,selectionClearExcluded:true,annotationInFocus:true,sourceLinkExcluded:true,sectionLinkExcluded:true,keyboardReveal:true,keyboardPath,escapeAndFocusReturn:true,physicalTouchVerified:false};
  } finally {await ctx.close();}
}
