// Bounded, self-contained raster profile. The text profile remains unchanged.
export const ILLUSTRATED_PROFILE='mountains/illustrated@1';
export const EDITION_FILE_LIMIT=48*1024*1024;
const checked=new Map();
const hex=bytes=>[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
// Synchronous SHA-256 keeps every validation boundary (including IndexedDB and
// portable bundle restoration) responsible for the decoded image bytes.
export function digest(bytes) {
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const size=Math.ceil((bytes.length+9)/64)*64,b=new Uint8Array(size);b.set(bytes);b[bytes.length]=128;
  const v=new DataView(b.buffer);v.setUint32(size-8,Math.floor(bytes.length/0x20000000));v.setUint32(size-4,(bytes.length*8)>>>0);
  const h=new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]),w=new Uint32Array(64),r=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let n=0;n<size;n+=64){
    for(let i=0;i<16;i++)w[i]=v.getUint32(n+i*4);
    for(let i=16;i<64;i++){const a=w[i-15],z=w[i-2];w[i]=(w[i-16]+(r(a,7)^r(a,18)^(a>>>3))+w[i-7]+(r(z,17)^r(z,19)^(z>>>10)))>>>0;}
    let [a,c,d,e,f,g,j,k]=h;
    for(let i=0;i<64;i++){const t=(k+(r(f,6)^r(f,11)^r(f,25))+((f&g)^(~f&j))+K[i]+w[i])>>>0,u=((r(a,2)^r(a,13)^r(a,22))+((a&c)^(a&d)^(c&d)))>>>0;k=j;j=g;g=f;f=(e+t)>>>0;e=d;d=c;c=a;a=(t+u)>>>0;}
    [a,c,d,e,f,g,j,k].forEach((q,i)=>h[i]=(h[i]+q)>>>0);
  }
  const out=new Uint8Array(32),o=new DataView(out.buffer);h.forEach((q,i)=>o.setUint32(i*4,q));return hex(out);
}
function require(v,m){if(!v)throw new Error(m);}
function jpegSize(b) {
  require(b[0]===255&&b[1]===216,'A plate is not a JPEG image.');
  let p=2;
  while(p+4<b.length){require(b[p]===255,'Invalid JPEG marker.');while(b[p]===255)p++;const code=b[p++];if(code===217||code===218)break;if(code===1||(code>=208&&code<=215))continue;
    const length=(b[p]<<8)|b[p+1];require(length>=2&&p+length<=b.length,'Invalid JPEG segment.');
    if([192,193,194].includes(code))return {width:(b[p+5]<<8)|b[p+6],height:(b[p+3]<<8)|b[p+4]};p+=length;
  }
  throw new Error('A plate has no supported JPEG dimensions.');
}
export function validatePlates(plates) {
  require(Array.isArray(plates)&&plates.length>0&&plates.length<=120,'An illustrated edition needs 1–120 plates.');
  require(new Set(plates.map(p=>p.id)).size===plates.length,'Duplicate plate IDs.');let total=0;
  return plates.map(p=>{
    require(p&&typeof p==='object'&&Object.keys(p).every(k=>['id','data','sha256','width','height','alt','credit','sourceUrl','sourcePage'].includes(k)),'Unsupported plate field.');
    require(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(p.id)&&!['__proto__','constructor','prototype'].includes(p.id),'Invalid plate ID.');
    for(const key of ['alt','credit','sourcePage'])require(typeof p[key]==='string'&&p[key].length>0&&p[key].length<=2000,'Plate description and credit are required.');
    require(typeof p.sourceUrl==='string'&&/^https:\/\//.test(p.sourceUrl)&&p.sourceUrl.length<=2000,'A plate needs an HTTPS provenance link.');
    require(/^[a-f0-9]{64}$/.test(p.sha256)&&Number.isInteger(p.width)&&Number.isInteger(p.height)&&p.width>0&&p.height>0&&p.width<=5000&&p.height<=5000,'Invalid plate identity or dimensions.');
    require(typeof p.data==='string'&&p.data.length<=2*1024*1024&&p.data.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(p.data),'A plate needs a bounded base64 JPEG payload.');
    total+=p.data.length;require(total<=44*1024*1024,'Illustration payloads exceed 44 MB.');
    const key=p.sha256+':'+p.width+':'+p.height;
    if(checked.get(key)!==p.data){
      const bytes=Uint8Array.from(atob(p.data),c=>c.charCodeAt(0)),size=jpegSize(bytes);
      require(size.width===p.width&&size.height===p.height,'Decoded plate dimensions do not match.');
      require(digest(bytes)===p.sha256,'Decoded plate fingerprint does not match. Nothing was imported.');
      if(checked.size>240)checked.clear();checked.set(key,p.data);
    }
    return {...p};
  });
}
export const plateURL=plate=>`data:image/jpeg;base64,${plate.data}`;
