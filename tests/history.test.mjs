import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {audit} from '../scripts/audit.mjs';
test('public audit finds removed private files and credentials in reachable history',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'reader-history-test-'));
  const git=(...args)=>execFileSync('git',['-C',directory,...args],{stdio:'pipe'});
  try {
    git('init','-b','test');git('config','user.name','Reader test');git('config','user.email','reader-test@example.invalid');
    await mkdir(path.join(directory,'samples'));await mkdir(path.join(directory,'private'));
    const sample='[]\n';await writeFile(path.join(directory,'samples/library.json'),sample);
    await writeFile(path.join(directory,'.gitignore'),'.reader/\n');
    await writeFile(path.join(directory,'README.md'),'Original test fixture\n');
    await writeFile(path.join(directory,'private','old.txt'),'ghp_'+'A'.repeat(36));
    const manifest={originalSampleSha256:createHash('sha256').update(sample).digest('hex'),files:['.gitignore','README.md','publication.json','samples/library.json']};
    await writeFile(path.join(directory,'publication.json'),JSON.stringify(manifest));
    git('add','.gitignore','README.md','publication.json','samples/library.json','private/old.txt');git('commit','-m','Synthetic history fixture');
    await rm(path.join(directory,'private'),{recursive:true});git('add','-u');git('commit','-m','Remove synthetic private file');
    const report=await audit(directory);assert.equal(report.passed,false);assert.equal(report.reachableCommits,2);
    assert.ok(report.failures.some(x=>x.includes('(history')&&x.includes('private/book')));
    assert.ok(report.failures.some(x=>x.includes('(history')&&x.includes('credential')));
    // A clean tree does not make credentials in messages or annotated tags safe.
    const fake='ghp_'+'B'.repeat(36);
    git('commit','--allow-empty','-m',fake);git('tag','-a','metadata-fixture','-m',fake);
    const metadata=await audit(directory);
    assert.ok(metadata.failures.some(x=>x.includes('commit metadata')&&x.includes('credential')));
    assert.ok(metadata.failures.some(x=>x.includes('tag metadata')&&x.includes('credential')));
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('audit rejects a shallow view and permits only pinned retired public content',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'reader-complete-history-')),clone=directory+'-shallow';
  const git=(...args)=>execFileSync('git',['-C',directory,...args],{stdio:'pipe'}),digest=text=>createHash('sha256').update(text).digest('hex');
  try {
    git('init','-b','test');git('config','user.name','Reader test');git('config','user.email','reader-test@example.invalid');
    await mkdir(path.join(directory,'samples'));await writeFile(path.join(directory,'samples/library.json'),'[]\n');await writeFile(path.join(directory,'.gitignore'),'.reader/\n');
    const retired='An original retired public page.\n';await writeFile(path.join(directory,'retired.md'),retired);
    const manifest={originalSampleSha256:digest('[]\n'),files:['.gitignore','publication.json','samples/library.json','retired.md']};
    await writeFile(path.join(directory,'publication.json'),JSON.stringify(manifest));git('add','.');git('commit','-m','Original fixture');
    await rm(path.join(directory,'retired.md'));manifest.files.pop();await writeFile(path.join(directory,'publication.json'),JSON.stringify(manifest));git('add','-u');git('commit','-m','Retire public page');
    assert.equal((await audit(directory)).passed,false);
    manifest.reviewedHistoricalFiles=[{path:'retired.md',sha256:digest(retired),reason:'Reviewed original fixture retired during maintenance.'}];
    await writeFile(path.join(directory,'publication.json'),JSON.stringify(manifest));git('add','publication.json');git('commit','-m','Record reviewed retired bytes');
    const report=await audit(directory);assert.equal(report.passed,true,report.failures.join('\n'));assert.equal(report.scope.shallow,false);assert.equal(report.scope.revision,git('rev-parse','HEAD').toString().trim());
    execFileSync('git',['clone','--depth','1','file://'+directory,clone],{stdio:'pipe'});
    const shallow=await audit(clone);assert.equal(shallow.passed,false);assert.ok(shallow.failures.some(f=>f.includes('shallow')));
    git('update-ref','refs/snapshots/public',git('rev-parse','HEAD^{tree}').toString().trim());
    assert.equal((await audit(directory)).passed,true);
    const blob=execFileSync('git',['-C',directory,'hash-object','-w','--stdin'],{input:'Original unreviewed snapshot fixture',encoding:'utf8'}).trim();
    const tree=execFileSync('git',['-C',directory,'mktree'],{input:`100644 blob ${blob}\tunreviewed.txt\n`,encoding:'utf8'}).trim();
    git('update-ref','refs/snapshots/unreviewed',tree);
    assert.ok((await audit(directory)).failures.some(f=>f.includes('unreviewed.txt (history')));
    git('update-ref','-d','refs/snapshots/unreviewed');
    manifest.reviewedHistoricalFiles[0].sha256=digest('Different bytes');await writeFile(path.join(directory,'publication.json'),JSON.stringify(manifest));git('add','publication.json');
    assert.ok((await audit(directory)).failures.some(f=>f.includes('retired.md (history')));
    // Broken Git inspection is an error, never a successful empty-history receipt.
    await writeFile(path.join(directory,'.git/refs/heads/broken'),'1'.repeat(40)+'\n');
    await assert.rejects(()=>audit(directory));
    assert.equal(JSON.parse(await readFile(path.join(directory,'.reader/publication-review.json'),'utf8')).passed,false);
  }finally{await rm(directory,{recursive:true,force:true});await rm(clone,{recursive:true,force:true});}
});

