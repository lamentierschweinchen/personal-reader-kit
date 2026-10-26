import test from 'node:test';
import assert from 'node:assert/strict';
import {newBrewState,validateBrewState,reduceBrew,remainingAt,phaseAt,clockText} from '../site/tea-brew-state.mjs';

test('a saved deadline survives missed callbacks, reload and a long sleep',()=>{
  const running=reduceBrew(newBrewState(),{type:'start',id:'first'},100000);
  assert.equal(running.timer.deadline,160000);
  const restored=validateBrewState(JSON.parse(JSON.stringify(running)));
  assert.equal(remainingAt(restored.timer,120123),39877);
  assert.equal(phaseAt(restored,160000),'done');
  const late=reduceBrew(restored,{type:'tick'},86400000);
  assert.equal(late.timer.deadline,160000);assert.equal(late.timer.status,'done');
  assert.equal(clockText(remainingAt(late.timer,86400000)),'0:00');
});
test('pause keeps exact remaining time; time away does not consume a paused infusion',()=>{
  const running=reduceBrew(newBrewState(),{type:'start',id:'first'},1000);
  const paused=reduceBrew(running,{type:'pause'},12456);
  assert.equal(paused.timer.remainingMs,48544);assert.equal(paused.timer.deadline,null);
  assert.equal(remainingAt(paused.timer,1000000),48544);
  const resumed=reduceBrew(paused,{type:'resume'},1000000);
  assert.equal(resumed.timer.deadline,1048544);
  assert.equal(phaseAt(resumed,1048543),'running');assert.equal(phaseAt(resumed,1048544),'done');
});
test('late pause cannot revive a finished timer and a fresh start gets a new deadline',()=>{
  const running=reduceBrew(newBrewState(),{type:'start',id:'first'},1000);
  const done=reduceBrew(running,{type:'pause'},70000);
  assert.equal(done.timer.status,'done');assert.equal(done.timer.deadline,61000);
  const next=reduceBrew(done,{type:'start',id:'second'},100000);
  assert.equal(next.timer.id,'second');assert.equal(next.timer.deadline,160000);
});
test('tea and duration choices survive reset; an active infusion cannot be silently replaced',()=>{
  let state=reduceBrew(newBrewState(),{type:'adjust',seconds:15},0);
  state=reduceBrew(state,{type:'start',id:'first'},1000);
  const same=reduceBrew(state,{type:'select',recipe:'matcha'},2000);
  assert.deepEqual(same,state);
  assert.deepEqual(reduceBrew(state,{type:'adjust',seconds:15},2000),state);
  state=reduceBrew(state,{type:'reset'},3000);assert.equal(state.seconds.sencha,75);
  state=reduceBrew(state,{type:'select',recipe:'black'},4000);assert.equal(state.seconds.black,240);
  state=reduceBrew(state,{type:'select',recipe:'sencha'},5000);assert.equal(state.seconds.sencha,75);
  state=reduceBrew(state,{type:'recommended'},6000);assert.equal(state.seconds.sencha,60);
});
test('matcha has preparation instructions but cannot acquire a steep timer',()=>{
  const matcha=reduceBrew(newBrewState(),{type:'select',recipe:'matcha'},0);
  assert.equal(reduceBrew(matcha,{type:'start',id:'no-steep'},1).timer,null);
  assert.throws(()=>validateBrewState({...matcha,timer:{id:'wrong',recipe:'matcha',status:'running',durationMs:60000,remainingMs:60000,deadline:100000}}),/Unreadable/);
});
test('invalid persistence is refused and timer bounds and subsecond rounding stay honest',()=>{
  for(const value of [null,{},'text',{...newBrewState(),schema:2},{...newBrewState(),seconds:{sencha:-1,black:240}}])assert.throws(()=>validateBrewState(value));
  const badDate=reduceBrew(newBrewState(),{type:'start',id:'bad-date'},0);badDate.timer.deadline=Number.MAX_SAFE_INTEGER;assert.throws(()=>validateBrewState(badDate),/finish time/);
  let state=newBrewState();for(let i=0;i<10;i++)state=reduceBrew(state,{type:'adjust',seconds:-15},0);assert.equal(state.seconds.sencha,15);
  for(let i=0;i<150;i++)state=reduceBrew(state,{type:'adjust',seconds:15},0);assert.equal(state.seconds.sencha,1800);
  assert.equal(clockText(1),'0:01');assert.equal(clockText(60001),'1:01');assert.equal(clockText(-5),'0:00');
});
