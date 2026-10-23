import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {PUBLIC_WORKS,canonical,createContinuationProfile,validProfile,parsePointer,validPosition,continuationHref,readContinuationSnapshot,validateContinuation,adaptContinuationApp,adaptContinuationLibrary,injectContinuation,startContinuation,bootstrapContinuation,CONTINUATION_EVENT,CONTINUATION_KEY} from './continuation.mjs';
const book={id:'austen-pride-1894',title:'Original test fixture',source:{sha256:'a'.repeat(64)},sections:[{id:'first',blocks:[{id:'one',text:'Original fixture.'}]}]};
const profile=await createContinuationProfile({edition:'austen',title:'Fixture edition',books:[book]});
const pointer={v:1,edition:'austen',work:book.id,at:1};
const pos={revision:book.source.sha256,sectionId:'first',blockId:'one',ratio:.25};
function database(snapshot,{version=1,upgrade=false,blocked=false,hung=false}={}){
  const audit={opens:[],transactions:[],closed:0,aborted:0};
  const db={version,close(){audit.closed++;},objectStoreNames:{contains:()=>true},transaction(names,mode){audit.transactions.push({names,mode});const tx={objectStore:name=>({get:key=>({result:name==='state'?snapshot.state:snapshot.book})}),abort(){audit.aborted++;}};queueMicrotask(()=>tx.oncomplete?.());return tx;}};
  return {audit,open(...args){audit.opens.push(args);const request={result:db,transaction:{abort(){audit.aborted++;}}};queueMicrotask(()=>{if(upgrade)request.onupgradeneeded();else if(blocked)request.onblocked();else if(!hung)request.onsuccess();});return request;}};
}
test('profiles and tiny pointers admit only fourteen declared public editions',()=>{
 assert.equal(Object.keys(PUBLIC_WORKS).length,14);assert.ok(validProfile(profile));assert.deepEqual(parsePointer(JSON.stringify(pointer),[profile]),pointer);
 for(const extra of [{text:'private'},{position:pos},{v:2},{edition:'orwell'},{work:'private'},{at:Infinity},{at:Date.now()+120000}])assert.equal(parsePointer(JSON.stringify({...pointer,...extra}),[profile]),null);
 assert.equal(continuationHref(pointer),'/austen/#continue/austen-pride-1894');assert.equal(continuationHref({...pointer,edition:'orwell'}),null);
 for(const change of [{ratio:2},{ratio:NaN},{revision:'b'.repeat(64)},{blockId:undefined},{sectionId:'../first'}])assert.equal(validPosition({...pos,...change},profile.works[0]),false);
 assert.throws(()=>injectContinuation('<head></head>',{profiles:[profile,profile]}));
});
test('reads only the selected existing stores readonly and aborts absent creation',async()=>{
 const db=database({state:{schema:1,positions:{[book.id]:pos}},book});assert.ok(await validateContinuation(pointer,[profile],db));assert.deepEqual(db.audit.opens,[['newreading-austen-v1']]);assert.deepEqual(db.audit.transactions,[{names:['state','books'],mode:'readonly'}]);assert.equal(db.audit.closed,1);
 const absent=database({}, {upgrade:true});assert.equal(await readContinuationSnapshot(absent,pointer),null);assert.equal(absent.audit.aborted,1);assert.equal(absent.audit.transactions.length,0);
 await assert.rejects(readContinuationSnapshot(database({}, {blocked:true}),pointer));await assert.rejects(readContinuationSnapshot(database({}, {hung:true}),pointer,{timeout:5}));
 assert.equal(await validateContinuation(pointer,[profile],database({}, {version:2})),false);
});
test('rejects cleared, stale, corrupted, same-ID private or altered book state',async()=>{
 const state={schema:1,positions:{[book.id]:pos}};
 assert.ok(await validateContinuation(pointer,[profile],database({state})), 'normal supplied books are not persisted');
 for(const snapshot of [{},{state:{...state,schema:2}},{state:{schema:1,positions:{}}},{state:{schema:1,positions:{[book.id]:{...pos,revision:'b'.repeat(64)}}}},{state,book:{...book,title:'Imported private work'}},{state,book:{...book,sections:[{id:'first',blocks:[{id:'one',text:'Mutated while retaining source hash.'}]}]}},{state:{schema:1,positions:{[book.id]:{...pos,blockId:'missing'}}},book}])assert.equal(await validateContinuation(pointer,[profile],database(snapshot)),false);
});
const source=`const samples=[sample];let books=[sample],state={positions:{[sample.id]:position}},route={},activeBook,activeSection;const $=selector=>document.querySelector(selector);const bookById=id=>books.find(b=>b.id===id);const commit=async fn=>{if(fail)throw Error('no save');state=fn(state);};const say=message=>messages.push(message);const parseRoute=()=>({});async function render({keepScroll=false}={}) {if(activeBook){    $('#reading-text').dataset.positionReady='true';}}let pos=position,book=sample;async function savePosition(){try {await commit(s => {s.positions[book.id] = pos;s.lastBook = book.id;return s;});}catch{}}async function act(target){actions.push(target);const hash='#read/'+target.dataset.book+'/'+position.sectionId;switch(target.dataset.action){case 'resume':if(location.hash===hash){route=parseRoute();await render();}else location.hash=hash;break;}}void offline();globalThis.save=savePosition;globalThis.replaceBook=value=>{book=value;books=[value];};`;
async function adapterContext({hash='#shelf',fail=false,position=pos}={}){
 const events=[],actions=[],messages=[],sample=structuredClone(book);const location={hash};const context=vm.createContext({sample,position,fail,canonical,crypto:globalThis.crypto,TextEncoder,Uint8Array,window:new EventTarget(),events,actions,messages,location,history:{state:null,replaceState(_s,_t,hash){location.hash=hash;}},document:{querySelector:()=>null,dispatchEvent:event=>events.push(event)},CustomEvent:class {constructor(type,options){this.type=type;this.detail=options.detail;}},offline(){}});
 await new vm.Script('(async()=>{'+adaptContinuationApp(source,profile)+'})()').runInContext(context);return context;
}
test('adapter records only after successful commit and rejects later in-place mutation',async()=>{
 const c=await adapterContext();await c.save();assert.equal(c.events.length,1);assert.equal(c.events[0].detail.work,book.id);assert.ok(Number.isSafeInteger(c.events[0].detail.at));assert.throws(()=>{c.sample.sections[0].blocks[0].text='changed';},TypeError);assert.equal(c.sample.sections[0].blocks[0].text,book.sections[0].blocks[0].text);await c.save();assert.equal(c.events.length,2);
 const replacement=structuredClone(book);c.replaceBook(replacement);await c.save();assert.equal(c.events.length,3);assert.ok(Object.isFrozen(replacement.sections[0].blocks[0]));const imported={...structuredClone(book),title:'Same-ID imported edition'};c.replaceBook(imported);await c.save();assert.equal(c.events.length,3);assert.ok(!Object.isFrozen(imported));
 const raced=await adapterContext();raced.crypto={subtle:{digest:async(...args)=>{raced.sample.title='Changed while hashing';return globalThis.crypto.subtle.digest(...args);}}};await raced.save();assert.equal(raced.events.length,0);assert.ok(!Object.isFrozen(raced.sample));
 const failed=await adapterContext({fail:true});await failed.save();assert.equal(failed.events.length,0);
});
test('sentinel resumes directly, replaces route once, and fails closed for invalid places',async()=>{
 const c=await adapterContext({hash:continuationHref(pointer).split('/#')[1]?'#continue/'+book.id:'#shelf'});assert.equal(c.actions.length,1);assert.equal(c.location.hash,'#read/'+book.id+'/first');
 for(const position of [{...pos,ratio:5},{...pos,blockId:'unknown'},{...pos,sectionId:'missing'}]){const bad=await adapterContext({hash:'#continue/'+book.id,position});assert.equal(bad.actions.length,0);assert.equal(bad.location.hash,'#shelf');}
 assert.throws(()=>adaptContinuationApp(source+source,profile));assert.throws(()=>adaptContinuationApp(source.replace('void offline();',''),profile));
});
test('all fourteen real application sources satisfy unique strict adapter anchors',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../examples/catalog.json',import.meta.url),'utf8'));
 const {readerPaths}=await import('./readers.mjs');
 for(const entry of catalog.examples){const edition=readerPaths[entry.id],fixture={edition,title:'Test profile',works:PUBLIC_WORKS[edition].map(id=>({id,title:'Test work',revision:'a'.repeat(64),fingerprint:'b'.repeat(64)}))};const text=await readFile(new URL('../'+entry.directory+'/site/app.mjs',import.meta.url),'utf8');assert.ok(adaptContinuationApp(text,fixture).includes('__nrContinuationProof'));}
});
test('marker listener accepts only canonical reader paths and never games or companions',()=>{
 function run(path,reader='austen'){const doc=new EventTarget(),win=new EventTarget(),stored=new Map();doc.querySelector=()=>({getAttribute:()=>JSON.stringify({profiles:[profile],reader})});win.location={protocol:'https:',hostname:'newreading.app',host:'newreading.app',pathname:path};win.navigator={locks:{request:(_name,callback)=>Promise.resolve(callback())}};win.localStorage={getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)};const stop=startContinuation(win,doc);const event=new Event(CONTINUATION_EVENT);event.detail={work:book.id,at:Date.now()};doc.dispatchEvent(event);stop?.stop();return stored;}
 assert.deepEqual(Object.keys(JSON.parse(run('/austen/').get(CONTINUATION_KEY))).sort(),['at','edition','v','work']);assert.equal(run('/austen/play/').size,0);assert.equal(run('/austen/companion/').size,0);
});
test('library rechecks at activation and hides a cleared place without navigation',async()=>{
 const snapshot={state:{schema:1,positions:{[book.id]:pos}}},storage=new Map([[CONTINUATION_KEY,JSON.stringify(pointer)]]),navigations=[];
 const link=new EventTarget();link.textContent='';link.removeAttribute=name=>{if(name==='href')delete link.href;};
 const panel={hidden:true,querySelector:()=>link},status={textContent:''},script={getAttribute:()=>JSON.stringify({profiles:[profile],reader:null})};
 const doc=new EventTarget();doc.querySelector=selector=>selector.startsWith('script')?script:selector==='[data-continuation]'?panel:status;
 const win=new EventTarget();Object.assign(win,{location:{protocol:'https:',hostname:'newreading.app',host:'newreading.app',pathname:'/library/',assign:href=>navigations.push(href)},localStorage:{getItem:key=>storage.get(key)},indexedDB:database(snapshot),crypto:globalThis.crypto});
 const controller=startContinuation(win,doc);await controller.refresh();assert.equal(panel.hidden,false);assert.equal(link.href,continuationHref(pointer));
 snapshot.state.positions={};const click=new Event('click',{cancelable:true});click.button=0;link.dispatchEvent(click);await new Promise(resolve=>setTimeout(resolve,0));assert.equal(panel.hidden,true);assert.deepEqual(navigations,[]);assert.match(status.textContent,/unavailable/);controller.stop();
 Object.defineProperty(win,'indexedDB',{get(){throw Error('Storage denied');}});assert.doesNotThrow(()=>startContinuation(win,doc));
});
test('cross-tab locked pointer keeps commit order despite delayed proof, ties and contention',async()=>{
 const secondBook={...structuredClone(book),id:'alice-rackham-28885'},secondProfile=await createContinuationProfile({edition:'alice',title:'Second fixture',books:[secondBook]});
 const storage=new Map(),writes=[];let tail=Promise.resolve();
 const locks={request(name,callback){assert.equal(name,CONTINUATION_KEY);const result=tail.then(callback);tail=result.catch(()=>{});return result;},flush:()=>tail};
 async function reader(profile,sample,at,crypto=globalThis.crypto,lockSupport=true){
  const doc=new EventTarget(),win=new EventTarget(),clock={at};doc.querySelector=()=>({getAttribute:()=>JSON.stringify({profiles:[profile],reader:profile.edition})});
  Object.assign(win,{location:{protocol:'https:',hostname:'newreading.app',host:'newreading.app',pathname:'/'+profile.edition+'/'},navigator:lockSupport?{locks}:{},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>{storage.set(key,value);writes.push(JSON.parse(value));}}});
  const controller=startContinuation(win,doc),location={hash:'#shelf'},context=vm.createContext({sample,position:pos,fail:false,canonical,crypto,TextEncoder,Uint8Array,window:new EventTarget(),Date:{now:()=>clock.at},actions:[],messages:[],location,history:{state:null,replaceState(_s,_t,hash){location.hash=hash;}},document:doc,CustomEvent:class extends Event {constructor(type,options){super(type);this.detail=options.detail;}},offline(){}});
  await new vm.Script('(async()=>{'+adaptContinuationApp(source,profile)+'})()').runInContext(context);return {context,clock,doc,controller};
 }
 let release,started;const held=new Promise(resolve=>release=resolve),hashStarted=new Promise(resolve=>started=resolve);
 const slow={subtle:{digest:async(...args)=>{started();await held;return globalThis.crypto.subtle.digest(...args);}}};
 const a=await reader(profile,structuredClone(book),100,slow),b=await reader(secondProfile,secondBook,200);
 const saving=a.context.save();await hashStarted;await b.context.save();await locks.flush();release();await saving;await locks.flush();assert.deepEqual(writes.map(write=>write.edition),['alice']);assert.equal(JSON.parse(storage.get(CONTINUATION_KEY)).at,200);
 a.clock.at=200;await a.context.save();await locks.flush();assert.equal(writes.length,1,'equal millisecond keeps published pointer');
 a.clock.at=201;await a.context.save();await locks.flush();a.clock.at=202;await a.context.save();await locks.flush();assert.equal(JSON.parse(storage.get(CONTINUATION_KEY)).at,202,'same work advances ordering watermark');
 const emit=(reader,at)=>reader.doc.dispatchEvent(new CustomEvent(CONTINUATION_EVENT,{detail:{work:reader===a?book.id:secondBook.id,at}}));emit(b,201);await locks.flush();assert.equal(JSON.parse(storage.get(CONTINUATION_KEY)).edition,'austen');
 let unlock;const contention=new Promise(resolve=>unlock=resolve);void locks.request(CONTINUATION_KEY,()=>contention);emit(b,400);emit(a,300);unlock();await locks.flush();assert.deepEqual(JSON.parse(storage.get(CONTINUATION_KEY)),{v:1,edition:'alice',work:secondBook.id,at:400});
 const unsupported=await reader(profile,structuredClone(book),500,globalThis.crypto,false);await unsupported.context.save();await locks.flush();assert.equal(JSON.parse(storage.get(CONTINUATION_KEY)).at,400,'no unlocked writer fallback');
 for(const r of [a,b,unsupported])r.controller.stop();
});

