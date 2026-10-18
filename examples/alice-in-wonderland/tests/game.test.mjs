import test from 'node:test';
import assert from 'node:assert/strict';
import {RULES,COURSES,newGame,start,pour,stopPour,refill,serve,pause,resume,tick,canAct} from '../play/engine.mjs';

// A deterministic player makes ordinary engine actions, including service decisions.
function play(s,{food=true,cleaning=true}={}){
 start(s);
 for(let step=0;step<1000&&s.phase==='playing';step++){
  if(s.target!==null&&(s.cups[s.target].tea>=88||!canAct(s)))stopPour(s);
  if(s.target===null&&canAct(s)){
   const course=COURSES[s.course],cs=s.cups.map((c,id)=>({...c,id,dry:c.tea/(c.drain*course.factor*(1+.12*s.time/course.duration)*(c.chewing>0?.35:1))}));
   const dirty=cs.filter(c=>c.dirty).sort((a,b)=>a.dry-b.dry)[0],order=cs.filter(c=>c.order&&!c.dirty).sort((a,b)=>a.order.left-b.order.left)[0],needy=cs.filter(c=>!c.dirty).sort((a,b)=>a.dry-b.dry)[0],dry=Math.min(...cs.map(c=>c.dry));
   if(cleaning&&dirty&&dirty.tea<25)serve(s,dirty.id);
   else if(food&&order&&(order.order.left<2.8||dry>2.2))serve(s,order.id);
   else if(s.kettle<8||(s.kettle<75&&dry>2.2))refill(s);
   else if(needy&&needy.tea<65)pour(s,needy.id);
   else if(food&&order)serve(s,order.id);
   else if(cleaning&&dirty&&dirty.tea<55)serve(s,dirty.id);
  }
  tick(s,.06);
 }
 return s;
}

test('introductions wait for explicit Start and pause freezes cups, requests and service',()=>{
 const s=newGame(1,[1700]);tick(s,8);assert.equal(s.time,0);assert.equal(pour(s,0),false);assert.equal(refill(s),false);assert.ok(start(s));assert.equal(start(s),false);
 tick(s,5.1);assert.ok(s.cups[1].order);assert.ok(serve(s,1));tick(s,.2);pause(s);
 const held=structuredClone(s);tick(s,9);assert.deepEqual(s,held);assert.equal(pour(s,2),false);assert.equal(refill(s),false);assert.equal(serve(s,1),false);
 resume(s);tick(s,.1);assert.ok(s.time>held.time);assert.ok(s.service.left<held.service.left);
});
test('neglect loses every course naturally; retry preserves earlier scores and resets this course',()=>{
 for(let course=0;course<3;course++){
  const bank=[1700,2100].slice(0,course),s=newGame(course,bank);start(s);tick(s,30);
  assert.equal(s.phase,'lost');assert.equal(s.misses,3);assert.ok(s.time<20);assert.deepEqual(s.scores,bank);
  const retry=newGame(s.course,s.scores);assert.equal(retry.phase,'intro');assert.equal(retry.course,course);assert.deepEqual(retry.scores,bank);assert.equal(retry.kettle,RULES.capacity);assert.equal(retry.misses,0);assert.equal(retry.score,0);assert.equal(retry.service,null);assert.ok(retry.cups.every(c=>!c.dirty&&!c.order));
 }
});
test('overpouring wastes finite tea, costs score and cannot earn a perfect bonus',()=>{
 const s=newGame();start(s);pour(s,0);tick(s,2);stopPour(s);assert.ok(s.spills>0);assert.equal(s.perfects,0);assert.ok(s.kettle<RULES.capacity-100);assert.ok(s.score<s.served*.16);
});
test('a refill takes game time and blocks pouring until finished',()=>{
 const s=newGame();start(s);pour(s,0);tick(s,.8);assert.ok(refill(s));assert.equal(s.target,null);const used=s.kettle;
 tick(s,1);assert.equal(s.kettle,used);assert.equal(pour(s,1),false);tick(s,.81);assert.equal(s.kettle,RULES.capacity);assert.ok(pour(s,1));
});
test('seat changes release the held pour and suspend drinking through the move',()=>{
 const s=newGame();start(s);s.time=COURSES[0].swaps[0]-.01;s.cups.forEach(c=>c.tea=80);pour(s,0);tick(s,.02);
 assert.equal(s.target,null);assert.deepEqual(s.cups.map(c=>c.seat),[1,2,0]);const tea=s.cups.map(c=>c.tea);tick(s,.5);assert.deepEqual(s.cups.map(c=>c.tea),tea);assert.equal(pour(s,0),false);tick(s,.5);assert.ok(pour(s,0));
});
test('bread service competes with pouring and buys slower drinking after completion',()=>{
 const s=newGame(1);start(s);tick(s,5.05);const c=s.cups[1];assert.ok(c.order);s.cups.forEach(c=>c.tea=90);
 assert.ok(serve(s,1));assert.equal(pour(s,0),false);assert.equal(refill(s),false);tick(s,RULES.toastSeconds+.01);assert.equal(c.order,null);assert.equal(s.ordersServed,1);assert.ok(c.chewing>2.9);
 const tea=c.tea;tick(s,.5);assert.ok(tea-c.tea<c.drain*.5*.5);assert.equal(s.service,null);
});
test('an unanswered bread request costs a chance even when every cup has tea',()=>{
 const s=newGame(1);start(s);tick(s,5.05);s.cups.forEach(c=>c.tea=100);const misses=s.misses;tick(s,RULES.orderSeconds+.1);
 assert.equal(s.misses,misses+1);assert.equal(s.cups[1].order,null);assert.ok(s.cups.every(c=>c.tea>0));
});
test('a dirty cup blocks pouring; replacement takes time and discards its tea',()=>{
 const s=newGame(2);start(s);s.time=9.99;s.cups.forEach(c=>c.tea=90);tick(s,.02);assert.equal(s.cups[0].dirty,true);tick(s,.81);assert.equal(pour(s,0),false);
 const before=s.cups[0].tea;assert.ok(before>60);assert.ok(serve(s,0));assert.equal(pour(s,1),false);assert.equal(refill(s),false);tick(s,RULES.cleanSeconds+.01);
 assert.equal(s.cups[0].dirty,false);assert.equal(s.cups[0].tea,0);assert.equal(s.cleaned,1);assert.ok(pour(s,0));tick(s,.3);assert.ok(s.cups[0].tea>0);
});
test('balancing tea, food and clean cups clears all three courses and freezes each result',()=>{
 let bank=[];
 for(let course=0;course<3;course++){
  const s=play(newGame(course,bank));assert.equal(s.phase,course===2?'won':'interlude');assert.equal(s.time,COURSES[course].duration);assert.equal(s.misses,0);assert.equal(s.spills,0);assert.equal(s.swapIndex,COURSES[course].swaps.length);assert.equal(s.ordersServed,COURSES[course].orders.length);assert.equal(s.cleaned,COURSES[course].dirty.length);assert.ok(s.score>1500);assert.deepEqual(s.scores.slice(0,course),bank);
  bank=s.scores.slice();const result=structuredClone(s);tick(s,20);assert.deepEqual(s,result);
 }
 assert.equal(bank.length,3);const replay=newGame();assert.equal(replay.course,0);assert.deepEqual(replay.scores,[]);
});
test('tea-only play stops working when the courses add requests',()=>{
 assert.equal(play(newGame(),{food:false,cleaning:false}).phase,'interlude');
 assert.equal(play(newGame(1),{food:false}).phase,'lost');
 assert.equal(play(newGame(2),{food:true,cleaning:false}).phase,'lost');
});
