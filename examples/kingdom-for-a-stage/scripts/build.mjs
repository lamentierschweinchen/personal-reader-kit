import {readFile,writeFile,mkdir,rm,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {validateBook} from '../site/core.mjs';
import {canonical,KIT_VERSION} from '../site/bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const sourceCommit='6a10bd6d126422b46a7fdad709bacda531c0a9f4';
export const assets=['media.mjs','index.html','app.mjs','core.mjs','db.mjs','bundle.mjs','library.mjs','text.mjs','share.mjs','share-card.mjs','share-card.css','style.css','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png','robots.txt'];
export const editionFiles=['julius-caesar.json','henry-v.json','the-tempest.json'];
export const bookIds=['folger-julius-caesar','folger-henry-v','folger-the-tempest'];
export const outputFiles=[...assets,'library.json','sources/index.html','sw.js','build.json'];
export const pinnedInputs=[...assets.map(n=>'site/'+n),...editionFiles.map(n=>'edition/'+n),'sources/index.html','package.json','vercel.json'];
export const buildInputs=['package.json','vercel.json','edition-lock.json','scripts/build.mjs',...assets.map(n=>'site/'+n),...editionFiles.map(n=>'edition/'+n),'sources/index.html'];
async function regular(file){
 let current=root;const parts=file.split('/');
 for(const [i,part]of parts.entries()){
  current=path.join(current,part);const stat=await lstat(current);
  assert.ok(!stat.isSymbolicLink()&&(i===parts.length-1?stat.isFile():stat.isDirectory()),'Build inputs must be regular files without symlinks: '+file);
 }
 return readFile(current);
}
export async function verifiedEdition(){
 assert.equal(await realpath(root),path.resolve(root),'Build cannot traverse a symlinked project');
 const lock=JSON.parse(await regular('edition-lock.json'));assert.equal(lock.schema,1);assert.equal(lock.sourceCommit,sourceCommit);
 assert.deepEqual(lock.files.map(f=>f.path),pinnedInputs);assert.deepEqual(lock.bookIds,bookIds);
 const inputs=new Map();
 for(const file of lock.files){const bytes=await regular(file.path);assert.equal(bytes.length,file.bytes,'Reviewed size changed: '+file.path);assert.equal(sha(bytes),file.sha256,'Reviewed bytes changed: '+file.path);inputs.set(file.path,bytes);}
 assert.equal(JSON.parse(inputs.get('package.json')).version,KIT_VERSION,'Package and bundle versions differ');
 const books=editionFiles.map(name=>{const raw=JSON.parse(inputs.get('edition/'+name)),book=validateBook(raw);assert.deepEqual(book,raw,'Validation must retain the complete edition');return raw;});
 assert.deepEqual(books.map(b=>b.id),bookIds);assert.equal(lock.editions.length,books.length);
 for(const [i,book]of books.entries()){
  const pin=lock.editions[i];assert.equal(pin.id,book.id);assert.equal(pin.sourceSha256,book.source.sha256);assert.equal(pin.canonicalSha256,sha(canonical(book)));
  assert.equal(book.profile,'kingdom-for-a-stage/drama@1');assert.equal(book.source.format,'application/tei+xml');
  const notice=book.context.find(c=>c.label==='Edition, license and changes');assert.ok(notice&&notice.text.includes('Folger Digital Texts')&&notice.text.includes('https://creativecommons.org/licenses/by-nc/3.0/')&&notice.text.includes('Changes:'),'Complete Folger notice required');
 }
 const library=Buffer.from(JSON.stringify(books));assert.equal(sha(library),lock.librarySha256,'Reviewed library changed');
 const image=books[2].assets[0];assert.equal(books[0].assets.length,0);assert.equal(books[1].assets.length,0);assert.equal(books[2].assets.length,1);assert.equal(image.id,'miranda-1784');assert.equal(sha(Buffer.from(image.data,'base64')),lock.mirandaSha256);
 for(const [name,size]of [['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512]]){
  const bytes=inputs.get('site/'+name);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);
 }
 return {lock,inputs,books,library};
}
export async function build(){
 const {lock,inputs,books,library}=await verifiedEdition(),config=inputs.get('vercel.json'),out=path.join(root,'dist');
 try{const stat=await lstat(out);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink(),'dist must be a real directory');}catch(error){if(error.code!=='ENOENT')throw error;}
 const ready=new Map(assets.map(name=>[name,inputs.get('site/'+name)]));ready.set('library.json',library);ready.set('sources/index.html',inputs.get('sources/index.html'));
 const fingerprint=createHash('sha256').update(config);for(const[name,bytes]of ready)fingerprint.update(name).update(bytes);
 const version=fingerprint.digest('hex').slice(0,16),files=[...ready.keys()];
 const worker=`const CACHE='kingdom-for-a-stage-${version}';\nconst FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('kingdom-for-a-stage-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':['/sources','/sources/'].includes(u.pathname)?'/sources/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});
`;
 const result={version,files:outputFiles,personalBooksIncluded:false,editionIds:books.map(b=>b.id),sourceCommit,librarySha256:lock.librarySha256,rights:'Folger edited/encoded texts: CC BY-NC 3.0 Unported; reader code: MIT; Met image: CC0'};
 // Exact inputs, edition identities and output boundary are verified first.
 await rm(out,{recursive:true,force:true});await mkdir(path.join(out,'sources'),{recursive:true});
 for(const[name,bytes]of ready)await writeFile(path.join(out,name),bytes);
 await writeFile(path.join(out,'sw.js'),worker);await writeFile(path.join(out,'build.json'),JSON.stringify(result)+'\n');return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(await build()));
