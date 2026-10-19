import {sha256,validateBook} from './core.mjs';

// Project-scoped transport supplement. Hash pins identify unchanged prepared
// editions and exact source-footer bytes; no book text is built into this module.
export const NOTICE_PROFILE='beside-the-bed/source-notices@1';
export const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const pins=[
  {bookId:'nightingale-1898',key:'nightingale',editionSha256:'015e79a0bdb42ae09a47cdbaf40c7af92ff38dc1ac80f12d0752a944ecb35e40',sourceSha256:'301054cb2f5038f876d1a495969c18f563ee10db46d3d15924aac5b76391c21a',sha256:'e2af3b337e87f4fd90018a866d17bc066d14433e60c3b9b4ecc82893380218a3'},
  {bookId:'whitman-specimen',key:'whitman',editionSha256:'d41ed1fa2805098834a086d41739df797a2d8e95f1862d1ec493489bfbb621b3',sourceSha256:'4b6e31c67bfd49a1372c7f5ccadc0547fee822bef1cc3117cb5c43a8b0670725',sha256:'de6cd8f99acadd26e0aff8c49a652352a16cad81060972233f5657e69160db39'}
];
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const hash=text=>sha256(new TextEncoder().encode(text));
export const needsSourceNotice=book=>pins.some(p=>p.bookId===book.id);
export const missingSourceNotices=(books,records=[])=>books.filter(needsSourceNotice).filter(b=>!records.some(n=>n.bookId===b.id));
export function mergeSourceNotices(current=[],incoming=[]) {
  return [...new Map([...current,...incoming].map(n=>[n.bookId,n])).values()].sort((a,b)=>a.bookId.localeCompare(b.bookId));
}
export async function validateSourceNotices(records,books=null,{required=false}={}) {
  check(Array.isArray(records)&&records.length<=pins.length,'Unsupported source-notice supplement. Nothing was imported.');
  const ids=new Set();
  for(const n of records) {
    check(n&&typeof n==='object'&&!Array.isArray(n)&&Object.keys(n).sort().join('|')==='bookId|editionSha256|sha256|sourceSha256|text','Unsupported source-notice fields. Nothing was imported.');
    const pin=pins.find(p=>p.bookId===n.bookId);
    check(pin&&!ids.has(n.bookId),'Unknown or duplicate source-notice edition. Nothing was imported.');ids.add(n.bookId);
    check(['editionSha256','sourceSha256','sha256'].every(k=>n[k]===pin[k]),'Source notices do not match the reviewed edition fingerprints. Nothing was imported.');
    check(typeof n.text==='string'&&n.text.length<=64000&&await hash(n.text)===pin.sha256,'Source notice text differs from the reviewed full notice. Nothing was imported.');
    if(books) {
      const book=books.find(b=>b.id===n.bookId);
      check(book&&book.source.sha256===pin.sourceSha256&&await hash(canonical(validateBook(book)))===pin.editionSha256,'Source notices do not match these exact edition bytes. Nothing was imported.');
    }
  }
  if(required&&books)check(!missingSourceNotices(books,records).length,'Full source notices are unavailable for a selected edition. Reconnect to its matching reader and retry; no incomplete edition file was downloaded.');
  return structuredClone(records);
}
export async function noticesFromAsset(value,books) {
  check(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')==='nightingale|whitman','The hosted source-notice asset is invalid.');
  const records=pins.filter(p=>books.some(b=>b.id===p.bookId)).map(({key,...pin})=>({...pin,text:value[key]}));
  return validateSourceNotices(records,books,{required:true});
}
