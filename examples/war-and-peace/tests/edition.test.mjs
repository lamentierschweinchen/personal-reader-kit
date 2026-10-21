import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateBook,newState,passageAt,anchorStatus} from '../site/core.mjs';
import {createBundle,validateBundle} from '../site/bundle.mjs';
import {assets,editionAssets,icons,fonts,outputFiles} from '../scripts/build.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url)),hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=await read('edition/library.json'),book=validateBook(JSON.parse(bytes)[0]);
const structure=JSON.parse(await read('edition/structure.json')),companion=JSON.parse(await read('edition/companion.json')),lock=JSON.parse(await read('edition-lock.json'));
test('the complete reviewed Maude novel and chapter grouping are unchanged',async()=>{
  assert.equal(hash(bytes),'d1141e0adb219de52c15975188fb49c6b04f1154499fc88b769dd443e3053699');
  assert.equal(book.source.sha256,'68fe0f65e6fe4f26c37bf304ed560b04b1bc0a4b605509128d88ce582ee13001');
  assert.equal(hash(await read('edition/structure.json')),'5d51c04f94a6d958c4e8f0203209c6365dab18a8af7e4d1b3856e37d50408a2c');
  assert.equal(book.sections.length,365);const blocks=book.sections.flatMap(s=>s.blocks);
  assert.equal(blocks.length,11395);assert.equal(blocks.filter(b=>b.kind==='note').length,136);
  assert.equal(blocks.reduce((n,b)=>n+b.marks.length,0),976);assert.equal(blocks.filter(b=>b.layout==='fixed').length,2);
  assert.equal(structure.groups.length,17);assert.deepEqual(structure.groups.flatMap(g=>g.sections),book.sections.map(s=>s.id));
  assert.deepEqual(structure.chapters.map(c=>c.id),book.sections.map(s=>s.id));assert.equal(book.sections.at(-1).id,'part-17-chapter-12');
});
test('all twelve images have exact pins and scene anchors; the portrait reveals no story scene',async()=>{
  const inventory=JSON.parse(await read('docs/EDITION-INVENTORY.json')),plates=[companion.portrait,...companion.pictures];
  assert.equal(plates.length,12);assert.equal(companion.portrait.through,null);assert.equal(companion.portrait.block,null);
  assert.equal(new Set(plates.map(p=>p.file)).size,12);assert.equal(inventory.album.requests.length,48);
  for(const p of plates){
    const pin=inventory.album.derivatives.find(d=>d.file===p.file);assert.ok(pin);assert.equal(hash(await read('edition/'+p.file)),pin.sha256);
    assert.equal(p.width,pin.width);assert.equal(p.height,pin.height);
    if(p.through){const section=book.sections.find(s=>s.id===p.through);assert.ok(section);assert.ok(section.blocks.some(b=>b.id===p.block));}
  }
  assert.equal(companion.pictures.find(p=>p.id==='petya').caption.some(t=>t.includes('still in the saddle')),true);
  assert.equal(companion.pictures.find(p=>p.id==='kutuzov').caption.some(t=>t.includes('Filí')),true);
  assert.equal(companion.pictures.find(p=>p.id==='tilsit').history.sources.length>0,true);
});
test('the entire edition, fonts and original icons match the explicit build inventory',async()=>{
  for(const pin of lock.files){const b=await read(pin.path);assert.equal(b.length,pin.bytes);assert.equal(hash(b),pin.sha256);}
  assert.deepEqual((await readdir(new URL('../edition/',import.meta.url))).sort(),editionAssets.filter(n=>!fonts.includes(n)).sort());
  assert.deepEqual((await readdir(new URL('../site/',import.meta.url))).sort(),[...assets,...icons,...fonts].sort());
  assert.equal(outputFiles.length,38);assert.equal(new Set(outputFiles).size,38);assert.ok(!outputFiles.includes('source-cover.jpg'));
  assert.match((await read('site/Literata-OFL.txt')).toString(),/SIL OPEN FONT LICENSE Version 1.1/);
});
test('exact-edition bundles retain all source notices and anchored records without importing picture permission',async()=>{
  const section=book.sections[0],passage=passageAt(book,section,section.blocks[0],5,80),state=newState();
  state.notes=[{...passage,id:'original-test-record',note:'Original test note.',updated:1}];
  const bundle=await validateBundle(await createBundle({books:[book],state}));
  assert.deepEqual(bundle.books,[book]);assert.equal(anchorStatus(bundle.state.notes[0],book).valid,true);
  assert.ok(bundle.books[0].context.some(n=>n.text.includes('FULL PROJECT GUTENBERG LICENSE')));
  assert.deepEqual(bundle.state.boundaries,{});assert.equal(JSON.stringify(bundle).includes('plate-portrait.webp'),false);
});
test('published source presentation keeps notices and credits without the unidentified cover or local-only claim',async()=>{
  const edition=(await read('site/edition.mjs')).toString(),app=(await read('site/app.mjs')).toString();
  assert.ok(companion.about.some(n=>n.paragraphs.some(p=>p.includes('faithful scans'))));
  assert.doesNotMatch(JSON.stringify(companion.about),/not been cleared|remain for local personal|source cover/);
  assert.match(edition,/Full source notices/);assert.doesNotMatch(edition,/source-cover\.jpg/);
  assert.match(app,/war-and-peace-maude:source-notice:v1:/);assert.match(app,/source-notices/);
  assert.doesNotMatch(app,/keep this local reader project|Reload while the local preview/);
});
