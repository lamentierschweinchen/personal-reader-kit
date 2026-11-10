// Versioned, data-only Hall apparatus. No source HTML is executed.
export const HALL_PROFILE='beowulf/hall@1';
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const str=(x,max=200000)=>typeof x==='string'&&x.length<=max;
const key=x=>str(x,120)&&/^[A-Za-z0-9_.-]+$/.test(x);
const exact=(x,keys)=>obj(x)&&Object.keys(x).every(k=>keys.includes(k));
const check=(x,message)=>{if(!x)throw new Error(message);};
function ranges(values,text,kind) {
  check(Array.isArray(values)&&values.length<=5000,`Invalid ${kind} ranges.`);
  for(const v of values){
    const keys=kind==='marks'?['kind','start','end']:kind==='refs'?['target','start','end']:['kind','detail','start','end'];
    check(exact(v,keys)&&Number.isInteger(v.start)&&Number.isInteger(v.end)&&v.start>=0&&v.end>v.start&&v.end<=text.length,`Invalid ${kind} range.`);
    if(kind==='marks')check(['em','strong','sup','sub'].includes(v.kind),'Unsupported source emphasis.');
    if(kind==='refs')check(key(v.target),'Invalid source reference.');
    if(kind==='interventions')check(['addition','correction'].includes(v.kind)&&str(v.detail,1000),'Invalid source intervention.');
  }
}
function styles(values,text){
  check(Array.isArray(values)&&values.length<=5000,'Invalid source styles.');
  for(const v of values)check(exact(v,['kind','value','start','end'])&&['language','smallcaps','small','blockquote'].includes(v.kind)&&str(v.value,35)&&(!v.value||/^[A-Za-z0-9-]+$/.test(v.value))&&Number.isInteger(v.start)&&Number.isInteger(v.end)&&v.start>=0&&v.end>v.start&&v.end<=text.length,'Invalid source style.');
}
function pageOffsets(values,text){check(Array.isArray(values)&&values.length<=1000,'Invalid page markers.');for(const p of values)check(exact(p,['id','label','offset'])&&key(p.id)&&str(p.label,100)&&Number.isInteger(p.offset)&&p.offset>=0&&p.offset<=text.length,'Invalid page marker.');}
function content(item,extra=[]) {
  check(exact(item,['text','marks','refs','footnotes','interventions','styles','pages',...extra])&&str(item.text),'Invalid source apparatus text.');
  ranges(item.marks,item.text,'marks');ranges(item.refs,item.text,'refs');ranges(item.interventions,item.text,'interventions');styles(item.styles,item.text);
  pageOffsets(item.pages,item.text);
  check(Array.isArray(item.footnotes)&&item.footnotes.length<=1000,'Invalid source note references.');
  for(const f of item.footnotes)check(exact(f,['offset','target'])&&Number.isInteger(f.offset)&&f.offset>=0&&f.offset<=item.text.length&&key(f.target),'Invalid source note reference.');
}
export function validateHall(apparatus,sections) {
  check(exact(apparatus,['preliminaries','frontMatter','notes','marginals','gutenbergLicense','notice','officialFormatUrl','lineMetadata','headingMetadata','destinations','sourcePages','companion']),'Invalid Hall apparatus.');
  for(const group of ['preliminaries','frontMatter']) {
    check(Array.isArray(apparatus[group])&&apparatus[group].length<=50,'Invalid source matter.');
    for(const part of apparatus[group]){
      check(exact(part,['sourceId','items'])&&key(part.sourceId)&&Array.isArray(part.items)&&part.items.length<=2000,'Invalid source matter section.');
      for(const item of part.items){content(item,['tag']);check(['div','li','h2','p'].includes(item.tag),'Invalid source matter element.');}
    }
  }
  check(Array.isArray(apparatus.notes)&&apparatus.notes.length<=2000,'Invalid source notes.');
  for(const note of apparatus.notes){content(note,['sourceId']);check(key(note.sourceId),'Invalid source note ID.');}
  const noteIds=new Set(apparatus.notes.map(x=>x.sourceId));check(noteIds.size===apparatus.notes.length,'Duplicate source note.');
  check(Array.isArray(apparatus.marginals)&&apparatus.marginals.length<=5000,'Invalid marginal summaries.');
  for(const item of apparatus.marginals){content(item,['sourceSection','sourceLine']);check(key(item.sourceSection)&&key(item.sourceLine),'Invalid marginal source location.');}
  content(apparatus.notice);check(str(apparatus.notice.text)&&apparatus.notice.text.length>0&&str(apparatus.officialFormatUrl,2000)&&/^https:\/\//.test(apparatus.officialFormatUrl),'Source notice or original format link missing.');
  check(Array.isArray(apparatus.gutenbergLicense)&&apparatus.gutenbergLicense.length>0&&apparatus.gutenbergLicense.length<=1000,'Invalid source license.');
  for(const item of apparatus.gutenbergLicense){content(item,['tag']);check(['div','h2','li'].includes(item.tag),'Invalid source license element.');}
  const entries=sections.flatMap(s=>s.blocks.map(b=>[b.id,b]));const blocks=new Map(entries);check(blocks.size===entries.length,'Source block IDs must be unique across sections.');
  check(Array.isArray(apparatus.lineMetadata)&&apparatus.lineMetadata.length===blocks.size,'Source-line inventory differs from the edition.');
  const lineIds=new Set();
  for(const line of apparatus.lineMetadata){
    check(exact(line,['sourceId','refs','footnotes','interventions','styles','pages'])&&key(line.sourceId),'Invalid source-line identity.');
    const block=blocks.get(line.sourceId.replaceAll('.','-'));check(block&&!lineIds.has(line.sourceId),'Missing or duplicate source line.');lineIds.add(line.sourceId);
    ranges(line.refs,block.text,'refs');ranges(line.interventions,block.text,'interventions');styles(line.styles,block.text);pageOffsets(line.pages,block.text);
    check(Array.isArray(line.footnotes),'Invalid source-line notes.');
    for(const f of line.footnotes)check(exact(f,['offset','target'])&&Number.isInteger(f.offset)&&f.offset>=0&&f.offset<=block.text.length&&noteIds.has(f.target),'Invalid linked source note.');
  }
  for(const item of apparatus.marginals)check(lineIds.has(item.sourceLine)&&item.sourceLine.startsWith('L.'+item.sourceSection+'.'),'Marginal summary has no matching source line.');
  for(const group of [...apparatus.preliminaries,...apparatus.frontMatter])for(const item of group.items)for(const f of item.footnotes)check(noteIds.has(f.target),'Source matter note is missing.');
  check(Array.isArray(apparatus.headingMetadata)&&apparatus.headingMetadata.length===sections.length,'Invalid source headings.');
  check(new Set(apparatus.headingMetadata.map(h=>h.sourceSection)).size===sections.length,'Duplicate source headings.');
  for(const h of apparatus.headingMetadata){check(exact(h,['sourceSection','items'])&&key(h.sourceSection)&&Array.isArray(h.items)&&h.items.length===2&&sections.some(s=>s.id==='fit-'+h.sourceSection),'Invalid source heading.');for(const x of h.items)content(x);}
  check(Array.isArray(apparatus.destinations)&&apparatus.destinations.length<=10000,'Invalid source destinations.');
  const destinations=new Set();
  for(const d of apparatus.destinations){check(obj(d)&&key(d.id)&&!destinations.has(d.id),'Duplicate source destination.');destinations.add(d.id);
    if(d.kind==='line'){check(exact(d,['id','kind','section','line'])&&Number.isInteger(d.line)&&sections.some(s=>s.id==='fit-'+d.section&&s.blocks.some(b=>b.id===`L-${d.section}-${d.line}`)),'Invalid destination line.');}
    else if(d.kind==='source'){const group=[...apparatus.preliminaries,...apparatus.frontMatter].find(g=>g.sourceId===d.group);check(exact(d,['id','kind','group','index'])&&group&&Number.isInteger(d.index)&&d.index>=0&&d.index<group.items.length,'Invalid destination in source matter.');}
    else throw new Error('Unsupported source destination.');
  }
  check(Array.isArray(apparatus.sourcePages)&&apparatus.sourcePages.length>0&&apparatus.sourcePages.length<=2000,'Invalid source pages.');
  const pageIds=new Set();for(const p of apparatus.sourcePages){const dest=apparatus.destinations.find(d=>d.id===p.id);check(dest&&!pageIds.has(p.id)&&str(p.label,100)&&Number.isInteger(p.offset)&&p.offset>=0&&p.kind===dest.kind,'Invalid source page.');pageIds.add(p.id);if(p.kind==='line'){check(exact(p,['id','label','offset','kind','section','line'])&&p.section===dest.section&&p.line===dest.line&&p.offset<=sections.find(s=>s.id==='fit-'+p.section).blocks.find(b=>b.id===`L-${p.section}-${p.line}`).text.length,'Invalid page line.');}else{const g=[...apparatus.preliminaries,...apparatus.frontMatter].find(g=>g.sourceId===p.group);check(exact(p,['id','label','offset','kind','group','index'])&&g&&p.group===dest.group&&p.index===dest.index&&p.offset<=g.items[p.index].text.length,'Invalid page in source matter.');}}
  const sourceItems=[...apparatus.notes,...apparatus.marginals,...apparatus.gutenbergLicense,apparatus.notice,...apparatus.preliminaries.flatMap(g=>g.items),...apparatus.frontMatter.flatMap(g=>g.items),...apparatus.headingMetadata.flatMap(g=>g.items)];
  for(const item of sourceItems)for(const ref of item.refs)check(destinations.has(ref.target),'Source reference target is missing.');
  for(const line of apparatus.lineMetadata)for(const ref of line.refs)check(destinations.has(ref.target),'Line reference target is missing.');
  check(Array.isArray(apparatus.companion)&&apparatus.companion.length<=100,'Invalid companion.');
  const getRange=item=>{const section=sections.find(s=>s.id==='fit-'+item.section);check(section&&Number.isInteger(item.start)&&Number.isInteger(item.end)&&item.start>0&&item.end>=item.start,'Invalid companion source range.');for(let n=item.start;n<=item.end;n++)check(section.blocks.some(b=>b.id===`L-${item.section}-${n}`),'Companion source line is missing.');};
  for(const item of apparatus.companion){
    check(obj(item)&&['prose','heading','excerpt','links','historical'].includes(item.kind),'Invalid companion item.');
    if(['prose','heading'].includes(item.kind))check(exact(item,['kind','text'])&&str(item.text,5000),'Invalid companion text.');
    if(item.kind==='excerpt'){check(exact(item,['kind','label','section','start','end'])&&str(item.label,300),'Invalid excerpt.');getRange(item);}
    if(item.kind==='links'){check(exact(item,['kind','items'])&&Array.isArray(item.items)&&item.items.length<=30,'Invalid companion links.');for(const link of item.items){check(exact(link,['label','section','start','end'])&&str(link.label,300),'Invalid companion link.');getRange(link);}}
    if(item.kind==='historical'){check(exact(item,['kind','title','paragraphs'])&&str(item.title,300)&&Array.isArray(item.paragraphs)&&item.paragraphs.length<=20,'Invalid historical note.');for(const p of item.paragraphs){check(exact(p,['text','label','url','label2','url2'])&&str(p.text,5000),'Invalid historical paragraph.');for(const suffix of ['', '2'])if(p['url'+suffix]!==undefined)check(str(p['label'+suffix],300)&&str(p['url'+suffix],2000)&&/^https:\/\//.test(p['url'+suffix]),'Invalid historical source.');}}
  }
  return structuredClone(apparatus);
}
