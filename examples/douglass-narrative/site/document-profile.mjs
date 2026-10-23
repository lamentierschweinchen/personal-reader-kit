// Portable non-executable document apparatus. Text offsets are UTF-16 code units.
export const DOCUMENT_PROFILE='douglass/document@1';
const fail=(ok,message)=>{if(!ok)throw Error(message);};
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const ident=x=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(x)&&!['constructor','prototype','__proto__'].includes(x);
const fields=(x,keys)=>fail(obj(x)&&Object.keys(x).every(k=>keys.includes(k)),'Unsupported document field.');
const text=(x,n=2000)=>typeof x==='string'&&x.length<=n;
const integer=(x,a,b)=>Number.isInteger(x)&&x>=a&&x<=b;
// SHA-256 adapted from the reviewed kit illustrated-edition raster adapter.
export function digest(bytes){
 const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],data=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);data.set(bytes);data[bytes.length]=128;
 const view=new DataView(data.buffer);view.setUint32(data.length-4,bytes.length*8);view.setUint32(data.length-8,Math.floor(bytes.length/0x20000000));const w=new Uint32Array(64),r=(n,x)=>(x>>>n)|(x<<(32-n));
 for(let offset=0;offset<data.length;offset+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(r(7,a)^r(18,a)^(a>>>3))+w[i-16]+(r(17,b)^r(19,b)^(b>>>10))+w[i-7];}let [a,b,c,d,e,f,g,j]=h;for(let i=0;i<64;i++){const t1=(j+(r(6,e)^r(11,e)^r(25,e))+((e&f)^(~e&g))+k[i]+w[i])|0,t2=((r(2,a)^r(13,a)^r(22,a))+((a&b)^(a&c)^(b&c)))|0;j=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}[a,b,c,d,e,f,g,j].forEach((v,i)=>h[i]=(h[i]+v)|0);}
 return h.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
}

