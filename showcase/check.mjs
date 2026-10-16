import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import './build.mjs';

const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(fileURLToPath(new URL('./dist/',import.meta.url))),output=new URL('../test-results/showcase/',import.meta.url);
await mkdir(output,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2','.txt':'text/plain'};
const server=createServer(async(req,res)=>{
  try {
    const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html'))throw Error('Outside build');
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,receipts=[];
const sizes=[{width:402,height:874},{width:874,height:402},{width:768,height:1024},{width:1024,height:768},{width:1440,height:1000}];
try {
  for(const engine of ['chromium','webkit']){
    const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
    const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
    try {
      for(const viewport of sizes){
        const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage(),unexpected=[],errors=[];
        page.on('request',req=>{if(!req.url().startsWith(base+'/'))unexpected.push(req.url());});page.on('pageerror',error=>errors.push(error.message));
        await page.goto(base);await page.locator('h1').waitFor();await page.evaluate(()=>document.fonts.ready);
        const expected=['https://austen.lookatseel.com/','https://alice.lookatseel.com/','https://walden.lookatseel.com/','https://two-halls.lookatseel.com/'];
        assert.deepEqual(await page.locator('.read-link').evaluateAll(a=>a.map(x=>x.href)),expected);
        const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(x=>!x.complete||x.naturalWidth===0).length,targets:[...document.querySelectorAll('nav a,.read-link,.make-link,summary')].map(x=>({label:x.textContent.trim(),w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height})),arrows:/[\u2190-\u21ff\u2794\u279c\u27a1]/u.test(document.body.textContent)}));
        assert.ok(metrics.scroll<=metrics.width,'Horizontal overflow: '+JSON.stringify(metrics));assert.equal(metrics.broken,0);assert.equal(metrics.arrows,false);
        assert.ok(metrics.targets.every(x=>x.w>=44&&x.h>=44),'Small interaction target: '+JSON.stringify(metrics.targets));
        await page.screenshot({path:fileURLToPath(new URL(`${engine}-${viewport.width}x${viewport.height}.png`,output)),fullPage:true,animations:'disabled'});
        await page.getByText('Can I take a book offline?',{exact:true}).click();await page.getByText('Check offline copy',{exact:true}).waitFor({state:'visible'});
        await page.getByText('Where do my notes go?',{exact:true}).click();await page.getByText('They stay in your browser.',{exact:false}).waitFor({state:'visible'});
        assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
        receipts.push({engine,viewport,localAssets:true,links:4,touchTargets:true,details:true,overflow:false});await context.close();
      }
      const context=await browser.newContext(),page=await context.newPage();await page.goto(base);
      // macOS WebKit's default Tab policy skips links; Option-Tab includes them.
      await page.keyboard.press(engine==='webkit'&&process.platform==='darwin'?'Alt+Tab':'Tab');
      assert.equal(await page.locator(':focus').textContent(),'Skip to the books');await page.keyboard.press('Enter');assert.ok(page.url().endsWith('#books'));await context.close();
    }finally{await browser.close();}
  }
  await writeFile(new URL('receipt.json',output),JSON.stringify({checkedAt:new Date().toISOString(),passed:true,receipts,limits:'Automated Chromium/WebKit layout, navigation and asset checks. Screenshots require visual review; emulation is not physical-device or screen-reader acceptance.'},null,2)+'\n');
  console.log(JSON.stringify({passed:true,viewports:receipts.length,engines:['chromium','webkit']}));
}finally{await new Promise(resolve=>server.close(resolve));}
