import {canonical} from './bundle.mjs';
import {sha256} from './core.mjs';

// A credit belongs to an exact reviewed edition, never merely to its ID.
const witnesses={
  "pictures-fr": {
    "source": "bb01b25288b6b3c495fc08eaa4499528400264c64c3a593957799d4f9b954005",
    "snapshot": "8d46f309cdfd6570fad3ffe155b2e1830170d3e5620396d240c455ea4a7920fa"
  },
  "pictures-en": {
    "source": "b1e74f8a031b75374b10a5f2e6abfac149dccf5c8918117800144764c6833af5",
    "snapshot": "4f16e241b5aa411c8134b45beb1f2ef5833f60bde0d9f3457f6f6eb96624983c"
  }
};
const reviewed=new WeakMap();
export async function prepareFolioRights(books){
 for(const book of books){
  const witness=witnesses[book.id];if(!witness||book.source.sha256!==witness.source)continue;
  try{const snapshot=canonical(book);if(await sha256(new TextEncoder().encode(snapshot))===witness.snapshot)reviewed.set(book,snapshot);}catch{/* Reading and exact exports remain available. */}
 }
}
const isReviewed=book=>reviewed.get(book)===canonical(book);
export function folioPassageCredits(book,section){
 if(!witnesses[book.id]||!isReviewed(book))return null;
 const hugo=['djinns','tombe'].includes(section.id),author=hugo?'Victor Hugo':'Aloysius Bertrand';
 const edition=book.language==='fr'
  ? section.id==='djinns'?'Les Orientales · 1912 witness':section.id==='tombe'?'Les Voix intérieures · 1909 witness':'Gaspard de la nuit · 1920 witness'
  : section.id==='djinns'?'Translated by John L. O’Sullivan · undated Crowell edition':section.id==='tombe'?'Translated by Andrew Lang · 1892':'Translated by Stuart Merrill · 1890';
 return [`${author} · ${section.title}`,edition];
}
export function folioShareAttribution(book){
 const witness=witnesses[book.id];if(book.id!=='pictures-fr'||!witness||book.source.sha256!==witness.source)return [];
 if(!isReviewed(book))throw new Error('This edition’s sharing credits could not be verified. Export the exact edition with its source notes instead.');
 return ['Wikisource contributors · adapted transcription · CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/','Sources and changes: https://newreading.app/pictures-after-dark/sources/#french'];
}
export function folioContextText(book,context){
 if(!witnesses[book.id]||!isReviewed(book))return context.text;
 return context.text.replace('This is a local review candidate with no public release decision. ','').replace('keep this local application','keep this reader').replace('The actual retained1920','The retained 1920').replace('MasonII, TulipV, RondeVI, SalamanderX, PadreIV','Mason II, Tulip V, Ronde VI, Salamander X, Padre IV');
}
