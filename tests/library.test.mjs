import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateEntries,renderLibrary} from '../showcase/library/render.mjs';
const data=JSON.parse(await readFile(new URL('../showcase/library/entries.json',import.meta.url),'utf8'));

test('library admits reviewed discovery metadata without personal records or arbitrary hosts',()=>{
 assert.equal(validateEntries(structuredClone(data)).length,6);
 for(const mutate of [
  d=>{d.editions[0].notes=['private record'];},
  d=>{d.editions[0].id='unreviewed-reader';},
  d=>{d.editions[0].rightsPath='../private/permission.txt';},
  d=>{d.editions[0].sourceUrls=['javascript:alert(1)'];},
  d=>{d.editions[1]=structuredClone(d.editions[0]);},
  d=>{d.editions[0].preparedBy.email='private@example.invalid';}
 ]){const changed=structuredClone(data);mutate(changed);assert.throws(()=>validateEntries(changed));}
});
test('metadata cannot inject HTML into source details, titles or search attributes',()=>{
 const changed=structuredClone(data);changed.editions[0].title='<img src=x onerror="bad()"> & "title"';
 const html=renderLibrary(changed);
 assert.ok(!html.includes('<img src=x onerror='));
 assert.ok(html.includes('&lt;img src=x onerror=&quot;bad()&quot;&gt; &amp; &quot;title&quot;'));
 assert.equal((html.match(/class="book" data-edition=/g)||[]).length,6);
 assert.ok(!html.includes('fetch('));
});
test('static library retains read and contribution destinations without JavaScript',()=>{
 const html=renderLibrary(data);
 for(const b of data.editions){assert.ok(html.includes(`class="cover-button" href="/${b.id}/"`));assert.ok(html.includes(`id="edition-${b.id}"`));}
 assert.ok(html.includes('/issues/new?template=edition.yml'));
 assert.ok(html.includes('Opens a public GitHub form.'));
 assert.equal(renderLibrary(data),html);
});
test('library stays outside the original-sample starter and edition inventory',async()=>{
 const publication=JSON.parse(await readFile(new URL('../publication.json',import.meta.url),'utf8'));
 assert.ok(!publication.starterFiles.some(p=>p.startsWith('showcase/')||p==='docs/LIBRARY.md'));
 assert.equal(publication.reviewedEditionFiles.length,177);
 for(const b of data.editions){assert.ok(publication.files.includes(b.rightsPath));assert.ok((await readFile(new URL('../'+b.rightsPath,import.meta.url),'utf8')).trim());assert.ok(publication.reviewedEditionFiles.some(f=>f.path.startsWith('examples/'+b.exampleId+'/')));}
});
