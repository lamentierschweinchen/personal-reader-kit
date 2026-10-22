// Bounded, local-only network verification against the downloaded provider script.
// HTTPS requests are intercepted; this check never contacts production or a provider.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {serve} from './serve.mjs';
import {buildShowcase} from './build.mjs';
import {PUBLIC_EDITIONS,PROVIDER_INTEGRITY} from './analytics.mjs';
const root=new URL('../',import.meta.url),out=new URL('.reader/analytics-2026-10-22/',root);
await mkdir(out,{recursive:true});
const integrityOnly=process.argv.includes('--integrity-only');
if(!integrityOnly&&!process.argv.includes('--skip-build'))await buildShowcase();
const integrationSource=integrityOnly?await readFile(new URL('showcase/analytics.mjs',root),'utf8'):null;
const vendorBytes=await readFile(process.env.ANALYTICS_VENDOR_SCRIPT||new URL('vendor-script.js',out));
const providerSha256=createHash('sha256').update(vendorBytes).digest('hex');
assert.equal(providerSha256,'050e35bf7e6e96590f2a9de114c14ff792806ed28457b3248762944350c0ba4c','Provider script changed: review its payload and privacy behavior before updating this pin');
assert.equal(PROVIDER_INTEGRITY,'sha256-'+createHash('sha256').update(vendorBytes).digest('base64'),'Runtime SRI pin must match reviewed provider bytes');
const vendor=vendorBytes.toString('utf8');
assert.ok(vendor.includes('disableAutoTrack')&&vendor.includes('beforeSend'),'Use the reviewed real provider script');
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await serve(),base='http://127.0.0.1:'+server.address().port,site='https://newreading.app';
const receipts=[],sentinel='ANALYTICS_PRIVATE_SENTINEL_20261022';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check,label){for(let i=0;i<100;i++){if(await check())return;await pause(20);}throw Error('Timed out: '+label);}
function assertBodies(bodies){
  const raw=JSON.stringify(bodies);assert.ok(!raw.includes(sentinel),'No private sentinel reaches a provider body');
  for(const body of bodies){
    assert.ok(Object.keys(body).every(key=>['o','sv','r','en','ed'].includes(key)),'No attribution, identity or arbitrary flags');
    assert.ok(!new URL(body.o).search&&!new URL(body.o).hash,'Canonical body URL');
    assert.ok(!body.ed||Object.keys(body.ed).length<=2,'At most two fixed properties');
  }
}
async function fixture(browser,{hostname='newreading.app',dnt=null,gpc=false,webdriver=false,offline=false,referrer='',failed=false,failedCollection=false,delayProvider=false,attribution=false,flags=false,blockedStorage=false,integrityMismatch=false}={}){
  const context=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce',viewport:{width:1000,height:900},userAgent:'Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'});
  await context.addInitScript(({dnt,gpc,webdriver,referrer,offline,attribution,blockedStorage,sentinel})=>{
    if(attribution)localStorage.setItem('__va_attribution',JSON.stringify({userId:sentinel,traits:{private:sentinel}}));
    if(blockedStorage)Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Denied','SecurityError');}});
    if(offline)Object.defineProperty(navigator,'onLine',{configurable:true,value:false});
    Object.defineProperty(navigator,'webdriver',{configurable:true,value:webdriver});
    Object.defineProperty(navigator,'doNotTrack',{configurable:true,value:dnt});
    Object.defineProperty(navigator,'globalPrivacyControl',{configurable:true,value:gpc});
    Object.defineProperty(document,'referrer',{configurable:true,value:referrer});
  },{dnt,gpc,webdriver,referrer,offline,attribution,blockedStorage,sentinel});
  const bodies=[],resources=[],errors=[];
  let releaseVendor;const vendorReady=delayProvider?new Promise(resolve=>{releaseVendor=resolve;}):Promise.resolve();
  await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());resources.push(url.pathname);
    if(url.hostname!==hostname){await route.abort();return;}
    if(url.pathname==='/_vercel/insights/script.js'){
      await vendorReady;
      if(failed){await route.abort('failed');return;}
      await route.fulfill({contentType:'text/javascript',body:integrityMismatch?vendor+'\n// Deliberately unreviewed integrity fixture.\n':vendor});return;
    }
    if(url.pathname.startsWith('/_vercel/insights/')){
      assert.equal(request.method(),'POST');bodies.push(JSON.parse(request.postData()));
      await route.fulfill({status:failedCollection?400:200,contentType:'application/json',body:'{}'});return;
    }
    if(integrityOnly&&url.pathname==='/analytics.mjs'){await route.fulfill({contentType:'text/javascript',body:integrationSource});return;}
    let path=url.pathname;
    if(['/unknown/','/private/'].includes(path))path='/';
    const response=await fetch(base+path+url.search);
    const headers=Object.fromEntries(response.headers);for(const key of ['connection','content-length','transfer-encoding','content-encoding'])delete headers[key];
    let body=Buffer.from(await response.arrayBuffer());
    if(flags&&headers['content-type']?.includes('text/html'))body=Buffer.from(body.toString().replace('</body>',`<div data-flag-values="${sentinel}"></div></body>`));
    await route.fulfill({status:response.status,headers,body});
  });
  // WebKit refuses even intercepted navigation while network emulation is offline.
  // Startup exclusion uses onLine=false; the worker test below uses a real outage.
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  return {context,page,bodies,resources,errors,releaseVendor,url:path=>'https://'+hostname+path};
}
try{
 for(const engine of ['chromium','webkit']){
  const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
  const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  try{
    if(integrityOnly){
      let f=await fixture(browser);await f.page.goto(f.url('/'));await until(()=>f.bodies.length===1,'matching integrity provider');
      assert.equal(await f.page.locator('script[src="/_vercel/insights/script.js"]').getAttribute('integrity'),PROVIDER_INTEGRITY);
      assertBodies(f.bodies);assert.deepEqual(f.errors,[]);await f.context.close();
      f=await fixture(browser,{integrityMismatch:true});await f.page.goto(f.url('/austen/#read/austen-pride-1894/chapter-1'));
      await f.page.locator('#reading-text[data-position-ready="true"] [data-block]').first().waitFor();await pause(100);
      assert.equal(f.resources.filter(path=>path==='/_vercel/insights/script.js').length,1,'No integrity-failure retries');
      assert.equal(await f.page.evaluate(()=>!!window.vai),false,'Mismatched provider never executes');assert.equal(f.bodies.length,0);assert.deepEqual(f.errors,[]);await f.context.close();
      receipts.push({engine,passed:true,matchingIntegrity:true,mismatchedIntegrityBlocked:true,readerRenderedWithoutProvider:true});continue;
    }
    // Actual SDK bytes, actual UI copy path and provider network bodies, including query/hash.
    let f=await fixture(browser);await f.page.goto(f.url('/?private='+sentinel+'#'+sentinel));
    await until(()=>f.bodies.length===1,'initial pageview');
    assert.deepEqual(f.bodies[0].o,site+'/');
    let nativeClipboard=false;
    if(engine==='chromium'){
      await f.context.grantPermissions(['clipboard-read','clipboard-write'],{origin:site});nativeClipboard=true;
    }else await f.page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}}));
    await f.page.locator('#book').fill(sentinel);await f.page.locator('#idea').fill(sentinel+' original private idea');
    await f.page.locator('[data-copy="personal"]').click();
    await until(()=>f.bodies.some(body=>body.en==='prompt_copy'&&body.ed.outcome==='copied'),'successful prompt copy');
    if(nativeClipboard)assert.ok((await f.page.evaluate(()=>navigator.clipboard.readText())).includes(sentinel),'Actual clipboard contains maker draft, analytics does not');
    await f.page.locator('[data-copy="personal"]').click();await pause(40);
    assert.equal(f.bodies.filter(body=>body.en==='prompt_copy'&&body.ed.outcome==='copied').length,1,'Duplicate successes are bounded per page');
    await f.page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Denied');}}}));
    await f.page.locator('[data-copy="personal"]').click();await f.page.locator('.fallback[open]').waitFor();
    await until(()=>f.bodies.some(body=>body.en==='prompt_copy'&&body.ed.outcome==='fallback'),'manual fallback event');
    assertBodies(f.bodies);assert.deepEqual(f.errors,[]);await f.context.close();

    // A stale clipboard promise must not be reported as success.
    f=await fixture(browser);await f.page.goto(f.url('/'));
    await f.page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>new Promise(resolve=>{window.finishAnalyticsCopy=resolve;})}}));
    await f.page.locator('[data-copy="personal"]').click();await f.page.locator('#idea').fill(sentinel);await f.page.evaluate(()=>window.finishAnalyticsCopy());
    await f.page.waitForFunction(()=>!document.querySelector('[data-copy="personal"]').hasAttribute('aria-busy'));await pause(50);
    assert.equal(f.bodies.some(body=>body.en==='prompt_copy'),false);await f.context.close();

    // Library search never leaves the page; successful previews use only the public enum.
    f=await fixture(browser);await f.page.goto(f.url('/library/?search='+sentinel+'#'+sentinel));
    await f.page.locator('#search').fill(sentinel);await f.page.locator('#search').fill('');
    await f.page.locator('[data-preview="alice"]').click();await f.page.locator('#edition-dialog[open]').waitFor();
    await until(()=>f.bodies.some(body=>body.en==='edition_preview'),'library preview');assertBodies(f.bodies);
    await f.page.evaluate(()=>{
      for(const detail of [{name:'prompt_copy',outcome:'copied',secret:'BAD'},{name:'edition_preview',edition:'private-import'},{name:'unknown',edition:'alice'}])document.dispatchEvent(new CustomEvent('newreading:analytics',{detail}));
      window.va('event',{name:'bad-event',data:{page:'library',secret:'BAD'}});
      window.va('event',{name:'edition_preview',data:{page:'library',edition:'alice',secret:'BAD'}});
    });await pause(50);assert.equal(f.bodies.filter(body=>body.en).length,1,'Unknown events/properties rejected');await f.context.close();

    // Every public root and the three game entrances has only a canonical pageview.
    for(const path of ['/learn/',...PUBLIC_EDITIONS.map(id=>`/${id}/`),'/alice/play/','/odyssey/play/','/dracula/play/']){
      f=await fixture(browser);await f.page.goto(f.url(path+'?private='+sentinel+'#'+sentinel));
      await until(()=>f.bodies.length>0,'public path '+path);assert.equal(f.bodies[0].o,site+path);assertBodies(f.bodies);await f.context.close();
    }

    // Privacy preferences and unmeasurable referrers never load the SDK.
    for(const options of [{hostname:'preview.vercel.app'},{hostname:'read.lookatseel.com'},{dnt:'1'},{gpc:true},{webdriver:true},{offline:true},{referrer:'https://example.com/private/'+sentinel},{referrer:'https://example.com/?private='+sentinel},{referrer:'https://NEWREADING.APP/private/'+sentinel},{attribution:true},{flags:true},{blockedStorage:true}]){
      f=await fixture(browser,options);await f.page.goto(f.url('/'));await pause(100);
      assert.equal(f.resources.includes('/_vercel/insights/script.js'),false,JSON.stringify(options));assert.equal(f.bodies.length,0);await f.context.close();
    }
    for(const path of ['/unknown/','/privacy/','/personal/']){
      f=await fixture(browser);await f.page.goto(f.url(path));await pause(70);assert.equal(f.resources.includes('/_vercel/insights/script.js'),false,path);assert.equal(f.bodies.length,0);await f.context.close();
    }
    for(const referrer of ['https://example.com/',site+'/private/?secret='+sentinel]){
      f=await fixture(browser,{referrer});await f.page.goto(f.url('/'));await until(()=>f.bodies.length===1,'safe referrer');assertBodies(f.bodies);
      assert.equal(f.bodies[0].r,referrer.startsWith(site)?undefined:referrer);await f.context.close();
    }

    // Provider failure cannot block actual reading. The public edition is rendered independently.
    f=await fixture(browser,{failed:true});await f.page.goto(f.url('/austen/#read/austen-pride-1894/chapter-1'));
    await f.page.locator('#reading-text[data-position-ready="true"] [data-block]').first().waitFor();
    await pause(100);assert.equal(f.resources.filter(path=>path==='/_vercel/insights/script.js').length,1);assert.equal(f.bodies.length,0);assert.deepEqual(f.errors,[]);await f.context.close();

    // A pending queue is discarded if the visit ends or disconnects before a late SDK arrives.
    for(const ending of ['pagehide','offline','timeout']){
      f=await fixture(browser,{delayProvider:true});if(ending==='timeout')await f.page.clock.install();await f.page.goto(f.url('/'),{waitUntil:'domcontentloaded'});
      await f.page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{}}}));
      await f.page.locator('[data-copy="personal"]').click();
      if(ending==='timeout')await f.page.clock.fastForward(6100);else await f.page.evaluate(type=>window.dispatchEvent(new Event(type)),ending);
      f.releaseVendor();await until(()=>f.page.evaluate(()=>window.vai===true),'late provider load');await pause(60);
      assert.equal(f.bodies.length,0,'No queued sends after '+ending);
      await f.page.locator('[data-copy="personal"]').click();await pause(40);assert.equal(f.bodies.length,0,'Stopped listeners never resume');await f.context.close();
    }

    f=await fixture(browser,{failedCollection:true});await f.page.goto(f.url('/'));
    await until(()=>f.bodies.length===1,'rejected collection request');await pause(100);
    assert.equal(f.resources.filter(path=>path==='/_vercel/insights/view').length,1,'No collection retries');assert.deepEqual(f.errors,[]);await f.context.close();

    // Genuine public rendered-view dwell; imports with private IDs never trigger that signal.
    f=await fixture(browser);await f.page.clock.install();
    await f.page.goto(f.url('/austen/#read/austen-pride-1894/chapter-1'));
    await f.page.locator('#reading-text[data-position-ready="true"] [data-block]').first().waitFor();
    await f.page.clock.fastForward(12000);assert.equal(f.bodies.some(body=>body.en==='reading_visible_30s'),false);
    await f.page.locator('[data-action="settings"]').click();await f.page.locator('#dialog[open]').waitFor();
    await f.page.clock.fastForward(35000);assert.equal(f.bodies.some(body=>body.en==='reading_visible_30s'),false,'A settings dialog pauses visibility');
    await f.page.locator('#dialog [data-action="close"]').click();await f.page.clock.fastForward(19000);
    await until(()=>f.bodies.some(body=>body.en==='reading_visible_30s'),'public accumulated visible reading interval');
    assert.equal(f.bodies.filter(body=>body.en==='reading_visible_30s').length,1);assertBodies(f.bodies);await f.context.close();

    f=await fixture(browser);await f.page.clock.install();await f.page.goto(f.url('/austen/'));
    await f.page.locator('.austen-shelf').waitFor();await f.page.locator('[data-action="import"]').click();
    await f.page.locator('#book-file').setInputFiles({name:sentinel+'.txt',mimeType:'text/plain',buffer:Buffer.from('An original sentence for a private local import.\nAnother original sentence.')});
    await f.page.locator('#book-title').fill(sentinel);await f.page.locator('#import-form button[type="submit"]').click();
    await f.page.locator('.austen-shelf .book-row [data-action="resume"]').click();
    await f.page.locator('#reading-text[data-position-ready="true"] [data-block]').first().waitFor();
    assert.ok(!(await f.page.locator('#reading-text').getAttribute('data-book')).includes('austen-pride-1894'));
    await f.page.clock.fastForward(31000);await pause(50);assert.equal(f.bodies.some(body=>body.en==='reading_visible_30s'),false);assertBodies(f.bodies);await f.context.close();

    // A real worker cache must reopen a reader while the independent module is unavailable.
    const workerServer=await serve(),workerBase='http://127.0.0.1:'+workerServer.address().port;
    const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1000,height:900}}),page=await context.newPage();
    try{
    await page.goto(workerBase+'/austen/#read/austen-pride-1894/chapter-1');
    await page.locator('#reading-text[data-position-ready="true"] [data-block]').first().waitFor();
    await page.waitForFunction(()=>document.querySelector('#offline-status').textContent.includes('Available offline'));
    await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();await page.locator('#reading-text[data-position-ready="true"] [data-block]').first().waitFor();
    const cacheProof=await page.evaluate(async()=>{const keys=await caches.keys();return (await Promise.all(keys.map(async key=>{const c=await caches.open(key);return (await c.keys()).map(r=>new URL(r.url).pathname);}))).flat();});
    assert.ok(!cacheProof.includes('/analytics.mjs'),'Analytics is outside required offline cache');
    await new Promise(resolve=>workerServer.close(resolve));await page.reload();await page.locator('#reading-text[data-position-ready="true"] [data-block]').first().waitFor();
    assert.equal(await page.evaluate(async()=>{try{await fetch('/analytics.mjs',{cache:'no-store'});return false;}catch{return true;}}),true,'Raw module network negative control');
    }finally{await context.close();if(workerServer.listening)await new Promise(resolve=>workerServer.close(resolve));}
    receipts.push({engine,passed:true,publicReaderRoots:PUBLIC_EDITIONS.length,gameVisits:3,nativeClipboard,limits:engine==='webkit'?'Clipboard outcome paths use API stubs; no physical device or recipient testing.':'Native browser clipboard used for successful copy; failure/stale paths use API stubs.'});
  }finally{await browser.close();}
 }
 await writeFile(new URL(integrityOnly?'integrity-receipt.json':'browser-receipt.json',out),JSON.stringify({passed:true,providerSha256,receipts,limits:'Local intercepted HTTPS and real provider script. No provider activation, usage-cost acceptance, production deployment or external network delivery was performed.'},null,2)+'\n');
 console.log(JSON.stringify({passed:true,providerSha256,receipts}));
}finally{await new Promise(resolve=>server.close(resolve));}
