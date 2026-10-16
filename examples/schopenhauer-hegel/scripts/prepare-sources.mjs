// Reviewed adapter for these two pinned Gutenberg HTML editions only.
// Raw downloads remain ignored. This does not change the kit EPUB preparer.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const sha=b=>createHash('sha256').update(b).digest('hex');
const dir=new URL('../.reader/private/sources/',import.meta.url);
const configs=[
 {id:'hegel',number:'51635',title:'Lectures on the History of Philosophy · Volume One',author:'G. W. F. Hegel',edition:'E. S. Haldane translation, first published 1892; the digitized title pages record a 1955 reprint. Volume 1 of 3. Edited from the lectures by Karl Ludwig Michelet; the translator identifies the 1840 German edition.',images:{'images/logo.jpg':['hegel-logo.jpg','Publisher’s architectural device on the title page.'],'images/ill-276a.jpg':['hegel-276a.jpg','First diagram for Zeno’s fourth proof: three parallel rows AB, CD and EF, with lettered positions.'],'images/ill-276b.jpg':['hegel-276b.jpg','Second diagram for Zeno’s fourth proof: EF and CD have moved in opposite directions relative to AB.'],'images/ill-276c.jpg':['hegel-276c.jpg','Third diagram for Zeno’s fourth proof: the rows show the later relative positions.'],'images/cover.jpg':['hegel-cover.jpg','Source cover, created by the transcriber from the title page; its text repeats the title, translator, volume and publisher.']}},
 {id:'schopenhauer',number:'10731',title:'The Art of Controversy & accompanying essays',author:'Arthur Schopenhauer',edition:'Translated by T. Bailey Saunders; translator’s preface dated February 1896. Complete contents of this digital collection. Saunders states that he omitted passages from the last three essays and changed some titles; this is not an unabridged German collected edition.',images:{}}
];
const output=new URL(`../.reader/private/prepared-${Date.now()}/`,import.meta.url);
await mkdir(output,{recursive:true});
await mkdir(new URL('../.reader/reports/',import.meta.url),{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const page=await browser.newPage();
const inventory=[],reports=[];
try {for(const config of configs) {
 const raw=await readFile(new URL(`pg${config.number}.html`,dir));
 const expected={hegel:'8f8d0575d8a5fd82f93dc36ed1aba280fe0b8b1bf330216760b9e43a3b139c5e',schopenhauer:'f8d9d3c36ea136d6f6dc16de2843fe08069826b8af63ac018c05de3ba7fb67f8'};
 if(sha(raw)!==expected[config.id])throw Error('Source bytes differ from the reviewed edition. Review before adapting.');
 const images={};
 for(const [src,[name,alt]] of Object.entries(config.images)) {
   const bytes=await readFile(new URL(name,dir));
   images[src]={data:`data:image/jpeg;base64,${bytes.toString('base64')}`,alt,sha256:sha(bytes)};
   inventory.push({path:`embedded:${config.id}:${src}`,bytes:bytes.length,sha256:sha(bytes),source:`https://www.gutenberg.org/cache/epub/${config.number}/${src}`});
 }
 const result=await page.evaluate(({html,config,images})=>{
   const doc=new DOMParser().parseFromString(html,'text/html');
   if(doc.querySelector('script,iframe,object,embed'))throw Error('Unexpected active source content');
   const boilerplate=[...doc.querySelectorAll('#pg-header,#pg-footer')].map(el=>({id:el.id,text:el.textContent}));
   doc.querySelectorAll('#pg-header,#pg-footer').forEach(el=>el.remove());
   // Distribution boilerplate is omitted under the acknowledged-source route.
   // Every literary block and the source transcriber's notes remain in order.
   const nodes=[...doc.body.querySelectorAll('p,h1,h2,h3,h4,pre,table,img')].filter(el=>!el.parentElement.closest('p,h1,h2,h3,h4,pre,table'));
   const seen=new Set(),mapping={},pending=[],sections=[{id:'front',title:'Title pages & contents',blocks:[]}];
   let section=sections[0],serial=0,started=false;
   function inline(el,pre=false) {
     let raw='';const marks=[],links=[];
     function walk(n) {
       if(n.nodeType===3){raw+=n.data;return;}
       if(n.nodeType!==1)return;
       const start=raw.length;
       if(n.tagName==='BR')raw+='\uE000';else for(const c of n.childNodes)walk(c);
       const end=raw.length;
       let kind=({I:'em',EM:'em',B:'strong',STRONG:'strong',SUP:'sup',SUB:'sub'})[n.tagName];
       if(n.classList.contains('smcap'))kind='smallcaps';
       if(n.classList.contains('pagenum'))kind='page';
       if(kind&&end>start)marks.push({kind,start,end});
       if(n.tagName==='A'&&n.hasAttribute('href')&&end>start)links.push({href:n.getAttribute('href'),start,end,kind:n.classList.contains('fnanchor')?'note':'reference'});
     }
     walk(el);
     let text='',map=Array(raw.length+1);let i=0;
     while(i<raw.length) {
       map[i]=text.length;
       if(!pre&&/[ \t\r\n\f]/.test(raw[i])) {
         let end=i+1;while(end<raw.length&&/[ \t\r\n\f]/.test(raw[end]))end++;
         const keep=text.length&&!text.endsWith('\n')&&end<raw.length&&raw[end]!=='\uE000';
         for(let j=i;j<end;j++)map[j]=text.length;
         if(keep)text+=' ';i=end;
       } else {text+=raw[i]==='\uE000'?'\n':raw[i];i++;}
     }
     map[raw.length]=text.length;
     const convert=arr=>arr.map(x=>({...x,start:map[x.start],end:map[x.end]})).filter(x=>x.end>x.start);
     return {text,marks:convert(marks),links:convert(links)};
   }
   function add(el,block) {
     block.id=`${config.id[0]}${String(++serial).padStart(4,'0')}`;
     section.blocks.push(block);seen.add(el);
     for(const key of [...pending.splice(0),el.id,...[...el.querySelectorAll('[id]')].map(n=>n.id)].filter(Boolean))mapping[key]={sectionId:section.id,blockId:block.id};
   }
   if(config.id==='hegel')section.blocks.push({id:'source-cover',kind:'prose',text:'',after:'\n\n',marks:[],illustration:images['images/cover.jpg']});
   for(const el of nodes) {
     const heading=/^H[1-4]$/.test(el.tagName),value=inline(el,el.tagName==='PRE');
     const label=value.text.replace(/\s+/g,' ').trim();
     if(!label&&el.tagName!=='IMG') {pending.push(...[el.id,...[...el.querySelectorAll('[id]')].map(n=>n.id)].filter(Boolean));seen.add(el);continue;}
     if(heading&&(/TRANSLATOR[’']S (NOTE|PREFACE)/.test(label)||started)) {
       started=true;
       const sourceId=el.id||el.querySelector('[id]')?.id||pending[0];
       const sectionId=sourceId&&/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(sourceId)?sourceId:`section-${sections.length}`;
       section={id:sectionId,title:config.id==='schopenhauer'&&/^[IVXL]+\.$/.test(label)?`Stratagem ${label}`:label,blocks:[]};sections.push(section);
     }
     if(el.classList.contains('transnote')||label==='TRANSCRIBER’S NOTES:') {section={id:'transcriber',title:'Transcriber’s notes',blocks:[]};sections.push(section);}
     if(el.tagName==='IMG') {
       const illustration=images[el.getAttribute('src')];if(!illustration)throw Error('Unreviewed image '+el.getAttribute('src'));
       add(el,{kind:'prose',text:'',after:'\n\n',marks:[],illustration});continue;
     }
     if(el.tagName==='TABLE') {
       let text='',marks=[],links=[],rows=[];
       for(const row of el.rows) {
         const cells=[];
         for(const [j,cell] of [...row.cells].entries()) {
           if(j)text+='\t';const start=text.length,v=inline(cell);text+=v.text;
           marks.push(...v.marks.map(m=>({...m,start:m.start+start,end:m.end+start})));
           links.push(...v.links.map(m=>({...m,start:m.start+start,end:m.end+start})));
           cells.push({start,end:text.length,colspan:cell.colSpan,indent:Number(cell.className.match(/tdl(\d)/)?.[1]||0)});
         }
         rows.push(cells);text+='\n';
       }
       add(el,{kind:'prose',text,after:'\n\n',marks,links,table:{rows,...(el.id==='t01'?{widths:[12,6,3,1.5,1]}:{})}});continue;
     }
     const verse=el.tagName==='PRE'||/\bpp(6q?|12)\b/.test(el.className);
     const note=el.classList.contains('pfn4')||/^\{Footnote \d+:/.test(label);
     const block={kind:heading?'heading':note?'note':verse?'verse':'prose',...value,after:'\n\n'};
     if(verse&&config.id==='schopenhauer')block.marks.push({kind:'em',start:0,end:block.text.length}); // pre italic in the source CSS
     if(/\bpc\d?\b/.test(el.className)||heading)block.align='center';
     if(verse&&config.id==='hegel')block.indent=el.classList.contains('pp12')?2:1;
     // Consecutive verse paragraphs are source lines, not independent stanzas.
     if(verse&&section.blocks.at(-1)?.kind==='verse'&&!el.classList.contains('p1'))section.blocks.at(-1).after='\n';
     add(el,block);
   }
   let linked=0,unresolved=[];
   for(const s of sections)for(const b of s.blocks) {
     b.links=(b.links||[]).map(link=>{
       if(link.href.startsWith('#')){const target=mapping[link.href.slice(1)];if(!target){unresolved.push(link.href);return null;}linked++;return {start:link.start,end:link.end,kind:link.kind,...target};}
       const url=new URL(link.href,'https://www.gutenberg.org/');if(!['https:','http:'].includes(url.protocol))throw Error('Unsupported source link');return {start:link.start,end:link.end,kind:'external',url:url.href.replace(/^http:/,'https:')};
     }).filter(Boolean);
     if(!b.links.length)delete b.links;
   }
   if(unresolved.length)throw Error('Unresolved source links: '+JSON.stringify(unresolved));
   // Independent body coverage check: every non-whitespace text node must be
   // under exactly one selected block. No catch-all silently swallows content.
   const uncovered=[];const walker=doc.createTreeWalker(doc.body,NodeFilter.SHOW_TEXT);let node;
   while((node=walker.nextNode()))if(node.textContent.trim()&&!node.parentElement.closest('style')){
     if(!nodes.some(el=>el.contains(node)))uncovered.push(node.textContent.slice(0,200));
   }
   if(uncovered.length)throw Error('Uncovered source text: '+JSON.stringify(uncovered));
   const sourceText=nodes.map(el=>el.textContent).join(''),preparedText=sections.flatMap(s=>s.blocks).map(b=>b.text).join('');
   const normalize=s=>s.replace(/[\s\u00a0]+/g,'');
   if(normalize(sourceText)!==normalize(preparedText))throw Error('Non-whitespace character mismatch');
   return {sections,mapping,report:{blocks:serial,sourceNodes:nodes.length,coveredNodes:seen.size,sections:sections.map(s=>({id:s.id,title:s.title,blocks:s.blocks.length})),linked,unresolved,uncovered,characterAgreement:normalize(sourceText)===normalize(preparedText),nonWhitespaceCharacters:normalize(preparedText).length,sourceBoilerplateOmitted:boilerplate.map(b=>b.id),rawBoilerplate:boilerplate}};
 },{html:raw.toString('utf8'),config,images});
 const book={schema:1,id:config.id,title:config.title,author:config.author,edition:config.edition,language:'en',source:{sha256:sha(raw),format:'text/html',description:`Source acknowledgement: Project Gutenberg eBook ${config.number}, downloaded 2026-10-16. Reviewed project-local HTML adapter; complete literary contents and source apparatus; distribution boilerplate omitted. Images are embedded for portable recovery. Not a facsimile or a newly proofread edition.`},sections:result.sections,context:[{kind:'source',label:'About this edition',text:config.edition,through:null,url:`https://www.gutenberg.org/ebooks/${config.number}`},{kind:'source',label:'Source acknowledgement',text:config.id==='hegel'?'Digitized by Giovanni Fini, Fritz Ohrenschall and the Online Distributed Proofreading Team. The translator describes Michelet’s compilation from multiple courses, not a transcript of a single day. Source notes and the transcriber’s note remain in the book.':'E-text prepared by Juliet Sutherland, Josephine Paolucci and the Project Gutenberg Online Distributed Proofreading Team. The preface identifies posthumous papers edited by Julius Frauenstädt and Eduard Grisebach. Literal “{Greek: …}” spellings and inline footnotes are features of this digital source.',through:null,url:`https://www.gutenberg.org/cache/epub/${config.number}/pg${config.number}-images.html`},{kind:'source',label:'Source-edition EPUB',text:'An EPUB supplied by the source library for an e-reader. This application does not export EPUB or synchronize web notes with an e-reader. This link needs a network connection.',through:null,url:`https://www.gutenberg.org/ebooks/${config.number}.epub3.images`},{kind:'source',label:'Rights and source terms',text:'The catalogue states public domain in the USA. No worldwide clearance is claimed. This free local adaptation omits the distributor’s header/footer and uses its name only in this source acknowledgement. Original editions and their terms remain available at the source. Publication territory and destination have not been chosen.',through:null,url:'https://www.gutenberg.org/policy/permission.html'}]};
 const bytes=Buffer.from(JSON.stringify(book,null,2)+'\n');await writeFile(new URL(`${config.id}.json`,output),bytes,{flag:'wx',mode:0o600});
 inventory.push({path:`editions/${config.id}.json`,sha256:sha(bytes),bytes:bytes.length,sourceSha256:sha(raw),source:`https://www.gutenberg.org/cache/epub/${config.number}/pg${config.number}-images.html`});
 reports.push({id:config.id,sourceSha256:sha(raw),...result.report});
 await writeFile(new URL(`../.reader/reports/${config.id}-mapping.json`,import.meta.url),JSON.stringify(result.mapping,null,2)+'\n');
 }
 await writeFile(new URL('../.reader/reports/source-coverage.json',import.meta.url),JSON.stringify(reports,null,2)+'\n');
 await writeFile(new URL('../.reader/reports/proposed-assets.json',import.meta.url),JSON.stringify(inventory,null,2)+'\n');
 console.log('Private candidates: '+output.pathname+'; compare and review before promoting to editions/.');
 console.log(JSON.stringify(reports.map(({id,blocks,linked,characterAgreement,nonWhitespaceCharacters,sections})=>({id,blocks,linked,characterAgreement,nonWhitespaceCharacters,sections:sections.length})),null,2));
}finally{await browser.close();}
