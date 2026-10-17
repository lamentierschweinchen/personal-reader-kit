// Rebuild using only the files that the catalogue is allowed to send to Vercel.
import {readFile,writeFile,mkdir,mkdtemp,copyFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../',import.meta.url));
const inputs=JSON.parse(await readFile(new URL('./inputs.json',import.meta.url),'utf8'));
const fixture=await mkdtemp(path.join(tmpdir(),'newreading-inputs-'));
try{
  for(const file of inputs.files){
    assert.match(file,/^(?:showcase|examples)\/[a-zA-Z0-9/_.-]+$/);assert.ok(!file.split('/').includes('..'));
    await mkdir(path.dirname(path.join(fixture,file)),{recursive:true});await copyFile(path.join(root,file),path.join(fixture,file));
  }
  execFileSync(process.execPath,['build.mjs'],{cwd:path.join(fixture,'showcase'),stdio:'pipe',maxBuffer:2*1024*1024});
  const output=path.join(fixture,'showcase/dist');
  const expected=JSON.parse(await readFile(path.join(root,'examples/catalog.json'))).examples;
  for(const e of expected){const slug={'pride-and-prejudice':'austen','alice-in-wonderland':'alice',walden:'walden','schopenhauer-hegel':'two-halls'}[e.id];assert.ok((await readFile(path.join(output,slug,'library.json'))).equals(await readFile(path.join(root,e.directory,'dist/library.json'))));}
  assert.equal((await readdir(output)).filter(x=>['austen','alice','walden','two-halls'].includes(x)).length,4);
  const receipt={checkedAt:new Date().toISOString(),passed:true,inputFiles:inputs.files.length,exactEditions:4,scope:'A fresh build with only the exact deployment inventory; no surrounding workspace, ignored inputs or arbitrary directories.'};
  await mkdir(new URL('../test-results/showcase/',import.meta.url),{recursive:true});await writeFile(new URL('../test-results/showcase/inputs.json',import.meta.url),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt));
}finally{await rm(fixture,{recursive:true,force:true});}
