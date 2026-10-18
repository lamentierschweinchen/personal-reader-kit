import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateBook,anchorStatus,excerptSection} from '../site/core.mjs';
import {verifiedEditions} from '../scripts/edition-assets.mjs';
import {sessions,sessionPassage,readingCues,cuePassages} from '../site/lectures.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const books=await verifiedEditions(root);
test('reviewed real editions preserve every source image, linked note and paired anchor',()=>{
 assert.deepEqual(books.map(b=>b.sections.length),[62,49]);
 const hegel=books.find(b=>b.id==='hegel');
 assert.equal(hegel.sections.flatMap(s=>s.blocks).filter(b=>b.illustration).length,5);
 assert.equal(hegel.sections.flatMap(s=>s.blocks).flatMap(b=>b.links||[]).filter(l=>l.kind==='note').length,173);
 assert.equal(hegel.sections.flatMap(s=>s.blocks).filter(b=>b.table).length,4);
 for(const session of sessions)for(const side of session.sides){const p=sessionPassage(side,books),b=books.find(b=>b.id===side.book);assert.equal(anchorStatus(p,b).valid,true);const excerpt=excerptSection(p,b);assert.equal(excerpt.blocks.map(b=>b.text+b.after).join(''),p.quote);}
});
test('source-aware contracts reject dangling links and active or unreviewed image formats',()=>{
 let b=structuredClone(books[0]),block=b.sections.flatMap(s=>s.blocks).find(b=>b.links?.length);block.links[0].blockId='absent';assert.throws(()=>validateBook(b),/target is missing/);
 b=structuredClone(books[0]);b.sections[0].blocks[0].illustration.data='data:image/svg+xml,<svg onload=alert(1) />';assert.throws(()=>validateBook(b),/illustration/);
 b=structuredClone(books[0]);b.sections.flatMap(s=>s.blocks).find(b=>b.table).table.rows[0][0].end=999999;assert.throws(()=>validateBook(b),/table cell/);
});
test('argument cues are exact, unique landmarks inside the complete paired readings',()=>{
 for(const session of sessions)for(const [index,cue] of readingCues[session.id].entries()){
  const pair=cuePassages(session,index,books);
  for(const [i,p] of pair.entries()){
   assert.equal(p.quote,cue.targets[i].text);
   assert.equal(anchorStatus(p,books.find(b=>b.id===p.bookId)).valid,true);
   assert.ok(sessionPassage(session.sides[i],books).quote.includes(p.quote));
  }
 }
 const changed=structuredClone(books),block=changed[0].sections.flatMap(s=>s.blocks).find(b=>b.id==='h0088');
 block.text=block.text.replace(readingCues.disagreement[0].targets[0].text,'A different sentence.');
 assert.throws(()=>cuePassages(sessions[0],0,changed),/does not match/);
 assert.throws(()=>cuePassages(sessions[0],99,books),/Unknown reading cue/);
});
test('source peculiarities remain; this adapter does not modernize or silently repair',()=>{
 const sch=books.find(b=>b.id==='schopenhauer');
 assert.ok(sch.sections.some(s=>s.title==='Stratagem XL.'));
 assert.ok(sch.sections.flatMap(s=>s.blocks).some(b=>b.text.includes('It it clear')));
 assert.ok(sch.sections.flatMap(s=>s.blocks).some(b=>b.text.includes('{Greek: logos}')));
 assert.ok(books[0].sections.flatMap(s=>s.blocks).some(b=>b.text.includes('ἐπιστήμη')));
});
