import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {canonical} from '../site/bundle.mjs';
import {anchorStatus,passageAt,validateBook} from '../site/core.mjs';
import {fixture} from './document-fixture.mjs';

const app=await readFile(new URL('../site/app.mjs',import.meta.url),'utf8');
function sourceBetween(start,end){
  assert.equal(app.split(start).length,2,'unique production start anchor');
  assert.equal(app.split(end).length,2,'unique production end anchor');
  return app.slice(app.indexOf(start),app.indexOf(end));
}
const proofSource=sourceBetween('async function prepareSampleCopy(){','function backgroundText(');
const gateSource=sourceBetween('function hasEditionContext(){','function documentExit(){');
const hash=value=>createHash('sha256').update(value).digest('hex');
const referenceIds=['bingham-dialogue-1817','douglass-escape-1881','fugitive-act-1793'];
function proofHarness({holdIds=null}={}){
  const main={id:'douglass-1845',value:'original'},references=referenceIds.map(id=>({id,value:'original'}));
  let hold=true;const pending=[],started=new Set(),waiters=new Map();
  const context=vm.createContext({TextEncoder,canonical,books:[main,...references],sampleContextCopy:{},reviewedSampleCopy:new WeakSet(),editionBinding:{bookId:main.id,bookSha256:hash(canonical(main)),references:references.map(book=>({id:book.id,sha256:hash(canonical(book))}))},sha256:bytes=>{
    const id=JSON.parse(new TextDecoder().decode(bytes)).id;started.add(id);waiters.get(id)?.();
    return hold&&(!holdIds||holdIds.includes(id))?new Promise(resolve=>pending.push(()=>resolve(hash(bytes)))):Promise.resolve(hash(bytes));
  }});
  vm.runInContext('let editionProof=null,editionProofGeneration=0;const bookById=id=>books.find(b=>b.id===id);const primaryBook=()=>bookById("douglass-1845");'+proofSource+gateSource,context);
  return {context,main,references,run:()=>vm.runInContext('prepareSampleCopy()',context),ready:(id=referenceIds[0])=>{context.requestedReference=id;return vm.runInContext('!!hasDocument(requestedReference)',context);},release:()=>{hold=false;for(const done of pending)done();},unhold:()=>{hold=false;},started:id=>started.has(id)?Promise.resolve():new Promise(resolve=>waiters.set(id,resolve))};
}
test('late old proof cannot authorize replacement objects; new canonical proof survives old completion',async()=>{
  const h=proofHarness(),old=h.run();assert.equal(h.ready(),false);
  h.context.books=[{...h.main,value:'changed'},...h.references];h.unhold();await h.run();assert.equal(h.ready(),false);
  h.release();await old;for(const id of referenceIds)assert.equal(h.ready(id),false);
  const second=proofHarness(),delayed=second.run();
  second.context.books=[{...second.main},...second.references.map(book=>({...book}))];second.unhold();await second.run();for(const id of referenceIds)assert.equal(second.ready(id),true);
  second.release();await delayed;for(const id of referenceIds)assert.equal(second.ready(id),true);
  second.context.books=[{...second.main},...second.references];for(const id of referenceIds)assert.equal(second.ready(id),false,'main identity replacement revokes before another proof starts');
  await second.run();assert.equal(second.ready(),true);
  second.context.sha256=async()=>{throw new Error('Synthetic unavailable digest');};const failed=second.run();assert.equal(second.ready(),false,'proof resets synchronously');await failed;for(const id of referenceIds)assert.equal(second.ready(id),false);
});

test('one missing or changed reference leaves the other exact contexts available',async()=>{
  for(const absent of referenceIds)for(const mode of ['missing','changed']){
    const h=proofHarness();h.unhold();
    h.context.books=[h.main,...h.references.flatMap(book=>book.id!==absent?[book]:mode==='missing'?[]:[{...book,value:'modified same ID'}])];
    await h.run();for(const id of referenceIds)assert.equal(h.ready(id),id!==absent,mode+' '+absent+' gate '+id);
    assert.equal(vm.runInContext('hasEditionContext()',h.context),absent!==referenceIds[0]);
    assert.equal(h.ready('unknown-reference'),false);
  }
});

test('a rejected reference digest fails the proof closed and a later successful proof recovers',async()=>{
  const h=proofHarness();h.unhold();await h.run();for(const id of referenceIds)assert.equal(h.ready(id),true);
  const digest=h.context.sha256;
  h.context.sha256=async bytes=>{
    if(JSON.parse(new TextDecoder().decode(bytes)).id===referenceIds[1])throw new Error('Synthetic reference digest failure');
    return digest(bytes);
  };
  await h.run();for(const id of referenceIds)assert.equal(h.ready(id),false);
  h.context.sha256=digest;await h.run();for(const id of referenceIds)assert.equal(h.ready(id),true);
});

test('reference replacement during an async proof cannot admit that replacement', {timeout:3000},async()=>{
  const id=referenceIds[2],h=proofHarness({holdIds:[id]}),pending=h.run();await h.started(id);
  h.context.books=[h.main,...h.references.map(book=>book.id===id?{...book,value:'changed while hashing'}:book)];
  h.release();await pending;
  for(const referenceId of referenceIds)assert.equal(h.ready(referenceId),referenceId!==id);
  await h.run();for(const referenceId of referenceIds)assert.equal(h.ready(referenceId),referenceId!==id);
  h.context.books=[h.main,...h.references];await h.run();assert.equal(h.ready(id),true);
  h.context.books=[h.main,...h.references.map(book=>book.id===id?{...book}:book)];
  assert.equal(h.ready(id),false,'even exact replacement objects need a new proof');
  assert.equal(h.ready(referenceIds[0]),true);assert.equal(h.ready(referenceIds[1]),true);
});

test('fragment source notes resolve only their own book and missing scopes fail closed',()=>{
  const primary=validateBook({...fixture(),id:'douglass-1845'}),other=validateBook({...fixture(),id:'another-document'});
  other.sections[0].blocks.at(-1).text='* Another synthetic source note.';
  const rendered=[],dialogs=[];
  const context=vm.createContext({books:[primary,other],fragments:[],anchorStatus,esc:s=>String(s).replaceAll('"','&quot;'),arrow:()=>'',openDialog:(...args)=>dialogs.push(args),renderText:(...args)=>rendered.push(args),$:()=>({})});
  vm.runInContext('const bookById=id=>books.find(b=>b.id===id);const primaryBook=()=>bookById("douglass-1845");'+sourceBetween('function fragment(passage,hit) {','function echoes() {')+sourceBetween('function sourceNote(target,bookId){','const historicalDocumentList='),context);
  context.passage=passageAt(other,other.sections[0],other.sections[0].blocks[1],4,10);
  assert.match(vm.runInContext('fragment(passage)',context),/data-book="another-document"/);
  vm.runInContext('sourceNote("note","another-document")',context);
  assert.equal(rendered[0][3],other);assert.equal(rendered[0][1].blocks[0].text,'* Another synthetic source note.');
  assert.equal(dialogs[0][0],'Source note');
  for(const invocation of ['sourceNote("note")','sourceNote("note","missing")','sourceNote("missing","another-document")'])assert.throws(()=>vm.runInContext(invocation,context),/unavailable/);
  assert.equal(dialogs.length,1,'invalid calls do not open a fallback note');
});

