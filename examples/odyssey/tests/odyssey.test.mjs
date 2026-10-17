import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateBook,verifyBookAssets,sha256,newState,passageAt,excerptSection} from '../site/core.mjs';
import {canonical,createBundle,validateBundle} from '../site/bundle.mjs';
const book=JSON.parse(await readFile(new URL('../edition/book.json',import.meta.url),'utf8'));
const pin=JSON.parse(await readFile(new URL('../edition.json',import.meta.url),'utf8'));
test('complete Odyssey profile preserves all 24 books, apparatus, links and portable cover',async()=>{
 const validated=validateBook(book);assert.deepEqual(validated,book);await verifyBookAssets(validated);
 assert.equal(book.sections.filter(s=>s.role==='narrative').length,24);
 assert.deepEqual(book.sections.filter(s=>s.role==='narrative').map(s=>s.id),Array.from({length:24},(_,i)=>'book-'+String(i+1).padStart(2,'0')));
 assert.equal(book.sections.find(s=>s.id==='footnotes').blocks.filter(b=>/^(?:\[\d+\]|29\[\])\n/.test(b.text)).length,187);
 assert.ok(book.sections.find(s=>s.id==='footnotes').blocks.some(b=>b.text.startsWith('29[]\n')),'Preserve the source’s unusual note 29 label.');
 assert.equal(await sha256(new TextEncoder().encode(canonical(validated))),pin.canonicalEditionSha256);
 const bundle=await createBundle({books:[book],state:newState()});assert.deepEqual((await validateBundle(bundle)).books[0],book);
});
test('source profile rejects broken links, hidden extra fields and corrupt cover bytes',async()=>{
 const b=structuredClone(book);const block=b.sections.find(s=>s.id==='book-01').blocks.find(b=>b.links);block.links[0].block='missing';assert.throws(()=>validateBook(b),/Missing source link/);
 const bad=structuredClone(book);bad.assets[0].sha256='0'.repeat(64);await assert.rejects(verifyBookAssets(validateBook(bad)),/checksum/);
 const extra=structuredClone(book);extra.sections[0].blocks[0].script='alert(1)';assert.throws(()=>validateBook(extra),/Unsupported/);
});
test('clipped excerpts retain valid source-link offsets and literal source text',()=>{
 const section=book.sections.find(s=>s.id==='book-01'),block=section.blocks.find(b=>b.links),link=block.links[0],start=Math.max(0,link.start-20),end=link.end+10;
 const excerpt=excerptSection(passageAt(book,section,block,start,end),book).blocks[0];
 assert.equal(excerpt.text,block.text.slice(start,end));assert.equal(excerpt.links[0].start,link.start-start);assert.equal(excerpt.links[0].end,link.end-start);
});
