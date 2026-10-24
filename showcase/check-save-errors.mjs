// Real mounted editions, synthetic storage rejection. No source quotations are fixtures.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {serve} from './serve.mjs';
import {buildShowcase} from './build.mjs';
import {readerPaths} from './readers.mjs';
import {settledRender,settledCapture} from '../tests/experience-browser.mjs';

if(!process.argv.includes('--skip-build'))await buildShowcase();
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const locations={
 austen:['austen-pride-1894','chapter-1'],alice:['alice-rackham-28885','chapter-01'],walden:['walden','chap02'],'two-halls':['hegel','section-3'],
 odyssey:['odyssey-butler-1727','book-01'],dracula:['dracula','chap01'],'at-table':['savarin','s226'],'inward-life':['julian','s13'],
 'beside-the-bed':['nightingale-1898','id00210'],'learning-to-see':['ruskin','letter-1'],'music-and-feeling':['hanslick','chapter-1'],
 nietzsche:['nietzsche','book-1'],mountains:['conway-alps-1904','chapter-01'],'war-and-peace':['war-and-peace-maude','part-01-chapter-01'],
 douglass:['douglass-1845','chapter-i'],poe:['usher-1845','story'],ballads:['iphigenie-de','a1s1'],shakespeare:['folger-julius-caesar','a1-s1'],'pictures-after-dark':['pictures-fr','ronde'],rome:['caesar-vii-en','vii-1']
};
assert.deepEqual(Object.keys(locations).sort(),Object.values(readerPaths).sort(),'Every packaged reader has an actual-source journey');
const selected=process.env.SAVE_ERROR_IDS?.split(',')||Object.keys(locations),engines=process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'];
assert.ok(selected.length&&selected.every(slug=>locations[slug]),'Unknown save-error reader');assert.ok(engines.every(e=>['chromium','webkit'].includes(e)),'Unknown browser engine');
const out=process.env.REVIEW_OUTPUT?pathToFileURL(path.resolve(process.env.REVIEW_OUTPUT)+path.sep):new URL('../test-results/showcase/save-errors/',import.meta.url);await mkdir(out,{recursive:true});
const receipt={checkedAt:new Date().toISOString(),passed:false,cases:[],limits:'Synthetic state-put failures in real mounted readers, with DOM range selection and Chromium/WebKit phone emulation. No natural quota event, actual data loss, native selection or human acceptance is claimed.'};
const save=()=>writeFile(new URL('receipt.json',out),JSON.stringify(receipt,null,2)+'\n');await save();
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const state=(page,mount)=>page.evaluate(async mount=>(await import(mount+'db.mjs')).loadState(),mount);
const ready=(page,book,section)=>page.locator(`#reading-text[data-book="${book}"][data-section="${section}"][data-position-ready="true"]`).waitFor();
async function notices(page){
 const dismiss=page.locator('#dialog[open] [data-action="notice-continue"],#dialog[open] [data-action="notice-read"]');
 if(await dismiss.count()){await dismiss.first().click();await page.locator('#dialog').waitFor({state:'hidden'});}
 const inline=page.locator('[data-action="dismiss-source-notice"]');if(await inline.count())await inline.first().click();
}
async function selectSource(page,section,slug){
 return page.evaluate(({section,slug})=>{
  const blocks=[...document.querySelectorAll('#reading-text [data-block]')],source=new Map(section.blocks.map(b=>[b.id,b]));let pair;
  // Nietzsche's aphorism number is a separate source block; retain it in the range.
  const span=slug==='nietzsche'?2:1;
  for(let i=0;i<blocks.length-span;i++){
   const selected=blocks.slice(i,i+span+1),a=source.get(selected[0].dataset.block),b=source.get(selected.at(-1).dataset.block);
   if(a&&b&&a.text.length>100&&b.text.length>60&&selected.every(el=>el.textContent===source.get(el.dataset.block)?.text&&!el.querySelector('button,a'))){pair=selected;break;}
  }
  // Some apparatus-rich editions interleave source links with every paragraph.
  // A genuine substantial single-block selection still exercises the save path.
  if(!pair){const single=blocks.find(el=>el.textContent.length>300&&el.textContent===source.get(el.dataset.block)?.text&&!el.querySelector('button,a'));if(single)pair=[single];}
  if(!pair)throw Error('No exact selectable source paragraph in the requested section');
  const point=(element,offset)=>{const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode())){if(offset<=node.length)return [node,offset];offset-=node.length;}throw Error('Source selection offset unavailable');};
  pair[0].scrollIntoView({block:'center'});
  const range=document.createRange();range.setStart(...point(pair[0],span===2&&pair.length>1?Math.max(10,pair[0].textContent.length-120):10));range.setEnd(...point(pair.at(-1),pair.length===1?Math.min(220,pair[0].textContent.length):45));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
  return pair.map(el=>el.dataset.block);
 },{section,slug});
}
async function journey(browser,base,slug,engine){
 const [bookId,sectionId]=locations[slug],mount='/'+slug+'/',context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));context.setDefaultTimeout(20000);context.setDefaultNavigationTimeout(45000);
 try{
  const bytes=await readFile(new URL('dist'+mount+'library.json',import.meta.url)),books=JSON.parse(bytes),book=books.find(b=>b.id===bookId),section=book?.sections.find(s=>s.id===sectionId);assert.ok(section,slug+' admitted source section exists');
  await page.goto(base+mount+'#read/'+bookId+'/'+sectionId);await ready(page,bookId,sectionId);await notices(page);
  await page.evaluate(async mount=>{await (await import(mount+'db.mjs')).updateState(s=>{s.prefs={...s.prefs,size:28,leading:1.8,theme:'dusk'};return s;});},mount);
  await page.reload();await ready(page,bookId,sectionId);await notices(page);await settledRender(page);
  assert.equal(await page.locator('#reading-text').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),28,slug+' enlarged reading type');
  const blocks=await selectSource(page,section,slug);await page.locator('#selection-save').click();await page.locator('#note-text').fill('Original saved storage-regression comment.');
  await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
  const saved=await state(page,mount);assert.equal(saved.notes.length,1,slug+' initial note saved');assert.equal(saved.notes[0].segments.length,blocks.length,slug+' actual selection spans each exact source block');
  assert.equal(await page.evaluate(async({mount,book})=>(await import(mount+'core.mjs')).anchorStatus((await (await import(mount+'db.mjs')).loadState()).notes[0],book).valid,{mount,book}),true,slug+' exact source anchors');
  await page.locator('[data-nav="passages"]').click();await page.locator('[data-action="edit-note"]').click();
  const draft='A changed comment retained after a synthetic storage rejection.';await page.locator('#note-text').fill(draft);await settledRender(page);
  const button=page.getByRole('button',{name:'Save on this device',exact:true});await button.focus();const before=await state(page,mount);
  const background=await page.evaluate(()=>{window.saveErrorFocus=document.activeElement;return {x:scrollX,y:scrollY};});
  await page.evaluate(()=>{window.saveErrorPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){if(this.name==='state'&&key==='reader')throw new DOMException('Synthetic note quota failure','QuotaExceededError');return window.saveErrorPut.call(this,value,key);};});
  await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#dialog-error')?.textContent.includes('Synthetic note quota failure'));
  const geometry=await page.evaluate(()=>{
   const dialog=document.querySelector('#dialog'),alert=document.querySelector('#dialog-error'),r=alert.getBoundingClientRect(),d=dialog.getBoundingClientRect(),header=dialog.querySelector('.dialog-header').getBoundingClientRect();
   return {top:r.top,bottom:r.bottom,clipTop:Math.max(d.top+dialog.clientTop,header.bottom),clipBottom:d.top+dialog.clientTop+dialog.clientHeight,background:{x:scrollX,y:scrollY},focusRetained:document.activeElement===window.saveErrorFocus,role:alert.getAttribute('role')};
  });
  await settledCapture(page,{path:new URL(`${engine}-${slug}-save-error.png`,out).pathname});
  assert.ok(geometry.top>=geometry.clipTop&&geometry.bottom<=geometry.clipBottom,slug+' complete alert inside modal: '+JSON.stringify(geometry));
  assert.deepEqual(geometry.background,background,slug+' background scroll unchanged');assert.equal(geometry.focusRetained,true,slug+' keyboard focus retained');assert.equal(geometry.role,'alert');
  assert.equal(await page.locator('#note-text').inputValue(),draft,slug+' draft retained');const failed=await state(page,mount);assert.deepEqual(failed.notes,before.notes,slug+' saved notes unchanged');assert.deepEqual(failed.positions,before.positions,slug+' every main reading place unchanged');assert.equal(failed.lastBook,before.lastBook,slug+' main book unchanged');
  await page.evaluate(()=>{IDBObjectStore.prototype.put=window.saveErrorPut;});await page.keyboard.press('Enter');await page.locator('#dialog').waitFor({state:'hidden'});
  const retried=await state(page,mount);assert.equal(retried.notes[0].note,draft,slug+' retry saves');assert.deepEqual(retried.positions,before.positions,slug+' retry keeps main places');
  await page.reload();await page.locator('[data-action="edit-note"]').waitFor();assert.equal((await state(page,mount)).notes[0].note,draft,slug+' retried note survives reload');assert.deepEqual(errors,[]);
  return {engine,slug,bookId,sectionId,blocks,selectionScope:blocks.length===1?'single substantial source paragraph':`${blocks.length} source blocks`,librarySha256:hash(bytes),sourceSha256:book.source.sha256,syntheticFailure:true,geometry,exactAnchors:true,multiBlockNote:blocks.length>1,draftRetained:true,savedNoteUnchanged:true,mainPlaceUnchanged:true,retrySavedAndReloaded:true};
 }finally{await context.close();}
}
let server,browser;
try{
 server=await serve(Number(process.env.SHOWCASE_TEST_PORT||0));const base='http://127.0.0.1:'+server.address().port;
 for(const engine of engines){const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  for(const slug of selected){receipt.current={engine,slug};await save();console.log(`[${engine}/${slug}] actual-source selection and synthetic save failure`);receipt.cases.push(await journey(browser,base,slug,engine));await save();}
  await browser.close();browser=null;
 }
 receipt.passed=true;delete receipt.current;await save();console.log(`Save-error checks passed: ${receipt.cases.length} mounted reader/engine cases.`);
}catch(error){receipt.failure={...receipt.current,message:error.message};await save();throw error;}
finally{await browser?.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
