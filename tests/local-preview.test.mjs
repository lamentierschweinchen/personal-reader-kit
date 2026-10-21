import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,copyFile,readdir,rm,symlink,rename} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import http from 'node:http';
import {assets} from '../scripts/build.mjs';
import {buildLocalPreview,startLocalPreview} from '../scripts/preview-local.mjs';
import {fromText,LIMIT} from '../site/core.mjs';
import {mergeLibrary} from '../site/library.mjs';

const source=fileURLToPath(new URL('../',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const inputs=['.reader/prepared/first.reader.json','.reader/private/second.reader.json'];
async function fixture(t) {
  const root=await mkdtemp(path.join(tmpdir(),'reader-local-preview-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  for(const name of ['package.json','publication.json','.gitignore','.vercelignore','vercel.json','scripts/build.mjs','samples/library.json',...assets.map(name=>'site/'+name)]) {
    await mkdir(path.dirname(path.join(root,name)),{recursive:true});await copyFile(path.join(source,name),path.join(root,name));
  }
  const books=[await fromText('An original window held the blue morning.\n\n  A second line stays indented.\n',{title:'First original preview'}),await fromText('A quiet bowl.\nA folded cloth.\n\nThe afternoon remained.',{title:'Second original preview',kind:'verse'})];
  books[0].sections[0].blocks[0].marks=[{kind:'em',start:0,end:11}];
  books[0].context=[{label:'Original source note',text:'A note written only for this fixture.',kind:'source',through:null}];
  for(let index=0;index<inputs.length;index++){await mkdir(path.dirname(path.join(root,inputs[index])),{recursive:true});await writeFile(path.join(root,inputs[index]),JSON.stringify(books[index]),{mode:0o600});}
  return {root,books,options:{projectRoot:root,inputs}};
}
async function filesAt(folder) {
  return Object.fromEntries(await Promise.all((await readdir(folder)).sort().map(async name=>[name,hash(await readFile(path.join(folder,name)))])));
}
const rawRequest=(origin,options={})=>new Promise((resolve,reject)=>{
  const request=http.request(origin,{method:'GET',...options},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks).toString()}));});request.on('error',reject);request.end();
});

test('local preview preserves exact books and original public output; its worker follows actual library bytes',async t=>{
  const {root,books,options}=await fixture(t),{build}=await import(pathToFileURL(path.join(root,'scripts/build.mjs')));
  await build();const publicBefore=await filesAt(path.join(root,'dist'));
  const before=await Promise.all(inputs.map(name=>readFile(path.join(root,name))));
  const first=await buildLocalPreview(options);
  assert.deepEqual(JSON.parse(await readFile(path.join(first.output,'library.json'),'utf8')),books);
  assert.equal(first.localOnly,true);assert.equal(first.personalBooksIncluded,true);
  assert.deepEqual((await readdir(first.output)).sort(),[...assets,'library.json','sw.js'].sort());
  const worker=await readFile(path.join(first.output,'sw.js'),'utf8');assert.ok(worker.includes(first.version));assert.equal(worker.split(first.version).length,3);
  books[1].context[0].text='An explicitly revised original fixture context.';
  await writeFile(path.join(root,inputs[1]),JSON.stringify(books[1]));
  const second=await buildLocalPreview(options);assert.notEqual(second.version,first.version);
  assert.deepEqual(JSON.parse(await readFile(path.join(second.output,'library.json'),'utf8')),books);
  assert.deepEqual(await readFile(path.join(root,inputs[0])),before[0]);
  await build();assert.deepEqual(await filesAt(path.join(root,'dist')),publicBefore);
  assert.deepEqual(JSON.parse(await readFile(path.join(root,'dist/library.json'),'utf8')).map(book=>book.id),['bell','rain']);
});

