// Mounted admission check. Read literary text from the built edition, never from copied fixtures.
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
import {buildShowcase} from './build.mjs';
import {settledRender, settledCapture} from '../tests/experience-browser.mjs';

const input=path.resolve(process.env.SHOWCASE_INPUT||fileURLToPath(new URL('./dist/',import.meta.url)));
const output=path.resolve(process.env.REVIEW_OUTPUT||fileURLToPath(new URL('../test-results/awakening/',import.meta.url)));
const privateRoots=[new URL('../test-results/',import.meta.url),new URL('../../.local/publication-awakening-2026-11-04/',import.meta.url)].map(url=>path.resolve(fileURLToPath(url)));
assert.ok(privateRoots.some(root=>output===root||output.startsWith(root+path.sep)),'Evidence must stay in an ignored private review directory');
assert.ok(output!==input&&!output.startsWith(input+path.sep),'Evidence must not enter the mounted build');
const hosted=process.env.SHOWCASE_BASE_URL?.replace(/\/$/,'');
if(!hosted&&!process.argv.includes('--skip-build'))await buildShowcase({output:input});
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const engines=process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'];
assert.ok(engines.every(engine=>['chromium','webkit'].includes(engine)),'Unknown browser engine');
const mount='/awakening/',bookId='kate-chopin-the-awakening-gutenberg-160';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const libraryBytes=await readFile(path.join(input,'awakening/library.json'));
const appBytes=await readFile(path.join(input,'awakening/app.mjs'));
const licenseBytes=await readFile(path.join(input,'awakening/gutenberg-license.txt'));
const requiredNotice=licenseBytes.toString('utf8').split('1.E.1.')[1]?.split('1.E.2.')[0].split('\n').filter(line=>/^ {4}\S/.test(line)).map(line=>line.trim()).join(' ');
assert.ok(requiredNotice?.length>300,'Required access notice is derived from the mounted license');
const {unpackLicensedZip}=await import(pathToFileURL(path.join(input,'awakening/awakening-zip.mjs')).href);
const transcriptMarkup=appBytes.toString('utf8').match(/<details class="page-transcript">[\s\S]*?<\/details>/)?.[0];
assert.ok(transcriptMarkup,'The mounted runtime includes its page transcription');
const library=JSON.parse(libraryBytes),book=library.find(value=>value.id===bookId);
assert.equal(library.length,1,'Only the admitted novel is mounted');
assert.equal(book?.sections.length,39,'The mounted edition contains all chapters');
const first=book.sections[0],chapter17=book.sections.find(section=>section.id==='chapter-17'),chapter18=book.sections.find(section=>section.id==='chapter-18');
assert.ok(chapter17&&chapter18,'The mounted edition contains the exercised chapters');
await mkdir(output,{recursive:true});
const receipt={checkedAt:new Date().toISOString(),passed:false,mode:hosted?'existing hosted origin':'own stoppable loopback origin',sourceSha256:book.source.sha256,librarySha256:hash(libraryBytes),appSha256:hash(appBytes),zipModuleSha256:hash(await readFile(path.join(input,'awakening/awakening-zip.mjs'))),workerSha256:hash(await readFile(path.join(input,'awakening/sw.js'))),cases:[],limits:'Isolated automated Chromium/WebKit profiles, emulated phone/tablet viewports, real pointer actions and deterministic DOM-range selection. No owner profile, physical-device/native-touch selection, screen-reader, installation, human acceptance, worldwide rights or historical-source proofreading claim. Schema-1 bundle evidence uses original test records and the actual admitted edition, not an owner backup. Hosted mode does not claim stopped-origin operation.'};
const save=()=>writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
let activePage;
async function stage(engine,label,run){
 receipt.current={engine,label};await save();console.log(`[${engine}/awakening] ${label}`);
 try{return await run();}catch(error){receipt.failure={...receipt.current,message:error.stack};await activePage?.screenshot({path:path.join(output,`${engine}-failure.png`),timeout:5000}).catch(()=>{});await save();throw error;}
}
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.txt':'text/plain'};
async function serve(){
 const security=JSON.parse(await readFile(new URL('./vercel.json',import.meta.url))).routes.find(route=>route.headers?.['Content-Security-Policy']).headers;
 const server=createServer(async(req,res)=>{try{let file=path.resolve(input,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));assert.ok(file===input||file.startsWith(input+path.sep));if((await stat(file)).isDirectory())file=path.join(file,'index.html');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store',...security});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return{base:'http://127.0.0.1:'+server.address().port,async stop(){if(server.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}};
}
async function accessNotice(page,base,{blocked=false,captureName}={}){
 await page.locator('#dialog[open] .access-notice').waitFor();assert.equal(await page.locator('.access-notice').textContent(),requiredNotice,'Complete required notice is rendered before first reading');assert.equal(await page.locator('#dialog-title').textContent(),'Before reading');
 assert.equal(await page.getByRole('link',{name:'Full Project Gutenberg license',exact:true}).getAttribute('href'),new URL(mount+'gutenberg-license.txt',base).href);
 if(blocked)assert.match(await page.locator('#dialog-content').innerText(),/could not remember[\s\S]*may appear again/);
 else{const keys=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('awakening-source-notice:')));assert.equal(keys.length,1);assert.equal(await page.evaluate(key=>localStorage.getItem(key),keys[0]),'shown');}
 if(captureName)await capture(page,captureName);
 await page.getByRole('button',{name:'Continue',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});await settledRender(page);
}
async function blockedNoticeJourney(browser,base,engine){
 const profile=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});await profile.addInitScript(()=>{const get=Storage.prototype.getItem,set=Storage.prototype.setItem;Storage.prototype.getItem=function(key){if(String(key).startsWith('awakening-source-notice:'))throw new DOMException('Original notice-storage test failure','SecurityError');return get.call(this,key);};Storage.prototype.setItem=function(key,value){if(String(key).startsWith('awakening-source-notice:'))throw new DOMException('Original notice-storage test failure','QuotaExceededError');return set.call(this,key,value);};});
 const page=await profile.newPage();page.setDefaultTimeout(20000);try{await page.goto(base+mount);await accessNotice(page,base,{blocked:true});await page.locator('.awakening-cover [data-action="resume"]').click();await ready(page,first);assert.equal(await page.locator('#dialog[open] .access-notice').count(),0,'Storage failure does not repeat the notice during the current session');await page.locator('[data-action="contents"]').click();await page.locator(`#dialog a[href="#read/${bookId}/${chapter17.id}"]`).click();await ready(page);assert.equal(await page.locator('#dialog[open] .access-notice').count(),0);await page.reload();await accessNotice(page,base,{blocked:true});await ready(page);return{readingAvailable:true,oneNoticePerSession:true,honestReopeningWarning:true,reappearsAfterReload:true};}catch(error){receipt.noticeFailure={engine,url:page.url(),surface:await page.evaluate(()=>({coverVisible:!!document.querySelector('.awakening-cover'),readingSection:document.querySelector('#reading-text')?.dataset.section??null,noticeOpen:!!document.querySelector('#dialog[open] .access-notice')}))};await page.screenshot({path:path.join(output,`${engine}-blocked-notice-failure.png`)});await save();throw error;}finally{await profile.close();}
}
const state=page=>page.evaluate(async mount=>(await import(mount+'db.mjs')).loadState(),mount);
const ready=(page,section=chapter17)=>page.locator(`#reading-text[data-book="${bookId}"][data-section="${section.id}"][data-position-ready="true"]`).waitFor();
async function close(page){await page.keyboard.press('Escape');await page.locator('#dialog').waitFor({state:'hidden'});await settledRender(page);}
async function tapVisible(page,selector){
 const nodes=page.locator(selector);for(let i=0;i<await nodes.count();i++){const r=await nodes.nth(i).boundingBox(),viewport=page.viewportSize();if(r&&r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width&&r.y+r.height<=viewport.height){await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);return;}}throw Error('No fully visible touch target: '+selector);
}
async function backdrop(page){
 const point=await page.locator('#dialog').evaluate(el=>{const r=el.getBoundingClientRect();if(r.left>2)return{x:r.left/2,y:Math.min(innerHeight-2,Math.max(2,r.top+r.height/2))};if(r.top>2)return{x:innerWidth/2,y:r.top/2};return null;});
 assert.ok(point,'Dialog has a usable backdrop');await page.touchscreen.tap(point.x,point.y);
}
async function capture(page,name){
 await settledRender(page);const geometry=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth}));assert.ok(geometry.documentWidth<=geometry.width,name+': no horizontal page overflow');
 await settledCapture(page,{path:path.join(output,name+'.png')});
}
async function exactSurface(page,section,selector='#reading-text'){
 const result=await page.locator(selector).evaluate((root,section)=>{
  const nodes=[...root.querySelectorAll('[data-block]')],failures=[];
  if(nodes.length!==section.blocks.length)failures.push('block count');
  for(const [index,source] of section.blocks.entries()){
   const node=nodes[index];if(!node||node.dataset.block!==source.id||node.textContent!==source.text){failures.push(source.id+': text/order');continue;}
   if(node.nextSibling?.nodeType!==Node.TEXT_NODE||node.nextSibling.textContent!==source.after)failures.push(source.id+': paragraph spacing');
   const actual={em:[],strong:[],sup:[],sub:[]};let offset=0;const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let leaf;
   while(leaf=walker.nextNode()){for(const kind of Object.keys(actual))if(leaf.parentElement.closest(kind)){const previous=actual[kind].at(-1);if(previous?.end===offset)previous.end+=leaf.length;else actual[kind].push({start:offset,end:offset+leaf.length});}offset+=leaf.length;}
   for(const kind of Object.keys(actual)){const expected=source.marks.filter(mark=>mark.kind===kind).map(({start,end})=>({start,end}));if(JSON.stringify(actual[kind])!==JSON.stringify(expected))failures.push(source.id+': '+kind+' ranges');}
  }
  if(root.textContent!==section.blocks.map(block=>block.text+block.after).join(''))failures.push('whole section characters');
  return{failures,blocks:nodes.length,emphasisRanges:section.blocks.flatMap(block=>block.marks).length};
 },section);
 assert.deepEqual(result.failures,[],section.id+' exact characters, paragraph separators and emphasis');return result;
}
async function markPlace(page,section){
 const marker=await page.evaluate(section=>{
  const block=section.blocks.find(block=>block.text.length>180),el=[...document.querySelectorAll('#reading-text [data-block]')].find(el=>el.dataset.block===block.id);let offset=Math.floor(block.text.length*.55);while(/\s/u.test(block.text[offset]))offset++;
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let leaf,remaining=offset;while(leaf=walker.nextNode()){if(remaining<leaf.length)break;remaining-=leaf.length;}
  const range=document.createRange();range.setStart(leaf,remaining);range.setEnd(leaf,remaining+1);
  for(let i=0;i<2;i++){const chrome=[...document.querySelectorAll('.masthead,.reader-tools')].map(el=>el.getBoundingClientRect()).filter(r=>r.height>0&&r.top<innerHeight&&r.bottom>0);scrollBy(0,range.getBoundingClientRect().top-Math.max(0,...chrome.map(r=>r.bottom))-60);}
  return{blockId:block.id,offset,character:leaf.textContent[remaining]};
 },section);await page.waitForTimeout(350);await visiblePlace(page,marker);return marker;
}
async function visiblePlace(page,marker){
 const actual=await page.evaluate(marker=>{
  const el=[...document.querySelectorAll('#reading-text [data-block]')].find(el=>el.dataset.block===marker.blockId),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let leaf,offset=marker.offset;while(leaf=walker.nextNode()){if(offset<leaf.length)break;offset-=leaf.length;}
  const range=document.createRange();range.setStart(leaf,offset);range.setEnd(leaf,offset+1);const r=range.getBoundingClientRect(),chrome=[...document.querySelectorAll('.masthead,.reader-tools')].map(el=>el.getBoundingClientRect()).filter(q=>q.height>0&&q.top<innerHeight&&q.bottom>0&&q.left<r.right&&q.right>r.left);
  return{character:leaf.textContent[offset],top:r.top,bottom:r.bottom,usableTop:Math.max(0,...chrome.map(r=>r.bottom)),height:innerHeight};
 },marker);
 assert.equal(actual.character,marker.character,'Same source character after the excursion');assert.ok(actual.top>=actual.usableTop-1&&actual.bottom<=actual.height,'Source character is inside the usable viewport: '+JSON.stringify(actual));
}
async function disclosure(page){
 await page.locator('#dialog[open] [data-action="chapter-context-open"]').waitFor();assert.match(await page.locator('.context-scope').innerText(),/through Chapter XVII/);
 assert.equal(await page.locator('.calling-reading,.sherwood-plate,.page-transcript').count(),0,'No excerpt or source image before affirmative disclosure');
}
async function contextAssets(page,base){
 await page.locator('.calling-reading').waitFor();assert.equal(await page.locator('[data-action="chapter-context-open"]').count(),0,'Context is now open');
 const excerpt=await page.locator('.calling-reading > blockquote').first().evaluate(el=>{const copy=el.cloneNode(true);copy.querySelector('cite')?.remove();return copy.textContent.slice(1,-1);});
 assert.ok(excerpt.length>40&&chapter17.blocks.some(block=>block.text.includes(excerpt)),'Context excerpt is an exact, nonempty range of Chapter XVII');
 const image=page.locator('.sherwood-plate img');await image.scrollIntoViewIfNeeded();await image.evaluate(image=>image.decode());
 const loaded=await image.evaluate(image=>({url:image.currentSrc,width:image.naturalWidth,height:image.naturalHeight}));assert.equal(loaded.url,new URL(mount+'sherwood-p62.webp',base).href);assert.ok(loaded.width>400&&loaded.height>400,'Mounted historical page has decoded pixels');
 const imageURLs=await page.locator('.sherwood-plate a').evaluateAll(nodes=>nodes.map(node=>node.href));assert.ok(imageURLs.length>=2&&imageURLs.every(url=>url===loaded.url),'Enlargement and image stay in the mounted edition');
 await page.locator('.page-transcript summary').click();assert.equal(await page.locator('.page-transcript').getAttribute('open'),'');
 const transcript=await page.locator('.page-transcript p:not(.small)').allTextContents(),expected=await page.evaluate(markup=>[...new DOMParser().parseFromString(markup,'text/html').querySelectorAll('p:not(.small)')].map(p=>p.textContent),transcriptMarkup);assert.equal(transcript.length,3);assert.deepEqual(transcript,expected,'Rendered page transcription retains the mounted runtime copy');assert.ok(transcript.every(text=>text.length>100),'Each transcription paragraph is substantial');assert.ok(await page.locator('.page-transcript em').count());
 const selectable=await page.locator('.page-transcript p:not(.small)').first().evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(range);const text=getSelection().toString();getSelection().removeAllRanges();return text===el.textContent;});assert.equal(selectable,true);
 return{imagePath:new URL(loaded.url).pathname,imagePixels:[loaded.width,loaded.height],transcriptParagraphs:transcript.length,transcriptCharacters:transcript.join('').length,exactNovelExcerpt:true};
}
async function showTranscript(page){await page.locator('.page-transcript p:not(.small)').first().evaluate(el=>{const dialog=document.querySelector('#dialog'),header=document.querySelector('.dialog-header');dialog.scrollTop+=el.getBoundingClientRect().top-header.getBoundingClientRect().bottom-20;});await settledRender(page);}
async function noteJourney(page,section){
 const selected=await page.evaluate(section=>{
  const block=section.blocks.find(block=>block.marks.some(mark=>mark.kind==='em')),em=block.marks.find(mark=>mark.kind==='em'),el=[...document.querySelectorAll('#reading-text [data-block]')].find(el=>el.dataset.block===block.id);
  el.scrollIntoView({block:'center'});const start=Math.max(0,em.start-20),end=Math.min(block.text.length,em.end+40),point=offset=>{const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let leaf;while(leaf=walker.nextNode()){if(offset<=leaf.length)return[leaf,offset];offset-=leaf.length;}throw Error('Missing source offset');};
  const range=document.createRange();range.setStart(...point(start));range.setEnd(...point(end));getSelection().removeAllRanges();getSelection().addRange(range);return{text:range.toString(),blockId:block.id,start,end};
 },section);
 await page.locator('#selection-save').click();assert.equal(await page.locator('.dialog-quote').textContent(),selected.text);await page.locator('#note-text').fill('Original mounted Awakening verification note.');await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
 const saved=(await state(page)).notes;assert.equal(saved.length,1);assert.equal(saved[0].quote,selected.text);assert.equal(saved[0].revision,book.source.sha256);assert.equal(saved[0].segments[0].start,selected.start);assert.equal(saved[0].segments[0].end,selected.end);await exactSurface(page,section);
 await page.locator(`mark[data-note="${saved[0].id}"]`).first().click();await page.locator('#note-text').fill('Original unsaved mounted verification draft.');let prompt;const draft=await licensedDownload(page,()=>page.locator('[data-action="export-draft"]').click(),'private-draft.reader-backup.zip');assert.equal(draft.value.notes[0].note,'Original unsaved mounted verification draft.');assert.deepEqual(draft.value.notes[0].segments,saved[0].segments);assert.equal(await page.locator('#note-text').inputValue(),'Original unsaved mounted verification draft.');
 page.once('dialog',async dialog=>{prompt=dialog.message();await dialog.dismiss();});await backdrop(page);assert.match(prompt,/unsaved|discard/i);assert.equal(await page.locator('#dialog').evaluate(el=>el.open),true);assert.equal(await page.locator('#note-text').inputValue(),'Original unsaved mounted verification draft.');assert.deepEqual((await state(page)).notes,saved);
 page.once('dialog',dialog=>dialog.accept());await backdrop(page);await page.locator('#dialog').waitFor({state:'hidden'});assert.deepEqual((await state(page)).notes,saved);return saved;
}
async function noteContext(page,note){
 await page.getByRole('link',{name:'Passages',exact:true}).click();await page.locator(`[data-action="note-context"][data-note="${note.id}"]`).click();await page.locator('#context-text[data-location-ready="true"]').waitFor();await exactSurface(page,chapter17,'#context-text');
 const result=await page.locator('#context-text').evaluate(root=>{
  const marks=[...root.querySelectorAll('mark')],dialog=document.querySelector('#dialog').getBoundingClientRect(),header=document.querySelector('.dialog-header').getBoundingClientRect(),rects=marks.flatMap(mark=>{const range=document.createRange();range.selectNodeContents(mark);return [...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>({top:r.top,bottom:r.bottom,left:r.left,right:r.right}));});
  return{text:marks.map(mark=>mark.textContent).join(''),italic:!!root.querySelector('mark em'),rects,top:Math.max(0,dialog.top,header.bottom),bottom:Math.min(innerHeight,dialog.bottom),left:Math.max(0,dialog.left),right:Math.min(innerWidth,dialog.right)};
 });
 assert.equal(result.text,note.quote);assert.equal(result.italic,true);assert.ok(result.rects.length&&result.rects.every(r=>r.top>=result.top-1&&r.bottom<=result.bottom+1&&r.left>=result.left-1&&r.right<=result.right+1),'The actual selected range is visible inside the context viewport');await close(page);
 await page.locator(`[data-action="resume"][data-book="${bookId}"]`).click();await ready(page);return{exactSelectedRange:true,italicRetained:true,fullRangeVisible:true};
}
async function licensedDownload(page,action,expectedName){
 const pending=page.waitForEvent('download');await action();const download=await pending;assert.equal(download.suggestedFilename(),expectedName);const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const bytes=Buffer.concat(chunks),payload=Buffer.from(await unpackLicensedZip(bytes));
 // Independently inspect the stored ZIP entries: both byte sequences must be present.
 const entries=[];let offset=0;while(bytes.readUInt32LE(offset)===0x04034b50){assert.equal(bytes.readUInt16LE(offset+8),0);const size=bytes.readUInt32LE(offset+18),nameLength=bytes.readUInt16LE(offset+26),extraLength=bytes.readUInt16LE(offset+28),start=offset+30+nameLength+extraLength;entries.push({name:bytes.subarray(offset+30,offset+30+nameLength).toString('utf8'),data:bytes.subarray(start,start+size)});offset=start+size;}assert.deepEqual(entries.map(entry=>entry.name),['payload.json','gutenberg-license.txt']);assert.ok(entries[0].data.equals(payload),'ZIP payload bytes are unchanged');assert.ok(entries[1].data.equals(licenseBytes),'ZIP contains the exact full mounted license');return{bytes,payload,value:JSON.parse(payload)};
}
async function downloadBundle(page){
 await page.locator('[data-action="settings"]').first().click();await page.locator('[data-action="bundle-export"]').click();return licensedDownload(page,()=>page.getByRole('button',{name:'Download private bundle',exact:true}).click(),'private-reading.reader-bundle.zip');
}
async function bundleJourney(browser,page,base,engine){
 // Exercise every schema-1 saved-record family with actual mounted-edition anchors.
 await page.evaluate(async({mount,book})=>{const db=await import(mount+'db.mjs'),core=await import(mount+'core.mjs'),section=book.sections[16],block=section.blocks.find(block=>block.text.length>100),other=core.passageAt(book,section,block,5,70);await db.updateState(state=>{state.connections=[{id:'mounted-connection',passages:[state.notes[0],other],note:'Original schema-one connection.',updated:1700000000000}];state.reflections={'mounted-reflection':'Original preserved schema-one reflection.'};state.boundaries[book.id]={index:16,revision:book.source.sha256};return state;});},{mount,book});
 const exported=await downloadBundle(page),bytes=exported.bytes,jsonBytes=exported.payload,bundle=exported.value;assert.ok(jsonBytes.equals(Buffer.from(JSON.stringify(bundle))),'The ZIP preserves the existing compact bundle JSON serialization');assert.equal(bundle.format,'personal-reader-bundle');assert.equal(bundle.schema,1);assert.deepEqual(bundle.books,[book]);assert.equal(bundle.state.connections.length,1);assert.equal(bundle.state.notes.length,1);assert.equal(bundle.state.boundaries[bookId].index,16);assert.ok(bundle.state.positions[bookId]);
 await writeFile(path.join(output,`${engine}-schema1.private.reader-bundle.zip`),bytes);
 await page.locator('[data-action="settings"]').first().click();const edition=await licensedDownload(page,()=>page.locator(`[data-action="export-edition"][data-book="${bookId}"]`).click(),bookId+'.reader.zip');assert.deepEqual(edition.value,book);assert.ok(edition.payload.equals(Buffer.from(JSON.stringify(book,null,2))),'The edition JSON serialization is unchanged');const backupBefore=await state(page),backup=await licensedDownload(page,()=>page.locator('[data-action="export"]').click(),'private-passages.reader-backup.zip');assert.deepEqual(backup.value,backupBefore);await close(page);
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'}),target=await context.newPage();target.setDefaultTimeout(20000);
 try{
  await target.goto(base+mount);await accessNotice(target,base);await target.locator('.awakening-cover [data-action="resume"]').waitFor();const empty=await state(target);assert.deepEqual(empty.notes,[]);assert.deepEqual(empty.positions,{});assert.deepEqual(empty.boundaries,{});
  const restore=async(wrapped=true)=>{await target.locator('[data-action="settings"]').first().click();await target.locator('#bundle-file').setInputFiles({name:wrapped?'private-schema1.reader-bundle.zip':'private-schema1.reader-bundle.json',mimeType:wrapped?'application/zip':'application/json',buffer:wrapped?bytes:jsonBytes});await target.locator('[data-action="bundle-apply"]').waitFor();assert.equal(await target.locator('[data-action="bundle-apply"]').isEnabled(),true);assert.equal(await target.locator('.dialog-error').innerText(),'');await target.locator('#bundle-appearance').check();await target.locator('[data-action="bundle-apply"]').click();await target.locator('#dialog').waitFor({state:'hidden'});};
  await restore();const restored=await state(target);
  for(const key of ['notes','connections','reflections','positions','prefs','lastBook'])assert.deepEqual(restored[key],bundle.state[key],'Restored schema-1 '+key);
  assert.deepEqual(restored.boundaries,empty.boundaries,'Restoration does not widen destination companion permissions');
  const second=(await downloadBundle(target)).value;assert.deepEqual(second.books,bundle.books);for(const key of ['notes','connections','reflections','positions','prefs','lastBook'])assert.deepEqual(second.state[key],bundle.state[key],'Roundtrip schema-1 '+key);
  await restore(false);const replayed=await state(target);assert.deepEqual(replayed.notes,restored.notes);assert.deepEqual(replayed.connections,restored.connections);assert.deepEqual(replayed.reflections,restored.reflections);
  for(const wrapped of [true,false]){await target.locator('[data-action="settings"]').first().click();await target.locator('#restore-file').setInputFiles({name:wrapped?'private-passages.reader-backup.zip':'private-passages.reader-backup.json',mimeType:wrapped?'application/zip':'application/json',buffer:wrapped?backup.bytes:backup.payload});await target.locator('#dialog').waitFor({state:'hidden'});const merged=await state(target);for(const key of ['notes','connections','reflections','positions'])assert.deepEqual(merged[key],restored[key],'Old and licensed backup preserve '+key);}
  await target.locator('.awakening-cover [data-action="resume"]').click();await ready(target,chapter17);await exactSurface(target,chapter17);
  const changedNotes=structuredClone(replayed.notes);await target.getByRole('link',{name:'Passages',exact:true}).click();await target.locator(`[data-action="edit-note"][data-note="${changedNotes[0].id}"]`).click();await target.locator('#note-text').fill('Original fresh-profile-only change.');await target.getByRole('button',{name:'Save on this device',exact:true}).click();await target.locator('#dialog').waitFor({state:'hidden'});assert.deepEqual((await state(page)).notes,bundle.state.notes,'Destination writes do not alter the source profile');
  return{schema:1,licensedZipWithExactJSONAndLicense:true,exactEditionZip:true,oldJSONAndNewZipRestore:true,oldJSONAndNewZipBackupMerge:true,exactFullEdition:true,savedRecordFamilies:['notes','connections','reflections','positions','prefs','lastBook'],permissionsRemainLocal:true,replayDoesNotDuplicate:true,freshProfileIndependent:true,bundleSha256:hash(bytes)};
 }finally{await context.close();}
}
let browser,server,context;
try{
 for(const engine of engines){
  const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'];browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});server=hosted?null:await serve();const base=hosted||server.base;
  context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});context.setDefaultTimeout(20000);context.setDefaultNavigationTimeout(45000);const page=await context.newPage();activePage=page;const errors=[];page.on('pageerror',error=>errors.push(error.message));const result={engine,engineVersion:browser.version()};receipt.cases.push(result);
  await stage(engine,'mounted entrance, offline cache and disclosed context',async()=>{
   await page.goto(base+mount);await accessNotice(page,base,{captureName:`${engine}-access-notice`});await page.reload();await page.locator('.awakening-cover [data-action="resume"]').waitFor();await settledRender(page);assert.equal(await page.locator('#dialog[open] .access-notice').count(),0,'Unchanged edition does not repeat the access notice after reload');result.accessNotice={complete:true,licenseImmediatelyAvailable:true,rememberedAfterReload:true};await page.locator('#offline-status').filter({hasText:'Available offline'}).waitFor({timeout:90000});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);assert.equal(await page.evaluate(()=>new URL(navigator.serviceWorker.controller.scriptURL).pathname),mount+'sw.js');assert.equal(hash(await(await page.request.get(base+mount+'library.json')).body()),hash(libraryBytes),'Served source bytes match the inspected mount');for(const file of ['app.mjs','sw.js','awakening-zip.mjs']){const response=await page.request.get(base+mount+file);assert.equal(response.status(),200);assert.equal(hash(await response.body()),hash(await readFile(path.join(input,'awakening',file))),'Served '+file+' matches the inspected mount');}
   await capture(page,`${engine}-entrance-phone`);await page.setViewportSize({width:768,height:1024});await capture(page,`${engine}-entrance-tablet`);await page.setViewportSize({width:390,height:844});
   const before=await state(page);await page.locator('.cover-context').focus();await page.keyboard.press('Enter');await disclosure(page);await capture(page,`${engine}-disclosure`);await page.locator('[data-action="chapter-context-open"]').click();result.context=await contextAssets(page,base);await showTranscript(page);await capture(page,`${engine}-transcription-phone`);await close(page);assert.deepEqual((await state(page)).positions,before.positions);assert.deepEqual((await state(page)).boundaries,before.boundaries);assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('cover-context')),true);
   result.disclosureBeforeExcerpt=true;
  });
  await stage(engine,'source characters, paragraphs and italic ranges',async()=>{
   await page.locator('.awakening-cover [data-action="resume"]').click();await ready(page,first);assert.equal(await page.locator('#dialog[open] .access-notice').count(),0);result.openingSource=await exactSurface(page,first);await page.locator('[data-action="contents"]').click();await page.locator(`#dialog a[href="#read/${bookId}/${chapter17.id}"]`).click();await ready(page);assert.equal(await page.locator('#dialog[open] .access-notice').count(),0,'Access notice does not repeat on chapter changes');result.chapter17Source=await exactSurface(page,chapter17);await capture(page,`${engine}-chapter17`);
  });
  await stage(engine,'exact selected note and unsaved backdrop guard',async()=>{result.notes=await noteJourney(page,chapter17);result.guardedBackdrop=true;result.licensedDraftExportRetainsDraft=true;result.noteContext=await noteContext(page,result.notes[0]);});
  await stage(engine,'direct chapter context, contents return and quiet reading',async()=>{
   const marker=await markPlace(page,chapter17),before=await state(page);await tapVisible(page,'.reader-tools [data-action="chapter-context"]');assert.equal(await page.locator('[data-action="chapter-context-open"]').count(),0,'Chapter XVII opens context directly');await contextAssets(page,base);await close(page);await visiblePlace(page,marker);assert.deepEqual((await state(page)).positions,before.positions);assert.deepEqual((await state(page)).boundaries,before.boundaries);
   await page.locator('[data-action="contents"]').focus();await page.keyboard.press('Enter');await page.locator('.contents-context').click();await disclosure(page);await page.locator('[data-action="chapter-context-open"]').click();await page.locator('.calling-reading').waitFor();await backdrop(page);await page.locator('#dialog').waitFor({state:'hidden'});await visiblePlace(page,marker);assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'contents');
   await page.locator('.reader-tools [data-action="focus"]').click();await page.waitForFunction(()=>document.body.classList.contains('focus')&&document.querySelector('#focus-tools').hidden);await page.keyboard.press('c');await page.waitForFunction(()=>!document.querySelector('#focus-tools').hidden);const exit=await page.locator('#focus-exit').boundingBox();assert.ok(exit.width>=44&&exit.height>=44);await capture(page,`${engine}-focus-controls`);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('focus')&&document.querySelector('#reading-text')?.dataset.positionReady==='true'&&document.activeElement?.dataset.action==='focus');
   await page.locator('[data-action="contents"]').click();await page.locator(`#dialog a[href="#read/${bookId}/${chapter18.id}"]`).click();await ready(page,chapter18);await exactSurface(page,chapter18);await page.locator('[data-action="contents"]').click();await page.locator(`#dialog a[href="#read/${bookId}/${chapter17.id}"]`).click();await ready(page);result.mainPlaceReturns=true;result.contentsAndFocus=true;
  });
  await stage(engine,'large reading type, source license and mounted storage scope',async()=>{
   await page.locator('[data-action="settings"]').first().click();await page.locator('#size').fill('36');await page.getByRole('button',{name:'Apply to my reader',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});assert.equal(await page.locator('#reading-text').evaluate(el=>getComputedStyle(el).fontSize),'36px');
   await page.locator('.reader-tools [data-action="chapter-context"]').click();await page.locator('.calling-reading').waitFor();assert.equal(await page.locator('.calling-reading').evaluate(el=>getComputedStyle(el).fontSize),'36px');await contextAssets(page,base);assert.equal(await page.locator('.page-transcript p:not(.small)').first().evaluate(el=>getComputedStyle(el).fontSize),'36px');await showTranscript(page);await capture(page,`${engine}-large-context-phone`);await page.setViewportSize({width:768,height:1024});await showTranscript(page);await capture(page,`${engine}-large-context-tablet`);await page.setViewportSize({width:390,height:844});await close(page);
   await page.locator('[data-action="background"]').click();const link=page.getByRole('link',{name:'Full Project Gutenberg license',exact:true});const licenseURL=await link.getAttribute('href');assert.equal(licenseURL,new URL(mount+'gutenberg-license.txt',base).href);const response=await page.request.get(licenseURL);assert.equal(response.status(),200);assert.equal(hash(await response.body()),hash(await readFile(path.join(input,'awakening/gutenberg-license.txt'))));await close(page);
   const sibling=await page.evaluate(async()=> (await import('/book-of-tea/db.mjs')).loadState());assert.deepEqual(sibling.notes,[]);assert.deepEqual(sibling.positions,{});assert.equal((await state(page)).notes.length,1);result.largeType=36;result.licenseMountedAndExact=true;result.siblingStorageIndependent=true;
  });
  await stage(engine,'notice storage fallback in an isolated profile',async()=>{result.blockedNotice=await blockedNoticeJourney(browser,base,engine);});
  await stage(engine,'full schema-1 bundle in a fresh isolated profile',async()=>{result.bundle=await bundleJourney(browser,page,base,engine);});
  if(server)await stage(engine,'origin stopped: reload, chapter navigation, source image and note',async()=>{
   await server.stop();await assert.rejects(()=>fetch(base+mount+'library.json'), 'Own loopback origin is actually stopped');await page.reload();await ready(page);await exactSurface(page,chapter17);assert.equal(await page.locator('#dialog[open] .access-notice').count(),0);assert.deepEqual((await state(page)).notes,result.notes);
   await page.locator('.reader-tools [data-action="chapter-context"]').click();await contextAssets(page,base);await capture(page,`${engine}-offline-context`);await close(page);
   await page.locator('[data-action="contents"]').click();await page.locator(`#dialog a[href="#read/${bookId}/${chapter18.id}"]`).click();await ready(page,chapter18);await exactSurface(page,chapter18);
   await page.getByRole('link',{name:'Passages',exact:true}).click();await page.locator(`[data-action="edit-note"][data-note="${result.notes[0].id}"]`).click();await page.locator('#note-text').fill('Original note saved with the loopback origin stopped.');await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});await page.reload();await page.locator(`[data-action="edit-note"][data-note="${result.notes[0].id}"]`).waitFor();const offlineNote=(await state(page)).notes[0];assert.equal(offlineNote.note,'Original note saved with the loopback origin stopped.');assert.equal(offlineNote.quote,result.notes[0].quote);assert.deepEqual(offlineNote.segments,result.notes[0].segments);const offlineExport=await downloadBundle(page);assert.deepEqual(offlineExport.value.books,[book]);assert.equal(offlineExport.value.state.notes[0].note,offlineNote.note);result.stoppedOrigin={licensedBundleExport:true,reload:true,chapterNavigation:true,contextImageDecoded:true,transcription:true,noteSavedAndReloaded:true};
  });
  assert.deepEqual(errors,[],'No uncaught browser runtime errors');result.savedNoteCount=result.notes.length;delete result.notes;await context.close();context=null;await browser.close();browser=null;await server?.stop();server=null;await save();
 }
 receipt.passed=true;delete receipt.current;await save();console.log(`Awakening mounted journey passed: ${receipt.cases.length} engine cases.`);
}catch(error){await save();throw error;}finally{await context?.close();await browser?.close();await server?.stop();}
