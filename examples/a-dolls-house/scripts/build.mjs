// Exact owner-approved edition; raw archives and private records are not inputs.
import {readFile,writeFile,mkdir,rm,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {validateBook} from '../site/core.mjs';
import {KIT_VERSION} from '../site/bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
export const assets=["index.html","app.mjs","core.mjs","db.mjs","bundle.mjs","library.mjs","text.mjs","share.mjs","share-card.mjs","share-card.css","style.css","manifest.webmanifest","icon.svg","apple-touch-icon.png","icon-192.png","icon-512.png","robots.txt","play.mjs"];
export const editionAssets=[];
export const buildInputs=['package.json','vercel.json','edition-lock.json','scripts/build.mjs',...assets.map(f=>'site/'+f),'edition/book.json',...editionAssets.map(f=>'edition/'+f)];
export const outputFiles=[...assets,'library.json',...editionAssets,'build.json','sw.js'];
async function regular(relative){let current=root;const parts=relative.split('/');for(const[i,part]of parts.entries()){current=path.join(current,part);const info=await lstat(current);assert.ok(!info.isSymbolicLink()&&(i===parts.length-1?info.isFile():info.isDirectory()),'Regular reviewed input required: '+relative);}return readFile(current);}
export async function build(){
 assert.equal(await realpath(root),path.resolve(root),'Project must not traverse a symlink');
 const lock=JSON.parse(await regular('edition-lock.json'));
 assert.equal(lock.schema,1);assert.equal(lock.sourceCommit,'011efdb414a6bc83dee2fa7b1ac7646adf7b5475');
 assert.deepEqual(lock.files.map(f=>f.path),[...assets.map(f=>'site/'+f),'edition/book.json',...editionAssets.map(f=>'edition/'+f)]);
 assert.equal(JSON.parse(await regular('package.json')).version,KIT_VERSION);
 const inputs=new Map();for(const f of lock.files){const b=await regular(f.path);assert.equal(b.length,f.bytes,'Size changed: '+f.path);assert.equal(sha(b),f.sha256,'Reviewed input changed: '+f.path);inputs.set(f.path,b);}
 const raw=JSON.parse(inputs.get('edition/book.json')),book=validateBook(raw);assert.deepEqual(book,raw,'Complete edition metadata must survive');assert.equal(book.id,lock.bookId);assert.equal(book.source.sha256,lock.sourceSha256);
 const library=Buffer.from(JSON.stringify([book]));assert.equal(sha(library),lock.librarySha256,'Reviewed edition changed');
 const ready=new Map(assets.map(f=>[f,inputs.get('site/'+f)]));ready.set('library.json',library);for(const f of editionAssets)ready.set(f,inputs.get('edition/'+f));
 const h=createHash('sha256').update(await regular('vercel.json'));for(const[n,b]of ready)h.update(n).update(b);const version=h.digest('hex').slice(0,16),files=[...ready.keys()];
 const result={version,files:outputFiles,sourceCommit:lock.sourceCommit,editionIds:[book.id],personalBooksIncluded:false};
 const worker=`const PREFIX='a-dolls-house-',CACHE=PREFIX+'${version}',FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith(PREFIX)&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});`;
 const output=path.join(root,'dist');try{const info=await lstat(output);assert.ok(info.isDirectory()&&!info.isSymbolicLink(),'Output must be a real directory');}catch(e){if(e.code!=='ENOENT')throw e;}
 await rm(output,{recursive:true,force:true});await mkdir(output);
 for(const[n,b]of ready)await writeFile(path.join(output,n),b);await writeFile(path.join(output,'sw.js'),worker);await writeFile(path.join(output,'build.json'),JSON.stringify(result)+'\n');return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(await build()));
