import {readFile,writeFile,mkdir,rm,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {validateBook} from '../site/core.mjs';
import {canonical,KIT_VERSION} from '../site/bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
export const sourceCommit='e5d909ade3d28ef84bf5c359291596b243dee163';
export const assets=['index.html','edition-rights.mjs','app.mjs','core.mjs','db.mjs','bundle.mjs','library.mjs','text.mjs','share.mjs','share-card.mjs','share-card.css','style.css','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png','robots.txt','sources/index.html'];
export const bookIds=['erlkoenig-de','erlkoenig-en','lenore-de','lenore-en','handschuh-de','handschuh-en','taucher-de','taucher-en','kraniche-de','kraniche-en','iphigenie-de','iphigenie-en'];
export const editionFiles=bookIds.map(id=>id+'.json');
const lockedInputs=['package.json','vercel.json','scripts/build.mjs','scripts/serve.mjs','docs/SOURCE-RIGHTS.md',...assets.map(n=>'site/'+n),...editionFiles.map(n=>'edition/'+n)];
export const buildInputs=['edition-lock.json',...lockedInputs];
export const outputFiles=[...assets,'library.json','sw.js','build.json'];
async function regular(file){
 let current=root;for(const [i,part]of file.split('/').entries()){
  current=path.join(current,part);const stat=await lstat(current);
  assert.ok(!stat.isSymbolicLink()&&(i===file.split('/').length-1?stat.isFile():stat.isDirectory()),'Build inputs must be regular files without symlinks: '+file);
 }return readFile(current);
}
export async function verifiedEdition(){
 assert.equal(await realpath(root),path.resolve(root),'Build cannot traverse a symlinked project');
 const lock=JSON.parse(await regular('edition-lock.json'));assert.equal(lock.schema,1);assert.equal(lock.sourceCommit,sourceCommit);
 assert.deepEqual(lock.files.map(f=>f.path),lockedInputs);assert.deepEqual(lock.bookIds,bookIds);
 const inputs=new Map();for(const f of lock.files){const bytes=await regular(f.path);assert.equal(bytes.length,f.bytes,'Reviewed size changed: '+f.path);assert.equal(sha(bytes),f.sha256,'Reviewed bytes changed: '+f.path);inputs.set(f.path,bytes);}
 const books=editionFiles.map(n=>{const raw=JSON.parse(inputs.get('edition/'+n)),book=validateBook(raw);assert.deepEqual(book,raw,'Validation must preserve the complete edition object');return book;});
 assert.deepEqual(books.map(b=>b.id),bookIds);assert.deepEqual(books.map(b=>sha(canonical(b))),lock.canonicalBookSha256);
 const library=Buffer.from(JSON.stringify(books));assert.equal(sha(library),lock.librarySha256,'Reviewed library changed');
 const page=inputs.get('site/sources/index.html').toString();for(const id of bookIds)assert.ok(page.includes(`id="${id}"`),'Public source anchor missing: '+id);
 assert.ok(page.includes('THE FULL PROJECT GUTENBERG LICENSE'));assert.ok(page.includes('https://creativecommons.org/licenses/by-sa/4.0/'));
 return{lock,inputs,books,library};
}
export async function build(){
 const {inputs,books,library}=await verifiedEdition();assert.equal(JSON.parse(inputs.get('package.json')).version,KIT_VERSION);
 const out=path.join(root,'dist');try{const s=await lstat(out);assert.ok(s.isDirectory()&&!s.isSymbolicLink(),'dist must be a real directory');}catch(e){if(e.code!=='ENOENT')throw e;}
 const ready=new Map(assets.map(n=>[n,inputs.get('site/'+n)]));ready.set('library.json',library);
 const fingerprint=createHash('sha256').update(inputs.get('vercel.json'));for(const[n,b]of ready)fingerprint.update(n).update(b);const version=fingerprint.digest('hex').slice(0,16),files=[...ready.keys()];
 const worker=`const CACHE='ballads-and-a-play-${version}';\nconst FILES=${JSON.stringify(files.map(f=>'/'+f))};\nself.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));\nself.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('ballads-and-a-play-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));\nself.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':['/sources/','/sources'].includes(u.pathname)?'/sources/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});\nself.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});\n`;
 const result={version,files:outputFiles,personalBooksIncluded:false,editionIds:books.map(b=>b.id),sourceCommit};
 // All source/runtime identities are verified before any existing output changes.
 await rm(out,{recursive:true,force:true});await mkdir(out);for(const[n,b]of ready){await mkdir(path.dirname(path.join(out,n)),{recursive:true});await writeFile(path.join(out,n),b);}await writeFile(path.join(out,'sw.js'),worker);await writeFile(path.join(out,'build.json'),JSON.stringify(result)+'\n');return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(await build()));
