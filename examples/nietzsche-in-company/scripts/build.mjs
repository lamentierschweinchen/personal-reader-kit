import {readFile,writeFile,mkdir,rm,copyFile,lstat,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {KIT_VERSION,canonical} from '../site/bundle.mjs';
import {validateBook,anchorStatus} from '../site/core.mjs';
import {verifyInstallArtwork} from './install-artwork.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export const assets=['index.html','app.mjs','core.mjs','db.mjs','bundle.mjs','text.mjs','share.mjs','share-card.mjs','share-card.css','style.css','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png','robots.txt','company.css','company.mjs','reading-place.mjs','edition-copy.mjs'];
export async function verifiedEdition(){
  const manifest=JSON.parse(await readFile(path.join(root,'edition.json'),'utf8'));
  assert.equal(manifest.schema,1);assert.equal(manifest.profile,'personal-reader/text@1');
  assert.deepEqual(manifest.files.map(f=>f.path),['edition/library.json','edition/company.json']);
  const inputs={};
  for(const file of manifest.files){
    const input=path.join(root,file.path);assert.ok((await lstat(input)).isFile(),'Edition inputs must be regular files');
    inputs[path.basename(file.path)]=await readFile(input);
    assert.equal(digest(inputs[path.basename(file.path)]),file.sha256,'Edition bytes changed: '+file.path);
  }
  const books=JSON.parse(inputs['library.json']),company=JSON.parse(inputs['company.json']);
  assert.deepEqual(books.map(b=>b.id),['nietzsche','epicurus']);
  assert.deepEqual(manifest.books.map(b=>b.id),books.map(b=>b.id));
  for(const [i,book] of books.entries()){
    assert.deepEqual(validateBook(book),book,'The complete edition must fit text@1 without a lossy adapter');
    assert.equal(digest(canonical(book)),manifest.books[i].canonicalSha256,'Complete edition changed');
    assert.equal(book.source.sha256,manifest.books[i].sourceSha256);
    assert.equal(book.profile,manifest.profile);
  }
  assert.deepEqual(company.books.map(b=>b.id),books.map(b=>b.id));
  assert.deepEqual(company.encounters.map(e=>e.id),['still-water']);
  assert.deepEqual(Object.keys(company.sourcePins),books.map(b=>b.id));
  for(const book of books)assert.equal(company.sourcePins[book.id],book.source.sha256);
  const blockAt=ref=>books.find(b=>b.id===ref.book)?.sections.find(s=>s.id===ref.section)?.blocks.find(b=>b.id===ref.block);
  for(const item of company.encounters)for(const pair of [item.passages,item.alternate.passages])for(const passage of pair)assert.ok(anchorStatus(passage,books.find(b=>b.id===passage.bookId)).valid,'Comparison source changed');
  assert.deepEqual(Object.keys(company.locations),Array.from({length:383},(_,i)=>String(i+1)));
  for(const ref of Object.values(company.locations))assert.ok(blockAt(ref),'Aphorism locator is invalid');
  for(const ref of company.notes){const block=blockAt(ref);assert.ok(block&&Number.isInteger(ref.start)&&ref.start>=0&&ref.end>ref.start&&ref.end<=block.text.length,'Source-note link is invalid');if(ref.destination)assert.ok(blockAt(ref.destination),'Source-note destination is invalid');}
  return {books,company,inputs};
}
export async function build(){
  assert.equal(JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version,KIT_VERSION);
  await verifyInstallArtwork(root);
  const {books,inputs}=await verifiedEdition(),out=path.join(root,'dist');
  assert.equal(await realpath(root),path.resolve(root),'Build cannot traverse a symlinked project');
  try {const existing=await lstat(out);assert.ok(existing.isDirectory()&&!existing.isSymbolicLink(),'dist must be a real directory');}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const name of assets)assert.ok((await lstat(path.join(root,'site',name))).isFile(),'Build inputs must be regular files');
  await rm(out,{recursive:true,force:true});await mkdir(out);
  for(const name of assets)await copyFile(path.join(root,'site',name),path.join(out,name));
  for(const [name,bytes] of Object.entries(inputs))await writeFile(path.join(out,name),bytes);
  const files=[...assets,...Object.keys(inputs)],hash=createHash('sha256').update(await readFile(path.join(root,'vercel.json')));
  for(const name of files)hash.update(name).update(await readFile(path.join(out,name)));
  const version=hash.digest('hex').slice(0,16),application=await readFile(path.join(out,'app.mjs'),'utf8');
  assert.equal(application.split('__READER_BUILD__').length,2);
  await writeFile(path.join(out,'app.mjs'),application.replace('__READER_BUILD__',version));
  await writeFile(path.join(out,'sw.js'),`const CACHE='nietzsche-company-${version}';const FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('nietzsche-company-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});
`);
  const result={version,files:[...files,'sw.js'],personalBooksIncluded:false,localOnly:false,editionIds:books.map(b=>b.id)};console.log(JSON.stringify(result));return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await build();
