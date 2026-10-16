import {readFile,writeFile,mkdir,rm,copyFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {KIT_VERSION} from '../site/bundle.mjs';
import {validateBook,bookText} from '../site/core.mjs';
const root = fileURLToPath(new URL('../',import.meta.url));
export const assets = ['index.html','app.mjs','core.mjs','db.mjs','bundle.mjs','text.mjs','share.mjs','style.css','manifest.webmanifest','icon.svg','robots.txt'];
export async function build() {
  const packageVersion=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
  if(packageVersion!==KIT_VERSION)throw new Error('Package and portable-bundle application versions differ.');
  const manifest = JSON.parse(await readFile(path.join(root,'publication.json'),'utf8'));
  const sample = await readFile(path.join(root,'samples/library.json'));
  if (createHash('sha256').update(sample).digest('hex') !== manifest.originalSampleSha256) throw new Error('Original sample content changed. Review its provenance and exact bytes before updating the publication manifest.');
  for (const b of JSON.parse(sample)) {
    const book = validateBook(b);
    if (book.source.format !== 'original' || createHash('sha256').update(bookText(book)).digest('hex') !== book.source.sha256) throw new Error('Only verified original sample writing can enter this public build.');
  }
  const out = path.join(root,'dist');await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
  for (const name of assets) {
    const input = path.join(root,'site',name);
    if (!(await lstat(input)).isFile()) throw new Error('Build inputs must be regular files.');
    await copyFile(input,path.join(out,name));
  }
  await writeFile(path.join(out,'library.json'),sample);
  const files = [...assets,'library.json'];
  const hash = createHash('sha256').update(await readFile(path.join(root,'vercel.json')));
  for (const name of files) hash.update(name).update(await readFile(path.join(out,name)));
  const version = hash.digest('hex').slice(0,16);
  await writeFile(path.join(out,'sw.js'),`const CACHE='reading-kit-${version}';
const FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('reading-kit-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});
`);
  const result = {version,files:[...files,'sw.js'],personalBooksIncluded:false};console.log(JSON.stringify(result));return result;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
