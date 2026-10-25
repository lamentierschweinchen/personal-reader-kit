import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {buildShowcase} from './build.mjs';
import {editions,socialCards,socialMetadata,validateSocialCards} from './social.mjs';
import {serve} from './serve.mjs';

if(!process.argv.includes('--skip-build'))await buildShowcase();
await validateSocialCards();
const output=new URL('./dist/',import.meta.url),out=new URL('../test-results/social-previews/',import.meta.url);
await mkdir(out,{recursive:true});
const decode=s=>s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const routes=[{path:'library/',metadata:socialMetadata('library')}];
for(const b of editions){
 routes.push({path:b.id+'/',metadata:socialMetadata(b.id)},{path:`library/${b.id}/`,metadata:socialMetadata(b.id,{listing:true})});
 if(b.categories.includes('game'))routes.push({path:b.id+'/play/',metadata:{...socialMetadata(b.id),url:socialMetadata(b.id).url+'play/'},game:true});
}
function dimensions(bytes){
 assert.equal(bytes.readUInt16BE(0),0xffd8,'JPEG header');
 for(let i=2;i<bytes.length;){
  assert.equal(bytes[i++],0xff);let marker=bytes[i++];while(marker===0xff)marker=bytes[i++];
  const length=bytes.readUInt16BE(i);if([0xc0,0xc1,0xc2].includes(marker))return {width:bytes.readUInt16BE(i+5),height:bytes.readUInt16BE(i+3)};
  assert.ok(length>=2);i+=length;
 }
 throw Error('JPEG dimensions missing');
}
for(const card of Object.values(socialCards))assert.deepEqual(dimensions(await readFile(new URL(card.file,output))),{width:1200,height:630});
for(const {path,metadata,game} of routes){
 const html=await readFile(new URL(path+'index.html',output),'utf8'),head=html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)[1],tags={};
 for(const tag of head.matchAll(/<meta\b[^>]*>/gi)){
  const key=tag[0].match(/(?:property|name)="([^"]+)"/)?.[1],value=tag[0].match(/content="([^"]*)"/)?.[1];
  if(key?.startsWith('og:')||key?.startsWith('twitter:')){assert.equal(tags[key],undefined,path+' duplicate '+key);tags[key]=decode(value);}
 }
 assert.equal(tags['og:url'],metadata.url);assert.equal(tags['og:description'],metadata.description);
 assert.equal(tags['og:image'],metadata.image);assert.equal(tags['twitter:image'],metadata.image);
 assert.equal(tags['og:image:alt'],metadata.alt);assert.equal(tags['twitter:image:alt'],metadata.alt);
 assert.equal(tags['og:image:width'],'1200');assert.equal(tags['og:image:height'],'630');
 assert.equal(tags['og:image:type'],'image/jpeg');assert.equal(tags['og:type'],'website');
 assert.equal(tags['twitter:card'],'summary_large_image');assert.equal(tags['twitter:description'],metadata.description);
 assert.ok(tags['og:title']?.trim());assert.equal(tags['twitter:title'],tags['og:title']);
 if(!game)assert.equal(tags['og:title'],metadata.title);
 assert.equal(decode(head.match(/<link rel="canonical" href="([^"]+)"/)[1]),metadata.url);
}

const pw=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await serve(),base='http://127.0.0.1:'+server.address().port,layouts=[];
try{
 for(const engine of ['chromium','webkit']){
  const executablePath=engine==='chromium'?process.env.CHROME_PATH:process.env.WEBKIT_PATH;
  const browser=await pw[engine].launch({headless:true,...(executablePath?{executablePath}:{})});
  try{
   for(const width of [320,768]){
    const context=await browser.newContext({javaScriptEnabled:false,reducedMotion:'reduce',viewport:{width,height:900}}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    for(const b of editions){
     const response=await page.goto(`${base}/library/${b.id}/`);assert.equal(response.status(),200);
     await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));});
     assert.equal(await page.locator('h1').textContent(),b.title);
     assert.equal(await page.locator('.edition-description .button-dark').getAttribute('href'),`/${b.id}/`);
     await page.locator('.source-details summary').click();
     assert.equal(await page.locator('.source-details[open]').count(),1);
     const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length,small:[...document.querySelectorAll('a:not(.skip),summary')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})).filter(r=>r.w<44||r.h<44)}));
     assert.ok(metrics.scroll<=metrics.width,`${engine}/${width}/${b.id} overflow`);assert.equal(metrics.broken,0);assert.deepEqual(metrics.small,[],JSON.stringify(metrics.small));
     if(['pictures-after-dark','rome','two-halls'].includes(b.id))await page.screenshot({path:new URL(`${engine}-${width}-${b.id}.png`,out).pathname,fullPage:true});
     layouts.push({engine,width,id:b.id});
    }
    assert.deepEqual(errors,[]);await context.close();
   }
  }finally{await browser.close();}
 }
 await writeFile(new URL('receipt.json',out),JSON.stringify({checkedAt:new Date().toISOString(),passed:true,metadataRoutes:routes.length,images:Object.keys(socialCards).length,layouts,limits:'Static crawler metadata and Chromium/WebKit emulation. Social platform cache refresh and platform-side rendering are external.'},null,2)+'\n');
 console.log(JSON.stringify({passed:true,metadataRoutes:routes.length,images:Object.keys(socialCards).length,layouts:layouts.length}));
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
