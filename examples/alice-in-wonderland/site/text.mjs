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
export const imageSource = asset => `data:${asset.mime};base64,${asset.data}`;
export function renderText(container, section, notes = [], book = null) {
  container.replaceChildren();
  for (const block of section.blocks) {
    const node = document.createElement(block.kind === 'heading' ? 'h3' : 'div');
    node.className = `text-block ${block.kind}${block.layout === 'fixed' ? ' fixed-lines' : ''}`;node.dataset.block = block.id;
    if(block.lines)node.classList.add('source-lines');
    if(block.lines?.some(l=>l.scale!==1))node.classList.add('tail-poem');
    if(block.layout==='fixed') {node.tabIndex=0;node.setAttribute('role','group');node.setAttribute('aria-label','Fixed source lines; scroll horizontally when needed');}
    const assetFor=id=>book?.assets?.find(a=>a.id===id);
    const illustration=(asset,decorative=false)=>{
      if(!asset)throw new Error('The source illustration is missing from this exact edition.');
      const img=document.createElement('img');img.src=imageSource(asset);img.width=asset.width;img.height=asset.height;img.alt=decorative?'':asset.alt;img.decoding='async';
      if(decorative){img.setAttribute('aria-hidden','true');return img;}
      const button=document.createElement('button');button.type='button';button.className='source-illustration';button.dataset.action='enlarge-image';button.dataset.asset=asset.id;button.dataset.book=book.id;button.setAttribute('aria-label',`Enlarge illustration: ${asset.alt}`);button.append(img);return button;
    };
    if(block.figure)node.append(illustration(assetFor(block.figure.asset)));
    if(block.kind==='rule')node.setAttribute('role','separator');
    const highlights = notes.flatMap(note => note.segments.filter(s => s.blockId === block.id).map(s => ({...s,id:note.id})));
    const points = [...new Set([0,block.text.length,...block.marks.flatMap(m => [m.start,m.end]),...highlights.flatMap(h => [h.start,h.end]),...(block.sourceNotes||[]).flatMap(n=>[n.start,n.end]),...(block.links||[]).flatMap(n=>[n.start,n.end]),...(block.pages||[]).map(p=>p.offset),...(block.initial?[block.initial.characters.length]:[])])].sort((a,b) => a-b);
    const pageMarkers=(parent,offset)=>{for(const p of (block.pages||[]).filter(p=>p.offset===offset)){const span=document.createElement('span');span.className='source-page';span.dataset.page=p.label;span.setAttribute('aria-label',`Source page ${p.label}`);parent.append(span);}};
    const part=(parent,from,to)=>{
      const cuts=[...new Set([from,to,...points.filter(p=>p>from&&p<to)])].sort((a,b)=>a-b);
      for(let i=0;i<cuts.length-1;i++){
        const start=cuts[i],end=cuts[i+1];pageMarkers(parent,start);let leaf=document.createTextNode(block.text.slice(start,end));
        if(block.initial&&start<block.initial.characters.length){const wrapper=document.createElement('span');wrapper.className='initial-letter';const chars=document.createElement('span');chars.className='visually-hidden';chars.append(leaf);wrapper.append(illustration(assetFor(block.initial.asset),true),chars);leaf=wrapper;}
        for(const mark of block.marks.filter(m=>m.start<=start&&m.end>=end)){const wrapper=document.createElement(mark.kind==='smallcaps'?'span':mark.kind);if(mark.kind==='smallcaps')wrapper.className='source-smallcaps';wrapper.append(leaf);leaf=wrapper;}
        for(const n of (block.sourceNotes||[]).filter(n=>n.start<=start&&n.end>=end)){const wrapper=document.createElement('button');wrapper.type='button';wrapper.className='source-note';wrapper.dataset.action='source-note';wrapper.dataset.sourceNote=n.text;wrapper.title=n.text;wrapper.append(leaf);leaf=wrapper;}
        for(const n of (block.links||[]).filter(n=>n.start<=start&&n.end>=end)){const a=document.createElement('a');a.href=n.url;if(n.url.startsWith('https:')){a.target='_blank';a.rel='noopener noreferrer';}a.append(leaf);leaf=a;}
        const active=highlights.filter(h=>h.start<=start&&h.end>=end);
        if(active.length){const mark=document.createElement('mark');mark.dataset.note=active[0].id;mark.append(leaf);leaf=mark;}
        parent.append(leaf);
      }
    };
    if(block.lines){
      let offset=0;
      block.text.split('\n').forEach((text,i,all)=>{const line=document.createElement('span');line.className='source-line';line.style.setProperty('--indent',block.lines[i].indent+'em');line.style.setProperty('--scale',block.lines[i].scale);const words=document.createElement('span');words.className='line-words';part(words,offset,offset+text.length);line.append(words);node.append(line);offset+=text.length;if(i<all.length-1){node.append(document.createTextNode('\n'));offset++;}});
    }else part(node,0,block.text.length);
    pageMarkers(node,block.text.length);
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
