import {readFile,writeFile,mkdir,rm,copyFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {KIT_VERSION,canonical} from '../site/bundle.mjs';
import {validateBook} from '../site/core.mjs';
import {validateExperience} from '../site/experience.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const assets=['index.html','app.mjs','core.mjs','db.mjs','bundle.mjs','text.mjs','share.mjs','share-card.mjs','share-card.css','style.css','manifest.webmanifest','icon.svg','robots.txt','media.mjs','experience.mjs','mountains.css','apple-touch-icon.png','icon-192.png','icon-512.png'];
export async function build({output=path.join(root,'dist')}={}){
  const pkg=JSON.parse(await readFile(path.join(root,'package.json')));
  if(pkg.version!==KIT_VERSION)throw Error('Package and bundle versions differ.');
  const inventory=JSON.parse(await readFile(path.join(root,'edition/inventory.json')));
  const edition={};
  for(const [name,pin] of Object.entries(inventory.files)){
    const bytes=await readFile(path.join(root,'edition',name));
    if(sha(bytes)!==pin)throw Error('Reviewed edition differs: '+name);
    edition[name]=bytes;
  }
  const books=JSON.parse(edition['library.json']);books.forEach(validateBook);
  const experience=validateExperience(JSON.parse(edition['experience.json']),books);
  if(sha(canonical(books.find(b=>b.id===experience.bookId)))!==experience.bookSha256)throw Error('Companion snapshot differs.');
  const out=path.resolve(output);
  if(out===path.resolve(root)||path.resolve(root).startsWith(out+path.sep))throw Error('Build output cannot replace the project or its parent.');
  if(out!==path.join(root,'dist')&&out.startsWith(root))throw Error('Custom output inside the project is not disposable.');
  for(let dir=out;dir!==path.dirname(dir);dir=path.dirname(dir)){try{if((await lstat(dir)).isSymbolicLink())throw Error('Build output cannot follow symlinks.');}catch(e){if(e.code!=='ENOENT')throw e;}}
  await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
  for(const name of assets){const input=path.join(root,'site',name);if(!(await lstat(input)).isFile())throw Error('Build inputs must be regular files.');await copyFile(input,path.join(out,name));}
  for(const [name,bytes] of Object.entries(edition))await writeFile(path.join(out,name),bytes);
  const files=[...assets,...Object.keys(edition)],hash=createHash('sha256').update(await readFile(path.join(root,'vercel.json')));
  for(const file of files)hash.update(file).update(await readFile(path.join(out,file)));
  const version=hash.digest('hex').slice(0,16);
  await writeFile(path.join(out,'sw.js'),`const CACHE='mountains-reader-${version}';const FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('mountains-reader-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});\n`);
  await writeFile(path.join(out,'build.json'),JSON.stringify({version,profile:books[0].profile,book:books[0].id,files:[...files,'sw.js']},null,2)+'\n');
  const result={version,files:[...files,'sw.js','build.json'],book:books[0].id,bytes:edition['library.json'].length};console.log(JSON.stringify(result));return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await build();
