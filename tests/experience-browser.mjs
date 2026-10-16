import assert from 'node:assert/strict';

export async function settledCapture(page,options) {
  const parts=new URL(page.url()).hash.slice(1).split('/').map(decodeURIComponent);
  if(parts[0]==='read')await page.waitForFunction(([book,section])=>{const el=document.querySelector('#reading-text');return el?.dataset.book===book&&el.dataset.section===section;},parts.slice(1));
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
    for(const [label,width,height,sticky] of [['phone',402,874,false],['ipad',820,1180,true],['landscape',874,402,true]]) {
      await page.setViewportSize({width,height});
      // A hypothetical sticky header exercises the viewport exclusion explicitly.
      await page.goto(base+'/#passages');await page.getByRole('button',{name:'Read in context',exact:true}).waitFor();
      if(sticky)await page.addStyleTag({content:'.dialog-header{position:sticky;top:0;background:var(--paper)}'});
      await page.getByRole('button',{name:'Read in context',exact:true}).click();
      assert.equal((await rangeInViewport(page)).quote,needle);
      await settledCapture(page,{path:new URL(`${engine}-${label}-late-context.png`,output).pathname,animations:'disabled'});
      await page.getByRole('button',{name:'Close ×',exact:true}).click();
      await page.getByRole('link',{name:'Companion',exact:true}).click();await page.getByRole('button',{name:'02 An echo index',exact:false}).click();await page.locator('#echo-term').fill(needle);await page.getByRole('button',{name:'Find occurrences',exact:true}).click();
      const target=await page.getByRole('button',{name:'Find occurrences',exact:true}).boundingBox();assert.ok(target.width>=44&&target.height>=44,JSON.stringify(target));
      await page.getByRole('button',{name:'Read around this occurrence',exact:true}).click();assert.equal((await rangeInViewport(page)).quote,needle);
      assert.equal(await page.locator('#context-text').textContent(),fixture.text);
      await page.getByRole('button',{name:'Close ×',exact:true}).click();sizes.push({label,rangeWithinViewport:true,findWidth:target.width,findHeight:target.height,stickyHeader:sticky});
    }
    await page.goto(`${base}/#read/${fixture.id}/text`);await page.locator(`#reading-text[data-book="${fixture.id}"]`).waitFor();await page.evaluate(()=>scrollTo(0,1000));
    const landscape=await page.evaluate(()=>{const header=document.querySelector('.masthead'),tools=document.querySelector('.reader-tools'),rect=tools.getBoundingClientRect();return {height:innerHeight,mastheadPosition:getComputedStyle(header).position,toolbarPosition:getComputedStyle(tools).position,persistentHeight:Math.max(0,Math.min(innerHeight,rect.bottom)-Math.max(0,rect.top))};});
    assert.equal(landscape.mastheadPosition,'relative');assert.equal(landscape.toolbarPosition,'sticky');
    await settledCapture(page,{path:new URL(`${engine}-landscape-reading-space.png`,output).pathname,animations:'disabled'});
    await page.getByRole('button',{name:'Focus',exact:true}).click();await page.waitForFunction(()=>document.body.classList.contains('focus'));await page.reload();await page.locator(`#reading-text[data-book="${fixture.id}"]`).waitFor();await page.waitForFunction(()=>document.body.classList.contains('focus'));
    assert.equal(await page.locator('.reader-heading h1').textContent(),fixture.title);assert.equal(await page.locator('.chapter-links').isVisible(),true);assert.equal(await page.getByRole('button',{name:'Exit focus',exact:true}).isVisible(),true);
    const selected=await page.evaluate(()=>{const block=document.querySelector('#reading-text [data-block]'),range=document.createRange();range.selectNodeContents(block);getSelection().removeAllRanges();getSelection().addRange(range);return getSelection().toString();});assert.equal(selected,fixture.text);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('focus'));
    return {sizes,landscape,focusReload:true,focusDOMSelection:true,settledCaptures:true};
  } finally {await context.close();}
}
