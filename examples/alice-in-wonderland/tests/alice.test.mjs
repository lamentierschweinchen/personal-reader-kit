import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateBook,newState,passageAt,anchorStatus,excerptSection,bookText} from '../site/core.mjs';
import {createBundle,validateBundle} from '../site/bundle.mjs';
import {inspectEdition} from '../scripts/edition.mjs';
const edition=JSON.parse(await readFile(new URL('../edition/library.json',import.meta.url),'utf8'))[0];
test('reviewed Alice has every source image, chapter, correction and shaped poem',async()=>{
  const {book,receipt}=await inspectEdition(new URL('../',import.meta.url));
  assert.equal(book.sections.length,19);assert.equal(book.assets.length,38);
  assert.equal(receipt.counts.imageUses,43);assert.equal(receipt.counts.transcriberNotes,13);
  assert.deepEqual(book.sections.filter(s=>s.id.startsWith('chapter-')).map(s=>s.id),Array.from({length:12},(_,i)=>`chapter-${String(i+1).padStart(2,'0')}`));
  const tail=book.sections.find(s=>s.id==='chapter-03').blocks.find(b=>b.lines?.some(l=>l.scale!==1));
  assert.equal(tail.lines.length,50);assert.equal(tail.text.split('\n').length,50);
  const nothing=tail.text.split('\n').indexOf('nothing');assert.equal(tail.lines[nothing].scale,1);
  const repeat=tail.text.split('\n').indexOf('sir, With');assert.equal(tail.lines[repeat].scale,.79);
  assert.match(bookText(book),/THE FULL PROJECT GUTENBERG/);
});
test('illustrated contract rejects unreviewed fields, remote images and broken line geometry',()=>{
  for(const mutate of [b=>b.assets[0].mime='image/svg+xml',b=>b.assets[0].url='https://example.invalid/tracker',b=>b.assets[0].data='https://example.invalid/picture',b=>b.sections[0].blocks.find(b=>b.figure).figure.asset='missing',b=>b.sections.find(s=>s.id==='proem').blocks[0].lines.pop(),b=>b.sections[0].blocks[0].pages=[{offset:99999,label:'1'}]]){
    const bad=structuredClone(edition);mutate(bad);assert.throws(()=>validateBook(bad));
  }
});
test('partial shaped-verse quotations retain exact text, marks and matching line geometry',()=>{
  const book=validateBook(edition),section=book.sections.find(s=>s.id==='chapter-03'),tail=section.blocks.find(b=>b.lines?.some(l=>l.scale!==1));
  const start=tail.text.indexOf('will prose-')+3,end=tail.text.indexOf('must have')+4;
  const p=passageAt(book,section,tail,start,end),excerpt=excerptSection(p,book).blocks[0];
  assert.equal(anchorStatus(p,book).valid,true);assert.equal(excerpt.text,p.quote);
  assert.equal(excerpt.lines.length,excerpt.text.split('\n').length);
  assert.equal(excerpt.lines[0].scale,.94);
});
test('exact portable bundles carry the 38 image byte payloads and source metadata',async()=>{
  const bundle=await createBundle({state:newState(),books:[edition]});
  const restored=await validateBundle(JSON.parse(JSON.stringify(bundle)));
  assert.deepEqual(restored.books[0],validateBook(edition));
  assert.equal(restored.books[0].assets.length,38);
  const bad=structuredClone(bundle);bad.books[0].assets[0].data=bad.books[0].assets[0].data.slice(4);await assert.rejects(()=>validateBundle(bad),/checksum/);
});
