import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from '../scripts/build.mjs';

test('The Open Boat builds the complete reviewed story and cover', async () => {
  const edition = JSON.parse(await readFile(new URL('../edition/book.json', import.meta.url)));
  const result = await build();
  assert.deepEqual(JSON.parse(await readFile(new URL('../dist/library.json', import.meta.url))), [edition]);
  assert.deepEqual(result.editionIds, ['the-open-boat']);
  assert.deepEqual(edition.sections.map(part => part.blocks.length), [20,23,16,90,23,29,39]);
  assert.equal(edition.sections[5].blocks.find(block => block.kind === 'verse').text.split('\n').length, 4);
  assert.ok(result.files.includes('cover.webp'));
  assert.equal(result.personalBooksIncluded, false);
});
