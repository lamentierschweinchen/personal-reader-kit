// Regression: scholarly references must be visible below the actual dialog chrome.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildShowcase} from './build.mjs';
import {settledRender} from '../tests/experience-browser.mjs';
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url)));
const output=fileURLToPath(new URL('../test-results/clay-cart/',import.meta.url));
const hosted=process.env.SHOWCASE_BASE_URL?.replace(/\/$/,'');
if(!hosted&&!process.argv.includes('--skip-build'))await buildShowcase();
const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const security=JSON.parse(await readFile(new URL('./vercel.json',import.meta.url))).routes.find(r=>r.headers?.['Content-Security-Policy']).headers;
let server;
if(!hosted){server=createServer(async(req,res)=>{try{let file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);assert.ok(file.startsWith(root+path.sep)||file===root);if((await stat(file)).isDirectory())file=path.join(file,'index.html');res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store',...security});res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));}
const base=hosted||'http://127.0.0.1:'+server.address().port;
const receipt={base,cases:[],passed:false,limits:'Isolated Chromium/WebKit browser checks; not physical-device or screen-reader acceptance.'};
await mkdir(output,{recursive:true});
try{
 for(const engine of(process.env.QA_ENGINE?[process.env.QA_ENGINE]:['chromium','webkit'])){
  const browser=await pw[engine].launch({headless:true,...(process.env[engine.toUpperCase()+'_EXECUTABLE']?{executablePath:process.env[engine.toUpperCase()+'_EXECUTABLE']}:{} )});
  try{
   const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
   const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
   // Production checks must not manufacture analytics events.
   await context.route('**/_vercel/insights/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
   await page.goto(base+'/clay-cart/');await page.locator('[data-action=cart-notice-continue]').click();
   await page.getByRole('button',{name:'Read the prologue',exact:true}).click();await page.locator('#reading-text[data-position-ready=true]').waitFor();
   const state=()=>page.evaluate(async()=>(await import('/clay-cart/db.mjs')).loadState());
   await page.getByRole('link',{name:'Companion',exact:true}).click();await page.getByRole('button',{name:'Allow ending spoilers',exact:true}).click();
   const before=(await state()).positions;assert.equal(before['clay-cart-ryder-1905']?.sectionId,'prologue','Reading place saved before the reference visit');
   for(const [width,height,zoom]of[[390,844,1],[320,720,1],[820,1180,1],[1440,1000,1],[390,844,2]]){
    await page.setViewportSize({width,height});
    await page.evaluate(scale=>document.documentElement.style.fontSize=16*scale+'px',zoom);
    for(const essay of['sen','austin']){
     await page.locator(`[data-action=scholar-read][data-essay=${essay}]`).click();await page.locator('.scholar-body').waitFor();await settledRender(page);
     const body=await page.locator('.scholar-body').textContent();
     const link=page.locator(`.scholar-body [data-action=scholar-reference][data-ref=${essay}-fn1]`).first();const citation=essay==='austin'?link.locator('sup'):link;await citation.scrollIntoViewIfNeeded();
     const prior=await page.locator('#dialog').evaluate(e=>e.scrollTop);const source=await citation.boundingBox();
     const target=await link.getAttribute('data-ref');await citation.click();
     const measure=await page.evaluate(id=>{
      const note=document.getElementById(id),header=document.querySelector('.dialog-header'),back=document.querySelector('.scholar-back'),modal=document.getElementById('dialog');
      const r=document.createRange();r.selectNodeContents(note);const lines=[...r.getClientRects()].filter(x=>x.width&&x.height);const n=lines[0]||note.getBoundingClientRect(),h=header.getBoundingClientRect(),b=back.getBoundingClientRect(),d=modal.getBoundingClientRect();
      return{noteTop:n.top,headerBottom:h.bottom,backBottom:b.bottom,backHeight:b.height,dialogBottom:d.bottom,overflow:modal.scrollWidth>modal.clientWidth+1,focus:document.activeElement.id};
     },target);
     assert.ok(measure.noteTop>=Math.max(measure.headerBottom,measure.backBottom)-1,`${engine}/${essay}/${width}/${zoom}: note obscured ${JSON.stringify(measure)}`);
     assert.ok(measure.noteTop<measure.dialogBottom-20,'Target note is in the reading viewport');assert.ok(measure.backHeight>=44);assert.equal(measure.overflow,false);assert.equal(measure.focus,target);
     await page.screenshot({path:path.join(output,`${engine}-${essay}-${width}-${zoom}.png`)});
     // The return action removes its row before restoring the original scroll.
     await page.getByRole('button',{name:'Return to text',exact:true}).click();assert.ok(Math.abs(await page.locator('#dialog').evaluate(e=>e.scrollTop)-prior)<3,'Exact scroll return');
     const returned=await citation.boundingBox();assert.ok(Math.abs(returned.y-source.y)<3,`Original citation retains its screen position: ${JSON.stringify({engine,essay,width,zoom,prior,source,returned,scroll:await page.locator('#dialog').evaluate(e=>e.scrollTop)})}`);assert.equal(await link.evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('.scholar-back').isVisible(),false);
     assert.equal(await page.locator('.scholar-body').textContent(),body,'Article text unchanged');
     await page.getByRole('button',{name:'Close ×',exact:true}).click();await page.locator('#dialog').waitFor({state:'hidden'});assert.deepEqual((await state()).positions,before,'Main reading place unchanged');
     receipt.cases.push({engine,essay,width,height,zoom,...measure});
    }
   }
   assert.deepEqual(errors,[]);await context.close();console.log(`${engine}: 10 scholarly note and return cases passed`);
  }finally{await browser.close();}
 }
 receipt.passed=true;
}finally{if(server)await new Promise(r=>server.close(r));await writeFile(path.join(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
