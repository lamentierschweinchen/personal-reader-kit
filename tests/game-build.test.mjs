import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
for(const id of ['alice-in-wonderland','odyssey','dracula']){
 test(id+' game build copies exact reviewed files and rejects changes, traversal and symlinks',async()=>{
  const {copyGame}=await import('../examples/'+id+'/scripts/copy-game.mjs');
  const root=await mkdtemp(path.join(tmpdir(),'reviewed-game-')),out=path.join(root,'dist'),bytes=Buffer.from('<main>Original game fixture.</main>');
  try{
   await mkdir(path.join(root,'play'));
   const entry={path:'index.html',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
   const pin=files=>writeFile(path.join(root,'game.json'),JSON.stringify({files}));
   await writeFile(path.join(root,'play/index.html'),bytes);await writeFile(path.join(root,'play/unreviewed.txt'),'Never copy me');await pin([entry]);
   assert.deepEqual(await copyGame(root,out),['play/index.html']);
   assert.deepEqual(await readdir(path.join(out,'play')),['index.html']);assert.deepEqual(await readFile(path.join(out,'play/index.html')),bytes);
   await writeFile(path.join(root,'play/index.html'),'Changed game');await assert.rejects(copyGame(root,out),/reviewed inventory/);
   await pin([{...entry,path:'../outside.html'}]);await assert.rejects(copyGame(root,out),/Unsafe/);
   await pin([entry]);await rm(path.join(root,'play/index.html'));await writeFile(path.join(root,'outside.html'),bytes);await symlink('../outside.html',path.join(root,'play/index.html'));await assert.rejects(copyGame(root,out),/regular file/);
  }finally{await rm(root,{recursive:true,force:true});}
 });
}
