import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {preview,appReady,dismissNotice,sourceNoticeCheck,watch,policyWatch,assertClean} from './harness.mjs';
const require=createRequire(import.meta.url),pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),out=path.join(root,'test-results/reader');await mkdir(out,{recursive:true});
const book=JSON.parse(await readFile(path.join(root,'edition/library.json')))[0],apparatus=JSON.parse(await readFile(path.join(root,'edition/companion.json')));
const text=s=>s.blocks.map(b=>b.text+b.after).join(''),receipts=[],origin=await preview(),base=origin.url;
async function state(p){return p.evaluate(async()=>(await import('/db.mjs')).loadState());}
async function ready(p,id){await appReady(p);await p.locator(`#reading-text[data-section="${id}"][data-position-ready="true"]`).waitFor();assert.equal(await p.locator('#reading-text').textContent(),text(book.sections.find(s=>s.id===id)));}
async function settled(p){await p.evaluate(async()=>{await document.fonts.ready;await Promise.allSettled(document.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));const scope=document.querySelector('dialog[open]')||document;await Promise.all([...scope.querySelectorAll('img')].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0;}).map(i=>{i.loading='eager';return i.decode();}));});}
async function capture(p,name){await settled(p);await p.mouse.move(0,0);await p.screenshot({path:path.join(out,name+'.png')});}
async function close(p){await p.locator('#dialog [data-action="close"]').click();await p.locator('#dialog').waitFor({state:'hidden'});if(await p.locator('#reading-text').count())await p.locator('#reading-text[data-position-ready="true"]').waitFor();}
async function select(p){return p.evaluate(()=>{const blocks=[...document.querySelectorAll('#reading-text [data-block]')],point=(el,offset)=>{const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){if(offset<=n.length)return[n,offset];offset-=n.length;}throw Error('Missing exact selection offset');},r=document.createRange();r.setStart(...point(blocks[0],10));r.setEnd(...point(blocks[1],50));getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'));return r.toString();});}
async function save(p,note){await p.locator('#selection-save').click();await p.locator('#note-text').fill(note);await p.locator('#note-form [type="submit"]').click();await p.locator('#dialog').waitFor({state:'hidden'});}
async function noOverflow(p){assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
async function visibleClick(p,selector){const r=await p.locator(selector).boundingBox();assert.ok(r&&r.y>=0&&r.y+r.height<=p.viewportSize().height,'Control is already in view: '+selector);await p.mouse.click(r.x+r.width/2,r.y+r.height/2);}
try{
  for(const denied of ['/.git/config','/.reader/prepared/library.json','/edition/library.json','/site/app.mjs','/README.md','/source-cover.jpg'])assert.equal((await fetch(base+denied)).status,404,denied);
  for(const engine of (process.env.QA_ENGINE||'chromium,webkit').split(',')){
    const executablePath=engine==='chromium'?process.env.CHROMIUM_PATH:process.env.WEBKIT_PATH;
    const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',acceptDownloads:true}),observed=watch(context);await policyWatch(context);
    const p=await context.newPage(),record={engine,version:browser.version(),build:JSON.parse(await readFile(path.join(root,'dist/build.json'))),checks:[]};
    try{
      await p.goto(base);await appReady(p);await p.locator('#first-source-notice').waitFor();
      for(const [width,height]of [[390,844],[320,568]]){await p.setViewportSize({width,height});await noOverflow(p);await capture(p,`${engine}-first-notice-${width}`);const targets=await p.locator('.source-notice-actions button').evaluateAll(ns=>ns.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));assert.ok(targets.every(t=>t.w>=44&&t.h>=44));}
      await p.setViewportSize({width:390,height:844});await sourceNoticeCheck(p);
      assert.equal(await p.locator('#source-notice-memory').isVisible(),false);
      record.checks.push('Exact source notice, immediate full offline licence, 44px controls at 320/390, dismissal and remembered unchanged edition after reload.');
      for(const [name,width,height]of [['phone',390,844],['tablet',768,1024],['desktop',1440,1000]]){await p.setViewportSize({width,height});await noOverflow(p);await capture(p,`${engine}-${name}-entrance`);}
      await p.setViewportSize({width:390,height:844});await p.locator('.begin-reading').click();await ready(p,book.sections[0].id);
      assert.equal(await p.locator('#first-source-notice').count(),0);
      const rendered=await p.evaluate(async sections=>{const {renderText}=await import('/text.mjs'),node=document.createElement('article');return sections.map(s=>{renderText(node,s);return node.textContent;});},book.sections);assert.deepEqual(rendered,book.sections.map(text));
      assert.equal(await p.evaluate(()=>document.fonts.check('21px Literata')),true);
      await p.locator('[data-action="contents"]').click();assert.equal(await p.locator('.book-contents details').count(),17);assert.equal(await p.locator('.book-contents a').count(),365);await close(p);
      const quote=await select(p);await save(p,'Original public-package test note.');const saved=(await state(p)).notes;assert.equal(saved.length,1);assert.equal(saved[0].quote,quote);assert.equal(saved[0].segments.length,2);
      await p.reload();await ready(p,book.sections[0].id);assert.deepEqual((await state(p)).notes,saved);assert.equal(await p.locator('#first-source-notice').count(),0);
      record.checks.push('All 365 renderer sections are exact; 17 contents groups, local font, multi-block selection, save/reload and source notice persistence preserve the novel and notes.');

      const chapter='part-02-chapter-20';await p.goto(base+`/#read/${book.id}/${chapter}`);await ready(p,chapter);await p.mouse.wheel(0,700);await p.waitForTimeout(400);const place=(await state(p)).positions[book.id];
      await visibleClick(p,'[data-action="at-hand"]');await p.locator('#dialog [data-action="reveal-picture"]').click();assert.equal(await p.locator('.picture-viewport').count(),0);
      await p.locator('[data-action="allow-picture"]').click();await p.locator('.picture-viewport img').evaluate(i=>i.decode());
      assert.deepEqual(await p.locator('.picture-caption>p.companion-reading').allTextContents(),apparatus.pictures[0].caption);
      assert.equal(await p.locator('.picture-caption h3').count(),0);await capture(p,`${engine}-picture-caption`);
      await p.locator('[data-action="picture-context"]').click();await p.locator('#context-text[data-location-ready="true"]').waitFor();assert.equal(await p.locator('#context-text').textContent(),text(book.sections.find(s=>s.id===chapter)));await close(p);assert.deepEqual((await state(p)).positions[book.id],place);
      await visibleClick(p,'[data-nav="companion"]');await p.locator('.plate-list figure').first().waitFor();assert.equal(await p.locator('.plate-list figure').count(),1);
      await p.locator('[data-action="boundaries"]').click();await p.locator('#boundaries-form').waitFor();
      for(const width of [320,390]){await p.setViewportSize({width,height:width===320?568:844});assert.ok(await p.locator('#dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1));await capture(p,`${engine}-scope-${width}`);}
      await p.getByRole('button',{name:'Show all pictures',exact:true}).click();await p.waitForFunction(()=>document.querySelectorAll('.plate-list figure').length===11);assert.equal(await p.locator('.plate-list figure').count(),11);
      for(const picture of apparatus.pictures){await p.locator(`[data-picture="${picture.id}"]`).click();await p.locator('.picture-viewport img').evaluate(i=>i.decode());assert.deepEqual(await p.locator('.picture-caption>p.companion-reading').allTextContents(),picture.caption);assert.match(await p.locator('.picture-caption').textContent(),/State Public Historical Library, Moscow/);await close(p);}
      await p.locator('.return-reading').click();await ready(p,chapter);assert.deepEqual((await state(p)).positions[book.id],place);
      await p.locator('[data-action="edition-about"]').first().click();assert.ok((await p.locator('#source-notices').textContent()).includes('FULL PROJECT GUTENBERG LICENSE'));assert.equal(await p.locator('img[src*="source-cover"]').count(),0);assert.equal(await p.locator('a[href="/Literata-OFL.txt"]').count(),1);await close(p);
      record.checks.push('Picture consent, all eleven scene images/corrected captions and source credits, 320/390 scope controls and exact main-place return survive public packaging; uncertain decorative cover is absent.');
      await assertClean(p,observed);

      const failing=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),failedObserved=watch(failing);await policyWatch(failing);
      await failing.addInitScript(()=>{const put=Storage.prototype.setItem;Storage.prototype.setItem=function(key,...rest){if(key.startsWith('war-and-peace-maude:source-notice:'))throw new DOMException('Original synthetic preference failure','QuotaExceededError');return put.call(this,key,...rest);};});
      const fp=await failing.newPage();await fp.goto(base+`/#read/${book.id}/${book.sections[0].id}`);await ready(fp,book.sections[0].id);await fp.locator('#source-notice-memory').waitFor({state:'visible'});assert.equal(await fp.locator('#first-source-notice').count(),1);await dismissNotice(fp);
      const failedQuote=await select(fp);await save(fp,'Reading survives unavailable notice preferences.');const failedSaved=(await state(fp)).notes;assert.equal(failedSaved[0].quote,failedQuote);
      await fp.reload();await ready(fp,book.sections[0].id);assert.equal(await fp.locator('#first-source-notice').count(),1);assert.deepEqual((await state(fp)).notes,failedSaved);await assertClean(fp,failedObserved);await failing.close();
      record.checks.push('Synthetic localStorage failure reports inability to remember the notice, allows dismissal, and preserves an exact saved note across reload; no false durable preference claim.');

      // A genuinely different restored source revision must get its own notice.
      const changed=structuredClone(book);changed.source.sha256='9'.repeat(64);changed.edition='Original recovery test revision';
      await p.evaluate(async b=>{await(await import('/db.mjs')).saveBook(b);},changed);await p.reload();await appReady(p);await p.locator('#first-source-notice').waitFor();assert.equal(await p.locator('#first-source-notice').getAttribute('data-notice-key'),'war-and-peace-maude:source-notice:v1:'+'9'.repeat(64));
      assert.deepEqual((await state(p)).notes,saved);assert.deepEqual((await p.evaluate(async()=>(await import('/db.mjs')).loadBooks())).books,[changed]);
      await dismissNotice(p);await p.reload();await appReady(p);assert.equal(await p.locator('#first-source-notice').count(),0);await assertClean(p,observed);
      record.checks.push('A different restored source revision has a separate remembered notice; its exact text and existing records remain intact and receive no incompatible image apparatus.');
      record.pageErrors=observed.errors;record.externalRequests=observed.external;record.passed=true;
    }catch(error){record.passed=false;record.error=error.stack;await capture(p,`${engine}-FAIL`).catch(()=>{});throw error;}
    finally{receipts.push(record);await writeFile(path.join(out,'receipt.json'),JSON.stringify(receipts,null,2)+'\n');await browser.close();}
  }
}finally{await origin.close();}
console.log(JSON.stringify(receipts.map(r=>({engine:r.engine,passed:r.passed,checks:r.checks.length})),null,2));
