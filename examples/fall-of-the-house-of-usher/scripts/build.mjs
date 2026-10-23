import {readFile,writeFile,mkdir,rm,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateBook,bookText} from '../site/core.mjs';
import {KIT_VERSION} from '../site/bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
export const assets=['index.html','app.mjs','usher.mjs','core.mjs','db.mjs','bundle.mjs','text.mjs','share.mjs','style.css','usher.css','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png','robots.txt','OFL-IMFell.txt','share-card.mjs','share-card.css'];
export const editionAssets=['library.json','beardsley.jpg','clarke.jpg'];
export const fonts=['im-fell-normal.woff2','im-fell-italic.woff2'];
export const outputFiles=[...assets,...editionAssets,...fonts,'build.json','sw.js'];
export async function build(){
 const lock=JSON.parse(await readFile(path.join(root,'edition-lock.json'))),config=await readFile(path.join(root,'vercel.json'));
 if(JSON.parse(await readFile(path.join(root,'package.json'))).version!==KIT_VERSION)throw Error('Package and reading-bundle versions differ.');
 const expected=[...editionAssets.map(n=>'edition/'+n),...fonts.map(n=>'site/'+n),...['OFL-IMFell.txt','apple-touch-icon.png','icon-192.png','icon-512.png'].map(n=>'site/'+n)].sort();
 if(JSON.stringify(lock.files.map(f=>f.path).sort())!==JSON.stringify(expected))throw Error('The exact reviewed edition asset list is required.');
 const inputs=[];
 // Preflight exact named files before replacing only this package’s dist.
 for(const name of [...assets,...editionAssets,...fonts]){
  const relative=(editionAssets.includes(name)?'edition/':'site/')+name,input=path.join(root,relative);
  if(!(await lstat(input)).isFile())throw Error('Build input must be a regular file: '+relative);
  const bytes=await readFile(input),pin=lock.files.find(f=>f.path===relative);
  if(pin&&(pin.name!==name||pin.bytes!==bytes.length||pin.sha256!==sha(bytes)))throw Error('Changed reviewed asset: '+relative);
  inputs.push({name,bytes});
 }
 const library=inputs.find(f=>f.name==='library.json').bytes,books=JSON.parse(library);
 if(books.length!==1)throw Error('The single complete Poe edition is required.');
 const book=validateBook(books[0]);
 if(book.id!==lock.bookId||book.source.sha256!==lock.witnessSha256||sha(library)!==lock.librarySha256||sha(bookText(book))!==book.source.sha256)throw Error('The exact reviewed story is required.');
 const fingerprint=createHash('sha256').update(config);for(const f of inputs)fingerprint.update(f.name).update(f.bytes);
 const version=fingerprint.digest('hex').slice(0,16),files=inputs.map(f=>f.name);
 const result={version,bookId:book.id,edition:lock.librarySha256,files:outputFiles,personalBooksIncluded:false,reviewedPublicDomainWorks:[book.id]};
 const worker=`const CACHE='usher-${version}',FILES=${JSON.stringify([...files,'build.json'].map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('usher-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;if(u.searchParams.has('network')){e.respondWith(fetch(e.request).catch(()=>new Response('Network unavailable',{status:503})));return;}const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});`;
 const out=path.join(root,'dist');await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
 for(const f of inputs)await writeFile(path.join(out,f.name),f.bytes);
 await writeFile(path.join(out,'build.json'),JSON.stringify(result)+'\n');await writeFile(path.join(out,'sw.js'),worker);
 console.log(JSON.stringify(result));return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await build();
