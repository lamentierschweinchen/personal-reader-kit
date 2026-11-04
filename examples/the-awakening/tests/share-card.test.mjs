import test from 'node:test';
import assert from 'node:assert/strict';
import {fromText,selectionQuote,passageAt} from '../site/core.mjs';
import {passageCardData,layoutPassageCard} from '../site/share-card.mjs';

const measure=(text,style)=>[...text].length*style.size*(style.bold?.56:.5);
async function fixture(text='  A small original thought, λόγος.\r\n\tA second line.\n\n\n\nThe thought returns.') {
  const book=await fromText(text,{title:'Original keepsake fixture',author:'A fixture writer'}),section=book.sections[0];
  book.edition='An original test edition';section.title='The complete selected thought';
  section.blocks[0].marks=[{kind:'em',start:2,end:9},{kind:'strong',start:4,end:12}];
  const segments=section.blocks.filter(b=>b.text.length).map(b=>passageAt(book,section,b).segments[0]);
  const passage={bookId:book.id,sectionId:section.id,revision:book.source.sha256,segments,quote:selectionQuote(section,segments),note:'PRIVATE NOTE SENTINEL',url:'https://private.invalid/reader',otherBook:{title:'OTHER BOOK SENTINEL'}};
  return {book,section,passage};
}

test('card projection includes exact source and attribution, never private records or identifiers',async()=>{
  const {book,section,passage}=await fixture(),data=passageCardData(passage,book);
  assert.equal(data.quote,passage.quote);
  assert.deepEqual(data.attribution,[`${book.author} · ${book.title}`,section.title,book.edition]);
  assert.deepEqual(data.marks,section.blocks[0].marks);
  assert.deepEqual(Object.keys(data),['title','quote','attribution','marks','fixedRanges']);
  assert.doesNotMatch(JSON.stringify(data),new RegExp(`PRIVATE NOTE|private.invalid|OTHER BOOK|${book.source.sha256}|${book.id}|${section.id}"`));
  assert.throws(()=>passageCardData({...passage,revision:'0'.repeat(64)},book),/exact edition/);
  assert.throws(()=>passageCardData({...passage,quote:passage.quote+'!'},book),/exact edition/);
  assert.throws(()=>passageCardData(passage,null),/exact edition/);
  assert.throws(()=>passageCardData({},book),/exact edition/);
});

test('partial and intervening source marks use quotation offsets rather than source block offsets',async()=>{
  const {book,section}=await fixture('Before an original emphasis.\n\nA second original paragraph.');
  const first=section.blocks[0],second=section.blocks[1];
  first.marks=[{kind:'em',start:7,end:18}];second.marks=[{kind:'sup',start:2,end:8}];
  const passage=passageAt(book,section,first,10,first.text.length),last=passageAt(book,section,second,0,12).segments[0];
  passage.segments.push(last);passage.quote=selectionQuote(section,passage.segments);
  const data=passageCardData(passage,book),offset=first.text.length-10+first.after.length;
  assert.deepEqual(data.marks,[{kind:'em',start:0,end:8},{kind:'sup',start:offset+2,end:offset+8}]);
  assert.equal(data.quote,first.text.slice(10)+first.after+second.text.slice(0,12));
});

test('edition-specific small capitals, small type, page labels and spaced spans keep exact characters',async()=>{
  const {book,section,passage}=await fixture('Original source labels stay exact.');
  section.blocks[0].marks=[{kind:'smallcaps',start:0,end:8},{kind:'smallcap',start:9,end:15},{kind:'small',start:16,end:22},{kind:'page',start:23,end:27},{kind:'spaced',start:28,end:33}];
  const data=passageCardData(passage,book),plan=layoutPassageCard(data,measure),runs=plan.quote.flatMap(l=>l.runs);
  assert.deepEqual(data.marks,section.blocks[0].marks);
  assert.equal(plan.quote.map(l=>l.text+l.break).join(''),passage.quote);
  assert.ok(runs.some(run=>run.smallcaps));assert.ok(runs.some(run=>run.dy<0));assert.ok(runs.some(run=>run.pad>0));
  section.blocks[0].marks.push({kind:'unsupported-adapter-style',start:0,end:3});
  assert.throws(()=>passageCardData(passage,book),/formatting that cannot be preserved/);
});

