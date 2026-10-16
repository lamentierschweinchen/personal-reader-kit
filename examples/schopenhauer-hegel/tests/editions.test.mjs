import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateBook,anchorStatus,excerptSection} from '../site/core.mjs';
import {verifiedEditions} from '../scripts/edition-assets.mjs';
import {sessions,sessionPassage} from '../site/lectures.mjs';
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
test('source peculiarities remain; this adapter does not modernize or silently repair',()=>{
 const sch=books.find(b=>b.id==='schopenhauer');
 assert.ok(sch.sections.some(s=>s.title==='Stratagem XL.'));
 assert.ok(sch.sections.flatMap(s=>s.blocks).some(b=>b.text.includes('It it clear')));
 assert.ok(sch.sections.flatMap(s=>s.blocks).some(b=>b.text.includes('{Greek: logos}')));
 assert.ok(books[0].sections.flatMap(s=>s.blocks).some(b=>b.text.includes('ἐπιστήμη')));
});
