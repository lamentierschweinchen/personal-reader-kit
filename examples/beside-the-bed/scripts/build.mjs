import {readFile,writeFile,mkdir,rm,copyFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {KIT_VERSION} from '../site/bundle.mjs';
import {validateBook,bookText} from '../site/core.mjs';
const root = fileURLToPath(new URL('../',import.meta.url));
export const assets = ['index.html','app.mjs','core.mjs','db.mjs','bundle.mjs','notices.mjs','text.mjs','share.mjs','share-card.mjs','share-card.css','style.css','collection.css','studies.mjs','cover.svg','bitter-normal.woff2','bitter-italic.woff2','OFL.txt','manifest.webmanifest','icon.svg','robots.txt'];
export async function build({output='dist',outputDir=output}={}) {
  if(path.isAbsolute(outputDir)||outputDir.split(/[\\/]/).includes('..'))throw new Error('Build output must stay inside this project.');
  const packageVersion=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
  if(packageVersion!==KIT_VERSION)throw new Error('Package and portable-bundle application versions differ.');
  const manifest = JSON.parse(await readFile(path.join(root,'publication.json'),'utf8'));
  const local = true; // Explicit reviewed public collection.
  const sample = await readFile(path.join(root,'samples/library.json'));
  if (createHash('sha256').update(sample).digest('hex') !== manifest.originalSampleSha256) throw new Error('Original sample content changed. Review its provenance and exact bytes before updating the publication manifest.');
  for (const b of JSON.parse(sample)) {
    const book = validateBook(b);
    if (book.source.format !== 'original' || createHash('sha256').update(bookText(book)).digest('hex') !== book.source.sha256) throw new Error('Only verified original sample writing can enter this public build.');
  }
  const out = path.join(root,outputDir);await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
  for (const name of assets) {
    const input = path.join(root,'site',name);
    if (!(await lstat(input)).isFile()) throw new Error('Build inputs must be regular files.');
    await copyFile(input,path.join(out,name));
  }
  const pins=JSON.parse(await readFile(path.join(root,'edition/inventory.json'),'utf8'));for(const [name,pin]of Object.entries(pins.files)){const data=await readFile(path.join(root,'edition',name));if(createHash('sha256').update(data).digest('hex')!==pin)throw new Error('Reviewed edition input changed: '+name);}
  let library = sample;
  const privateFiles = ['studies.json','sources.json','notices.json'];
  if(local) {
    library = await readFile(path.join(root,'edition/library.json'));
    for(const book of JSON.parse(library))validateBook(book);
    for(const name of privateFiles)await copyFile(path.join(root,'edition',name),path.join(out,name));
  }
  await writeFile(path.join(out,'library.json'),library);
  const files = [...assets,'library.json',...(local?privateFiles:[])];
  const hash = createHash('sha256').update('optional-data-cache@3').update(await readFile(path.join(root,'vercel.json')));
  for (const name of files) hash.update(name).update(await readFile(path.join(out,name)));
  const version = hash.digest('hex').slice(0,16);
  await writeFile(path.join(out,'sw.js'),`const CACHE='beside-the-bed-${version}';
const FILES=${JSON.stringify(files.map(f=>'/'+f))};
const SHELL=${JSON.stringify(assets.map(f=>'/'+f))};
// A recovered library must still open offline if the old edition endpoints are
// absent at this origin. Full-collection readiness below still requires all FILES.
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(async c=>{await c.addAll(SHELL);await Promise.all(FILES.filter(f=>!SHELL.includes(f)).map(async f=>{const r=await fetch(f,{cache:'reload'});if(r.ok)await c.put(f,r);else{await r.arrayBuffer();if(![404,410].includes(r.status))throw new Error('Offline source unavailable: '+f);}}));}).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('beside-the-bed-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>{const cached=await c.match(key);if(cached)return cached;try{return await fetch(e.request);}catch(error){if(SHELL.includes(key))throw error;return new Response('Offline source unavailable.',{status:503,headers:{'Content-Type':'text/plain'}});}}));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});
`);
  const result = {version,files:[...files,'sw.js'],personalBooksIncluded:false,reviewedBooksIncluded:local,mode:local?'reviewed-editions':'original-shell'};console.log(JSON.stringify(result));return result;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
