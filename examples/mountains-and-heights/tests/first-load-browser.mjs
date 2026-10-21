import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const playwright=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.resolve(process.env.REVIEW_OUTPUT||path.join(root,'.reader/first-load-review'));
const library=await readFile(path.join(root,'dist/library.json'));
const book=JSON.parse(library)[0],chapter=book.sections.find(s=>s.id==='chapter-02');
const hash=b=>createHash('sha256').update(b).digest('hex');
const build=JSON.parse(await readFile(path.join(root,'dist/build.json')));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
await mkdir(output,{recursive:true});
const results=[];
for(const [i,engine] of ['chromium','webkit'].entries()){
 const port=Number(process.env.TEST_PORT||4596)+i,base='http://127.0.0.1:'+port;
 const server=spawn(process.execPath,['scripts/serve.mjs','--no-build'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});
 let browser;
 try{
  let ready=false;
  for(let attempt=0;attempt<100;attempt++){try{ready=(await fetch(base)).ok;}catch{}if(ready)break;await pause(100);}
  assert.ok(ready,'Preview must start');
  browser=await playwright[engine].launch({headless:true,executablePath:engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage();
  page.setDefaultTimeout(30000);
  await page.addInitScript(()=>{
   const nativeFetch=window.fetch;
   window.fetch=async(...args)=>{
    const response=await nativeFetch(...args);
    if(String(args[0])==='/library.json')window.reviewLibraryHash=response.clone().arrayBuffer().then(async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join(''));
    return response;
   };
  });
  let requestedAt;let markRequested;
  const requested=new Promise(r=>{markRequested=r;});
  // Delay the actual edition response, with no cached book or worker to mask a timeout.
  await page.route('**/library.json',async route=>{requestedAt=Date.now();markRequested();await pause(9000);await route.continue();});
  const responsePromise=page.waitForResponse(r=>r.url()===base+'/library.json',{timeout:30000});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await requested;await pause(Math.max(0,8500-(Date.now()-requestedAt)));
  assert.ok(Date.now()-requestedAt>=8500);
  assert.equal(await page.locator('.loading').textContent(),'Opening the book…');
  assert.ok(!(await page.locator('body').textContent()).includes('could not be opened'));
  const response=await responsePromise;assert.equal(response.status(),200);
  await page.locator('.entrance-title').waitFor();
  assert.equal(await page.evaluate(()=>window.reviewLibraryHash),hash(library),'All illustrated edition bytes arrive unchanged');
  await page.goto(base+'/#read/'+book.id+'/'+chapter.id);
  await page.locator('#reading-text[data-position-ready="true"]').waitFor();
  await page.getByRole('button',{name:'Continue to reading',exact:true}).click();
  for(const block of chapter.blocks)assert.equal(await page.locator('#reading-text [data-block="'+block.id+'"]').textContent(),block.text);
  const image=page.locator('#reading-text img').first();
  await image.scrollIntoViewIfNeeded();
  await image.evaluate(async image=>{await image.decode();if(!image.naturalWidth)throw Error('Plate did not decode');});
  await page.screenshot({path:path.join(output,engine+'-delayed-first-load.png')});
  results.push({engine,version:build.version,delayMs:9000,visibleLoadingAfterMs:8500,libraryBytes:library.length,librarySha256:hash(library),completeChapterBlocks:chapter.blocks.length,plateDecoded:true});
  await context.close();
 }finally{if(browser)await browser.close();server.kill('SIGTERM');}
}
await writeFile(path.join(output,'results.json'),JSON.stringify({passed:true,results},null,2)+'\n');
console.log(JSON.stringify({passed:true,results}));
