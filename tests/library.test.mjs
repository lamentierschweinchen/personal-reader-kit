import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateEntries,renderLibrary} from '../showcase/library/render.mjs';
import {readerPaths} from '../showcase/readers.mjs';
const data=JSON.parse(await readFile(new URL('../showcase/library/entries.json',import.meta.url),'utf8'));

test('library admits reviewed discovery metadata without personal records or arbitrary hosts',()=>{
 assert.equal(validateEntries(structuredClone(data)).length,Object.keys(readerPaths).length);
 for(const mutate of [
  d=>{d.editions[0].notes=['private record'];},
  d=>{d.editions[0].id='unreviewed-reader';},
  d=>{d.editions[0].rightsPath='../private/permission.txt';},
  d=>{d.editions[0].sourceUrls=['javascript:alert(1)'];},
  d=>{d.editions[0].sourceLabels=[];},
  d=>{d.editions[0].sourceLabels=[''];},
  d=>{d.editions[0].sourceLabels=[{private:'record'}];},
  d=>{d.editions[1]=structuredClone(d.editions[0]);},
  d=>{d.editions[0].preparedBy.email='private@example.invalid';}
 ]){const changed=structuredClone(data);mutate(changed);assert.throws(()=>validateEntries(changed));}
});
test('source links use their edition labels rather than inferred author names',()=>{
 const changed=structuredClone(data),edition=changed.editions[0];
 edition.sourceUrls=['https://www.gutenberg.org/ebooks/5434','https://www.gutenberg.org/ebooks/10136','https://www.gutenberg.org/ebooks/18435'];
 edition.sourceLabels=['Brillat-Savarin source','Beeton source','Estes <source>'];
 const html=renderLibrary(changed);
 assert.ok(html.includes('href="https://www.gutenberg.org/ebooks/5434">Brillat-Savarin source</a>'));
 assert.ok(html.includes('href="https://www.gutenberg.org/ebooks/10136">Beeton source</a>'));
 assert.ok(html.includes('href="https://www.gutenberg.org/ebooks/18435">Estes &lt;source&gt;</a>'));
});
test('metadata cannot inject HTML into source details, titles or search attributes',()=>{
 const changed=structuredClone(data);changed.editions[0].title='<img src=x onerror="bad()"> & "title"';
 const html=renderLibrary(changed);
 assert.ok(!html.includes('<img src=x onerror='));
 assert.ok(html.includes('&lt;img src=x onerror=&quot;bad()&quot;&gt; &amp; &quot;title&quot;'));
 assert.equal((html.match(/class="book" data-edition=/g)||[]).length,Object.keys(readerPaths).length);
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
 assert.equal(publication.reviewedEditionFiles.filter(f=>!['inward-life','at-table','beside-the-bed','learning-to-see','music-and-feeling','mountains-and-heights','nietzsche-in-company','war-and-peace','douglass-narrative','fall-of-the-house-of-usher'].some(id=>f.path.startsWith('examples/'+id+'/'))).length,177);
 for(const b of data.editions){assert.ok(publication.files.includes(b.rightsPath));assert.ok((await readFile(new URL('../'+b.rightsPath,import.meta.url),'utf8')).trim());assert.ok(publication.reviewedEditionFiles.some(f=>f.path.startsWith('examples/'+b.exampleId+'/')));}
});
test('each admitted reader revalidates its worker and keeps its noindex boundary',async()=>{
 const config=JSON.parse(await readFile(new URL('../showcase/vercel.json',import.meta.url),'utf8'));
 const worker=config.routes.find(r=>r.headers?.['Cache-Control']==='no-cache, no-store, must-revalidate');
 const reader=config.routes.find(r=>r.headers?.['X-Robots-Tag']==='noindex, nofollow, noarchive');
 assert.ok(worker&&reader);
 for(const slug of Object.values(readerPaths)){
  assert.match('/'+slug+'/sw.js',new RegExp(worker.src));
  assert.match('/'+slug+'/',new RegExp(reader.src));
 }
 for(const url of ['/','/library/','/learn/'])assert.doesNotMatch(url,new RegExp(reader.src));
});
