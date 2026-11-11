import {mkdtemp,cp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const here=fileURLToPath(new URL('./',import.meta.url));
async function fixture(){const dir=await mkdtemp(path.join(tmpdir(),'direct-scan-'));await cp(path.join(here,'direct-scan.mjs'),path.join(dir,'direct-scan.mjs'));await mkdir(path.join(dir,'direct'),{recursive:true});await cp(path.join(here,'direct/montaigne'),path.join(dir,'direct/montaigne'),{recursive:true});await mkdir(path.join(dir,'assets'));await cp(path.join(here,'assets/montaigne-1551.jpg'),path.join(dir,'assets/montaigne-1551.jpg'));const {mountDirectScan,directScan}=await import(pathToFileURL(path.join(dir,'direct-scan.mjs')));return {dir,mountDirectScan,directScan};}
for(const scenario of ['valid','changed','changed-art','extra','symlink','occupied']){
 const f=await fixture(),out=path.join(f.dir,'output');try{
  await mkdir(out);
  if(scenario==='changed')await writeFile(path.join(f.dir,'direct/montaigne/app.js'),'changed');
  if(scenario==='changed-art')await writeFile(path.join(f.dir,'assets/montaigne-1551.jpg'),'changed');
  if(scenario==='extra')await writeFile(path.join(f.dir,'direct/montaigne/extra.txt'),'extra');
  if(scenario==='symlink')await symlink('app.js',path.join(f.dir,'direct/montaigne/link.js'));
  if(scenario==='occupied')await mkdir(path.join(out,'montaigne'));
  if(scenario==='valid'){
   const receipt=await f.mountDirectScan(out);
   assert.equal(receipt.byteExact,true);assert.equal(receipt.externalScan,true);assert.equal(receipt.offlineScan,false);assert.equal(receipt.continuation,false);assert.equal(receipt.analytics,false);assert.equal(receipt.listed,false);
   for(const item of f.directScan.files)assert.deepEqual(await readFile(path.join(out,'montaigne',item.path)),await readFile(item.source?path.join(f.dir,item.source):path.join(f.dir,'direct/montaigne',item.path)));
  }else await assert.rejects(f.mountDirectScan(out));
  console.log(scenario+' passed');
 }finally{await rm(f.dir,{recursive:true,force:true});}
}
