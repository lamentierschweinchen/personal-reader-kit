// A deliberately narrow, stored ZIP wrapper for exact JSON and the full
// Gutenberg license. It is not an EPUB or general-purpose ZIP reader.
const encoder=new TextEncoder();
const decoder=new TextDecoder('utf-8',{fatal:true});
const NAMES=['payload.json','gutenberg-license.txt'];
const LICENSE_SHA256='da8d6d2c45e626a269f39ead63d8ed308538a4d884904296f0e8fc18b31e046a';
const MAX_PAYLOAD=64*1024*1024,MAX_LICENSE=128*1024,MAX_ARCHIVE=65*1024*1024;
const check=(ok,message='Invalid licensed reader archive.')=>{if(!ok)throw new Error(message);};
const bytes=value=>{check(value instanceof Uint8Array,'Expected archive bytes.');return value;};
const digest=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),x=>x.toString(16).padStart(2,'0')).join('');
const table=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;});
function crc32(data){let c=0xffffffff;for(const b of data)c=(c>>>8)^table[(c^b)&255];return (c^0xffffffff)>>>0;}
function validSizes(payload,license){check(payload.length>0&&payload.length<=MAX_PAYLOAD,'Reader JSON exceeds the archive limit.');check(license.length>0&&license.length<=MAX_LICENSE,'Invalid Gutenberg license.');}
async function validateLicense(data){check(await digest(data)===LICENSE_SHA256,'The archive does not contain the exact Gutenberg license.');}

// Produces a canonical two-entry archive, preserving both byte sequences.
export async function packLicensedZip(payloadBytes,licenseBytes){
  const payload=bytes(payloadBytes),license=bytes(licenseBytes);validSizes(payload,license);await validateLicense(license);
  const entries=[payload,license].map((data,i)=>({name:encoder.encode(NAMES[i]),data,crc:crc32(data)}));
  const localSize=entries.reduce((n,e)=>n+30+e.name.length+e.data.length,0);
  const centralSize=entries.reduce((n,e)=>n+46+e.name.length,0),total=localSize+centralSize+22;
  check(total<=MAX_ARCHIVE,'Reader archive exceeds the size limit.');
  const out=new Uint8Array(total),v=new DataView(out.buffer);let p=0;
  for(const e of entries){e.offset=p;v.setUint32(p,0x04034b50,true);v.setUint16(p+4,20,true);v.setUint16(p+6,0x0800,true);v.setUint16(p+8,0,true);v.setUint32(p+14,e.crc,true);v.setUint32(p+18,e.data.length,true);v.setUint32(p+22,e.data.length,true);v.setUint16(p+26,e.name.length,true);out.set(e.name,p+30);out.set(e.data,p+30+e.name.length);p+=30+e.name.length+e.data.length;}
  const centralStart=p;
  for(const e of entries){v.setUint32(p,0x02014b50,true);v.setUint16(p+4,20,true);v.setUint16(p+6,20,true);v.setUint16(p+8,0x0800,true);v.setUint16(p+10,0,true);v.setUint32(p+16,e.crc,true);v.setUint32(p+20,e.data.length,true);v.setUint32(p+24,e.data.length,true);v.setUint16(p+28,e.name.length,true);v.setUint32(p+42,e.offset,true);out.set(e.name,p+46);p+=46+e.name.length;}
  v.setUint32(p,0x06054b50,true);v.setUint16(p+8,2,true);v.setUint16(p+10,2,true);v.setUint32(p+12,centralSize,true);v.setUint32(p+16,centralStart,true);
  return out;
}

// Accept only the exact structure written above: no compressed entries, data
// descriptors, extras, paths, duplicates, ZIP64, archive comments or trailers.
// Bounds and every local/central field are checked before slicing data.
export async function unpackLicensedZip(input){
  const data=bytes(input);check(data.length>=22&&data.length<=MAX_ARCHIVE,'Reader archive exceeds the size limit.');
  const v=new DataView(data.buffer,data.byteOffset,data.byteLength),end=data.length-22;
  const u16=o=>{check(o>=0&&o+2<=data.length);return v.getUint16(o,true);};
  const u32=o=>{check(o>=0&&o+4<=data.length);return v.getUint32(o,true);};
  check(u32(end)===0x06054b50&&u16(end+4)===0&&u16(end+6)===0&&u16(end+8)===2&&u16(end+10)===2&&u16(end+20)===0);
  const center=u32(end+16),centerSize=u32(end+12);check(center+centerSize===end&&center<end);
  let c=center,expectedLocal=0;const entries=[];
  for(const expected of NAMES){
    check(c+46<=end&&u32(c)===0x02014b50&&u16(c+4)===20&&u16(c+6)===20&&u16(c+8)===0x0800&&u16(c+10)===0&&u16(c+12)===0&&u16(c+14)===0);
    const crc=u32(c+16),size=u32(c+20),plain=u32(c+24),nameLen=u16(c+28),offset=u32(c+42);
    check(size===plain&&nameLen===encoder.encode(expected).length&&u16(c+30)===0&&u16(c+32)===0&&u16(c+34)===0&&u16(c+36)===0&&u32(c+38)===0&&offset===expectedLocal&&c+46+nameLen<=end);
    check(decoder.decode(data.subarray(c+46,c+46+nameLen))===expected);
    check(offset+30<=center&&u32(offset)===0x04034b50&&u16(offset+4)===20&&u16(offset+6)===0x0800&&u16(offset+8)===0&&u16(offset+10)===0&&u16(offset+12)===0&&u32(offset+14)===crc&&u32(offset+18)===size&&u32(offset+22)===size&&u16(offset+26)===nameLen&&u16(offset+28)===0);
    const start=offset+30+nameLen,finish=start+size;check(finish<=center&&decoder.decode(data.subarray(offset+30,start))===expected);
    const body=data.subarray(start,finish);check(crc32(body)===crc,'Archive checksum does not match.');entries.push(body);expectedLocal=finish;c+=46+nameLen;
  }
  check(c===end&&expectedLocal===center);validSizes(entries[0],entries[1]);await validateLicense(entries[1]);
  return entries[0].slice();
}
