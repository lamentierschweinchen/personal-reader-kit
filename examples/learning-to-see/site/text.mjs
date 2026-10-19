import {selectionQuote,excerptSection} from './core.mjs';
import {assetURL} from './media.mjs';
export function renderPassage(container,passage,book,hit) {
  container.toggleAttribute('data-omitted-start',!!hit?.omittedStart);container.toggleAttribute('data-omitted-end',!!hit?.omittedEnd);
  const omitted=[hit?.omittedStart&&'Earlier text omitted.',hit?.omittedEnd&&'Later text omitted.'].filter(Boolean).join(' ');
  if(omitted)container.setAttribute('aria-description',omitted);else container.removeAttribute('aria-description');
  const section=excerptSection(passage,book);renderText(container,section,[],book);
  if(hit){const block=section.blocks[0];renderText(container,section,[{id:'occurrence',segments:[{blockId:block.id,start:hit.matchStart,end:hit.matchEnd}]}],book);container.querySelectorAll('mark').forEach(mark=>mark.removeAttribute('data-note'));}
}
export function renderText(container,section,notes=[],book){
 container.replaceChildren();let previousKind=null;
 for(const block of section.blocks){
  if(block.asset){const a=book?.assets?.find(a=>a.id===block.asset);if(a){const figure=document.createElement('figure');figure.className='source-figure';figure.dataset.figure=block.id;
    const button=document.createElement('button');button.className='plate-button';button.type='button';button.dataset.action='plate';button.dataset.book=book.id;button.dataset.asset=a.id;button.setAttribute('aria-label',`Enlarge illustration: ${a.alt}`);
    const img=document.createElement('img');img.src=assetURL(a);img.alt=a.alt;img.width=a.width;img.height=a.height;img.loading='lazy';img.style.maxWidth=`min(100%,${a.width}px)`;button.append(img);figure.append(button);container.append(figure);
   }}
  const node=document.createElement(block.kind==='heading'?'h3':'div');node.className=`text-block ${block.kind}${block.layout==='fixed'?' fixed-lines':''}${block.tone?' source-'+block.tone:''}`;node.dataset.block=block.id;if(block.indent){node.classList.add('source-indent');node.style.setProperty('--source-indent',block.indent*1.25+'em');}
  if(block.layout==='fixed'){node.tabIndex=0;node.setAttribute('role','group');node.setAttribute('aria-label','Fixed source lines; scroll horizontally when needed');}
  const highlights=notes.flatMap(note=>note.segments.filter(s=>s.blockId===block.id).map(s=>({...s,id:note.id})));
  const links=block.links||[];
  const append=(parent,from,to)=>{
   const points=[...new Set([from,to,...block.marks.flatMap(m=>[m.start,m.end]),...highlights.flatMap(h=>[h.start,h.end]),...links.flatMap(l=>[l.start,l.end])])].filter(p=>p>=from&&p<=to).sort((a,b)=>a-b);
   for(let i=0;i<points.length-1;i++){const start=points[i],end=points[i+1];let leaf=document.createTextNode(block.text.slice(start,end));
    for(const m of block.marks.filter(m=>m.start<=start&&m.end>=end)){const wrapper=document.createElement(m.kind==='smallcaps'?'span':m.kind);if(m.kind==='smallcaps')wrapper.className='smallcaps';wrapper.append(leaf);leaf=wrapper;}
    const link=links.find(l=>l.start<=start&&l.end>=end);if(link){const a=document.createElement('a');a.href='#';a.className='source-link';a.dataset.sourceTarget=link.target;a.dataset.sourceBook=book?.id||container.dataset.book||'';a.append(leaf);leaf=a;}
    const active=highlights.filter(h=>h.start<=start&&h.end>=end);if(active.length){const mark=document.createElement('mark');mark.dataset.note=active[0].id;mark.append(leaf);leaf=mark;}parent.append(leaf);
   }
  };
  if(block.cells){const cols=Math.max(...block.cells.map(row=>row.reduce((n,c)=>n+c.colspan,0))),lengths=Array(cols).fill(0);for(const cells of block.cells){let col=0;for(const c of cells){if(c.colspan===1)lengths[col]=Math.max(lengths[col],block.text.slice(c.start,c.end).trim().length);col+=c.colspan;}}const columns=lengths.map(n=>n<14?`${Math.max(4,n+2)}ch`:'minmax(12rem,1fr)').join(' ');node.classList.add('source-table');node.tabIndex=0;node.setAttribute('role','table');node.setAttribute('aria-label','Source table; scroll horizontally if needed');let at=0;
   for(const cells of block.cells){const row=document.createElement('div');row.className='source-row';row.setAttribute('role','row');row.style.gridTemplateColumns=columns;
    for(const c of cells){if(c.start>at)row.append(document.createTextNode(block.text.slice(at,c.start)));const cell=document.createElement('span');cell.setAttribute('role','cell');cell.style.gridColumn=`span ${c.colspan}`;append(cell,c.start,c.end);row.append(cell);at=c.end;}
    const next=block.text.indexOf('\n',at);if(next>=0){row.append(document.createTextNode(block.text.slice(at,next+1)));at=next+1;}node.append(row);
   }if(at<block.text.length)node.append(document.createTextNode(block.text.slice(at)));
  }else if(block.kind==='verse'){
    const toggle=document.createElement('button');toggle.className='verse-toggle';toggle.type='button';toggle.dataset.action='verse-toggle';toggle.dataset.verseBlock=block.id;toggle.setAttribute('aria-pressed','false');toggle.textContent='Wrap verse';if(previousKind!=='verse')container.append(toggle);
    let at=0;for(const [line,text] of block.text.split('\n').entries()){const span=document.createElement('span');span.className='source-line';const inset=block.lineInsets?.find(i=>i.line===line)?.em||0;span.style.setProperty('--source-inset',inset+'em');append(span,at,at+text.length);node.append(span);at+=text.length;if(at<block.text.length){node.append(document.createTextNode('\n'));at++;}}
  }else append(node,0,block.text.length);
  container.append(node,document.createTextNode(block.after));previousKind=block.kind;
 }
}
function offset(root,node,end){const r=document.createRange();r.selectNodeContents(root);r.setEnd(node,end);return r.toString().length;}
export function readSelection(container,book,section){
 const sel=getSelection();if(!sel||!sel.rangeCount||sel.isCollapsed)return null;const range=sel.getRangeAt(0);if(!container.contains(range.startContainer)||!container.contains(range.endContainer))return null;const segments=[];
 for(const node of container.querySelectorAll('[data-block]')){if(!range.intersectsNode(node))continue;const text=node.textContent,start=node.contains(range.startContainer)?offset(node,range.startContainer,range.startOffset):0,end=node.contains(range.endContainer)?offset(node,range.endContainer,range.endOffset):text.length;
 if(end>start)segments.push({blockId:node.dataset.block,start,end,quote:text.slice(start,end),prefix:text.slice(Math.max(0,start-40),start),suffix:text.slice(end,end+40)});}
 if(!segments.length||segments.length>500)return null;return {bookId:book.id,revision:book.source.sha256,sectionId:section.id,segments,quote:selectionQuote(section,segments)};
}