export function jpegDimensions(bytes){
 fail(bytes.length>=4&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217,'Invalid JPEG envelope.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let i=2;
 while(i+4<bytes.length){fail(bytes[i++]===255,'Invalid JPEG marker.');while(bytes[i]===255)i++;const marker=bytes[i++];
  if(marker===218)break;
  fail(![0,216,217].includes(marker),'Invalid JPEG segment marker.');
  const len=v.getUint16(i);fail(len>=2&&i+len<=bytes.length,'Invalid JPEG segment.');
  if([192,193,194].includes(marker)){fail(len>=8,'Invalid JPEG frame.');return [v.getUint16(i+5),v.getUint16(i+3)];}i+=len;
 }throw Error('JPEG has no supported frame.');
}
const checked=new Map();
export function validateAssets(assets){
 fail(Array.isArray(assets)&&assets.length>0&&assets.length<=20,'Invalid document assets.');let total=0;const ids=new Set();
 return assets.map(a=>{
  fields(a,['id','type','sha256','width','height','alt','credit','data']);
  fail(ident(a.id)&&!ids.has(a.id),'Invalid or duplicate asset ID.');ids.add(a.id);
  fail(a.type==='image/jpeg'&&/^[a-f0-9]{64}$/.test(a.sha256),'Invalid document asset type or digest.');
  fail(integer(a.width,1,8000)&&integer(a.height,1,8000)&&a.width*a.height<=24000000,'Invalid asset dimensions.');
  fail(text(a.alt)&&a.alt.length&&text(a.credit)&&a.credit.length,'Asset descriptions required.');
  fail(text(a.data,4*1024*1024)&&a.data.length>0&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.data),'Invalid JPEG base64.');
  total+=a.data.length;fail(total<=12*1024*1024,'Document assets exceed encoded limit.');
  const signature=JSON.stringify([a.data,a.width,a.height]);
  if(checked.get(a.sha256)!==signature){const bytes=Uint8Array.from(atob(a.data),c=>c.charCodeAt(0));
   const [w,h]=jpegDimensions(bytes);fail(w===a.width&&h===a.height,'JPEG dimensions disagree.');fail(digest(bytes)===a.sha256,'JPEG digest disagrees.');
   if(checked.size>=20)checked.clear();checked.set(a.sha256,signature);
  }
  return {...a};
 });
}
export const assetURL=a=>`data:image/jpeg;base64,${a.data}`;
export function validateDocument(value,validateText){
 fields(value,['schema','profile','id','title','author','edition','language','source','sections','context','assets']);
 const assets=validateAssets(value.assets),assetIDs=new Set(assets.map(a=>a.id));
 fail(Array.isArray(value.sections),'Invalid document sections.');
 const stripped={...value,profile:'personal-reader/text@1'};delete stripped.assets;
 stripped.sections=value.sections.map(s=>{fields(s,['id','title','blocks']);fail(Array.isArray(s.blocks),'Invalid document blocks.');return {...s,blocks:s.blocks.map(b=>{
  fields(b,['id','kind','text','after','marks','layout','image','references','pages','sourceNote','lineIndents','languages']);
  const copy={...b};for(const key of ['image','references','pages','sourceNote','lineIndents','languages'])delete copy[key];return copy;
 })};});
 const base=validateText(stripped),pages=new Set(),refs=new Map(),notes=new Map(),usedAssets=new Set();
 for(const [si,s]of base.sections.entries())for(const [bi,b]of s.blocks.entries()){
  const original=value.sections[si].blocks[bi];
  if(original.languages!==undefined){fail(Array.isArray(original.languages)&&original.languages.length<=100,'Invalid source languages.');b.languages=original.languages.map(l=>{fields(l,['lang','start','end']);fail(text(l.lang,35)&&/^[a-zA-Z0-9-]+$/.test(l.lang)&&integer(l.start,0,b.text.length)&&integer(l.end,l.start+1,b.text.length),'Invalid language range.');return {...l};});}
  if(original.lineIndents!==undefined){fail(b.kind==='verse'&&Array.isArray(original.lineIndents)&&original.lineIndents.length===b.text.split('\n').length&&original.lineIndents.every(x=>integer(x,0,4)),'Invalid source line indentation.');b.lineIndents=[...original.lineIndents];}
  if(original.image!==undefined){fields(original.image,['assetId']);fail(assetIDs.has(original.image.assetId),'Missing image asset.');usedAssets.add(original.image.assetId);b.image={...original.image};}
  if(original.pages!==undefined){fail(Array.isArray(original.pages)&&original.pages.length<=200,'Invalid page boundaries.');let previous=-1;b.pages=original.pages.map(p=>{fields(p,['id','label','offset']);fail(ident(p.id)&&!pages.has(p.id)&&text(p.label,100)&&integer(p.offset,0,b.text.length)&&p.offset>=previous,'Invalid page boundary.');pages.add(p.id);previous=p.offset;return {...p};});}
  if(original.references!==undefined){fail(Array.isArray(original.references)&&original.references.length<=100,'Invalid source references.');let previous=-1;b.references=original.references.map(r=>{fields(r,['id','target','start','end']);fail(ident(r.id)&&ident(r.target)&&!refs.has(r.id)&&integer(r.start,0,b.text.length)&&integer(r.end,r.start+1,b.text.length)&&r.start>=previous,'Invalid source reference.');previous=r.end;refs.set(r.id,r);return {...r};});}
  if(original.sourceNote!==undefined){const n=original.sourceNote;fields(n,['id','refId','page']);fail(b.kind==='note'&&ident(n.id)&&ident(n.refId)&&ident(n.page)&&!notes.has(n.id),'Invalid source note.');notes.set(n.id,n);b.sourceNote={...n};}
 }
 for(const [id,n]of notes){fail(refs.get(n.refId)?.target===id&&pages.has(n.page),'Unmatched source note.');}
 for(const [id,r]of refs)fail(notes.get(r.target)?.refId===id,'Unmatched source reference.');
 fail(usedAssets.size===assets.length,'Unreferenced document asset.');
 return {...base,profile:DOCUMENT_PROFILE,assets};
}
