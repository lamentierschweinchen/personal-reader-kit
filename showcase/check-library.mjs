import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {buildShowcase} from './build.mjs';
import {serve} from './serve.mjs';
if(!process.argv.includes('--skip-build'))await buildShowcase();
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=new URL('../test-results/library/',import.meta.url);await mkdir(out,{recursive:true});
const server=await serve(),base='http://127.0.0.1:'+server.address().port,receipts=[];
const sizes=[{width:320,height:740},{width:390,height:844},{width:874,height:402},{width:768,height:1024},{width:1024,height:768},{width:1440,height:1000}];
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));});}
async function layout(page,label){
 const result=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,targets:[...document.querySelectorAll('a:not(.skip),button,input,select,summary')].filter(e=>!e.closest('p')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&!e.closest('details:not([open]) :not(summary)')).map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute('aria-label')||e.textContent.trim().slice(0,40),w:r.width,h:r.height};})}));
 assert.ok(result.scroll<=result.width,label+' overflow');assert.ok(result.targets.every(t=>t.w>=44&&t.h>=44),label+' small targets: '+JSON.stringify(result.targets.filter(t=>t.w<44||t.h<44)));
}
try{
 for(const engine of ['chromium','webkit']){
  const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
  const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  try{
   for(const viewport of sizes){
    const context=await browser.newContext({viewport,hasTouch:viewport.width<600,reducedMotion:'reduce'}),page=await context.newPage(),errors=[],unexpected=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base+'/')&&!r.url().startsWith('data:'))unexpected.push(r.url());});
    await page.goto(base+'/library/');await page.waitForFunction(()=>document.body.dataset.libraryReady==='true');await settle(page);await layout(page,'Library');
    assert.equal(await page.locator('.book:not([hidden])').count(),6);
    const cardWidth=await page.locator('.book[data-edition="alice"]').evaluate(e=>e.getBoundingClientRect().width);await page.locator('[data-filter="game"]').click();assert.equal(await page.locator('.book[data-edition="alice"]').evaluate(e=>e.getBoundingClientRect().width),cardWidth);assert.equal(await page.locator('.book:not([hidden])').count(),3);
    await page.locator('[data-filter="all"]').click();await page.locator('#search').fill('Haldane');assert.equal(await page.locator('.book:not([hidden])').getAttribute('data-edition'),'two-halls');
    await page.locator('#search').fill('not on this shelf');assert.equal(await page.locator('.empty').isVisible(),true);await page.locator('#reset').click();assert.equal(await page.locator('#search').evaluate(e=>e===document.activeElement),true);
    await page.locator('#sort').selectOption('title');assert.equal(await page.locator('.book').first().getAttribute('data-edition'),'alice');await page.locator('#sort').selectOption('shelf');
    // Native selection keeps a visible keyboard baseline without a large focus box.
    await page.locator('[data-filter="game"]').focus();await page.keyboard.press('Tab');
    assert.equal(await page.locator('#sort').evaluate(e=>document.activeElement===e),true);
    const focus=await page.locator('#sort').evaluate(e=>({outline:getComputedStyle(e).outlineStyle,line:getComputedStyle(e.parentElement).borderBottomColor,width:getComputedStyle(e.parentElement).borderBottomWidth}));
    assert.equal(focus.outline,'none');assert.equal(focus.line,'rgb(173, 53, 37)');assert.equal(focus.width,'2px');
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.locator('#sort').selectOption('shelf');
    await page.locator('[data-preview="alice"]').click();await page.locator('dialog[open]').waitFor();assert.equal(await page.locator('#edition-title').textContent(),'Alice’s Adventures in Wonderland');
    await page.locator('dialog .source-details summary').click();await layout(page,'Edition source');
    // The exit stays available after scrolling a long phone/landscape preview.
    await page.locator('dialog').evaluate(e=>e.scrollTop=e.scrollHeight);const close=await page.locator('.close-dialog').boundingBox();assert.ok(close&&close.y>=0&&close.y+close.height<=viewport.height);
    await page.keyboard.press('Escape');assert.equal(await page.locator('[data-preview="alice"]').evaluate(e=>e===document.activeElement),true);
    await page.locator('[data-preview="dracula"]').click();assert.equal(await page.locator('dialog').evaluate(e=>e.scrollTop),0,'A different edition starts at the top');await page.locator('.close-dialog').click();await page.locator('#contribute .button-dark').focus();assert.match(await page.locator('#contribute .button-dark').getAttribute('href'),/issues\/new\?template=edition.yml$/);
    // Browser reading storage is unaffected by catalogue actions.
    assert.deepEqual(await page.evaluate(async()=>({dbs:(await indexedDB.databases()).map(d=>d.name),local:localStorage.length,session:sessionStorage.length})),{dbs:[],local:0,session:0});
    await page.locator('h1').click();await page.screenshot({path:fileURLToPath(new URL(`${engine}-${viewport.width}x${viewport.height}.png`,out)),fullPage:true,animations:'disabled'});
    const originalSize=await page.locator('.book-feature').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));await page.evaluate(()=>document.documentElement.style.fontSize='200%');assert.ok(await page.locator('.book-feature').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=originalSize*1.9);await layout(page,'200% text');
    assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);receipts.push({engine,viewport,search:true,filter:true,sort:true,dialogExit:true,focusReturn:true,previewReopen:true,stableFilterWidth:true,noReadingStorage:true});await context.close();
   }
   const plainContext=await browser.newContext({javaScriptEnabled:false,reducedMotion:'reduce',viewport:{width:390,height:844}}),plain=await plainContext.newPage();await plain.goto(base+'/library/');await settle(plain);assert.equal(await plain.locator('.cover-button').count(),6);assert.equal(await plain.locator('.browse-tools').isVisible(),false);await plain.locator('[data-preview="alice"]').click();await plain.locator('#edition-alice>summary').click();assert.equal(await plain.locator('#edition-alice .edition-description').isVisible(),true);await plainContext.close();
   const deepContext=await browser.newContext(),deep=await deepContext.newPage();await deep.goto(base+'/library/#edition-two-halls');await deep.waitForFunction(()=>document.body.dataset.libraryReady==='true');assert.equal(await deep.locator('#edition-two-halls').getAttribute('open'),'');await deepContext.close();
  }finally{await browser.close();}
 }
 await writeFile(new URL('receipt.json',out),JSON.stringify({checkedAt:new Date().toISOString(),passed:true,receipts,limits:'Chromium/WebKit emulation and automated checks; physical devices, screen-reader acceptance and contributor sessions remain unverified.'},null,2)+'\n');console.log(JSON.stringify({passed:true,layouts:receipts.length}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
