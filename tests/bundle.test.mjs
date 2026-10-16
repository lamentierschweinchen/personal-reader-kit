import test from 'node:test';
import assert from 'node:assert/strict';
import {fromText,newState,passageAt,anchorStatus,validateBook,READER_PROFILE} from '../site/core.mjs';
import {createBundle,validateBundle,planBundleRestore,snapshotToken,canonical,KIT_VERSION} from '../site/bundle.mjs';

async function fixture() {
  const book=await fromText('ὁδός 🕯 first line\n    another line\n\n\nLast stanza.',{title:'Original transfer fixture',kind:'verse'});
  book.sections[0].blocks[0].marks=[{kind:'em',start:0,end:4}];
  const passage=passageAt(book,book.sections[0],book.sections[0].blocks[0]),state=newState();
  state.notes=[{...passage,id:'transfer-note',note:'An original marginal note.',updated:1}];
  state.connections=[{id:'transfer-connection',note:'Original comparison.',updated:1,passages:[passage,passage]}];
  state.positions[book.id]={revision:book.source.sha256,sectionId:'text',blockId:'b1',ratio:0.4};state.lastBook=book.id;
  state.boundaries[book.id]={revision:book.source.sha256,index:0};state.prefs.theme='dusk';
  return {books:[book],state};
}
test('private bundle preserves exact editions, marks, records and stable integrity across JSON key order',async()=>{
  const source=await fixture(),bundle=await createBundle(source),checked=await validateBundle(JSON.parse(JSON.stringify(bundle)));
  assert.deepEqual(checked.books,source.books);assert.deepEqual(checked.state,source.state);assert.equal(checked.kitVersion,KIT_VERSION);
  assert.deepEqual(await validateBundle(JSON.parse(canonical(bundle))),checked);
  const changed=structuredClone(bundle);changed.books[0].title='Accidentally changed';await assert.rejects(()=>validateBundle(changed),/checksum/);
  await assert.rejects(()=>validateBundle({...bundle,extra:true}),/fields/);
  await assert.rejects(()=>createBundle({...source,books:[...source.books,...source.books]}),/Duplicate/);
  await assert.rejects(()=>createBundle(source,['absent']),/no longer available/);
});
test('selective bundle retains quotations without inventing missing editions or source anchors',async()=>{
  const source=await fixture(),bundle=await createBundle(source,[]),plan=planBundleRestore(bundle,{books:[],state:newState()});
  assert.deepEqual(bundle.books,[]);assert.deepEqual(bundle.state.notes,source.state.notes);
  assert.equal(plan.unresolved,1);assert.equal(plan.unresolvedConnections,1);assert.equal(plan.next.notes[0].quote,source.state.notes[0].quote);
});
test('restore preserves current places, opt-in appearance, explicit spoiler permission and repeatable conflicts',async()=>{
  const source=await fixture(),bundle=await createBundle(source),empty={books:[],state:newState()},first=planBundleRestore(bundle,empty);
  assert.equal(first.additions.length,1);assert.equal(first.addedNotes,1);assert.equal(first.addedConnections,1);
  assert.deepEqual(first.next.positions,source.state.positions);assert.deepEqual(first.next.boundaries,{});assert.equal(first.next.prefs.theme,'paper');
  assert.equal(planBundleRestore(bundle,empty,[],{appearance:true}).next.prefs.theme,'dusk');
  const current=structuredClone(source);current.state.notes[0].note='A later local thought.';current.state.positions[source.books[0].id].ratio=0.9;
  const merged=planBundleRestore(bundle,current);assert.equal(merged.next.notes.length,2);assert.equal(merged.next.positions[source.books[0].id].ratio,0.9);
  const repeated=planBundleRestore(bundle,{books:current.books,state:merged.next});assert.equal(repeated.addedNotes,0);assert.equal(repeated.next.notes.length,2);
  assert.equal(anchorStatus(repeated.next.notes[1],source.books[0]).valid,true);
});
test('edition conflicts include layout changes and public IDs; snapshots detect independent book and state changes',async()=>{
  const source=await fixture(),bundle=await createBundle(source),changed=structuredClone(source.books[0]);changed.sections[0].blocks[0].layout='fixed';
  assert.equal(planBundleRestore(bundle,{books:[changed],state:newState()}).conflicts.length,1);
  assert.equal(planBundleRestore(bundle,{books:[],state:newState()},[changed]).conflicts.length,1);
  assert.equal(planBundleRestore(bundle,{books:[],state:newState()},source.books).existing.length,1);
  assert.notEqual(snapshotToken(source),snapshotToken({...source,books:[changed]}));
  assert.notEqual(snapshotToken(source),snapshotToken({...source,state:{...source.state,revision:1}}));
});

test('reader profiles name incompatible editions without weakening exact contract or bundle validation',async()=>{
  const source=await fixture(),book=source.books[0];
  assert.equal(Object.hasOwn(validateBook(book),'profile'),false); // Legacy bytes stay unchanged.
  const explicit={...book,profile:READER_PROFILE};
  assert.equal(validateBook(explicit).profile,READER_PROFILE);
  const bundle=await createBundle({...source,books:[explicit]});
  assert.deepEqual((await validateBundle(bundle)).books,[explicit]);
  assert.equal(planBundleRestore(bundle,source).conflicts.length,1); // Adding metadata is an edition change.
  assert.throws(()=>validateBook({...book,profile:'original-fixture/illustrated@1',assets:[]}),/requires reader profile.*original-fixture\/illustrated@1/);
  await assert.rejects(()=>createBundle({...source,books:[{...book,profile:'original-fixture/illustrated@1'}]}),/reader profile/);
  assert.throws(()=>validateBook({...explicit,assets:[]}),/Unsupported book field/); // A profile is not an extension bypass.
});
