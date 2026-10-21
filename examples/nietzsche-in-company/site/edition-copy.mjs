// Release wording is presentation. Never rewrite the portable edition or its notices.
import {canonical} from './bundle.mjs';
import {sha256} from './core.mjs';
const expected={nietzsche:'64806a8099889af50e76ab6288a5be282418354969df57ad8a9c99177cea51ee',epicurus:'d04950b5fdf279cb15370d3ef4375ee5f6015efe2b0715c99b8c13efe655817a'};
let reviewed=new WeakSet();
export async function prepareSourcePresentation(books){
  reviewed=new WeakSet();
  for(const book of books)if(expected[book.id]&&await sha256(new TextEncoder().encode(canonical(book)))===expected[book.id])reviewed.add(book);
}
export const sourceNoticeKey=book=>reviewed.has(book)?`nietzsche-in-company:source-notice:v1:${book.id}:${expected[book.id]}`:null;
export function sourceContext(book,context){
  if(!reviewed.has(book)||book.id!=='nietzsche'||context!==book.context[2])return context;
  return {...context,label:'Edition rights',text:'Project Gutenberg identifies this edition as public domain in the USA. That is not worldwide clearance. The complete 1910 text includes poetry by Paul V. Cohn and Maude D. Petre. Cohn’s reported death in 1956 leaves a UK term question through the end of 2026; his identity and date have not been independently established. The source images are omitted. Complete source notices follow below.'};
}
