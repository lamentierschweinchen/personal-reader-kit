import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateBook,passageAt,excerptSection,anchorStatus} from '../site/core.mjs';
const book=validateBook(JSON.parse(await readFile(new URL('../edition/library.json',import.meta.url),'utf8'))[0]);
test('complete Austen edition has 61 ordered chapters and 164 pinned images',async()=>{
  assert.equal(book.sections.length,66);
  assert.deepEqual(book.sections.filter(s=>s.id.startsWith('chapter-')).map(s=>s.id),Array.from({length:61},(_,i)=>`chapter-${i+1}`));
  const inventory=JSON.parse(await readFile(new URL('../edition/inventory.json',import.meta.url),'utf8'));
  const images=book.sections.flatMap(s=>s.blocks.flatMap(b=>[...(b.figures||[]),...(b.initial?[b.initial]:[])]));
  assert.equal(images.length,164);assert.equal(new Set(images.map(i=>i.src)).size,164);
  for(const f of inventory.assets){const bytes=await readFile(new URL('../'+f.path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256);assert.equal(bytes.length,f.bytes);}
  assert.ok(book.sections.at(-1).blocks.some(b=>b.text.includes('1.E.6.')));
});
test('source extensions are strict and passage clipping retains character identity',()=>{
  const copy=structuredClone(book),block=copy.sections.flatMap(s=>s.blocks).find(b=>b.initial);
  block.initial.src='https://unreviewed.example/image.png';assert.throws(()=>validateBook(copy),/illustration/);
  const s=book.sections.find(s=>s.id==='chapter-13'),b=s.blocks.find(b=>b.initial),p=passageAt(book,s,b,1,120);
  assert.equal(anchorStatus(p,book).valid,true);const clipped=excerptSection(p,book).blocks[0];
  assert.equal(clipped.text,b.text.slice(1,120));assert.equal(clipped.initial,undefined);
  assert.ok(b.text.startsWith('“I hope'));
});