test('verse and fixed source lines fit whole or refuse, and shaped source metadata never flattens silently',async()=>{
  const {book,section,passage}=await fixture('An original line with care.\n  Another original line.');
  section.blocks[0].kind='verse';
  const data=passageCardData(passage,book),plan=layoutPassageCard(data,measure);
  assert.equal(plan.quote.length,2);assert.equal(plan.quote.map(l=>l.text+l.break).join(''),passage.quote);
  assert.throws(()=>layoutPassageCard({...data,quote:'An original long source line '.repeat(5),fixedRanges:[{start:0,end:1000}]},measure),/shorter passage/);
  section.blocks[0].lines=[{indent:0,scale:1},{indent:2,scale:.8}];
  assert.throws(()=>passageCardData(passage,book),/shaped layout/);
  assert.doesNotThrow(()=>passageCardData(passageAt(book,section,section.blocks[0],0,section.blocks[0].text.indexOf('\n')),book));
  delete section.blocks[0].lines;section.blocks[0].display={underline:true};
  assert.ok(layoutPassageCard(passageCardData(passage,book),measure).quote.some(line=>line.runs.some(run=>run.underline)));
  section.blocks[0].kind='prose';section.blocks[0].layout='fixed';
  assert.throws(()=>passageCardData(passage,book),/fixed layout/);
});

test('layout conserves every source character, hard break and whitespace through soft wraps',async()=>{
  const {book,passage}=await fixture(),data=passageCardData(passage,book),plan=layoutPassageCard(data,measure);
  assert.equal(plan.quote.map(l=>l.text+l.break).join(''),data.quote);
  assert.ok(plan.quote.some(line=>line.runs.some(run=>run.text==='\t')));
  assert.ok(plan.quote.some(line=>line.runs.some(run=>run.italic&&run.bold)));
  assert.equal(plan.width,1080);assert.ok(plan.height>=1080&&plan.height<=1920);assert.ok(plan.fontSize>=58);
  for(const line of [...plan.quote,...plan.attribution]) {
    assert.ok(line.width<=1080-plan.padding*2+.01);
    for(const run of line.runs){assert.ok(run.x>=0);assert.ok(plan.padding+run.x+run.width<=1080-plan.padding+.01);assert.ok(line.y+run.dy>0&&line.y+run.dy<plan.height-plan.padding+40);}
  }
  assert.ok(plan.attribution.every(line=>line.runs.every(run=>run.size>=30)));
});

test('a long quotation wraps without truncation and all source attribution remains present',async()=>{
  const {book,passage}=await fixture('An original phrase for a considered card. '.repeat(10)),data=passageCardData(passage,book),plan=layoutPassageCard(data,measure);
  assert.equal(plan.quote.map(l=>l.text+l.break).join(''),data.quote);
  assert.equal(plan.attribution.map(l=>l.text).join(''),data.attribution.join(''));
  assert.ok(plan.fontSize>=58&&plan.fontSize<100);
  assert.ok(plan.quote.at(-1).y<plan.ruleY);
});

test('oversized quotes, long unbreakable words, excessive indentation and attribution refuse honestly',async()=>{
  const {book,passage}=await fixture(),data=passageCardData(passage,book);
  for(const quote of ['x'.repeat(1201),'W'.repeat(100),' '.repeat(100)+'A thought.',Array.from({length:40},()=> 'A line.').join('\n')])assert.throws(()=>layoutPassageCard({...data,quote},measure),/shorter passage|Nothing has been shortened/);
  assert.throws(()=>layoutPassageCard({...data,attribution:['An attribution '.repeat(300)]},measure),/full source attribution/);
  assert.throws(()=>layoutPassageCard({...data,attribution:[]},measure),/attribution is required/);
});
