import {selectionQuote,excerptSection} from './core.mjs';
import {WALL_PROFILE,imageSource} from './wall-media.mjs';
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
export function renderText(container, section, notes = [], book = null) {
  container.replaceChildren();
  const media=book?.profile===WALL_PROFILE?book.media:null;
  const addFigures=after=>{for(const f of media?.figures.filter(x=>x.after===after)||[]){
    const asset=media.assets.find(x=>x.id===f.asset),figure=document.createElement('figure'),button=document.createElement('button'),img=document.createElement('img');
    figure.className='wall-figure';button.type='button';button.className='wall-picture';button.dataset.action='wall-image';button.dataset.asset=asset.id;button.setAttribute('aria-label','Enlarge illustration: '+asset.alt);
    img.src=imageSource(asset);img.alt=asset.alt;img.width=asset.width;img.height=asset.height;img.decoding='async';button.append(img);figure.append(button);
    if(f.caption){const caption=document.createElement('figcaption');caption.textContent=f.caption;figure.append(caption);}container.append(figure);
  }};
  addFigures('start');
  for (const block of section.blocks) {
    const node = document.createElement(block.kind === 'heading' ? 'h3' : 'div');
    node.className = `text-block ${block.kind}${block.layout === 'fixed' ? ' fixed-lines' : ''}`;node.dataset.block = block.id;
    if(media&&block.text==='* * * * * *')node.classList.add('source-rule');
    if(block.layout==='fixed') {node.tabIndex=0;node.setAttribute('role','group');node.setAttribute('aria-label','Fixed source lines; scroll horizontally when needed');}
    const highlights = notes.flatMap(note => note.segments.filter(s => s.blockId === block.id).map(s => ({...s,id:note.id})));
    const initial=media?.initial.block===block.id?media.initial:null;
    const points = [...new Set([0,block.text.length,...block.marks.flatMap(m => [m.start,m.end]),...highlights.flatMap(h => [h.start,h.end]),...(initial?[initial.characters.length]:[])])].sort((a,b) => a-b);
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i], end = points[i+1];let leaf = document.createTextNode(block.text.slice(start,end));
      if(initial&&start===0&&end===initial.characters.length){const a=media.assets.find(x=>x.id===initial.asset),wrapper=document.createElement('span'),image=document.createElement('img'),text=document.createElement('span');wrapper.className='wall-initial';image.src=imageSource(a);image.alt='';image.setAttribute('aria-hidden','true');text.className='visually-hidden';text.append(leaf);wrapper.append(image,text);leaf=wrapper;}
      for (const mark of block.marks.filter(m => m.start <= start && m.end >= end)) {const wrapper = document.createElement(mark.kind);wrapper.append(leaf);leaf = wrapper;}
      const active = highlights.filter(h => h.start <= start && h.end >= end);
      if (active.length) {const mark = document.createElement('mark');mark.dataset.note = active[0].id;mark.append(leaf);leaf = mark;}
      node.append(leaf);
    }
    container.append(node,document.createTextNode(block.after));
    addFigures(block.id);
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
