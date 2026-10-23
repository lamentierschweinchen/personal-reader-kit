import {assetURL} from './document-profile.mjs';
import {selectionQuote,excerptSection} from './core.mjs';
export function renderPassage(container,passage,book,hit) {
  container.toggleAttribute('data-omitted-start',!!hit?.omittedStart);
  container.toggleAttribute('data-omitted-end',!!hit?.omittedEnd);
  const omitted=[hit?.omittedStart&&'Earlier text omitted.',hit?.omittedEnd&&'Later text omitted.'].filter(Boolean).join(' ');
  if(omitted)container.setAttribute('aria-description',omitted);else container.removeAttribute('aria-description');
  const section=excerptSection(passage,book);
  renderText(container,section,[],book);
  if(hit) {
    const block=section.blocks[0];
    renderText(container,section,[{id:'occurrence',segments:[{blockId:block.id,start:hit.matchStart,end:hit.matchEnd}]}],book);
    container.querySelectorAll('mark').forEach(mark=>mark.removeAttribute('data-note'));
  }
}
export function renderText(container, section, notes = [], book) {
  container.replaceChildren();
  for (const block of section.blocks) {
    if(block.image){
      const asset=book?.assets?.find(a=>a.id===block.image.assetId);if(!asset)throw Error('This source figure needs its complete document edition.');
      const figure=document.createElement('figure'),img=document.createElement('img');figure.className='source-figure';figure.dataset.asset=asset.id;img.src=assetURL(asset);img.alt=asset.alt;img.width=asset.width;img.height=asset.height;img.loading='lazy';img.style.maxWidth='100%';img.style.height='auto';figure.append(img);container.append(figure);
    }
    const node = document.createElement(block.kind === 'heading' ? (container.id==='reading-text'&&block===section.blocks[0]?'h1':'h3') : 'div');
    node.className = `text-block ${block.kind}${block.layout === 'fixed' ? ' fixed-lines' : ''}`;node.dataset.block = block.id;
    if(block.sourceNote){node.dataset.sourceNote=block.sourceNote.id;node.setAttribute('aria-label','Original source note');}
    if(block.layout==='fixed') {node.tabIndex=0;node.setAttribute('role','group');node.setAttribute('aria-label','Fixed source lines; scroll horizontally when needed');}
    const highlights = notes.flatMap(note => note.segments.filter(s => s.blockId === block.id).map(s => ({...s,id:note.id})));
    const lineStarts=block.lineIndents?[0,...[...block.text.matchAll(/\n/g)].map(m=>m.index+1)]:[];
    const points = [...new Set([0,block.text.length,...block.marks.flatMap(m => [m.start,m.end]),...highlights.flatMap(h => [h.start,h.end]),...(block.references||[]).flatMap(r=>[r.start,r.end]),...(block.pages||[]).map(p=>p.offset),...lineStarts,...(block.languages||[]).flatMap(l=>[l.start,l.end])])].sort((a,b) => a-b);
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i], end = points[i+1];
      for(const p of block.pages||[])if(p.offset===start){const anchor=document.createElement('span');anchor.dataset.sourcePage=p.id;anchor.setAttribute('aria-label','Source page '+p.label);node.append(anchor);}
      let leaf = document.createTextNode(block.text.slice(start,end));
      for (const mark of block.marks.filter(m => m.start <= start && m.end >= end)) {const wrapper = document.createElement(mark.kind);wrapper.append(leaf);leaf = wrapper;}
      for(const language of block.languages||[])if(language.start<=start&&language.end>=end){const span=document.createElement('span');span.lang=language.lang;span.append(leaf);leaf=span;}
      const active = highlights.filter(h => h.start <= start && h.end >= end);
      if (active.length) {const mark = document.createElement('mark');mark.dataset.note = active[0].id;mark.append(leaf);leaf = mark;}
      const reference=(block.references||[]).find(r=>r.start<=start&&r.end>=end);
      if(reference){const button=document.createElement('button');button.type='button';button.className='source-note-call';button.dataset.action='source-note';button.dataset.sourceNote=reference.target;button.setAttribute('aria-label','Read source note');button.append(leaf);leaf=button;}
      const lineIndex=lineStarts.indexOf(start);if(lineIndex>=0&&block.lineIndents[lineIndex]){const inset=document.createElement('span');inset.className='source-line-inset';inset.style.marginLeft=block.lineIndents[lineIndex]+'em';inset.append(leaf);leaf=inset;}
      node.append(leaf);
    }
    for(const p of block.pages||[])if(p.offset===block.text.length){const anchor=document.createElement('span');anchor.dataset.sourcePage=p.id;anchor.setAttribute('aria-label','Source page '+p.label);node.append(anchor);}
    container.append(node,document.createTextNode(block.after));
  }
}
function offset(root,node,end) {const r = document.createRange();r.selectNodeContents(root);r.setEnd(node,end);return r.toString().length;}
export function readSelection(container, book, section) {
  const sel = getSelection();if (!sel || !sel.rangeCount || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;
  const segments = [];
  for (const node of container.querySelectorAll('[data-block]')) {
    if (!range.intersectsNode(node)) continue;
    const text = node.textContent, start = node.contains(range.startContainer) ? offset(node,range.startContainer,range.startOffset) : 0;
    const end = node.contains(range.endContainer) ? offset(node,range.endContainer,range.endOffset) : text.length;
    if (end > start) segments.push({blockId:node.dataset.block,start,end,quote:text.slice(start,end),prefix:text.slice(Math.max(0,start-40),start),suffix:text.slice(end,end+40)});
  }
  if (!segments.length || segments.length > 500) return null;
  return {bookId:book.id,revision:book.source.sha256,sectionId:section.id,segments,quote:selectionQuote(section,segments)};
}
