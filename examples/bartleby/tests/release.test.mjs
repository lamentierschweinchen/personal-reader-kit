import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from '../scripts/build.mjs';

const input = new URL('../edition/book.json', import.meta.url);
const library = new URL('../dist/library.json', import.meta.url);
test('Bartleby builds the complete reviewed story', async () => {
  const edition = JSON.parse(await readFile(input));
  const result = await build();
  assert.deepEqual(JSON.parse(await readFile(library)), [edition]);
  assert.deepEqual(result.editionIds, ['bartleby-1856-gutenberg-15859']);
  assert.equal(edition.sections.length, 1);
  assert.equal(edition.sections[0].blocks.length, 253);
  assert.equal(result.personalBooksIncluded, false);
});
