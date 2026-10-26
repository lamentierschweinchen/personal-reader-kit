// Actual admitted editions at their catalogue paths. Literary text is read from the build, never copied into fixtures.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {buildShowcase} from './build.mjs';
import {CONTINUATION_KEY} from './continuation.mjs';
import {settledRender,settledCapture} from '../tests/experience-browser.mjs';

const input=path.resolve(process.env.SHOWCASE_INPUT||fileURLToPath(new URL('./dist/',import.meta.url)));
const output=path.resolve(process.env.REVIEW_OUTPUT||fileURLToPath(new URL('../test-results/oct26-readers/',import.meta.url)));
const hosted=process.env.SHOWCASE_BASE_URL?.replace(/\/$/,'');
assert.notEqual(input,output,'Evidence must not replace the mounted build');
if(!hosted&&!process.argv.includes('--skip-build'))await buildShowcase({output:input});
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const engines=process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'];
const allEntries=[
 {slug:'antigone',book:'antigone-jebb-1917',section:'play',next:'cast',entrance:'.antigone-entrance'},
 {slug:'a-dolls-house',book:'dolls-house-archer-1909',section:'act-1',next:'act-2',entrance:'.play-entrance'},
 {slug:'book-of-tea',book:'book-of-tea',section:'chapter-1',next:'chapter-2',entrance:'.tea-entry'},
];
const requested=process.env.OCT26_READER_IDS?.split(','),entries=requested?allEntries.filter(e=>requested.includes(e.slug)):allEntries;
assert.ok(entries.length&&(!requested||requested.every(id=>allEntries.some(e=>e.slug===id))),'Unknown October 26 reader');
assert.ok(engines.every(e=>['chromium','webkit'].includes(e)),'Unknown browser engine');
await mkdir(output,{recursive:true});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const receipt={checkedAt:new Date().toISOString(),passed:false,mode:hosted?'existing hosted origin':'own stoppable loopback origin',cases:[],limits:'Actual admitted source and real pointer/touch clicks in cached Chromium/WebKit emulation. DOM range selection is deterministic, not native touch selection. No physical-device, audible-chime, installation or human reader acceptance is claimed. Hosted mode does not claim stopped-origin operation.'};
const save=()=>writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
let activePage;
async function stage(engine,slug,label,run){
 receipt.current={engine,slug,label};await save();console.log(`[${engine}/${slug}] ${label}`);
 try{return await run();}catch(error){receipt.failure={...receipt.current,message:error.stack};await activePage?.screenshot({path:path.join(output,`${engine}-${slug}-failure.png`),timeout:5000}).catch(()=>{});await save();throw error;}
}
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.txt':'text/plain'};
async function serve(){
 const security=JSON.parse(await readFile(new URL('./vercel.json',import.meta.url))).routes.find(r=>r.headers?.['Content-Security-Policy']).headers;
 const server=createServer(async(req,res)=>{try{let file=path.resolve(input,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));assert.ok(file===input||file.startsWith(input+path.sep));if((await stat(file)).isDirectory())file=path.join(file,'index.html');const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store',...security});res.end(bytes);}catch{res.writeHead(404);res.end('Not found');}});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return{base:'http://127.0.0.1:'+server.address().port,async stop(){if(server.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}};
}
const state=(page,e)=>page.evaluate(async mount=>(await import(mount+'db.mjs')).loadState(),'/'+e.slug+'/');
const ready=(page,e,section=e.section)=>page.locator(`#reading-text[data-book="${e.book}"][data-section="${section}"][data-position-ready="true"]`).waitFor();
async function notices(page){if(await page.locator('#dialog[open]').count()){const notice=page.locator('#dialog [data-action="notice-read"],#dialog [data-action="notice-continue"]');await (await notice.count()?notice.first():page.locator('#dialog [data-action="close"]').first()).click();await page.locator('#dialog').waitFor({state:'hidden'});}await settledRender(page);}
async function close(page){await page.keyboard.press('Escape');await page.locator('#dialog').waitFor({state:'hidden'});await settledRender(page);}
async function tapVisible(page,selector){
 const nodes=page.locator(selector);for(let i=0;i<await nodes.count();i++){const r=await nodes.nth(i).boundingBox();if(r&&r.x>=0&&r.y>=0&&r.x+r.width<=page.viewportSize().width&&r.y+r.height<=page.viewportSize().height){await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);return;}}
 throw Error('No fully visible pointer target: '+selector);
}
async function backdrop(page){
 const point=await page.locator('#dialog').evaluate(el=>{const r=el.getBoundingClientRect();if(r.left>2)return{x:r.left/2,y:Math.min(innerHeight-2,Math.max(2,r.top+r.height/2))};if(r.top>2)return{x:innerWidth/2,y:r.top/2};return null;});
 assert.ok(point,'The current dialog has an outside area');await page.touchscreen.tap(point.x,point.y);
}
async function layout(page,label){
 await settledRender(page);const geometry=await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth}));
 assert.ok(geometry.documentWidth<=geometry.width,label+': '+JSON.stringify(geometry));
}
async function capture(page,name){await layout(page,name);await settledCapture(page,{path:path.join(output,name+'.png')});}
async function exactSurface(page,selector,sourceBlocks){
 const mismatches=await page.locator(selector).evaluate((root,blocks)=>{const source=new Map(blocks.map(b=>[b.id,b])),nodes=[...root.querySelectorAll('[data-block]')],failures=nodes.length?nodes.filter(n=>n.textContent!==source.get(n.dataset.block)?.text).map(n=>n.dataset.block):['missing source blocks'];if(['reading-text','source-note-text'].includes(root.id)&&nodes.length!==blocks.length)failures.push('source block count');return failures;},sourceBlocks);
 assert.deepEqual(mismatches,[],selector+' retains exact source characters');
}
async function position(page,book,section){
 return page.evaluate(section=>{
  const source=new Map(section.blocks.map(b=>[b.id,b])),el=[...document.querySelectorAll('#reading-text [data-block]')].find(n=>n.textContent.length>180&&n.textContent===source.get(n.dataset.block)?.text&&!n.querySelector('button,a'));
  if(!el)throw Error('No substantial exact source block');let offset=Math.floor(el.textContent.length*.6);while(/\s/u.test(el.textContent[offset]))offset++;
  const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n,remaining=offset;while(n=walker.nextNode()){if(remaining<n.length)break;remaining-=n.length;}
  const range=document.createRange();range.setStart(n,remaining);range.setEnd(n,remaining+1);for(let i=0;i<2;i++){const occupied=[...document.querySelectorAll('.masthead,.reader-tools')].map(n=>n.getBoundingClientRect()).filter(r=>r.height>0&&r.top<innerHeight&&r.bottom>0),edge=Math.max(0,...occupied.map(r=>Math.min(innerHeight,r.bottom)))+60;scrollBy(0,range.getBoundingClientRect().top-edge);}
  return{blockId:el.dataset.block,offset,character:n.textContent[remaining]};
 },section);
}
async function visibleCharacter(page,marker,label){
 const actual=await page.evaluate(marker=>{const el=[...document.querySelectorAll('#reading-text [data-block]')].find(n=>n.dataset.block===marker.blockId),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n,offset=marker.offset;while(n=walker.nextNode()){if(offset<n.length)break;offset-=n.length;}const range=document.createRange();range.setStart(n,offset);range.setEnd(n,offset+1);const r=range.getBoundingClientRect(),chrome=[...document.querySelectorAll('.masthead,.reader-tools')].map(n=>n.getBoundingClientRect()).filter(q=>q.height>0&&q.top<innerHeight&&q.bottom>0&&q.left<r.right&&q.right>r.left);return{character:n.textContent[offset],top:r.top,bottom:r.bottom,usableTop:Math.max(0,...chrome.map(r=>r.bottom)),height:innerHeight};},marker);
 assert.equal(actual.character,marker.character,label+' exact source character');assert.ok(actual.top>=actual.usableTop-1&&actual.bottom<=actual.height,label+': '+JSON.stringify(actual));return actual;
}
async function settingsZoom(page,e,engine){
 await page.setViewportSize({width:320,height:568});await page.evaluate(()=>{document.documentElement.style.fontSize='32px';scrollTo(0,0);});await page.locator('[data-action="settings"]').first().click();await page.locator('#settings-form').waitFor();await settledRender(page);
 const inspect=()=>page.locator('#dialog-title').evaluate(title=>{const box=el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};},rect=box(title),text=title.firstChild,ranges=[...text.textContent].map((character,i)=>{const range=document.createRange();range.setStart(text,i);range.setEnd(text,i+1);const r=range.getBoundingClientRect();return{character,top:r.top,left:r.left,right:r.right};});return{title:rect,dialog:box(document.querySelector('#dialog')),close:box(document.querySelector('.close-dialog')),hidden:ranges.filter(r=>r.top>=rect.bottom||r.left<rect.left-1||r.right>rect.right+1).map(r=>r.character).join(''),height:innerHeight};});
 const complete=(r,label)=>{const detail=label+': '+JSON.stringify(r);assert.equal(r.hidden,'',detail);assert.ok(r.title.left>=r.dialog.left&&r.title.right<=r.dialog.right,detail);assert.ok(r.close.left>=r.dialog.left&&r.close.right<=r.dialog.right&&r.close.top>=Math.max(0,r.dialog.top)&&r.close.bottom<=Math.min(r.height,r.dialog.bottom),detail);assert.ok(r.close.width>=44&&r.close.height>=44,detail);assert.ok(r.title.right<=r.close.left||r.title.bottom<=r.close.top||r.close.bottom<=r.title.top,detail);};
 const actual=await inspect();complete(actual,e.slug+' actual enlarged Settings');await capture(page,`${engine}-${e.slug}-settings-200`);
 await page.locator('#dialog-title').evaluate(el=>{el.textContent='Reading settings and type preferences';el.style.fontFamily='monospace';});await settledRender(page);const wide=await inspect();complete(wide,e.slug+' wide original heading');
 await close(page);await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));await page.setViewportSize({width:390,height:844});await settledRender(page);return{actual,wide};
}
async function noteJourney(page,e,book,section){
 const selected=await page.evaluate(section=>{const source=new Map(section.blocks.map(b=>[b.id,b])),el=[...document.querySelectorAll('#reading-text [data-block]')].find(n=>n.textContent.length>180&&n.textContent===source.get(n.dataset.block)?.text&&!n.querySelector('button,a'));if(!el)throw Error('No exact note range');el.scrollIntoView({block:'center'});const point=offset=>{const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){if(offset<=n.length)return[n,offset];offset-=n.length;}throw Error('Missing note offset');},r=document.createRange();r.setStart(...point(10));r.setEnd(...point(110));getSelection().removeAllRanges();getSelection().addRange(r);return{blockId:el.dataset.block,text:r.toString()};},section);
 await page.locator('#selection-save').click();await page.locator('#note-text').fill('Original catalogue admission note.');await page.getByRole('button',{name:'Save on this device',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});
 const saved=(await state(page,e)).notes;assert.equal(saved.length,1);assert.equal(saved[0].quote,selected.text);assert.equal(saved[0].revision,book.source.sha256);
 await page.locator(`mark[data-note="${saved[0].id}"]`).first().click();await page.locator('#note-text').fill('Original unfinished admission draft.');let prompt;
 page.once('dialog',async d=>{prompt=d.message();await d.dismiss();});await backdrop(page);assert.match(prompt,/unsaved|discard/i);assert.equal(await page.locator('#dialog').evaluate(el=>el.open),true);assert.equal(await page.locator('#note-text').inputValue(),'Original unfinished admission draft.');assert.deepEqual((await state(page,e)).notes,saved);
 page.once('dialog',d=>d.accept());await backdrop(page);await page.locator('#dialog').waitFor({state:'hidden'});await settledRender(page);assert.deepEqual((await state(page,e)).notes,saved);return saved;
}
async function sourceCopyProof(browser,page,e,book,base){
 const index=e.slug==='antigone'?2:e.slug==='book-of-tea'?7:book.context.findIndex(c=>c.label==='Reading and reuse'),original=book.context[index];assert.ok(original,'Reviewed publication-status context');
 const openSource=async target=>{await target.locator(`[data-action="${e.slug==='antigone'?'sources':'background'}"]`).first().evaluate(el=>el.click());await target.locator('#dialog[open]').waitFor();};
 const shown=target=>target.locator('#dialog .context-item').evaluateAll((nodes,label)=>nodes.find(n=>n.querySelector('h3')?.textContent===label)?.querySelector('.source-record,.companion-reading')?.textContent,original.label);
 const localBooks=()=>page.evaluate(async slug=>{const mount='/'+slug+'/',db=await import(mount+'db.mjs'),{canonical}=await import(mount+'bundle.mjs'),{sha256}=await import(mount+'core.mjs');return sha256(new TextEncoder().encode(canonical(await db.loadBooks())));},e.slug),before=await localBooks();
 await openSource(page);const published=await shown(page);assert.ok(typeof published==='string'&&published!==original.text,'Reviewed snapshot receives its public presentation copy');await close(page);
 assert.equal(await localBooks(),before,'Source presentation leaves the existing browser-local books unchanged');
 const changed=structuredClone(book);changed.context[index].text+='\n\nOriginal custom source notice addition.';
 // Keep ID, source hash and matching old wording: an ID-only, text-only or source-hash-only override would fail this control.
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'}),custom=await context.newPage();custom.setDefaultTimeout(20000);
 try{await custom.route(`${base}/${e.slug}/library.json`,route=>route.fulfill({contentType:'application/json',body:JSON.stringify([changed])}));await custom.goto(`${base}/${e.slug}/#read/${e.book}/${e.section}`);await ready(custom,e);await notices(custom);await openSource(custom);assert.equal(await shown(custom),changed.context[index].text,'A changed same-ID edition keeps its entire custom source notice');}
 finally{await context.close();}
 return{reviewedSnapshotOnly:true,changedSameIdAndSourceHashPreserved:true,browserLocalBooksUnchanged:true};
}
async function antigoneJourney(page,e,book,engine){
 const section=book.sections.find(s=>s.id===e.section),marker=await position(page,book,section);await page.waitForTimeout(350);await visibleCharacter(page,marker,'Antigone before invitation');
 await tapVisible(page,'#study-nav');await page.locator('.study-disclosure').waitFor();assert.match(await page.locator('.study-disclosure').innerText(),/ending/);await backdrop(page);await page.locator('#dialog').waitFor({state:'hidden'});await visibleCharacter(page,marker,'Antigone invitation return');
 await tapVisible(page,'#study-nav');await page.locator('#dialog [data-action="study"]').click();await page.locator('#held-source [data-block]').waitFor();await settledRender(page);const positions=(await state(page,e)).positions;
 await exactSurface(page,'#held-source',section.blocks);await exactSurface(page,'#later-source',section.blocks);await capture(page,`${engine}-antigone-study`);
 await page.locator('[data-action="study-hold"][data-held="hands"]').click();assert.equal(await page.locator('[data-held="hands"]').getAttribute('aria-pressed'),'true');await exactSurface(page,'#held-source',section.blocks);
 await page.locator('[data-action="study-held-context"]').click();await page.locator('#study-context[data-location-ready="true"]').waitFor();await exactSurface(page,'#study-context',section.blocks);await backdrop(page);await page.locator('#dialog').waitFor({state:'hidden'});assert.deepEqual((await state(page,e)).positions,positions);
 await page.locator('[data-action="study-return"]').click();await ready(page,e);await settledRender(page);await visibleCharacter(page,marker,'Antigone study returns to source');return{invitation:true,actualComparison:true,referenceReturn:true,sourceCharacterReturn:true};
}
async function ibsenJourney(page,e,book,base,engine){
 assert.equal(await page.locator('#reading-text').evaluate(el=>el.classList.contains('script-text')),true);assert.ok(await page.locator('#reading-text [data-role="speaker"]').count());
 const showDialogue=()=>page.evaluate(()=>{const cue=[...document.querySelectorAll('#reading-text [data-role="speaker"]')].find(n=>n.textContent.length<40&&n.nextElementSibling?.dataset.role!=='speaker');if(!cue)throw Error('No source dialogue cue');cue.scrollIntoView({block:'center'});});
 await page.setViewportSize({width:768,height:1024});await settledRender(page);assert.equal(await page.locator('#reading-text').evaluate(el=>getComputedStyle(el).display),'grid');await showDialogue();await capture(page,`${engine}-a-dolls-house-script-tablet`);
 await page.setViewportSize({width:390,height:844});await settledRender(page);assert.equal(await page.locator('#reading-text').evaluate(el=>getComputedStyle(el).display),'block');await showDialogue();await capture(page,`${engine}-a-dolls-house-script-phone`);
 const call=page.locator('#reading-text [data-action="source-note"]').first();assert.ok(await call.count());const id=await call.getAttribute('data-source-note');await call.click();await page.locator('#source-note-text').waitFor();await exactSurface(page,'#source-note-text',book.sourceNotes.find(n=>n.id===id).blocks);await backdrop(page);await page.locator('#dialog').waitFor({state:'hidden'});
 await page.evaluate(()=>scrollTo(0,0));await tapVisible(page,'[data-action="contents"]');await page.locator(`#dialog a[href="#read/${e.book}/${e.next}"]`).click();await ready(page,e,e.next);await exactSurface(page,'#reading-text',book.sections.find(s=>s.id===e.next).blocks);
 await page.goto(`${base}/${e.slug}/#read/${e.book}/${e.section}`);await ready(page,e);await notices(page);await page.evaluate(()=>scrollTo(0,0));await tapVisible(page,'[data-action="focus"]');await page.waitForFunction(()=>document.body.classList.contains('focus'));await page.keyboard.press('c');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('focus'));return{scriptPhoneAndTablet:true,sourceNote:true,actNavigation:true,focusExit:true,companion:'No added companion; the chosen experience is the script.'};
}
async function teaJourney(page,e,book,engine){
 const brewState=()=>page.evaluate(async mount=>{const {BREW_KEY}=await import(mount+'tea-brew-state.mjs');return JSON.parse(localStorage.getItem(BREW_KEY));},'/'+e.slug+'/');
 const marker=await position(page,book,book.sections.find(s=>s.id===e.section));await page.waitForTimeout(350);await tapVisible(page,'[data-tea-brew-entry]');await page.locator('#tea-brew-panel').waitFor();
 assert.equal(await page.locator('[data-brew-action="sound"]').getAttribute('aria-pressed'),'false');await capture(page,`${engine}-book-of-tea-brewing`);
 await page.locator('[data-brew-action="start"]').click();await page.locator('[data-brew-phase="running"]').waitFor();const running=await brewState();assert.equal(running.timer.status,'running');assert.ok(running.timer.deadline>Date.now());
 await page.locator('[data-brew-action="pause"]').click();await page.locator('[data-brew-phase="paused"]').waitFor();const paused=await brewState();assert.equal(paused.timer.deadline,null);assert.ok(paused.timer.remainingMs>0&&paused.timer.remainingMs<=paused.timer.durationMs);
 await backdrop(page);await page.locator('#dialog').waitFor({state:'hidden'});await visibleCharacter(page,marker,'Tea paused timer returns to source');await page.reload();await ready(page,e);await settledRender(page);assert.deepEqual(await brewState(),paused);
 await tapVisible(page,'[data-tea-brew-entry]');await page.locator('[data-brew-phase="paused"]').waitFor();await page.locator('.brew-sources summary').click();await page.locator('[data-action="tea-brew-source"]').click();await page.locator('#context-text[data-location-ready="true"]').waitFor();await exactSurface(page,'#context-text',book.sections.find(s=>s.id==='chapter-2').blocks);
 const back=page.locator('#dialog [data-action="tea-brew"]');assert.equal(await back.count(),1);await back.click();await page.locator('[data-brew-phase="paused"]').waitFor();assert.deepEqual(await brewState(),paused);
 await page.locator('[data-brew-action="resume"]').click();await page.locator('[data-brew-phase="running"]').waitFor();assert.equal((await brewState()).timer.id,running.timer.id);await page.locator('[data-brew-action="pause"]').click();await page.locator('[data-brew-phase="paused"]').waitFor();await page.locator('[data-brew-action="reset"]').click();await page.locator('[data-brew-action="select"][data-recipe="matcha"]').click();await page.locator('.brew-workbench[data-recipe="matcha"]').waitFor();assert.equal(await page.locator('[data-brew-clock]').count(),0);await page.locator('#tea-brew-panel [data-action="close"]').click();await page.locator('#dialog').waitFor({state:'hidden'});
 return{actualBrewing:true,quietByDefault:true,startPauseReloadResume:true,sourceContext:true,sourceCharacterReturn:true,matchaWithoutTimer:true};
}
let browser,server,context;
try{
 for(const engine of engines){
  const executablePath=process.env[engine==='chromium'?'CHROME_PATH':'WEBKIT_PATH'];browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});server=hosted?null:await serve();const base=hosted||server.base;
  context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,reducedMotion:'reduce'});context.setDefaultTimeout(20000);context.setDefaultNavigationTimeout(45000);const sessions=[];
  for(const e of entries){
   const page=await context.newPage();activePage=page;const errors=[],providerRequests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/(?:va\.vercel-scripts\.com|\/_vercel\/insights\/)/.test(request.url()))providerRequests.push(request.url());});
   const bytes=await readFile(path.join(input,e.slug,'library.json')),books=JSON.parse(bytes),book=books.find(b=>b.id===e.book),section=book?.sections.find(s=>s.id===e.section);assert.ok(section,e.slug+' actual admitted source');
   const result={slug:e.slug,engine,engineVersion:browser.version(),sourceSha256:book.source.sha256,librarySha256:hash(bytes),appSha256:hash(await readFile(path.join(input,e.slug,'app.mjs'))),workerSha256:hash(await readFile(path.join(input,e.slug,'sw.js')))};
   await stage(engine,e.slug,'entry and mounted offline cache',async()=>{await page.goto(`${base}/${e.slug}/`);await page.locator(e.entrance).waitFor();await page.locator('#offline-status').filter({hasText:'Available offline'}).waitFor({timeout:90000});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);assert.equal(await page.evaluate(()=>new URL(navigator.serviceWorker.controller.scriptURL).pathname),'/'+e.slug+'/sw.js');assert.equal(hash(await (await page.request.get(`${base}/${e.slug}/library.json`)).body()),hash(bytes),'Served source bytes match the admitted mount');await capture(page,`${engine}-${e.slug}-entry-phone`);await page.setViewportSize({width:768,height:1024});await capture(page,`${engine}-${e.slug}-entry-tablet`);await page.setViewportSize({width:390,height:844});});
   await stage(engine,e.slug,'actual edition and selected experience',async()=>{const start=page.locator(`${e.entrance} .opening-read,${e.entrance} [data-action="resume"]`).first();await start.click();if(e.slug==='a-dolls-house'){await ready(page,e,'cast');await notices(page);await exactSurface(page,'#reading-text',book.sections.find(s=>s.id==='cast').blocks);await tapVisible(page,'[data-action="contents"]');await page.locator(`#dialog a[href="#read/${e.book}/${e.section}"]`).click();}await ready(page,e);await notices(page);await exactSurface(page,'#reading-text',section.blocks);result.experience=e.slug==='antigone'?await antigoneJourney(page,e,book,engine):e.slug==='a-dolls-house'?await ibsenJourney(page,e,book,base,engine):await teaJourney(page,e,book,engine);});
   await stage(engine,e.slug,'notes and guarded backdrop',async()=>{await page.goto(`${base}/${e.slug}/#read/${e.book}/${e.section}`);await ready(page,e);await notices(page);result.notes=await noteJourney(page,e,book,section);result.guardedNoteCancel=true;});
   await stage(engine,e.slug,'actual and wide Settings at enlarged UI text',async()=>{result.settings=await settingsZoom(page,e,engine);assert.deepEqual((await state(page,e)).notes,result.notes);assert.deepEqual(errors,[]);});
   await stage(engine,e.slug,'publication wording is exact-snapshot presentation only',async()=>{result.publicStatusScope=await sourceCopyProof(browser,page,e,book,base);});
   await stage(engine,e.slug,'catalogue continuation and bounded analytics registration',async()=>{
    const marker=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),CONTINUATION_KEY);assert.equal(marker.edition,e.slug);assert.equal(marker.work,e.book);assert.deepEqual(Object.keys(marker).sort(),['at','edition','v','work']);
    assert.equal(await page.locator('meta[data-newreading-analytics]').getAttribute('data-public-books'),e.book);
    const analytics=await page.evaluate(async slug=>{const m=await import('/analytics.mjs'),url='https://newreading.app/'+slug+'/?original=private#read/original',current=m.publicPage(url);return{page:m.beforeSend({type:'pageview',url},url),event:m.fixedEvent('reading_visible_30s',{page:'reader',edition:slug},current),extraRejected:m.fixedEvent('reading_visible_30s',{page:'reader',edition:slug,quote:'Original private fixture'},current)===null,providerAbsent:!window.va&&!window.vai};},e.slug);
    assert.deepEqual(analytics.page,{type:'pageview',url:'https://newreading.app/'+e.slug+'/'});assert.deepEqual(analytics.event,{name:'reading_visible_30s',data:{page:'reader',edition:e.slug}});assert.equal(analytics.extraRejected,true);assert.equal(analytics.providerAbsent,true);assert.deepEqual(providerRequests,[]);result.analytics={fixedPublicRoute:true,extraFieldsRejected:true,automatedBrowserOptOut:true};
    const before=(await state(page,e)).positions[e.book];await page.goto(base+'/library/');const link=page.locator('[data-continuation-link]');await link.waitFor({state:'visible'});assert.equal(await link.getAttribute('href'),'/'+e.slug+'/#continue/'+e.book);await link.click();await ready(page,e,before.sectionId);await settledRender(page);assert.equal((await state(page,e)).positions[e.book].blockId,before.blockId);assert.deepEqual((await state(page,e)).notes,result.notes);result.catalogueContinuation=true;
   });
   sessions.push({e,page,book,result,errors});receipt.cases.push(result);await save();
  }
  if(server){await server.stop();for(const {e,page,book,result,errors} of sessions){activePage=page;await stage(engine,e.slug,'reload with origin stopped',async()=>{await page.goto(`${base}/${e.slug}/#read/${e.book}/${e.next}`);await page.reload();await ready(page,e,e.next);await notices(page);await exactSurface(page,'#reading-text',book.sections.find(s=>s.id===e.next).blocks);assert.deepEqual((await state(page,e)).notes,result.notes);if(e.slug==='book-of-tea'){await tapVisible(page,'[data-tea-brew-entry]');await page.locator('[data-brew-action="select"][data-recipe="sencha"]').click();await page.locator('[data-brew-action="start"]').click();await page.locator('[data-brew-phase="running"]').waitFor();await page.locator('[data-brew-action="pause"]').click();await page.locator('[data-brew-phase="paused"]').waitFor();await backdrop(page);await page.locator('#dialog').waitFor({state:'hidden'});}await capture(page,`${engine}-${e.slug}-offline`);assert.deepEqual(errors,[]);result.stoppedOriginReload=true;});}}
  for(const {result} of sessions){result.savedNoteCount=result.notes.length;delete result.notes;}
  await context.close();context=null;await browser.close();browser=null;await server?.stop();server=null;await save();
 }
 receipt.passed=true;delete receipt.current;await save();console.log(`October 26 reader journeys passed: ${receipt.cases.length} edition/engine cases.`);
}catch(error){await save();throw error;}finally{await context?.close();await browser?.close();await server?.stop();}
