import {plateURL} from './media.mjs';
const picture=(b,id,esc)=>{const p=b.plates.find(p=>p.id===id);return `<img src="${plateURL(p)}" width="${p.width}" height="${p.height}" alt="${esc(p.alt)}" decoding="async" loading="lazy">`;};
const readPath=(b,s)=>`#read/${b.id}/${s}`;
export function validateExperience(value,books){
  const fail=()=>{throw new Error('The plate readings do not match this edition.');};
  const obj=v=>v&&typeof v==='object'&&!Array.isArray(v),text=(v,n=10000)=>typeof v==='string'&&v.length<=n;
  if(!obj(value))fail();const book=books.find(b=>b.id===value.bookId);if(!book?.plates)fail();
  for(const key of ['artist','kicker','editionLine','coverCaption'])if(!text(value[key]))fail();
  if(!/^[a-f0-9]{64}$/.test(value.bookSha256))fail();
  const plate=id=>book.plates.some(p=>p.id===id);
  const block=p=>obj(p)&&book.sections.find(s=>s.id===p.sectionId)?.blocks.find(b=>b.id===p.blockId);
  if(!plate(value.coverPlate)||!Array.isArray(value.studies)||value.studies.length>12)fail();
  for(const s of value.studies){
    if(!obj(s)||!['title','sourceLabel','credit'].every(k=>text(s[k]))||s.note!==undefined&&!text(s.note))fail();
    if(!Array.isArray(s.plates)||s.plates.length<1||s.plates.length>2||!s.plates.every(plate)||!Array.isArray(s.passages)||s.passages.length!==1||!s.passages.every(block))fail();
    if(s.legend!==undefined&&(!block(s.legend)||!s.plates.includes(s.legend.plateId)||block(s.legend).role!=='legend'))fail();
    if(s.attribution!==undefined&&!text(s.attribution,200))fail();
    if(s.excerpts!==undefined){
      if(!Array.isArray(s.excerpts)||s.excerpts.length>6)fail();
      for(const p of s.excerpts){const b=block(p);if(!b||!text(p.label,200)||!Number.isInteger(p.start)||!Number.isInteger(p.end)||p.start<0||p.end<=p.start||p.end>b.text.length)fail();}
    }
  }
  if(!Array.isArray(value.sourceView)||value.sourceView.length>10)fail();
  for(const c of value.sourceView){if(!obj(c)||!text(c.label,200)||!text(c.text)||!Array.isArray(c.links)||c.links.length>4)fail();for(const l of c.links)if(!obj(l)||!text(l.label,200)||!text(l.url,2000)||!/^https:\/\//.test(l.url))fail();}
  return structuredClone(value);
}
export function storedShelf(books,esc,arrow){return `<section class="page"><header class="page-head"><h1>Your books.</h1><p>Plates remain in the book. The separate plate readings are unavailable.</p></header>${books.map(b=>`<article class="book-row"><div><h2>${esc(b.title)}</h2><p>${esc(b.author)}</p></div><button class="text" data-action="resume" data-book="${b.id}">Read ${arrow()}</button></article>`).join('')}</section>`;}
export function landing(books,state,x,esc,arrow){
  const b=books.find(b=>b.id===x.bookId),pos=state.positions[b.id];
  return `<section class="mountain-entrance"><div class="entrance-title"><p class="eyebrow">${esc(x.kicker)}</p><h1>${esc(b.title)}</h1><p class="entrance-byline">Described by ${esc(b.author)}<br>Painted by ${esc(x.artist)}</p><button class="primary" data-action="resume" data-book="${b.id}">${pos?'Continue reading':'Open the book'} ${arrow('right')}</button>${pos?`<p class="small resume-title">${esc(b.sections.find(s=>s.id===pos.sectionId)?.title||'')}</p>`:''}<p class="edition-line">${esc(x.editionLine)}</p><button class="text entrance-source" data-action="sources">Source</button></div><figure class="entrance-art"><button data-action="plate" data-book="${b.id}" data-plate="${x.coverPlate}" aria-label="Enlarge the opening plate">${picture(b,x.coverPlate,esc)}</button><figcaption>${esc(x.coverCaption)}</figcaption></figure></section><section class="book-contents"><header><h2>Contents</h2></header><ol>${b.sections.filter(s=>s.id.startsWith('chapter-')).map((s,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span><a href="${readPath(b,s.id)}" data-section-start>${esc(s.title.split('\n').at(-1))}</a></li>`).join('')}</ol><details><summary>Front matter and catalogue</summary><ul>${b.sections.filter(s=>!s.id.startsWith('chapter-')).map(s=>`<li><a href="${readPath(b,s.id)}" data-section-start>${esc(s.title)}</a></li>`).join('')}</ul></details></section>${books.filter(z=>z.id!==b.id).map(z=>`<section class="additional-book"><h2>${esc(z.title)}</h2><button data-action="resume" data-book="${z.id}">Read ${arrow()}</button></section>`).join('')}`;
}
export function plateCabinet(book,x,chapter,state,esc,arrow){
  if(!book)return '<p class="loading">Opening the plates…</p>';
  const groups=book.sections.filter(s=>s.blocks.some(b=>b.plateId)),included=groups.filter(s=>chapter==='all'||s.id===chapter);
  return `<section class="plate-cabinet page"><header class="cabinet-head"><div><p class="eyebrow">${esc(x.artist)} · ${book.plates.length} colour plates</p><h1>Plates</h1></div><button class="text" data-action="resume" data-book="${book.id}">Return to reading ${arrow('right')}</button></header><div class="studies">${x.studies.map((s,i)=>`<button class="study-entry" data-action="study" data-study="${i}"><span class="study-image">${picture(book,s.plates[0],esc)}</span><span class="study-title">${esc(s.title)} ${arrow()}</span></button>`).join('')}</div><header class="plate-index-heading"><h2>All plates</h2><label for="plate-chapter">Chapter<select id="plate-chapter"><option value="all" ${chapter==='all'?'selected':''}>All sections</option>${groups.map(s=>`<option value="${s.id}" ${chapter===s.id?'selected':''}>${esc(s.title)}</option>`).join('')}</select></label></header>${included.map(s=>`<section class="plate-group"><h3>${esc(s.title)}</h3><div class="plate-grid">${s.blocks.filter(b=>b.plateId).map(b=>{const p=book.plates.find(p=>p.id===b.plateId);return `<button data-action="plate" data-book="${book.id}" data-plate="${p.id}">${picture(book,p.id,esc)}<span>${esc(b.text)}</span><small>${esc(p.sourcePage)}</small></button>`;}).join('')}</div></section>`).join('')}`;
}
export function lookingStudy(book,s,state,esc,arrow){
  const allowed=[...s.passages,...(s.excerpts||[])].every(p=>book.sections.findIndex(sec=>sec.id===p.sectionId)<=(state.boundaries[book.id]?.revision===book.source.sha256?state.boundaries[book.id].index:-1));
  const plates=`<div class="study-plates ${s.plates.length===1?'one-plate':''}">${s.plates.map(id=>{const p=book.plates.find(p=>p.id===id);return `<figure><button data-action="plate" data-book="${book.id}" data-plate="${id}" aria-label="Enlarge ${esc(p.alt)}">${picture(book,id,esc)}</button><figcaption>${esc(p.alt)}</figcaption>${s.legend?.plateId===id?'<div class="study-legend reading-surface" data-study-legend></div>':''}</figure>`;}).join('')}</div>`;
  const quotations=s.excerpts?(allowed?`<div class="study-quotations"><p class="source-attribution">${esc(s.attribution||book.author)}</p>${s.excerpts.map((p,i)=>`<section><h3>${esc(p.label)}</h3><blockquote class="reading-surface" data-study-excerpt="${i}"></blockquote></section>`).join('')}</div>`:'<div class="study-quotations"><button class="secondary" data-action="allow-study">Show excerpts from chapter II</button></div>'):'';
  const source=allowed?`<button class="text study-source-link" data-action="study-context" data-passage="0">${esc(s.sourceLabel)} ${arrow()}</button>`:s.excerpts?'':`<button class="text study-source-link" data-action="allow-study">${esc(s.sourceLabel)} ${arrow()}</button>`;
  return `${s.excerpts?`<div class="source-comparison">${plates}${quotations}</div>`:plates}${s.note?`<p class="study-observation companion-reading">${esc(s.note)}</p>`:''}${source}<p class="plate-credit">${esc(s.credit)}</p>`;
}
