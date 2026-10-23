import test from 'node:test';import assert from 'node:assert/strict';
import {createHash}from'node:crypto';
import {validateBook,passageAt,excerptSection,anchorStatus}from'../site/core.mjs';
import {digest,jpegDimensions}from'../site/document-profile.mjs';
import {fixture}from'./document-fixture.mjs';
test('document contract preserves complete original fixture and UTF16 source anchors',()=>{
 const raw=fixture(),b=validateBook(raw);assert.deepEqual(b,raw);assert.notEqual(b.assets[0],raw.assets[0]);
 const p=passageAt(b,b.sections[0],b.sections[0].blocks[1],1,3);assert.equal(p.quote,'😀');assert.equal(anchorStatus(p,b).valid,true);
 const excerpt=excerptSection(p,b);assert.deepEqual(excerpt.blocks[0].references,[]);assert.deepEqual(excerpt.blocks[0].pages,[]);
 const call=excerptSection(passageAt(b,b.sections[0],b.sections[0].blocks[1],4,10),b).blocks[0];assert.deepEqual(call.references,[{id:'call',target:'note',start:4,end:5}]);
});
test('asset binary hash and JPEG frame validated on every changed value',()=>{
 const raw=fixture(),bytes=Buffer.from(raw.assets[0].data,'base64');assert.equal(digest(bytes),createHash('sha256').update(bytes).digest('hex'));assert.deepEqual(jpegDimensions(bytes),[2,3]);validateBook(raw);
 for(const change of [b=>b.assets[0].sha256='0'.repeat(64),b=>b.assets[0].width=3,b=>b.assets[0].type='image/svg+xml',b=>b.assets[0].data=b.assets[0].data.slice(0,-4)+'AAAA',b=>b.assets[0].data='https://invalid.example/image.jpg',b=>b.assets[0].extra='unsupported']){const b=fixture();change(b);assert.throws(()=>validateBook(b));}
});
test('unknown apparatus and dangling or overlapping identities fail closed',()=>{
 for(const change of [b=>b.sections[0].blocks[1].references[0].target='missing',b=>b.sections[0].blocks[4].sourceNote.page='missing',b=>b.sections[0].blocks[1].references.push({...b.sections[0].blocks[1].references[0],id:'second'}),b=>b.sections[0].blocks[1].pages[1].id='page-one',b=>b.sections[0].blocks[2].lineIndents=[0],b=>b.sections[0].blocks[3].image.assetId='missing',b=>b.sections[0].blocks[1].html='<script>bad</script>',b=>b.profile='unknown/document@1']){const b=fixture();change(b);assert.throws(()=>validateBook(b));}
});
test('verse excerpts keep witnessed indentation only at genuine line starts',()=>{
 const b=validateBook(fixture()),s=b.sections[0],v=s.blocks[2];assert.deepEqual(excerptSection(passageAt(b,s,v,11,22),b).blocks[0].lineIndents,[1]);assert.deepEqual(excerptSection(passageAt(b,s,v,12,22),b).blocks[0].lineIndents,[0]);
});
test('portable bundle carries JPEG bytes, source notes and exact source anchors',async()=>{
 const {newState}=await import('../site/core.mjs'),{createBundle,validateBundle,planBundleRestore}=await import('../site/bundle.mjs');
 const b=validateBook(fixture()),state=newState(),p=passageAt(b,b.sections[0],b.sections[0].blocks[1],1,9);state.notes=[{...p,id:'annotation',note:'Synthetic note',updated:1}];
 state.positions[b.id]={sectionId:'main',blockId:'p',ratio:.4,revision:b.source.sha256};
 const checked=await validateBundle(JSON.parse(JSON.stringify(await createBundle({books:[b],state}))));assert.deepEqual(checked.books,[b]);const plan=planBundleRestore(checked,{books:[],state:newState()});assert.equal(plan.additions.length,1);assert.equal(anchorStatus(plan.next.notes[0],plan.additions[0]).valid,true);assert.deepEqual(plan.next.positions,state.positions);
});
