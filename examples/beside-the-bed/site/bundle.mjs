import {validateBook,validateState,mergeBackup,sha256,anchorStatus} from './core.mjs';
import {canonical,NOTICE_PROFILE,needsSourceNotice,validateSourceNotices} from './notices.mjs';
export {canonical} from './notices.mjs';

export const KIT_VERSION='0.5.0';
export const BUNDLE_LIMIT=64*1024*1024;
const bytes=value=>new TextEncoder().encode(canonical(value));
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const body=bundle=>({format:bundle.format,schema:bundle.schema,kitVersion:bundle.kitVersion,createdAt:bundle.createdAt,books:bundle.books,state:bundle.state,...(Object.hasOwn(bundle,'noticeProfile')?{noticeProfile:bundle.noticeProfile,sourceNotices:bundle.sourceNotices}:{})});

export async function createBundle(snapshot,selectedIds=snapshot.books.map(b=>b.id)) {
  const available=snapshot.books.map(validateBook),selected=new Set(selectedIds);
  check(new Set(available.map(b=>b.id)).size===available.length,'Duplicate book IDs need review before export.');
  check(selected.size<=200,'Select at most 200 editions per bundle.');
  check(selected.size===selectedIds.length&&selectedIds.every(id=>available.some(b=>b.id===id)),'A selected edition is no longer available. Reopen the bundle export.');
  const value={format:'personal-reader-bundle',schema:1,kitVersion:KIT_VERSION,createdAt:new Date().toISOString(),books:available.filter(b=>selected.has(b.id)),state:validateState(snapshot.state)};
  if(value.books.some(needsSourceNotice)) {
    value.noticeProfile=NOTICE_PROFILE;
    value.sourceNotices=await validateSourceNotices((snapshot.sourceNotices||[]).filter(n=>selected.has(n.bookId)),value.books,{required:true});
  }
  const payload=bytes(value);check(payload.length+100<=BUNDLE_LIMIT,'This bundle exceeds 64 MB. Select fewer editions; saved records are always included.');
  return {...value,sha256:await sha256(payload)};
}

export async function validateBundle(value) {
  check(value&&typeof value==='object'&&!Array.isArray(value)&&value.format==='personal-reader-bundle'&&value.schema===1,'Unsupported reading bundle. Use a version 1 private reader bundle.');
  const extended=Object.hasOwn(value,'noticeProfile');
  check(Object.keys(value).sort().join('|')===(extended?'books|createdAt|format|kitVersion|noticeProfile|schema|sha256|sourceNotices|state':'books|createdAt|format|kitVersion|schema|sha256|state'),'Unsupported bundle fields. Nothing was imported.');
  if(extended)check(value.noticeProfile===NOTICE_PROFILE,'This notice supplement requires a matching Beside the Bed reader. Nothing was imported.');
  check(typeof value.kitVersion==='string'&&/^\d+\.\d+\.\d+$/.test(value.kitVersion)&&typeof value.createdAt==='string'&&value.createdAt.length<=40&&Number.isFinite(Date.parse(value.createdAt)),'Invalid bundle version or date.');
  check(typeof value.sha256==='string'&&/^[a-f0-9]{64}$/.test(value.sha256),'The bundle has no valid integrity checksum.');
  check(Array.isArray(value.books)&&value.books.length<=200,'A bundle can contain at most 200 editions.');
  const payload=bytes(body(value));check(payload.length+100<=BUNDLE_LIMIT,'This bundle exceeds 64 MB.');
  check(await sha256(payload)===value.sha256,'The bundle checksum does not match. Keep the original file and export again; nothing was imported.');
  const books=value.books.map(validateBook),state=validateState(value.state);
  check(new Set(books.map(b=>b.id)).size===books.length,'The bundle contains duplicate book IDs. Nothing was imported.');
  if(extended)await validateSourceNotices(value.sourceNotices,books,{required:true});
  return structuredClone(value); // Validate without changing the bytes covered by the checksum.
}

// Revision guards state edits; canonical book bytes also catch concurrent edition
// changes, which do not increment the state revision. No async work inside an IDB tx.
export function snapshotToken(snapshot) {
  return canonical({revision:snapshot.state.revision,books:[...snapshot.books].sort((a,b)=>a.id.localeCompare(b.id)),sourceNotices:[...(snapshot.sourceNotices||[])].sort((a,b)=>a.bookId.localeCompare(b.bookId))});
}

export function planBundleRestore(bundle,snapshot,publicBooks=[],{appearance=false}={}) {
  const local=snapshot.books.map(validateBook),current=validateState(snapshot.state),available=[...publicBooks.map(validateBook),...local];
  const additions=[],existing=[],conflicts=[];
  for(const book of bundle.books.map(validateBook)) {
    const matches=available.filter(b=>b.id===book.id);
    if(matches.some(b=>canonical(b)!==canonical(book)))conflicts.push(book);
    else if(matches.length)existing.push(book);
    else {additions.push(book);available.push(book);}
  }
  const incoming=validateState(bundle.state),next=mergeBackup(current,incoming);
  if(appearance)next.prefs=structuredClone(incoming.prefs);
  const unresolved=incoming.notes.filter(n=>!anchorStatus(n,available.find(b=>b.id===n.bookId)).valid).length;
  const unresolvedConnections=incoming.connections.filter(c=>c.passages.some(p=>!anchorStatus(p,available.find(b=>b.id===p.bookId)).valid)).length;
  return {additions,existing,conflicts,next,unresolved,unresolvedConnections,addedNotes:next.notes.length-current.notes.length,addedConnections:next.connections.length-current.connections.length};
}
