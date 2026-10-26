import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {libraryShelves,renderLibrary} from '../showcase/library/render.mjs';
const data=JSON.parse(await readFile(new URL('../showcase/library/entries.json',import.meta.url),'utf8'));
const expected=[
 {id:'stage',label:'On stage',editions:['shakespeare','ballads','antigone','a-dolls-house']},
 {id:'table',label:'At the table',editions:['at-table','book-of-tea']},
 {id:'dark',label:'After dark',editions:['dracula','poe','pictures-after-dark']},
 {id:'outdoors',label:'Out of doors',editions:['walden','mountains','odyssey']}
];
test('curated shelves keep deliberate memberships separate from existing edition categories',()=>{
 assert.deepEqual(libraryShelves,expected);
 const before=structuredClone(data),html=renderLibrary(data);
 assert.deepEqual(data,before,'Discovery rendering does not change edition metadata');
 for(const book of data.editions){
  const article=html.match(new RegExp('<article class="book" data-edition="'+book.id+'"[^>]*>'))?.[0];
  assert.ok(article,book.id);assert.ok(article.includes('data-categories="'+book.categories.join(' ')+'"'));
  assert.ok(article.includes('data-shelves="'+expected.filter(s=>s.editions.includes(book.id)).map(s=>s.id).join(' ')+'"'),book.id+' shelf assignment');
 }
 assert.equal(renderLibrary(data),html,'Stable public output');
});
test('all four existing filters and all four named shelves retain explicit toggle names',()=>{
 const html=renderLibrary(data);
 for(const [id,label]of [['all','All editions'],['words','Words &amp; ideas'],['art','Art &amp; observation'],['game','With a game'],...expected.map(s=>[s.id,s.label])])assert.ok(html.includes(`data-filter="${id}" aria-pressed="${id==='all'}">${label}</button>`));
 assert.equal((html.match(/data-filter=/g)||[]).length,8);
 assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
 assert.ok(html.includes('class="browse-tools" aria-label="Find an edition" hidden'),'Static catalogue does not expose inert controls');
});

test('default library order matches the physical shelf and assigns exact reset ranks',()=>{
 const expected=["alice","mountains","antigone","at-table","ballads","beside-the-bed","book-of-tea","rome","a-dolls-house","dracula","poe","inward-life","shakespeare","learning-to-see","douglass","nietzsche","odyssey","pictures-after-dark","austen","two-halls","walden","war-and-peace","music-and-feeling"];
 const cards=[...renderLibrary(data).matchAll(/<article class="book" data-edition="([^"]+)" data-order="([0-9]+)"/g)];
 assert.deepEqual(cards.map(c=>c[1]),expected);
 assert.deepEqual(cards.map(c=>Number(c[2])),expected.map((_,i)=>i));
});
