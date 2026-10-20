import {readFile,writeFile,mkdir,rm,copyFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {KIT_VERSION} from '../site/bundle.mjs';
import {validateBook,bookText} from '../site/core.mjs';
const root = fileURLToPath(new URL('../',import.meta.url));
export const assets = ['index.html','app.mjs','core.mjs','db.mjs','bundle.mjs','text.mjs','share.mjs','share-card.mjs','share-card.css','style.css','manifest.webmanifest','icon.svg','robots.txt','assets.mjs','table.mjs','table.svg','newsreader-normal.woff2','newsreader-italic.woff2','newsreader-OFL.txt'];
export async function build({shell=false,output=path.join(root,'dist')}={}) {
  const packageVersion=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
  if(packageVersion!==KIT_VERSION)throw new Error('Package and portable-bundle application versions differ.');
  const manifest = JSON.parse(await readFile(path.join(root,'publication.json'),'utf8'));
  const sample = await readFile(path.join(root,'samples/library.json'));
  if (createHash('sha256').update(sample).digest('hex') !== manifest.originalSampleSha256) throw new Error('Original sample content changed. Review its provenance and exact bytes before updating the publication manifest.');
  for (const b of JSON.parse(sample)) {
    const book = validateBook(b);
    if (book.source.format !== 'original' || createHash('sha256').update(bookText(book)).digest('hex') !== book.source.sha256) throw new Error('Only verified original sample writing can enter this public build.');
  }
  const out = output instanceof URL ? fileURLToPath(output) : path.resolve(output);await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
  for (const name of assets) {
    const input = path.join(root,'site',name);
    if (!(await lstat(input)).isFile()) throw new Error('Build inputs must be regular files.');
    if(name.endsWith('.woff2')){const bytes=await readFile(input),pin=(manifest.reviewedFontFiles||[]).find(f=>f.path==='site/'+name&&f.sha256===createHash('sha256').update(bytes).digest('hex'));if(!pin||bytes.subarray(0,4).toString()!=='wOF2'||createHash('sha256').update(await readFile(path.join(root,pin.license))).digest('hex')!==pin.licenseSha256)throw new Error('Font bytes or licence differ from their exact publication pins.');}
    await copyFile(input,path.join(out,name));
  }
  const library=shell?sample:await readFile(path.join(root,'edition/library.json'));
  if(!shell){const pin=JSON.parse(await readFile(path.join(root,'edition/manifest.json'),'utf8'));if(createHash('sha256').update(library).digest('hex')!==pin.librarySha256)throw new Error('Prepared collection bytes differ from their fidelity manifest.');}
  const collection=JSON.parse(library).map(validateBook);
  if(!shell&&collection.map(b=>b.id).join('|')!=='savarin|beeton|estes')throw new Error('Expected the three prepared At Table editions.');
  await writeFile(path.join(out,'library.json'),library);
  const files = [...assets,'library.json'];
  const hash = createHash('sha256').update(await readFile(path.join(root,'vercel.json')));
  for (const name of files) hash.update(name).update(await readFile(path.join(out,name)));
  const version = hash.digest('hex').slice(0,16);
  await writeFile(path.join(out,'sw.js'),`const CACHE='at-table-${version}';
const FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('at-table-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});
`);
  if(!shell){const inventory=[];for(const name of [...files,'sw.js']){const data=await readFile(path.join(out,name));inventory.push({name,size:data.length,sha256:createHash('sha256').update(data).digest('hex')});}await mkdir(path.join(root,'.reader/reports'),{recursive:true});await writeFile(path.join(root,'.reader/reports/release-inventory.json'),JSON.stringify({version,profile:'at-table/illustrated@1',localOnly:true,files:inventory},null,2));}
  const result = {version,files:[...files,'sw.js'],personalBooksIncluded:false,reviewedBooksIncluded:!shell};console.log(JSON.stringify(result));return result;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await build({shell:process.env.READER_SHELL==='1'});
