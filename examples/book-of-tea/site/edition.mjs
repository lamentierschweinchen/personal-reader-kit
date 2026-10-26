import {sha256} from './core.mjs';
import {canonical} from './bundle.mjs';

// Presentation applies only to this exact reviewed edition, never to an ID alone.
export const EDITION_HASH='c707ede461051e643962318bccd11aca2f9661ed2d2b7f0894a5116dbcf0bec8';
const reviewed=new WeakSet();
export const isTea=book=>!!book&&reviewed.has(book);
export async function verifyTea(book){
  if(book.id==='book-of-tea'&&await sha256(new TextEncoder().encode(canonical(book)))===EDITION_HASH)reviewed.add(book);
}
export const teaChapters=book=>book.sections.filter(s=>/^chapter-[1-7]$/.test(s.id));
export const teaStart=book=>isTea(book)?book.sections.find(s=>s.id==='chapter-1'):book.sections[0];
export function teaEntry(book,state,{esc,path,arrow}){
  const saved=state.positions[book.id],position=saved?.revision===book.source.sha256&&book.sections.find(s=>s.id===saved.sectionId);
  const contents=book.sections.find(s=>s.id==='contents');
  return `<section class="tea-entry"><div class="tea-title"><p class="tea-author">${esc(book.author)}</p><h1>${esc(book.title)}</h1><p class="tea-date">1906 · Original English</p><button class="primary" data-action="resume" data-book="${book.id}">${position?'Continue reading':'Begin reading'} ${arrow()}</button>${position?`<p class="small tea-saved">${esc(position.title)}</p>`:''}<button class="text" data-action="edition-about">About this edition</button></div><div class="tea-sequence"><div class="tea-contents-label"><h2>Contents</h2><span>1906 page</span></div><ol>${teaChapters(book).map((s,i)=>`<li><a href="${path(book.id,s.id)}" data-section-start><span>${esc(s.title)}</span><span class="tea-page">${esc(contents.blocks.find(b=>b.id===`contents-page-${i+1}`).text)}</span></a></li>`).join('')}</ol><div class="tea-preliminaries"><button data-action="tea-front" data-section="imprint">Title page</button><button data-action="tea-front" data-section="dedication">Dedication</button><button data-action="tea-front" data-section="contents">Original summaries ${arrow()}</button></div></div></section>`;
}
export function decorateTea(container,book,section){
  if(!isTea(book))return;
  const chapter=section.id.match(/^chapter-(\d)$/)?.[1];
  container.classList.add('tea-text');
  container.dataset.form=chapter?'chapter':section.id;
  if(!chapter)return;
  for(const sup of container.querySelectorAll('sup')){
    const number=sup.textContent,id=`c${chapter}-note-${number}`;
    if(!section.blocks.some(b=>b.id===id))continue;
    const button=document.createElement('button');button.className='source-note';button.dataset.action='source-note';button.dataset.sourceNote=id;button.setAttribute('aria-label',`Source note ${number}`);
    button.append(...sup.childNodes);sup.append(button);
  }
}
