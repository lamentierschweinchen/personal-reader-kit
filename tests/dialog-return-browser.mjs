// Source-character return regression using original MIT samples and synthetic writing.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(process.env.READER_TEST_ROOT||fileURLToPath(new URL('../',import.meta.url)));
const output=path.resolve(process.env.REVIEW_OUTPUT||path.join(root,'test-results/dialog-source'));
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {passageAt,validateBook}=await import(path.join(root,'site/core.mjs'));
const samples=JSON.parse(await readFile(path.join(root,'samples/library.json'))),book=structuredClone(samples[0]);
book.id='original-modal-fixture';book.title='Original modal fixture';
book.sections=[{id:'one',title:'One',blocks:[
 {...book.sections[0].blocks[0],id:'intro-1'}, {...book.sections[0].blocks[1],id:'intro-2'},
 {id:'speech',kind:'verse',text:('A door opens.\nSomeone waits.\n').repeat(35)+(book.sections[0].blocks[2].text+'\n').repeat(50),after:'\n\n',marks:[]}
]},{id:'two',title:'Two',blocks:[{...book.sections[1].blocks[0],id:'next'}]}];
book.context=book.context.map(c=>({...c,through:null}));
book.source.sha256=createHash('sha256').update(book.sections.map(s=>s.blocks.map(b=>b.text+b.after).join('')).join('')).digest('hex');
validateBook(book);
const block=book.sections[0].blocks[2];let offset=Math.floor(block.text.length*.65);while(/\s/u.test(block.text[offset]))offset++;
const source={blockId:block.id,offset,character:block.text[offset]};
const note={...passageAt(book,book.sections[0],block,offset-5,offset+5),id:'original-modal-note',note:'Original saved fixture comment.',updated:1};
const assets=['index.html','app.mjs','core.mjs','db.mjs','bundle.mjs','library.mjs','text.mjs','share.mjs','share-card.mjs','style.css','share-card.css','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png'];
const files=new Map(await Promise.all(assets.map(async name=>['/'+name,await readFile(path.join(root,'site',name))])));files.set('/library.json',Buffer.from(JSON.stringify([book])));
const types={'.html':'text/html','.css':'text/css','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),name=url.pathname==='/'?'/index.html':url.pathname,bytes=files.get(name);if(!bytes){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[path.extname(name)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);});
await mkdir(output,{recursive:true});const receipt={passed:false,results:[],fixture:'Original MIT samples plus synthetic original verse; no historical text.'};let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const engines=process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'];assert.ok(engines.every(e=>['chromium','webkit'].includes(e)));
 for(const engine of engines){
  const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const ready=async(section='one')=>{await page.locator(`#reading-text[data-book="${book.id}"][data-section="${section}"][data-position-ready="true"]`).waitFor();await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});};
  const readerURL=base+'/#read/'+book.id+'/one';
  const navigateReady=async navigate=>{
    // Complete the supplied library request before any later document navigation.
    const [response]=await Promise.all([page.waitForResponse(response=>response.url()===base+'/library.json'&&response.request().method()==='GET'),navigate()]);
    assert.equal(response.status(),200,'The fixture library must load successfully');
    assert.equal(await response.finished(),null,'The fixture library response must finish');
    assert.deepEqual(await response.json(),[book],'The complete exact fixture must arrive');
    await ready();
  };
  const load=()=>page.evaluate(async()=>(await import('/db.mjs')).loadState());
  const landmark=()=>page.evaluate(source=>{const el=[...document.querySelectorAll('#reading-text [data-block]')].find(el=>el.dataset.block===source.blockId),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node,left=source.offset;while((node=walker.nextNode())){if(left<node.length)break;left-=node.length;}const range=document.createRange();range.setStart(node,left);range.setEnd(node,left+1);const r=range.getBoundingClientRect(),occupied=[...document.querySelectorAll('.masthead,.reader-tools')].map(n=>n.getBoundingClientRect()).filter(r=>r.width&&r.height&&r.bottom>0&&r.top<innerHeight),top=Math.max(0,...occupied.map(r=>Math.min(innerHeight,r.bottom)));return{character:node.textContent[left],top:r.top,bottom:r.bottom,usableTop:top,height:innerHeight,scroll:scrollY};},source);
  const visible=async label=>{const r=await landmark();assert.equal(r.character,source.character);assert.ok(r.top>=r.usableTop-1&&r.bottom<=r.height,label+': '+JSON.stringify(r));return r;};
  const close=async()=>{await page.locator('#dialog [data-action="close"]').click();await page.locator('#dialog').waitFor({state:'hidden'});};
  const open=async action=>{await page.locator(`[data-action="${action}"]`).first().evaluate(el=>el.click());await page.locator('#dialog[open]').waitFor();};
  const rotate=()=>page.setViewportSize({width:844,height:390});
  await navigateReady(()=>page.goto(readerURL));
  await page.evaluate(async note=>{await(await import('/db.mjs')).updateState(s=>{s.notes=[note];return s;});},note);
  const prepare=async()=>{await page.setViewportSize({width:390,height:844});await page.evaluate(async()=>{await(await import('/db.mjs')).updateState(s=>{s.prefs={...s.prefs,size:24,leading:1.7,measure:'book',focus:false};return s;});});assert.equal(page.url(),readerURL,'Preparation stays in the source section');await navigateReady(()=>page.reload());for(let i=0;i<2;i++){const p=await landmark();await page.evaluate(delta=>scrollBy(0,delta),p.top-p.usableTop-85);}await page.waitForTimeout(350);await visible('initial exact character');};
  await prepare();const same=await landmark();await open('background');await close();assert.equal((await landmark()).scroll,same.scroll,'same-layout pixels');
  await prepare();await open('background');await rotate();await close();const rotated=await visible('rotated source return');
  await prepare();await open('settings');await rotate();await page.locator('[data-preset="large"]').click();await page.waitForFunction(()=>document.querySelector('#size')?.value==='29'&&document.querySelector('#reading-text')?.dataset.positionReady==='true');await close();const preset=await visible('preset source return');
  await prepare();await open('settings');await rotate();await page.locator('#size').fill('28');await page.locator('#measure').selectOption('wide');await page.locator('#settings-form [type="submit"]').click();await page.locator('#dialog').waitFor({state:'hidden'});const custom=await visible('custom settings source return');
  await page.evaluate(()=>scrollBy(0,1));await page.waitForTimeout(350);const state=await load();assert.equal(state.positions[book.id].blockId,source.blockId);assert.equal(state.positions[book.id].revision,book.source.sha256);assert.deepEqual(state.notes,[note]);
  await prepare();await open('background');await rotate();await page.evaluate(hash=>location.hash=hash,'#read/'+book.id+'/two');await ready('two');assert.equal(await page.locator('#dialog').evaluate(el=>el.open),false);assert.ok(await page.locator('.reader-heading h1').evaluate(el=>el.getBoundingClientRect().top>=0));assert.deepEqual((await load()).notes,[note]);assert.deepEqual(errors,[]);
  receipt.results.push({engine,rotated,preset,custom,sameLayoutPixels:true,explicitDestination:true,savedNoteUnchanged:true,existingProgressSchema:true});await context.close();await browser.close();browser=null;
 }
 receipt.passed=true;
}catch(error){receipt.failure=error.message;throw error;}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
console.log('Original-source modal regression passed: '+receipt.results.length+' engines.');
