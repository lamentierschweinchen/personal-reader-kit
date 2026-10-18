import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateBook,passageAt,anchorStatus} from '../site/core.mjs';
import {createBundle,validateBundle} from '../site/bundle.mjs';
import {newState} from '../site/core.mjs';
const library=JSON.parse(await readFile(new URL('../edition/library.json',import.meta.url),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
test('both complete works retain verse, fixed accounts, images and source licence',async()=>{
 const [walden,civil]=library.map(validateBook);assert.equal(walden.sections.length,20);assert.equal(civil.sections.length,2);
 const blocks=library.flatMap(b=>b.sections.filter(s=>s.id!=='source-license').flatMap(s=>s.blocks));
 assert.equal(blocks.filter(b=>b.kind==='verse').length,38);assert.equal(blocks.filter(b=>b.sourceStyle==='account').length,8);
 assert.equal(blocks.flatMap(b=>b.marks).filter(m=>m.kind==='em').length,280);
 assert.equal(blocks.filter(b=>b.image).length,2);
 for(const b of library)assert.match(b.sections.at(-1).blocks.at(-1).text,/THE FULL PROJECT GUTENBERG/);
 const review=JSON.parse(await readFile(new URL('../publication.json',import.meta.url),'utf8')).reviewedEdition;
 for(const b of blocks.filter(b=>b.image)){assert.equal(digest(Buffer.from(b.image.base64,'base64')),b.image.sha256);const im=review.images.find(x=>x.sha256===b.image.sha256);assert.ok(im);assert.equal(digest(await readFile(new URL('../edition/'+im.file,import.meta.url))),im.sha256);}
 const survey=walden.sections.find(s=>s.id==='chap17');const idx=survey.blocks.findIndex(b=>b.image);assert.match(survey.blocks[idx+1].text,/As I was desirous to recover/);
});
test('image contract is bounded and fails closed for active or unexplained content',()=>{
 for(const edit of [b=>b.sections[0].blocks.find(x=>x.image).image.mediaType='image/svg+xml',b=>b.sections[0].blocks.find(x=>x.image).image.src='https://example.org/tracker',b=>b.sections[0].blocks[0].sourceStyle='unknown']){const b=structuredClone(library[0]);edit(b);assert.throws(()=>validateBook(b));}
});
test('an actual long-paragraph anchor and both illustrations survive the portable bundle',async()=>{
 const book=library[0],section=book.sections.find(s=>s.id==='chap02'),block=section.blocks.reduce((a,b)=>a.text.length>b.text.length?a:b),p=passageAt(book,section,block,block.text.length-100,block.text.length-40),state=newState();
 state.notes=[{...p,id:'real-source-note',note:'Original QA note',updated:1}];
 const bundle=await createBundle({books:library,state});const checked=await validateBundle(bundle);assert.equal(anchorStatus(checked.state.notes[0],checked.books[0]).valid,true);assert.deepEqual(checked.books,library.map(validateBook));
});

test('account qualifications locate exact source ranges and original totals',async()=>{
 const {accountSheets,readings}=await import('../site/companion.mjs');
 const section=library[0].sections.find(s=>s.id==='chap02');
 const totalBlocks={house:'chap02-b77',food:'chap02-b91',outgoes:'chap02-b95'};
 for(const sheet of accountSheets){
  assert.equal(section.blocks.find(b=>b.id===sheet.ledger)?.sourceStyle,'account');
  assert.ok(section.blocks.find(b=>b.id===totalBlocks[sheet.id]).text.replace(/\s/g,'').includes(sheet.total));
  for(const ref of sheet.evidence){const block=section.blocks.find(b=>b.id===ref.block);assert.ok(block.text.includes(ref.needle));assert.equal(block.text.indexOf(ref.needle),block.text.lastIndexOf(ref.needle));}
 }
 for(const reading of readings){const b=library.find(b=>b.id===reading.book),s=b.sections.find(s=>s.id===reading.section);for(const ref of reading.refs)assert.ok(s.blocks.find(b=>ref.image?b.image:b.text.includes(ref.needle)));}
});
