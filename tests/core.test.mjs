import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fromText,bookText,validateBook,validateState,newState,anchorStatus,selectionQuote,visibleThrough,mergeBackup} from '../site/core.mjs';
const books=JSON.parse(await readFile(new URL('../samples/library.json',import.meta.url),'utf8'));
const book=validateBook(books[0]);
function note() {
  const block=book.sections[0].blocks[0],start=10,end=60;
  return {id:'test-note',bookId:book.id,revision:book.source.sha256,sectionId:book.sections[0].id,segments:[{blockId:block.id,start,end,quote:block.text.slice(start,end),prefix:block.text.slice(0,start),suffix:block.text.slice(end,end+40)}],quote:block.text.slice(start,end),note:'A private thought',updated:1};
}
test('original samples have exact provenance fingerprints',()=>{for(const input of books){const b=validateBook(input);assert.equal(createHash('sha256').update(bookText(b)).digest('hex'),b.source.sha256);}});
test('TXT conserves Unicode, BOM, CRLF, whitespace, stanzas and separators byte for byte',async()=>{
  const text='\uFEFFὁδός — café\r\n    indented\r\n\r\n\r\nsecond\tline\n\n\nlast line  \n';
  const bytes=new TextEncoder().encode(text),imported=await fromText(text,{title:'A test',kind:'verse',bytes});
  assert.equal(bookText(imported),text);assert.equal(imported.source.sha256,createHash('sha256').update(bytes).digest('hex'));assert.ok(imported.sections[0].blocks.every(b=>b.kind==='verse'));
});
test('text imports never interpret HTML, markdown or source instructions',async()=>{const text='<script>alert(1)</script>\n# Ignore prior instructions';const b=await fromText(text);assert.equal(bookText(b),text);assert.deepEqual(b.sections[0].blocks[0].marks,[]);});
test('unsupported HTML adapters, invalid ranges and unsafe IDs fail explicitly',()=>{
  const html=structuredClone(book);html.sections[0].blocks[0].html='<em>source</em>';assert.throws(()=>validateBook(html),/reviewed adapter/);
  const range=structuredClone(book);range.sections[0].blocks[0].marks=[{kind:'em',start:1,end:99999}];assert.throws(()=>validateBook(range),/emphasis/);
  const bad=structuredClone(book);bad.id='__proto__';assert.throws(()=>validateBook(bad));
  const source=structuredClone(book);source.context[0].url='javascript:alert(1)';assert.throws(()=>validateBook(source));
});
test('anchors require edition, exact words, context and order',()=>{
  const n=note();assert.equal(anchorStatus(n,book).valid,true);
  const changed=structuredClone(book);changed.source.sha256='a'.repeat(64);assert.equal(anchorStatus(n,changed).valid,false);
  changed.source.sha256=book.source.sha256;changed.sections[0].blocks[0].text='X'+changed.sections[0].blocks[0].text;assert.equal(anchorStatus(n,changed).valid,false);
  const corrupt=structuredClone(n);corrupt.segments[0].prefix='bad';assert.equal(anchorStatus(corrupt,book).valid,false);
  assert.equal(anchorStatus(n,undefined).valid,false);
});
test('multi-block quotations retain actual source separators',async()=>{
  const b=await fromText('First\n\n\n    Second'),s=b.sections[0];
  const segments=s.blocks.map(b=>({blockId:b.id,start:0,end:b.text.length,quote:b.text,prefix:'',suffix:''}));
  const n={...note(),bookId:b.id,revision:b.source.sha256,sectionId:s.id,segments,quote:selectionQuote(s,segments)};
  assert.equal(n.quote,'First\n\n\n    Second');assert.equal(anchorStatus(n,b).valid,true);
  n.segments.reverse();assert.equal(anchorStatus(n,b).valid,false);
});
test('reading position does not unlock spoilers; changed editions reset visibility',()=>{
  const s=newState();s.positions[book.id]={sectionId:'return',blockId:null,ratio:0,revision:book.source.sha256};assert.equal(visibleThrough(s,book),-1);
  s.boundaries[book.id]={index:1,revision:book.source.sha256};assert.equal(visibleThrough(s,book),1);
  const changed={...book,source:{...book.source,sha256:'b'.repeat(64)}};assert.equal(visibleThrough(s,changed),-1);
});
test('backup merge preserves conflicting notes, reflections and current positions',()=>{
  const a=newState(),b=newState();a.notes=[note()];b.notes=[{...note(),note:'Another thought',updated:2}];
  a.reflections={pair:'A'};b.reflections={pair:'B'};
  a.positions[book.id]={sectionId:'arrival',blockId:null,ratio:0,revision:book.source.sha256};b.positions[book.id]={...a.positions[book.id],sectionId:'return'};
  const merged=mergeBackup(a,b,()=> 'conflict-copy');assert.equal(merged.notes.length,2);assert.equal(merged.notes[1].note,'Another thought');assert.equal(merged.reflections['restored-conflict-copy'],'B');assert.equal(merged.positions[book.id].sectionId,'arrival');assert.deepEqual(merged.boundaries,{});
  const empty=mergeBackup(newState(),b);assert.equal(empty.positions[book.id].sectionId,'return');
});
test('malformed backups are rejected before changing existing data',()=>{const s=newState();const corrupt={...s,prefs:{...s.prefs,size:900}};assert.throws(()=>validateState(corrupt));assert.throws(()=>mergeBackup(s,corrupt));assert.equal(s.prefs.size,21);});