test('inert config and optional bootstrap wait for parsed DOM without replaying saves',async()=>{
 const html=injectContinuation('<html><head></head><body></body></html>',{profiles:[profile],reader:'austen'});assert.match(html,/<script type="application\/json" data-newreading-continuation=/);assert.ok(!html.includes('src='));
 const doc=new EventTarget(),win=new EventTarget(),stored=new Map();let queries=0;
 doc.readyState='loading';doc.querySelector=()=>{queries++;return {getAttribute:()=>JSON.stringify({profiles:[profile],reader:'austen'})};};
 Object.assign(win,{location:{protocol:'https:',hostname:'newreading.app',host:'newreading.app',pathname:'/austen/'},navigator:{locks:{request:(_key,callback)=>Promise.resolve(callback())}},localStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)}});
 bootstrapContinuation(win,doc);assert.equal(queries,0);
 doc.dispatchEvent(new CustomEvent(CONTINUATION_EVENT,{detail:{work:book.id,at:1}}));assert.equal(stored.size,0);
 doc.readyState='interactive';doc.dispatchEvent(new Event('DOMContentLoaded'));assert.equal(queries,1);assert.equal(stored.size,0,'no replay of saves before registration');doc.dispatchEvent(new Event('DOMContentLoaded'));assert.equal(queries,1,'registers once');
 doc.dispatchEvent(new CustomEvent(CONTINUATION_EVENT,{detail:{work:book.id,at:2}}));assert.equal(JSON.parse(stored.get(CONTINUATION_KEY)).at,2);
 const parsed=new EventTarget();parsed.readyState='complete';let readyQueries=0;parsed.querySelector=()=>{readyQueries++;return null;};bootstrapContinuation(win,parsed);assert.equal(readyQueries,1,'late async module initializes immediately');
});

