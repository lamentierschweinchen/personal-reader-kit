import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
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
