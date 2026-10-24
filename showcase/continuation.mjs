// Optional browser-local continuity for the twenty admitted public readers.
// Existing book/state objects are inspected locally; the pointer contains no text or position.
export const CONTINUATION_KEY='newreading-continuation-v1';
export const CONTINUATION_EVENT='newreading:continuation';
export const PUBLIC_WORKS=Object.freeze(Object.fromEntries(Object.entries({austen:['austen-pride-1894'],alice:['alice-rackham-28885'],walden:['walden','civil-disobedience'],'two-halls':['hegel','schopenhauer'],odyssey:['odyssey-butler-1727'],dracula:['dracula'],'at-table':['savarin','beeton','estes'],'inward-life':['julian','tagore','james'],'music-and-feeling':['hanslick','tolstoy'],'learning-to-see':['ruskin','crane'],'beside-the-bed':['nightingale-1898','whitman-specimen'],nietzsche:['nietzsche','epicurus'],mountains:['conway-alps-1904'],'war-and-peace':['war-and-peace-maude'],douglass:['douglass-1845','bingham-dialogue-1817','douglass-escape-1881','fugitive-act-1793'],poe:['usher-1845'],'ballads':["erlkoenig-de", "erlkoenig-en", "lenore-de", "lenore-en", "handschuh-de", "handschuh-en", "taucher-de", "taucher-en", "kraniche-de", "kraniche-en", "iphigenie-de", "iphigenie-en"],'shakespeare':["folger-julius-caesar", "folger-henry-v", "folger-the-tempest"],'pictures-after-dark':["pictures-fr", "pictures-en"],'rome':["augustus-en", "augustus-la", "caesar-vii-en", "caesar-vii-la", "marcus-ii-iii-en", "marcus-ii-iii-grc", "pliny-trajan", "sallust-51", "tacitus-annals-1"]}).map(([key,value])=>[key,Object.freeze(value)])));
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,expected)=>object(value)&&Object.keys(value).sort().join(',')===[...expected].sort().join(',');
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value)&&!['constructor','prototype','__proto__'].includes(value);
const label=value=>typeof value==='string'&&value.length>0&&value.length<=500;
// The same canonical object contract as the existing reader bundle modules.
export const canonical=value=>JSON.stringify(value,(_key,item)=>object(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export async function bookFingerprint(book,crypto=globalThis.crypto){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(book)));
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
}
export function validProfile(profile){
  if(!keys(profile,['edition','title','works'])||!Object.hasOwn(PUBLIC_WORKS,profile.edition)||!label(profile.title)||!Array.isArray(profile.works))return false;
  const expected=PUBLIC_WORKS[profile.edition];
  return profile.works.length===expected.length&&new Set(profile.works.map(work=>work?.id)).size===expected.length&&profile.works.every(work=>keys(work,['id','title','revision','fingerprint'])&&expected.includes(work.id)&&label(work.title)&&hash(work.revision)&&hash(work.fingerprint));
}
// Build caller passes the selected example's validateBook(raw) results, never raw unvalidated input.
export async function createContinuationProfile({edition,title,books}){
  if(!Object.hasOwn(PUBLIC_WORKS,edition)||!Array.isArray(books))throw Error('Unknown public continuation edition');
  const profile={edition,title,works:await Promise.all(books.map(async book=>({id:book.id,title:book.title,revision:book.source.sha256,fingerprint:await bookFingerprint(book)})))};
  if(!validProfile(profile))throw Error('Public continuation profile does not match its admitted works');
  return profile;
}
export function parsePointer(raw,profiles=null,now=Date.now()){
  try{
    if(typeof raw!=='string'||raw.length>1024)return null;
    const value=JSON.parse(raw);
    if(!keys(value,['v','edition','work','at'])||value.v!==1||!Object.hasOwn(PUBLIC_WORKS,value.edition)||!PUBLIC_WORKS[value.edition].includes(value.work)||!Number.isSafeInteger(value.at)||value.at<0||value.at>now+60000)return null;
    if(profiles!==null){const profile=profiles.find(profile=>profile.edition===value.edition);if(!validProfile(profile))return null;}
    return {v:1,edition:value.edition,work:value.work,at:value.at};
  }catch{return null;}
}
export function validPosition(position,work){
  return object(position)&&position.revision===work.revision&&id(position.sectionId)&&(position.blockId===null||id(position.blockId))&&Number.isFinite(position.ratio)&&position.ratio>=0&&position.ratio<=1;
}
export function continuationHref(pointer){
  return Object.hasOwn(PUBLIC_WORKS,pointer?.edition)&&PUBLIC_WORKS[pointer.edition].includes(pointer.work)?`/${pointer.edition}/#continue/${pointer.work}`:null;
}
// Never enumerate all reader databases, open a version, migrate, or create an absent database.
export function readContinuationSnapshot(indexedDB,pointer,{timeout=1800}={}){
  return new Promise((resolve,reject)=>{
    let request,db,transaction,done=false;
    const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);db?.close();error?reject(error):resolve(result);};
    const timer=setTimeout(()=>{try{transaction?.abort();}catch{}finish(Error('Saved reading is unavailable'));},timeout);
    try{request=indexedDB.open('newreading-'+pointer.edition+'-v1');}catch(error){finish(error);return;}
    request.onupgradeneeded=()=>{try{request.transaction.abort();request.result.close();}catch{}finish(null,null);};
    request.onblocked=()=>finish(Error('Saved reading is busy'));
    request.onerror=()=>finish(request.error||Error('Saved reading could not be opened'));
    request.onsuccess=()=>{
      db=request.result;if(done){db.close();return;}
      db.onversionchange=()=>finish(Error('Saved reading changed'));
      try{
        if(db.version!==1||!db.objectStoreNames.contains('state')||!db.objectStoreNames.contains('books')){finish(null,null);return;}
        transaction=db.transaction(['state','books'],'readonly');
        const state=transaction.objectStore('state').get('reader'),book=transaction.objectStore('books').get(pointer.work);
        transaction.oncomplete=()=>finish(null,{state:state.result,book:book.result});
        transaction.onerror=transaction.onabort=()=>finish(transaction.error||Error('Saved reading could not be read'));
      }catch(error){finish(error);}
    };
  });
}
export async function validateContinuation(pointer,profiles,indexedDB,crypto=globalThis.crypto){
  const profile=profiles.find(profile=>profile.edition===pointer?.edition),work=profile?.works.find(work=>work.id===pointer.work);
  if(!validProfile(profile)||!work||!crypto?.subtle)return false;
  const snapshot=await readContinuationSnapshot(indexedDB,pointer);
  if(!snapshot||snapshot.state?.schema!==1||!validPosition(snapshot.state?.positions?.[pointer.work],work))return false;
  // A same-ID local book may be a legitimate exact restore or conflicting private material.
  // Full canonical equality is required even when a modified object retains its old source SHA.
  if(snapshot.book!==undefined){
    if(snapshot.book?.id!==work.id||snapshot.book?.source?.sha256!==work.revision||await bookFingerprint(snapshot.book,crypto)!==work.fingerprint)return false;
    const position=snapshot.state.positions[pointer.work],section=snapshot.book.sections?.find(section=>section.id===position.sectionId);
    if(!section||(position.blockId!==null&&!section.blocks.some(block=>block.id===position.blockId)))return false;
  }
  return true;
}
function escapeAttribute(value){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function injectContinuation(html,{profiles,reader=null}){
  if(!Array.isArray(profiles)||!profiles.length||profiles.some(profile=>!validProfile(profile))||new Set(profiles.map(profile=>profile.edition)).size!==profiles.length||reader&&!profiles.some(profile=>profile.edition===reader))throw Error('Invalid continuation configuration');
  if(html.split('</head>').length!==2||html.includes('data-newreading-continuation'))throw Error('Continuation HTML insertion assumption changed');
  const config=escapeAttribute(JSON.stringify({profiles,reader}));
  return html.replace('</head>',`<script type="application/json" data-newreading-continuation="${config}"></script></head>`);
}
const continuationLoader="const __nrContinuationLoad=()=>{void import('/continuation.mjs').catch(()=>{});};\nif(document.readyState==='complete')setTimeout(__nrContinuationLoad,0);else window.addEventListener('load',()=>setTimeout(__nrContinuationLoad,0),{once:true});";
export function adaptContinuationLibrary(source){
  const anchor="document.body.dataset.libraryReady='true';";
  if(typeof source!=='string'||source.includes(continuationLoader)||source.split(anchor).length!==2)throw Error('Continuation library assumption changed');
  return source.replace(anchor,anchor+'\n// Optional import never holds the document load or the library controls.\n'+continuationLoader);
}
export function adaptContinuationApp(source,profile){
  if(!validProfile(profile)||source.includes('__nrContinuation'))throw Error('Invalid or duplicate continuation adapter');
  const pins=Object.fromEntries(profile.works.map(work=>[work.id,{revision:work.revision,fingerprint:work.fingerprint}]));
  const once=(from,to)=>{if(source.split(from).length!==2)throw Error('Continuation app assumption changed: '+from);source=source.replace(from,to);};
  const save='try {await commit(s => {s.positions[book.id] = pos;s.lastBook = book.id;return s;});}';
  once(save,save.slice(0,-1)+`const continuationAt=Date.now(),continuationSave=++__nrContinuationSave;if(await __nrContinuationPublic(book)&&continuationSave===__nrContinuationSave)document.dispatchEvent(new CustomEvent('${CONTINUATION_EVENT}',{detail:{work:book.id,at:continuationAt}}));}`);
  const resume='if(location.hash===hash){route=parseRoute();await render();}else location.hash=hash;break;';
  once(resume,`if(location.hash===hash){route=parseRoute();await render();}else if(target.dataset.publicContinuation==='1'){history.replaceState(history.state,'',hash);route=parseRoute();await render();}else location.hash=hash;break;`);
  once('async function render({keepScroll=false}={}) {','async function render({keepScroll=false}={}) {\n  __nrContinuationInvalidate();');
  once("    $('#reading-text').dataset.positionReady='true';","    $('#reading-text').dataset.positionReady='true';\n    __nrContinuationQueueAdmission();");
  const readerLoader=continuationLoader.replace("import('/continuation.mjs').catch", "import('/continuation.mjs').then(()=>{__nrContinuationAvailable=true;__nrContinuationQueueAdmission();}).catch");
  const declaration=`// Mounted public continuation adapter: exact admitted object, no DOM-click automation.
// Start only after document load has finished: WebKit ties font readiness to early loads.
${readerLoader}
const __nrContinuationPins=${JSON.stringify(pins)},__nrContinuationProof=new WeakMap();
let __nrContinuationSave=0,__nrContinuationGeneration=0,__nrContinuationAvailable=false;
// Only a boolean admission crosses into DOM; no book, record or digest reaches analytics.
// Revoke synchronously before every render; late proofs must still describe this exact view.
function __nrContinuationInvalidate(){
  ++__nrContinuationGeneration;
  document.querySelector('#reading-text')?.removeAttribute('data-public-edition');
}
function __nrContinuationQueueAdmission(){
  if(!__nrContinuationAvailable)return;
  const generation=__nrContinuationGeneration,node=document.querySelector('#reading-text'),book=activeBook,section=activeSection,hash=location.hash;
  const current=()=>generation===__nrContinuationGeneration&&node?.isConnected&&node===document.querySelector('#reading-text')&&book===activeBook&&section===activeSection&&hash===location.hash&&route.view==='read'&&route.book===book?.id&&route.section===section?.id&&node.dataset.book===book?.id&&node.dataset.section===section?.id&&node.dataset.positionReady==='true';
  if(!current())return;
  // A separate task keeps canonical serialization out of the essential render path.
  setTimeout(()=>{void (async()=>{if(current()&&await __nrContinuationPublic(book)&&current())node.dataset.publicEdition='verified';})().catch(()=>{});},0);
}
// Validated book trees are read-only in these readers; imports/restores replace objects.
// Freeze only an exact admitted snapshot so repeated scroll saves do not rehash whole books.
function __nrContinuationFreeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))__nrContinuationFreeze(child);Object.freeze(value);}return value;}
async function __nrContinuationPublic(book){
  const pin=book&&Object.hasOwn(__nrContinuationPins,book.id)&&__nrContinuationPins[book.id];
  if(!pin||pin.revision!==book.source?.sha256||!crypto?.subtle)return false;
  try{
    if(__nrContinuationProof.get(book)===true)return true;
    const text=canonical(book),bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    if([...new Uint8Array(bytes)].map(value=>value.toString(16).padStart(2,'0')).join('')!==pin.fingerprint||canonical(book)!==text)return false;
    __nrContinuationFreeze(book);__nrContinuationProof.set(book,true);return true;
  }catch{return false;}
}

`;
  const activation=`
// Consume the explicit public-work sentinel once; replace the entry so Back returns to the library.
if(location.hash.startsWith('#continue/')){
  let work;try{const parts=location.hash.slice(1).split('/');if(parts.length===2)work=decodeURIComponent(parts[1]);}catch{}
  history.replaceState(history.state,'','#shelf');
  const book=bookById(work),position=state.positions[work];
  if(await __nrContinuationPublic(book)&&position?.revision===book.source.sha256&&Number.isFinite(position.ratio)&&position.ratio>=0&&position.ratio<=1&&book.sections.some(s=>s.id===position.sectionId&&(position.blockId===null||s.blocks.some(b=>b.id===position.blockId)))){
    await act({dataset:{action:'resume',book:work,publicContinuation:'1'}});
  }else {
    try{const pointer=JSON.parse(localStorage.getItem('${CONTINUATION_KEY}'));if(pointer?.edition===${JSON.stringify(profile.edition)}&&pointer.work===work)localStorage.removeItem('${CONTINUATION_KEY}');}catch{}
    say('Your saved place is unavailable. Open a book from this edition.');
  }
}
`;
  once('void offline();',activation+'\nvoid offline();');
  return declaration+source;
}
function supportedLocation(location,reader){
  if(!['https:','http:'].includes(location.protocol))return false;
  const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
  if(!local&&!(location.protocol==='https:'&&location.host==='newreading.app'))return false;
  return location.pathname===(reader?`/${reader}/`:'/library/');
}
export function startContinuation(win=window,doc=document){
  const script=doc.querySelector('script[data-newreading-continuation]');if(!script)return;
  let config;try{config=JSON.parse(script.getAttribute('data-newreading-continuation'));}catch{return;}
  if(!keys(config,['profiles','reader'])||!Array.isArray(config.profiles)||!config.profiles.length||config.profiles.length>Object.keys(PUBLIC_WORKS).length||config.profiles.some(profile=>!validProfile(profile))||!(config.reader===null||config.profiles.some(profile=>profile.edition===config.reader))||!supportedLocation(win.location,config.reader))return;
  const profiles=config.profiles,read=()=>parsePointer(win.localStorage.getItem(CONTINUATION_KEY),config.reader?null:profiles),listeners=[];
  const listen=(target,type,fn)=>{target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));};
  if(config.reader){
    const profile=profiles.find(profile=>profile.edition===config.reader);
    let locks;try{locks=win.navigator?.locks;}catch{}
    // No unlocked fallback: another tab must not win a stale read/compare/write race.
    if(!locks?.request)return {stop:()=>{}};
    listen(doc,CONTINUATION_EVENT,event=>{
      if(!keys(event.detail,['work','at'])||!profile.works.some(work=>work.id===event.detail.work)||!Number.isSafeInteger(event.detail.at)||event.detail.at<0||event.detail.at>Date.now()+60000)return;
      const {work,at}=event.detail;
      try{void locks.request(CONTINUATION_KEY,()=>{
        try{
          const before=read();
          // Captured commit time survives delayed hashing and cross-tab delivery.
          // Equal clock ticks keep the published pointer; sub-tick order is unknowable here.
          if(before&&at<=before.at)return;
          win.localStorage.setItem(CONTINUATION_KEY,JSON.stringify({v:1,edition:profile.edition,work,at}));
        }catch{/* Reading and its original save remain independent of this optional pointer. */}
      }).catch(()=>{});}catch{/* Web Locks or browser storage may be unavailable. */}
    });
    return {stop:()=>listeners.forEach(remove=>remove())};
  }
  const panel=doc.querySelector('[data-continuation]'),link=panel?.querySelector('[data-continuation-link]'),status=doc.querySelector('[data-continuation-status]');
  let indexedDB,crypto;try{indexedDB=win.indexedDB;crypto=win.crypto;}catch{return;}
  if(!panel||!link||!indexedDB||!crypto?.subtle)return;
  let revision=0,displayed=null;
  function hide(){panel.hidden=true;displayed=null;link.removeAttribute('href');link.textContent='';}
  async function refresh(){
    const ticket=++revision;let pointer;
    try{
      pointer=read();if(!pointer||!await validateContinuation(pointer,profiles,indexedDB,crypto)){if(ticket===revision)hide();return null;}
      if(ticket!==revision||canonical(pointer)!==canonical(read()))return null;
      const work=profiles.find(profile=>profile.edition===pointer.edition).works.find(work=>work.id===pointer.work);
      link.textContent='Continue '+work.title;link.href=continuationHref(pointer);panel.hidden=false;displayed=pointer;return pointer;
    }catch{if(ticket===revision)hide();return null;}
  }
  listen(win,'storage',event=>{if(event.key===CONTINUATION_KEY||event.key===null)void refresh();});
  listen(win,'pageshow',()=>void refresh());listen(win,'focus',()=>void refresh());listen(doc,'visibilitychange',()=>{if(doc.visibilityState==='visible')void refresh();});
  listen(link,'click',async event=>{
    if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
    event.preventDefault();const selected=displayed;const current=await refresh();
    if(!current){if(status)status.textContent='Your saved place is unavailable here. Open the edition from the library.';return;}
    if(canonical(current)!==canonical(selected)){if(status)status.textContent='Your reading changed in another tab. Choose Continue again.';return;}
    win.location.assign(continuationHref(current));
  });
  hide();void refresh();
  return {refresh,stop:()=>{revision++;listeners.forEach(remove=>remove());}};
}
// This optional dynamically imported module never holds document load or its caller.
// If it arrives late, only a later successful reading save creates a pointer; no events are replayed.
export function bootstrapContinuation(win=window,doc=document){
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>startContinuation(win,doc),{once:true});
  else return startContinuation(win,doc);
}
if(typeof window!=='undefined'&&typeof document!=='undefined')bootstrapContinuation();
