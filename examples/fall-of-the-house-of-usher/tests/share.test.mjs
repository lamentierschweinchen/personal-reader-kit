import test from 'node:test';
import assert from 'node:assert/strict';
import {fromText,selectionQuote} from '../site/core.mjs';
import {passageShareData,sharePassage,copyPassage} from '../site/share.mjs';

async function fixture() {
  const text='  An original line, λόγος →\n    still indented.\n\n\n\nThe next stanza. <script> remains text.';
  const book=await fromText(text,{title:'Original sharing fixture',author:'A fixture author',kind:'verse'}),section=book.sections[0];
  const segments=section.blocks.map(b=>({blockId:b.id,start:0,end:b.text.length,quote:b.text,prefix:'',suffix:''}));
  return {book,passage:{bookId:book.id,sectionId:section.id,revision:book.source.sha256,segments,quote:selectionQuote(section,segments),note:'PRIVATE NOTE SENTINEL',deviceUrl:'https://private.invalid/secret'}};
}
test('sharing keeps exact source whitespace and attribution, without personal records or URLs',async()=>{
  const {book,passage}=await fixture(),data=passageShareData(passage,book);
  assert.equal(data.text,passage.quote+'\n\n— '+book.author+' · '+book.title+'\n'+book.sections[0].title+'\n'+book.edition);
  assert.deepEqual(Object.keys(data),['title','text']);
  assert.doesNotMatch(JSON.stringify(data),/PRIVATE NOTE SENTINEL|private.invalid|deviceUrl/);
  assert.equal(data.text.slice(0,passage.quote.length),passage.quote);
  assert.throws(()=>passageShareData({...passage,revision:'0'.repeat(64)},book),/exact edition/);
  assert.throws(()=>passageShareData({...passage,quote:'Modified words'},book),/exact edition/);
  assert.throws(()=>passageShareData(passage,undefined),/exact edition/);
});
test('native sharing is explicit, handles dismissal, and never substitutes clipboard writes',async()=>{
  const {book,passage}=await fixture(),data=passageShareData(passage,book),seen=[];
  const device={share:async value=>{seen.push(value);},clipboard:{writeText:async()=>assert.fail('Must not copy after a share gesture')}};
  const pending=sharePassage(data,device);assert.deepEqual(seen,[data]);assert.equal(await pending,'opened');
  device.share=async()=>{throw new DOMException('Dismissed','AbortError');};assert.equal(await sharePassage(data,device),'cancelled');
  device.share=async()=>{throw new DOMException('Blocked','NotAllowedError');};assert.equal(await sharePassage(data,device),'unavailable');
  device.canShare=()=>false;device.share=()=>assert.fail('Unsupported share must not open');assert.equal(await sharePassage(data,device),'unavailable');
  assert.equal(await sharePassage(data,{}),'unavailable');
});
test('copy reports success only after clipboard persistence, otherwise retains a manual path',async()=>{
  const data={text:'  Original\n\n\nquotation.\n\n— Attribution'},seen=[];
  let finish;const pending=copyPassage(data,{clipboard:{writeText:text=>{seen.push(text);return new Promise(resolve=>finish=resolve);}}});
  assert.deepEqual(seen,[data.text]);finish();assert.equal(await pending,true);
  assert.equal(await copyPassage(data,{clipboard:{writeText:async()=>{throw new Error('Denied');}}}),false);
  assert.equal(await copyPassage(data,{}),false);
});
