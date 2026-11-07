import {canonical} from './bundle.mjs';

// A server update must not replace an edition already saved on this device.
// IDs, source bytes and records remain untouched; alternate editions are
// reported separately so the reader can export and reconcile them explicitly.
export function mergeLibrary(supplied,local) {
  for(const [label,items] of [['Supplied',supplied],['Stored',local]]) {
    if(new Set(items.map(book=>book.id)).size!==items.length)throw new Error(`${label} library contains duplicate book IDs. Keep the original data and review the editions.`);
  }
  const stored=new Map(local.map(book=>[book.id,book])),conflicts=[];
  const books=supplied.map(book=>{
    const saved=stored.get(book.id);
    if(saved&&canonical(saved)!==canonical(book))conflicts.push({stored:saved,supplied:book});
    return saved||book;
  });
  const suppliedIds=new Set(supplied.map(book=>book.id));
  books.push(...local.filter(book=>!suppliedIds.has(book.id)));
  return {books,conflicts,availableSupplied:supplied.filter(book=>!conflicts.some(conflict=>conflict.supplied.id===book.id))};
}
