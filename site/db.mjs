import {newState, validateState, validateBook} from './core.mjs';
let connection;
export function openDB() {
  if (!connection) connection = new Promise((resolve,reject) => {
    const request = indexedDB.open('reading-kit-v1',1);
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
export async function loadState() { const value = await rawState();return value === undefined ? newState() : validateState(value); }
export async function loadBooks() {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const r = db.transaction('books').objectStore('books').getAll();
    r.onsuccess = () => {try {resolve(r.result.map(validateBook));}catch(e){reject(e);}};r.onerror = () => reject(r.error);
  });
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
export async function removeBook(id) {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('books','readwrite');tx.objectStore('books').delete(id);tx.oncomplete = resolve;tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