test('example provenance admits only exact reviewed bytes in current files and complete history',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'reader-edition-history-'));
  const git=(...args)=>execFileSync('git',['-C',directory,...args],{stdio:'pipe'}),digest=b=>createHash('sha256').update(b).digest('hex');
  const asset='examples/original/edition/diagram.png',provenance='examples/original/RIGHTS.md';
  try {
    git('init','-b','test');git('config','user.name','Reader test');git('config','user.email','reader-test@example.invalid');
    await mkdir(path.join(directory,'samples'));await mkdir(path.join(directory,'examples/original/edition'),{recursive:true});
    await writeFile(path.join(directory,'samples/library.json'),'[]\n');await writeFile(path.join(directory,'.gitignore'),'.reader/\n');
    await writeFile(path.join(directory,provenance),'Synthetic original fixture bytes, created for this regression.\n');
    const bytes=Buffer.from([137,80,78,71,0,1]),manifest={originalSampleSha256:digest('[]\n'),files:['.gitignore','publication.json','samples/library.json',asset,provenance],reviewedEditionFiles:[{path:asset,sha256:digest(bytes),provenance,reason:'Reviewed original synthetic binary.'}]};
    await writeFile(path.join(directory,asset),bytes);await writeFile(path.join(directory,'publication.json'),JSON.stringify(manifest));git('add','.');git('commit','-m','Original source fixture');
    assert.equal((await audit(directory)).passed,true);
    const changed=Buffer.from([137,80,78,71,0,2]);await writeFile(path.join(directory,asset),changed);git('add',asset);
    assert.ok((await audit(directory)).failures.some(f=>f.includes('working')&&f.includes('edition bytes')));
    manifest.reviewedEditionFiles[0].sha256=digest(changed);await writeFile(path.join(directory,'publication.json'),JSON.stringify(manifest));git('add','publication.json');git('commit','-m','New synthetic source fixture');
    assert.ok((await audit(directory)).failures.some(f=>f.includes('(history')&&f.includes('edition bytes')));
    // An exact binary exception cannot conceal recognized credentials.
    const secret=Buffer.concat([bytes,Buffer.from('ghp_'+'C'.repeat(36))]);manifest.reviewedEditionFiles[0].sha256=digest(secret);
    await writeFile(path.join(directory,asset),secret);await writeFile(path.join(directory,'publication.json'),JSON.stringify(manifest));git('add',asset,'publication.json');
    assert.ok((await audit(directory)).failures.some(f=>f.includes('(working)')&&f.includes('credential')));
    manifest.reviewedEditionFiles[0].path='private/diagram.png';await writeFile(path.join(directory,'publication.json'),JSON.stringify(manifest));
    await assert.rejects(()=>audit(directory),/Edition review/);
  }finally{await rm(directory,{recursive:true,force:true});}
});

for(const format of ['webp','jpg'])test(`showcase ${format} provenance is exact, historical and never conceals credentials`,async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'reader-showcase-history-'));
  const git=(...args)=>execFileSync('git',['-C',directory,...args],{stdio:'pipe'}),digest=b=>createHash('sha256').update(b).digest('hex');
  const asset=`showcase/assets/original.${format}`,provenance='showcase/ASSETS.md';
  try {
    git('init','-b','test');git('config','user.name','Reader test');git('config','user.email','reader-test@example.invalid');
    await mkdir(path.join(directory,'samples'));await mkdir(path.join(directory,'showcase/assets'),{recursive:true});
    await writeFile(path.join(directory,'samples/library.json'),'[]\n');await writeFile(path.join(directory,'.gitignore'),'.reader/\n');
    await writeFile(path.join(directory,provenance),'Original synthetic fixture; not an actual image.\n');
    const bytes=Buffer.from([82,73,70,70,0,1]),entry={path:asset,sha256:digest(bytes),provenance,reason:'Original binary fixture.'};
    const manifest={originalSampleSha256:digest('[]\n'),files:['.gitignore','publication.json','samples/library.json',asset,provenance],reviewedSiteAssets:[entry]};
    await writeFile(path.join(directory,asset),bytes);await writeFile(path.join(directory,'publication.json'),JSON.stringify(manifest));git('add','.');git('commit','-m','Original showcase fixture');
    assert.equal((await audit(directory)).passed,true);
    const changed=Buffer.from([82,73,70,70,0,2]);await writeFile(path.join(directory,asset),changed);git('add',asset);
    assert.ok((await audit(directory)).failures.some(f=>f.includes('(working)')&&f.includes('showcase asset')));
    entry.sha256=digest(changed);await writeFile(path.join(directory,'publication.json'),JSON.stringify(manifest));git('add','publication.json');git('commit','-m','Changed synthetic fixture');
    assert.ok((await audit(directory)).failures.some(f=>f.includes('(history')&&f.includes('showcase asset')));
    const secret=Buffer.concat([changed,Buffer.from('ghp_'+'D'.repeat(36))]);entry.sha256=digest(secret);
    await writeFile(path.join(directory,asset),secret);await writeFile(path.join(directory,'publication.json'),JSON.stringify(manifest));git('add',asset,'publication.json');
    assert.ok((await audit(directory)).failures.some(f=>f.includes('(working)')&&f.includes('credential')));
    entry.path='private/original.webp';await writeFile(path.join(directory,'publication.json'),JSON.stringify(manifest));
    await assert.rejects(()=>audit(directory),/Showcase asset review/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
