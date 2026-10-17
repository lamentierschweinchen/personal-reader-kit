import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {shareChecks,sharingContinuityChecks} from './share-browser.mjs';
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=Number(process.env.TEST_PORT||4291),base=`http://127.0.0.1:${port}`,output=new URL('../.reader/reports/',import.meta.url);
const book=JSON.parse(await readFile(new URL('../edition/library.json',import.meta.url),'utf8'))[0];
const inventory=JSON.parse(await readFile(new URL('../edition/inventory.json',import.meta.url),'utf8'));
await mkdir(output,{recursive:true});
let server;
async function start(){server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port),READER_FIXTURES:'0'},stdio:['ignore','pipe','pipe']});let errors='';server.stderr.on('data',b=>errors+=b);await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{if(b.toString().includes('local only'))resolve();});server.on('exit',()=>reject(new Error(errors)));});}
async function stop(){const child=server;server=null;if(child&&child.exitCode===null&&child.signalCode===null){const stopped=once(child,'exit');child.kill();await stopped;}}
const state=p=>p.evaluate(async()=> (await import('/db.mjs')).loadState());
async function settled(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});}
async function snap(page,name){if(await page.locator('#reading-text').count())await page.locator('#reading-text[data-position-ready=true]').waitFor();await settled(page);await page.screenshot({path:new URL(name+'.png',output).pathname,animations:'disabled'});}
async function open(page,id){await page.evaluate(id=>location.hash=`#read/austen-pride-1894/${id}`,id);await page.locator(`#reading-text[data-section="${id}"][data-position-ready="true"]`).waitFor();assert.equal(await page.locator('#catalogue-return').isVisible(),false);if(await page.locator('[data-action=reveal-source]').count())await page.locator('[data-action=reveal-source]').click();await settled(page);}
async function close(page){if(await page.locator('dialog[open]').count())await page.getByRole('button',{name:'Close ×',exact:true}).click();}
async function waitNote(page,n=1){await page.waitForFunction(async n=>(await (await import('/db.mjs')).loadState()).notes.length===n,n);}
async function selection(page,blockId,start,end,second){return page.evaluate(({blockId,start,end,second})=>{
 const el=document.querySelector(`#reading-text [data-block="${blockId}"]`),last=second?document.querySelector(`#reading-text [data-block="${second}"]`):el;
 const point=(root,at)=>{const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=w.nextNode()){if(at<=node.length)return[node,at];at-=node.length;}throw new Error('Invalid selection');};
 el.scrollIntoView({block:'center'});const r=document.createRange();r.setStart(...point(el,start));r.setEnd(...point(last,end));const s=getSelection();s.removeAllRanges();s.addRange(r);return r.toString();
 },{blockId,start,end,second});}
