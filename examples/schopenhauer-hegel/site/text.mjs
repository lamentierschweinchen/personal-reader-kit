import {selectionQuote,excerptSection} from './core.mjs';
export function renderPassage(container,passage,book,hit) {
  const section=excerptSection(passage,book);
  renderText(container,section);
  if(hit) {
    const block=section.blocks[0];
    renderText(container,section,[{id:'occurrence',segments:[{blockId:block.id,start:hit.matchStart,end:hit.matchEnd}]}]);
    container.querySelectorAll('mark').forEach(mark=>mark.removeAttribute('data-note'));
  }
}
export function renderText(container, section, notes = []) {
  container.replaceChildren();
  for (const block of section.blocks) {
    const node = document.createElement(block.kind === 'heading' ? 'h3' : 'div');
    node.className = `text-block ${block.kind}${block.layout === 'fixed' ? ' fixed-lines' : ''}${block.align?' source-center':''}${block.indent?` source-indent-${block.indent}`:''}${block.table?' source-table':''}${block.illustration?' source-illustration':''}`;node.dataset.block = block.id;
    if(block.layout==='fixed') {node.tabIndex=0;node.setAttribute('role','group');node.setAttribute('aria-label','Fixed source lines; scroll horizontally when needed');}
    const highlights = notes.flatMap(note => note.segments.filter(s => s.blockId === block.id).map(s => ({...s,id:note.id})));
    const links=block.links||[];
    const points = [...new Set([0,block.text.length,...block.marks.flatMap(m => [m.start,m.end]),...highlights.flatMap(h => [h.start,h.end]),...links.flatMap(l=>[l.start,l.end]),...(block.table?block.table.rows.flatMap(row=>row.flatMap(c=>[c.start,c.end])):[])])].sort((a,b) => a-b);
    function runs(parent,from=0,to=block.text.length){
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i], end = points[i+1];let leaf = document.createTextNode(block.text.slice(start,end));
      if(start<from||end>to)continue;
      for (const mark of block.marks.filter(m => m.start <= start && m.end >= end)) {const wrapper = document.createElement(['smallcaps','page'].includes(mark.kind)?'span':mark.kind);if(['smallcaps','page'].includes(mark.kind))wrapper.className='source-'+mark.kind;wrapper.append(leaf);leaf = wrapper;}
      const link=links.find(l=>l.start<=start&&l.end>=end);
      if(link){const a=document.createElement('a');a.className='source-link';if(link.kind==='external'){a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';}else{a.href='#source-note';a.dataset.action='source-link';a.dataset.section=link.sectionId;a.dataset.sourceBlock=link.blockId;if(link.kind==='note')a.setAttribute('aria-label',`Source note ${block.text.slice(link.start,link.end)}`);}a.append(leaf);leaf=a;}
      const active = highlights.filter(h => h.start <= start && h.end >= end);
      if (active.length) {const mark = document.createElement('mark');mark.dataset.note = active[0].id;mark.append(leaf);leaf = mark;}
      parent.append(leaf);
    }
    }
    if(block.illustration){const img=document.createElement('img');img.src=block.illustration.data;img.alt=block.illustration.alt;img.decoding='sync';node.append(img);}
    else if(block.table){
      const table=document.createElement('table');table.setAttribute('aria-label','Source table');const body=document.createElement('tbody');let cursor=0;
      if(block.table.widths){const group=document.createElement('colgroup');const sum=block.table.widths.reduce((a,b)=>a+b,0);for(const w of block.table.widths){const col=document.createElement('col');col.style.width=`${100*w/sum}%`;group.append(col);}table.append(group);table.classList.add('source-diagram-table');}
      for(const row of block.table.rows){const tr=document.createElement('tr');for(const c of row){if(c.start>cursor)tr.append(document.createTextNode(block.text.slice(cursor,c.start)));const td=document.createElement('td');td.colSpan=c.colspan;td.className=`cell-indent-${c.indent}`;runs(td,c.start,c.end);tr.append(td);cursor=c.end;}body.append(tr);}
      if(cursor<block.text.length)body.append(document.createTextNode(block.text.slice(cursor)));table.append(body);node.append(table);
    }else runs(node);
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
