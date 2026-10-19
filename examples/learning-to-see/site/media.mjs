// Portable, non-executable raster assets. No remote URL is accepted.
export const ILLUSTRATED_PROFILE='learning-to-see/illustrated@1';
const verified=new Map();
const fail=(ok,message)=>{if(!ok)throw new Error(message);};
export function digest(bytes){
 const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],data=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);data.set(bytes);data[bytes.length]=128;
 const view=new DataView(data.buffer);view.setUint32(data.length-4,bytes.length*8);view.setUint32(data.length-8,Math.floor(bytes.length/0x20000000));const w=new Uint32Array(64),r=(n,x)=>(x>>>n)|(x<<(32-n));
 for(let offset=0;offset<data.length;offset+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(r(7,a)^r(18,a)^(a>>>3))+w[i-16]+(r(17,b)^r(19,b)^(b>>>10))+w[i-7];}let [a,b,c,d,e,f,g,j]=h;for(let i=0;i<64;i++){const t1=(j+(r(6,e)^r(11,e)^r(25,e))+((e&f)^(~e&g))+k[i]+w[i])|0,t2=((r(2,a)^r(13,a)^r(22,a))+((a&b)^(a&c)^(b&c)))|0;j=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;}[a,b,c,d,e,f,g,j].forEach((v,i)=>h[i]=(h[i]+v)|0);}
 return h.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
}
export function dimensions(bytes,type){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(type==='image/png'){fail(bytes.length>24&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x),'Invalid PNG image.');return [v.getUint32(16),v.getUint32(20)];}
 fail(bytes[0]===255&&bytes[1]===216,'Invalid JPEG image.');let i=2;
 while(i+8<bytes.length){if(bytes[i++]!==255)continue;let marker=bytes[i++];if(marker===216||marker===217)continue;const len=v.getUint16(i);fail(len>=2&&i+len<=bytes.length,'Invalid JPEG segment.');if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return [v.getUint16(i+5),v.getUint16(i+3)];i+=len;}throw new Error('JPEG has no supported dimensions.');
}
export function validateAssets(assets){
 fail(Array.isArray(assets)&&assets.length<=600,'Invalid illustrated assets.');let total=0;const ids=new Set();
 for(const a of assets){fail(a&&Object.keys(a).every(k=>['id','type','sha256','width','height','alt','credit','data'].includes(k)),'Unsupported asset field.');fail(/^[a-zA-Z0-9_-]+$/.test(a.id)&&!ids.has(a.id),'Invalid or duplicate asset identity.');ids.add(a.id);fail(['image/png','image/jpeg'].includes(a.type)&&/^[a-f0-9]{64}$/.test(a.sha256),'Invalid asset type or checksum.');fail(typeof a.data==='string'&&a.data.length<12*1024*1024&&/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.data),'Invalid raster payload.');fail(typeof a.alt==='string'&&a.alt.length<=2000&&typeof a.credit==='string'&&a.credit.length<=2000,'Missing asset description or credit.');const cached=verified.get(a.sha256);if(!cached||cached.data!==a.data||cached.width!==a.width||cached.height!==a.height||cached.type!==a.type){const bytes=Uint8Array.from(atob(a.data),c=>c.charCodeAt(0)),[width,height]=dimensions(bytes,a.type);fail(width===a.width&&height===a.height&&width>0&&height>0&&width<=12000&&height<=12000,'Image dimensions do not match.');fail(digest(bytes)===a.sha256,'Image checksum does not match; nothing was imported.');if(verified.size>600)verified.clear();verified.set(a.sha256,{data:a.data,width,height,type:a.type});}total+=a.data.length;}
 fail(total<=48*1024*1024,'Illustrated assets exceed 48 MB encoded.');return assets;
}
export const assetURL=a=>`data:${a.type};base64,${a.data}`;
