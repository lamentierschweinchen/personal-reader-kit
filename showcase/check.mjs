import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {buildShowcase} from './build.mjs';
import {serve} from './serve.mjs';
if(!process.argv.includes('--skip-build'))await buildShowcase();
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=new URL('../test-results/showcase/',import.meta.url);await mkdir(output,{recursive:true});
const server=await serve(),base='http://127.0.0.1:'+server.address().port,receipts=[];
const sizes=[{width:320,height:740},{width:402,height:874},{width:874,height:402},{width:768,height:1024},{width:1024,height:768},{width:1440,height:1000}];
const promptText=(await readFile(new URL('./start.txt',import.meta.url),'utf8')).trim();
const commandText='Use https://newreading.app/start.txt to help me build a personal reader. Follow the linked kit guide, then help me choose a simple reader or a custom experience.';
async function settled(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));});}
async function layout(page,label){
 const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length,targets:[...document.querySelectorAll('a:not(.skip),button,summary')].filter(x=>x.getBoundingClientRect().width>0&&x.getBoundingClientRect().height>0).map(x=>{const r=x.getBoundingClientRect();return{label:x.textContent.trim(),w:r.width,h:r.height}}),arrows:/[\u2190-\u21ff\u2794\u279c\u27a1]/u.test(document.body.textContent)}));
 assert.ok(metrics.scroll<=metrics.width,label+' overflow');assert.equal(metrics.broken,0);assert.equal(metrics.arrows,false);
 assert.ok(metrics.targets.every(x=>x.w>=44&&x.h>=44),label+' small target: '+JSON.stringify(metrics.targets.filter(x=>x.w<44||x.h<44)));
 assert.equal(await page.locator('h1').count(),1);
}
async function copyCheck(page){
 const text=await page.locator('#agent-prompt').inputValue();assert.ok(text.includes('https://newreading.app/start.txt'));
 await page.locator('#copy-prompt').click();assert.equal(await page.evaluate(()=>window.copiedPrompt),text);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied')}}}));
 await page.locator('#copy-prompt').click();await page.locator('#copy-status').filter({hasText:'Select and copy'}).waitFor();
 assert.deepEqual(await page.locator('#agent-prompt').evaluate(e=>({focused:document.activeElement===e,start:e.selectionStart,end:e.selectionEnd})),{focused:true,start:0,end:text.length});
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedPrompt=text}}}));
}
try{
 for(const engine of ['chromium','webkit']){
  const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
  const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  try{
   for(const viewport of sizes){
    const context=await browser.newContext({viewport,hasTouch:viewport.width<600,reducedMotion:'reduce'}),page=await context.newPage(),unexpected=[],errors=[];
    page.on('request',r=>{if(!r.url().startsWith(base+'/')&&!r.url().startsWith('data:'))unexpected.push(r.url())});page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedPrompt=text}}}));
    await page.goto(base);await page.locator('#copy-prompt:not([hidden])').waitFor();await settled(page);await layout(page,'Home');
    assert.deepEqual(await page.locator('.reader').evaluateAll(a=>a.map(x=>new URL(x.href).pathname)),['/austen/','/alice/','/walden/','/two-halls/']);
    assert.equal(await page.locator('.plate').count(),4);assert.equal(new Set(await page.locator('.plate img').evaluateAll(a=>a.map(x=>x.src))).size,4);
    const firstStart=page.locator('a[href="#start"]:visible').first();const startBox=await firstStart.boundingBox();assert.ok(startBox&&startBox.y+startBox.height<=viewport.height,'Start here is visible immediately');
    assert.ok((await page.locator('.plate').first().boundingBox()).y<(viewport.height<500?600:500),'Artwork appears early');
    assert.equal(await page.locator('#agent-prompt').inputValue(),commandText);assert.equal(await page.locator('a[href="/start.txt"]').count(),1);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://newreading.app/');
    assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'),'https://newreading.app/assets/read-share.jpg');
    assert.deepEqual(await page.evaluate(async()=>{const img=new Image();img.src='/assets/read-share.jpg';await img.decode();return[img.naturalWidth,img.naturalHeight]}),[1200,630]);
    const portrait=await page.locator('.halls .plate img').evaluate(img=>{const b=img.getBoundingClientRect(),p=img.closest('.plate').getBoundingClientRect(),s=getComputedStyle(img),scale=(s.objectFit==='cover'?Math.max:Math.min)(b.width/img.naturalWidth,b.height/img.naturalHeight);return{fit:s.objectFit,covers:img.naturalWidth*scale>=p.width-1&&img.naturalHeight*scale>=p.height-1}});assert.ok(portrait.covers,'Two Halls image fills its frame');
    await page.screenshot({path:fileURLToPath(new URL(`${engine}-${viewport.width}x${viewport.height}.png`,output)),fullPage:true,animations:'disabled'});
    await page.locator('#peek-books').click();assert.equal(await page.locator('#peek-books').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.inside[aria-hidden="false"]').count(),4);await layout(page,'Peek');
    if(viewport.width===402)await page.screenshot({path:fileURLToPath(new URL(`${engine}-402-peek.png`,output)),fullPage:true,animations:'disabled'});
    await page.locator('#peek-books').focus();await page.keyboard.press('Escape');assert.equal(await page.locator('#peek-books').getAttribute('aria-pressed'),'false');
    await firstStart.click();assert.ok(page.url().endsWith('#start'));await copyCheck(page);
    const textarea=await page.locator('#agent-prompt').evaluate(e=>e.scrollHeight<=e.clientHeight+1);assert.ok(textarea,'Complete instruction fits');
    const install=page.locator('.install-guide');await install.locator('summary').focus();await page.keyboard.press('Enter');await install.locator('.install-body').waitFor();assert.match(await install.innerText(),/iPhone & iPad[\s\S]*Android[\s\S]*Computer/);assert.match(await install.innerText(),/Check offline copy/);await layout(page,'Installation');
    await page.locator('header a[href="/learn/"]').click();await settled(page);await layout(page,'Guide');assert.equal(new URL(page.url()).pathname,'/learn/');assert.equal(await page.locator('header .nav-start').getAttribute('href'),'#workspace');
    await page.screenshot({path:fileURLToPath(new URL(`${engine}-${viewport.width}x${viewport.height}-guide.png`,output)),fullPage:true,animations:'disabled'});await copyCheck(page);
    for(const details of await page.locator('.lesson-help details,.folder-help').all()){await details.locator('summary').click();await layout(page,'Expanded help')}
    await page.locator('header a[href="/"]').click();await page.locator('.reader').first().waitFor();
    await page.locator('.reader').first().click();await page.locator('#offline-status').filter({hasText:'Available offline'}).waitFor({timeout:60000});assert.equal(new URL(page.url()).pathname,'/austen/');await page.goBack();await page.locator('.reader').first().waitFor();
    assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);receipts.push({engine,viewport,loadedAssets:true,firstScreenStart:true,copyAndFallback:true,peekAndKeyboard:true,guideRoundTrip:true,readerRoundTrip:true});await context.close();
   }
   const noScript=await browser.newContext({javaScriptEnabled:false,viewport:{width:402,height:874}}),plain=await noScript.newPage();await plain.goto(base);assert.equal(await plain.locator('.reader').count(),4);assert.equal(await plain.locator('#copy-prompt').isVisible(),false);assert.equal(await plain.locator('#peek-books').isVisible(),false);assert.equal(await plain.locator('#agent-prompt').inputValue(),commandText);
   await plain.locator('a[href="/start.txt"]').click();assert.equal((await plain.locator('body').textContent()).trim(),promptText);
   await plain.goto(base+'/learn/');assert.equal(await plain.locator('#copy-prompt').isVisible(),false);assert.match(await plain.locator('#agent-prompt').inputValue(),/https:\/\/newreading.app\/start.txt/);await noScript.close();
  }finally{await browser.close()}
 }
 await writeFile(new URL('receipt.json',output),JSON.stringify({checkedAt:new Date().toISOString(),passed:true,receipts,limits:'Automated Chromium/WebKit layout, interaction and navigation checks. Screenshots require visual review; not physical-device, screen-reader or human onboarding acceptance.'},null,2)+'\n');console.log(JSON.stringify({passed:true,viewports:receipts.length,engines:['chromium','webkit']}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
