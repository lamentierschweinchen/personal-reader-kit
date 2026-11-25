import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {build} from '../scripts/build.mjs';

test('the standalone release serves the complete reviewed essay and its reader', async () => {
  const result = await build();
  assert.equal(result.version, '64f83b6c6ba809f8');
  assert.equal(result.files.length, 17);
  assert.deepEqual(await readFile(new URL('../dist/library.json',import.meta.url)), await readFile(new URL('../edition/library.json',import.meta.url)));
});
