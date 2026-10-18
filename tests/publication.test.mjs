import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdir,rm,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {inspectFile} from '../scripts/audit.mjs';
import {build,assets} from '../scripts/build.mjs';
test('publication scanner rejects unknown/private paths and recognizable credentials',()=>{
  assert.deepEqual(inspectFile('README.md',Buffer.from('Hello'),['README.md']),[]);
  assert.match(inspectFile('source/book.epub',Buffer.from('text'),[]).join(' '),/private/);
  const secret='ghp_'+'A'.repeat(36);assert.match(inspectFile('site/app.mjs',Buffer.from(secret),['site/app.mjs']).join(' '),/credential/);
  assert.match(inspectFile('test-results/screen.png',Buffer.from([1,0,1]),[]).join(' '),/binary/);
});
test('public build excludes private input and arbitrary site files',async()=>{
  await mkdir(new URL('../.reader/private/',import.meta.url),{recursive:true});
  const privateFile=new URL('../.reader/private/build-test-sentinel.txt',import.meta.url),extra=new URL('../site/build-test-sentinel.txt',import.meta.url);
  await writeFile(privateFile,'PRIVATE TEST SENTINEL');await writeFile(extra,'PRIVATE TEST SENTINEL');
  const output=await mkdtemp(path.join(tmpdir(),'reader-publication-build-'));
  const previewSentinel=new URL('../dist/publication-preview-sentinel.txt',import.meta.url);
  await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
  await writeFile(previewSentinel,'The running preview must not be replaced by this test.');
  try {
    const result=await build({output});assert.equal(result.personalBooksIncluded,false);
    const files=(await readdir(output)).sort();assert.deepEqual(files,[...assets,'library.json','sw.js'].sort());
    for(const name of files)assert.doesNotMatch(await readFile(path.join(output,name),'utf8'),/PRIVATE TEST SENTINEL/);
    assert.equal(await readFile(previewSentinel,'utf8'),'The running preview must not be replaced by this test.');
  } finally {await rm(privateFile);await rm(extra);await rm(previewSentinel,{force:true});await rm(output,{recursive:true,force:true});}
});
test('Vercel upload exceptions name only the reviewed build inputs',async()=>{
  const rules=(await readFile(new URL('../.vercelignore',import.meta.url),'utf8')).trim().split('\n');
  const included=rules.filter(x=>x.startsWith('!')&&!x.endsWith('/')).map(x=>x.slice(1));
  assert.equal(rules[0],'**');
  assert.deepEqual(included.sort(),['package.json','vercel.json','publication.json','scripts/build.mjs','samples/library.json',...assets.map(x=>'site/'+x)].sort());
});
