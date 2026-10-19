import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fromText,bookText,validateBook,validateState,newState,anchorStatus,selectionQuote,visibleThrough,mergeBackup,passageAt,passagesOverlap,extendPassage} from '../site/core.mjs';
const books=JSON.parse(await readFile(new URL('../samples/library.json',import.meta.url),'utf8'));
const book=validateBook(books[0]);
function note() {
  const block=book.sections[0].blocks[0],start=10,end=60;
  return {id:'test-note',bookId:book.id,revision:book.source.sha256,sectionId:book.sections[0].id,segments:[{blockId:block.id,start,end,quote:block.text.slice(start,end),prefix:block.text.slice(0,start),suffix:block.text.slice(end,end+40)}],quote:block.text.slice(start,end),note:'A private thought',updated:1};
}
test('original samples have exact provenance fingerprints',()=>{for(const input of books){const b=validateBook(input);assert.equal(createHash('sha256').update(bookText(b)).digest('hex'),b.source.sha256);}});
test('TXT conserves Unicode, BOM, CRLF, whitespace, stanzas and separators byte for byte',async()=>{
  const text='\uFEFFὁδός — café ↗ → ➡️\r\n    indented\r\n\r\n\r\nsecond\tline\n\n\nlast line  \n';
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
test('unsupported source structure is rejected instead of silently stripped',()=>{
  for(const target of ['book','section','block']) {
    const source=structuredClone(book),node=target==='book'?source:target==='section'?source.sections[0]:source.sections[0].blocks[0];
    node.footnotes=[{text:'An original source note'}];assert.throws(()=>validateBook(source),/cannot be silently discarded/);
  }
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
test('explicit extension preserves the union, source gaps and original note independence',async()=>{
  const b=await fromText('Before these overlapping words finish.\n\n\nAnother original paragraph.'),s=b.sections[0];
  const old={...passageAt(b,s,s.blocks[0],7,24),id:'kept',note:'Keep this comment.',updated:1};
  const larger=passageAt(b,s,s.blocks[0],0,30),extended=extendPassage(old,larger,b);
  assert.equal(extended.quote,s.blocks[0].text.slice(0,30));assert.equal(anchorStatus(extended,b).valid,true);assert.equal(old.note,'Keep this comment.');assert.equal(old.quote,'these overlapping');
  const across={...passageAt(b,s,s.blocks[0],15),segments:[...passageAt(b,s,s.blocks[0],15).segments,...passageAt(b,s,s.blocks[1],0,7).segments]};across.quote=selectionQuote(s,across.segments);
  const union=extendPassage(old,across,b);assert.equal(union.quote,s.blocks[0].text.slice(7)+'\n\n\nAnother');assert.equal(anchorStatus(union,b).valid,true);
  assert.equal(passagesOverlap(old,{...larger,revision:'f'.repeat(64)}),false);assert.throws(()=>extendPassage(old,{...larger,revision:'f'.repeat(64)},b),/edition changed/);
  assert.throws(()=>extendPassage(old,passageAt(b,s,s.blocks[1]),b),/overlapping/);
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
test('quotations retain separators carried by empty source blocks',()=>{
  const section={id:'stanzas',blocks:[{id:'a',text:'One',after:'\n\n'},{id:'gap',text:'',after:'\n\n'},{id:'b',text:'Two',after:''}]};
  const segments=[{blockId:'a',start:0,end:3,quote:'One',prefix:'',suffix:''},{blockId:'b',start:0,end:3,quote:'Two',prefix:'',suffix:''}];
  const source={...book,sections:[section]},n={...note(),sectionId:'stanzas',segments,quote:'One\n\n\n\nTwo'};
  assert.equal(selectionQuote(section,segments),n.quote);assert.equal(anchorStatus(n,source).valid,true);
  source.sections[0].blocks[1].after='\n';assert.equal(anchorStatus(n,source).valid,false);
});
test('restoring the same conflict backup twice is idempotent',()=>{
  const current=newState(),backup=newState();current.notes=[note()];backup.notes=[{...note(),note:'A different saved revision',updated:2}];
  current.reflections.pair='Current';backup.reflections.pair='Recovered';
  const once=mergeBackup(current,backup),twice=mergeBackup(once,backup);
  assert.deepEqual(twice,once);assert.equal(once.notes.length,2);assert.equal(Object.keys(once.reflections).length,2);
  // Property ordering in a JSON export is not a new note revision.
  const reordered={...backup,notes:backup.notes.map(n=>Object.fromEntries(Object.entries(n).reverse()))};
  assert.deepEqual(mergeBackup(twice,reordered),once);
});

test('companion occurrences include every literal match and preserve clipped emphasis',async()=>{
  const {findOccurrences,passageAt,excerptSection}=await import('../site/core.mjs');
  const book=await fromText('room room Room\n    雨雨\n\nAnother room.',{kind:'verse'});
  book.sections[0].blocks[0].marks=[{kind:'em',start:0,end:9}];
  const state=newState();state.boundaries[book.id]={index:0,revision:book.source.sha256};
  const result=findOccurrences([book],state,'room');assert.equal(result.count,3);assert.deepEqual(result.hits.map(h=>h.offset),[0,5,8]);
  assert.equal(findOccurrences([book],newState(),'room').count,0);assert.equal(findOccurrences([book],state,'雨').count,2);
  const p=passageAt(book,book.sections[0],book.sections[0].blocks[0],5,13),excerpt=excerptSection(p,book);
  assert.equal(excerpt.blocks[0].text,'room Roo');assert.deepEqual(excerpt.blocks[0].marks,[{kind:'em',start:0,end:4}]);
  const backup=newState();backup.connections=[{id:'pair',passages:[p,p],note:'Two independent readings.',updated:1}];
  const merged=mergeBackup(state,backup,()=> 'conflict');assert.equal(merged.connections.length,1);assert.equal(mergeBackup(merged,backup).connections.length,1);
  const changed=structuredClone(backup);changed.connections[0].note='Another reading.';
  const conflicts=mergeBackup(merged,changed,()=> 'conflict');assert.equal(conflicts.connections.length,2);assert.equal(mergeBackup(conflicts,changed).connections.length,2);
  assert.equal(anchorStatus(conflicts.connections[0].passages[0],{...book,source:{...book.source,sha256:'f'.repeat(64)}}).valid,false);
});

test('search excerpts prefer whole ordinary words and disclose omission without changing source anchors',async()=>{
  const {findOccurrences}=await import('../site/core.mjs');
  const text='Original context words before the passage. '.repeat(5)+'needle'+' More original context words after the passage.'.repeat(5),book=await fromText(text),state=newState();
  state.boundaries[book.id]={index:0,revision:book.source.sha256};
  const hit=findOccurrences([book],state,'needle').hits[0],segment=hit.passage.segments[0];
  assert.equal(hit.omittedStart,true);assert.equal(hit.omittedEnd,true);
  assert.match(text[segment.start-1],/\s/);assert.match(text[segment.end],/\s/);
  assert.equal(hit.passage.quote,text.slice(segment.start,segment.end));
  assert.equal(hit.passage.quote.slice(hit.matchStart,hit.matchEnd),'needle');assert.equal(hit.offset,text.indexOf('needle'));
  assert.equal(anchorStatus(hit.passage,book).valid,true);
  const whole=findOccurrences([book],state,text).hits[0];assert.equal(whole.omittedStart,false);assert.equal(whole.omittedEnd,false);
});
