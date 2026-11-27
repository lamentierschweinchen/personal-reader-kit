import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {build} from '../scripts/build.mjs';

test('build preserves the complete reviewed edition and the scoped reader files', async () => {
  const result = await build();
  assert.equal(result.files.length,21);
  const read = name => readFile(new URL('../'+name,import.meta.url));
  for (const name of ['edition.json','market-detail.webp','frontispiece.webp','title-page.webp']) {
    assert.deepEqual(await read('dist/'+name),await read('edition/'+name));
  }
  const html = await read('dist/index.html');
  assert.match(String(html),/data-after="line-140"/);
  assert.match(String(html),/data-after="line-198"/);
  assert.match(String(await read('dist/db.mjs')),/newreading-goblin-market-v1/);
  assert.equal(JSON.parse(await read('dist/manifest.webmanifest')).scope,'/');
});
