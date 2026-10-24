import{readFile,writeFile,mkdir,rm,lstat,realpath}from'node:fs/promises';
import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';import path from'node:path';import assert from'node:assert/strict';
import{validateBook}from'../site/core.mjs';import{canonical,KIT_VERSION}from'../site/bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
export const sourceCommit='1739dcae5c975ac3297f3f8cbcc7b43f0ac53a88';
export const bookIds=['caesar-vii-en','caesar-vii-la','augustus-en','augustus-la','marcus-ii-iii-en','marcus-ii-iii-grc','sallust-51','tacitus-annals-1','pliny-trajan'];
export const assets=['media.mjs','roman.mjs','index.html','app.mjs','core.mjs','db.mjs','bundle.mjs','library.mjs','text.mjs','share.mjs','share-card.mjs','share-card.css','style.css','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png','robots.txt','sources/index.html'];
export const editionFiles=bookIds.map(id=>id+'.json');
export const outputFiles=[...assets,'library.json','sw.js','build.json'];
export const buildInputs=['package.json','vercel.json','edition-lock.json','scripts/build.mjs',...assets.map(f=>'site/'+f),...editionFiles.map(f=>'edition/'+f)];
async function regular(file){
 let current=root;const parts=file.split('/');
 for(const[i,part]of parts.entries()){assert.ok(part&&part!=='.'&&part!=='..','Unsafe build input');current=path.join(current,part);const stat=await lstat(current);assert.ok(!stat.isSymbolicLink()&&(i===parts.length-1?stat.isFile():stat.isDirectory()),'Build inputs must be regular files without symlinks: '+file);}
 return readFile(current);
}
const assetPins=books=>books.flatMap(book=>(book.assets||[]).map(a=>({bookId:book.id,id:a.id,type:a.type,sha256:a.sha256,bytes:Buffer.from(a.data,'base64').length,width:a.width,height:a.height,alt:a.alt,credit:a.credit})));
export async function verifiedEdition(){
 assert.equal(await realpath(root),path.resolve(root),'Build cannot traverse a symlinked project');
 const lock=JSON.parse(await regular('edition-lock.json'));assert.equal(lock.schema,1);assert.equal(lock.sourceCommit,sourceCommit);assert.deepEqual(lock.bookIds,bookIds);
 assert.deepEqual(lock.files.map(f=>f.path),[...assets.map(f=>'site/'+f),...editionFiles.map(f=>'edition/'+f)]);
 const inputs=new Map();
 for(const f of lock.files){const bytes=await regular(f.path);assert.equal(bytes.length,f.bytes,'Reviewed size changed: '+f.path);assert.equal(sha(bytes),f.sha256,'Reviewed bytes changed: '+f.path);inputs.set(f.path,bytes);}
 const books=editionFiles.map(f=>{const raw=JSON.parse(inputs.get('edition/'+f)),book=validateBook(raw);assert.deepEqual(book,raw,'Validation must preserve the complete edition');return book;});
 assert.deepEqual(books.map(b=>b.id),bookIds);
 assert.deepEqual(books.map(b=>({id:b.id,canonicalSha256:sha(canonical(b)),sourceSha256:b.source.sha256,sections:b.sections.length,blocks:b.sections.reduce((n,s)=>n+s.blocks.length,0)})),lock.books);
 const embeddedAssets=assetPins(books);assert.deepEqual(embeddedAssets,lock.embeddedAssets);
 for(const b of books)for(const a of b.assets||[])assert.equal(sha(Buffer.from(a.data,'base64')),a.sha256,'Embedded image differs from reviewed bytes');
 const source=inputs.get('site/sources/index.html').toString();for(const anchor of ['caesar-latin','marcus-greek'])assert.ok(source.includes('id="'+anchor+'"'),'Required public source/license anchor missing');assert.ok(source.includes('https://creativecommons.org/licenses/by-sa/4.0/'));
 const library=Buffer.from(JSON.stringify(books));assert.equal(sha(library),lock.librarySha256,'Reviewed library changed');return{lock,inputs,books,library,embeddedAssets};
}
export async function build(){
 assert.equal(JSON.parse(await regular('package.json')).version,KIT_VERSION);
 const config=await regular('vercel.json'),{inputs,books,library}=await verifiedEdition(),out=path.join(root,'dist');
 try{const stat=await lstat(out);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink(),'dist must be a real directory');}catch(error){if(error.code!=='ENOENT')throw error;}
 const ready=new Map(assets.map(name=>[name,inputs.get('site/'+name)]));ready.set('library.json',library);
 const hash=createHash('sha256').update(config);for(const[name,bytes]of ready)hash.update(name).update(bytes);const version=hash.digest('hex').slice(0,16),files=[...ready.keys()];
 const worker=`const CACHE='caesar-and-the-emperors-${version}';\nconst FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('caesar-and-the-emperors-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':e.request.mode==='navigate'&&['/sources','/sources/'].includes(u.pathname)?'/sources/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});
`;
 const result={version,files:outputFiles,personalBooksIncluded:false,editionIds:books.map(b=>b.id),sourceCommit};
 // All reviewed input bytes and identities have passed before output replacement.
 await rm(out,{recursive:true,force:true});await mkdir(out);
 for(const[name,bytes]of ready){await mkdir(path.dirname(path.join(out,name)),{recursive:true});await writeFile(path.join(out,name),bytes);}
 await writeFile(path.join(out,'sw.js'),worker);await writeFile(path.join(out,'build.json'),JSON.stringify(result)+'\n');return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(await build()));
