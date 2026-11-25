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
export function renderText(container, section, notes = [], {sourceReferences = false} = {}) {
  container.replaceChildren();
  const sourceNotes = new Set(sourceReferences
    ? section.blocks.filter(block => block.kind === 'note').map(block => block.id)
    : []);
  for (const block of section.blocks) {
    const node = document.createElement(block.kind === 'heading' ? 'h3' : 'div');
    if(block.kind==='note'&&/-fn[0-9]+$/.test(block.id)){node.dataset.sourceNote=block.id.split('-fn')[1];node.setAttribute('role','note');node.setAttribute('aria-label',`Source note ${node.dataset.sourceNote}`);}
    node.className = `text-block ${block.kind}${block.layout === 'fixed' ? ' fixed-lines' : ''}`;node.dataset.block = block.id;
    if(block.layout==='fixed') {node.tabIndex=0;node.setAttribute('role','group');node.setAttribute('aria-label','Fixed source lines; scroll horizontally when needed');}
    const highlights = notes.flatMap(note => note.segments.filter(s => s.blockId === block.id).map(s => ({...s,id:note.id})));
    // A marker remains the same source text if a saved highlight splits it.
    const references = new Map();
    for (const mark of block.marks) {
      if (mark.kind !== 'sup') continue;
      const number = /^\[(\d+)\]$/.exec(block.text.slice(mark.start, mark.end))?.[1];
      if (!sourceNotes.has(section.id + '-fn' + number)) continue;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'source-ref';
      button.dataset.action = 'source-notes';
      button.dataset.number = number;
      button.setAttribute('aria-label', 'Read source note ' + number);
      const superscript = document.createElement('sup');
      superscript.append(button);
      references.set(mark, {button, superscript});
    }
    const points = [...new Set([0,block.text.length,...block.marks.flatMap(m => [m.start,m.end]),...highlights.flatMap(h => [h.start,h.end])])].sort((a,b) => a-b);
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i], end = points[i+1];let leaf = document.createTextNode(block.text.slice(start,end));
      const marks = block.marks.filter(mark => mark.start <= start && mark.end >= end);
      for (const mark of marks.filter(mark => !references.has(mark))) {const wrapper = document.createElement(mark.kind==='caps'?'span':mark.kind);if(mark.kind==='caps')wrapper.className='source-smallcaps';wrapper.append(leaf);leaf = wrapper;}
      const active = highlights.filter(h => h.start <= start && h.end >= end);
      if (active.length) {const mark = document.createElement('mark');mark.dataset.note = active[0].id;mark.append(leaf);leaf = mark;}
      const reference = references.get(marks.find(mark => references.has(mark)));
      if (reference) {
        if (!reference.superscript.parentNode) node.append(reference.superscript);
        reference.button.append(leaf);
      } else {
        node.append(leaf);
      }
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
