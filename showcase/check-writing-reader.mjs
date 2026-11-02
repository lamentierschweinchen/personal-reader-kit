// Actual mounted writing edition, isolated records and injected storage failures.
// No owner browser, private notebook, offline or physical-device claim.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildShowcase} from './build.mjs';
import {serve} from './serve.mjs';
import {readerRuntime} from './readers.mjs';
import {startAnalytics,beforeSend} from './analytics.mjs';
import {blankState,STORE,validateEdition,validateState} from '../examples/writers-at-work/site/core.mjs';

if(!process.argv.includes('--skip-build'))await buildShowcase();
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const catalog=JSON.parse(await readFile(new URL('../examples/catalog.json',import.meta.url)));
const entry=catalog.examples.find(example=>example.id==='writers-at-work');
assert.equal(readerRuntime(entry),'writing-workroom-v1');
const bytes=await readFile(new URL('./dist/writers/edition.json',import.meta.url));
assert.equal(sha(bytes),entry.reviewedBuild.find(asset=>asset.path==='edition.json').sha256);
const edition=validateEdition(JSON.parse(bytes));
const files=(await readdir(new URL('./dist/writers/',import.meta.url))).sort();
assert.deepEqual(files,entry.reviewedBuild.map(asset=>asset.path).sort());
assert.ok(!files.includes('sw.js'));
const html=await readFile(new URL('./dist/writers/index.html',import.meta.url),'utf8');
assert.ok(!html.includes('data-newreading-continuation'));
assert.ok(html.includes('data-public-books=""'),'Writing runtime has no standard reading-event inventory');
const app=await readFile(new URL('./dist/writers/app.mjs',import.meta.url),'utf8');
assert.ok(!app.includes('__nrContinuationProof'));
// Exercise the real optional integration with the mounted empty public-ID
// configuration. The separate analytics suite checks the pinned real provider.
const analyticsCases=[];
for(const route of ['#writer/morrison','#argument/keep-going','#desk/sentence','#notebook']){
 const sentinel='ORIGINAL_PRIVATE_NOTEBOOK_SENTINEL',win=new EventTarget(),doc=new EventTarget(),timers=new Map(),bodies=[];let timer=0;
 const href='https://newreading.app/writers/?private='+sentinel+route;
 Object.assign(doc,{referrer:'',createElement:()=>({dataset:{}}),head:{appendChild(script){doc.provider=script;}},querySelector(selector){return selector==='meta[data-newreading-analytics]'?{getAttribute:()=>''}:null;}});
 Object.assign(win,{navigator:{onLine:true},location:{href,hash:route},localStorage:{getItem(key){assert.equal(key,'__va_attribution','Analytics may not read the writing notebook');return null;}},setTimeout(callback,delay){const id=++timer;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id),MutationObserver:class{constructor(){throw Error('An online workroom must not start a standard reading observer');}}});
 const controller=startAnalytics(win,doc);assert.ok(controller);
 win.vai=true;win.va=(name,payload)=>{if(name==='pageview')bodies.push(beforeSend({type:'pageview',url:href},href));else if(name==='event')bodies.push(beforeSend({type:'event',url:href,payload},href));};doc.provider.onload();
 for(const {callback}of timers.values())callback();
 assert.deepEqual(bodies,[{type:'pageview',url:'https://newreading.app/writers/'}]);assert.ok(!JSON.stringify(bodies).includes(sentinel));
 analyticsCases.push({route,canonicalPageview:true,noDwellTimer:timers.size===0,notebookReads:0});assert.equal(timers.size,0);controller.stop();
}
const out=new URL('../test-results/showcase/writers/',import.meta.url);await mkdir(out,{recursive:true});
const receipt={checkedAt:new Date().toISOString(),passed:false,editionSha256:sha(bytes),analyticsContract:analyticsCases,cases:[],limits:'Chromium/WebKit with isolated synthetic notebooks and injected quota/Web Locks failures. Analytics integration uses a simulated provider; the separate bounded-analytics suite checks the pinned provider. Phone/tablet emulation and local mounted bytes; no physical-device, offline, live HTTPS or human-acceptance claim.'};
const save=()=>writeFile(new URL('receipt.json',out),JSON.stringify(receipt,null,2)+'\n');await save();
const server=await serve(),base='http://127.0.0.1:'+server.address().port+'/writers/';
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const engines=process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'];
assert.ok(engines.every(engine=>['chromium','webkit'].includes(engine)));
async function close(page){await page.keyboard.press('Escape');await page.locator('#reference').waitFor({state:'hidden'});}
async function open(context,route='#home'){const page=await context.newPage();await page.goto(base+route);await page.locator('#main h1').waitFor();return page;}
async function download(page){
 const surface=await page.locator('#reference[open]').count()?page.locator('#reference'):page.locator('#main');
 const [file]=await Promise.all([page.waitForEvent('download'),surface.getByRole('button',{name:'Download notebook',exact:true}).click()]);
 const stream=await file.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
 const data=JSON.parse(Buffer.concat(chunks));assert.equal(data.format,'how-writers-work-notebook');validateState(data.state);return data;
}
async function scenario(browser,engine,name,fn,viewport={width:390,height:844}){
 const context=await browser.newContext({viewport,hasTouch:viewport.width<600,reducedMotion:'reduce'}),errors=[],outside=[];
 context.setDefaultTimeout(20000);
 context.on('page',page=>{page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!request.url().startsWith(new URL(base).origin+'/')&&!request.url().startsWith('data:'))outside.push(request.url());});});
 try{await fn(context);assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);receipt.cases.push({engine,name,passed:true});await save();}
 catch(error){receipt.cases.push({engine,name,passed:false,error:error.message});await save();throw error;}
 finally{await context.close();}
}
try{
 for(const engine of engines){
  const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
  const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  try{
   await scenario(browser,engine,'exact edition, all writer/comparison/desk routes and install scope',async context=>{
    const page=await open(context);assert.equal(sha(await(await page.request.get(base+'edition.json')).body()),sha(bytes));
    assert.equal((await page.request.get(base+'sw.js')).status(),404);
    const manifest=await(await page.request.get(base+'manifest.webmanifest')).json();
    for(const key of ['id','scope','start_url'])assert.equal(manifest[key],'/writers/');
    for(const icon of manifest.icons){assert.ok(icon.src.startsWith('/writers/'));assert.equal((await page.request.get(new URL(icon.src,base).href)).status(),200);}
    for(const author of edition.authors){
     await page.goto(base+'#writer/'+author.id);await page.getByRole('heading',{name:author.name,exact:true}).waitFor();
     assert.deepEqual(await page.locator('.advice-list>li').evaluateAll(items=>items.map(item=>item.id)),author.items.map(item=>item.id));
    }
    for(const argument of edition.arguments){await page.goto(base+'#argument/'+argument.id);await page.getByRole('heading',{name:argument.title,exact:true}).waitFor();}
    for(const moment of edition.moments){await page.goto(base+'#desk/'+moment.id);await page.waitForFunction(id=>document.querySelector('[data-choice]')?.dataset.moment===id,moment.id);assert.equal(await page.locator('[data-choice]').count(),2);await page.locator('[data-choice]').first().click();await page.locator('#draft').waitFor();}
    const storage=await page.evaluate(async()=>({dbs:(await indexedDB.databases()).map(db=>db.name),workers:(await navigator.serviceWorker.getRegistrations()).map(worker=>worker.scope),pointer:localStorage.getItem('newreading-continuation-v1')}));
    assert.deepEqual(storage,{dbs:[],workers:[],pointer:null});
   });
   for(const viewport of [{width:320,height:780},{width:390,height:844},{width:768,height:1024}]){
    await scenario(browser,engine,`layout and source focus return ${viewport.width}px`,async context=>{
     const page=await open(context);
     for(const route of ['#home','#writers','#writer/morrison','#argument/keep-going','#desk/'+edition.moments[0].id,'#notebook']){
      await page.goto(base+route);await page.locator('#main h1').waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' has no horizontal overflow');
     }
     await page.goto(base+'#writer/morrison');await page.getByRole('heading',{name:'Toni Morrison',exact:true}).waitFor();
     await page.locator('#settings').click();await page.locator('#text-size').fill('32');await close(page);
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Large reading type reflows');
     const trigger=page.locator('.advice-list [data-advice]').first();await trigger.scrollIntoViewIfNeeded();
     const selection=await page.evaluate(()=>{const text=document.querySelector('.advice-list li p').firstChild;const range=new Range();range.setStart(text,0);range.setEnd(text,Math.min(24,text.length));getSelection().removeAllRanges();getSelection().addRange(range);return getSelection().toString();});assert.ok(selection);
     const before=await page.evaluate(()=>({hash:location.hash,y:scrollY}));await trigger.click();await page.locator('#reference[open]').waitFor();
     assert.match(await page.locator('#reference a.external-source, #reference .external-source a').first().getAttribute('href'),/^https:\/\//);
     await close(page);await page.waitForFunction(()=>document.activeElement?.matches('.advice-list [data-advice]'));
     assert.equal(await page.evaluate(()=>location.hash),before.hash);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-before.y)<3,'Source visit returns to reading place');assert.equal(await page.evaluate(()=>getSelection().toString()),selection);
     await trigger.click();await page.locator('#reference[open]').waitFor();await page.mouse.move(2,2);await page.mouse.down();await page.mouse.move(42,2);await page.mouse.up();assert.equal(await page.locator('#reference').evaluate(dialog=>dialog.open),true,'A backdrop drag does not dismiss the source');
     await page.mouse.click(2,2);await page.locator('#reference').waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.matches('.advice-list [data-advice]'));
     await trigger.click();await page.locator('#reference[open]').waitFor();await page.goBack();await page.locator('#reference').waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>location.hash),before.hash);
     await page.getByRole('button',{name:'Quiet reading',exact:true}).click();await page.locator('#exit-quiet').waitFor({state:'visible'});
     await page.evaluate(()=>scrollTo(0,document.body.scrollHeight/2));assert.ok(await page.locator('#exit-quiet').evaluate(element=>{const r=element.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
     await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.body.classList.contains('quiet'));
     await page.goto(base+'#home');await page.locator('.continue-strip a').waitFor();assert.equal(await page.locator('.continue-strip a').getAttribute('href'),'#writer/morrison');
     await page.screenshot({path:fileURLToPath(new URL(`${engine}-${viewport.width}-home.png`,out)),fullPage:true,animations:'disabled'});
    },viewport);
   }
   for(const failure of ['quota','locks'])await scenario(browser,engine,`failed notebook save remains recoverable: ${failure}`,async context=>{
    const page=await open(context,'#notebook'),prior=blankState();prior.notes=[{id:'durable',route:'#notebook',title:'Prior work',quote:'',text:'Original durable notebook fixture'}];
    await page.evaluate(({key,prior})=>localStorage.setItem(key,JSON.stringify(prior)),{key:STORE,prior});await page.reload();await page.getByText(prior.notes[0].text,{exact:true}).waitFor();
    const durable=await page.evaluate(key=>localStorage.getItem(key),STORE);
    await page.evaluate(({key,failure})=>{
     if(failure==='locks')Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});
     else{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(name,value){if(name===key)throw new DOMException('Original quota fixture','QuotaExceededError');return original.call(this,name,value);};}
    },{key:STORE,failure});
    await page.getByRole('button',{name:'Write a note',exact:true}).click();const text='Original unsaved '+failure+' note';await page.locator('#note-text').fill(text);await page.locator('#save-note').click();
    await page.locator('#note-status').filter({hasText:'Not saved.'}).waitFor();assert.equal(await page.locator('#note-text').inputValue(),text);assert.equal(await page.evaluate(key=>localStorage.getItem(key),STORE),durable);
    await close(page);await page.locator('#settings').click();const recovered=await download(page);
    assert.ok([...recovered.state.notes,...Object.values(recovered.state.noteDrafts)].some(note=>note.text===text));assert.ok(recovered.state.notes.some(note=>note.id==='durable'));
   });
   await scenario(browser,engine,'saved notes and experiments survive reload and fresh-context notebook recovery',async context=>{
    const page=await open(context,'#notebook');await page.getByRole('button',{name:'Write a note',exact:true}).click();await page.locator('#note-text').fill('Original portable note');await page.locator('#save-note').click();await page.locator('#reference').waitFor({state:'hidden'});
    const moment=edition.moments[0];await page.goto(base+'#desk/'+moment.id);await page.locator('[data-choice]').first().click();await page.locator('#draft').fill('Original portable experiment');await page.locator('#draft-status').filter({hasText:'Saved in this browser.'}).waitFor();
    await page.reload();assert.equal(await page.locator('#draft').inputValue(),'Original portable experiment');await page.goto(base+'#notebook');await page.getByText('Original portable note',{exact:true}).waitFor();
    const data=await download(page),fresh=await browser.newContext({viewport:{width:390,height:844}});
    try{const other=await open(fresh,'#notebook');await other.getByRole('button',{name:'Recover a notebook',exact:true}).click();await other.locator('#import-file').setInputFiles({name:'notebook.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});await other.locator('#confirm-import').click();await other.locator('#import-status').filter({hasText:'Recovered.'}).waitFor();await close(other);await other.reload();await other.getByText('Original portable note',{exact:true}).waitFor();await other.getByText('Original portable experiment',{exact:true}).waitFor();}finally{await fresh.close();}
   });
   await scenario(browser,engine,'missing edition keeps notebook download available',async context=>{
    const page=await open(context,'#notebook'),prior=blankState();prior.notes=[{id:'missing-content',route:'#notebook',title:'Original note',quote:'',text:'Original note retained without source'}];
    await page.evaluate(({key,prior})=>localStorage.setItem(key,JSON.stringify(prior)),{key:STORE,prior});await page.route('**/writers/edition.json',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));await page.reload();await page.getByRole('heading',{name:'The reader could not load.'}).waitFor();
    await page.locator('#settings').click();const recovered=await download(page);assert.equal(recovered.edition,null);assert.deepEqual(recovered.state.notes,prior.notes);
   });
  }finally{await browser.close();}
 }
 receipt.passed=true;await save();console.log(JSON.stringify(receipt));
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
