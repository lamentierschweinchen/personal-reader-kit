import {canonical} from './bundle.mjs';
import {sha256} from './core.mjs';
export const ANTIGONE_ID='antigone-jebb-1917';
const SOURCE='d6dbcc2c4efb58d2386be871b62745f7b9f0ce1f7ccd79d0eca72d6aa20f25fe';
const SNAPSHOT='1d9fe9ad69d2b276d7895671ae5935dfd34bb0fe2b528d768fba812e6a6aca73';
const reviewed=new WeakMap();
export async function prepareAntigoneRights(books){for(const book of books){try{if(book.id===ANTIGONE_ID&&book.source.sha256===SOURCE&&await sha256(new TextEncoder().encode(canonical(book)))===SNAPSHOT)reviewed.set(book,canonical(book));}catch{/* Reading and exact recovery remain available; sharing fails closed. */}}}
export function hasAntigoneStudy(book){return !!book&&reviewed.has(book)&&reviewed.get(book)===canonical(book);}
export function antigoneAttribution(book){
 if(book.id!==ANTIGONE_ID||book.source.sha256!==SOURCE)return [];
 if(reviewed.get(book)!==canonical(book))throw Error('This edition’s source credits could not be verified. Export its exact edition and source notes instead.');
 return ['Transcription/encoding adapted from Wikisource contributors · CC BY-SA 4.0','https://creativecommons.org/licenses/by-sa/4.0/','Source, contributor histories and changes: https://en.wikisource.org/wiki/Tragedies_of_Sophocles_(Jebb_1917)/Antigone'];
}
const observers=new WeakMap();
export function clearAntigoneLayout(container){observers.get(container)?.disconnect();observers.delete(container);}
let referenceScope=0;
export function antigoneEntrances(book){
 if(book?.profile!=='antigone/jebb@1')return [];
 return book.sections.find(s=>s.id==='play')?.blocks.filter(b=>b.role==='entry')||[];
}
export function decorateAntigone(container,book,section){
 observers.get(container)?.disconnect();if(book.profile!=='antigone/jebb@1')return;
 for(const b of section.blocks){const n=[...container.querySelectorAll('[data-block]')].find(n=>n.dataset.block===b.id);n.dataset.sourceRole=b.role;n.classList.toggle('source-gap',b.gapBefore);}
 const group=book.apparatus.castGroup;
 if(section.id===group.sectionId){const nodes=group.nameIds.map(id=>[...container.querySelectorAll('[data-block]')].find(n=>n.dataset.block===id)),role=[...container.querySelectorAll('[data-block]')].find(n=>n.dataset.block===group.roleId);for(const n of [...nodes,role])if(n.nextSibling?.nodeType===Node.TEXT_NODE&&/^\s*$/.test(n.nextSibling.textContent))n.nextSibling.remove();const wrap=document.createElement('div');wrap.className='source-cast-group';nodes[0].before(wrap);const names=document.createElement('div');names.append(...nodes);const brace=document.createElement('span');brace.textContent=group.sign;brace.setAttribute('aria-hidden','true');wrap.append(names,brace,role);}
 const refs=book.apparatus.references.filter(r=>r.sectionId===section.id);if(!refs.length)return;
 const rail=document.createElement('div');rail.className='reference-rail';rail.setAttribute('aria-hidden','true');container.append(rail);
 const scope=container.id||(container.dataset.referenceScope??=String(++referenceScope));
 const spans=refs.filter(ref=>section.blocks.some(b=>b.id===ref.blockId)).map(ref=>{const span=document.createElement('span');span.className='greek-reference';span.textContent=ref.value;span.id=scope+'-reference-'+ref.blockId+'-'+ref.value;rail.append(span);const block=container.querySelector(`[data-block="${ref.blockId}"]`);block.setAttribute('aria-describedby',[block.getAttribute('aria-describedby'),span.id].filter(Boolean).join(' '));return{ref,span,block};});
 function position(){const origin=container.getBoundingClientRect();for(const {ref,span,block}of spans){const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let node,left=Math.min(ref.offset,block.textContent.length-1),rect;while((node=walker.nextNode())){if(left<node.length){const range=document.createRange();range.setStart(node,left);range.setEnd(node,left+1);rect=range.getBoundingClientRect();break;}left-=node.length;}if(rect)span.style.top=(rect.top-origin.top)+'px';}}
 position();const observer=new ResizeObserver(position);observer.observe(container);observers.set(container,observer);
}