test('invalid prepared inputs fail before any previous preview is replaced',async t=>{
  const {root,books,options}=await fixture(t);await buildLocalPreview(options);
  const receipt=await readFile(path.join(root,'.reader/local-preview/receipt.json'));
  const invalid=path.join(root,'.reader/prepared/invalid.json');
  for(const [label,value,match] of [
    ['malformed',Buffer.from('{'),/Cannot preview/],
    ['invalid UTF-8',Buffer.from([0xff,0xfe]),/Cannot preview/],
    ['unsupported media',JSON.stringify({...books[0],sections:[{...books[0].sections[0],blocks:[{...books[0].sections[0].blocks[0],image:'image.png'}]}]}),/adapter/i],
    ['unsupported profile',JSON.stringify({...books[0],profile:'fixture/illustrated@1'}),/adapter/i],
    ['reserved ID',JSON.stringify({...books[0],id:'bell'}),/original samples/],
    ['oversized',Buffer.alloc(LIMIT+1,32),/at most 8 MB/]
  ]) {
    await writeFile(invalid,value);await assert.rejects(()=>buildLocalPreview({projectRoot:root,inputs:[relativePath(root,invalid)]}),match,label);
    assert.deepEqual(await readFile(path.join(root,'.reader/local-preview/receipt.json')),receipt,label+' replaced output');
  }
  await assert.rejects(()=>buildLocalPreview({projectRoot:root,inputs:[inputs[0],inputs[0]]}),/Duplicate/);
  await assert.rejects(()=>buildLocalPreview({projectRoot:root,inputs:['.reader/missing.json']}),/ENOENT/);
  await assert.rejects(()=>buildLocalPreview({...options,output:'.reader/private'}),/fixed private destination/);
  for(const name of ['samples/library.json','../outside.reader.json','.reader/local-preview/site/library.json','.reader/local-preview/receipt.json'])await assert.rejects(()=>buildLocalPreview({projectRoot:root,inputs:[name]}),/Inputs must/);
  assert.deepEqual(await readFile(path.join(root,'.reader/local-preview/receipt.json')),receipt);
});
const relativePath=(root,name)=>path.relative(root,name).split(path.sep).join('/');

test('unrecognized output, altered output and symlinked paths are preserved',async t=>{
  const {root,options}=await fixture(t),destination=path.join(root,'.reader/local-preview');
  await mkdir(destination);await writeFile(path.join(destination,'intake.json'),'Original evidence sentinel.');
  await assert.rejects(()=>buildLocalPreview(options),/unrecognized files/);
  assert.equal(await readFile(path.join(destination,'intake.json'),'utf8'),'Original evidence sentinel.');
  await rename(destination,path.join(root,'.reader/preserved-evidence'));
  const result=await buildLocalPreview(options);
  await writeFile(path.join(result.output,'library.json'),'Changed generated content that must be preserved.');
  await assert.rejects(()=>buildLocalPreview(options),/changed outside/);
  assert.equal(await readFile(path.join(result.output,'library.json'),'utf8'),'Changed generated content that must be preserved.');
  await rename(destination,path.join(root,'.reader/preserved-output'));
  await symlink(path.join(root,'.reader/preserved-evidence'),destination,'dir');
  await assert.rejects(()=>buildLocalPreview(options),/symlinks/);
  const link=path.join(root,'.reader/prepared/linked.json');await symlink(path.join(root,inputs[0]),link);
  await assert.rejects(()=>buildLocalPreview({projectRoot:root,inputs:['.reader/prepared/linked.json']}),/symlinks/);
  const nested=path.join(root,'.reader/linked');await symlink(path.join(root,'.reader/prepared'),nested,'dir');
  await assert.rejects(()=>buildLocalPreview({projectRoot:root,inputs:['.reader/linked/first.reader.json']}),/symlinks/);
  assert.equal(await readFile(path.join(root,'.reader/preserved-evidence/intake.json'),'utf8'),'Original evidence sentinel.');
});

test('private paths must remain ignored and outside publication inventories',async t=>{
  const {root,options}=await fixture(t);
  await writeFile(path.join(root,'.gitignore'),'dist/\n');await assert.rejects(()=>buildLocalPreview(options),/Keep .reader\/ ignored/);
  await copyFile(path.join(source,'.gitignore'),path.join(root,'.gitignore'));
  const file=path.join(root,'publication.json'),manifest=JSON.parse(await readFile(file,'utf8'));manifest.files.push(inputs[0]);await writeFile(file,JSON.stringify(manifest));
  await assert.rejects(()=>buildLocalPreview(options),/publication inventories/);
});

