import {readFile,writeFile,mkdir,rm,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateBook} from '../site/core.mjs';
import {KIT_VERSION} from '../site/bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const hash=b=>createHash('sha256').update(b).digest('hex');
export const assets=['index.html','app.mjs','core.mjs','db.mjs','bundle.mjs','text.mjs','share.mjs','share-card.mjs','share-card.css','style.css','manifest.webmanifest','icon.svg','robots.txt','edition.mjs','edition.css'];
export const editionAssets=['library.json','structure.json','companion.json','Literata-Roman.ttf','Literata-Italic.ttf','Literata-OFL.txt','plate-portrait.webp','plate-tushin.webp','plate-tilsit.webp','plate-ball.webp','plate-hunt.webp','plate-sleigh.webp','plate-lavrushka.webp','plate-kutuzov.webp','plate-rostopchin.webp','plate-mytishchi.webp','plate-execution.webp','plate-petya.webp'];
export const icons=['apple-touch-icon.png','icon-192.png','icon-512.png'];
export const fonts=['Literata-Roman.ttf','Literata-Italic.ttf','Literata-OFL.txt'];
export const outputFiles=[...assets,...editionAssets,...icons,'sw.js','build.json'];
export async function build(){
  const config=await readFile(path.join(root,'vercel.json'));
  const lock=JSON.parse(await readFile(path.join(root,'edition-lock.json')));
  if(JSON.parse(await readFile(path.join(root,'package.json'))).version!==KIT_VERSION)throw Error('Package and reading-bundle versions differ.');
  const expected=[...editionAssets.map(n=>(fonts.includes(n)?'site/':'edition/')+n),...icons.map(n=>'site/'+n)].sort();
  if(JSON.stringify(lock.files.map(f=>f.path).sort())!==JSON.stringify(expected))throw Error('The exact reviewed edition asset list is required.');
  const inputs=[];
  // Freeze every exact input before touching dist. Never scan folders into a build
  // or accept an output argument that could replace source or review evidence.
  for(const name of [...assets,...editionAssets,...icons]){
    const relative=(editionAssets.includes(name)&&!fonts.includes(name)?'edition/':'site/')+name,input=path.join(root,relative);
    if(!(await lstat(input)).isFile())throw Error('Build input must be a regular file: '+relative);
    const bytes=await readFile(input),pin=lock.files.find(f=>f.path===relative);
    if(pin&&(pin.name!==name||pin.bytes!==bytes.length||pin.sha256!==hash(bytes)))throw Error('Changed reviewed asset: '+relative);
    inputs.push({name,bytes});
  }
  const library=inputs.find(f=>f.name==='library.json').bytes,books=JSON.parse(library);
  if(books.length!==1)throw Error('The single complete Maude edition is required.');
  const book=validateBook(books[0]);
  if(book.id!==lock.bookId||book.source.sha256!==lock.witnessSha256||hash(library)!==lock.librarySha256)throw Error('The exact reviewed novel is required.');
  const fingerprint=createHash('sha256').update(config);for(const f of inputs)fingerprint.update(f.name).update(f.bytes);
  const version=fingerprint.digest('hex').slice(0,16),files=inputs.map(f=>f.name);
  const worker=`const CACHE='war-and-peace-${version}';
const FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('war-and-peace-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});
`;
  const manifest={version,bookId:book.id,edition:lock.librarySha256,files:outputFiles,personalBooksIncluded:false,reviewedPublicDomainWorks:[book.id]};
  const out=path.join(root,'dist');await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
  for(const f of inputs)await writeFile(path.join(out,f.name),f.bytes);
  await writeFile(path.join(out,'sw.js'),worker);await writeFile(path.join(out,'build.json'),JSON.stringify(manifest)+'\n');
  console.log(JSON.stringify(manifest));return manifest;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await build();
