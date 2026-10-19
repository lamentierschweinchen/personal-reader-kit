import test from 'node:test';
import assert from 'node:assert/strict';
import {collectionStudies,studyAction,studyFragments} from '../site/collection.mjs';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const fixture={id:'julian',sections:[{id:'original-fixture',title:'Original fixture',blocks:[{id:'b29',kind:'prose',text:'An original fixture for the source-first surface.',after:'',marks:[]}]}]};
const render=route=>collectionStudies({books:[fixture],esc,route,returnLink:()=>''});
test('production mediation opens source immediately before interpretation and preserves its complete block',()=>{
 studyAction('voice','0');const html=render({view:'companion',book:'voices'});
 assert(html.indexOf('data-study-fragment')<html.indexOf('source-commentary'));
 assert.deepEqual(studyFragments[0].section.blocks,fixture.sections[0].blocks);
 assert(!html.includes('Read the edition trace'));
});
test('welcoming routes expose the three questions and give retired study links a reading destination',()=>{
 const html=render({view:'companion',book:'doors'});
 assert.equal((html.match(/href="#companion\/doors\/(truth|love|living)"/g)||[]).length,3);
 assert(!html.includes('The interval'));assert(!html.includes('connections are editorial'));
 const fallback=render({view:'companion',book:'interval'});assert(fallback.includes('Three doors'));assert(!fallback.includes('Who speaks first?'));
});
