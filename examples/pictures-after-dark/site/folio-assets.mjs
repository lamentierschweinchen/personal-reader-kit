// A bounded local extension: complete, inert JPEG source pages travel in an exact edition.
export const FOLIO_PROFILE='pictures-after-dark/illustrated@1';
const checked=new Map();
function check(v,message){if(!v)throw Error(message);}
function digest(bytes){
 const primes=[];for(let n=2;primes.length<64;n++){if(primes.every(p=>n%p))primes.push(n);}
 const frac=x=>((x-Math.floor(x))*4294967296)>>>0;
 const k=primes.map(n=>frac(Math.cbrt(n))),h=primes.slice(0,8).map(n=>frac(Math.sqrt(n))),size=Math.ceil((bytes.length+9)/64)*64,buffer=new Uint8Array(size);buffer.set(bytes);buffer[bytes.length]=128;const view=new DataView(buffer.buffer);view.setUint32(size-4,bytes.length*8);const w=new Uint32Array(64),rot=(x,n)=>(x>>>n)|(x<<(32-n));
 for(let o=0;o<size;o+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(o+i*4);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rot(a,7)^rot(a,18)^(a>>>3))+w[i-7]+(rot(b,17)^rot(b,19)^(b>>>10)))>>>0;}let [a,b,c,d,e,f,g,j]=h;for(let i=0;i<64;i++){const t1=(j+(rot(e,6)^rot(e,11)^rot(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((rot(a,2)^rot(a,13)^rot(a,22))+((a&b)^(a&c)^(b&c)))>>>0;j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}[a,b,c,d,e,f,g,j].forEach((n,i)=>h[i]=(h[i]+n)>>>0);}
 return h.map(n=>n.toString(16).padStart(8,'0')).join('');
}
function jpegSize(bytes){check(bytes[0]===255&&bytes[1]===216,'Source page must decode as JPEG.');let i=2;while(i+9<bytes.length){check(bytes[i]===255,'Invalid JPEG marker.');while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;const len=(bytes[i]<<8)|bytes[i+1];check(len>=2&&i+len<=bytes.length,'Truncated JPEG source page.');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return {height:(bytes[i+3]<<8)|bytes[i+4],width:(bytes[i+5]<<8)|bytes[i+6]};i+=len;}throw Error('JPEG source page has no supported frame.');}
export function validateFolioAssets(value,sections){
 check(Array.isArray(value)&&value.length>0&&value.length<=16,'An illustrated folio needs 1–16 source pages.');const ids=new Set();let total=0;
 for(const asset of value){check(asset&&Object.keys(asset).sort().join('|')==='alt|credit|data|height|id|mediaType|sectionId|sha256|width','Invalid source-page fields.');check(/^[a-z][a-z0-9-]{1,80}$/.test(asset.id)&&!ids.has(asset.id),'Invalid source-page identity.');ids.add(asset.id);check(sections.some(s=>s.id===asset.sectionId),'Source page has no reading unit.');check(asset.mediaType==='image/jpeg'&&typeof asset.data==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(asset.data),'Only embedded JPEG source pages are supported.');check(/^[a-f0-9]{64}$/.test(asset.sha256),'Source-page hash is required.');check(typeof asset.alt==='string'&&asset.alt.length>0&&asset.alt.length<=1000&&typeof asset.credit==='string'&&asset.credit.length>0&&asset.credit.length<=2000,'Source page needs an accessible description and full credit.');check(Number.isInteger(asset.width)&&Number.isInteger(asset.height)&&asset.width>0&&asset.width<=5000&&asset.height>0&&asset.height<=5000,'Invalid source-page dimensions.');total+=asset.data.length;check(total<7*1024*1024,'Illustrated folio exceeds 7 MB of embedded source pages.');
  const prior=checked.get(asset.data);if(prior){check(prior.sha256===asset.sha256&&prior.width===asset.width&&prior.height===asset.height,'Source page no longer matches its hash or dimensions.');continue;}
  const bytes=Uint8Array.from(atob(asset.data.slice(23)),c=>c.charCodeAt(0));check(bytes.length<=1500000,'Source page exceeds 1.5 MB.');check(digest(bytes)===asset.sha256,'Source-page byte hash does not match.');const size=jpegSize(bytes);check(size.width===asset.width&&size.height===asset.height,'Source-page dimensions do not match the decoded JPEG.');if(checked.size>64)checked.clear();checked.set(asset.data,{sha256:asset.sha256,...size});
 }
 return structuredClone(value);
}