test('loopback server serves only its exact inventory and refuses foreign origins, hosts and writes',async t=>{
  const {root,books,options}=await fixture(t),preview=await startLocalPreview({...options,port:0});t.after(()=>preview.stop());
  assert.match(preview.origin,/^http:\/\/127\.0\.0\.1:\d+$/);
  const library=await rawRequest(preview.origin,{path:'/library.json'});assert.equal(library.status,200);assert.deepEqual(JSON.parse(library.body),books);
  assert.match(library.headers['content-security-policy'],/default-src 'self'/);assert.equal(library.headers['cache-control'],'no-store');
  await writeFile(path.join(preview.receipt.output,'unlisted.json'),'Original excluded sentinel.');
  for(const url of ['/unlisted.json','/receipt.json','/.reader/prepared/first.reader.json','/%2e%2e%2fprivate.json','/README.md'])assert.equal((await rawRequest(preview.origin,{path:url})).status,404,url);
  assert.equal((await rawRequest(preview.origin,{path:'/library.json',method:'POST'})).status,405);
  assert.equal((await rawRequest(preview.origin,{headers:{Host:'elsewhere.invalid'}})).status,403);
  assert.equal((await rawRequest(preview.origin,{headers:{Origin:'https://elsewhere.invalid'}})).status,403);
  assert.equal((await rawRequest(preview.origin,{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  assert.equal((await rawRequest(preview.origin,{path:'/library.json',method:'HEAD'})).body,'');
  const old=await readFile(path.join(root,'.reader/local-preview/receipt.json'));
  const port=Number(new URL(preview.origin).port);
  await assert.rejects(()=>startLocalPreview({...options,port}),/EADDRINUSE/);
  assert.deepEqual(await readFile(path.join(root,'.reader/local-preview/receipt.json')),old);
  await assert.rejects(()=>startLocalPreview({...options,port:4173}),/separate stable/);
  await assert.rejects(()=>startLocalPreview({...options,host:'0.0.0.0'}),/no host/);
});

test('running origins retain their own complete snapshot after another preview rebuilds the disposable folder',async t=>{
  const {root,books,options}=await fixture(t),first=await startLocalPreview({...options,port:0});t.after(()=>first.stop());
  const expected=await Promise.all(first.receipt.files.map(async file=>({path:file.path,bytes:await readFile(path.join(first.receipt.output,file.path))})));
  books[1].context[0].text='A second independent original preview snapshot.';await writeFile(path.join(root,inputs[1]),JSON.stringify(books[1]));
  const second=await startLocalPreview({...options,port:0});t.after(()=>second.stop());assert.notEqual(first.origin,second.origin);assert.notEqual(first.receipt.version,second.receipt.version);
  for(const file of expected)assert.deepEqual(Buffer.from(await(await fetch(first.origin+'/'+file.path)).arrayBuffer()),file.bytes,file.path);
  for(const file of second.receipt.files)assert.equal(hash(Buffer.from(await(await fetch(second.origin+'/'+file.path)).arrayBuffer())),file.sha256,file.path);
  assert.deepEqual(await(await fetch(second.origin+'/library.json')).json(),books);
});

test('library reconciliation preserves exact stored editions and exposes conflicts without rewriting anchors',async()=>{
  const first=await fromText('An original preserved edition.',{title:'Original edition'}),same=structuredClone(first),other=structuredClone(first);
  other.sections[0].blocks[0].text='A different original supplied edition.';other.source.sha256='a'.repeat(64);
  const identical=mergeLibrary([same],[first]);assert.deepEqual(identical.books,[first]);assert.equal(identical.books[0],first);assert.deepEqual(identical.conflicts,[]);
  const before=JSON.stringify({first,other}),conflict=mergeLibrary([other],[first]);assert.equal(conflict.books[0],first);assert.equal(conflict.conflicts[0].stored,first);assert.equal(conflict.conflicts[0].supplied,other);assert.deepEqual(conflict.availableSupplied,[]);assert.equal(JSON.stringify({first,other}),before);
  assert.throws(()=>mergeLibrary([first,same],[]),/duplicate/);assert.throws(()=>mergeLibrary([],[first,same]),/duplicate/);
});
