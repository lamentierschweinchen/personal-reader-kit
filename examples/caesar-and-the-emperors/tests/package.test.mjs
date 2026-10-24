import test from'node:test';import assert from'node:assert/strict';import{readFile,writeFile,mkdtemp,mkdir,cp,rm,rename,symlink,readdir}from'node:fs/promises';import{tmpdir}from'node:os';import path from'node:path';import{fileURLToPath,pathToFileURL}from'node:url';import{spawnSync}from'node:child_process';
import{assets,editionFiles,outputFiles,buildInputs,verifiedEdition}from'../scripts/build.mjs';import{newState}from'../site/core.mjs';import{createBundle,validateBundle}from'../site/bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const list=async(dir,prefix='')=>(await Promise.all((await readdir(path.join(dir,prefix),{withFileTypes:true})).map(e=>e.isDirectory()?list(dir,prefix+e.name+'/'):[prefix+e.name]))).flat().sort();
test('the exact nine-book package preserves all sections, five embedded images and complete recovery',async()=>{
 const{books,lock}=await verifiedEdition();assert.deepEqual(books.map(b=>b.sections.length),[90,90,37,37,33,33,1,1,4]);assert.equal(lock.embeddedAssets.length,5);assert.deepEqual((await validateBundle(await createBundle({books,state:newState()}))).books,books);
 const text=await readFile(path.join(root,'site/sources/index.html'),'utf8');for(const required of ['id="caesar-latin"','id="marcus-greek"','Lisa Cerrato','William Merrill','David Smith','Rashmi Singhal','Bridget Almas','Gregory Crane','National Endowment for the Humanities','Google Digital Humanities Awards Program','https://creativecommons.org/licenses/by-sa/4.0/'])assert.ok(text.includes(required),required);
});
test('deployment input allowlist and documented inventory are exact in both path forms',async()=>{
 const rules=(await readFile(path.join(root,'.vercelignore'),'utf8')).split('\n').filter(x=>x&&!x.startsWith('#'));assert.equal(rules[0],'**');assert.deepEqual(rules.filter(x=>x.startsWith('!')&&!x.endsWith('/')),[...buildInputs.map(x=>'!'+x),...buildInputs.map(x=>'!examples/caesar-and-the-emperors/'+x)]);
 const inventory=JSON.parse(await readFile(path.join(root,'docs/EDITION-INVENTORY.json')));assert.deepEqual(inventory.buildInputs,buildInputs);assert.deepEqual(inventory.outputs,outputFiles);assert(!buildInputs.some(x=>x.startsWith('tests/')||x.startsWith('.reader/')||x.startsWith('samples/')));
});
test('unreviewed inputs stay out; changed pins, missing inputs and symlink ancestors fail before replacing output',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'roman-public-package-'));
 try{
  for(const folder of ['scripts','site','edition'])await cp(path.join(root,folder),path.join(dir,folder),{recursive:true});for(const file of ['package.json','vercel.json','edition-lock.json'])await cp(path.join(root,file),path.join(dir,file));await mkdir(path.join(dir,'.reader'));await writeFile(path.join(dir,'.reader/private.json'),'PRIVATE FIXTURE');await writeFile(path.join(dir,'site/unknown.txt'),'UNKNOWN FIXTURE');
  const run=()=>spawnSync(process.execPath,['scripts/build.mjs'],{cwd:dir,encoding:'utf8'});let built=run();assert.equal(built.status,0,built.stderr);assert.deepEqual(await list(path.join(dir,'dist')),[...outputFiles].sort());const original=await readFile(path.join(dir,'dist/library.json'));
  for(const f of ['site/app.mjs','site/sources/index.html','edition/pliny-trajan.json']){const p=path.join(dir,f),bytes=await readFile(p),changed=Buffer.from(bytes);changed[Math.floor(changed.length/2)]^=1;await writeFile(p,changed);built=run();assert.notEqual(built.status,0);assert.match(built.stderr,/Reviewed bytes changed/);assert.deepEqual(await readFile(path.join(dir,'dist/library.json')),original);await writeFile(p,bytes);}
  await rename(path.join(dir,'edition'),path.join(dir,'edition-real'));await symlink('edition-real',path.join(dir,'edition'));built=run();assert.notEqual(built.status,0);assert.match(built.stderr,/without symlinks/);assert.deepEqual(await readFile(path.join(dir,'dist/library.json')),original);await rm(path.join(dir,'edition'));await rename(path.join(dir,'edition-real'),path.join(dir,'edition'));
  await rm(path.join(dir,'site/sources/index.html'));built=run();assert.notEqual(built.status,0);assert.deepEqual(await readFile(path.join(dir,'dist/library.json')),original);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('loopback server keeps an immutable exact snapshot and exposes neither source inputs nor foreign/write access',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'roman-public-server-'));let server;
 try{
  for(const folder of ['scripts','site','edition'])await cp(path.join(root,folder),path.join(dir,folder),{recursive:true});for(const file of ['package.json','vercel.json','edition-lock.json'])await cp(path.join(root,file),path.join(dir,file));const builder=await import(pathToFileURL(path.join(dir,'scripts/build.mjs')));await builder.build();const module=await import(pathToFileURL(path.join(dir,'scripts/serve.mjs')));server=await module.startServer();const before=await(await fetch(server.url+'/library.json')).text();await writeFile(path.join(dir,'dist/library.json'),'UNREVIEWED REPLACEMENT');assert.equal(await(await fetch(server.url+'/library.json')).text(),before);
  assert.equal((await fetch(server.url+'/sources/')).status,200);assert.equal((await fetch(server.url+'/sources/index.html')).status,200);for(const f of ['/edition/pliny-trajan.json','/.reader/private.json','/site/app.mjs','/package.json','/.git/config','/dist/library.json'])assert.equal((await fetch(server.url+f)).status,404,f);
  assert.equal((await fetch(server.url+'/',{method:'POST'})).status,405);assert.equal((await fetch(server.url+'/',{headers:{Origin:'https://foreign.invalid'}})).status,403);
 }finally{if(server)await server.close();await rm(dir,{recursive:true,force:true});}
});
