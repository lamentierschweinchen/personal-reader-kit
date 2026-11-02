export const STORE = 'newreading-writers-work-v1';
export const blankState = () => ({schema:1,size:20,quiet:false,positions:{},notes:[],noteDrafts:{},drafts:{},choices:{},lastRead:null});
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const objectMap = x => Boolean(x && typeof x==='object' && !Array.isArray(x));
const safeRoute = x => typeof x==='string' && /^#(?:home|writers|writer\/[a-z-]+(?:\/[a-z0-9-]+)?|arguments|argument\/[a-z-]+|desk(?:\/[a-z-]+)?|notebook)$/.test(x);
export function validateState(value) {
  if (!value || value.schema!==1 || !Array.isArray(value.notes) || !objectMap(value.positions) || !objectMap(value.drafts) || !objectMap(value.choices) || (value.noteDrafts && !objectMap(value.noteDrafts))) throw new Error('This is not a How writers write notebook.');
  if (!Number.isFinite(value.size) || value.size<16 || value.size>32 || typeof value.quiet!=='boolean') throw new Error('Invalid reading settings.');
  const allNotes=[...value.notes,...Object.values(value.noteDrafts||{}),...(value.noteDraft?[value.noteDraft]:[])];
  for(const n of allNotes) if(!n || typeof n.id!=='string' || typeof n.text!=='string' || typeof n.title!=='string' || typeof n.quote!=='string' || !safeRoute(n.route))throw new Error('A note is damaged.');
  for(const [key,p] of Object.entries(value.positions)) if(!safeRoute(key)||!objectMap(p)||!Number.isFinite(p.y)||p.y<0||!Number.isFinite(p.inset)||(p.anchor!==null&&typeof p.anchor!=='string'))throw new Error('A reading place is damaged.');
  for(const p of Object.values(value.positions)){
    if(p.layout!==undefined&&typeof p.layout!=='string')throw new Error('A reading layout is damaged.');
    if(p.textAnchor!=null&&(!objectMap(p.textAnchor)||!Number.isInteger(p.textAnchor.offset)||p.textAnchor.offset<0||typeof p.textAnchor.character!=='string'||p.textAnchor.character.length!==1||!Number.isFinite(p.textAnchor.inset)))throw new Error('A reading character is damaged.');
  }
  for(const [key,d] of Object.entries(value.drafts)) if(!/^[a-z-]+$/.test(key)||typeof d!=='string')throw new Error('An experiment is damaged.');
  for(const [key,c] of Object.entries(value.choices)) if(!/^[a-z-]+$/.test(key)||!Number.isInteger(c)||c<0||c>1)throw new Error('A desk choice is damaged.');
  if(value.lastRead!==null&&(!objectMap(value.lastRead)||!safeRoute(value.lastRead.route)||typeof value.lastRead.title!=='string'))throw new Error('A reading address is damaged.');
  if(JSON.stringify(value).length>6000000)throw new Error('Notebook is larger than 6 MB.');
  return {...value,noteDrafts:value.noteDrafts||{}};
}
export function notebookContent(s){return JSON.stringify({notes:s.notes,noteDrafts:s.noteDrafts||{},noteDraft:s.noteDraft||null,drafts:s.drafts,choices:s.choices,size:s.size,quiet:s.quiet});}
export function reconcileWrite(base,candidate,latest){
 validateState(candidate);validateState(latest);
 const b=notebookContent(base),c=notebookContent(candidate),l=notebookContent(latest);
 if(l!==b && c!==b && c!==l)throw new Error('Another tab changed the notebook. Export this tab’s work before reloading; recover the download to combine both copies.');
 const content=c===b?latest:candidate;
 const changedPlaces=Object.fromEntries(Object.entries(candidate.positions).filter(([key,p])=>JSON.stringify(p)!==JSON.stringify(base.positions[key])));
 return {...content,positions:{...latest.positions,...changedPlaces},lastRead:JSON.stringify(candidate.lastRead)!==JSON.stringify(base.lastRead)?candidate.lastRead:latest.lastRead};
}
export function validateEdition(e) {
  if(e.schema !== 1 || !Array.isArray(e.authors) || !Array.isArray(e.arguments) || !Array.isArray(e.moments)) throw new Error('The edition is incomplete.');
  const ids = new Set();
  for(const a of e.authors) {
    if(ids.has(a.id) || !a.items.length) throw new Error('Invalid writer inventory.');
    ids.add(a.id);
    const sources = new Set(a.sources.map(s=>s.id));
    for (const i of a.items) {if(ids.has(i.id)||!sources.has(i.sourceId)) throw new Error('Invalid advice source: '+i.id); ids.add(i.id);}
    for (const s of a.sources) if (!/^https:\/\//.test(s.url)) throw new Error('Invalid source URL.');
  }
  const advice = new Set(e.authors.flatMap(a=>a.items.map(i=>i.id)));
  const refs = new Set([...advice,...e.authors.flatMap(a=>a.sources.map(s=>'s:'+s.id))]);
  for(const m of e.moments) for(const c of m.choices) for(const id of [c.affinity,c.dissent]) if(!advice.has(id))throw new Error('Broken desk reference: '+id);
  for(const p of e.arguments) for(const b of p.blocks) for(const match of JSON.stringify(b).matchAll(/\[\[([^|\]]+)\|/g)) if(!refs.has(match[1]))throw new Error('Broken argument reference: '+match[1]);
  return e;
}
export function mergeState(current, incoming) {
  validateState(current); validateState(incoming);
  const notes = new Map(current.notes.map(n=>[n.id,n]));
  for(const n of incoming.notes) {const old=notes.get(n.id); if(!old) notes.set(n.id,n); else if(JSON.stringify(old)!==JSON.stringify(n)) {const id=n.id+'-recovered-'+stableHash(JSON.stringify(n));if(!notes.has(id))notes.set(id,{...n,id});}}
  const noteDrafts={...(current.noteDrafts||{})};
  if(current.noteDraft)noteDrafts[current.noteDraft.id]=current.noteDraft;
  for(const n of [...Object.values(incoming.noteDrafts||{}),...(incoming.noteDraft?[incoming.noteDraft]:[])]) {
    if(!noteDrafts[n.id])noteDrafts[n.id]=n;
    else if(JSON.stringify(noteDrafts[n.id])!==JSON.stringify(n)){const id=n.id+'-recovered-'+stableHash(JSON.stringify(n));if(!noteDrafts[id])noteDrafts[id]={...n,id};}
  }
  const drafts={...current.drafts};
  const recovered=[];
  for(const [id,text] of Object.entries(incoming.drafts)) {
    if (!drafts[id]) drafts[id]=text;
    else if(drafts[id]!==text) recovered.push({id:'recovered-'+stableHash(id+text),route:'#desk/'+id,title:'Recovered experiment',quote:'',text,created:new Date().toISOString()});
  }
  for(const n of recovered)if(!notes.has(n.id))notes.set(n.id,n);
  return {...current,notes:[...notes.values()],noteDrafts,noteDraft:null,drafts};
}
function stableHash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36);}
// The inherited reader uses a source character to keep reference returns stable across reflow.
function characterRect(block,offset){
 const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let node,left=offset;
 while((node=walker.nextNode())){
  if(left<node.length){const range=document.createRange();range.setStart(node,left);range.setEnd(node,left+1);return range.getBoundingClientRect();}
  left-=node.length;
 }
 return null;
}
const blockLayout=block=>{const r=block.getBoundingClientRect();return `${r.width}:${r.height}`;};
function textAnchor(block,edge=105){
 const text=block.textContent,offsets=[];
 for(let i=0;i<text.length;i++)if(!/\s/u.test(text[i]))offsets.push(i);
 if(!offsets.length)return null;
 let lo=0,hi=offsets.length-1;
 while(lo<hi){const mid=Math.floor((lo+hi)/2),rect=characterRect(block,offsets[mid]);if(rect&&rect.top>=edge)hi=mid;else lo=mid+1;}
 const offset=offsets[lo],rect=characterRect(block,offset);
 if(!rect||rect.bottom<=edge||rect.top>=innerHeight)return null;
 return {offset,character:text[offset],inset:rect.top};
}
export function capturePosition(root,y=scrollY){
 const block=[...root.querySelectorAll('[data-anchor]')].find(el=>el.getBoundingClientRect().bottom>105);
 return {y,anchor:block?.dataset.anchor||null,inset:block?.getBoundingClientRect().top||0,
  ...(block?{layout:blockLayout(block),textAnchor:textAnchor(block)}:{})};
}
export function restorePosition(root,p){
 if(!p)return scrollTo(0,0);
 const block=p.anchor?[...root.querySelectorAll('[data-anchor]')].find(el=>el.dataset.anchor===p.anchor):null;
 const text=p.textAnchor;
 if(block&&p.layout!==blockLayout(block)&&text&&block.textContent[text.offset]===text.character){
  const rect=characterRect(block,text.offset);
  if(rect){const inset=Math.max(105,Math.min(text.inset,innerHeight-rect.height-10));scrollTo(0,Math.max(0,scrollY+rect.top-inset));return;}
 }
 scrollTo(0,block?scrollY+block.getBoundingClientRect().top-p.inset:p.y||0);
}
// Requests coalesce; the operation reads current work when it actually runs.
export function createSaveQueue(operation){
 let running=null,requested=false;
 return function request(){
  requested=true;if(running)return running;
  const task=Promise.resolve().then(async()=>{while(requested){requested=false;if(!await operation()){requested=false;return false;}}return true;});
  running=task;const clear=()=>{if(running===task)running=null;};task.then(clear,clear);return task;
 };
}
