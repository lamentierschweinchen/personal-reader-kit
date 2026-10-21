import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifiedEdition} from '../scripts/build.mjs';
import {prepareSourcePresentation,sourceContext} from '../site/edition-copy.mjs';
import {canonical,createBundle,validateBundle,planBundleRestore} from '../site/bundle.mjs';
import {newState,passageAt,anchorStatus} from '../site/core.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const {books,company}=await verifiedEdition();
test('complete approved editions preserve every section, verse block, notice and exact object',async()=>{
  const manifest=JSON.parse(await readFile(new URL('../edition.json',import.meta.url)));
  assert.deepEqual(books.map(b=>b.id),['nietzsche','epicurus']);
  assert.deepEqual(books[0].sections.map(s=>s.id),['title','editorial-note','preface','prelude','book-1','book-2','book-3','book-4','book-5','songs']);
  for(const [i,book] of books.entries()){
    assert.equal(sha(canonical(book)),manifest.books[i].canonicalSha256);
    assert.equal(book.sections.flatMap(s=>s.blocks).length,manifest.books[i].blocks);
    assert.equal(book.sections.flatMap(s=>s.blocks).filter(b=>b.kind==='verse').length,manifest.books[i].verseBlocks);
    assert.equal(book.context.filter(c=>c.label.startsWith('Digital source notices')).length,manifest.books[i].sourceNotices);
    assert.ok(book.context.some(c=>c.text.includes('FULL PROJECT GUTENBERG')));
  }
});
test('one active comparison keeps §§45/370 and all source-note destinations',()=>{
  assert.equal(company.encounters.length,1);assert.equal(company.encounters[0].id,'still-water');
  assert.equal(Object.keys(company.locations).length,383);assert.equal(company.notes.length,18);
  for(const pair of [company.encounters[0].passages,company.encounters[0].alternate.passages]){
    assert.deepEqual(pair.map(p=>p.bookId),['nietzsche','epicurus']);
    for(const p of pair)assert.equal(anchorStatus(p,books.find(b=>b.id===p.bookId)).valid,true);
  }
  assert.equal(company.encounters[0].passages[0].segments[0].blockId,company.locations['45'].block);
  assert.equal(company.encounters[0].alternate.passages[0].segments[0].blockId,company.locations['370'].block);
});
test('current source wording applies only to the verified built-in edition, without changing portable metadata',async()=>{
  const before=canonical(books[0]);await prepareSourcePresentation(books);
  const old=books[0].context[2],shown=sourceContext(books[0],old);
  assert.equal(shown.label,'Edition rights');assert.doesNotMatch(shown.text,/publication is not authorized|private and local/);
  assert.match(shown.text,/public domain in the USA/);assert.match(shown.text,/not worldwide clearance/);
  assert.equal(canonical(books[0]),before);assert.match(old.text,/publication is not authorized/);
  for(const context of books[0].context.filter(c=>c.label.startsWith('Digital source notices')))assert.equal(sourceContext(books[0],context),context);
  const custom=structuredClone(books[0]);custom.context[2].text='An original custom rights note.';
  await prepareSourcePresentation([custom]);assert.equal(sourceContext(custom,custom.context[2]).text,'An original custom rights note.');
});
test('complete edition bundles restore unchanged notes, positions and context; altered same-ID editions refuse',async()=>{
  const state=newState(),b=books[0],s=b.sections.find(s=>s.id==='book-1'),p=passageAt(b,s,s.blocks[1]);
  state.notes=[{...p,id:'original-fixture-note',note:'Original recovery fixture.',updated:1}];
  state.positions[b.id]={sectionId:s.id,blockId:s.blocks[1].id,ratio:0.3,offset:1,inset:4,revision:b.source.sha256};state.lastBook=b.id;
  const bundle=await validateBundle(await createBundle({books,state},books.map(b=>b.id)));
  assert.deepEqual(bundle.books,books);assert.deepEqual(bundle.state.notes,state.notes);assert.deepEqual(bundle.state.positions,state.positions);
  const plan=planBundleRestore(bundle,{books:[],state:newState()},books);assert.equal(plan.conflicts.length,0);assert.equal(plan.addedNotes,1);
  const altered=structuredClone(books);altered[0].context[2].text='Another edition context.';
  assert.equal(planBundleRestore(bundle,{books:[],state:newState()},altered).conflicts.length,1);
});
