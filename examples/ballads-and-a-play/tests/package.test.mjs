import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {build,verifiedEdition,bookIds,outputFiles} from '../scripts/build.mjs';
import {startServer} from '../scripts/serve.mjs';
import {newState,passageAt} from '../site/core.mjs';
import {createBundle,validateBundle,canonical} from '../site/bundle.mjs';
import {mergeLibrary} from '../site/library.mjs';
import {prepareBalladShareRights,balladContextPresentation,pgNoticeKey,PG_NOTICE} from '../site/edition-rights.mjs';
import {passageShareData} from '../site/share.mjs';
import {passageCardData,layoutPassageCard} from '../site/share-card.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
test('reviewed library keeps all twelve full editions and survives exact bundles and conflicting metadata',async()=>{
 const {books}=await verifiedEdition();assert.deepEqual(books.map(b=>b.id),bookIds);
 for(const id of ['iphigenie-de','iphigenie-en'])assert.equal(books.find(b=>b.id===id).sections.length,21);
 const pg=books.find(b=>b.id==='iphigenie-en');assert.ok(pg.context.map(c=>c.text).join(' ').replace(/\s+/g,' ').includes(PG_NOTICE));assert.ok(canonical(pg).includes('THE FULL PROJECT GUTENBERG LICENSE'));assert.ok(canonical(pg).includes('Section 3.'));
 for(const [id,count]of [['taucher-de',27],['taucher-en',27],['kraniche-de',23],['kraniche-en',23]])assert.equal(books.find(b=>b.id===id).sections[0].blocks.filter(b=>b.kind==='verse').length,count);
 const state=newState(),p=passageAt(pg,pg.sections[0],pg.sections[0].blocks.find(b=>b.text));state.notes=[{...p,id:'private-test',note:'Private test note.',updated:1}];
 const restored=await validateBundle(await createBundle({books,state}));assert.equal(canonical(restored.books),canonical(books));assert.deepEqual(restored.state,state);
 const changed=structuredClone(pg);changed.context.push({label:'Test',kind:'source',through:null,text:'Changed metadata.'});const merged=mergeLibrary([changed],[pg]);assert.equal(merged.books[0],pg);assert.deepEqual(merged.conflicts,[{stored:pg,supplied:changed}]);assert.equal(canonical(merged.books[0]),canonical(pg));
});
test('verified share credits remain bounded to exact snapshots, including PG copy and honest card limits',async()=>{
 const {books}=await verifiedEdition();await prepareBalladShareRights(books);
 for(const id of ['erlkoenig-de','lenore-de','taucher-de','kraniche-de','iphigenie-en']){
  const b=books.find(b=>b.id===id),section=b.sections.find(s=>s.blocks.some(v=>v.kind==='verse')),block=section.blocks.find(v=>v.kind==='verse'),p=passageAt(b,section,block,0,Math.min(16,block.text.length));p.note='SENTINEL-PRIVATE';
  const shared=passageShareData(p,b);assert.ok(!shared.text.includes('SENTINEL-PRIVATE'));
  if(id==='iphigenie-en'){assert.ok(shared.text.includes(PG_NOTICE));assert.ok(shared.text.includes('https://www.gutenberg.org/policy/license.html'));assert.match(pgNoticeKey(b),/^ballads-pg-notice-[a-f0-9]{64}$/);}
  else{assert.ok(shared.text.includes('https://creativecommons.org/licenses/by-sa/4.0/'));assert.ok(shared.text.includes('/ballads/sources/#'+id));assert.equal(pgNoticeKey(b),null);}
  try{const card=passageCardData(p,b),layout=layoutPassageCard(card,(text,size)=>text.length*size*0.5);assert.ok(layout.height<=1920);assert.ok(card.attribution.join('\n').includes(id==='iphigenie-en'?PG_NOTICE:'CC BY-SA 4.0'));}catch(e){assert.match(e.message,/legible card|fixed layout|shaped layout|full source attribution does not fit/);}
  const custom=structuredClone(b);custom.context.push({label:'Custom',kind:'source',through:null,text:'Changed.'});await prepareBalladShareRights([custom]);assert.throws(()=>passageShareData(p,custom),/credits could not be verified/);assert.equal(pgNoticeKey(custom),null);assert.equal(balladContextPresentation(custom,custom.context.at(-1)),custom.context.at(-1));
 }
});
test('tampered editions, icons, source notices and symlinked inputs fail before replacing a prior build',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'ballads-public-test-'));
 try{
  for(const name of ['scripts','site','edition','docs','package.json','vercel.json','edition-lock.json'])await cp(path.join(root,name),path.join(dir,name),{recursive:true});
  const run=()=>spawnSync(process.execPath,['scripts/build.mjs'],{cwd:dir,encoding:'utf8'});assert.equal(run().status,0);const original=await readFile(path.join(dir,'dist/library.json'));
  for(const name of ['edition/taucher-en.json','site/icon-192.png','site/sources/index.html']){const file=path.join(dir,name),bytes=await readFile(file);await writeFile(file,Buffer.concat([bytes,Buffer.from(' ')]));const result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/Reviewed size changed/);assert.deepEqual(await readFile(path.join(dir,'dist/library.json')),original);await writeFile(file,bytes);}
  const edition=path.join(dir,'edition');await cp(edition,path.join(dir,'real-edition'),{recursive:true});await rm(edition,{recursive:true});await symlink('real-edition',edition);assert.notEqual(run().status,0);assert.deepEqual(await readFile(path.join(dir,'dist/library.json')),original);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('loopback server exposes only an immutable reviewed output snapshot and nested Sources',async()=>{
 const built=await build();assert.deepEqual(built.files,outputFiles);const server=await startServer();
 try{
  const sources=await fetch(server.url+'/sources/');assert.equal(sources.status,200);const text=await sources.text();assert.ok(text.includes('THE FULL PROJECT GUTENBERG LICENSE'));
  for(const denied of ['/edition/iphigenie-en.json','/.reader/private/source.txt','/.git/config','/scripts/build.mjs'])assert.equal((await fetch(server.url+denied)).status,404);
  await writeFile(path.join(root,'dist/sources/index.html'),'Changed after snapshot');assert.equal(await(await fetch(server.url+'/sources/')).text(),text);assert.equal((await fetch(server.url+'/',{method:'POST'})).status,405);
 }finally{await server.close();await build();}
});
