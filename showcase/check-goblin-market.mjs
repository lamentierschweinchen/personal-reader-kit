import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {serve} from './serve.mjs';
const playwright=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const prod=process.env.REVIEW_LIVE==='1';
for(const [engine,executablePath,width,height] of [['chromium',process.env.CHROME_PATH,1440,1000],['webkit',process.env.WEBKIT_PATH,390,900]]){
  const server=prod?null:await serve();
  const base=prod?'https://newreading.app':`http://127.0.0.1:${server.address().port}`;
  const browser=await playwright[engine].launch({executablePath});
  try{
   const context=await browser.newContext({viewport:{width,height},hasTouch:width<500,reducedMotion:'reduce'});
   await context.route('**/_vercel/insights/**',r=>r.abort());
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/library/');
   await page.locator('#search').fill('Goblin Market');
   const card=page.locator('[data-edition="goblin-market"]');
   await card.waitFor();
   assert.deepEqual(await page.locator('#results article:visible').evaluateAll(els=>els.map(e=>e.dataset.edition)),['goblin-market']);
   await card.getByRole('link',{name:'About this edition'}).click();
   await page.getByRole('dialog').getByRole('link',{name:'Read this edition'}).click();
   await page.waitForURL(base+'/goblin-market/');
   await page.locator('#verse[data-ready=true]').waitFor();
   assert.equal(await page.locator('#verse [data-block]').count(),567);
   for(const selector of ['#the-bargain','#the-sisters']){
    const study=page.locator(selector);await study.locator('img').scrollIntoViewIfNeeded();
    await page.waitForFunction(id=>document.querySelector(id+' img').naturalWidth>0,selector);
    await study.evaluate(e=>e.previousElementSibling.scrollIntoView({block:'start'}));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
    if(process.env.REVIEW_OUTPUT)await page.screenshot({path:`${process.env.REVIEW_OUTPUT}/${engine}-${selector.slice(1)}.png`});
   }
   const launch=(await context.request.get(base+'/goblin-market/manifest.webmanifest')).json();
   assert.equal((await launch).scope,'/goblin-market/');
   const plate=page.getByRole('button',{name:'Enlarge the illustrated title page'});
   await plate.click();await page.getByRole('dialog').getByRole('button',{name:'Zoom in'}).click();
   await page.mouse.click(2,2);await page.getByRole('dialog').waitFor({state:'hidden'});
   assert.equal(await plate.evaluate(e=>e===document.activeElement),true);
   await page.getByRole('button',{name:'Enter Focus mode'}).click();
   assert.equal(await page.locator('#the-sisters').isVisible(),false);
   await page.getByRole('button',{name:'Exit Focus mode'}).click();
   const selection=await page.locator('#line-126 [data-block]').evaluate(el=>{
     el.scrollIntoView({block:'center'});const range=new Range();range.selectNodeContents(el);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));return range.toString();
   });
   await page.getByRole('button',{name:'Keep passage',exact:true}).click();
   await page.locator('#note-text').fill('Isolated browser verification');await page.getByRole('button',{name:'Save passage',exact:true}).click();
   await page.getByRole('dialog').waitFor({state:'hidden'});
   assert.equal(await page.locator('#line-126 mark').textContent(),selection);
   await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
   if(!prod){
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    await assert.rejects(fetch(base+'/goblin-market/'));
    await page.reload();await page.locator('#verse[data-ready=true]').waitFor();
    assert.equal(await page.locator('#line-126 mark').textContent(),selection);
   }
   assert.deepEqual(errors,[]);
   await context.close();console.log(`${engine} ${width} library → poem, both engravings, zoom, Focus, note${prod?'':', offline restart'} passed`);
  }finally{
   await browser.close();
   if(server?.listening)await new Promise(resolve=>server.close(resolve));
  }
}
