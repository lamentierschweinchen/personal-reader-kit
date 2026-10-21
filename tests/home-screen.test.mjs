import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,cp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkHomeScreen,inspectPng} from '../scripts/check-home-screen.mjs';
import {inspectFile} from '../scripts/audit.mjs';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');

test('starter has portable PNG icons and keeps its previous installed identity',async()=>{
 const result=await checkHomeScreen(path.join(root,'site'));
 assert.equal(result.id,'/');assert.equal(result.icons.length,2);
 const manifest=JSON.parse(await readFile(path.join(root,'publication.json'),'utf8'));
 for(const file of ['docs/HOME-SCREEN.md','scripts/check-home-screen.mjs','tests/home-screen.test.mjs','site/apple-touch-icon.png','site/icon-192.png','site/icon-512.png'])assert.ok(manifest.starterFiles.includes(file),'Missing portable starter input: '+file);
 for(const icon of manifest.reviewedIconFiles.filter(f=>f.path.startsWith('site/'))){
  assert.ok(manifest.starterFiles.includes(icon.path));assert.ok(manifest.starterFiles.includes(icon.provenance));
  assert.equal(sha(await readFile(path.join(root,icon.path))),icon.sha256);
 }
});

test('icon validation refuses missing files, wrong dimensions, corrupt pixels and escaped scope',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'reader-icon-test-'));
 const original=await readFile(path.join(root,'site/manifest.webmanifest'),'utf8');
 const header=await readFile(path.join(root,'site/index.html'),'utf8');
 try{
  for(const file of ['index.html','manifest.webmanifest','icon.svg','apple-touch-icon.png','icon-192.png','icon-512.png'])await cp(path.join(root,'site',file),path.join(directory,file));
  await checkHomeScreen(directory);
  await writeFile(path.join(directory,'index.html'),header.replace('rel="apple-touch-icon"','rel="unused"'));
  await assert.rejects(checkHomeScreen(directory),/explicit Apple/);
  await writeFile(path.join(directory,'index.html'),header);
  for(const [key,value,match] of [['scope','/other/',/scope/],['start_url','/other/',/launch URL/],['id','/changed',/identity/]]){
   await writeFile(path.join(directory,'manifest.webmanifest'),JSON.stringify({...JSON.parse(original),[key]:value}));
   await assert.rejects(checkHomeScreen(directory),match);
  }
  const remote=JSON.parse(original);remote.icons[1].src='https://elsewhere.invalid/icon-192.png';
  await writeFile(path.join(directory,'manifest.webmanifest'),JSON.stringify(remote));await assert.rejects(checkHomeScreen(directory),/origin/);
  await writeFile(path.join(directory,'manifest.webmanifest'),original);
  await cp(path.join(directory,'apple-touch-icon.png'),path.join(directory,'icon-192.png'));await assert.rejects(checkHomeScreen(directory),/Wrong icon width/);
  await cp(path.join(root,'site/icon-192.png'),path.join(directory,'icon-192.png'));
  const broken=await readFile(path.join(directory,'icon-512.png'));broken[50]^=1;await writeFile(path.join(directory,'icon-512.png'),broken);await assert.rejects(checkHomeScreen(directory),/checksum/);
  await rm(path.join(directory,'icon-512.png'));await assert.rejects(checkHomeScreen(directory),/ENOENT/);
  const nested=path.join(directory,'reader');await cp(path.join(root,'site'),nested,{recursive:true});
  await assert.rejects(checkHomeScreen(directory,{base:'/reader/'}),/escapes this reader scope/);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('PNG publication exception requires exact original icon bytes and keeps other checks',async()=>{
 const name='site/apple-touch-icon.png',provenance='docs/HOME-SCREEN.md',bytes=await readFile(path.join(root,name));
 const pin={path:name,sha256:sha(bytes),provenance,reason:'Original fixture icon.'},allowed=[name,provenance];
 assert.deepEqual(inspectFile(name,bytes,allowed,[],[],[],[pin]),[]);
 assert.match(inspectFile(name,bytes,allowed).join(' '),/exact reviewed provenance/);
 assert.match(inspectFile(name,Buffer.concat([bytes,Buffer.from('changed')]),allowed,[],[],[],[pin]).join(' '),/exact reviewed provenance/);
 assert.match(inspectFile(name,bytes,[name],[],[],[],[pin]).join(' '),/exact reviewed provenance/);
 const secret=Buffer.concat([bytes,Buffer.from('ghp_'+'A'.repeat(36))]);
 assert.match(inspectFile(name,secret,allowed,[],[],[],[{...pin,sha256:sha(secret)}]).join(' '),/credential/);
 const unknown='site/unreviewed.png';assert.match(inspectFile(unknown,bytes,[unknown,provenance],[],[],[],[{...pin,path:unknown}]).join(' '),/binary/);
 assert.throws(()=>inspectPng(Buffer.from('not a PNG')),/PNG/);
});

test('optional public readers have distinct icons and retain standalone IDs; catalogue Apple icon stays valid',async()=>{
 const publication=JSON.parse(await readFile(path.join(root,'publication.json'),'utf8'));
 let catalog;try{catalog=JSON.parse(await readFile(path.join(root,'examples/catalog.json'),'utf8'));}catch(e){if(e.code==='ENOENT'&&!publication.files.includes('examples/catalog.json'))return;throw e;}
 const identities=new Set();
 for(const entry of catalog.examples){
  const id=entry.id==='odyssey'?'/odyssey-reader':entry.id==='beside-the-bed'?'/beside-the-bed':'/';
  const result=await checkHomeScreen(path.join(root,entry.directory,'site'),{id});
  assert.ok(!identities.has(result.apple.sha256),'Public readers share a generic home-screen icon');identities.add(result.apple.sha256);
  const names=['apple-touch-icon.png','icon-192.png','icon-512.png'];
  for(const name of names){
   const file=entry.directory+'/site/'+name,pin=publication.reviewedIconFiles.find(f=>f.path===file);
   assert.ok(pin,'Missing icon provenance: '+file);assert.equal(sha(await readFile(path.join(root,file))),pin.sha256);
  }
 }
 const icon=await readFile(path.join(root,'showcase/assets/apple-touch-icon.png'));inspectPng(icon,{size:180});
 for(const name of ['showcase/index.html','showcase/learn/index.html','showcase/library/index.html'])assert.match(await readFile(path.join(root,name),'utf8'),/rel="apple-touch-icon"[^>]*href="\/assets\/apple-touch-icon.png"/);
 assert.equal(identities.size,catalog.examples.length);
});
