// Exact-edition notice identity; literary data stays in the private prepared file.
import {canonical} from './bundle.mjs';
import {sha256} from './core.mjs';
export const PLAY_PROFILE='a-dolls-house/drama@1';
const verified=new WeakMap();
export async function preparePlayCopy(books){
 for(const book of books)if(book.profile===PLAY_PROFILE){try{const snapshot=canonical(book),key=await sha256(new TextEncoder().encode(snapshot));verified.set(book,{snapshot,key});}catch{}}
}
export function playSnapshot(book){const proof=book&&verified.get(book);return proof&&proof.snapshot===canonical(book)?proof.key:null;}
export function playNotice(book){return playSnapshot(book)?book.context.find(c=>c.label==='Reading and reuse')?.text.split('\n\n')[0]:null;}
