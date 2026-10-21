import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdtemp,rm,realpath} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {build,assets} from '../scripts/build.mjs';
import {validateBook} from '../site/core.mjs';
import {validateExperience} from '../site/experience.mjs';
import {canonical} from '../site/bundle.mjs';
const root=new URL('../',import.meta.url),read=f=>readFile(new URL(f,root)),json=async f=>JSON.parse(await read(f)),sha=b=>createHash('sha256').update(b).digest('hex');
test('complete selected edition, image payloads, source notices and companion retain reviewed identity',async()=>{
 const inventory=await json('edition/inventory.json');for(const [f,pin] of Object.entries(inventory.files))assert.equal(sha(await read('edition/'+f)),pin);
 const books=await json('edition/library.json'),book=validateBook(books[0]);assert.equal(books.length,1);assert.equal(book.sections.length,18);assert.equal(book.sections.filter(s=>s.id.startsWith('chapter-')).length,12);assert.equal(book.sections.reduce((n,s)=>n+s.blocks.length,0),881);assert.equal(book.plates.length,70);assert.equal(book.sections.at(-1).id,'source-notices');
 const x=validateExperience(await json('edition/experience.json'),books);assert.equal(sha(canonical(book)),x.bookSha256);assert.deepEqual(x.studies.map(s=>s.title),['Snow and rock','Pallanza','Chillon']);
 const declared=await json('docs/EDITION-INVENTORY.json');assert.equal(declared.plates.length,70);
 for(const p of book.plates){const pin=declared.plates.find(q=>q.id===p.id);assert.equal(sha(Buffer.from(p.data,'base64')),p.sha256);assert.equal(pin.sha256,p.sha256);assert.equal(pin.width,p.width);assert.equal(pin.height,p.height);assert.equal(Math.max(p.width,p.height),1400);}
});
test('standalone build is reproducible, exact and excludes undeclared inputs',async()=>{
 const out=await realpath(await mkdtemp(path.join(tmpdir(),'mountains-build-')));
 try{const a=await build({output:out}),pins=Object.fromEntries(await Promise.all(a.files.map(async f=>[f,sha(await readFile(path.join(out,f)))])));
 assert.deepEqual((await readdir(out)).sort(),[...assets,'library.json','experience.json','cover-plate.jpg','sw.js','build.json'].sort());
 for(const f of ['library.json','experience.json'])assert.deepEqual(await readFile(path.join(out,f)),await read('edition/'+f));
 const b=await build({output:out});assert.equal(a.version,b.version);for(const f of b.files)assert.equal(sha(await readFile(path.join(out,f))),pins[f]);
 }finally{await rm(out,{recursive:true,force:true});}
});
test('Home Screen assets, MIME references and deployment inputs are exact',async()=>{
 const publication=await json('publication.json'),manifest=await json('site/manifest.webmanifest');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.id,'/');
 for(const [file,size] of [['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512]]){const b=await read('site/'+file);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size);assert.equal(b[25],2);assert.equal(sha(b),publication.reviewedIconFiles.find(p=>p.path==='site/'+file).sha256);}
 const rules=(await read('.vercelignore')).toString().split('\n'),included=rules.filter(l=>l.startsWith('!')&&!l.endsWith('/')).map(l=>l.slice(1));
 const expected=['package.json','vercel.json','publication.json','scripts/build.mjs','edition/inventory.json','edition/library.json','edition/experience.json','edition/cover-plate.jpg',...assets.map(f=>'site/'+f)].sort();
 assert.deepEqual(included.filter(f=>!f.startsWith('examples/')).sort(),expected);assert.deepEqual(included.filter(f=>f.startsWith('examples/')).sort(),expected.map(f=>'examples/mountains-and-heights/'+f));
 assert.match((await read('scripts/serve.mjs')).toString(),/image\/png/);
});
