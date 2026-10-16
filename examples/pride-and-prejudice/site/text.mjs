import {selectionQuote,excerptSection} from './core.mjs';
export function renderPassage(container,passage,book,hit) {
  container.toggleAttribute('data-omitted-start',!!hit?.omittedStart);
  container.toggleAttribute('data-omitted-end',!!hit?.omittedEnd);
  const omitted=[hit?.omittedStart&&'Earlier text omitted.',hit?.omittedEnd&&'Later text omitted.'].filter(Boolean).join(' ');
  if(omitted)container.setAttribute('aria-description',omitted);else container.removeAttribute('aria-description');
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
  let table,tableGroup,row,rowNumber;
  for (const block of section.blocks) {
    const node = document.createElement(block.kind === 'heading' ? 'h3' : 'div');
    node.className = `text-block ${block.kind}${block.layout === 'fixed' ? ' fixed-lines' : ''}${block.styles?.map(s=>' source-'+s).join('')||''}`;node.dataset.block = block.id;
    if(block.layout==='fixed') {node.tabIndex=0;node.setAttribute('role','group');node.setAttribute('aria-label','Fixed source lines; scroll horizontally when needed');}
    const highlights = notes.flatMap(note => note.segments.filter(s => s.blockId === block.id).map(s => ({...s,id:note.id})));
    const figures=block.figures||[],links=block.links||[];let initialCharacter;
    const picture=f=>{const img=document.createElement('img');img.src=f.src;img.alt=f.alt;img.width=f.width;img.height=f.height;img.decoding='async';return img;};
    const appendFigures=at=>{for(const f of figures.filter(f=>f.at===at)){const figure=document.createElement('span');figure.className='source-figure';const a=document.createElement('a');a.href=f.src;a.target='_blank';a.rel='noopener';a.setAttribute('aria-label',f.alt||'Open original illustration');const img=picture(f);a.append(img);figure.append(a);node.append(figure);}};
    const points = [...new Set([0,block.text.length,...block.marks.flatMap(m => [m.start,m.end]),...highlights.flatMap(h => [h.start,h.end]),...figures.map(f=>f.at),...links.flatMap(l=>[l.start,l.end]),...(block.initial?[block.initial.start,block.initial.end]:[])])].sort((a,b) => a-b);
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i], end = points[i+1];let leaf = document.createTextNode(block.text.slice(start,end));
      appendFigures(start);
      for (const mark of block.marks.filter(m => m.start <= start && m.end >= end)) {const custom=['smallcaps','page','spaced'].includes(mark.kind),wrapper = document.createElement(custom?'span':mark.kind);if(custom)wrapper.className='source-'+mark.kind;wrapper.append(leaf);leaf = wrapper;}
      const link=links.find(l=>l.start<=start&&l.end>=end);
      if(link){const a=document.createElement('a');if(link.url){a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';}else{a.href='#';a.dataset.action='source-context';a.dataset.section=link.section;a.dataset.block=link.block;a.dataset.offset=link.offset;}a.append(leaf);leaf=a;}
      const active = highlights.filter(h => h.start <= start && h.end >= end);
      if (active.length) {const mark = document.createElement('mark');mark.dataset.note = active[0].id;mark.append(leaf);leaf = mark;}
      if(block.initial&&start>=block.initial.start&&end<=block.initial.end){
        if(start===block.initial.start){const initial=document.createElement('span');initial.className='source-initial';initial.dataset.prefix=block.text.slice(block.initial.start,block.initial.end).match(/^[“‘]/)?.[0]||'';const img=picture({...block.initial,alt:''});img.setAttribute('aria-hidden','true');initialCharacter=document.createElement('span');initialCharacter.className='initial-letter';initial.append(img,initialCharacter);node.append(initial);}
        initialCharacter.append(leaf);
      }else node.append(leaf);
    }
    appendFigures(block.text.length);
    if(block.table){
      if(tableGroup!==block.table.group){table=document.createElement('table');table.className='source-table '+block.table.group;table.setAttribute('aria-label',block.table.group==='title-page'?'Original title-page arrangement':'Original list of illustrations and printed page references');container.append(table);tableGroup=block.table.group;rowNumber=null;}
      if(rowNumber!==block.table.row){row=document.createElement('tr');table.append(row);rowNumber=block.table.row;}
      const cell=document.createElement('td');cell.colSpan=block.table.span;cell.append(node,document.createTextNode(block.after));row.append(cell);
    }else{tableGroup=null;container.append(node,document.createTextNode(block.after));}
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
