import {selectionQuote,excerptSection} from './core.mjs';
export function renderPassage(container,passage,book,hit) {
  container.toggleAttribute('data-omitted-start',!!hit?.omittedStart);
  container.toggleAttribute('data-omitted-end',!!hit?.omittedEnd);
  const omitted=[hit?.omittedStart&&'Earlier text omitted.',hit?.omittedEnd&&'Later text omitted.'].filter(Boolean).join(' ');
  if(omitted)container.setAttribute('aria-description',omitted);else container.removeAttribute('aria-description');
  const section=excerptSection(passage,book);
  renderText(container,section,[],book.id);
  if(hit) {
    const block=section.blocks[0];
    renderText(container,section,[{id:'occurrence',segments:[{blockId:block.id,start:hit.matchStart,end:hit.matchEnd}]}],book.id);
    container.querySelectorAll('mark').forEach(mark=>mark.removeAttribute('data-note'));
  }
}
export function renderText(container, section, notes = [], bookId=container.dataset.book) {
  container.replaceChildren();
  for (const block of section.blocks) {
    const node = document.createElement(block.kind === 'heading' ? 'h3' : 'div');
    node.className = `text-block ${block.kind}${block.layout === 'fixed' ? ' fixed-lines' : ''}`;node.dataset.block = block.id;if(block.role==='quotation')node.classList.add('source-quotation');if(block.align==='center')node.classList.add('source-centered');
    if(block.layout==='fixed') {node.tabIndex=0;node.setAttribute('role','group');node.setAttribute('aria-label','Fixed source lines; scroll horizontally when needed');}
    if(block.kind==='image'){const img=document.createElement('img');img.src=`data:${block.asset.type};base64,${block.asset.data}`;img.alt=block.asset.alt;img.className='source-image';node.append(img);container.append(node,document.createTextNode(block.after));continue;}
    const highlights = notes.flatMap(note => note.segments.filter(s => s.blockId === block.id).map(s => ({...s,id:note.id})));
    const points = [...new Set([0,block.text.length,...block.marks.flatMap(m => [m.start,m.end]),...highlights.flatMap(h => [h.start,h.end]),...(block.links||[]).flatMap(l=>[l.start,l.end])])].sort((a,b) => a-b);
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i], end = points[i+1];let leaf = document.createTextNode(block.text.slice(start,end));
      for (const mark of block.marks.filter(m => m.start <= start && m.end >= end)) {const wrapper = document.createElement(['smallcaps','page'].includes(mark.kind)?'span':mark.kind);if(['smallcaps','page'].includes(mark.kind))wrapper.className=mark.kind;wrapper.append(leaf);leaf = wrapper;}
      const active = highlights.filter(h => h.start <= start && h.end >= end);
      if (active.length) {const mark = document.createElement('mark');mark.dataset.note = active[0].id;mark.append(leaf);leaf = mark;}
      const link=(block.links||[]).find(l=>l.start<=start&&l.end>=end);if(link&&bookId){const a=document.createElement('a');a.href='#source';a.dataset.action='source-link';a.dataset.book=bookId;a.dataset.section=link.sectionId;a.dataset.sourceBlock=link.blockId;a.append(leaf);leaf=a;}
      node.append(leaf);
    }
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
