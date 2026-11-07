// Pure contracts shared by the reader, local importer and tests.
const object = x => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x, max = 200000) => typeof x === 'string' && x.length <= max;
const id = x => str(x, 100) && /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(x) && !['constructor', 'prototype', '__proto__'].includes(x);
const finite = (x, a, b) => Number.isFinite(x) && x >= a && x <= b;
function require(value, message) { if (!value) throw new Error(message); }
function unique(items, label) { require(new Set(items).size === items.length, `Duplicate ${label}.`); }
function fields(value, allowed, label) { require(Object.keys(value).every(k=>allowed.includes(k)), `Unsupported ${label} field. A reviewed adapter must preserve this content; it cannot be silently discarded.`); }
const blockKinds = new Set(['prose', 'verse', 'heading', 'note']);
export const LIMIT = 8 * 1024 * 1024;
export const READER_PROFILE = 'personal-reader/text@1';
export const DRAMA_PROFILE = 'little-clay-cart/drama@1';

// Synchronous SHA-256 keeps validation mandatory for every import, including
// IndexedDB and portable bundles. Image bytes never become executable markup.
function digestBytes(bytes) {
  const k=[],h=[];let n=2;
  while(k.length<64){let prime=true;for(let d=2;d*d<=n;d++)if(n%d===0){prime=false;break;}if(prime){if(h.length<8)h.push((Math.sqrt(n)%1*2**32)>>>0);k.push((Math.cbrt(n)%1*2**32)>>>0);}n++;}
  const len=bytes.length, padded=new Uint8Array(Math.ceil((len+9)/64)*64);padded.set(bytes);padded[len]=128;
  const view=new DataView(padded.buffer);view.setUint32(padded.length-8,Math.floor(len/0x20000000));view.setUint32(padded.length-4,(len*8)>>>0);
  const rotr=(v,r)=>(v>>>r)|(v<<(32-r)),w=new Uint32Array(64);
  for(let off=0;off<padded.length;off+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(off+i*4);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotr(a,7)^rotr(a,18)^(a>>>3))+w[i-7]+(rotr(b,17)^rotr(b,19)^(b>>>10)))>>>0;}
    let [a,b,c,d,e,f,g,j]=h;for(let i=0;i<64;i++){const t1=(j+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}for(const [i,v] of [a,b,c,d,e,f,g,j].entries())h[i]=(h[i]+v)>>>0;}
  return h.map(v=>v.toString(16).padStart(8,'0')).join('');
}
function assetBytes(asset) {
  require(object(asset), 'Invalid illustration.');fields(asset,['id','mediaType','sha256','width','height','alt','data'],'illustration');
  require(id(asset.id)&&asset.mediaType==='image/jpeg'&&/^[a-f0-9]{64}$/.test(asset.sha256)&&Number.isInteger(asset.width)&&asset.width>0&&asset.width<=4096&&Number.isInteger(asset.height)&&asset.height>0&&asset.height<=4096&&str(asset.alt,500), 'Invalid illustration metadata.');
  require(str(asset.data,2_800_000)&&asset.data.length>0&&asset.data.length%4===0&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(asset.data),'Invalid illustration encoding.');
  let binary;try{binary=atob(asset.data);}catch{throw new Error('Invalid illustration encoding.');}require(binary.length<=2_000_000&&btoa(binary)===asset.data,'Invalid illustration encoding.');
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));require(bytes.length>=4&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes.at(-2)===0xff&&bytes.at(-1)===0xd9,'Only complete JPEG illustrations are supported.');
  require(digestBytes(bytes)===asset.sha256,'Illustration checksum does not match.');
  // Verify the advertised dimensions against an actual JPEG frame header.
  let pos=2,dimensions=false;while(pos+3<bytes.length){if(bytes[pos++]!==0xff)break;let marker=bytes[pos++];while(marker===0xff&&pos<bytes.length)marker=bytes[pos++];if(marker===0xda||marker===0xd9)break;if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;if(pos+1>=bytes.length)break;const size=(bytes[pos]<<8)|bytes[pos+1];if(size<2||pos+size>bytes.length)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){if(size<7)break;dimensions=((bytes[pos+3]<<8)|bytes[pos+4])===asset.height&&((bytes[pos+5]<<8)|bytes[pos+6])===asset.width;break;}pos+=size;}
  require(dimensions,'Illustration dimensions do not match the JPEG.');return bytes.length;
}
export function validateBook(value) {
  require(object(value) && value.schema === 1 && id(value.id), 'Unsupported book format. Use a version 1 reader JSON file.');
  require(value.profile===undefined||str(value.profile,100), 'Invalid reader profile.');
  require(value.profile===undefined||value.profile===READER_PROFILE||value.profile===DRAMA_PROFILE, `This edition requires reader profile “${value.profile}”. Use its matching reader and recovery instructions; nothing was imported.`);
  const drama=value.profile===DRAMA_PROFILE;
  fields(value,['schema','profile','id','title','author','edition','language','source','sections','context',...(drama?['sourceNotes','assets']:[])],'book');
  require(str(value.title, 500) && value.title.length && str(value.author, 500) && str(value.edition, 1000), 'Book title, author and edition are required.');
  require(str(value.language, 35) && /^[a-zA-Z0-9-]+$/.test(value.language), 'Invalid language tag.');
  require(object(value.source) && /^[a-f0-9]{64}$/.test(value.source.sha256) && str(value.source.format, 100) && str(value.source.description, 2000), 'A source hash and description are required.');
  fields(value.source,['sha256','format','description'],'source');
  require(Array.isArray(value.sections) && value.sections.length > 0 && value.sections.length <= 2000, 'A book needs 1–2000 sections.');
  unique(value.sections.map(s => s.id), 'section IDs');
  let count = 0, total = 0;const anchors=new Set(),targets=[];let assetIds=new Set();
  if(drama){require(Array.isArray(value.assets)&&value.assets.length<=100,'Invalid illustrations.');unique(value.assets.map(a=>a.id),'illustration IDs');let bytes=0;for(const asset of value.assets)bytes+=assetBytes(asset);require(bytes<=6_000_000,'Illustrations exceed the supported size.');assetIds=new Set(value.assets.map(a=>a.id));require(Array.isArray(value.sourceNotes)&&value.sourceNotes.length<=5000,'Invalid source notes.');unique(value.sourceNotes.map(n=>n.id),'source note IDs');}
  function validateBlocks(blocks) {
    unique(blocks.map(b=>b.id),'block IDs');
    for (const block of blocks) {
      require(object(block) && id(block.id) && blockKinds.has(block.kind) && str(block.text) && str(block.after, 1000), 'Invalid text block.');
      require(!Object.hasOwn(block, 'html') && !Object.hasOwn(block, 'image'), 'HTML and images need a reviewed adapter; they cannot be silently discarded.');
      fields(block,['id','kind','text','after','marks','layout',...(drama?['role','references','anchors','images','cells']:[])],'block');
      require(block.layout === undefined || ['reflow', 'fixed'].includes(block.layout), 'Invalid layout.');
      if(drama){require(block.role===undefined||['title','speech','direction','cast','table-row','image'].includes(block.role),'Invalid dramatic role.');
        for(const key of ['references','anchors','images'])require(block[key]===undefined||(Array.isArray(block[key])&&block[key].length<=10000),`Invalid ${key}.`);
        for(const a of block.anchors||[]){fields(a,['id','offset'],'anchor');require(id(a.id)&&Number.isInteger(a.offset)&&a.offset>=0&&a.offset<=block.text.length&&!anchors.has(a.id),'Invalid or duplicate source anchor.');anchors.add(a.id);}
        if(block.role==='table-row'){require(Array.isArray(block.cells)&&block.cells.length>0&&block.cells.length<=100,'Table rows need source cells.');for(const [i,c] of block.cells.entries()){fields(c,['start','end','colspan'],'table cell');require(Number.isInteger(c.start)&&Number.isInteger(c.end)&&c.start>=0&&c.end>=c.start&&c.end<=block.text.length&&Number.isInteger(c.colspan)&&c.colspan>=1&&c.colspan<=20,'Invalid table cell.');require(i===0?c.start===0:c.start===block.cells[i-1].end+1&&block.text.slice(c.start-1,c.start)==='\t','Table cells must retain their tab separators.');}require(block.cells.at(-1).end===block.text.length,'Table cells must cover source text.');}else require(block.cells===undefined,'Table cells need a table row.');
        const spans=[];for(const ref of block.references||[]){fields(ref,['start','end','target'],'reference');require(Number.isInteger(ref.start)&&Number.isInteger(ref.end)&&ref.start>=0&&ref.end>ref.start&&ref.end<=block.text.length&&str(ref.target,110)&&/^(note|anchor):[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(ref.target)&&id(ref.target.split(':')[1]),'Invalid source reference.');targets.push(ref.target);spans.push([ref.start,ref.end]);}
        for(const img of block.images||[]){fields(img,['start','end','asset'],'image range');require(Number.isInteger(img.start)&&Number.isInteger(img.end)&&img.start>=0&&img.end>img.start&&img.end<=block.text.length&&assetIds.has(img.asset),'Invalid image range.');spans.push([img.start,img.end]);}
        spans.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);require(spans.every((v,i)=>i===0||v[0]>=spans[i-1][1]),'Source references and image ranges cannot overlap.');
      }
      require(Array.isArray(block.marks) && block.marks.length <= 10000, 'Invalid emphasis marks.');
      for (const mark of block.marks) {require(object(mark) && ['em', 'strong', 'sup', 'sub',...(drama?['smallcaps']:[])].includes(mark.kind) && Number.isInteger(mark.start) && Number.isInteger(mark.end) && mark.start >= 0 && mark.end > mark.start && mark.end <= block.text.length, 'Invalid emphasis range.');fields(mark,['kind','start','end'],'emphasis');}
      count++; total += block.text.length + block.after.length;
    }
  }
  for (const section of value.sections) {
    require(object(section) && id(section.id) && str(section.title, 1000) && Array.isArray(section.blocks) && section.blocks.length > 0, 'Invalid section.');
    fields(section,['id','title','blocks'],'section');
    validateBlocks(section.blocks);
  }
  if(drama){for(const note of value.sourceNotes){fields(note,['id','label','blocks'],'source note');require(id(note.id)&&str(note.label,300)&&Array.isArray(note.blocks)&&note.blocks.length>0,'Invalid source note.');validateBlocks(note.blocks);}const noteIds=new Set(value.sourceNotes.map(n=>n.id));for(const target of targets){const [type,key]=target.split(':');require(type==='note'?noteIds.has(key):anchors.has(key),'Source reference target is missing.');}}
  require(count <= 30000 && total <= LIMIT, 'This book exceeds the 8 MB text / 30,000 block limit. Split it into volumes.');
  require(Array.isArray(value.context) && value.context.length <= 100, 'Invalid background notes.');
  for (const item of value.context) {
    require(object(item) && str(item.label, 300) && str(item.text, 10000) && ['source', 'editorial', 'author'].includes(item.kind), 'Invalid background note.');
    fields(item,['label','text','kind','through','url'],'background');
    require(item.url === undefined || (str(item.url, 2000) && /^https:\/\//.test(item.url)), 'Context sources must use HTTPS.');
    require(item.through === null || value.sections.some(s => s.id === item.through), 'Background notes need a valid spoiler boundary or null for introductory context.');
  }
  // Rebuild the contract explicitly. Arbitrary input properties never become executable HTML.
  function copyBlock(b){return {id:b.id,kind:b.kind,text:b.text,after:b.after,marks:b.marks.map(m=>({kind:m.kind,start:m.start,end:m.end})),...(b.layout?{layout:b.layout}:{}),...(drama&&b.role?{role:b.role}:{}),...(drama&&b.references?{references:b.references.map(r=>({...r}))}:{}),...(drama&&b.anchors?{anchors:b.anchors.map(a=>({...a}))}:{}),...(drama&&b.images?{images:b.images.map(i=>({...i}))}:{}),...(drama&&b.cells?{cells:b.cells.map(c=>({...c}))}:{})};}
  return {
    schema: 1, ...(value.profile?{profile:value.profile}:{}), id: value.id, title: value.title, author: value.author, edition: value.edition, language: value.language,
    source: { sha256: value.source.sha256, format: value.source.format, description: value.source.description },
    sections: value.sections.map(s => ({ id: s.id, title: s.title, blocks: s.blocks.map(copyBlock) })),
    ...(drama?{assets:value.assets.map(a=>({...a})),sourceNotes:value.sourceNotes.map(n=>({id:n.id,label:n.label,blocks:n.blocks.map(copyBlock)}))}:{}),
    context: value.context.map(c => ({label:c.label,text:c.text,kind:c.kind,through:c.through,...(c.url ? {url:c.url} : {})}))
  };
}
export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function fromText(text, { title = 'Untitled', author = 'Unknown', kind = 'prose', bytes } = {}) {
  require(['prose', 'verse'].includes(kind), 'Choose prose or verse.');
  require(str(text, LIMIT) && text.length > 0 && !text.includes('\u0000'), 'Use a non-empty UTF-8 text file, up to 8 MB.');
  const hash = await sha256(bytes || new TextEncoder().encode(text));
  // Delimiters are retained verbatim; no trimming, Unicode normalization or dehyphenation.
  const parts = text.split(/((?:\r?\n)[ \t]*(?:\r?\n)+)/), blocks = [];
  for (let i = 0; i < parts.length; i += 2) if (parts[i] || parts[i + 1]) blocks.push({id:`b${blocks.length + 1}`,kind,text:parts[i],after:parts[i + 1] || '',marks:[]});
  return validateBook({ schema:1,id:`local-${hash.slice(0,24)}`,title,author,edition:'Your UTF-8 text file',language:'und',source:{sha256:hash,format:'text/plain',description:'Imported on this device. Characters and paragraph separators preserved; no external upload.'},sections:[{id:'text',title,blocks}],context:[{label:'About this edition',text:'This is a direct text import. Author and work background has not been researched. Your agent can add sourced background after inspecting the edition.',kind:'editorial',through:null}] });
}
export function bookText(book) { return book.sections.map(s => s.blocks.map(b => b.text + b.after).join('')).join(''); }
export function newState() {
  return {schema:1,revision:0,prefs:{theme:'paper',size:21,leading:1.7,measure:'book',focus:false},positions:{},boundaries:{},notes:[],connections:[],reflections:{},lastBook:null};
}
export function validateState(value) {
  require(object(value) && value.schema === 1 && Number.isSafeInteger(value.revision) && value.revision >= 0, 'This backup has an unsupported schema.');
  const p = value.prefs;
  require(object(p) && ['paper','dusk','ink'].includes(p.theme) && finite(p.size,17,36) && finite(p.leading,1.3,2.2) && ['book','wide'].includes(p.measure) && typeof p.focus === 'boolean', 'Invalid reading preferences.');
  require(object(value.positions) && object(value.boundaries) && object(value.reflections) && Array.isArray(value.notes) && value.notes.length <= 10000, 'Invalid reader records.');
  require(value.lastBook === null || id(value.lastBook), 'Invalid last book.');
  for (const [key, pos] of Object.entries(value.positions)) require(id(key) && object(pos) && id(pos.sectionId) && (pos.blockId === null || id(pos.blockId)) && finite(pos.ratio,0,1) && /^[a-f0-9]{64}$/.test(pos.revision), 'Invalid reading position.');
  for (const [key, bound] of Object.entries(value.boundaries)) require(id(key) && object(bound) && Number.isInteger(bound.index) && bound.index >= -1 && bound.index < 2000 && /^[a-f0-9]{64}$/.test(bound.revision), 'Invalid spoiler boundary.');
  for (const [key, text] of Object.entries(value.reflections)) require(id(key) && str(text,50000), 'Invalid reflection.');
  unique(value.notes.map(n => n.id), 'note IDs');
  for (const note of value.notes) {
    require(object(note) && id(note.id) && id(note.bookId) && id(note.sectionId) && /^[a-f0-9]{64}$/.test(note.revision) && str(note.note,50000) && str(note.quote,1000000) && finite(note.updated,0,8.64e15), 'Invalid passage record.');
    require(Array.isArray(note.segments) && note.segments.length > 0 && note.segments.length <= 500, 'Invalid passage segments.');
    for (const s of note.segments) require(object(s) && id(s.blockId) && Number.isInteger(s.start) && Number.isInteger(s.end) && s.start >= 0 && s.end > s.start && str(s.quote) && s.quote.length === s.end - s.start && str(s.prefix,40) && str(s.suffix,40), 'Invalid passage anchor.');
  }
  const connections=value.connections ?? [];
  require(Array.isArray(connections)&&connections.length<=5000,'Invalid connections.');
  unique(connections.map(c=>c.id),'connection IDs');
  for(const connection of connections) {
    require(object(connection)&&id(connection.id)&&str(connection.note,50000)&&finite(connection.updated,0,8.64e15)&&Array.isArray(connection.passages)&&connection.passages.length===2,'Invalid connection.');
    // Reuse the annotation contract: both sides keep exact evidence and edition identity.
    for(const passage of connection.passages) validateState({...newState(),notes:[{...passage,id:'connection-anchor',note:'',updated:0}]});
  }
  return {...structuredClone(value),connections:structuredClone(connections)};
}
export function selectionQuote(section, segments) {
  if (!segments.length) return '';
  const first=segments[0],last=segments.at(-1),start=section.blocks.findIndex(b=>b.id===first.blockId),end=section.blocks.findIndex(b=>b.id===last.blockId);
  require(start>=0 && end>=start, 'The selected source blocks are missing or out of order.');
  // Empty blocks still carry source separators. Reconstruct the contiguous source
  // span instead of joining only the non-empty highlighted segments.
  return section.blocks.slice(start,end+1).map((b,i,all)=>b.text.slice(i===0?first.start:0,i===all.length-1?last.end:undefined)+(i<all.length-1?b.after:'')).join('');
}
export function anchorStatus(note, book) {
  if (!book) return {valid:false,reason:'Reimport this book to reopen the passage.'};
  if (note.bookId !== book.id || note.revision !== book.source.sha256) return {valid:false,reason:'The edition has changed. Your original quotation is preserved.'};
  const section = book.sections.find(s => s.id === note.sectionId);
  if (!section) return {valid:false,reason:'The section is no longer in this edition.'};
  let previous = -1, end = -1;
  for (const s of note.segments) {
    const index = section.blocks.findIndex(b => b.id === s.blockId), b = section.blocks[index];
    if (!b || index < previous || (index === previous && s.start < end) || s.start < 0 || s.end <= s.start || s.end > b.text.length || b.text.slice(s.start,s.end) !== s.quote || b.text.slice(Math.max(0,s.start - s.prefix.length),s.start) !== s.prefix || b.text.slice(s.end,s.end + s.suffix.length) !== s.suffix) return {valid:false,reason:'The source words have changed. The saved quotation has not been moved.'};
    previous = index; end = s.end;
  }
  if (selectionQuote(section,note.segments) !== note.quote) return {valid:false,reason:'The quotation no longer matches its source separators.'};
  return {valid:true,section};
}
export function visibleThrough(state, book) {
  const b = state.boundaries[book.id];
  return b?.revision === book.source.sha256 ? b.index : -1;
}
export function passageAt(book, section, block, start=0, end=block.text.length) {
  require(Number.isInteger(start)&&Number.isInteger(end)&&start>=0&&end>start&&end<=block.text.length,'Invalid passage range.');
  return {bookId:book.id,sectionId:section.id,revision:book.source.sha256,quote:block.text.slice(start,end),segments:[{blockId:block.id,start,end,quote:block.text.slice(start,end),prefix:block.text.slice(Math.max(0,start-40),start),suffix:block.text.slice(end,end+40)}]};
}
export function passagesOverlap(a,b) {
  return a.bookId===b.bookId && a.revision===b.revision && a.sectionId===b.sectionId && a.segments.some(x=>b.segments.some(y=>x.blockId===y.blockId&&x.start<y.end&&y.start<x.end));
}
// Extending is an explicit union of source ranges, never a substitution of the
// previous selection. Reconstruct intervening text and separators from the edition.
export function extendPassage(existing,selected,book) {
  const status=anchorStatus(existing,book),other=anchorStatus(selected,book);
  require(status.valid&&other.valid,'The edition changed. Keep the original quotations and review their anchors.');
  require(passagesOverlap(existing,selected),'Only overlapping passages from the same edition can be extended.');
  const blocks=status.section.blocks,points=[...existing.segments,...selected.segments].map(s=>({...s,index:blocks.findIndex(b=>b.id===s.blockId)}));
  const from=Math.min(...points.map(p=>p.index)),to=Math.max(...points.map(p=>p.index)),segments=[];
  for(let i=from;i<=to;i++) {
    const b=blocks[i],start=i===from?Math.min(...points.filter(p=>p.index===i).map(p=>p.start)):0,end=i===to?Math.max(...points.filter(p=>p.index===i).map(p=>p.end)):b.text.length;
    if(end>start)segments.push(passageAt(book,status.section,b,start,end).segments[0]);
  }
  require(segments.length<=500,'This selection spans too many source blocks. Keep shorter passages separately.');
  return {bookId:book.id,sectionId:status.section.id,revision:book.source.sha256,segments,quote:selectionQuote(status.section,segments)};
}
export function excerptSection(passage,book) {
  const status=anchorStatus(passage,book);require(status.valid,status.reason);
  const first=passage.segments[0],last=passage.segments.at(-1),blocks=status.section.blocks;
  const from=blocks.findIndex(b=>b.id===first.blockId),to=blocks.findIndex(b=>b.id===last.blockId);
  return {id:status.section.id,blocks:blocks.slice(from,to+1).map((b,i,all)=>{
    const start=i===0?first.start:0,end=i===all.length-1?last.end:b.text.length;
    const tablePartial=b.cells&&!(start===0&&end===b.text.length);
    return {...b,...(tablePartial?{role:undefined,cells:undefined}:{}),text:b.text.slice(start,end),after:i<all.length-1?b.after:'',marks:b.marks.filter(m=>m.start<end&&m.end>start).map(m=>({...m,start:Math.max(m.start,start)-start,end:Math.min(m.end,end)-start})),...(b.references?{references:b.references.filter(r=>r.start>=start&&r.end<=end).map(r=>({...r,start:r.start-start,end:r.end-start}))}:{}),...(b.images?{images:b.images.filter(r=>r.start>=start&&r.end<=end).map(r=>({...r,start:r.start-start,end:r.end-start}))}:{}),...(b.anchors?{anchors:b.anchors.filter(a=>a.offset>=start&&a.offset<=end).map(a=>({...a,offset:a.offset-start}))}:{})};
  })};
}
export function findOccurrences(books,state,term,limit=200) {
  const hits=[];let count=0;
  if(!term)return {hits,count};
  for(const book of books)for(const [index,section] of book.sections.entries())if(index<=visibleThrough(state,book))for(const block of section.blocks) {
    let offset=0;
    while((offset=block.text.indexOf(term,offset))!==-1) {
      if(hits.length<limit) {
        // Prefer complete whitespace-delimited words within a bounded amount of
        // extra context. This does not change literal matching or tokenize a language.
        let start=Math.max(0,offset-65),end=Math.min(block.text.length,offset+term.length+85);
        const earliest=Math.max(0,start-32),latest=Math.min(block.text.length,end+32);
        while(start>earliest&&!/\s/u.test(block.text[start-1]))start--;
        while(end<latest&&!/\s/u.test(block.text[end]))end++;
        // Preserve the existing code-point protection for long unspaced text.
        if(start>0&&/[\uDC00-\uDFFF]/.test(block.text[start]))start--;
        if(end<block.text.length&&/[\uDC00-\uDFFF]/.test(block.text[end]))end++;
        hits.push({passage:passageAt(book,section,block,start,end),offset,matchStart:offset-start,matchEnd:offset-start+term.length,omittedStart:start>0,omittedEnd:end<block.text.length});
      }
      count++;offset+=term.length;
    }
  }
  return {hits,count};
}
export function mergeBackup(current, incoming, uuid = () => crypto.randomUUID()) {
  const out = validateState(current), other = validateState(incoming);
  const signature=n=>JSON.stringify([n.bookId,n.revision,n.sectionId,n.quote,n.note,n.updated,n.segments.map(s=>[s.blockId,s.start,s.end,s.quote,s.prefix,s.suffix])]);
  const ids=new Set(out.notes.map(n=>n.id)),signatures=new Set(out.notes.map(signature));
  for (const note of other.notes) {
    const key=signature(note);
    if (!ids.has(note.id)) {out.notes.push(note);ids.add(note.id);signatures.add(key);}
    else if (!signatures.has(key)) {const copy={...note,id:uuid()};out.notes.push(copy);ids.add(copy.id);signatures.add(key);}
  }
  // Fill missing reading places; never replace a current device's place or widen its spoiler choices.
  for (const [key,pos] of Object.entries(other.positions)) if (!Object.hasOwn(out.positions,key)) out.positions[key] = pos;
  if (!out.lastBook) out.lastBook = other.lastBook;
  for (const [key,text] of Object.entries(other.reflections)) {
    if (!Object.hasOwn(out.reflections,key)) out.reflections[key] = text;
    else if (out.reflections[key] !== text && !Object.entries(out.reflections).some(([k,v])=>k.startsWith('restored-')&&v===text)) out.reflections[`restored-${uuid()}`] = text;
  }
  const connectionSignature=c=>JSON.stringify([c.note,c.updated,c.passages.map(p=>[p.bookId,p.sectionId,p.revision,p.quote,p.segments])]);
  const connectionIds=new Set(out.connections.map(c=>c.id)),connectionSignatures=new Set(out.connections.map(connectionSignature));
  for(const connection of other.connections) {
    const signature=connectionSignature(connection);
    if(!connectionIds.has(connection.id)||!connectionSignatures.has(signature)) {
      const copy={...connection,id:connectionIds.has(connection.id)?uuid():connection.id};out.connections.push(copy);connectionIds.add(copy.id);connectionSignatures.add(signature);
    }
  }
  return validateState(out);
}
