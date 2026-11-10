import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateBook} from '../site/core.mjs';
import {worldCompanion} from '../site/hall-world.mjs';
test('the reviewed complete Hall edition and source apparatus remain exact',async()=>{const bytes=await readFile(new URL('../edition/book.json',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'0a4e6dffad82cc9e523e89adb926dc27914e8fd57768f6314d9e81fedd297958');const raw=JSON.parse(bytes);assert.deepEqual(validateBook(raw),raw);assert.equal(raw.sections.length,43);assert.equal(raw.apparatus.notes.length,132);assert.equal(raw.apparatus.marginals.length,448);assert.equal(raw.apparatus.destinations.length,555);});
test('historical companion remains separate and gives the artifact before its long interpretation',()=>{for(const stop of ['building','gathering','warrior','craft'])assert.ok(worldCompanion(stop,'Return').includes('world-stop'));const helmet=worldCompanion('warrior','Return');assert.ok(helmet.indexOf('id="helmet-mark"')<helmet.indexOf('In fits VI'));const craft=worldCompanion('craft','Return');assert.ok(craft.indexOf('id="clasp-mark"')<craft.indexOf('The Sutton Hoo shoulder clasps'));assert.ok(craft.indexOf("hall-whorl.jpg")<craft.indexOf('This small sandstone disc'));});
