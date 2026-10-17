import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {buildShowcase} from './build.mjs';
import {serve} from './serve.mjs';

if(!process.argv.includes('--skip-build'))await buildShowcase();
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=new URL('../test-results/personal/',import.meta.url);await mkdir(output,{recursive:true});
const edition=JSON.parse(await readFile(new URL('../examples/alice-in-wonderland/edition/library.json',import.meta.url),'utf8'))[0];
const blocks=edition.sections.find(s=>s.id==='chapter-01').blocks;
const paragraphs=['chapter-01-b003','chapter-01-b004'].map(id=>blocks.find(b=>b.id===id).text);
const spreadPassage=blocks.find(b=>b.id==='chapter-01-b006').text;
const server=await serve(),base='http://127.0.0.1:'+server.address().port,receipts=[];
const sizes=[{width:320,height:740},{width:390,height:844},{width:844,height:390},{width:768,height:1024},{width:1440,height:900}];
async function settled(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.loading!=='lazy'||i.complete).map(i=>i.decode()));await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));});}
async function layout(page){
 const m=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>i.loading!=='lazy'&&(!i.complete||!i.naturalWidth)).length,ledgerFits:(()=>{const p=document.querySelector('.walden-preview').getBoundingClientRect(),n=document.querySelector('.ledger-note').getBoundingClientRect();return n.bottom<=p.bottom})()}));
 assert.ok(m.scroll<=m.width,'No horizontal overflow');assert.equal(m.broken,0);assert.ok(m.ledgerFits,'All thirteen expenses, total and exclusions fit');
}
try{
 for(const engine of ['chromium','webkit']){
  const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
  const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  try{
   for(const viewport of sizes){
    const context=await browser.newContext({viewport,hasTouch:viewport.width<700}),page=await context.newPage(),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base+'/'))external.push(r.url())});
    await page.goto(base+'/personal/');await settled(page);await layout(page);
    assert.deepEqual(await page.locator('.book').evaluateAll(els=>els.map(e=>e.dataset.book)),['canetti','alice','walden']);
    assert.equal(await page.locator('.books a,.books button').count(),0,'The illustrations do not open any reader');
    assert.deepEqual(await page.locator('main a[href^="https:"]').evaluateAll(els=>els.map(e=>e.href)),['https://newreading.app/']);
    assert.deepEqual(await page.locator('.alice-text').allTextContents(),paragraphs,'Alice excerpt remains exact');
    assert.equal(await page.locator('.sample-passage blockquote').textContent(),spreadPassage,'The illustrated-page excerpt remains exact');
    assert.equal(await page.locator('.alice-text mark').textContent(),'"and what is the use of a book," thought Alice, "without pictures or conversations?"');
    assert.equal(await page.locator('.walden-preview tr').count(),13);
    const prices=await page.locator('.walden-preview td:last-child').allTextContents();
    assert.equal(prices.reduce((sum,p)=>sum+Math.round(parseFloat(p)*200)+(p.endsWith('½')?1:0),0),5625,'The account totals $28.12½');
    assert.equal(await page.locator('.ledger-total strong').textContent(),'$28.12½');
    assert.match(await page.locator('.ledger-note').textContent(),/Labour, timber, stones and sand/);
    if(viewport.height>600){
     assert.equal(await page.locator('.preview-choices').isVisible(),false,'Hidden preview controls cannot receive focus');
     await page.locator('.scroll-cue').click();await page.locator('.transformation.is-open').waitFor();await settled(page);
     assert.ok(await page.locator('.book-cover').first().evaluate(e=>parseFloat(getComputedStyle(e).opacity)<.2),'Scrolling opens the covers');
     const device=await page.locator('.book-alice .reader-screen').evaluate(e=>{const b=e.getBoundingClientRect(),s=getComputedStyle(e);return{ratio:b.width/b.height,radius:parseFloat(s.borderTopLeftRadius),bezel:parseFloat(s.borderTopWidth)}});
     assert.ok(device.ratio<.6&&device.radius>20&&device.bezel>4,'The opened book has a tall, rounded phone body with a visible bezel');
     if(viewport.width<700){
      const before=await page.evaluate(()=>scrollY);
      for(const name of ['walden','canetti','alice']){
       const button=page.locator(`[data-preview="${name}"]`),b=await button.boundingBox();
       await page.mouse.click(b.x+b.width/2,b.y+b.height/2);await settled(page);
       assert.equal(await button.getAttribute('aria-pressed'),'true');assert.equal(await page.evaluate(()=>scrollY),before,'Switching illustrations preserves scroll position');
       const r=await page.locator(`[data-book="${name}"] .reader-screen`).boundingBox();assert.ok(r.x>=0&&r.x+r.width<=viewport.width,'Active preview fits the phone');
      }
     }
    }
    await layout(page);await page.screenshot({path:fileURLToPath(new URL(`${engine}-${viewport.width}.png`,output))});
    await page.locator('.colophon summary').click();
    const credits=await page.locator('.colophon>div').boundingBox();assert.ok(credits.x>=0&&credits.y>=0&&credits.x+credits.width<=viewport.width&&credits.y+credits.height<=viewport.height,'Colophon stays inside the viewport');
    assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
    await page.route('https://newreading.app/',r=>r.fulfill({status:200,body:'Main site handoff'}));
    await page.locator('.colophon summary').click();await page.locator('.start-link').click();assert.equal(page.url(),'https://newreading.app/');
    receipts.push({engine,viewport,sharpTypesetting:true,sourceExact:true,noReaderLinks:true,openingAndSwitching:true,mainSiteHandoff:true});await context.close();
   }
   for(const settings of [{javaScriptEnabled:false},{reducedMotion:'reduce'}]){
    const context=await browser.newContext({viewport:{width:390,height:844},...settings}),page=await context.newPage();
    await page.goto(base+'/personal/');await settled(page);await layout(page);assert.equal(await page.locator('html.motion').count(),0);assert.equal(await page.locator('.reader-screen:visible').count(),3);assert.equal(await page.locator('.preview-choices').isVisible(),false);assert.equal(await page.locator('.start-link').getAttribute('href'),'https://newreading.app/');await context.close();
   }
   const context=await browser.newContext(),page=await context.newPage();await page.goto(base+'/personal/');
   await page.keyboard.press(engine==='webkit'?'Alt+Tab':'Tab');assert.equal(await page.locator('.skip').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Enter');assert.ok(page.url().endsWith('#start'));await context.close();
  }finally{await browser.close()}
 }
 await writeFile(new URL('receipt.json',output),JSON.stringify({passed:true,checkedAt:new Date().toISOString(),receipts,limits:'Browser emulation and regression checks; visual review remains separate. Not physical-device or screen-reader acceptance.'},null,2)+'\n');console.log(JSON.stringify({passed:true,layouts:receipts.length,engines:['chromium','webkit']}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
