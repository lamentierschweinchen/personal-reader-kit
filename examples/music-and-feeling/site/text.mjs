import {loadSourceImage} from './edition.mjs';
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
export function renderText(container, section, notes = [], book = null) {
  container.replaceChildren();
  for (const block of section.blocks) {
    const page=book?.pages?.find(p=>p.blocks[0]===block.id);
    if(page){const button=document.createElement('button');button.className='source-page';button.dataset.action='facsimile';button.dataset.page=page.id;button.dataset.book=book.id;button.dataset.pageLabel=page.label;button.setAttribute('aria-label',`View scan: ${page.label}`);container.append(button);}
    if(block.media&&book){const a=book.assets.find(a=>a.id===block.media);const figure=document.createElement('figure'),img=document.createElement('img');figure.className='score';void loadSourceImage(img,a);img.alt=a.alt;img.width=a.width;img.height=a.height;img.loading='lazy';figure.append(img);const enlarge=document.createElement('button');enlarge.className='source-enlarge';enlarge.dataset.action='source-image';enlarge.dataset.book=book.id;enlarge.dataset.asset=a.id;enlarge.setAttribute('aria-label','Enlarge musical example');figure.append(enlarge);container.append(figure);}

    const node = document.createElement(block.kind === 'heading' ? container.id==='reading-text'&&section.blocks.indexOf(block)===0?'h1':'h3' : 'div');
    node.className = `text-block ${block.kind}${block.layout === 'fixed' ? ' fixed-lines' : ''}`;node.dataset.block = block.id;
    if(block.layout==='fixed') {node.tabIndex=0;node.setAttribute('role','group');node.setAttribute('aria-label','Fixed source lines; scroll horizontally when needed');}
    const highlights = notes.flatMap(note => note.segments.filter(s => s.blockId === block.id).map(s => ({...s,id:note.id})));
    const stackNodes=new Map();
    const points = [...new Set([0,block.text.length,...block.marks.flatMap(m => [m.start,m.end]),...highlights.flatMap(h => [h.start,h.end]),...(block.refs||[]).flatMap(r=>[r.start,r.end]),...(block.stacks||[]).flatMap(r=>[r.start,r.end])])].sort((a,b) => a-b);
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i], end = points[i+1];let leaf = document.createTextNode(block.text.slice(start,end));
      for (const mark of block.marks.filter(m => m.start <= start && m.end >= end)) {const wrapper = document.createElement(mark.kind);wrapper.append(leaf);leaf = wrapper;}
      const ref=block.refs?.find(r=>r.start<=start&&r.end>=end);
      if(ref){const a=document.createElement('a');a.href='#source-note';a.dataset.action='source-note';a.dataset.target=ref.target;a.dataset.book=book?.id||container.dataset.book;a.append(leaf);leaf=a;}
      const active = highlights.filter(h => h.start <= start && h.end >= end);
      if (active.length) {const mark = document.createElement('mark');mark.dataset.note = active[0].id;mark.append(leaf);leaf = mark;}
      const stack=block.stacks?.find(s=>s.start<=start&&s.end>=end);
      if(stack){let wrapper=stackNodes.get(stack);if(!wrapper){wrapper=document.createElement('span');wrapper.className='source-stack';wrapper.setAttribute('role','img');wrapper.setAttribute('aria-label',stack.label);stackNodes.set(stack,wrapper);node.append(wrapper);}wrapper.append(leaf);}else node.append(leaf);
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
