// Presentation and optional apparatus are separate from the immutable text@1
// edition. Its public build uses only the explicit, pinned edition inputs.
import {canonical} from './bundle.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const EDITION_ID='war-and-peace-maude';
export let structure={groups:[],chapters:[]},apparatus={pictures:[],portrait:null};
export function mergeEditions(local,supplied){
  const conflicts=[];
  const books=supplied.map(b=>{const stored=local.find(l=>l.id===b.id);if(stored&&canonical(stored)!==canonical(b))conflicts.push(b.id);return stored||b;});
  return {books:[...books,...local.filter(l=>!supplied.some(b=>b.id===l.id))],conflicts};
}
export function clearApparatus(){structure={groups:[],chapters:[]};apparatus={pictures:[],portrait:null};}
export async function loadApparatus(){
  const results=await Promise.all(['/structure.json','/companion.json'].map(async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error('Edition apparatus unavailable');return r.json();}));
  [structure,apparatus]=results;
}
export const groupFor=id=>structure.groups.find(g=>g.sections.includes(id));
export const chapterHeading=section=>structure.chapters.find(c=>c.id===section.id)?.heading||section.title;
export const chapterLabel=(book,id)=>book.sections.find(s=>s.id===id)?.title??book.title;
const readPath=id=>`#read/${EDITION_ID}/${id}`;
const image=(p,classes='')=>`<img class="${classes}" src="/${esc(p.file)}" width="${p.width}" height="${p.height}" alt="${esc(p.alt)}" loading="lazy" decoding="async">`;
export function cover(book,state){
  const p=apparatus.portrait,pos=state.positions[book.id],started=pos?.revision===book.source.sha256;
  return `<section class="book-entrance"><div class="entrance-type"><p class="eyebrow">Leo Tolstoy</p><h1>War<br><span class="ampersand">and</span> Peace</h1><p class="translation">Translated by<br>Louise and Aylmer Maude</p><button class="primary begin-reading" data-action="resume" data-book="${book.id}">${started?'Continue reading':'Begin reading'} <svg class="ui-icon" viewBox="0 0 16 16" aria-hidden="true"><use href="#ui-arrow"/></svg></button>${started?`<p class="resume-location">${esc(chapterLabel(book,pos.sectionId))}</p>`:'<p class="resume-location">Fifteen books & two epilogues</p>'}</div>${p?`<figure class="entrance-portrait"><button data-action="picture" data-picture="portrait" aria-label="Look closely at Repin’s portrait of Tolstoy">${image(p)}</button><figcaption>Ilya Repin · 1893</figcaption></figure>`:''}<div class="entrance-bottom"><button class="text" data-action="contents-home">Contents</button><button class="text" data-action="edition-about">Text & pictures</button><span class="small">Your place and passages stay in this browser.</span></div></section>`;
}
export function gallery(book,state,through){
  if(!structure.groups.length)return `<section class="page"><h1>Pictures</h1><p>The illustration companion is unavailable for this exact edition. Your restored text and notes are still available.</p><button class="text" data-action="resume" data-book="${book.id}">Return to reading</button></section>`;
  const pictures=apparatus.pictures.filter(p=>book.sections.findIndex(s=>s.id===p.through)<=through);
  const boundary=through===book.sections.length-1?'All pictures':through>=0?chapterLabel(book,book.sections[through]?.id):'No novel scenes shown yet';
  return `<section class="page pictures-page"><header class="page-head album-head"><div><p class="eyebrow">The 1893 album</p><h1>Pictures</h1></div><button class="text return-reading" data-action="resume" data-book="${book.id}">Return to reading</button></header><div class="picture-boundary"><p class="small">${esc(boundary)}</p><button data-action="boundaries" class="text">Choose chapters</button></div>${pictures.length?`<div class="plate-list">${pictures.map((p,i)=>`<figure><button data-action="picture" data-picture="${esc(p.id)}" aria-label="Look closely: ${esc(p.title)}">${image(p)}</button><figcaption><span class="eyebrow">${esc(chapterLabel(book,p.through))}</span><h2>${esc(p.title)}</h2><p>${esc(p.artist)} · 1893</p></figcaption></figure>`).join('')}</div>`:`<div class="unopened-album"><p>The pictures contain scenes from the story. Choose the chapters you have read to open the album.</p>${apparatus.portrait?`<button data-action="picture" data-picture="portrait" class="portrait-small" aria-label="Look closely at Repin’s portrait of Tolstoy">${image(apparatus.portrait)}</button>`:''}</div>`}<p class="small gallery-source">Printed reproductions of watercolours, published by Evgeny Evdokimov for <i>Sever</i>, 1893. <button class="text" data-action="edition-about">Sources & credits</button></p></section>`;
}
export function contents(book,current){
  if(!structure.groups.length)return `<ol class="contents-list">${book.sections.map(s=>`<li><a href="${readPath(s.id)}" data-section-start>${esc(s.title)}</a></li>`).join('')}</ol>`;
  return `<div class="book-contents">${structure.groups.map((g,i)=>`<details ${g.sections.includes(current)?'open':''}><summary><span>${esc(g.title)}</span><span class="small">${g.sections.length} chapters</span><svg class="ui-icon contents-toggle" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#ui-arrow"/></svg></summary><ol>${g.sections.map(id=>`<li><a href="${readPath(id)}" data-section-start ${current===id?'aria-current="location"':''}>${esc(chapterHeading(book.sections.find(s=>s.id===id)))}</a></li>`).join('')}</ol></details>`).join('')}</div>`;
}
export function pictureById(id){return id==='portrait'?apparatus.portrait:apparatus.pictures.find(p=>p.id===id);}
export function pictureHTML(p,book){
  return `<div class="picture-layout"><div class="picture-toolbar" role="group" aria-label="Image size"><button data-action="picture-fit" aria-pressed="true">Fit</button><button data-action="picture-zoom" aria-pressed="false">Enlarge</button><span class="small" hidden>Scroll to move around an enlarged picture.</span></div><div class="picture-viewport" tabindex="0" role="region" aria-label="${esc(p.title)} · image detail">${image(p)}</div><div class="picture-caption"><p class="eyebrow">${esc(p.artist)} · watercolour reproduced in 1893</p>${p.caption.map(t=>`<p class="companion-reading">${esc(t)}</p>`).join('')}${p.history?`<details class="historical-note"><summary>${esc(p.history.title)}</summary>${p.history.paragraphs.map(t=>`<p class="companion-reading">${esc(t)}</p>`).join('')}${p.history.sources.map(s=>`<p class="small"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a> <span>· online reference</span></p>`).join('')}</details>`:''}<p class="small">Plate ${p.plate}. Printed copy: State Public Historical Library, Moscow. Digital reproduction: Presidential Library.</p><a class="text-link small" href="https://www.prlib.ru/item/1988888" target="_blank" rel="noopener noreferrer">Album catalogue</a>${p.through?`<button class="text picture-source" data-action="picture-context" data-picture="${esc(p.id)}">Read the illustrated passage</button>`:''}</div></div>`;
}
export function aboutHTML(){
  return `<div class="edition-about">${(apparatus.about??[]).map(n=>`<section class="context-item"><h3>${esc(n.title)}</h3>${n.paragraphs.map(t=>`<p class="companion-reading">${esc(t)}</p>`).join('')}${(n.links??[]).map(s=>`<p><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a></p>`).join('')}</section>`).join('')}<details><summary>Full source notices</summary><div id="source-notices" class="source-notices">Opening the source notices…</div></details><details><summary>Typeface</summary><p class="small">Literata by TypeTogether, distributed under the SIL Open Font License 1.1.</p><a href="/Literata-OFL.txt" target="_blank">Complete font license</a></details></div>`;
}
