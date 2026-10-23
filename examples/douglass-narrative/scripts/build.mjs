import {readFile,writeFile,mkdir,rm,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {validateBook} from '../site/core.mjs';
import {canonical,KIT_VERSION} from '../site/bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const assets=['index.html','app.mjs','core.mjs','db.mjs','bundle.mjs','library.mjs','text.mjs','share.mjs','share-card.mjs','share-card.css','style.css','edition.css','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png','robots.txt','document-profile.mjs','edition-binding.mjs'];
export const editionFiles=['douglass-1845.json','bingham-dialogue-1817.json','douglass-escape-1881.json','fugitive-act-1793.json','escape-editorial.json','portrait.jpg'];
export const outputFiles=[...assets,'library.json','portrait.jpg','sw.js','build.json'];
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
  const lock=JSON.parse(await regular('edition-lock.json'));
  assert.equal(lock.schema,1);assert.equal(lock.sourceCommit,'f33475ec50181f05193661a1f7d38ff3a7f7c64b');
  assert.deepEqual(lock.files.map(f=>f.path),[...assets.map(f=>'site/'+f),...editionFiles.map(f=>'edition/'+f)]);
  assert.deepEqual(lock.bookIds,['douglass-1845','bingham-dialogue-1817','douglass-escape-1881','fugitive-act-1793']);
  const inputs=new Map();
  for(const file of lock.files){
    const bytes=await regular(file.path);assert.equal(bytes.length,file.bytes,'Reviewed size changed: '+file.path);assert.equal(sha(bytes),file.sha256,'Reviewed bytes changed: '+file.path);inputs.set(file.path,bytes);
  }
  const books=editionFiles.slice(0,4).map(name=>{
    const raw=JSON.parse(inputs.get('edition/'+name)),book=validateBook(raw);assert.deepEqual(book,raw,'Edition validation must preserve the complete object');return book;
  });
  assert.deepEqual(books.map(b=>b.id),lock.bookIds);
  const library=Buffer.from(JSON.stringify(books));assert.equal(sha(library),lock.librarySha256,'Reviewed library changed');
  const bindingBytes=inputs.get('site/edition-binding.mjs');assert.equal(sha(bindingBytes),lock.bindingSha256);
  const match=bindingBytes.toString().match(/^export const editionBinding=(\{[\s\S]*\});\s*$/);assert.ok(match,'Exact generated binding required');
  const binding=JSON.parse(match[1]);assert.equal(binding.bookId,books[0].id);assert.equal(binding.bookSha256,sha(canonical(books[0])));
  assert.deepEqual(binding.references.map(r=>r.id),lock.bookIds.slice(1));
  for(const [i,reference]of binding.references.entries()){
    assert.equal(reference.sha256,sha(canonical(books[i+1])));
    const block=books[0].sections.find(s=>s.id===reference.sectionId)?.blocks.find(b=>b.id===reference.blockId);assert.ok(block,'Reviewed source anchor missing');assert.equal(reference.anchorSha256,sha(block.text));
  }
  const editorial=JSON.parse(inputs.get('edition/escape-editorial.json')),selection=editorial.excerpt;
  assert.deepEqual(binding.references[1].excerpt,Object.fromEntries(['sectionId','blockId','start','end','sha256'].map(key=>[key,selection[key]])));
  const block=books[2].sections.find(s=>s.id===selection.sectionId)?.blocks.find(b=>b.id===selection.blockId);assert.ok(block);
  const splits=n=>n>0&&n<block.text.length&&/[\uD800-\uDBFF]/.test(block.text[n-1])&&/[\uDC00-\uDFFF]/.test(block.text[n]);
  assert.ok(Number.isInteger(selection.start)&&Number.isInteger(selection.end)&&selection.start>=0&&selection.end<=block.text.length&&selection.start<selection.end&&!splits(selection.start)&&!splits(selection.end),'Reviewed excerpt range is invalid');
  assert.equal(sha(block.text.slice(selection.start,selection.end)),selection.sha256);assert.equal(block.text.slice(selection.start,selection.end),selection.text);
  const comparison=editorial.comparison1845,reference=binding.references[1];
  assert.deepEqual({bookId:books[0].id,sectionId:reference.sectionId,blockId:reference.blockId,...reference.quote},Object.fromEntries(['bookId','sectionId','blockId','start','end'].map(k=>[k,comparison[k]])));
  assert.equal(books[0].sections.find(s=>s.id===reference.sectionId).blocks.find(b=>b.id===reference.blockId).text.slice(reference.quote.start,reference.quote.end),comparison.text);
  const portrait=books[0].assets.find(a=>a.id==='douglfp');assert.ok(portrait);assert.deepEqual(inputs.get('edition/portrait.jpg'),Buffer.from(portrait.data,'base64'),'Catalogue portrait must preserve the exact embedded source JPEG');
  return{lock,inputs,books,binding,library};
}
export async function build(){
  assert.equal(JSON.parse(await regular('package.json')).version,KIT_VERSION);
  const config=await regular('vercel.json'),{inputs,books,library}=await verifiedEdition(),out=path.join(root,'dist');
  try{const stat=await lstat(out);assert.ok(stat.isDirectory()&&!stat.isSymbolicLink(),'dist must be a real directory');}catch(error){if(error.code!=='ENOENT')throw error;}
  const ready=new Map(assets.map(name=>[name,inputs.get('site/'+name)]));ready.set('library.json',library);ready.set('portrait.jpg',inputs.get('edition/portrait.jpg'));
  const fingerprint=createHash('sha256').update(config);for(const[name,bytes]of ready)fingerprint.update(name).update(bytes);
  const version=fingerprint.digest('hex').slice(0,16),files=[...ready.keys()];
  const worker=`const CACHE='douglass-narrative-${version}';\nconst FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('douglass-narrative-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});
`;
  const result={version,files:outputFiles,personalBooksIncluded:false,editionIds:books.map(b=>b.id),sourceCommit:'f33475ec50181f05193661a1f7d38ff3a7f7c64b'};
  // Every input and reviewed identity is checked before replacing generated output.
  await rm(out,{recursive:true,force:true});await mkdir(out);
  for(const[name,bytes]of ready)await writeFile(path.join(out,name),bytes);
  await writeFile(path.join(out,'sw.js'),worker);await writeFile(path.join(out,'build.json'),JSON.stringify(result)+'\n');return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(await build()));
