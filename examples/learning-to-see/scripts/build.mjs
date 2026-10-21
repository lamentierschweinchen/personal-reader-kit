import {readFile,writeFile,mkdir,rm,copyFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateBook} from '../site/core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export const assets=['index.html','app.mjs','core.mjs','db.mjs','bundle.mjs','text.mjs','share.mjs','share-card.mjs','share-card.css','media.mjs','studio.mjs','style.css','collection.css','cover.svg','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png','robots.txt','alegreya-normal.woff2','alegreya-italic.woff2','alegreya-OFL.txt'];
export async function build({output='dist'}={}){
 const privateRoot=path.join(root,'edition');
 const pins=JSON.parse(await readFile(path.join(privateRoot,'inventory.json'),'utf8'));for(const [name,pin]of Object.entries(pins.files)){const b=await readFile(path.join(privateRoot,name));if(createHash('sha256').update(b).digest('hex')!==pin)throw new Error('Reviewed edition input changed: '+name);}
 const library=await readFile(path.join(privateRoot,'library.json'));const books=JSON.parse(library).map(validateBook);
 if(books.length!==2||books.map(b=>b.id).join('|')!=='ruskin|crane')throw new Error('Prepared collection missing or unexpected; run the source adapter.');
 const studies=await readFile(path.join(privateRoot,'study-data.json'));JSON.parse(studies);
 if(path.isAbsolute(output)||output.split(/[\\/]/).includes('..'))throw new Error('Build output must stay inside this project.');const out=path.resolve(root,output);if(out===root)throw new Error('Build output must be a separate directory.');await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
 const fontPins=JSON.parse(await readFile(path.join(root,'publication.json'),'utf8')).reviewedFontFiles;
 for(const name of assets){const input=path.join(root,'site',name);if(!(await lstat(input)).isFile())throw new Error('Only explicit regular inputs are allowed.');if(name.endsWith('.woff2')){const bytes=await readFile(input),pin=fontPins?.find(f=>f.path==='site/'+name&&f.sha256===createHash('sha256').update(bytes).digest('hex'));if(!pin||bytes.subarray(0,4).toString('ascii')!=='wOF2'||createHash('sha256').update(await readFile(path.join(root,pin.license))).digest('hex')!==pin.licenseSha256)throw new Error('Font bytes or licence differ from the reviewed pins: '+name);}await copyFile(input,path.join(out,name));}
 await writeFile(path.join(out,'library.json'),library);await writeFile(path.join(out,'study-data.json'),studies);
 const files=[...assets,'library.json','study-data.json'];const sha=createHash('sha256');for(const name of files)sha.update(name).update(await readFile(path.join(out,name)));const version=sha.digest('hex').slice(0,16);
 await writeFile(path.join(out,'sw.js'),`const CACHE='learning-to-see-${version}',FILES=${JSON.stringify(files.map(x=>'/'+x))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('learning-to-see-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});`);
 const inventory=[];for(const name of [...files,'sw.js']){const bytes=await readFile(path.join(out,name));inventory.push({path:name,size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
 const result={version,files:[...files,'sw.js'],personalBooksIncluded:false,reviewedBooksIncluded:true,publication:'Reviewed historical collection.',inventory};console.log(JSON.stringify({version,files:result.files,personalBooksIncluded:false,reviewedBooksIncluded:true}));return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await build();
