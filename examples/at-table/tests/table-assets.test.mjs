import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {digest,validateAsset} from '../site/assets.mjs';
// Original 3 by 2 solid-colour JPEG created for this test; no source-book media.
const data='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAMDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDiaKKK4z6Q/9k=';
const bytes=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));
const asset={data,sha256:createHash('sha256').update(bytes).digest('hex'),width:3,height:2,alt:'Original solid-colour test fixture'};
test('portable source assets verify decoded bytes and dimensions, including cached inputs',()=>{
 assert.equal(digest(bytes),asset.sha256);assert.deepEqual(validateAsset(asset),asset);
 assert.throws(()=>validateAsset({...asset,width:4}),/dimensions/);
 assert.throws(()=>validateAsset({...asset,sha256:'0'.repeat(64)}),/integrity/);
 assert.throws(()=>validateAsset({...asset,data:data.slice(0,-5)+'AAAA'}),/integrity/);
 assert.throws(()=>validateAsset({...asset,url:'https://example.invalid/image.jpg'}),/Unsupported/);
});
test('synchronous hashing matches the platform at padding boundaries',()=>{for(const n of [0,1,55,56,63,64,65,1000]){const b=Uint8Array.from({length:n},(_,i)=>i%256);assert.equal(digest(b),createHash('sha256').update(b).digest('hex'));}});
