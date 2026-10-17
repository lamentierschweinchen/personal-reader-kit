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
const types={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const security=JSON.parse(await readFile(new URL('./vercel.json',import.meta.url),'utf8')).headers[0].headers;
const server=createServer(async(req,res)=>{
  try {
    const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(root+path.sep)&&file!==path.join(root,'index.html'))throw Error('Outside build');
    const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream',...Object.fromEntries(security.map(h=>[h.key,h.value]))});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,receipts=[];
const sizes=[{width:320,height:740},{width:402,height:874},{width:874,height:402},{width:768,height:1024},{width:1024,height:768},{width:1440,height:1000}];
const promptText=(await readFile(new URL('./start.txt',import.meta.url),'utf8')).trim();
const commandText='Use https://read.lookatseel.com/start.txt to help me build a personal reader. Follow the linked kit guide, then help me choose a simple reader or a custom experience.';
try {
  for(const engine of ['chromium','webkit']){
    const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
    const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
    try {
      for(const viewport of sizes){
        const context=await browser.newContext({viewport,reducedMotion:'reduce'}),page=await context.newPage(),unexpected=[],errors=[];
        page.on('request',req=>{if(!req.url().startsWith(base+'/'))unexpected.push(req.url());});page.on('pageerror',error=>errors.push(error.message));
        await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedPrompt=text;}}}));
        await page.goto(base);await page.locator('#copy-prompt:not([hidden])').waitFor();
        await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
        const expected=['https://austen.lookatseel.com/','https://alice.lookatseel.com/','https://walden.lookatseel.com/','https://two-halls.lookatseel.com/'];
        assert.deepEqual(await page.locator('.reader').evaluateAll(a=>a.map(x=>x.href)),expected);
        assert.equal(await page.locator('.plate').count(),4);
        assert.equal(new Set(await page.locator('.plate img').evaluateAll(a=>a.map(x=>x.src))).size,3);
        assert.equal(await page.locator('#agent-prompt').inputValue(),commandText);
        assert.equal(await page.locator('#full-prompt').textContent(),promptText);
        const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(x=>!x.complete||x.naturalWidth===0).length,targets:[...document.querySelectorAll('a:not(.skip),button:not([hidden]),summary')].filter(x=>x.getBoundingClientRect().width>0).map(x=>({label:x.textContent.trim(),w:x.getBoundingClientRect().width,h:x.getBoundingClientRect().height})),previewTop:document.querySelector('.plate').getBoundingClientRect().top,promptFits:document.querySelector('#agent-prompt').scrollHeight<=document.querySelector('#agent-prompt').clientHeight+1,arrows:/[\u2190-\u21ff\u2794\u279c\u27a1]/u.test(document.body.textContent)}));
        assert.ok(metrics.scroll<=metrics.width,'Horizontal overflow: '+JSON.stringify(metrics));assert.equal(metrics.broken,0);assert.equal(metrics.arrows,false);assert.equal(metrics.promptFits,true,'The complete command should fit without internal scrolling');
        assert.ok(metrics.targets.every(x=>x.w>=44&&x.h>=44),'Small interaction target: '+JSON.stringify(metrics.targets));
        assert.ok(metrics.previewTop<410,'Previews should be near the beginning of the page');
        await page.screenshot({path:fileURLToPath(new URL(`${engine}-${viewport.width}x${viewport.height}.png`,output)),fullPage:true,animations:'disabled'});
        await page.getByRole('link',{name:'Build your personal reader',exact:true}).click();assert.ok(page.url().endsWith('#start'));
        await page.getByRole('button',{name:'Copy command',exact:true}).click();await page.getByRole('status').filter({hasText:'Copied.'}).waitFor();
        assert.equal(await page.evaluate(()=>window.copiedPrompt),commandText);
        await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Denied');}}}));
        await page.getByRole('button',{name:'Copy again',exact:true}).click();await page.getByRole('status').filter({hasText:'Select and copy'}).waitFor();
        assert.deepEqual(await page.locator('#agent-prompt').evaluate(e=>({focused:document.activeElement===e,start:e.selectionStart,end:e.selectionEnd})),{focused:true,start:0,end:commandText.length});
        await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
        await page.getByRole('button',{name:'Copy again',exact:true}).click();assert.equal(await page.locator('#agent-prompt').inputValue(),commandText);
        await page.getByText('Full instructions & privacy',{exact:true}).click();await page.locator('#full-prompt').waitFor({state:'visible'});
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,'Expanded instructions overflow');
        await page.getByRole('link',{name:'Plain text for agents',exact:true}).click();
        assert.equal((await page.locator('body').textContent()).trim(),promptText);
        assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
        receipts.push({engine,viewport,localAssets:true,previews:4,touchTargets:true,promptCopy:true,clipboardFallback:true,plainText:true,overflow:false});await context.close();
      }
      const context=await browser.newContext(),page=await context.newPage();await page.goto(base);
      // macOS WebKit's default Tab policy skips links; Option-Tab includes them.
      await page.keyboard.press(engine==='webkit'&&process.platform==='darwin'?'Alt+Tab':'Tab');
      assert.equal(await page.locator(':focus').textContent(),'Skip to the books');await page.keyboard.press('Enter');assert.ok(page.url().endsWith('#books'));await context.close();
      const noScript=await browser.newContext({javaScriptEnabled:false,viewport:{width:402,height:874}}),plainPage=await noScript.newPage();await plainPage.goto(base);
      assert.equal(await plainPage.locator('#agent-prompt').inputValue(),commandText);assert.equal(await plainPage.locator('#copy-prompt').isVisible(),false);
      assert.equal(await plainPage.locator('.reader').count(),4);await plainPage.getByText('Full instructions & privacy',{exact:true}).click();await plainPage.getByRole('link',{name:'Plain text for agents',exact:true}).click();assert.equal((await plainPage.locator('body').textContent()).trim(),promptText);await noScript.close();
    }finally{await browser.close();}
  }
  await writeFile(new URL('receipt.json',output),JSON.stringify({checkedAt:new Date().toISOString(),passed:true,receipts,limits:'Automated Chromium/WebKit layout, navigation and asset checks. Screenshots require visual review; emulation is not physical-device or screen-reader acceptance.'},null,2)+'\n');
  console.log(JSON.stringify({passed:true,viewports:receipts.length,engines:['chromium','webkit']}));
}finally{await new Promise(resolve=>server.close(resolve));}
