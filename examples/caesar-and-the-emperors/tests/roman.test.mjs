import test from 'node:test';import assert from 'node:assert/strict';import{readFile,readdir}from'node:fs/promises';import{createHash}from'node:crypto';
import{validateBook,passageAt,anchorStatus,fromText}from'../site/core.mjs';import{createBundle,validateBundle}from'../site/bundle.mjs';import{newState}from'../site/core.mjs';import{ILLUSTRATED_PROFILE}from'../site/media.mjs';
import{prepareRomanShareRights,prepareRomanSourceCopy,romanSourceText}from'../site/roman.mjs';import{passageShareData}from'../site/share.mjs';import{passageCardData,layoutPassageCard}from'../site/share-card.mjs';import{mergeLibrary}from'../site/library.mjs';
const root=new URL('../',import.meta.url),load=async id=>JSON.parse(await readFile(new URL('edition/'+id+'.json',root)));
const exists=await readdir(new URL('edition/',root)).catch(()=>[]);
test('Roman profile preserves editorial marks and refuses them in stock contracts',()=>{
 const fixture={schema:1,profile:ILLUSTRATED_PROFILE,id:'fixture',title:'Original test',author:'Test',edition:'Original fixture',language:'grc',source:{sha256:'a'.repeat(64),format:'original',description:'Original fixture'},assets:[],sections:[{id:'s',title:'Section',blocks:[{id:'b',kind:'prose',text:'Original fixture',after:'',marks:[{kind:'del',start:0,end:8},{kind:'ins',start:9,end:16}]}]}],context:[]};
 assert.deepEqual(validateBook(fixture),fixture);assert.throws(()=>validateBook({...fixture,profile:'personal-reader/text@1'}),/Unsupported book field|Invalid emphasis/);assert.throws(()=>validateBook({...fixture,assets:[{}]}),/Invalid|Missing/);
});
test('actual Roman coverage, exact witnesses, apparatus and media survive bundles',{skip:!exists.includes('caesar-vii-en.json')},async()=>{
 const ids=['caesar-vii-en','caesar-vii-la','augustus-en','augustus-la','marcus-ii-iii-en','marcus-ii-iii-grc','sallust-51','tacitus-annals-1','pliny-trajan'],books=await Promise.all(ids.map(load));
 for(const b of books)assert.deepEqual(validateBook(b),b);
 for(const b of books.slice(0,2))assert.deepEqual(b.sections.map(s=>s.id),Array.from({length:90},(_,i)=>'vii-'+(i+1)));
 for(const b of books.slice(2,4)){assert.equal(b.sections.length,37);assert.equal(b.sections[0].id,'rg-preamble');assert.equal(b.sections.at(-1).id,'rg-summary');assert.equal(b.sections.at(-1).blocks.length,4);}
 assert.deepEqual(books[4].sections.map(s=>s.id),books[5].sections.map(s=>s.id));assert.equal(books[4].sections.length,33);
 assert.match(books[3].sections.find(s=>s.id==='rg-34').blocks[0].text,/dignitate/);assert.match(books[4].sections.find(s=>s.id==='ii-14').blocks[0].text,/three thousand ears/);
 assert.ok(books[5].sections.some(s=>s.blocks.some(b=>b.marks.some(m=>m.kind==='del'))));
 for(const b of [books[1],books[5]])assert.match(b.context[0].text,/CC BY-SA 4.0/);
 assert.equal(books[0].assets.length,2);for(const a of books[0].assets)assert.equal(createHash('sha256').update(Buffer.from(a.data,'base64')).digest('hex'),a.sha256);
 const bundle=await createBundle({books,state:newState()});const restored=await validateBundle(bundle);assert.deepEqual(restored.books,books);
 const damaged=structuredClone(books[0]);damaged.assets[0].data=damaged.assets[0].data.replace(/^./,'A');assert.throws(()=>validateBook(damaged),/PNG|checksum/);
});

test("Pliny selected bodies stay pinned to the collated Book X paragraphs",{skip:!exists.includes("pliny-trajan.json")},async()=>{const b=await load("pliny-trajan");const expected={"letter-33": "321f4d6618a2285482501dc91b3a8352ea7bb3ddb830502cad0c60de15b47968", "letter-34": "6bca97e2f9c743926e8d65bbdb8ef3acc551ca6693a1b45e5db8d506aac1a1ee", "letter-37": "beed10f51b095b9341332b4ee0eb23628cfd78c50e508cff5d63c52c63f03a61", "letter-38": "04a9124f986ad60964f4cd75ef948e20008b4bf1352498803af8609c1b1c56a7"};for(const s of b.sections)assert.equal(createHash("sha256").update(s.blocks[0].text).digest("hex"),expected[s.id]);});

