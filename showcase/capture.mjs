import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

// Fresh, empty profiles; only the four already-public example sites.
// Output stays ignored until the previews are visually reviewed and hash-pinned.
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=new URL('../test-results/showcase-previews/',import.meta.url);
await mkdir(output,{recursive:true});
const targets=[
  {id:'austen',url:'https://austen.lookatseel.com/',ready:'.edition-intro'},
  {id:'alice',url:'https://alice.lookatseel.com/',ready:'.edition-drawing img'},
  {id:'walden',url:'https://walden.lookatseel.com/',ready:'.pond-survey img'},
  {id:'two-halls',url:'https://two-halls.lookatseel.com/',ready:'.hall-entrance[data-hall="schopenhauer"]',width:600}
];
const browser=await pw.chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const receipts=[];
try{
  for(const target of targets){
    const width=target.width||480,height=width*1.25;
    const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:2,reducedMotion:'reduce'}),page=await context.newPage();
    try{
      await page.goto(target.url);await page.locator('#main').waitFor();
      await page.locator(target.ready).waitFor({state:'visible'});
      if(target.id==='alice'){
        await page.waitForFunction(()=>document.body.dataset.editionReady==='true');
        if(await page.locator('#dialog[open]').count()){assert.equal(await page.locator('#dialog-title').textContent(),'Source edition notice');await page.getByRole('button',{name:'Close ×',exact:true}).click();}
      }
      await page.waitForFunction(()=>!document.querySelector('#main .loading'));
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));await Promise.allSettled(document.getAnimations().filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));});
      assert.equal(await page.locator('#dialog[open]').count(),0);
      const state=await page.evaluate(async()=>await(await import('/db.mjs')).loadState());assert.equal(state.notes.length,0);assert.deepEqual(state.positions,{});
      // A consistent 4:5 viewport onto the actual entrance, without browser chrome.
      const top=await page.locator('#main').evaluate(e=>e.getBoundingClientRect().top+scrollY);
      await page.screenshot({path:fileURLToPath(new URL(target.id+'-preview.jpg',output)),type:'jpeg',quality:88,clip:{x:0,y:top,width,height},animations:'disabled'});
      receipts.push({id:target.id,url:target.url,capturedAt:new Date().toISOString(),source:'Public reader entrance; fresh profile; no notes or reading records',pixels:[width*2,height*2],crop:{x:0,y:top,width,height}});
      console.log(target.id+' captured');
    }finally{await context.close();}
  }
  await writeFile(new URL('receipt.json',output),JSON.stringify(receipts,null,2)+'\n');
}finally{await browser.close();}
