import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {newState,sha256} from '../site/core.mjs';
import {createBundle,validateBundle,canonical,snapshotToken} from '../site/bundle.mjs';
import {NOTICE_PROFILE,noticesFromAsset,validateSourceNotices} from '../site/notices.mjs';
const hash=value=>sha256(new TextEncoder().encode(canonical(value)));
async function resign(bundle) {const {sha256:ignored,...body}=bundle;return {...body,sha256:await hash(body)};}
let books,asset;
try {books=JSON.parse(await readFile(new URL('../edition/library.json',import.meta.url)));asset=JSON.parse(await readFile(new URL('../edition/notices.json',import.meta.url)));}catch(error){if(error.code!=='ENOENT')throw error;}
const local={skip:!books&&'Requires the ignored prepared collection; source-only shell has no books.'};
test('source-notice supplement rejects unknown shape, profile, identities and unreviewed bytes',async()=>{
  await assert.rejects(()=>validateSourceNotices({}),/Unsupported/);
  await assert.rejects(()=>validateSourceNotices([{bookId:'unknown'}]),/fields/);
  const unknown={bookId:'unknown',editionSha256:'a',sourceSha256:'a',sha256:'a',text:''};
  await assert.rejects(()=>validateSourceNotices([unknown]),/Unknown/);
});
test('both exact collection exports carry complete pinned notices without altering books or records',local,async()=>{
  const before=canonical(books),sourceNotices=await noticesFromAsset(asset,books),state=newState();
  const bundle=await createBundle({books,state,sourceNotices});assert.equal(bundle.noticeProfile,NOTICE_PROFILE);
  assert.equal(bundle.sourceNotices.length,2);assert.deepEqual((await validateBundle(bundle)).books,books);assert.equal(canonical(books),before);
  for(const book of books) {
    const one=await createBundle({books:[book],state,sourceNotices},[book.id]);assert.equal(one.sourceNotices.length,1);
    assert.equal(one.sourceNotices[0].text,asset[book.id==='nightingale-1898'?'nightingale':'whitman']);assert.deepEqual(one.state,newState());await validateBundle(one);
  }
  await assert.rejects(()=>createBundle({books,state}),/Full source notices are unavailable/);
  assert.notEqual(snapshotToken({books,state}),snapshotToken({books,state,sourceNotices}));
});
test('recomputed outer checksums cannot authorize changed notices or mismatched exact edition metadata',local,async()=>{
  const sourceNotices=await noticesFromAsset(asset,books),bundle=await createBundle({books,state:newState(),sourceNotices});
  for(const mutate of [b=>b.sourceNotices[0].text+=' ',b=>b.sourceNotices[0].editionSha256='0'.repeat(64),b=>b.books[0].edition+=' revised',b=>b.sourceNotices.push(b.sourceNotices[0]),b=>b.sourceNotices.pop(),b=>b.noticeProfile='unknown@1']) {
    const altered=structuredClone(bundle);mutate(altered);await assert.rejects(()=>resign(altered).then(validateBundle));
  }
  const swapped=structuredClone(sourceNotices);[swapped[0].text,swapped[1].text]=[swapped[1].text,swapped[0].text];await assert.rejects(()=>validateSourceNotices(swapped,books),/differs/);
  const legacy=structuredClone(bundle);delete legacy.noticeProfile;delete legacy.sourceNotices;await validateBundle(await resign(legacy));
});
