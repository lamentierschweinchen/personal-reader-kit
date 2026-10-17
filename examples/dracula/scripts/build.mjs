import {copyGame} from './copy-game.mjs';
import {readFile,writeFile,mkdir,rm,copyFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateBook,anchorStatus} from '../site/core.mjs';
import {dossier,evidence} from '../site/case.mjs';
import {isReviewedEdition} from '../site/edition.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export const assets=['index.html','app.mjs','core.mjs','db.mjs','bundle.mjs','text.mjs','share.mjs','case.mjs','case-ui.mjs','edition.mjs','style.css','dracula.css','manifest.webmanifest','icon.svg','robots.txt'];
export async function build(){
 const pins=JSON.parse(await readFile(path.join(root,'edition-lock.json'),'utf8'));
 const prepared=['library.json','source-notices.json'];
 const bytes={};for(const name of prepared){bytes[name]=await readFile(path.join(root,'edition',name));if(createHash('sha256').update(bytes[name]).digest('hex')!==pins[name])throw Error('Prepared edition changed: '+name+'. Review source fidelity before updating edition-lock.json.');}
 const book=validateBook(JSON.parse(bytes['library.json'])[0]);
 if(!await isReviewedEdition(book))throw Error('Prepared edition differs from the reviewed recovery fingerprint in site/edition.mjs.');
 for(const doc of dossier)if(!anchorStatus(evidence(book,doc),book).valid)throw Error('Broken evidence anchor: '+doc.id);
 const out=path.join(root,'dist');await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
 for(const name of assets){const input=path.join(root,'site',name);if(!(await lstat(input)).isFile())throw Error('Build inputs must be regular files.');await copyFile(input,path.join(out,name));}
 for(const name of prepared)await writeFile(path.join(out,name),bytes[name]);
 const files=[...assets,...prepared,...await copyGame(root,out)],hash=createHash('sha256');for(const name of files)hash.update(name).update(await readFile(path.join(out,name)));
 const version=hash.digest('hex').slice(0,16);
 await writeFile(path.join(out,'sw.js'),`const CACHE='dracula-${version}';const FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('dracula-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':e.request.mode==='navigate'&&u.pathname==='/play/'?'/play/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});`);
 const result={version,files:[...files,'sw.js'],localOnly:false,completeEdition:true};console.log(JSON.stringify(result));return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await build();