test('library loader strictly adapts one ready anchor and catches failed unawaited imports',async()=>{
 const source=await readFile(new URL('./library/app.mjs',import.meta.url),'utf8'),adapted=adaptContinuationLibrary(source);
 assert.ok(adapted.includes("document.body.dataset.libraryReady='true';\n// Optional import"));assert.ok(adapted.includes("void import('/continuation.mjs').catch(()=>{});"));
 assert.throws(()=>adaptContinuationLibrary(adapted));assert.throws(()=>adaptContinuationLibrary(source+source));assert.throws(()=>adaptContinuationLibrary(''));
});

test('optional request is scheduled only after window load has completed',async()=>{
 const win=new EventTarget(),scheduled=[],doc={readyState:'loading',body:{dataset:{}}},context=vm.createContext({window:win,document:doc,setTimeout:callback=>scheduled.push(callback)});
 const adapted=adaptContinuationLibrary("document.body.dataset.libraryReady='true';");new vm.Script(adapted).runInContext(context);
 assert.equal(doc.body.dataset.libraryReady,'true');assert.equal(scheduled.length,0,'no request task during loading');win.dispatchEvent(new Event('load'));assert.equal(scheduled.length,1);win.dispatchEvent(new Event('load'));assert.equal(scheduled.length,1);scheduled[0]();await new Promise(resolve=>setTimeout(resolve,0));
 const complete={readyState:'complete',body:{dataset:{}}},late=[];new vm.Script(adapted).runInContext(vm.createContext({window:new EventTarget(),document:complete,setTimeout:callback=>late.push(callback)}));assert.equal(late.length,1,'already loaded documents also defer request to a new task');
});

