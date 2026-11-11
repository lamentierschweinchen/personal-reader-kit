// One explicit external-scan route, byte-pinned to its independently reviewed package.
import {readFile,writeFile,mkdir,lstat,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('./',import.meta.url));
export const directScan=Object.freeze({
  id:'montaigne',route:'/montaigne/',runtime:'external-scan-v1',
  files:Object.freeze([
    {path:'index.html',bytes:15272,sha256:'30387a8048aa6e97634f81aaf62eb225faa6236f7d54a92422a65d561b68719f'},
    {path:'style.css',bytes:6933,sha256:'822fbd7bc505e624db53c707d3ec7674873ee7e5fa7836abc2a48e803e292bd6'},
    {path:'app.js',bytes:1489,sha256:'e0c23713ff585c641d2cb828abfae5d11ea4bdfac4c098062ad73af9e3daf4d9'},
    {path:'assets/icon.svg',bytes:189,sha256:'333890bf4ea139d2ca3a183d03899f4e9a58f1cd7e769ad56ebffebdedff20a8'},
    {path:'assets/figure-des-brisilians.jpg',source:'assets/montaigne-1551.jpg',bytes:2051064,sha256:'034ff61f4a32e28a5d46990373a3276e60164db7a2ac318875ee8cf993172eee'}
  ])
});
const sha=data=>createHash('sha256').update(data).digest('hex');
async function inventory(dir,prefix=''){
  const result=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const relative=prefix+entry.name;
    if(entry.isDirectory())result.push(...await inventory(path.join(dir,entry.name),relative+'/'));
    else {assert.ok(entry.isFile(),'Unapproved input type: '+relative);result.push(relative);}
  }
  return result.sort();
}
export async function mountDirectScan(output){
  const source=path.join(root,'direct/montaigne'),destination=path.join(output,'montaigne');
  assert.ok((await lstat(source)).isDirectory(),'Missing direct scan package');
  assert.deepEqual(await inventory(source),directScan.files.filter(f=>!f.source).map(f=>f.path).sort(),'Direct scan inventory changed');
  try{await lstat(destination);assert.fail('Direct scan route already occupied');}catch(error){if(error.code!=='ENOENT')throw error;}
  const inputs=[];
  for(const file of directScan.files){
    const input=file.source?path.join(root,file.source):path.join(source,file.path);
    assert.ok((await lstat(input)).isFile(),'Expected regular file: '+file.path);
    const bytes=await readFile(input);
    assert.equal(bytes.length,file.bytes,'Size changed: '+file.path);
    assert.equal(sha(bytes),file.sha256,'Digest changed: '+file.path);
    inputs.push({file,bytes});
  }
  for(const {file,bytes} of inputs){const target=path.join(destination,file.path);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});}
  return {id:directScan.id,path:directScan.route,runtime:directScan.runtime,outputs:inputs.length,byteExact:true,externalScan:true,offlineScan:false,annotations:false,exactPlace:false,pageMarker:'browser-local',analytics:false,continuation:false,listed:false};
}
