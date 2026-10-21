import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const playwright=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),output=path.resolve(process.env.REVIEW_OUTPUT||path.join(root,'.reader/notice-review'));
await mkdir(output,{recursive:true});
const original=JSON.parse(await readFile(path.join(root,'edition/library.json'))),book=original[0],licence=book.sections.at(-1).blocks[0].text;
const start=licence.indexOf('This eBook is for the use of anyone anywhere',licence.indexOf('1.E.1.')),notice=licence.slice(start,licence.indexOf('\n\n1.E.2.',start));
async function poll(fn){for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Origin not ready');}
const results=[];
for(const [i,engine] of ['chromium','webkit'].entries()){
 const port=Number(process.env.TEST_PORT||4594)+i,base='http://127.0.0.1:'+port,server=spawn(process.execPath,['scripts/serve.mjs','--no-build'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:'ignore'});let browser;
 try{
  await poll(async()=>{try{return(await fetch(base)).ok;}catch{return false;}});
  browser=await playwright[engine].launch({headless:true,executablePath:engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH});
  const context=await browser.newContext({viewport:{width:390,height:844}}),p=await context.newPage();
  await p.goto(base+'/#read/'+book.id+'/chapter-02');await p.locator('[data-edition-notice]').waitFor();assert.equal(await p.locator('[data-edition-notice]').textContent(),notice);
  await p.screenshot({path:path.join(output,engine+'-first-notice.png')});
  await p.getByRole('button',{name:/Full Gutenberg licence/}).click();await p.locator('#context-text[data-location-ready="true"]').waitFor();assert.equal(await p.locator('#context-text').textContent(),book.sections.at(-1).blocks.map(b=>b.text+b.after).join(''));
  await p.locator('[data-action="dialog-back"]').click();assert.equal(await p.locator('[data-edition-notice]').textContent(),notice);await p.getByRole('button',{name:'Continue to reading',exact:true}).click();
  await p.reload();await p.locator('#reading-text[data-position-ready="true"]').waitFor();assert.equal(await p.locator('[data-edition-notice]').count(),0);
  await p.goto(base+'/#read/'+book.id+'/chapter-03');await p.locator('#reading-text[data-section="chapter-03"][data-position-ready="true"]').waitFor();assert.equal(await p.locator('[data-edition-notice]').count(),0);
  await p.locator('[data-action="background"]').click();await p.locator('.source-notice-link').click();await p.locator('#context-text[data-location-ready="true"]').waitFor();assert.equal(await p.locator('#context-text').textContent(),book.sections.at(-1).blocks.map(b=>b.text+b.after).join(''));await context.close();
  for(const changed of [false,true]){
   const c=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),q=await c.newPage();await q.route('**/experience.json',r=>r.fulfill({status:503,body:'Unavailable'}));
   if(changed){const altered=structuredClone(original);altered[0].context[0].text='Original synthetic changed-context fixture.';await q.route('**/library.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(altered)}));}
   await q.goto(base+'/#read/'+book.id+'/chapter-02');await q.locator('#reading-text[data-position-ready="true"]').waitFor();
   if(!changed){await q.locator('[data-edition-notice]').waitFor();await q.getByRole('button',{name:'Continue to reading',exact:true}).click();}else assert.equal(await q.locator('[data-edition-notice]').count(),0);
   await q.locator('[data-action="background"]').click();const text=await q.locator('#dialog').textContent();
   if(changed)assert.ok(text.includes('Original synthetic changed-context fixture.'));else{assert.ok(text.includes('Other countries may differ.'));assert.ok(!text.includes('no publication or wider audience has been authorized'));}
   await q.screenshot({path:path.join(output,engine+(changed?'-changed-context':'-missing-companion')+'.png')});await c.close();
  }
  results.push({engine,exactNotice:true,immediateFullLicenceAndBack:true,rememberedAcrossReloadAndChapter:true,laterSourceAccess:true,missingCompanionFallback:true,changedEditionContextRetained:true});
 }finally{server.kill('SIGTERM');if(browser)await browser.close();}
}
await writeFile(path.join(output,'results.json'),JSON.stringify({passed:true,results},null,2)+'\n');
