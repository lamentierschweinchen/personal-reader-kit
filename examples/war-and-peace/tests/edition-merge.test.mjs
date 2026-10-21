import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeEditions} from '../site/edition.mjs';
test('a restored exact edition takes precedence over a different supplied edition without losing either record',()=>{
  const local={id:'original-fixture',title:'Original fixture',edition:'Earlier private edition'},supplied={...local,edition:'New supplied edition'},other={id:'another-fixture',title:'Another original fixture'};
  const result=mergeEditions([local,other],[supplied]);assert.strictEqual(result.books[0],local);assert.strictEqual(result.books[1],other);assert.deepEqual(result.conflicts,[local.id]);assert.equal(supplied.edition,'New supplied edition');
});
test('identical restored and supplied editions stay single and do not generate a conflict',()=>{
  const local={id:'original-fixture',title:'Original fixture'},supplied={title:'Original fixture',id:'original-fixture'};
  const result=mergeEditions([local],[supplied]);assert.equal(result.books.length,1);assert.deepEqual(result.conflicts,[]);assert.strictEqual(result.books[0],local);
});
