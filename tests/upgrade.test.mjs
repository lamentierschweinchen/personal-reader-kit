import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {compareUpgrade} from '../scripts/check-upgrade.mjs';

test('upgrade compares three public snapshots without overwriting customization or reading private extras',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'reader-upgrade-')),dirs=Object.fromEntries(['base','current','target'].map(k=>[k,path.join(root,k)]));
  try {
    for(const dir of Object.values(dirs))await mkdir(dir);
    const versions={base:{'app.mjs':'old','style.css':'old','retired.md':'old','same.md':'same'},current:{'app.mjs':'old','style.css':'personal','retired.md':'old','same.md':'same','private.txt':'PRIVATE ORIGINAL SENTINEL'},target:{'app.mjs':'new','style.css':'new','same.md':'same','new.mjs':'new'}};
    for(const [key,files] of Object.entries(versions)) {
      await writeFile(path.join(dirs[key],'publication.json'),JSON.stringify({files:['publication.json',...Object.keys(files).filter(x=>x!=='private.txt')]}));
      for(const [name,bytes] of Object.entries(files))await writeFile(path.join(dirs[key],name),bytes);
    }
    const report=await compareUpgrade(dirs),get=name=>report.files.find(f=>f.path===name);
    assert.equal(get('app.mjs').status,'upstream-only');assert.equal(get('style.css').status,'review-conflict');assert.equal(get('new.mjs').operation,'add');assert.equal(get('retired.md').operation,'remove');assert.equal(get('same.md').status,'already-current');
    assert.doesNotMatch(JSON.stringify(report),/PRIVATE|private.txt|personal/);assert.equal(await readFile(path.join(dirs.current,'style.css'),'utf8'),'personal');assert.equal(await readFile(path.join(dirs.current,'retired.md'),'utf8'),'old');
    await writeFile(path.join(dirs.target,'style.css'),'old');assert.equal((await compareUpgrade(dirs)).files.find(f=>f.path==='style.css').status,'keep-local');
    const targetManifest=JSON.parse(await readFile(path.join(dirs.target,'publication.json'),'utf8'));
    targetManifest.starterFiles=[...targetManifest.files];targetManifest.files.push('examples/original/edition/library.json');
    await writeFile(path.join(dirs.target,'publication.json'),JSON.stringify(targetManifest));
    assert.equal((await compareUpgrade(dirs)).files.some(f=>f.path.startsWith('examples/')),false);
    await rm(path.join(dirs.current,'app.mjs'));await symlink(path.join(dirs.current,'private.txt'),path.join(dirs.current,'app.mjs'));await assert.rejects(()=>compareUpgrade(dirs),/Symlink/);
    await writeFile(path.join(dirs.target,'publication.json'),JSON.stringify({files:['../private.txt']}));await assert.rejects(()=>compareUpgrade(dirs),/Unsafe/);
  }finally{await rm(root,{recursive:true,force:true});}
});
