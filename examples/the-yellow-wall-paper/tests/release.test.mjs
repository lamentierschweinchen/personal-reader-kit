import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from '../scripts/build.mjs';

test('builds the complete illustrated Gilman edition and companion', async () => {
  const load=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
  const edition=JSON.parse(await load('edition/book.json'));
  const built=await build();
  assert.deepEqual(JSON.parse(await load('dist/library.json')),[edition]);
  assert.deepEqual(built.editionIds,['yellow-wall-paper-1892']);
  assert.equal(edition.sections[0].blocks.length,278);
  assert.equal(edition.media.figures.length,3);
  assert.equal(edition.media.pages.length,10);
  assert.equal(edition.media.account.paragraphs.length,10);
  assert.equal(edition.media.license.text,await load('dist/cc-by-sa-4.0.txt'));
  for(const name of ['the-paper-on-the-wall.html','wallpaper-marigold.jpg','wallpaper-pink-and-rose.jpg'])
    assert.ok((await load('dist/sw.js')).includes('/'+name),name);
});
