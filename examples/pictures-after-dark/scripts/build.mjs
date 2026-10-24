import {readFile,writeFile,mkdir,rm,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {validateBook} from '../site/core.mjs';
import {KIT_VERSION} from '../site/bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
export const assets=["index.html", "folio-rights.mjs", "folio-assets.mjs", "folio.mjs", "app.mjs", "core.mjs", "db.mjs", "bundle.mjs", "library.mjs", "text.mjs", "share.mjs", "share-card.mjs", "share-card.css", "style.css", "manifest.webmanifest", "icon.svg", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "robots.txt", "sources/index.html"];
export const editionFiles=["fr.json", "en.json"];
export const supplements=["folio.json", "callot.jpg", "hugo-burg.jpg", "merrill-10.jpg", "merrill-15.jpg", "merrill-16.jpg", "merrill-17.jpg", "merrill-18.jpg", "merrill-21.jpg", "merrill-22.jpg", "merrill-28.jpg", "merrill-29.jpg", "merrill-7.jpg", "merrill-8.jpg", "merrill-9.jpg"];
export const sourceCommit="4d1820346a3cf1e135a16dcdc0814b0978e87493";
export const bookIds=["pictures-fr", "pictures-en"];
export const buildInputs=['package.json','vercel.json','edition-lock.json','scripts/build.mjs','site/core.mjs','site/folio-assets.mjs','site/bundle.mjs',...assets.map(f=>'site/'+f),...editionFiles.map(f=>'edition/'+f),...supplements.map(f=>'edition/'+f)];
export const outputFiles=[...assets,'library.json',...supplements,'sw.js','build.json'];
async function regular(file){let cur=root;const parts=file.split('/');for(const[i,p]of parts.entries()){assert.ok(p&&p!=='.'&&p!=='..');cur=path.join(cur,p);const s=await lstat(cur);assert.ok(!s.isSymbolicLink()&&(i===parts.length-1?s.isFile():s.isDirectory()),'Regular reviewed input required: '+file);}return readFile(cur);}
export async function verifiedEdition(){
 assert.equal(await realpath(root),path.resolve(root));
 const lock=JSON.parse(await regular('edition-lock.json'));assert.equal(lock.schema,1);assert.equal(lock.sourceCommit,sourceCommit);assert.deepEqual(lock.bookIds,bookIds);
 const expected=['package.json','vercel.json',...assets.map(f=>'site/'+f),...editionFiles.map(f=>'edition/'+f),...supplements.map(f=>'edition/'+f)];assert.deepEqual(lock.files.map(f=>f.path),expected);
 const inputs=new Map();for(const f of lock.files){const bytes=await regular(f.path);assert.equal(bytes.length,f.bytes,'Changed size: '+f.path);assert.equal(sha(bytes),f.sha256,'Changed reviewed input: '+f.path);inputs.set(f.path,bytes);}
 const books=editionFiles.map(f=>{const raw=JSON.parse(inputs.get('edition/'+f)),v=validateBook(raw);assert.deepEqual(v,raw,'Validation changed the exact edition');return raw;});assert.deepEqual(books.map(b=>b.id),bookIds);
 const library=Buffer.from(JSON.stringify(books));assert.equal(sha(library),lock.librarySha256);
 const folio=JSON.parse(inputs.get('edition/folio.json'));assert.equal(folio.kind,'pictures-after-dark@1');
 for(const b of books){assert.equal(b.sections.length,8);assert.equal(b.assets.length,12);for(const a of b.assets){const bytes=inputs.get('edition/'+a.id+'.jpg');assert.ok(bytes);assert.equal(sha(bytes),a.sha256);assert.deepEqual(bytes,Buffer.from(a.data.replace(/^data:image\/jpeg;base64,/,''),'base64'));}}
 return{lock,inputs,books,library};
}
export async function build(){
 const {inputs,books,library}=await verifiedEdition();assert.equal(JSON.parse(inputs.get('package.json')).version,KIT_VERSION);
 const out=path.join(root,'dist');try{const st=await lstat(out);assert.ok(st.isDirectory()&&!st.isSymbolicLink());}catch(e){if(e.code!=='ENOENT')throw e;}
 const ready=new Map(assets.map(f=>[f,inputs.get('site/'+f)]));ready.set('library.json',library);for(const f of supplements)ready.set(f,inputs.get('edition/'+f));
 const hash=createHash('sha256').update(inputs.get('vercel.json'));for(const[n,b]of ready)hash.update(n).update(b);const version=hash.digest('hex').slice(0,16),files=[...ready.keys()];
 const worker=`const PREFIX='pictures-after-dark-',CACHE=PREFIX+'${version}';\nconst FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith(PREFIX)&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':e.request.mode==='navigate'&&u.pathname==='/sources/'?'/sources/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});
`;
 const result={version,files:outputFiles,personalBooksIncluded:false,editionIds:books.map(b=>b.id),sourceCommit};
 await rm(out,{recursive:true,force:true});await mkdir(out);for(const[n,b]of ready){await mkdir(path.dirname(path.join(out,n)),{recursive:true});await writeFile(path.join(out,n),b);}await writeFile(path.join(out,'sw.js'),worker);await writeFile(path.join(out,'build.json'),JSON.stringify(result)+'\n');return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(await build()));