const receipts=[];
const sizes=[['phone-portrait',390,844],['phone-landscape',844,390],['tablet-portrait',820,1180],['tablet-landscape',1180,820]];
async function targets(page,selector){
 await settled(page);
 const dimensions=await page.locator(selector).evaluateAll(xs=>xs.filter(x=>x.getClientRects().length).map(x=>({label:x.textContent.trim()||x.getAttribute('aria-label'),width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height})));
 // DOMRect subtraction can report 43.99988 for a CSS 44px target.
 assert.ok(dimensions.every(x=>x.width>=43.99&&x.height>=43.99),JSON.stringify(dimensions));return dimensions;
}
async function unavailableEditionChecks(browser,engine){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base);await page.locator('.edition-intro').waitFor();
  await page.locator('.site-footer [data-action=import]').click();
  const original=Array.from({length:40},(_,i)=>`Original local paragraph ${i+1}. A book already saved in this browser remains readable when the included edition cannot be downloaded. A reference visit must preserve its reading place.`).join('\n\n');
  await page.locator('#book-file').setInputFiles({name:'original-local-fixture.txt',mimeType:'text/plain',buffer:Buffer.from(original)});await page.locator('#book-title').fill('Original local recovery fixture');
  await page.getByRole('button',{name:'Add on this device',exact:false}).click();await page.waitForFunction(()=>!document.querySelector('dialog').open);
  const local=await page.evaluate(async()=>(await (await import('/db.mjs')).loadBooks()).books.find(b=>b.title==='Original local recovery fixture'));
  assert.ok(local);await page.goto(`${base}/#read/${local.id}/${local.sections[0].id}`);await page.locator('#reading-text[data-position-ready=true]').waitFor();
  const exact=local.sections[0].blocks.map(b=>b.text+b.after).join('');assert.equal(await page.locator('#reading-text').textContent(),exact);
  const quote=await selection(page,local.sections[0].blocks[2].id,0,50);await page.locator('#selection-save').click();await page.locator('#note-text').fill('A local note kept during the missing-edition check.');await page.getByRole('button',{name:'Save on this device',exact:true}).click();await waitNote(page);await page.waitForFunction(()=>!document.querySelector('dialog').open);await settled(page);
  await page.evaluate(()=>scrollTo(0,1200));await page.getByRole('link',{name:'Words',exact:true}).click();await page.locator('.austen-companion').waitFor();
  await page.getByRole('button',{name:'Choose what I’ve read',exact:true}).click();await page.locator(`#boundary-${book.id}`).selectOption(String(book.sections.findIndex(s=>s.id==='chapter-5')));await page.getByRole('button',{name:'Set my boundaries'}).click();await page.waitForFunction(()=>!document.querySelector('dialog').open);
  assert.ok(await page.locator('.echo-list li').count());assert.equal(await page.locator('.experiment-tabs,.prototype-choice').count(),0);
  const before=await state(page);assert.ok(before.positions[local.id]?.blockId);assert.equal(before.notes[0].quote,quote);
  await context.route(base+'/library.json',r=>r.abort());await page.reload();await page.locator('.edition-unavailable').waitFor();await page.locator('#storage-warning:not([hidden])').waitFor();
  assert.equal(await page.locator('.experiment-tabs,.walk-stage,.prototype-choice').count(),0);assert.match(await page.locator('#main').textContent(),/Word index unavailable/);
  assert.deepEqual((await state(page)).positions,before.positions);assert.deepEqual((await state(page)).notes,before.notes);
  await targets(page,'.edition-unavailable a,.edition-unavailable button');await snap(page,`${engine}-edition-unavailable-phone`);
  await page.setViewportSize({width:820,height:1180});await snap(page,`${engine}-edition-unavailable-tablet`);await page.setViewportSize({width:390,height:844});
  await page.getByRole('link',{name:'Back to books',exact:false}).click();assert.ok((await page.locator('.shelf-list').textContent()).includes(local.title));assert.doesNotMatch(await page.locator('#main').textContent(),/A book to carry|A place to pause|A little further|Try three ways|In good/);await snap(page,`${engine}-local-shelf-without-edition`);
  await page.getByRole('link',{name:'Words',exact:true}).click();await page.getByRole('button',{name:'Return to your book',exact:false}).click();await page.locator('#reading-text[data-position-ready=true]').waitFor();await settled(page);
  assert.equal(await page.locator('#reading-text').getAttribute('data-book'),local.id);assert.equal(await page.locator('#reading-text').textContent(),exact);assert.deepEqual((await state(page)).positions[local.id],before.positions[local.id]);assert.ok(await page.evaluate(()=>scrollY>0));await snap(page,`${engine}-local-reading-without-edition`);
  await page.reload();await page.locator('#reading-text[data-position-ready=true]').waitFor();await settled(page);assert.equal(await page.locator('#reading-text').textContent(),exact);assert.deepEqual((await state(page)).notes,before.notes);
  await context.unroute(base+'/library.json');await page.goto(base+'/#companion');await page.reload();await page.locator('.austen-companion').waitFor();assert.equal(await page.locator('.edition-unavailable').count(),0);assert.ok(await page.locator('.echo-list li').count());assert.deepEqual((await state(page)).notes,before.notes);await page.waitForFunction(()=>document.querySelector('#status').textContent==='');await snap(page,`${engine}-word-index-after-edition-recovery`);
  assert.deepEqual(errors,[]);return {originalLocalImport:true,healthyWordIndex:true,failedLibraryHasNoStockCompanion:true,booksAndReturnActions:true,localTextNoteAndPlaceRetained:true,localReloadReadable:true,healthyIndexAfterRecovery:true,errors};
 }finally{await context.close();}
}
async function sourceNoticeChecks(browser,engine){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'/#read/'+book.id+'/chapter-13');await page.locator('#reading-text[data-position-ready=true]').waitFor();
  const notice=page.locator('#first-source-notice');assert.equal(await notice.isVisible(),true);assert.equal(await page.locator('dialog[open]').count(),0);
  const fullNotice=await notice.locator('.source-license-notice').textContent();assert.match(fullNotice,/If you are not located in the United States/);
  await snap(page,`${engine}-source-notice-first-direct-phone`);await page.setViewportSize({width:820,height:1180});await snap(page,`${engine}-source-notice-first-direct-tablet`);await page.setViewportSize({width:390,height:844});
  const entryHash=await page.evaluate(()=>location.hash);
  await notice.getByRole('link',{name:'Project Gutenberg™ License included with this eBook'}).click();await page.locator('#context-text[data-location-ready=true]').waitFor();
  assert.equal(await page.locator('#context-text').textContent(),book.sections.find(s=>s.id==='license').blocks.map(b=>b.text+b.after).join(''));
  await close(page);assert.equal(await page.evaluate(()=>location.hash),entryHash);assert.equal(await notice.isVisible(),true);
  await page.getByRole('button',{name:'Dismiss notice',exact:true}).click();assert.equal(await notice.count(),0);
  await open(page,'chapter-14');assert.equal(await notice.count(),0);await page.reload();await page.locator('#reading-text[data-position-ready=true]').waitFor();assert.equal(await notice.count(),0);
  await page.goto(base+'/#shelf');await page.locator('.edition-intro').waitFor();assert.equal(await notice.count(),0);assert.equal(await page.locator('.source-license-notice').count(),0);await snap(page,`${engine}-source-notice-returning-home`);
  const second=await context.newPage();await second.goto(base+'/#read/'+book.id+'/chapter-5');await second.locator('#reading-text[data-position-ready=true]').waitFor();assert.equal(await second.locator('#first-source-notice').count(),0);await second.close();
  await open(page,'chapter-13');await page.evaluate(()=>scrollTo(0,1300));await page.waitForTimeout(400);const before=await state(page),y=await page.evaluate(()=>scrollY);assert.ok(before.positions[book.id].blockId);
  // Click the visible sticky control without Playwright's preparatory scroll.
  const sourceControl=await page.locator('.reader-tools [data-action=background]').boundingBox();await page.mouse.click(sourceControl.x+sourceControl.width/2,sourceControl.y+sourceControl.height/2);await page.locator('.edition-details').waitFor();await targets(page,'.edition-source-links a,.edition-details summary,.dialog-header button');
  assert.equal(await page.locator('.edition-details details[open]').count(),0);await snap(page,`${engine}-edition-source-phone`);
  await page.setViewportSize({width:820,height:1180});await snap(page,`${engine}-edition-source-tablet`);await page.setViewportSize({width:390,height:844});
  await page.getByText('Source notice & credits',{exact:true}).click();assert.equal(await page.locator('.edition-details .source-license-notice').textContent(),fullNotice);await snap(page,`${engine}-edition-source-notice-expanded`);
  await page.getByRole('link',{name:'Original source notice',exact:true}).click();await page.locator('#context-text[data-location-ready=true]').waitFor();assert.equal(await page.locator('#context-text').textContent(),book.sections.find(s=>s.id==='edition-notice').blocks.map(b=>b.text+b.after).join(''));await close(page);
  assert.equal(await page.evaluate(()=>location.hash),'#read/'+book.id+'/chapter-13');assert.deepEqual((await state(page)).positions[book.id],before.positions[book.id]);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-y)<2);
  assert.equal(await page.locator('.reader-hint').count(),0);await page.getByRole('link',{name:'Words',exact:true}).click();await page.locator('.austen-companion').waitFor();assert.equal(await page.locator('.austen-companion .sample-notice').count(),0);assert.equal(await page.locator('#edition-source').isVisible(),true);
  await page.locator('#edition-source').click();await page.getByText('Using this reader',{exact:true}).click();assert.match(await page.locator('.edition-details').textContent(),/Opening a result leaves your reading place unchanged/);await close(page);
  // A restored focus preference must not mark an invisible notice as presented.
  await open(page,'chapter-13');await page.locator('.reader-tools [data-action=focus]').click();await page.waitForFunction(()=>document.body.classList.contains('focus'));await page.evaluate(()=>localStorage.clear());await page.reload();await page.locator('#reading-text[data-position-ready=true]').waitFor();assert.equal(await page.locator('#first-source-notice').isVisible(),false);assert.equal(await page.evaluate(()=>localStorage.length),0);
  await page.keyboard.press('Escape');await page.locator('#first-source-notice').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>localStorage.length),1);await page.reload();await page.locator('#reading-text[data-position-ready=true]').waitFor();assert.equal(await page.locator('#first-source-notice').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
 const storageFailures=[];
 for(const mode of ['read-denied','write-denied','write-discarded']){
  const failed=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),p=await failed.newPage();
  try{
   await p.addInitScript(mode=>{if(mode==='read-denied')Storage.prototype.getItem=()=>{throw new DOMException('Storage unavailable','SecurityError');};else if(mode==='write-denied')Storage.prototype.setItem=()=>{throw new DOMException('Storage full','QuotaExceededError');};else Storage.prototype.setItem=()=>{};},mode);
   await p.goto(base+'/#read/'+book.id+'/chapter-1');await p.locator('#reading-text[data-position-ready=true]').waitFor();assert.equal(await p.locator('#first-source-notice').isVisible(),true);assert.equal(await p.locator('#first-source-notice .source-notice-memory').isVisible(),true);
   await p.getByRole('button',{name:'Dismiss notice',exact:true}).click();assert.equal(await p.locator('#source-notice-storage').isVisible(),true);await open(p,'chapter-2');assert.equal(await p.locator('#first-source-notice').count(),0);
   await p.reload();await p.locator('#reading-text[data-position-ready=true]').waitFor();assert.equal(await p.locator('#first-source-notice').isVisible(),true);assert.equal(await p.locator('#first-source-notice .source-notice-memory').isVisible(),true);
   if(mode==='write-denied'){await p.locator('#first-source-notice .source-notice-memory').scrollIntoViewIfNeeded();await snap(p,`${engine}-source-notice-storage-unavailable`);await p.getByRole('button',{name:'Dismiss notice',exact:true}).click();await p.locator('#source-notice-storage').scrollIntoViewIfNeeded();await snap(p,`${engine}-source-notice-storage-footer`);}
   storageFailures.push({mode,oncePerDocument:true,reloadMayRepeat:true,visibleExplanation:true});
  }finally{await failed.close();}
 }
 return {firstDirectEntry:true,fullNoticeRetained:true,fullLicenceInContext:true,noModalInterruption:true,noRepeatAfterChapterReloadHomeOrNewTab:true,quietSourceAccess:true,sourceVisitPreservesPlace:true,relocatedReadingGuidance:true,focusDefersFirstNotice:true,storageFailures,errors};
}
async function illustrationCreditChecks(browser,engine){
 const credit='[Copyright 1894 by George Allen.]',affected=book.sections.filter(s=>s.blocks.some(b=>b.text.includes(credit)));
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedCreditQuotation=text;}}});});
 try{
  await page.goto(base+'/#read/'+book.id+'/chapter-1');await page.locator('#reading-text[data-position-ready=true]').waitFor();await settled(page);await page.getByRole('button',{name:'Dismiss notice',exact:true}).click();
  let omitted=0;
  for(const section of affected){
   await open(page,section.id);assert.equal(await page.locator('#reading-text').textContent(),section.blocks.map(b=>b.text+b.after).join(''));assert.equal((await page.locator('#reading-text').innerText()).includes(credit),false,section.id);
   const credits=section.blocks.filter(b=>b.text.includes(credit));omitted+=credits.length;
   for(const block of credits){const node=page.locator(`#reading-text [data-block="${block.id}"]`);if(block.text===credit)assert.equal(await node.isVisible(),false);else assert.equal(await node.innerText(),'“The entreaties of several”');}
   const hiddenIds=await page.locator('#reading-text [data-source-omitted]').evaluateAll(nodes=>[...new Set(nodes.map(n=>(n.closest('[data-block]')||n.querySelector('[data-block]')).dataset.block))]);assert.deepEqual(hiddenIds,credits.map(b=>b.id));
  }
  assert.equal(omitted,22);
  for(const sectionId of ['chapter-1','chapter-6'])for(const large of [false,true]){
   await open(page,sectionId);await page.getByRole('button',{name:'Reading settings'}).click();await page.locator('#size').evaluate((el,size)=>{el.value=String(size);el.dispatchEvent(new Event('input',{bubbles:true}));},large?36:21);await page.getByRole('button',{name:'Apply to my reader'}).click();await settled(page);
   const caption=page.locator(`#reading-text [data-block="${sectionId==='chapter-1'?'b0260':'b0414'}"]`);await caption.scrollIntoViewIfNeeded();assert.equal((await page.locator('#reading-text').innerText()).includes(credit),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await snap(page,`${engine}-credits-${sectionId}-${large?'large':'normal'}`);
   await page.locator('.reader-tools [data-action=focus]').click();await page.waitForFunction(()=>document.body.classList.contains('focus')&&document.querySelector('#reading-text').dataset.positionReady==='true');await caption.scrollIntoViewIfNeeded();assert.equal((await page.locator('#reading-text').innerText()).includes(credit),false);await snap(page,`${engine}-credits-${sectionId}-${large?'large':'normal'}-focus`);await page.keyboard.press('Escape');
  }
  await page.getByRole('button',{name:'Reading settings'}).click();await page.locator('#size').evaluate(el=>{el.value='21';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.getByRole('button',{name:'Apply to my reader'}).click();
  await page.goto(base+'/#shelf');await page.locator('.edition-intro').waitFor();
  // A pre-change note on a now-hidden credit and a place inside that block remain recoverable.
  const legacy=await page.evaluate(async book=>{const {passageAt}=await import('/core.mjs'),s=book.sections.find(s=>s.id==='chapter-1'),b=s.blocks.find(b=>b.id==='b0261'),note={...passageAt(book,s,b),id:'legacy-credit',note:'An existing note on the historical credit.',updated:1};await (await import('/db.mjs')).updateState(state=>{state.notes=[note];state.positions[book.id]={sectionId:s.id,blockId:b.id,ratio:.5,revision:book.source.sha256};state.lastBook=book.id;return state;});return note;},book);
  await page.reload();await page.locator('.edition-intro').waitFor();await open(page,'chapter-1');
  const resume=await page.evaluate(()=>({top:document.querySelector('[data-block=b0262]').getBoundingClientRect().top,edge:document.querySelector('.reader-tools').getBoundingClientRect().bottom+20,y:scrollY}));assert.ok(resume.y>0&&Math.abs(resume.top-resume.edge)<2,JSON.stringify(resume));assert.deepEqual((await state(page)).notes,[legacy]);
  await page.getByRole('link',{name:'Passages',exact:true}).click();await page.locator('[data-action=note-context]').click();await page.locator('#context-text[data-location-ready=true]').waitFor();assert.equal(await page.locator('#context-text mark').allTextContents().then(parts=>parts.join('')),credit);await snap(page,`${engine}-credits-legacy-note-context`);await close(page);
  await open(page,'chapter-1');await selection(page,'b0260',0,18,'b0262');const visibleSelection=await page.evaluate(()=>getSelection().toString());assert.equal(visibleSelection.includes(credit),false);
  await page.locator('#selection-save').click();assert.equal(await page.locator('.source-credit-warning').isVisible(),true);await page.getByRole('button',{name:'Keep as a new passage',exact:true}).click();
  const exact='“He came down to see the place”\n\n'+credit+'\n\nThis was invitatio';
  assert.equal(await page.locator('.dialog-quote').textContent(),exact);assert.equal(await page.locator('.source-credit-warning').isVisible(),true);await page.getByRole('button',{name:'Copy passage',exact:true}).click();assert.ok((await page.evaluate(()=>window.copiedCreditQuotation)).startsWith(exact+'\n\n'));
  await page.locator('#note-text').fill('A new range crossing a hidden historical credit.');await snap(page,`${engine}-credits-crossing-selection`);await page.getByRole('button',{name:'Save on this device',exact:true}).click();await waitNote(page,2);await page.reload();await page.locator('#reading-text[data-position-ready=true]').waitFor();
  const saved=(await state(page)).notes.find(n=>n.id!=='legacy-credit');assert.equal(saved.quote,exact);assert.deepEqual(saved.segments.map(s=>s.blockId),['b0260','b0261','b0262']);
  assert.equal(await page.evaluate(async({note,book})=>(await import('/core.mjs')).anchorStatus(note,book).valid,{note:saved,book}),true);
  // The one mixed caption retains its words and offsets; crossing its suffix is explained.
  await open(page,'chapter-6');const title='“The entreaties of several”';await selection(page,'b0414',0,title.length);await page.locator('#selection-save').click();assert.equal(await page.locator('.dialog-quote').textContent(),title);assert.equal(await page.locator('.source-credit-warning').count(),0);await close(page);
  await selection(page,'b0414',0,40,'b0415');await page.locator('#selection-save').click();assert.equal(await page.locator('.source-credit-warning').isVisible(),true);const mixed=await page.locator('.dialog-quote').textContent();assert.ok(mixed.startsWith(title+' '+credit+'\n\n'));
  const draftDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export draft',exact:true}).click();const draft=await draftDownload,draftPath=new URL(`${engine}-credits-draft.json`,output).pathname;await draft.saveAs(draftPath);assert.equal(JSON.parse(await readFile(draftPath,'utf8')).notes[0].quote,mixed);await close(page);
  // Quiet source access preserves the current place and exposes every original character.
  const sourceControl=await page.locator('.reader-tools [data-action=background]').boundingBox();await page.mouse.click(sourceControl.x+sourceControl.width/2,sourceControl.y+sourceControl.height/2);await page.locator('.edition-details').waitFor();const place=(await state(page)).positions[book.id];await page.getByText('Source notice & credits',{exact:true}).click();assert.equal(await page.locator('.historical-illustration-credit').count(),1);assert.ok((await page.locator('.historical-illustration-credit').innerText()).includes(credit));await snap(page,`${engine}-credits-edition-source`);
  await page.getByRole('link',{name:'Original text of this chapter',exact:true}).click();await page.locator('#context-text[data-location-ready=true]').waitFor();assert.equal(await page.locator('#context-text').textContent(),book.sections.find(s=>s.id==='chapter-6').blocks.map(b=>b.text+b.after).join(''));assert.ok((await page.locator('#context-text').innerText()).includes(credit));await close(page);assert.deepEqual((await state(page)).positions[book.id],place);
  // Full editions and old/new annotations export and restore without any source migration.
  await page.getByRole('button',{name:'Reading settings'}).click();await page.getByRole('button',{name:'Export a private reading bundle'}).click();const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Download private bundle'}).click();const download=await downloading,bundlePath=new URL(`${engine}-credits.reader-bundle.json`,output).pathname;await download.saveAs(bundlePath);const bundle=JSON.parse(await readFile(bundlePath,'utf8'));assert.deepEqual(bundle.books,[book]);assert.deepEqual(bundle.state.notes,[legacy,saved]);
  const restored=await browser.newContext({serviceWorkers:'block'}),other=await restored.newPage();try{await other.goto(base);await other.locator('.edition-intro').waitFor();await other.getByRole('button',{name:'Reading settings'}).click();await other.locator('#bundle-file').setInputFiles(bundlePath);await other.locator('[data-action=bundle-apply]:enabled').click();await waitNote(other,2);await other.reload();await other.locator('.edition-intro').waitFor();assert.deepEqual((await state(other)).notes,[legacy,saved]);}finally{await restored.close();}
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
 const changed=await browser.newContext({serviceWorkers:'block'}),other=await changed.newPage();try{const revised=structuredClone(book);revised.context[0].text+=' Original fixture alteration.';await changed.route(base+'/library.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([revised])}));await other.goto(base+'/#read/'+book.id+'/chapter-1');await other.locator('#reading-text[data-position-ready=true]').waitFor();assert.ok((await other.locator('#reading-text').innerText()).includes(credit));assert.equal(await other.locator('#reading-text [data-source-omitted]').count(),0);}finally{await changed.close();}
 return {omittedCredits:22,affectedChapters:affected.length,exactSourceDOM:true,mixedCaptionPreserved:true,normalFocusAndLargeType:true,visibleSelectionOmitsCredits:true,sourceQuotationExplainedAndExact:true,oldCreditNoteRecovered:true,oldCreditPlaceResumesAtNextBlock:true,copyAndDraftExact:true,fullBundleUnchangedAndRestored:true,originalChapterAccess:true,sourceVisitKeepsPlace:true,changedSnapshotNotFiltered:true,errors};
}
try{
 for(const engine of process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit']){
  await start();
  const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
  const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  try{
   const illustrationCredits=await illustrationCreditChecks(browser,engine);console.log(`${engine}: illustration credits, source ranges and old notes passed`);
   if(process.env.QA_SCOPE==='illustration-credits'){receipts.push({engine,illustrationCredits});continue;}
   const sourceNotices=await sourceNoticeChecks(browser,engine);console.log(`${engine}: one-time source notice and quiet source access passed`);
   const unavailableEdition=await unavailableEditionChecks(browser,engine);console.log(`${engine}: missing edition retains local reading and hides stock prototypes`);
   const continuity=await sharingContinuityChecks({browser,base});
   const sharing=await shareChecks({browser,base,engine,output});console.log(`${engine}: original-fixture sharing checks passed`);
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage();
   const errors=[],external=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:'))external.push(r.url());});
   await page.goto(base);await page.locator('.edition-intro').waitFor();assert.equal(await page.locator('#first-source-notice').isVisible(),true);
   assert.equal(await page.getByRole('link',{name:'All readers',exact:true}).getAttribute('href'),'https://newreading.app/');
   const home=[];
   for(const [name,width,height] of [...sizes,['small-phone',320,568]]){
    await page.setViewportSize({width,height});await settled(page);
    const frame=await page.evaluate(()=>{const image=document.querySelector('.title-page-figure img'),cta=document.querySelector('.edition-start button'),ir=image.getBoundingClientRect(),cr=cta.getBoundingClientRect();return{art:{top:ir.top,bottom:ir.bottom,width:ir.width,height:ir.height,loaded:image.naturalWidth>0},cta:{top:cr.top,bottom:cr.bottom},viewport:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert.ok(frame.art.loaded&&frame.art.width>0&&frame.art.top>=0&&frame.art.bottom<=height);
    assert.ok(frame.cta.top>=0&&frame.cta.bottom<=height,`${engine} ${name}: Begin outside viewport ${JSON.stringify(frame)}`);assert.equal(frame.overflow,false);
    await targets(page,'.masthead a,.masthead button,.edition-start button,.edition-links a,.edition-links button,#catalogue-return');home.push({name,width,height,...frame});await snap(page,`${engine}-direction-home-${name}`);
   }
   await page.setViewportSize({width:390,height:844});await snap(page,`${engine}-austen-home-phone`);
   await page.getByRole('button',{name:'Begin Chapter 1'}).click();await page.locator('#reading-text[data-section=chapter-1]').waitFor();assert.equal(await page.locator('#first-source-notice').count(),0);
   await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Available offline'));
   // Source sections are explicit opt-ins, independent from companion permissions.
   await page.evaluate(()=>location.hash='#read/austen-pride-1894/preface');await page.locator('.source-gate').waitFor();assert.equal(await page.locator('#reading-text .text-block').count(),0);await targets(page,'.source-gate button,.source-gate a');await snap(page,`${engine}-direction-source-gate`);
   await page.locator('[data-action=reveal-source]').click();await settled(page);
   // Compare every rendered section, including notices, source index and license.
   let images=0;
   for(const section of book.sections){
    await open(page,section.id);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${engine}: ${section.id} overflow`);
    assert.equal(await page.locator('#reading-text').textContent(),section.blocks.map(b=>b.text+b.after).join(''),`${engine}: ${section.id} text`);
    const pictureReport=await page.locator('#reading-text img').evaluateAll(xs=>xs.map(x=>({ok:x.complete&&x.naturalWidth>0,w:x.naturalWidth,h:x.naturalHeight,src:x.getAttribute('src')})));
    assert.ok(pictureReport.every(i=>i.ok));images+=pictureReport.length;
    for(const pic of pictureReport){const source=inventory.assets.find(a=>'/'+a.output===pic.src);assert.equal(pic.w,source.width);assert.equal(pic.h,source.height);}
    const expected=section.blocks.flatMap(b=>b.marks).filter(m=>m.kind==='em');if(expected.length)assert.ok(await page.locator('#reading-text em').count()>0);
    const i=book.sections.indexOf(section);if(i>0)assert.equal(await page.locator('.chapter-links a').first().getAttribute('href'),`#read/${book.id}/${book.sections[i-1].id}`);
   }
   assert.equal(images,164);
   // A note splitting the two-character illustrated initial must not duplicate
   // its visible I or detach the source quotation mark.
   await page.evaluate(async book=>{const {renderText}=await import('/text.mjs'),s=book.sections.find(s=>s.id==='chapter-13'),b=s.blocks.find(b=>b.initial),el=document.createElement('div');renderText(el,{blocks:[b]},[{id:'initial-note',segments:[{blockId:b.id,start:1,end:35}]}]);if(el.querySelector('.initial-letter').textContent!=='“I'||el.textContent!==b.text+b.after)throw new Error('Split initial altered the source');},book);
   console.log(`${engine}: all 66 sections and 164 images matched`);
   await open(page,'chapter-13');
   await page.getByRole('button',{name:'Contents',exact:true}).click();await page.locator('#chapter-jump').selectOption(`#read/${book.id}/chapter-61`);await page.locator('#reading-text[data-section=chapter-61]').waitFor();
   await open(page,'chapter-13');
   // The long Collins letter tests a selected range well below a block's top.
   const section=book.sections.find(s=>s.id==='chapter-13'),block=section.blocks.find(b=>b.text.length>1800),start=block.text.length-160,end=block.text.length-35;
   assert.ok(block);const quote=await selection(page,block.id,start,end);
   await page.locator('#selection-save').click();assert.equal(await page.locator('.dialog-quote').textContent(),quote);
   await page.locator('#note-text').fill('A trial note on the formal ending of this letter.');
   page.once('dialog',d=>d.dismiss());await page.keyboard.press('Escape');assert.equal(await page.locator('#note-text').inputValue(),'A trial note on the formal ending of this letter.');assert.equal(await page.locator('dialog').isVisible(),true);await snap(page,`${engine}-direction-unsaved-note`);
   await page.getByRole('button',{name:'Save on this device',exact:true}).click();await waitNote(page);
   await page.reload();await page.locator('#reading-text[data-section=chapter-13]').waitFor();assert.equal((await state(page)).notes[0].quote,quote);
   // Range visibility in the actual context scroller, at large print size.
   await page.getByRole('button',{name:'Reading settings'}).click();await page.locator('#size').evaluate(el=>{el.value='36';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.getByRole('button',{name:'Apply to my reader'}).click();
   await page.getByRole('link',{name:'Passages',exact:true}).click();await page.locator('[data-action=note-context]').click();await page.locator('#context-text[data-location-ready=true]').waitFor();
   const range=await page.evaluate(()=>{const d=document.querySelector('dialog'),header=d.querySelector('.dialog-header'),m=d.querySelector('mark'),r=document.createRange();r.selectNodeContents(m);const a=[...r.getClientRects()].filter(x=>x.width>0),bounds=d.getBoundingClientRect();return{first:a[0].top,last:a.at(-1).bottom,top:Math.max(bounds.top,header.getBoundingClientRect().bottom),bottom:Math.min(innerHeight,bounds.bottom)};});
   assert.ok(range.first>=range.top-2&&range.first<range.bottom,'Selected range begins inside the usable context viewport');
   await snap(page,`${engine}-austen-large-context`);await close(page);
   await open(page,'chapter-13');await page.getByRole('button',{name:'Reading settings'}).click();await page.getByRole('button',{name:'Paper',exact:true}).click();await close(page);
   const reading=[];
   for(const [name,width,height] of sizes){
    await page.setViewportSize({width,height});await open(page,'chapter-13');await page.evaluate(()=>scrollTo(0,0));await settled(page);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${engine} ${name} overflow`);
    await snap(page,`${engine}-austen-${name}`);
    await targets(page,'.masthead a,.masthead button,.reader-tools button');
    await page.evaluate(()=>scrollTo(0,1400));await settled(page);
    const room=await page.evaluate(()=>{const toolbar=document.querySelector('.reader-tools').getBoundingClientRect();return{toolbar:toolbar.height,readingHeight:innerHeight-toolbar.bottom,viewport:innerHeight};});
    assert.ok(room.readingHeight>=height*.65,`${engine} ${name}: insufficient room to read ${JSON.stringify(room)}`);reading.push({name,...room});await snap(page,`${engine}-direction-reading-${name}`);
    await page.locator('.reader-tools [data-action=focus]').click();await page.waitForFunction(()=>document.body.classList.contains('focus')&&document.activeElement.id==='main'&&document.querySelector('#reading-text').dataset.positionReady==='true');assert.equal(await page.locator('#focus-tools').isVisible(),false);assert.equal(await page.locator('.masthead').isVisible(),false);await targets(page,'.chapter-links a');
    await page.keyboard.press('c');await page.locator('#focus-tools').waitFor({state:'visible'});await page.evaluate(()=>document.dispatchEvent(new Event('scroll')));assert.equal(await page.locator('#focus-tools').isVisible(),true);await targets(page,'#focus-tools button');await snap(page,`${engine}-direction-focus-${name}`);await page.getByRole('button',{name:'Hide controls',exact:true}).click();
    assert.equal(await page.locator('#focus-tools').isVisible(),false);
    const first=section.blocks.find(b=>b.initial);await selection(page,first.id,3,55);await page.locator('#selection-save').waitFor({state:'visible'});assert.equal(await page.locator('#selection-save').isVisible(),true);assert.equal(await page.locator('#focus-tools').isVisible(),false);
    await page.evaluate(()=>getSelection().removeAllRanges());await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('focus'));
   }
   await page.setViewportSize({width:390,height:844});await open(page,'chapter-13');
   await page.getByRole('button',{name:'Reading settings'}).click();await page.locator('#theme').selectOption('dusk');await page.locator('#size').evaluate(el=>{el.value='36';el.dispatchEvent(new Event('input',{bubbles:true}));});await page.getByRole('button',{name:'Apply to my reader'}).click();await page.waitForFunction(()=>!document.querySelector('dialog').open&&document.querySelector('#reading-text').dataset.positionReady==='true'&&getComputedStyle(document.querySelector('#reading-text')).fontSize==='36px'&&document.documentElement.dataset.theme==='dusk');await page.evaluate(()=>scrollTo(0,1400));await settled(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await snap(page,`${engine}-direction-night-large`);
   // Import must save the current place even before the scroll debounce fires.
   const importPlace=await page.evaluate(()=>{scrollTo(0,1900);const edge=document.querySelector('.reader-tools').getBoundingClientRect().bottom+20;const el=[...document.querySelectorAll('#reading-text [data-block]')].find(x=>x.getBoundingClientRect().bottom>edge);const r=el.getBoundingClientRect(),expected={blockId:el.dataset.block,ratio:Math.min(1,Math.max(0,(edge-r.top)/Math.max(1,r.height)))};document.querySelector('[data-action=import]').click();return expected;});
   await page.locator('#book-file').waitFor();const afterImport=(await state(page)).positions[book.id];assert.equal(afterImport.blockId,importPlace.blockId);assert.ok(Math.abs(afterImport.ratio-importPlace.ratio)<.002);await close(page);
   await page.getByRole('button',{name:'Reading settings'}).click();await page.getByRole('button',{name:'Paper',exact:true}).click();await close(page);
   // A source page link opens a reference excursion without moving the main place.
   await open(page,'front-matter');await page.locator('#reading-text [data-action=source-context]').filter({hasText:'I.,'}).first().click();await page.locator('#context-text').waitFor();assert.equal(await page.locator('#context-text').getAttribute('data-section'),'chapter-1');await close(page);
   await open(page,'chapter-5');await page.evaluate(()=>scrollTo(0,1100));await page.waitForTimeout(350);
   await page.getByRole('link',{name:'Words',exact:true}).click();
   assert.equal(await page.locator('.echo-list li').count(),0);
   assert.match(await page.locator('.index-empty').textContent(),/Choose the chapters you’ve read/);assert.doesNotMatch(await page.locator('.austen-companion').textContent(),/No matches|0 found/);assert.equal(await page.locator('#echo-form').count(),0);
   await snap(page,`${engine}-word-index-before-boundary`);
   await page.getByRole('button',{name:'Choose what I’ve read',exact:true}).click();await page.locator(`#boundary-${book.id}`).selectOption(String(book.sections.findIndex(s=>s.id==='chapter-5')));await page.getByRole('button',{name:'Set my boundaries'}).click();
   await page.getByRole('button',{name:'pride',exact:true}).click();assert.ok(await page.locator('.echo-list li').count()>0);
   const omission=await page.locator('.echo-list .fragment-surface').first().evaluate(el=>({before:getComputedStyle(el,'::before').content,after:getComputedStyle(el,'::after').content,afterDisplay:getComputedStyle(el,'::after').display,description:el.getAttribute('aria-description'),match:el.querySelector('mark').textContent,text:el.textContent}));
   assert.ok(omission.before.includes('…')&&omission.after.includes('…'));assert.equal(omission.afterDisplay,'inline');assert.equal(omission.match,'pride');assert.ok(omission.description.includes('Earlier text omitted.'));assert.equal(omission.text.startsWith('…'),false);
   await page.evaluate(async book=>{const core=await import('/core.mjs'),{renderPassage}=await import('/text.mjs'),s=book.sections.find(s=>s.id==='chapter-5'),b=s.blocks.find(b=>b.text.includes('pride')),p=core.passageAt(book,s,b),el=document.createElement('blockquote');el.className='fragment-surface';renderPassage(el,p,book,{omittedStart:true,omittedEnd:true,matchStart:0,matchEnd:1});renderPassage(el,p,book);if(el.hasAttribute('data-omitted-start')||el.hasAttribute('data-omitted-end')||el.hasAttribute('aria-description')||el.textContent!==p.quote)throw new Error('Whole passage acquired omission markers or changed text');},book);
   await targets(page,'.austen-companion button');await page.waitForFunction(()=>document.querySelector('#status').textContent==='');await snap(page,`${engine}-direction-word-index-phone`);await page.setViewportSize({width:820,height:1180});await snap(page,`${engine}-direction-word-index-tablet`);await page.setViewportSize({width:390,height:844});
   assert.equal(await page.locator('.echo-list').innerText().then(t=>t.includes('Preface')),false);
   const position=(await state(page)).positions[book.id];await page.getByRole('button',{name:'Read around this occurrence'}).first().click();await page.locator('#context-text[data-location-ready=true]').waitFor();assert.equal(await page.locator('#context-text mark').textContent(),'pride');assert.equal(await page.locator('#context-text[data-omitted-start],#context-text[data-omitted-end]').count(),0);await snap(page,`${engine}-austen-word-context`);await close(page);
   assert.deepEqual((await state(page)).positions[book.id],position);await page.getByRole('button',{name:'Return to your book'}).click();await page.locator('#reading-text[data-section=chapter-5]').waitFor();
   assert.deepEqual((await state(page)).positions[book.id],position);
   // Note-backed bundle export, restore into a fresh context, and repeat restore.
   await page.getByRole('button',{name:'Reading settings'}).click();await page.getByRole('button',{name:'Export a private reading bundle'}).click();
   const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Download private bundle'}).click();const download=await downloading,bundlePath=new URL(`${engine}-austen.reader-bundle.json`,output).pathname;await download.saveAs(bundlePath);await close(page);
   const fresh=await browser.newContext({viewport:{width:390,height:844}}),other=await fresh.newPage();await other.goto(base);await other.locator('.edition-intro').waitFor();
   for(let n=0;n<2;n++){await other.getByRole('button',{name:'Reading settings'}).click();await other.locator('#bundle-file').setInputFiles(bundlePath);await other.locator('[data-action=bundle-apply]:enabled').click();await waitNote(other);assert.equal((await state(other)).notes.length,1);}
   await other.reload();await other.locator('.edition-intro').waitFor();assert.equal((await state(other)).notes[0].quote,quote);const resume=await other.getByRole('button',{name:'Continue reading',exact:true}).boundingBox();assert.ok(resume.y>=0&&resume.y+resume.height<=844);await snap(other,`${engine}-direction-home-resume`);await other.getByRole('button',{name:'Continue reading',exact:true}).click();await other.locator('#reading-text[data-section=chapter-5]').waitFor();await settled(other);assert.equal(await other.locator('#reading-text img').evaluateAll(xs=>xs.every(x=>x.naturalWidth>0)),true);await fresh.close();
   await open(page,'chapter-61');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await stop();
   await assert.rejects(()=>page.request.get(base+'/network-control',{timeout:2000}));
   await page.close();const cold=await context.newPage();await cold.goto(base+'/#read/austen-pride-1894/chapter-61');await cold.locator('#reading-text[data-section=chapter-61]').waitFor();await settled(cold);
   assert.equal(await cold.locator('#reading-text').textContent(),book.sections.find(s=>s.id==='chapter-61').blocks.map(b=>b.text+b.after).join(''));
   const cached=await cold.evaluate(async assets=>{const results=[];for(const a of assets){const r=await fetch('/'+a.output);const bytes=await r.arrayBuffer();const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');results.push(hash===a.sha256);}let failed=false;try{await fetch('/uncached-control-'+Date.now());}catch{failed=true;}return{all:results.every(Boolean),count:results.length,failed};},inventory.assets);
   assert.deepEqual(cached,{all:true,count:165,failed:true});await snap(cold,`${engine}-austen-cold-offline`);assert.equal((await state(cold)).notes[0].quote,quote);
   cold.on('pageerror',e=>errors.push(e.message));cold.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:'))external.push(r.url());});
   // Write and then edit a new exact-source note with the origin still stopped.
   await cold.locator(`.chapter-links a[href="#read/${book.id}/chapter-60"]`).click();await cold.locator('#reading-text[data-section=chapter-60][data-position-ready=true]').waitFor();await settled(cold);
   const offlineSection=book.sections.find(s=>s.id==='chapter-60'),offlineBlock=offlineSection.blocks.find(b=>b.text.length>250);
   const offlineQuote=await selection(cold,offlineBlock.id,12,132);await cold.locator('#selection-save').click();assert.equal(await cold.locator('.dialog-quote').textContent(),offlineQuote);
   await cold.locator('#note-text').fill('Created while the origin was unavailable.');await cold.getByRole('button',{name:'Save on this device',exact:true}).click();await waitNote(cold,2);await cold.waitForFunction(()=>!document.querySelector('dialog').open&&document.querySelector('#reading-text').dataset.positionReady==='true');await settled(cold);await cold.evaluate(()=>scrollTo(0,1500));await settled(cold);
   await cold.getByRole('link',{name:'Words',exact:true}).click();await cold.locator('.austen-companion').waitFor();const offlinePlace=(await state(cold)).positions[book.id];assert.equal(offlinePlace.sectionId,'chapter-60');assert.ok(offlinePlace.blockId,'Outage journey must preserve a position inside the chapter');
   await cold.getByRole('button',{name:'Read around this occurrence'}).first().click();await cold.locator('#context-text[data-location-ready=true]').waitFor();assert.equal(await cold.locator('#context-text mark').textContent(),'pride');await close(cold);
   assert.deepEqual((await state(cold)).positions[book.id],offlinePlace);await cold.getByRole('button',{name:'Return to your book'}).click();await cold.locator('#reading-text[data-section=chapter-60][data-position-ready=true]').waitFor();
   await cold.getByRole('link',{name:'Passages',exact:true}).click();const offlineNote=(await state(cold)).notes.find(n=>n.quote===offlineQuote);assert.ok(offlineNote);
   await cold.locator(`[data-action=edit-note][data-note="${offlineNote.id}"]`).click();await cold.locator('#note-text').fill('Created and revised while the origin was unavailable.');await cold.getByRole('button',{name:'Save on this device',exact:true}).click();
   await cold.waitForFunction(async id=>(await (await import('/db.mjs')).loadState()).notes.find(n=>n.id===id)?.note==='Created and revised while the origin was unavailable.',offlineNote.id);
   await cold.getByRole('button',{name:'Return to your book'}).click();await cold.locator('#reading-text[data-section=chapter-60][data-position-ready=true]').waitFor();const beforeReload=(await state(cold)).positions[book.id];
   await cold.reload();await cold.locator('#reading-text[data-section=chapter-60][data-position-ready=true]').waitFor();await settled(cold);
   const offlineSaved=await state(cold);assert.equal(offlineSaved.notes.length,2);assert.equal(offlineSaved.notes.find(n=>n.id===offlineNote.id).quote,offlineQuote);assert.equal(offlineSaved.notes.find(n=>n.id===offlineNote.id).note,'Created and revised while the origin was unavailable.');assert.deepEqual(offlineSaved.positions[book.id],beforeReload);
   const offlineGeometry=await cold.evaluate(pos=>{const r=document.querySelector(`[data-block="${pos.blockId}"]`).getBoundingClientRect(),edge=document.querySelector('.reader-tools').getBoundingClientRect().bottom+20;return{anchor:r.top+pos.ratio*r.height,edge};},beforeReload);assert.ok(Math.abs(offlineGeometry.anchor-offlineGeometry.edge)<2,'Offline reload restores the saved block offset');
   assert.equal(await cold.locator(`#reading-text mark[data-note="${offlineNote.id}"]`).allTextContents().then(xs=>xs.join('')),offlineQuote);
   await assert.rejects(()=>cold.request.get(base+'/offline-write-network-control',{timeout:2000}));
   await snap(cold,`${engine}-austen-offline-note-reloaded`);await cold.getByRole('link',{name:'Passages',exact:true}).click();await snap(cold,`${engine}-austen-offline-saved-notes`);
   const offlineWrites={created:true,edited:true,reloaded:true,exactQuote:true,chapterNavigation:true,companionRoundTrip:true,placePreserved:true,section:beforeReload.sectionId,block:beforeReload.blockId,noteCount:offlineSaved.notes.length,networkControlStillFails:true,geometry:offlineGeometry};

   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   receipts.push({engine,illustrationCredits,sourceNotices,unavailableEdition,continuity,sharing,home,reading,targetsAtLeast44:true,queuedScrollKeepsRecalledControls:true,importSavesCurrentPlace:true,unsavedNoteEscapeGuard:true,nightLargeType:true,excerptOmissionsOutsideSourceText:true,exactOccurrenceContext:true,sectionsCompared:66,imagesVerified:164,sourceTextContent:true,chapterJump:true,sourceReferenceReturn:true,spoilerGates:true,wordCompanion:true,mainPlacePreserved:true,noteSaveReload:true,largeRange:range,viewports:sizes,focusRecallAndSelection:true,bundleFreshContextAndRepeat:true,coldOffline:cached,offlineWrites,errors,external,limits:'Emulated browsers, not physical iOS/e-ink, touch selection or human proofreading. Bundles retain illustration references; assets remain supplied by this site.'});
   console.log(JSON.stringify(receipts.at(-1)));await context.close();
  }finally{await browser.close();await stop();}
 }
 await writeFile(new URL(process.env.QA_SCOPE==='illustration-credits'?'austen-credit-receipt.json':'austen-browser-receipt.json',output),JSON.stringify(receipts,null,2)+'\n');
}finally{await stop();}
