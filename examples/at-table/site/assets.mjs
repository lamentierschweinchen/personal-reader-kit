// Synchronous decoded-byte integrity guard for embedded, portable source JPEGs.
export function digest(bytes) {
 const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
 const data=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);data.set(bytes);data[bytes.length]=128;new DataView(data.buffer).setUint32(data.length-4,bytes.length*8);const r=(v,n)=>(v>>>n)|(v<<(32-n));
 for(let o=0;o<data.length;o+=64){const w=new Uint32Array(64),view=new DataView(data.buffer,o,64);for(let i=0;i<16;i++)w[i]=view.getUint32(i*4);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(r(a,7)^r(a,18)^(a>>>3))+w[i-7]+(r(b,17)^r(b,19)^(b>>>10)))>>>0;}let [a,b,c,d,e,f,g,z]=h;for(let i=0;i<64;i++){const t=(z+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,u=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))>>>0;z=g;g=f;f=e;e=(d+t)>>>0;d=c;c=b;b=a;a=(t+u)>>>0;}h=h.map((v,i)=>(v+[a,b,c,d,e,f,g,z][i])>>>0);}
 return h.map(v=>v.toString(16).padStart(8,'0')).join('');
}
const verified=new Map();
export function validateAsset(a) {
 if(!a||Object.keys(a).sort().join('|')!=='alt|data|height|sha256|width'||typeof a.alt!=='string'||a.alt.length>1000||!Number.isInteger(a.width)||!Number.isInteger(a.height)||a.width<1||a.height<1||a.width*a.height>16000000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(a.data)||a.data.length>3000000)throw new Error('Unsupported or missing source image.');
 const identity=JSON.stringify([a.sha256,a.width,a.height]);
 if(verified.get(a.data)!==identity){const b=Uint8Array.from(atob(a.data.split(',')[1]),c=>c.charCodeAt(0));if(b[0]!==255||b[1]!==216||b.at(-2)!==255||b.at(-1)!==217||digest(b)!==a.sha256)throw new Error('Source image integrity mismatch.');let dims=null;for(let i=2;i<b.length-9;){if(b[i]!==255){i++;continue;}const m=b[i+1],len=(b[i+2]<<8)|b[i+3];if([192,193,194].includes(m)){dims={height:(b[i+5]<<8)|b[i+6],width:(b[i+7]<<8)|b[i+8]};break;}if(len<2)break;i+=2+len;}if(!dims||dims.width!==a.width||dims.height!==a.height)throw new Error('Source image dimensions mismatch.');verified.set(a.data,identity);}
 return {...a};
}
