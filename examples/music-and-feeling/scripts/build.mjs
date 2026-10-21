import {readFile,writeFile,mkdir,rm,copyFile,lstat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {KIT_VERSION} from '../site/bundle.mjs';
import {validateBook,bookText} from '../site/core.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
export const assets=['index.html','app.mjs','core.mjs','db.mjs','bundle.mjs','text.mjs','share.mjs','share-card.mjs','share-card.css','style.css','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png','robots.txt','edition.mjs','collection.mjs','cover.svg','gentiumplus-400-normal.woff2','gentiumplus-400-italic.woff2','gentiumplus-700-normal.woff2','gentiumplus-700-italic.woff2','GentiumPlus-OFL.txt'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function build({sampleOnly=false,output=path.join(root,'dist')}={}) {
 const p=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));if(p.version!==KIT_VERSION)throw Error('Bundle/application version mismatch.');
 const manifest=JSON.parse(await readFile(path.join(root,'publication.json'),'utf8'));
 for(const pin of manifest.reviewedFontFiles||[]){const bytes=await readFile(path.join(root,pin.path));if(hash(bytes)!==pin.sha256||bytes.subarray(0,4).toString()!=='wOF2')throw Error('Reviewed font bytes differ: '+pin.path);}
 const sample=await readFile(path.join(root,'samples/library.json'));
 if(hash(sample)!==manifest.originalSampleSha256)throw Error('Original sample bytes changed.');
 for(const b of JSON.parse(sample)){const book=validateBook(b);if(book.source.format!=='original'||hash(bookText(book))!==book.source.sha256)throw Error('Sample provenance mismatch.');}
 let library=sample,edition=false;
 if(!sampleOnly){library=await readFile(path.join(root,'edition/library.json'));edition=true;}
 if(!sampleOnly){const reviewed=JSON.parse(await readFile(path.join(root,'edition/inventory.json'),'utf8'));for(const pin of reviewed.files){const bytes=await readFile(path.join(root,pin.path));if(bytes.length!==pin.bytes||hash(bytes)!==pin.sha256)throw Error('Reviewed edition input changed: '+pin.path);}}
 const books=JSON.parse(library).map(validateBook),out=path.resolve(output);
 if(out===root||out===path.parse(out).root)throw Error('Build output must be a dedicated folder.');
 await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
 const files=[...assets,'library.json'];
 for(const name of assets){const input=path.join(root,'site',name);if(!(await lstat(input)).isFile())throw Error('Build input must be a regular file.');await copyFile(input,path.join(out,name));}
 await writeFile(path.join(out,'library.json'),library);
 if(edition){
  const names=new Set(files);
  for(const b of books)for(const a of b.assets||[]){if(names.has(a.file))throw Error('Duplicate release asset.');names.add(a.file);const input=path.join(root,'edition',a.file),bytes=await readFile(input);if(!(await lstat(input)).isFile()||hash(bytes)!==a.sha256||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw Error('Source image hash/type mismatch: '+a.file);await writeFile(path.join(out,a.file),bytes);files.push(a.file);}
  const allStudies=JSON.parse(await readFile(path.join(root,'edition/studies.json')));const studies=JSON.stringify({ninth:allStudies.ninth});await writeFile(path.join(out,'studies.json'),studies);files.push('studies.json');
 }
 const digest=createHash('sha256');for(const f of files)digest.update(f).update(await readFile(path.join(out,f)));const version=digest.digest('hex').slice(0,16);
 await writeFile(path.join(out,'sw.js'),`const CACHE='music-and-feeling-${version}';const FILES=${JSON.stringify(files.map(f=>'/'+f))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith('music-and-feeling-')&&k!==CACHE)await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;const key=e.request.mode==='navigate'&&['/','/index.html'].includes(u.pathname)?'/index.html':u.pathname;if(FILES.includes(key))e.respondWith(caches.open(CACHE).then(async c=>(await c.match(key))||fetch(e.request)));});
self.addEventListener('message',e=>{if(e.data==='CHECK_OFFLINE')e.waitUntil(caches.open(CACHE).then(async c=>e.ports[0]?.postMessage({ready:(await Promise.all(FILES.map(f=>c.match(f)))).every(Boolean),version:'${version}'})));});`);
 files.push('sw.js');
 const inventory=await Promise.all(files.map(async f=>{const bytes=await readFile(path.join(out,f));return {path:f,sha256:hash(bytes),bytes:bytes.length};}));
 if(out===path.join(root,'dist')){await mkdir(path.join(root,'.reader/reports'),{recursive:true});await writeFile(path.join(root,'.reader/reports/release-inventory.json'),JSON.stringify({version,edition,localReviewOnly:true,files:inventory},null,2));}
 const result={version,files,personalBooksIncluded:false,reviewedBooksIncluded:edition};console.log(JSON.stringify({version,files:files.length,personalBooksIncluded:false,reviewedBooksIncluded:edition}));return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await build({sampleOnly:process.argv.includes('--sample-only')});
