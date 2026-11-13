import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {validateBook} from '../site/core.mjs';

test('the reviewed First Series preserves the complete volume and its reuse notice', async () => {
  const bytes=await readFile(new URL('../edition/book.json',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'5bed521ddbf606c8cadd8509851099150d4bfe966c22173b4c0ea22e009285a8');
  const book=JSON.parse(bytes);
  assert.deepEqual(validateBook(book),book);
  assert.deepEqual(book.sections.slice(0,3).map(section=>section.id),['title-page','preface','prelude']);
  assert.equal(book.sections.filter(section=>section.id.startsWith('poem-')).length,115);
  assert.equal(book.sections.at(-1).id,'poem-115');
  assert.ok(book.context.some(entry=>entry.url==='https://creativecommons.org/licenses/by-sa/4.0/'));
});
