import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Authored chrome only: never apply this rule to books, quotations or reader notes.
const arrows=/[\u2190-\u21ff\u2794\u2798-\u27af\u27b1-\u27be\u27f0-\u27ff\u2900-\u297f\u2b00-\u2b11\u2b30-\u2b4f\u2b5a-\u2b73\u2b76-\u2b7d\u2b80-\u2b8f\u2b94-\u2b95\u2b98-\u2bb9\u2bec-\u2bef\u{1f800}-\u{1f8ff}]/u;
const decoded=s=>s.replace(/\\u\{([\da-f]+)\}|\\u([\da-f]{4})|&#x([\da-f]+);|&#(\d+);/gi,(_,a,b,c,d)=>String.fromCodePoint(parseInt(a||b||c||d,d?10:16)));
test('authored UI uses paths instead of Unicode arrow icons',async()=>{
  for(const file of ['site/app.mjs','site/index.html','site/style.css','site/broadside.css']) {
    assert.doesNotMatch(decoded(await readFile(new URL('../'+file,import.meta.url),'utf8')),arrows,`${file}: use the shared SVG arrow, or omit a redundant icon; leave source books unchanged`);
  }
  for(const text of ['↗','→\uFE0E','➡️','\\u2197','&#x2197;','&#8599;'])assert.match(decoded(text),arrows);
});