test('reviewed Perseus text and card shares retain license route, with no private records',{skip:!exists.includes('caesar-vii-la.json')},async()=>{
 for(const [id,anchor] of [['caesar-vii-la','caesar-latin'],['marcus-ii-iii-grc','marcus-greek']]){
  const book=await load(id),section=book.sections[0],passage={...passageAt(book,section,section.blocks[0],0,40),note:'PRIVATE NOTE SENTINEL',deviceUrl:'https://private.invalid/secret'};
  assert.throws(()=>passageShareData(passage,book),/sharing credits/);
  await prepareRomanShareRights([book]);const shared=passageShareData(passage,book),card=passageCardData(passage,book);
  assert.equal(shared.text.slice(0,passage.quote.length),passage.quote);
  assert.ok(shared.text.includes('https://newreading.app/rome/sources/#'+anchor));assert.match(shared.text,/CC BY-SA 4.0 · selected and reflowed/);
  assert.ok(card.attribution.some(line=>line.includes('/rome/sources/#'+anchor)));assert.doesNotMatch(JSON.stringify({shared,card}),/PRIVATE NOTE SENTINEL|private.invalid|deviceUrl/);
  const plan=layoutPassageCard(card,(text,style)=>text.length*style.size*.55);assert.ok(plan.height<=1920);assert.ok(plan.fontSize>=58);
  for(const change of [b=>b.title+=' customized',b=>b.context[0].text+=' CUSTOM',b=>b.sections[0].blocks[0].text+=' custom']){
   const custom=structuredClone(book);change(custom);await prepareRomanShareRights([custom]);assert.throws(()=>passageShareData(passage,custom),/sharing credits/);
  }
  book.context[0].text+=' MUTATED';assert.throws(()=>passageShareData(passage,book),/sharing credits/);
 }
});

test('revised source labels preserve stored editions, their notes and exact-bundle recovery',{skip:!exists.includes('pliny-trajan.json')},async()=>{
 const book=await load('pliny-trajan');assert.match(book.sections[0].title,/To the Emperor Trajan$/);assert.match(book.sections[1].title,/Trajan to Pliny$/);assert.match(book.sections[2].title,/To the Emperor Trajan$/);assert.match(book.sections[3].title,/Trajan to Pliny$/);
 const stored=structuredClone(book);for(const s of stored.sections)s.title=s.title.replace(/ · (?:To the Emperor Trajan|Trajan to Pliny)$/,'');
 const section=stored.sections[0],note={...passageAt(stored,section,section.blocks[0],0,40),id:'original-note',note:'Original record',updated:1};
 const state=newState();state.notes=[note];const merged=mergeLibrary([book],[stored]);assert.equal(merged.books[0],stored);assert.equal(merged.conflicts.length,1);assert.equal(merged.availableSupplied.length,0);assert.ok(anchorStatus(note,stored).valid);
 const bundle=await createBundle({books:merged.books,state});const restored=await validateBundle(bundle);assert.deepEqual(restored.books,[stored]);assert.deepEqual(restored.state.notes,[note]);
 const latin=await load('augustus-la'),modern=latin.context.filter(c=>c.through==='rg-32');assert.equal(modern[0].label,'Bill Thayer’s note · 32');assert.ok(modern[0].url.endsWith('#note:6L2_readings'));assert.ok(modern[1].url.endsWith('/Strabo/4E*.html#note150'));
});

test('current source-view copy stays outside immutable editions and customized contexts',{skip:!exists.includes('caesar-vii-en.json')},async()=>{
 for(const id of ['caesar-vii-en','augustus-en','augustus-la','marcus-ii-iii-en','sallust-51','tacitus-annals-1','pliny-trajan']){
  const book=await load(id),before=JSON.stringify(book),notice=book.context[0];await prepareRomanSourceCopy([book]);
  assert.match(romanSourceText(book,notice),/Copyright status outside the United States has not been reviewed/);assert.equal(JSON.stringify(book),before);
  const custom=structuredClone(book);custom.context[0].text+=' CUSTOM';await prepareRomanSourceCopy([custom]);assert.equal(romanSourceText(custom,custom.context[0]),custom.context[0].text);
  book.title+=' CUSTOM';assert.equal(romanSourceText(book,notice),notice.text);
 }
});

test('meaningful Roman editorial signs are preserved by a supported card or withheld, without blocking ordinary italics',{skip:!exists.includes('marcus-ii-iii-grc.json')},async()=>{
 const greek=await load('marcus-ii-iii-grc');await prepareRomanShareRights([greek]);let signs=0;
 for(const s of greek.sections)for(const b of s.blocks)for(const m of b.marks.filter(m=>['del','ins'].includes(m.kind))){
  const p=passageAt(greek,s,b,m.start,m.end);assert.throws(()=>passageShareData(p,greek),/editorial additions or deletions/);assert.throws(()=>passageCardData(p,greek),/Export the exact edition/);signs++;
 }
 assert.equal(signs,7);const first=greek.sections[0];assert.doesNotThrow(()=>passageShareData(passageAt(greek,first,first.blocks[0],0,20),greek));
 const latin=await load('augustus-la');await prepareRomanSourceCopy([latin]);const section=latin.sections.find(s=>s.id==='rg-34'),block=section.blocks[0],mark=block.marks.find(m=>m.kind==='em'),p=passageAt(latin,section,block,Math.max(0,mark.start-5),mark.end+5);
 assert.throws(()=>passageShareData(p,latin),/Make a card or export/);const card=passageCardData(p,latin);assert.equal(card.quote,p.quote);assert.ok(card.marks.some(m=>m.kind==='em'));assert.doesNotThrow(()=>layoutPassageCard(card,(text,style)=>text.length*style.size*.55));
 assert.doesNotThrow(()=>passageShareData(passageAt(latin,section,block,0,mark.start),latin));
 const original=await fromText('An original private italic passage.',{title:'Original fixture'});original.sections[0].blocks[0].marks=[{kind:'em',start:0,end:2}];assert.doesNotThrow(()=>passageShareData(passageAt(original,original.sections[0],original.sections[0].blocks[0],0,15),original));
});
