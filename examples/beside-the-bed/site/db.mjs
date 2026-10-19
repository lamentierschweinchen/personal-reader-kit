import {newState, validateState, validateBook} from './core.mjs';
import {validateBundle,snapshotToken,planBundleRestore} from './bundle.mjs';
import {validateSourceNotices,mergeSourceNotices} from './notices.mjs';
let connection;
export function openDB() {
  if (!connection) connection = new Promise((resolve,reject) => {
    const request = indexedDB.open('beside-the-bed-v1',1);
    request.onupgradeneeded = () => {request.result.createObjectStore('books',{keyPath:'id'});request.result.createObjectStore('state');};
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {connection = null;reject(request.error);};
    request.onblocked = () => reject(new Error('Close another reader tab to finish opening storage.'));
  });
  return connection;
}
async function get(store,key) {
  const db = await openDB();
  return new Promise((resolve,reject) => {const r = db.transaction(store).objectStore(store).get(key);r.onsuccess = () => resolve(r.result);r.onerror = () => reject(r.error);});
}
export const rawState = () => get('state','reader');
export const rawSourceNotices = () => get('state','source-notices');
export async function loadSourceNotices() {return validateSourceNotices((await rawSourceNotices())||[]);}
export async function saveSourceNotices(records,books) {
  const checked=await validateSourceNotices(records,books),db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readwrite'),store=tx.objectStore('state');let result,failure;
    tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(failure||tx.error||new Error('Full source notices could not be saved on this device.'));
    const request=store.get('source-notices');request.onsuccess=()=>{try{result=mergeSourceNotices(request.result||[],checked);store.put(result,'source-notices');}catch(error){failure=error;tx.abort();}};
  });
}
export async function loadState() { const value = await rawState();return value === undefined ? newState() : validateState(value); }
export async function rawBooks() {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const r = db.transaction('books').objectStore('books').getAll();
    r.onsuccess = () => resolve(r.result);r.onerror = () => reject(r.error);
  });
}
export async function loadBooks() {
  const books=[],rejected=[];
  for(const record of await rawBooks()) {
    try {books.push(validateBook(record));}
    catch(error) {rejected.push({id:typeof record?.id==='string'?record.id:null,reason:error.message});}
  }
  return {books,rejected};
}
export async function saveBook(book) {
  const checked = validateBook(book), db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('books','readwrite');
    tx.oncomplete = () => resolve(checked);tx.onerror = tx.onabort = () => reject(tx.error || new Error('Book storage failed.'));
    tx.objectStore('books').put(checked);
  });
}
// IndexedDB read/write transactions serialize edits across tabs. Each mutation reads the
// latest committed state; no whole-tab snapshot overwrites another tab's annotations.
export async function updateState(change) {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('state','readwrite'), store = tx.objectStore('state');let next, failure;
    tx.oncomplete = () => resolve(next);
    tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error('Could not save on this device.'));
    const request = store.get('reader');
    request.onsuccess = () => {
      try {
        const current = request.result === undefined ? newState() : validateState(request.result);
        next = validateState(change(structuredClone(current)) || current);next.revision = current.revision + 1;store.put(next,'reader');
      } catch(e) {failure = e;tx.abort();}
    };
  });
}
export async function recoveryArchives() {
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const records=[],request=db.transaction('state').objectStore('state').openCursor();
    request.onsuccess=()=>{const cursor=request.result;if(!cursor){resolve(records);return;}if(String(cursor.key).startsWith('recovery-'))records.push({key:cursor.key,...cursor.value});cursor.continue();};
    request.onerror=()=>reject(request.error);
  });
}
// Repair is intentionally separate from ordinary merges. Quarantine and replacement
// commit together, and an already healthy state can never be overwritten by a stale
// recovery dialog. Books live in another store and are not touched.
export async function recoverState(replacement) {
  const next=validateState(replacement),db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('state','readwrite'),store=tx.objectStore('state');let failure;
    tx.oncomplete=()=>resolve(next);
    tx.onerror=tx.onabort=()=>reject(failure||tx.error||new Error('Recovery could not be saved. The original data is unchanged.'));
    const request=store.get('reader');
    request.onsuccess=()=>{
      try {
        let healthy=request.result===undefined;
        if(!healthy)try{validateState(request.result);healthy=true;}catch{/* The invalid object will be retained verbatim. */}
        if(healthy)throw new Error('The saved state is already readable. Reopen Settings and use normal restore; no records were replaced.');
        store.put({savedAt:new Date().toISOString(),original:request.result},`recovery-${crypto.randomUUID()}`);
        next.revision+=1;store.put(next,'reader');
      }catch(error){failure=error;tx.abort();}
    };
  });
}
export async function removeBook(id) {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('books','readwrite');tx.objectStore('books').delete(id);tx.oncomplete = resolve;tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

// Read books and state from the same storage snapshot for export/restore review.
export async function librarySnapshot() {
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['books','state']),bookRequest=tx.objectStore('books').getAll(),stateRequest=tx.objectStore('state').get('reader'),noticeRequest=tx.objectStore('state').get('source-notices');
    tx.oncomplete=()=>{try{resolve({books:bookRequest.result.map(validateBook),sourceNotices:noticeRequest.result||[],state:stateRequest.result===undefined?newState():validateState(stateRequest.result)});}catch(error){reject(error);}};
    tx.onerror=tx.onabort=()=>reject(tx.error||new Error('The library could not be read. Use original recovery export if any stored records are damaged.'));
  });
}

export async function restoreBundle(input,expectedToken,publicBooks=[],options={}) {
  const bundle=await validateBundle(input),db=await openDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['books','state'],'readwrite'),bookStore=tx.objectStore('books'),stateStore=tx.objectStore('state');
    const booksRequest=bookStore.getAll(),stateRequest=stateStore.get('reader'),noticeRequest=stateStore.get('source-notices');let done=0,result,failure;
    tx.oncomplete=()=>resolve(result);
    tx.onerror=tx.onabort=()=>reject(failure||tx.error||new Error('Bundle restore failed. No books or records were changed.'));
    const ready=()=>{if(++done!==3)return;try {
      const snapshot={books:booksRequest.result.map(validateBook),sourceNotices:noticeRequest.result||[],state:stateRequest.result===undefined?newState():validateState(stateRequest.result)};
      if(snapshotToken(snapshot)!==expectedToken)throw new Error('Your library changed after this preview. Choose the bundle again to review the latest state. Nothing was restored.');
      const plan=planBundleRestore(bundle,snapshot,publicBooks,options);
      if(plan.conflicts.length)throw new Error('An existing book ID has different edition content. Keep both private files and ask your agent to reconcile the editions; nothing was restored.');
      for(const book of plan.additions)bookStore.put(book);
      if(bundle.sourceNotices?.length)stateStore.put(mergeSourceNotices(snapshot.sourceNotices,bundle.sourceNotices),'source-notices');
      plan.next.revision=snapshot.state.revision+1;stateStore.put(plan.next,'reader');result={state:plan.next,addedBooks:plan.additions.length};
    }catch(error){failure=error;tx.abort();}};
    booksRequest.onsuccess=ready;stateRequest.onsuccess=ready;noticeRequest.onsuccess=ready;
  });
}
