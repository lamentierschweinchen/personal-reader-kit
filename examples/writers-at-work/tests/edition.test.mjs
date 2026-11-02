import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {blankState,validateState,mergeState,validateEdition,escapeHTML} from '../site/core.mjs';

test('notebook recovery keeps two conflicting notes and two versions of an experiment',()=>{
 const current=blankState(),incoming=blankState();
 current.notes=[{id:'n1',text:'first reading',quote:'same words',title:'Test',route:'#writer/test'}];
 incoming.notes=[{id:'n1',text:'later reading',quote:'same words',title:'Test',route:'#writer/test'}];
 current.drafts.sentence='First attempt';incoming.drafts.sentence='Second attempt';
 const merged=mergeState(current,incoming);
 assert.equal(merged.notes.length,3);assert.equal(merged.drafts.sentence,'First attempt');
 assert.ok(merged.notes.some(n=>n.text==='later reading'));assert.ok(merged.notes.some(n=>n.text==='Second attempt'));
 assert.deepEqual(mergeState(merged,incoming),merged,'repeated recovery must not duplicate records');
});
test('malformed portable records fail without mutation',()=>{
 const state=blankState();assert.throws(()=>mergeState(state,{schema:1,notes:'broken'}));assert.deepEqual(state,blankState());
 assert.throws(()=>validateState({...blankState(),drafts:{one:{invalid:true}}}));
});
test('user text and source text remain literal',()=>{assert.equal(escapeHTML('<script>"&</script>'),'&lt;script&gt;&quot;&amp;&lt;/script&gt;');});
test('actual local edition has complete list boundaries and valid evidence references',async()=>{
 const e=validateEdition(JSON.parse(await readFile(new URL('../edition/edition.json',import.meta.url))));
 const counts={hemingway:7,fitzgerald:7,king:20,bradbury:12,zinsser:10,vonnegut:8,morrison:8,poe:7,atwood:10,ogilvy:10,steinbeck:6,wilder:10};
 assert.equal(e.authors.length,12);assert.equal(e.arguments.length,6);assert.equal(e.moments.length,6);
 for(const a of e.authors){assert.equal(a.items.length,counts[a.id]);assert.deepEqual(a.items.map(i=>i.number),Array.from({length:counts[a.id]},(_,i)=>i+1));for(const i of a.items){assert.ok(i.title&&i.text&&i.locator);assert.ok(['primary','secondary'].includes(i.verification));}}
 for(const m of e.moments){assert.equal(m.choices.length,2);assert.ok(e.arguments.some(a=>a.id===m.argument));for(const c of m.choices)for(const key of ['reason','counter','experiment','compare','exception'])assert.ok(c[key]?.length>20,`${m.id} missing ${key}`);}
 assert.ok(e.authors.find(a=>a.id==='atwood').coverageNote);
 const bad=structuredClone(e);bad.moments[0].choices[0].affinity='absent';assert.throws(()=>validateEdition(bad));
});
test('unfinished notes recover intact, including two competing unfinished edits',()=>{
 const current=blankState(),incoming=blankState();
 const draft={id:'unfinished',text:'Do not lose this thought',quote:'exact selected words',title:'Writer',route:'#writer/king'};
 incoming.noteDrafts={unfinished:draft};
 assert.deepEqual(mergeState(current,incoming).noteDrafts.unfinished,draft);
 current.noteDrafts={unfinished:{...draft,text:'Another thought'}};
 const merged=mergeState(current,incoming);
 assert.equal(Object.keys(merged.noteDrafts).length,2);
 assert.deepEqual(mergeState(merged,incoming),merged);
 const legacy={...blankState(),noteDraft:draft};
 assert.deepEqual(mergeState(blankState(),legacy).noteDrafts.unfinished,draft);
});
test('damaged navigation and executable note addresses are rejected',()=>{
 for(const patch of [{positions:'bad'},{choices:{sentence:999}},{noteDraft:{text:'orphan'}},{lastRead:{route:'javascript:alert(1)',title:'bad'}},{notes:[{id:'x',text:'x',quote:'',title:'x',route:'javascript:alert(1)'}]}])assert.throws(()=>validateState({...blankState(),...patch}));
});
test('a stale tab cannot replace new writing; reading changes do not conflict',async()=>{
 const {reconcileWrite}=await import('../site/core.mjs');
 const base=blankState(),current=blankState(),latest=blankState();
 current.drafts.sentence='This tab';latest.drafts.sentence='Other tab';
 assert.throws(()=>reconcileWrite(base,current,latest));
 const reading=blankState();reading.positions['#writer/king']={y:200,anchor:'king-1',inset:50};
 const merged=reconcileWrite(base,reading,latest);
 assert.equal(merged.drafts.sentence,'Other tab');assert.equal(merged.positions['#writer/king'].y,200);
});
test('a blocked save queue can save again after recovery',async()=>{
 const {createSaveQueue}=await import('../site/core.mjs');let blocked=true,writes=0;
 const save=createSaveQueue(()=>{if(blocked)return false;writes++;return true;});
 assert.equal(await save(),false);blocked=false;assert.equal(await save(),true);assert.equal(writes,1);
});
test('queued saves use current work, never a captured old snapshot',async()=>{
 const {createSaveQueue}=await import('../site/core.mjs');let work='old',unlock,seen=[];
 const gate=new Promise(resolve=>unlock=resolve);
 const save=createSaveQueue(async()=>{await gate;seen.push(work);return true;});
 const first=save();await Promise.resolve();work='new';const second=save();unlock();await Promise.all([first,second]);
 assert.ok(seen.length>=1);assert.ok(seen.every(value=>value==='new'));
});
test('saving a different place leaves a newer place intact',async()=>{
 const {reconcileWrite}=await import('../site/core.mjs');const base=blankState();base.positions['#writer/king']={y:1,anchor:null,inset:0};const current=structuredClone(base),latest=structuredClone(base);latest.positions['#writer/king'].y=200;current.positions['#writer/hemingway']={y:400,anchor:null,inset:0};assert.equal(reconcileWrite(base,current,latest).positions['#writer/king'].y,200);
});
test('character-aware reading places extend legacy records without rewriting them',()=>{
 const old=blankState();old.positions['#writer/test']={y:100,anchor:'sample',inset:-20};
 assert.deepEqual(validateState(old).positions,old.positions);
 const current=structuredClone(old);current.positions['#writer/test']={...old.positions['#writer/test'],layout:'300:500',textAnchor:{offset:14,character:'w',inset:105}};
 assert.deepEqual(validateState(current).positions,current.positions);
 const bad=structuredClone(current);bad.positions['#writer/test'].textAnchor.offset=-1;assert.throws(()=>validateState(bad));
});