async function admissionContext({moduleFails=false,crypto=globalThis.crypto}={}){
 const scheduled=[],document={readyState:'complete',node:null,querySelector(){return this.node;}},location={hash:'#shelf'};let release;
 const moduleResult=new Promise((resolve,reject)=>release=()=>moduleFails?reject(Error('optional unavailable')):resolve({}));
 const context=vm.createContext({sample:structuredClone(book),position:pos,fail:false,canonical,crypto,TextEncoder,Uint8Array,window:new EventTarget(),document,location,history:{state:null,replaceState(_s,_t,hash){location.hash=hash;}},actions:[],messages:[],offline(){},setTimeout:callback=>scheduled.push(callback),loadModule:()=>moduleResult,CustomEvent:class{}});
 const controls=`globalThis.renderNow=render;globalThis.view=(value,node)=>{activeBook=value;activeSection=value?.sections[0];route={view:'read',book:value?.id,section:activeSection?.id};location.hash='#read/'+route.book+'/'+route.section;if(document.node&&document.node!==node)document.node.isConnected=false;document.node=node;};`;
 const adapted=adaptContinuationApp(source+controls,profile).replace("import('/continuation.mjs')",'loadModule()');
 await new vm.Script('(async()=>{'+adapted+'})()').runInContext(context);
 const flush=async()=>{for(const task of scheduled.splice(0))task();await new Promise(resolve=>setTimeout(resolve,10));};
 return {context,document,location,scheduled,release,flush};
}
function readingNode(value=book){return {isConnected:true,dataset:{book:value.id,section:value.sections[0].id,positionReady:'true'},removeAttribute(name){if(name==='data-public-edition')delete this.dataset.publicEdition;}};}
test('late successful optional admission marks canonical ready view without any reading save',async()=>{
 const h=await admissionContext(),value=structuredClone(book),node=readingNode(value);h.context.view(value,node);await h.context.renderNow();await h.flush();assert.equal(node.dataset.publicEdition,undefined,'held optional module is fail closed');assert.equal(Object.isFrozen(value),false);
 h.release();await h.flush();await h.flush();assert.equal(node.dataset.publicEdition,'verified');assert.ok(Object.isFrozen(value.sections[0].blocks[0]));assert.throws(()=>{value.title='mutated';},TypeError);
 const restored=structuredClone(book),restoredNode=readingNode(restored);h.context.view(restored,restoredNode);await h.context.renderNow();assert.equal(restoredNode.dataset.publicEdition,undefined);await h.flush();assert.equal(restoredNode.dataset.publicEdition,'verified','exact restored replacement object qualifies');
 const changed=structuredClone(book);changed.sections[0].blocks[0].text='Same-ID private imported content';const importedNode=readingNode(changed);h.context.view(changed,importedNode);await h.context.renderNow();await h.flush();assert.equal(importedNode.dataset.publicEdition,undefined);assert.equal(Object.isFrozen(changed),false);
 const failed=await admissionContext({moduleFails:true}),failedNode=readingNode();failed.context.view(structuredClone(book),failedNode);await failed.context.renderNow();await failed.flush();failed.release();await failed.flush();await failed.flush();assert.equal(failedNode.dataset.publicEdition,undefined);
});
test('admission revokes synchronously and rejects delayed view, readiness and mutation races',async()=>{
 let releaseProof,started;const held=new Promise(resolve=>releaseProof=resolve),begun=new Promise(resolve=>started=resolve);
 const h=await admissionContext({crypto:{subtle:{digest:async(...args)=>{started();await held;return globalThis.crypto.subtle.digest(...args);}}}}),value=structuredClone(book),node=readingNode(value);
 h.context.view(value,node);await h.context.renderNow();await h.flush();h.release();await h.flush();const proving=h.flush();await begun;
 // Rendering the same object into a fresh node invalidates an older completion.
 const next=readingNode(value);h.context.view(value,next);await h.context.renderNow();releaseProof();await proving;assert.equal(node.dataset.publicEdition,undefined);assert.equal(next.dataset.publicEdition,undefined);await h.flush();assert.equal(next.dataset.publicEdition,'verified');
 await h.context.renderNow();assert.equal(next.dataset.publicEdition,undefined,'every render synchronously revokes');h.location.hash='#shelf';await h.flush();assert.equal(next.dataset.publicEdition,undefined,'route change before task is rejected');
 h.context.view(value,next);await h.context.renderNow();next.dataset.positionReady='false';await h.flush();assert.equal(next.dataset.publicEdition,undefined,'readiness revoked before task is rejected');
 const mutation=await admissionContext(),mutated=structuredClone(book),mutatedNode=readingNode(mutated);mutation.context.crypto={subtle:{digest:async(...args)=>{mutated.title='changed during asynchronous proof';return globalThis.crypto.subtle.digest(...args);}}};mutation.context.view(mutated,mutatedNode);await mutation.context.renderNow();await mutation.flush();mutation.release();await mutation.flush();await mutation.flush();assert.equal(mutatedNode.dataset.publicEdition,undefined);assert.equal(Object.isFrozen(mutated),false,'mutable object is never positively cached');
});
