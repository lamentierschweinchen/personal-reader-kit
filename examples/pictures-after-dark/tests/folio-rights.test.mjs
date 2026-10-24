import test from 'node:test';
import assert from 'node:assert/strict';
import {fromText} from '../site/core.mjs';
import {prepareFolioRights,folioShareAttribution,folioContextText} from '../site/folio-rights.mjs';

test('sharing never assigns a reviewed transcription credit by ID alone',async()=>{
 const book=await fromText('Original fixture, not a historical transcription.',{title:'Test'});
 book.id='pictures-fr';
 await prepareFolioRights([book]);assert.deepEqual(folioShareAttribution(book),[]);
 book.source.sha256='bb01b25288b6b3c495fc08eaa4499528400264c64c3a593957799d4f9b954005';
 await prepareFolioRights([book]);assert.throws(()=>folioShareAttribution(book),/could not be verified/);
 const context={text:'This is a local review candidate with no public release decision.'};
 assert.equal(folioContextText(book,context),context.text,'custom content is not rewritten');
});
