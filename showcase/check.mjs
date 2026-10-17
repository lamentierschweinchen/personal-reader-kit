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
 const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>i.loading!=='lazy'&&(!i.complete||!i.naturalWidth)&&i.offsetParent).length,targets:[...document.querySelectorAll('a:not(.skip),button,summary')].filter(x=>!x.closest('p')&&x.getBoundingClientRect().width>0&&x.getBoundingClientRect().height>0&&getComputedStyle(x).visibility!=='hidden').map(x=>{const r=x.getBoundingClientRect();return{label:x.textContent.trim().slice(0,40),w:r.width,h:r.height}}),arrows:/[←-⇿➔➜➡]/u.test(document.body.textContent)}));
 assert.ok(metrics.scroll<=metrics.width,label+' overflow');assert.equal(metrics.broken,0,label+' broken image');assert.equal(metrics.arrows,false);
 assert.ok(metrics.targets.every(x=>x.w>=44&&x.h>=44),label+' small target: '+JSON.stringify(metrics.targets.filter(x=>x.w<44||x.h<44)));
 assert.equal(await page.locator('h1').count(),1);
}
// Inline links inside running text use the WCAG inline exception and are excluded above.
async function copyCheck(page,field,button){
 const text=await page.locator(field).inputValue();assert.ok(text.includes('https://newreading.app/start.txt'));
 await page.locator(button).click();assert.equal(await page.evaluate(()=>window.copiedPrompt),text);
 await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied')}}}));
 await page.locator(button).click();await page.locator('dialog.fallback[open]').waitFor();
 assert.equal(await page.locator('dialog.fallback textarea').inputValue(),text);await page.locator('dialog.fallback form button').click();
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
    await page.goto(base);await page.locator('header [data-copy]:not([hidden])').waitFor();await settled(page);await layout(page,'Home');
    assert.deepEqual(await page.locator('.sample').evaluateAll(a=>a.map(x=>new URL(x.href).pathname)),['/austen/','/alice/','/walden/','/two-halls/']);
    const start=page.locator('.hero a[href="#make"]');const startBox=await start.boundingBox();assert.ok(startBox&&startBox.y+startBox.height<=viewport.height+(viewport.height<500?400:0),'Start yours is visible early');
    assert.equal(await page.locator('#starter').inputValue(),commandText);assert.equal(await page.locator('a[href="/start.txt"]').count(),1);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://newreading.app/');
    assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'),'https://newreading.app/assets/read-share.jpg');
    assert.deepEqual(await page.evaluate(async()=>{const img=new Image();img.src='/assets/read-share.jpg';await img.decode();return[img.naturalWidth,img.naturalHeight]}),[1200,630]);
    // The hero switches editions; the explorations each show a different panel.
    await page.locator('.hero [data-pick="money"]').click();assert.equal(await page.locator('.hero').getAttribute('data-thread'),'money');assert.equal(await page.locator('[data-text="name"]').textContent(),'fortune');
    for(const id of ['word','accounts','closer','places']){await page.locator(`[data-explore="${id}"]`).click();assert.equal(await page.locator(`#panel-${id}`).isVisible(),true);assert.equal(await page.locator('.panel:visible').count(),1);await settled(page);}
    await page.locator('[data-explore="word"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-explore="accounts"]').getAttribute('aria-selected'),'true');
    await page.screenshot({path:fileURLToPath(new URL(`${engine}-${viewport.width}x${viewport.height}.png`,output)),fullPage:true,animations:'disabled'});
    await page.locator('#prompt-box summary').click();await copyCheck(page,'#starter','#prompt-box [data-copy]');
    await page.locator('#book').fill('Walden');await page.locator('[data-copy="personal"]').click();assert.match(await page.evaluate(()=>window.copiedPrompt),/The book I have in mind: Walden/);
    await layout(page,'Make');
    await page.locator('a.newbie').click();await settled(page);await layout(page,'Guide');assert.equal(new URL(page.url()).pathname,'/learn/');
    for(const [ai,route] of [['claude','claude'],['gemini','antigravity'],['chatgpt','codex']]){await page.locator(`input[value="${ai}"]`).check({force:true});assert.equal(await page.locator(`[data-route="${route}"]`).isVisible(),true);assert.equal(await page.locator('[data-route]:visible').count(),1);}
    await page.screenshot({path:fileURLToPath(new URL(`${engine}-${viewport.width}x${viewport.height}-guide.png`,output)),fullPage:true,animations:'disabled'});await copyCheck(page,'#starter','#paste [data-copy]');
    for(const details of await page.locator('.g-faq details').all()){await details.locator('summary').click();}await layout(page,'Expanded help');
    await page.locator('header a.brand').click();await page.locator('.sample').first().waitFor();
    await page.locator('.sample').first().click();await page.locator('#offline-status').filter({hasText:'Available offline'}).waitFor({timeout:60000});assert.equal(new URL(page.url()).pathname,'/austen/');await page.goBack();await page.locator('.sample').first().waitFor();
    assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);receipts.push({engine,viewport,loadedAssets:true,firstScreenStart:true,copyAndFallback:true,editionSwitch:true,explorePanels:true,guideRoutes:true,readerRoundTrip:true});await context.close();
   }
   const noScript=await browser.newContext({javaScriptEnabled:false,viewport:{width:402,height:874}}),plain=await noScript.newPage();await plain.goto(base);assert.equal(await plain.locator('.sample').count(),4);assert.equal(await plain.locator('header [data-copy]').isVisible(),false);assert.equal(await plain.locator('#starter').inputValue(),commandText);
   await plain.locator('a[href="/start.txt"]').click();assert.equal((await plain.locator('body').textContent()).trim(),promptText);
   await plain.goto(base+'/learn/');assert.equal(await plain.locator('#paste [data-copy]').isVisible(),false);assert.match(await plain.locator('#starter').inputValue(),/https:\/\/newreading.app\/start.txt/);assert.equal(await plain.locator('[data-route="codex"]').isVisible(),true);await noScript.close();
  }finally{await browser.close()}
 }
 await writeFile(new URL('receipt.json',output),JSON.stringify({checkedAt:new Date().toISOString(),passed:true,receipts,limits:'Automated Chromium/WebKit layout, interaction and navigation checks. Screenshots require visual review; not physical-device, screen-reader or human onboarding acceptance.'},null,2)+'\n');console.log(JSON.stringify({passed:true,viewports:receipts.length,engines:['chromium','webkit']}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
