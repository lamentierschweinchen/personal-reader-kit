// Original writing and synthetic JPEG-frame bytes only; no literary source data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fromText,validateBook,newState,passageAt,selectionQuote} from '../site/core.mjs';
import {createBundle,validateBundle,planBundleRestore} from '../site/bundle.mjs';
import {passageShareData} from '../site/share.mjs';

async function fixture(){
 const b=await fromText('First keeper.\n\nSecond keeper.\n\nThe shared task.',{title:'Original apparatus fixture'});
 b.profile='antigone/jebb@1';b.sections[0].blocks.forEach((n,i)=>{n.role=i===2?'cast-role':'cast';n.gapBefore=i===1;});
 const bytes=Buffer.from([255,216,255,192,0,17,8,0,3,0,2,3,1,17,0,2,17,0,3,17,0,255,217]);
 b.assets=[{id:'original-frame',sectionId:'text',mediaType:'image/jpeg',width:2,height:3,sha256:createHash('sha256').update(bytes).digest('hex'),data:'data:image/jpeg;base64,'+bytes.toString('base64'),alt:'Original synthetic test frame.',credit:'Original fixture bytes, MIT.'}];
 b.apparatus={references:[{sectionId:'text',blockId:'b2',offset:3,value:10}],pages:[{sectionId:'text',blockId:'b1',offset:0,value:1}],castGroup:{sectionId:'text',nameIds:['b1','b2'],roleId:'b3',sign:'}'}};
 b.sections[0].blocks[0].marks=[{kind:'smallcaps',start:0,end:5}];return b;
}
test('exact illustrated apparatus edition survives full bundle and restore planning',async()=>{
 const book=await fixture();assert.deepEqual(validateBook(book),book);
 const state=newState();state.notes=[{...passageAt(book,book.sections[0],book.sections[0].blocks[1],0,6),id:'original-note',note:'Private original thought.',updated:1}];
 const bundle=await validateBundle(await createBundle({books:[book],state}));assert.deepEqual(bundle.books,[book]);assert.deepEqual(bundle.state,state);
 assert.deepEqual(planBundleRestore(bundle,{books:[],state:newState()}).additions,[book]);
 const changed=structuredClone(book);changed.apparatus.references[0].offset++;
 assert.equal(planBundleRestore(bundle,{books:[changed],state:newState()}).conflicts.length,1);
});
test('custom profile is bounded: unknown roles, source fields, offsets, cast identities and image bytes fail closed',async()=>{
 const book=await fixture();
 for(const mutate of [b=>b.sections[0].blocks[0].role='invented',b=>delete b.sections[0].blocks[0].gapBefore,b=>b.apparatus.references[0].offset=999,b=>b.apparatus.pages[0].blockId='missing',b=>b.apparatus.castGroup.nameIds=['b1','b1'],b=>b.assets[0].width=3,b=>b.assets[0].sha256='a'.repeat(64),b=>b.assets[0].data='javascript:alert(1)',b=>b.assets[0].script='unexpected',b=>b.apparatus.script='unexpected']){const changed=structuredClone(book);mutate(changed);assert.throws(()=>validateBook(changed));}
 const plain=structuredClone(book);delete plain.profile;assert.throws(()=>validateBook(plain),/Unsupported book field/);
});
test('apparatus remains outside source quotations; linear share refuses the shared cast arrangement',async()=>{
 const book=await fixture(),section=book.sections[0],one=passageAt(book,section,section.blocks[0]),two=passageAt(book,section,section.blocks[1]);
 const quote=selectionQuote(section,[...one.segments,...two.segments]);assert.equal(quote,'First keeper.\n\nSecond keeper.');assert.ok(!quote.includes('10'));
 assert.throws(()=>passageShareData({...one,segments:[...one.segments,...two.segments],quote},book),/shared source brace/);
 assert.ok(passageShareData(one,book).text.startsWith('First keeper.\n\n'));
});
