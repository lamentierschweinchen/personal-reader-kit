import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
const read=async file=>JSON.parse(await readFile(new URL(file,import.meta.url),'utf8'));
test('the public edition retains all ten acts and its source apparatus',async()=>{const b=await read('../edition/book.json');assert.equal(b.id,'clay-cart-ryder-1905');assert.equal(b.sourceNotes.length,88);assert.ok(b.context.some(c=>c.text?.includes('PROJECT GUTENBERG')));assert.ok(b.sections.length>=10);});
test('scholarship remains selectable, attributed and locally navigable',async()=>{for(const id of ['sen','austin']){const a=await read('../edition/scholar-'+id+'-reader.json');assert.equal(a.id,id);assert.equal(a.schema,'scholar-reader@1');assert.doesNotMatch(a.body,/<(?:script|iframe|object)\b|\son\w+\s*=/i);assert.ok(a.body.includes('data-action="scholar-reference"'));}});
