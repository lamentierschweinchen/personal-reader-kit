import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

const expected=Object.freeze([['site/apple-touch-icon.png',180],['site/icon-192.png',192],['site/icon-512.png',512]]);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyInstallArtwork(root){
  const record=JSON.parse(await readFile(path.join(root,'install-artwork.json'),'utf8'));
  if(record.schema!==1||record.source!=='site/icon.svg'||record.icons?.length!==expected.length)throw Error('Unexpected install-artwork inventory.');
  if(digest(await readFile(path.join(root,record.source)))!==record.sourceSha256)throw Error('Install artwork source changed; review its renders.');
  for(const [index,[name,size]] of expected.entries()){
    const entry=record.icons[index],file=path.join(root,name);
    if(entry.path!==name||entry.size!==size||!(await lstat(file)).isFile())throw Error('Install icon must be the named regular file.');
    const bytes=await readFile(file);
    if(bytes.length<33||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)!==size||bytes.readUInt32BE(20)!==size||digest(bytes)!==entry.sha256)throw Error('Install icon bytes or dimensions changed: '+name);
  }
  return record.icons.map(entry=>entry.path);
}
