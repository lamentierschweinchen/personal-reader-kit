import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateBook,newState,anchorStatus} from '../site/core.mjs';
import {createBundle,validateBundle} from '../site/bundle.mjs';
import {isReviewedEdition} from '../site/edition.mjs';
import {dossier,evidence,CASE_KEY,freshCase,getCase,judge,ORDER} from '../site/case.mjs';
const raw=JSON.parse(await readFile(new URL('../edition/library.json',import.meta.url),'utf8'))[0],book=validateBook(raw);
test('recovery identifies the exact edition without its download and rejects altered text, metadata, images or notices',async()=>{
 assert.equal(await isReviewedEdition(book),true);
 for(const change of [b=>b.sections[1].blocks[2].text+=' changed',b=>b.edition+=' changed',b=>b.sections[0].blocks.find(x=>x.images?.length).images[0].alt+=' changed',b=>b.notices.license+=' changed']){
  const other=structuredClone(book);change(other);assert.equal(await isReviewedEdition(other),false);
 }
});
test('complete edition survives validation and portable bundle without discarding its images or typography',async()=>{
 assert.deepEqual(book,raw);assert.equal(book.sections.length,30);assert.deepEqual(book.sections.slice(1,28).map(s=>s.id),Array.from({length:27},(_,i)=>`chap${String(i+1).padStart(2,'0')}`));
 const images=book.sections.flatMap(s=>s.blocks.flatMap(b=>b.images||[]));assert.equal(images.length,2);assert.ok(book.sections.flatMap(s=>s.blocks).some(b=>b.kind==='verse'));assert.ok(book.sections.flatMap(s=>s.blocks).some(b=>b.marks.some(m=>m.kind==='smallcap')));
 const bundle=await validateBundle(await createBundle({books:[book],state:newState()},['dracula']));assert.deepEqual(bundle.books,[raw]);
});
test('malformed document fields fail rather than silently dropping source apparatus',()=>{
 for(const value of [null,false,0,''])for(const field of ['display','images','notices']){
  const other=structuredClone(book);if(field==='notices')other.notices=value;else other.sections[0].blocks[0][field]=value;assert.throws(()=>validateBook(other),field);
 }
});
test('all twelve fragments are exact, distinct, chapter-limited anchors with whole-word boundaries',()=>{
 assert.equal(dossier.length,12);
 for(const d of dossier){const p=evidence(book,d);assert.equal(p.sectionId,'chap07');assert.ok(anchorStatus(p,book).valid,d.id);const first=p.segments[0],b=book.sections[7].blocks.find(b=>b.id===first.blockId);if(first.start)assert.match(b.text[first.start-1],/\s/);const last=p.segments.at(-1);assert.match(last.quote.at(-1),/[.!?…]/,d.id);}
});
test('case rejects plot-based answers, unsupported pairs and forced arrival dates, while allowing revision',()=>{
 const g=freshCase();assert.equal(judge(g).ok,false);g.order=[...ORDER];g.dating='written';g.arrivalDate='eight';g.dateEvidence=['consignee','mina'];assert.equal(judge(g).ok,false);g.arrivalDate='unresolved';assert.equal(judge(g).ok,true);
 g.stage=1;g.claim='killer';g.support=['vow','wheel'];g.limit='inference';assert.equal(judge(g).ok,false);g.claim='bound';g.support=['wheel','wheel'];assert.equal(judge(g).ok,false);g.support=['wheel','vow'];g.limit='witnessed';assert.equal(judge(g).ok,false);g.limit='inference';assert.equal(judge(g).ok,true);
 g.stage=2;g.lead='dog';g.trail=['cargo','consignee'];assert.equal(judge(g).ok,false);g.lead='billington';assert.equal(judge(g).ok,true);
});
test('corrupt case data is never silently replaced; reader progress and permissions are not case fields',()=>{
 const s=newState();s.reflections[CASE_KEY]='broken';assert.throws(()=>getCase(s));s.reflections[CASE_KEY]=JSON.stringify({...freshCase(),stage:3});assert.throws(()=>getCase(s));s.reflections[CASE_KEY]=JSON.stringify(freshCase());assert.deepEqual(getCase(s),freshCase());assert.ok(!Object.hasOwn(getCase(s),'positions'));assert.ok(!Object.hasOwn(getCase(s),'boundaries'));
});
