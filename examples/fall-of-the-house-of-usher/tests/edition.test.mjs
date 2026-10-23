import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateBook,bookText,newState,passageAt,anchorStatus,mergeBackup} from '../site/core.mjs';
import {createBundle,validateBundle} from '../site/bundle.mjs';
import {works,POE} from '../site/usher.mjs';
import {assets,editionAssets,fonts,outputFiles} from '../scripts/build.mjs';
const read=p=>readFile(new URL('../'+p,import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');
const bytes=await read('edition/library.json'),book=validateBook(JSON.parse(bytes)[0]),blocks=book.sections[0].blocks,lock=JSON.parse(await read('edition-lock.json'));
test('the complete reviewed story, source identity, emphasis and verse are unchanged',()=>{
 assert.equal(sha(bytes),'dea3d3bf9de11ee8e271687b9f92c1023e01914c6ef32c0473e52b0734e13488');
 assert.equal(book.id,POE);assert.equal(sha(bookText(book)),'1973c1d75b19406cc85e26b7016745dcaf511392e7fac09ead0ead3dbe247bd4');
 assert.equal(book.source.sha256,sha(bookText(book)));assert.equal(bookText(book).length,41780);assert.equal(blocks.length,51);
 assert.equal(blocks.reduce((n,b)=>n+b.marks.length,0),25);assert.ok(blocks.flatMap(b=>b.marks).every(m=>m.kind==='em'));
 assert.equal(blocks.filter(b=>b.kind==='prose').length,42);assert.equal(blocks.filter(b=>b.kind==='note').length,1);
 const verses=blocks.filter(b=>b.kind==='verse');assert.equal(verses.length,8);assert.equal(verses[0].text.split('\n').length,3);
 for(const [i,stanza] of verses.slice(1,7).entries()){const lines=stanza.text.split('\n');assert.equal(lines.length,9);assert.equal(lines[0].trim(),['I.','II.','III.','IV.','V.','VI.'][i]);for(let l=1;l<lines.length;l++)assert.equal(/^    /.test(lines[l]),l%2===0);}
 assert.equal(verses.at(-1).text.split('\n').length,2);assert.equal(blocks.at(-1).kind,'note');assert.equal(blocks.at(-1).after,'');
});
test('companion source anchors resolve and ending disclosure remains explicit',()=>{
 assert.equal(works.length,6);
 for(const work of works){assert.ok(work.blocks.length);for(const id of work.blocks){const b=blocks.find(b=>b.id===id);assert.ok(b);if(work.start)assert.ok(b.text.includes(work.start));if(work.end)assert.ok(b.text.indexOf(work.end)>b.text.indexOf(work.start));}assert.match(work.url,/^https:\/\//);for(const s of work.sources)assert.match(s.url,/^https:\/\//);}
 assert.notDeepEqual(works.find(w=>w.id==='beardsley').blocks,works.find(w=>w.id==='clarke').blocks);assert.equal(works.find(w=>w.id==='clarke').ending,true);
});
test('all edition files, fonts, notices and icons retain exact reviewed bytes',async()=>{
 for(const pin of lock.files){const b=await read(pin.path);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256);}
 assert.deepEqual((await readdir(new URL('../edition/',import.meta.url))).sort(),[...editionAssets].sort());
 assert.deepEqual((await readdir(new URL('../site/',import.meta.url))).sort(),[...assets,...fonts].sort());
 assert.equal(outputFiles.length,26);assert.equal(new Set(outputFiles).size,26);assert.match((await read('site/OFL-IMFell.txt')).toString(),/SIL OPEN FONT LICENSE Version 1.1/);
});
test('exact bundles retain source notices and anchors while record restore does not widen ending permission',async()=>{
 const state=newState(),section=book.sections[0],passage=passageAt(book,section,blocks[1],5,80);
 state.notes=[{...passage,id:'original-record',note:'Original test note.',updated:1}];
 const bundle=await validateBundle(await createBundle({books:[book],state}));assert.deepEqual(bundle.books,[book]);assert.equal(anchorStatus(bundle.state.notes[0],book).valid,true);
 const backup=newState();backup.boundaries[POE]={index:0,revision:book.source.sha256};assert.deepEqual(mergeBackup(state,backup).boundaries,{});
});
test('the public presentation retains credits and the card feature without obsolete local authorization copy',async()=>{
 const app=(await read('site/app.mjs')).toString(),source=(await read('site/usher.mjs')).toString(),index=(await read('site/index.html')).toString();
 assert.match(app,/mountPassageCard/);assert.match(index,/share-card\.css/);assert.doesNotMatch(source,/has not been authorized for publication/);
 assert.match(source,/Font licence/);assert.match(source,/CC0/);assert.match(source,/separate rights/);
});
