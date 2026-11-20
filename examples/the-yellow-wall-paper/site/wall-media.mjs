// Versioned, self-contained media contract for this local edition.
export const WALL_PROFILE='yellow-wall-paper/illustrated@1';
const ok=(v,m)=>{if(!v)throw new Error(m);};
const licenses=[["Attribution-ShareAlike 4.0 International", "https://creativecommons.org/licenses/by-sa/4.0/legalcode", "28a9529c7d0bb4dc51f4bf5c116a3d16ef247a052f7591466768ddf563fd1cf5"],['Attribution-NonCommercial-ShareAlike 4.0 International','https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode','e66c269d4819aaab34b49ef5220c4ddab6756f21bb5180761a4eb8561f2b7bbd']];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,k)=>obj(v)&&Object.keys(v).every(x=>k.includes(x));
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(v);
const str=(v,n)=>typeof v==='string'&&v.length>0&&v.length<=n;
export function validateWallMedia(media,sections){
  ok(keys(media,['assets','figures','pages','initial','account','notices','license']),'Invalid illustrated edition apparatus.');
  ok(Array.isArray(media.assets)&&media.assets.length>0&&media.assets.length<=20,'Invalid image inventory.');
  const ids=new Set();let encoded=0;
  for(const a of media.assets){
    ok(keys(a,['id','mime','sha256','width','height','data','alt'])&&id(a.id)&&!ids.has(a.id),'Invalid or repeated image identity.');ids.add(a.id);
    ok(a.mime==='image/jpeg'&&/^[a-f0-9]{64}$/.test(a.sha256)&&Number.isInteger(a.width)&&a.width>0&&a.width<=3000&&Number.isInteger(a.height)&&a.height>0&&a.height<=3000&&str(a.alt,1000),'Invalid image metadata.');
    ok(str(a.data,3000000)&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.data),'Invalid image encoding.');encoded+=a.data.length;
  }
  ok(encoded<=7000000,'Image inventory exceeds the edition limit.');
  const blocks=sections.flatMap(s=>s.blocks), blockIds=new Set(blocks.map(b=>b.id));
  ok(Array.isArray(media.figures)&&media.figures.length===3,'Three source illustrations are required.');
  for(const f of media.figures)ok(keys(f,['asset','after','caption'])&&ids.has(f.asset)&&(f.after==='start'||blockIds.has(f.after))&&typeof f.caption==='string'&&f.caption.length<=1000,'Invalid source illustration placement.');
  ok(Array.isArray(media.pages)&&media.pages.length===10,'Ten source pages are required.');
  for(const p of media.pages)ok(keys(p,['asset','label'])&&ids.has(p.asset)&&str(p.label,100),'Invalid source page.');
  ok(keys(media.initial,['asset','block','characters'])&&ids.has(media.initial.asset)&&blockIds.has(media.initial.block)&&str(media.initial.characters,5)&&blocks.find(b=>b.id===media.initial.block).text.startsWith(media.initial.characters),'Invalid decorated initial.');
  const refs=[...media.figures.map(f=>f.asset),...media.pages.map(p=>p.asset),media.initial.asset];
  ok(new Set(refs).size===refs.length&&refs.length===ids.size,'Image assets must have unique, complete placements.');
  ok(keys(media.account,['title','paragraphs'])&&str(media.account.title,300)&&Array.isArray(media.account.paragraphs)&&media.account.paragraphs.length>0&&media.account.paragraphs.length<=100,'Invalid author account.');
  for(const p of media.account.paragraphs){
    ok(keys(p,['text','marks'])&&str(p.text,20000)&&Array.isArray(p.marks)&&p.marks.length<=100,'Invalid author account paragraph.');
    let end=0;for(const m of p.marks){ok(keys(m,['kind','start','end'])&&m.kind==='em'&&Number.isInteger(m.start)&&Number.isInteger(m.end)&&m.start>=end&&m.end>m.start&&m.end<=p.text.length,'Invalid author account emphasis.');end=m.end;}
  }
  ok(Array.isArray(media.notices)&&media.notices.length>0&&media.notices.length<=20&&media.notices.every(n=>str(n,5000)),'Source notices must travel with the edition.');
  const l=media.license;ok(keys(l,['title','url','sha256','text'])&&licenses.some(([title,url,sha256])=>l.title===title&&l.url===url&&l.sha256===sha256)&&str(l.text,30000),'The complete edition license must travel with the edition.');
  return structuredClone(media);
}
function jpegSize(bytes){
  ok(bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217,'Invalid JPEG bytes.');
  let i=2;
  while(i<bytes.length-3){
    ok(bytes[i]===255,'Invalid JPEG marker.');while(bytes[i]===255)i++;
    const marker=bytes[i++];if(marker===218)break;
    if(marker===1||(marker>=208&&marker<=217))continue;
    ok(i+1<bytes.length,'Truncated JPEG.');const len=bytes[i]*256+bytes[i+1];ok(len>=2&&i+len<=bytes.length,'Truncated JPEG segment.');
    if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
      ok(len>=8,'Invalid JPEG frame.');return {height:bytes[i+3]*256+bytes[i+4],width:bytes[i+5]*256+bytes[i+6]};
    }i+=len;
  }throw new Error('JPEG frame not found.');
}
export async function verifyWallAssets(book){
  if(book.profile!==WALL_PROFILE)return book;
  const licenseHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(book.media.license.text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
  ok(licenseHash===book.media.license.sha256,'The complete edition license does not match its inventory.');
  for(const asset of book.media.assets){
    let raw;try{raw=atob(asset.data);}catch{throw new Error('Invalid image encoding.');}
    ok(btoa(raw)===asset.data,'Noncanonical image encoding.');const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    const size=jpegSize(bytes);ok(size.width===asset.width&&size.height===asset.height,'Image dimensions do not match the inventory.');
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
    ok(hash===asset.sha256,'Image bytes do not match the edition inventory.');
  }return book;
}
export const imageSource=asset=>`data:${asset.mime};base64,${asset.data}`;
