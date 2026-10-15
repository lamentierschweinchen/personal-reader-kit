import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdir,rm} from 'node:fs/promises';
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
  try {
    const result=await build();assert.equal(result.personalBooksIncluded,false);
    const output=(await readdir(new URL('../dist/',import.meta.url))).sort();assert.deepEqual(output,[...assets,'library.json','sw.js'].sort());
    for(const name of output)assert.doesNotMatch(await readFile(new URL('../dist/'+name,import.meta.url),'utf8'),/PRIVATE TEST SENTINEL/);
  } finally {await rm(privateFile);await rm(extra);}
});
