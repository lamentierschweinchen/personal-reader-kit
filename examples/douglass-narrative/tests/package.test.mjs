import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,mkdir,cp,rm,rename,symlink,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assets,editionFiles,outputFiles,verifiedEdition} from '../scripts/build.mjs';
import {newState} from '../site/core.mjs';
import {createBundle,validateBundle,canonical} from '../site/bundle.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),sha=b=>createHash('sha256').update(b).digest('hex');

test('approved four-book package preserves source assets, exact binding and complete recovery',async()=>{
  const {books,binding,library,lock}=await verifiedEdition();
  assert.equal(sha(library),lock.librarySha256);
  assert.equal(books[0].sections.length,20);assert.equal(books[0].assets.length,5);
  assert.equal(books[0].sections.flatMap(s=>s.blocks).filter(b=>b.sourceNote).length,4);
  for(const a of books[0].assets)assert.equal(sha(Buffer.from(a.data,'base64')),a.sha256);
  assert.equal(binding.references.length,3);
  for(const [i,r]of binding.references.entries())assert.equal(r.sha256,sha(canonical(books[i+1])));
  const restored=await validateBundle(await createBundle({books,state:newState()}));
  assert.deepEqual(restored.books,books);assert.deepEqual(restored.state,newState());
});

test('deployment admits only the exact build inputs in both working-directory forms',async()=>{
  const entries=(await readFile(path.join(root,'.vercelignore'),'utf8')).split('\n').filter(s=>s&&!s.startsWith('#'));
  const inputs=['package.json','vercel.json','edition-lock.json','scripts/build.mjs',...assets.map(n=>'site/'+n),...editionFiles.map(n=>'edition/'+n)];
  assert.equal(entries[0],'**');
  assert.deepEqual(entries.filter(s=>s.startsWith('!')&&!s.endsWith('/')), [...inputs.map(n=>'!'+n),...inputs.map(n=>'!examples/douglass-narrative/'+n)]);
  const inventory=JSON.parse(await readFile(path.join(root,'docs/EDITION-INVENTORY.json')));
  assert.deepEqual(inventory.buildInputs,inputs);assert.deepEqual(inventory.outputs,outputFiles);
  assert(!inputs.some(n=>n.startsWith('tests/')||n.startsWith('samples/')||n.startsWith('.reader/')));
});

test('isolated public build rejects changed pins and symlink ancestors before replacing output',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'douglass-public-package-'));
  try{
    for(const name of ['scripts','site','edition'])await cp(path.join(root,name),path.join(dir,name),{recursive:true});
    for(const name of ['package.json','vercel.json','edition-lock.json'])await cp(path.join(root,name),path.join(dir,name));
    await mkdir(path.join(dir,'.reader'));await writeFile(path.join(dir,'.reader/private.reader.json'),'PRIVATE FIXTURE');
    await writeFile(path.join(dir,'site/unreviewed.txt'),'UNKNOWN FIXTURE');
    const run=()=>spawnSync(process.execPath,['scripts/build.mjs'],{cwd:dir,encoding:'utf8'});
    let result=run();assert.equal(result.status,0,result.stderr);
    assert.deepEqual((await readdir(path.join(dir,'dist'))).sort(),[...outputFiles].sort());
    const library=await readFile(path.join(dir,'dist/library.json'));
    for(const file of ['site/app.mjs','edition/douglass-1845.json','edition/escape-editorial.json','edition/portrait.jpg']){
      const dest=path.join(dir,file),old=await readFile(dest),changed=Buffer.from(old);changed[Math.floor(changed.length/2)]^=1;await writeFile(dest,changed);
      result=run();assert.notEqual(result.status,0,file);assert.match(result.stderr,/Reviewed bytes changed/);
      assert.deepEqual(await readFile(path.join(dir,'dist/library.json')),library,'Failed validation replaced output');await writeFile(dest,old);
    }
    await rename(path.join(dir,'edition'),path.join(dir,'edition-real'));await symlink('edition-real',path.join(dir,'edition'));
    result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/without symlinks/);assert.deepEqual(await readFile(path.join(dir,'dist/library.json')),library);
    await rm(path.join(dir,'edition'));await rename(path.join(dir,'edition-real'),path.join(dir,'edition'));
    await rm(path.join(dir,'edition/portrait.jpg'));result=run();assert.notEqual(result.status,0);assert.match(result.stderr,/ENOENT/);assert.deepEqual(await readFile(path.join(dir,'dist/library.json')),library);
  }finally{await rm(dir,{recursive:true,force:true});}
});
