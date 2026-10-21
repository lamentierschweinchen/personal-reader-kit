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
const sizes=[{width:320,height:740},{width:375,height:812},{width:390,height:844},{width:430,height:932},{width:402,height:874},{width:874,height:402},{width:768,height:1024},{width:1024,height:768},{width:1440,height:1000}];
const shelfOrder=['alice','mountains','at-table','beside-the-bed','dracula','inward-life','learning-to-see','nietzsche','odyssey','austen','two-halls','walden','war-and-peace','music-and-feeling'];
const promptText=(await readFile(new URL('./start.txt',import.meta.url),'utf8')).trim();
const commandText='Use https://newreading.app/start.txt to help me build a personal reader. Follow the linked kit guide, then help me choose a simple reader or a custom experience.';
async function settled(page){await page.locator('header [data-copy]:not([hidden])').waitFor();await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));});}
async function layout(page,label){
 const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>i.loading!=='lazy'&&(!i.complete||!i.naturalWidth)&&i.offsetParent).length,targets:[...document.querySelectorAll('a:not(.skip),button,summary')].filter(x=>!x.closest('p')&&x.getBoundingClientRect().width>0&&x.getBoundingClientRect().height>0&&getComputedStyle(x).visibility!=='hidden').map(x=>{const r=x.getBoundingClientRect();return{label:x.textContent.trim().slice(0,40),w:r.width,h:r.height}}),arrows:/[←-⇿➔➜➡]/u.test(document.body.textContent)}));
 assert.ok(metrics.scroll<=metrics.width,label+' overflow');assert.equal(metrics.broken,0,label+' broken image');assert.equal(metrics.arrows,false);
 assert.ok(metrics.targets.every(x=>x.w>=44&&x.h>=44),label+' small target: '+JSON.stringify(metrics.targets.filter(x=>x.w<44||x.h<44)));
 assert.equal(await page.locator('h1').count(),1);
 for(const selector of ['header a[href="/library/"]','header a[href="/learn/"]','header [data-copy]'])assert.equal(await page.locator(selector).isVisible(),true,label+' navigation remains available');
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
    await page.locator('#samples .shelf-interactive:not([hidden])').waitFor();
    assert.deepEqual(await page.locator('#samples .book-pick').evaluateAll(a=>a.map(x=>x.dataset.shelfBook)),shelfOrder);
    assert.deepEqual(await page.locator('#samples .shelf-fallback a').evaluateAll(a=>a.map(x=>new URL(x.href).pathname)),shelfOrder.map(id=>'/'+id+'/'));
    assert.equal(await page.locator('#samples a[href*="/play/"]').count(),0);
    assert.deepEqual(await page.locator('#panel-play a').evaluateAll(a=>a.map(x=>new URL(x.href).pathname)),['/odyssey/play/','/alice/play/','/dracula/play/']);
    const start=page.locator('.hero a[href="#make"]');const startBox=await start.boundingBox();assert.ok(startBox&&startBox.y+startBox.height<=viewport.height+(viewport.height<500?400:0),'Start yours is visible early');
    assert.equal(await page.locator('#starter').inputValue(),commandText);assert.equal(await page.locator('a[href="/start.txt"]').count(),1);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://newreading.app/');
    assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'),'https://newreading.app/assets/read-share.jpg?v=20261019');
    assert.deepEqual(await page.evaluate(async()=>{const img=new Image();img.src='/assets/read-share.jpg';await img.decode();return[img.naturalWidth,img.naturalHeight]}),[1200,630]);
    assert.equal(await page.locator('[data-explore][aria-selected="true"]').getAttribute('data-explore'),'play');
    assert.equal(await page.locator('#samples a[href="/library/"]').count(),1,'One library destination in the shelf');
    await page.locator('.all-editions').focus();
    const libraryFocus=await page.locator('.all-editions').evaluate(e=>({outline:getComputedStyle(e).outlineStyle,line:getComputedStyle(e).textDecorationLine}));
    assert.equal(libraryFocus.outline,'none');assert.equal(libraryFocus.line,'underline','Keyboard focus remains visible');
    // The hero switches editions; the explorations each show a different panel.
    const heroBefore=await page.locator('.hero').boundingBox();
    await page.locator('.hero [data-pick="money"]').click();assert.equal(await page.locator('.hero').getAttribute('data-thread'),'money');assert.equal(await page.locator('[data-text="name"]').textContent(),'fortune');
    const heroAfter=await page.locator('.hero').boundingBox();
    assert.ok(Math.abs(heroAfter.height-heroBefore.height)<1,'Switching the edition keeps the hero height');
    const stageHeights=[],tabPositions=[];for(const id of ['play','places','closer','accounts','word']){await page.locator(`[data-explore="${id}"]`).click();assert.equal(await page.locator(`#panel-${id}`).isVisible(),true);assert.equal(await page.locator('.panel:visible').count(),1);await settled(page);stageHeights.push(Math.round((await page.locator('.stage').boundingBox()).height));
     tabPositions.push(await page.locator('.tabs').evaluate(e=>{const r=e.getBoundingClientRect();return[r.x,r.y+scrollY,r.width,r.height]}));
     assert.equal(await page.locator('[data-explore-caption]:not([hidden])').count(),1);
     assert.equal(await page.locator(`[data-explore-caption="${id}"]`).getAttribute('aria-hidden'),'false');
     const fit=await page.locator('.mode-explore').evaluate(e=>{const box=e.getBoundingClientRect();return [...e.querySelectorAll('.mode-text,.stage,.tabs button')].every(x=>{const r=x.getBoundingClientRect();return r.left>=box.left&&r.right<=box.right})});assert.ok(fit,'Explore controls and preview fit their section');}
    assert.equal(new Set(stageHeights).size,1,'Explore keeps one height: '+stageHeights);
    assert.ok(tabPositions.every(r=>r.every((n,i)=>Math.abs(n-tabPositions[0][i])<1)),'Explore tabs keep their position across captions: '+JSON.stringify(tabPositions));
    assert.doesNotMatch(await page.locator('#samples').textContent(),/Six founding editions|Just added|On the shelf/);
    await page.locator('[data-explore="play"]').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-explore="places"]').getAttribute('aria-selected'),'true');
    await page.screenshot({path:fileURLToPath(new URL(`${engine}-${viewport.width}x${viewport.height}.png`,output)),fullPage:true,animations:'disabled'});
    await page.locator('#prompt-box summary').click();await copyCheck(page,'#starter','#prompt-box [data-copy]');
    await page.locator('#book').fill('Walden');await page.locator('[data-copy="personal"]').click();assert.match(await page.evaluate(()=>window.copiedPrompt),/The book I have in mind: Walden/);
    await layout(page,'Make');
    await page.locator('a.newbie').click();await settled(page);await layout(page,'Guide');assert.equal(new URL(page.url()).pathname,'/learn/');
    for(const [ai,route] of [['claude','claude'],['gemini','antigravity'],['chatgpt','codex']]){await page.locator(`input[value="${ai}"]`).check({force:true});assert.equal(await page.locator(`[data-route="${route}"]`).isVisible(),true);assert.equal(await page.locator('[data-route]:visible').count(),1);}
    await page.screenshot({path:fileURLToPath(new URL(`${engine}-${viewport.width}x${viewport.height}-guide.png`,output)),fullPage:true,animations:'disabled'});await copyCheck(page,'#starter','#paste [data-copy]');
    for(const details of await page.locator('.g-faq details').all()){await details.locator('summary').click();}await layout(page,'Expanded help');
    await page.locator('header a.brand').click();await page.locator('#samples .shelf-interactive:not([hidden])').waitFor();
    await page.locator('#samples [data-shelf-book="austen"]').click();
    assert.equal(await page.locator('#chosen-book .chosen-read').getAttribute('href'),'/austen/');
    await page.locator('#chosen-book .chosen-read').click();await page.locator('#offline-status').filter({hasText:'Available offline'}).waitFor({timeout:60000});assert.equal(new URL(page.url()).pathname,'/austen/');await page.goBack();await page.locator('#samples .shelf-interactive:not([hidden])').waitFor();
    assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);receipts.push({engine,viewport,loadedAssets:true,firstScreenStart:true,copyAndFallback:true,editionSwitch:true,explorePanels:true,guideRoutes:true,readerRoundTrip:true});await context.close();
   }
   // A hovered cover band must resume after a second activation.
   const moving=await browser.newContext({viewport:{width:390,height:844}}),motion=await moving.newPage();await motion.goto(base);await settled(motion);
   const band=motion.locator('[data-marquee]');await band.click();await motion.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   assert.equal(await band.getAttribute('aria-label'),'Resume the moving covers');
   assert.equal(await motion.locator('[data-covers]').evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
   await band.click();assert.equal(await band.getAttribute('aria-label'),'Pause the moving covers');
   assert.equal(await motion.locator('[data-covers]').evaluate(e=>getComputedStyle(e).animationPlayState),'running');await moving.close();
   // Enlarge rendered text, including fixed-pixel labels, as a reflow stress check.
   for(const width of [320,390]){const enlarged=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce'}),zoom=await enlarged.newPage();await zoom.goto(base);await settled(zoom);
    await zoom.evaluate(()=>{const es=[...document.querySelectorAll('body,body *')],sizes=es.map(e=>parseFloat(getComputedStyle(e).fontSize));es.forEach((e,i)=>e.style.fontSize=sizes[i]*2+'px')});await settled(zoom);
    assert.ok(await zoom.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Homepage reflows at 200% text');
    for(const id of ['play','places','closer','accounts','word']){await zoom.locator(`[data-explore="${id}"]`).click();assert.ok(await zoom.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Enlarged '+id+' panel fits');}
    await enlarged.close();
   }
   const noScript=await browser.newContext({javaScriptEnabled:false,reducedMotion:'reduce',viewport:{width:402,height:874}}),plain=await noScript.newPage();await plain.goto(base);await plain.evaluate(()=>document.fonts.ready);assert.equal(await plain.locator('#samples .shelf-interactive').isVisible(),false);assert.equal(await plain.locator('#samples .shelf-fallback').isVisible(),true);assert.deepEqual(await plain.locator('#samples .shelf-fallback a').evaluateAll(a=>a.map(x=>new URL(x.href).pathname)),shelfOrder.map(id=>'/'+id+'/'));assert.equal(await plain.locator('header [data-copy]').isVisible(),false);assert.equal(await plain.locator('#starter').inputValue(),commandText);
   assert.equal(await plain.locator('.panel:visible').count(),5,'All Explore examples remain available without JavaScript');
   assert.equal(await plain.locator('.tabs').isVisible(),false);assert.equal(await plain.locator('[data-pick="money"]').isDisabled(),true);
   await plain.locator('a[href="/start.txt"]').click();assert.equal((await plain.locator('body').textContent()).trim(),promptText);
   await plain.goto(base+'/learn/');assert.equal(await plain.locator('#paste [data-copy]').isVisible(),false);assert.match(await plain.locator('#starter').inputValue(),/https:\/\/newreading.app\/start.txt/);assert.equal(await plain.locator('[data-route]:visible').count(),3);assert.equal(await plain.locator('.learn-q').isVisible(),false);await noScript.close();
  }finally{await browser.close()}
 }
 await writeFile(new URL('receipt.json',output),JSON.stringify({checkedAt:new Date().toISOString(),passed:true,receipts,limits:'Automated Chromium/WebKit layout, interaction and navigation checks. Screenshots require visual review; not physical-device, screen-reader or human onboarding acceptance.'},null,2)+'\n');console.log(JSON.stringify({passed:true,viewports:receipts.length,engines:['chromium','webkit']}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
