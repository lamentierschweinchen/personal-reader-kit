// Reviewed local extension; plain text editions retain the stock exact contract.
export const EDITION_PROFILE='music-and-feeling/edition@1';
const key=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(x);
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const fields=(x,names)=>check(x&&Object.keys(x).every(k=>names.includes(k)),'Unsupported edition field. Use the matching reader; nothing was discarded.');
export function validateEdition(value,base) {
 fields(value,['schema','profile','id','title','author','edition','language','source','sections','context','assets','pages']);
 check(Array.isArray(value.assets)&&value.assets.length<=300,'Invalid edition asset inventory.');
 const ids=new Set(),files=new Set();
 const assets=value.assets.map(a=>{
  fields(a,['id','file','sha256','width','height','alt']);
  check(key(a.id)&&!ids.has(a.id)&&typeof a.file==='string'&&/^[a-zA-Z0-9_-]+\.jpg$/.test(a.file)&&!files.has(a.file)&&/^[a-f0-9]{64}$/.test(a.sha256)&&Number.isInteger(a.width)&&a.width>0&&a.width<=6000&&Number.isInteger(a.height)&&a.height>0&&a.height<=10000&&typeof a.alt==='string'&&a.alt.length<=2000,'Invalid or missing source image.');ids.add(a.id);files.add(a.file);return {...a};
 });
 const blocks=new Map();
 check(Array.isArray(value.sections),'Invalid edition sections.');
 const sections=value.sections.map(s=>({...s,blocks:s.blocks.map(b=>{
  fields(b,['id','kind','text','after','marks','layout','refs','media','stacks']);check(!blocks.has(b.id),'Duplicate edition block identity.');blocks.set(b.id,{b,section:s.id});
  const {refs,media,stacks,...plain}=b;return plain;
 })}));
 const {profile:ignoredProfile,assets:ignoredAssets,pages:ignoredPages,...baseValue}=value;
 const plain=base({...baseValue,sections});
 // The base validator intentionally rejects unknown properties, even undefined.
 const pages=value.pages;
 check(Array.isArray(pages)&&pages.length<=300,'Invalid source page map.');
 const seen=new Set();
 for(const p of pages){fields(p,['id','label','asset','blocks','show']);check(key(p.id)&&!seen.has(p.id)&&typeof p.label==='string'&&p.label.length<100&&ids.has(p.asset)&&Array.isArray(p.blocks)&&p.blocks.every(id=>blocks.has(id))&&typeof p.show==='boolean','Source page map does not match this edition.');seen.add(p.id);}
 for(const {b} of blocks.values()){
  check(b.media===undefined||ids.has(b.media),'Missing notation asset.');
  check(b.stacks===undefined||Array.isArray(b.stacks)&&b.stacks.length<=20,'Invalid stacked source notation.');
  let previousStackEnd=-1;for(const s of b.stacks||[]){fields(s,['start','end','label']);check(Number.isInteger(s.start)&&Number.isInteger(s.end)&&s.start>=0&&s.start>=previousStackEnd&&s.end>s.start&&s.end<=b.text.length&&/^[0-9]+\n[0-9]+$/.test(b.text.slice(s.start,s.end))&&typeof s.label==='string'&&s.label.length<200,'Stacked notation must preserve its literal source lines.');previousStackEnd=s.end;}
  check(b.refs===undefined||Array.isArray(b.refs)&&b.refs.length<=100,'Invalid source note references.');
  for(const r of b.refs||[]){fields(r,['start','end','target']);check(Number.isInteger(r.start)&&Number.isInteger(r.end)&&r.start>=0&&r.end>r.start&&r.end<=b.text.length&&blocks.has(r.target),'Source note reference has no exact target.');}
 }
 return {...plain,profile:EDITION_PROFILE,assets,pages:pages.map(p=>({...p,blocks:[...p.blocks]})),sections:plain.sections.map(s=>({...s,blocks:s.blocks.map(b=>{const original=blocks.get(b.id).b;return {...b,...(original.refs?{refs:original.refs.map(r=>({...r}))}:{}),...(original.media?{media:original.media}:{}),...(original.stacks?{stacks:original.stacks.map(s=>({...s}))}:{})};})}))};
}
const verifiedImages=new Map();
export async function loadSourceImage(img,asset){
 img.style.setProperty('--source-intrinsic-width',asset.width+'px');
 try{
  let pending=verifiedImages.get(asset.sha256);
  if(!pending){pending=(async()=>{const response=await fetch('/'+asset.file);if(!response.ok)throw Error('Missing source image');const bytes=await response.arrayBuffer();const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');if(digest!==asset.sha256)throw Error('Source image differs from the edition');const blob=new Blob([bytes],{type:'image/jpeg'});return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Source image could not be decoded'));reader.readAsDataURL(blob);});})();verifiedImages.set(asset.sha256,pending);}
  img.src=await pending;await img.decode();if(img.naturalWidth!==asset.width||img.naturalHeight!==asset.height)throw Error('Source image dimensions differ from the edition');
 }catch(error){img.removeAttribute('src');const message=document.createElement('p');message.className='recovery';message.setAttribute('role','alert');message.textContent=error.message+'. Keep this edition with its matching source-image folder; no replacement image was used.';img.replaceWith(message);}
}
