import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {snapshot,refresh,check} from '../scripts/editorial-review.mjs';

async function fixture(t){
  const root=await mkdtemp(path.join(tmpdir(),'reader-editorial-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await writeFile(path.join(root,'app.mjs'),'Original interface');await writeFile(path.join(root,'book.json'),'Original literary fixture');
  const receipt=await snapshot(root,{authored:['app.mjs'],protected:['book.json'],surfaces:['Shelf']});
  return {root,receipt};
}
function review(receipt){
  receipt.voice=['Brief functional labels'];receipt.surfaces[0]={name:'Shelf',files:['app.mjs'],status:'reviewed',evidence:'Original fixture inspected in a declared test surface.'};
  receipt.review={by:'Fixture reviewer',at:'2026-10-17',summary:'No prose changes needed.',limits:['Synthetic receipt, not a real browser review.']};return receipt;
}
test('an untouched editorial snapshot cannot pass; a completed scope may have zero findings',async t=>{
  const {root,receipt}=await fixture(t);assert.equal((await check(root,receipt)).complete,false);
  const result=await check(root,review(receipt));assert.equal(result.complete,true);assert.match(result.meaning,/not established/);
});
test('edited prose invalidates review; refresh preserves sources and requires another review',async t=>{
  const {root,receipt}=await fixture(t);review(receipt);await writeFile(path.join(root,'app.mjs'),'Changed interface');
  assert.match((await check(root,receipt)).failures.join(' '),/Reviewed file changed/);
  const updated=await refresh(root,receipt);assert.equal((await check(root,updated)).complete,false);assert.equal(updated.review.by,'');
  assert.equal((await check(root,review(updated))).complete,true);
});
test('protected source changes cannot be accepted by refreshing a receipt',async t=>{
  const {root,receipt}=await fixture(t);review(receipt);await writeFile(path.join(root,'book.json'),'Changed source');
  assert.match((await check(root,receipt)).failures.join(' '),/Protected source changed/);
  await assert.rejects(refresh(root,receipt),/Protected source changed/);
});
test('coverage and dispositions must be explicit, including dormant code',async t=>{
  const {root,receipt}=await fixture(t);review(receipt);receipt.surfaces[0].files=[];
  assert.equal((await check(root,receipt)).complete,false);receipt.surfaces[0].files=['app.mjs'];receipt.surfaces[0].status='not-rendered';receipt.surfaces[0].evidence='Dormant branch confirmed; no rendered inspection claimed.';
  assert.deepEqual((await check(root,receipt)).notRendered,['Shelf']);assert.equal((await check(root,receipt)).complete,false);
  receipt.surfaces.push({name:'Live index',files:['app.mjs'],status:'reviewed',evidence:'Active rendered fixture checked.'});
  receipt.findings=[{surface:'Shelf',location:'app.mjs',problem:'Unused branch',disposition:'retain',reason:'Outside the active edition; recorded separately.'}];
  assert.equal((await check(root,receipt)).complete,true);delete receipt.findings[0].reason;assert.equal((await check(root,receipt)).complete,false);
});
test('review input paths cannot escape scope or be assigned conflicting roles',async t=>{
  const {root}=await fixture(t);
  await assert.rejects(snapshot(root,{authored:['../outside'],protected:['book.json']}),/relative/);
  await assert.rejects(snapshot(root,{authored:['app.mjs'],protected:['app.mjs']}),/Duplicate/);
  await symlink(path.join(root,'book.json'),path.join(root,'alias.json'));
  await assert.rejects(snapshot(root,{authored:['app.mjs'],protected:['alias.json']}),/regular/);
});
test('explicit JSON source fields remain protected while separately authored context can change',async t=>{
  const {root}=await fixture(t);const file=path.join(root,'mixed.json');
  await writeFile(file,JSON.stringify({sections:['Original words'],context:'Old introduction','a/b':{'~key':'Exact note'}}));
  const receipt=await snapshot(root,{authored:['mixed.json'],protectedJson:['mixed.json#/sections','mixed.json#/a~1b/~0key'],surfaces:['About']});
  await writeFile(file,JSON.stringify({sections:['Original words'],context:'Revised introduction','a/b':{'~key':'Exact note'}}));
  await refresh(root,receipt);
  await writeFile(file,JSON.stringify({sections:['Changed words'],context:'Revised introduction','a/b':{'~key':'Exact note'}}));
  await assert.rejects(refresh(root,receipt),/Protected source changed/);
  await assert.rejects(snapshot(root,{authored:['mixed.json'],protectedJson:['mixed.json#/missing']}),/absent/);
});
