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
    {path:'index.html',bytes:16066,sha256:'e05049fe11ae9b1a23c88b3b1b5917eef3979c3eaf7693de59d85006bcdad342'},
    {path:'style.css',bytes:9114,sha256:'4ae4ecde18a5c444fa8eeb417a580436ce7fb33b0caadc834d6f5aa879e95419'},
    {path:'app.js',bytes:7609,sha256:'9e8f13882da46fbc4a8f5e667a1653d9ee894d2428f5ccb483cb21f71f8c74e8'},
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
