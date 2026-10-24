import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,cp,rm,rename,symlink,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assets,editionFiles,outputFiles,buildInputs,pinnedInputs,verifiedEdition,build} from '../scripts/build.mjs';
import {startServer} from '../scripts/serve.mjs';
import {newState} from '../site/core.mjs';
import {createBundle,validateBundle} from '../site/bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');

test('approved three-play package conserves complete objects, source notices, image and recovery',async()=>{
 const {books,library,lock}=await verifiedEdition();assert.equal(sha(library),lock.librarySha256);
 assert.deepEqual(books.map(b=>b.sections.length),[23,34,15]);
 assert.deepEqual(books.map(b=>b.assets.length),[0,0,1]);
 for(const b of books)assert.ok(b.context[0].text.includes('Creative Commons Attribution-NonCommercial 3.0 Unported'));
 const image=books[2].assets[0];assert.equal(sha(Buffer.from(image.data,'base64')),image.sha256);assert.match(image.credit,/CC0/);
 const restored=await validateBundle(await createBundle({books,state:newState()}));assert.deepEqual(restored.books,books);
});

test('source page, input pins and two deployment allowlist forms match the exact inventory',async()=>{
 const {lock,inputs,books}=await verifiedEdition();assert.deepEqual(lock.files.map(f=>f.path),pinnedInputs);
 const inventory=JSON.parse(await readFile(path.join(root,'docs/EDITION-INVENTORY.json')));assert.deepEqual(inventory.buildInputs,buildInputs);assert.deepEqual(inventory.outputs,outputFiles);
 const entries=(await readFile(path.join(root,'.vercelignore'),'utf8')).split('\n').filter(s=>s&&!s.startsWith('#'));assert.equal(entries[0],'**');
 assert.deepEqual(entries.filter(s=>s.startsWith('!')&&!s.endsWith('/')),[...buildInputs.map(n=>'!'+n),...buildInputs.map(n=>'!examples/kingdom-for-a-stage/'+n)]);
 assert(!buildInputs.some(n=>n.startsWith('tests/')||n.startsWith('samples/')||n.startsWith('.reader/')));
 const page=inputs.get('sources/index.html').toString(),escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
 for(const [i,slug]of ['julius-caesar','henry-v','the-tempest'].entries()){
  assert.ok(page.includes(`id="${slug}"`));assert.ok(page.includes(escape(books[i].context[0].text)));
 }
 assert.ok(page.includes('https://creativecommons.org/licenses/by-nc/3.0/'));assert.ok(page.includes('https://creativecommons.org/publicdomain/zero/1.0/'));
 assert.ok(inputs.get('site/index.html').toString().includes('href="/sources/">Sources &amp; credits</a>'));
});

test('changed reviewed inputs, missing files and symlink ancestors fail before replacing output',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'shakespeare-public-package-'));
 try{
  for(const name of ['scripts','site','edition','sources'])await cp(path.join(root,name),path.join(dir,name),{recursive:true});
  for(const name of ['package.json','vercel.json','edition-lock.json'])await cp(path.join(root,name),path.join(dir,name));
  await mkdir(path.join(dir,'.reader'));await writeFile(path.join(dir,'.reader/private.reader.json'),'PRIVATE FIXTURE');await writeFile(path.join(dir,'site/unreviewed.txt'),'UNKNOWN FIXTURE');
  const run=()=>spawnSync(process.execPath,['scripts/build.mjs'],{cwd:dir,encoding:'utf8'});
  let result=run();assert.equal(result.status,0,result.stderr);
  const actual=(await readdir(path.join(dir,'dist'),{recursive:true})).filter(n=>n!=='sources').sort();assert.deepEqual(actual,[...outputFiles].sort());
  const library=await readFile(path.join(dir,'dist/library.json')),source=await readFile(path.join(dir,'dist/sources/index.html'));
  for(const file of ['site/app.mjs','site/icon-192.png','edition/the-tempest.json','sources/index.html','vercel.json']){
   const dest=path.join(dir,file),old=await readFile(dest),changed=Buffer.from(old);changed[Math.floor(changed.length/2)]^=1;await writeFile(dest,changed);
   result=run();assert.notEqual(result.status,0,file);assert.match(result.stderr,/Reviewed bytes changed/);assert.deepEqual(await readFile(path.join(dir,'dist/library.json')),library);assert.deepEqual(await readFile(path.join(dir,'dist/sources/index.html')),source);await writeFile(dest,old);
  }
  await rename(path.join(dir,'sources'),path.join(dir,'sources-real'));await symlink('sources-real',path.join(dir,'sources'));result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/without symlinks/);assert.deepEqual(await readFile(path.join(dir,'dist/library.json')),library);
  await rm(path.join(dir,'sources'));await rename(path.join(dir,'sources-real'),path.join(dir,'sources'));await rm(path.join(dir,'edition/henry-v.json'));result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/ENOENT/);assert.deepEqual(await readFile(path.join(dir,'dist/library.json')),library);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('loopback server freezes explicit outputs and serves nested source aliases only',async()=>{
 await build();const server=await startServer({port:0}),file=path.join(root,'dist/library.json'),bytes=await readFile(file);
 try{
  await writeFile(file,'CHANGED GENERATED OUTPUT');assert.deepEqual(Buffer.from(await (await fetch(server.url+'/library.json')).arrayBuffer()),bytes);
  for(const suffix of ['/sources','/sources/','/sources/index.html']){const response=await fetch(server.url+suffix);assert.equal(response.status,200);assert.match(await response.text(),/Sources and licenses/);}
  for(const suffix of ['/.git/config','/.reader/private.reader.json','/edition/the-tempest.json','/scripts/build.mjs','/README.md','/unknown'])assert.equal((await fetch(server.url+suffix)).status,404,suffix);
  assert.equal((await fetch(server.url+'/library.json',{method:'POST'})).status,405);
 }finally{await writeFile(file,bytes);await server.close();}
});
