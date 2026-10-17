import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES,newGame,pour,stopPour,refill,pause,resume,tick} from '../play/engine.mjs';

test('the table waits for input and paused time never drains a cup',()=>{
 const s=newGame();tick(s,5);assert.equal(s.time,0);pour(s,0);tick(s,.7);pause(s);
 const held=structuredClone(s);tick(s,9);assert.deepEqual(s,held);
 assert.equal(pour(s,2),false);assert.equal(refill(s),false);resume(s);tick(s,.1);assert.ok(s.time>held.time);
});
test('neglect loses naturally and a fresh round resets every resource',()=>{
 const s=newGame();pour(s,0);stopPour(s);tick(s,30);
 assert.equal(s.phase,'lost');assert.equal(s.misses,3);assert.ok(s.time<20);
 const again=newGame();assert.equal(again.phase,'ready');assert.equal(again.kettle,RULES.capacity);assert.equal(again.misses,0);assert.equal(again.score,0);
});
test('overpouring wastes finite tea, costs score, and cannot earn a perfect bonus',()=>{
 const s=newGame();pour(s,0);tick(s,2);stopPour(s);assert.ok(s.spills>0);assert.equal(s.perfects,0);assert.ok(s.kettle<RULES.capacity-100);
});
test('a refill takes real game time and blocks pouring until finished',()=>{
 const s=newGame();pour(s,0);tick(s,.8);assert.ok(refill(s));const used=s.kettle;
 tick(s,1);assert.equal(s.kettle,used);assert.equal(pour(s,1),false);tick(s,.81);assert.equal(s.kettle,RULES.capacity);assert.ok(pour(s,1));
});
test('seat changes release the kettle and give every cup a fair transition',()=>{
 const s=newGame();s.phase='playing';s.time=22.99;s.cups.forEach(c=>c.tea=80);pour(s,0);tick(s,.02);
 assert.equal(s.target,null);assert.deepEqual(s.cups.map(c=>c.seat),[1,2,0]);const tea=s.cups.map(c=>c.tea);tick(s,.5);assert.deepEqual(s.cups.map(c=>c.tea),tea);assert.equal(pour(s,0),false);tick(s,.5);assert.ok(pour(s,0));
});
test('prioritizing the driest cup and leaving refill time can win all 75 seconds',()=>{
 const s=newGame();pour(s,0);
 for(let frame=0;frame<4600&&s.phase==='playing';frame++){
  if(!s.refill&&s.time>=s.swapUntil){
   if(s.target!==null&&s.cups[s.target].tea>=89)stopPour(s);
   if(s.target===null){
    const c=[...s.cups].sort((a,b)=>a.tea/a.drain-b.tea/b.drain)[0];
    if(s.kettle<10||(s.kettle<90&&Math.min(...s.cups.map(c=>c.tea/c.drain))>3.5))refill(s);
    else if(c.tea<62)pour(s,s.cups.indexOf(c));
   }
  }
  tick(s,1/60);
 }
 assert.equal(s.phase,'won');assert.equal(s.misses,0);assert.equal(s.spills,0);assert.ok(s.perfects>20);assert.equal(s.swapIndex,4);assert.ok(s.score>2000);
});
