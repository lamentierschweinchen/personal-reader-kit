import {test} from 'node:test';
import assert from 'node:assert/strict';
import {STAGES,RADIUS,createGame,roomFor,start,pause,resume,retry,nextRoom,update,guardAt,visible,coverAt,collides,segmentRect,fanPoints} from '../play/engine.mjs';

const run=(g,input,seconds)=>{for(let t=0;t<seconds-1e-7;t+=1/120)update(g,input,Math.min(1/120,seconds-t));};
const live=(stage=0)=>{const g=createGame({stage,completed:stage});start(g);return g;};
const place=(g,x,y)=>{g.player={x,y,angle:0};};
const collect=(g,id)=>{const item=roomFor(g).items.find(i=>i.id===id);place(g,item.x,item.y);run(g,{},.01);};
const approachDoor=g=>{const d=roomFor(g).doors[0];if(d.h>d.w)place(g,d.x-25,d.y+d.h/2);else place(g,d.x+d.w/2,d.y-25);run(g,{},.01);};
const exit=g=>{place(g,roomFor(g).exit.x,roomFor(g).exit.y);run(g,{},.01);};

test('ready, paused, interlude, caught and escaped states freeze time and movement',()=>{
  for(let stage=0;stage<STAGES.length;stage++)for(const phase of ['ready','paused','interlude','caught','escaped']){
    const g=createGame({stage,completed:stage});g.phase=phase;
    const before=structuredClone(g);run(g,{x:1,y:1},2);assert.deepEqual(g,before);
  }
  const g=live();run(g,{x:0,y:-1},.2);pause(g);const stopped=g.time;resume(g);run(g,{},.1);assert.ok(g.time>stopped);
});

test('movement has normalized diagonal speed and does not depend on frame rate',()=>{
  const a=live(),b=live(),c=live(),origin={...a.player};
  run(a,{x:1,y:0},.25);run(b,{x:1,y:-1},.25);
  for(let i=0;i<15;i++)update(c,{x:1,y:0},1/60);
  assert.ok(Math.abs(Math.hypot(b.player.x-origin.x,b.player.y-origin.y)-(a.player.x-origin.x))<.0001);
  assert.ok(Math.abs(a.player.x-c.player.x)<.0001);
});

test('outer bounds, solid masonry and closed locks block movement',()=>{
  const g=live();run(g,{x:-1,y:0},4);assert.equal(g.player.x,60);
  for(let stage=0;stage<STAGES.length;stage++){
    const s=live(stage);
    for(const wall of [...roomFor(s).walls,...roomFor(s).doors])assert.ok(collides(s,wall.x+wall.w/2,wall.y+wall.h/2));
  }
  const chapel=live(1);place(chapel,258,273);run(chapel,{x:1,y:0},.35);
  assert.ok(chapel.player.x<=282-RADIUS+.001);assert.deepEqual(chapel.opened,[]);
  assert.equal(collides(chapel,chapel.player.x,chapel.player.y),false);
});

test('every patrol stays outside masonry and locked doors for an entire route',()=>{
  for(let stage=0;stage<STAGES.length;stage++){
    const g=createGame({stage});
    for(let t=0;t<45;t+=.05){
      g.patrolTime=t;
      for(let i=0;i<roomFor(g).patrols.length;i++){
        const p=guardAt(g,i);
        assert.equal(collides(g,p.x,p.y),false,`Room ${stage+1}, patrol ${i}, t=${t}: ${p.x}, ${p.y}`);
        assert.ok(Number.isFinite(p.angle));
      }
    }
  }
});

test('every alcove requires the whole player and remains a stable waiting place',()=>{
  for(let stage=0;stage<STAGES.length;stage++)for(const c of STAGES[stage].covers){
    const y=c.y+c.h/2,x=c.x+RADIUS;
    assert.equal(coverAt(stage,x-.01,y),null);assert.equal(coverAt(stage,x,y),c.id);
    assert.equal(coverAt(stage,c.x+c.w-RADIUS+.01,y),null);
    assert.equal(coverAt(stage,c.x+c.w/2,c.y+RADIUS-.01),null);
    assert.equal(coverAt(stage,c.x+c.w/2,c.y+c.h-RADIUS+.01),null);
    const g=live(stage);place(g,c.x+c.w/2,y);run(g,{},40);
    assert.equal(g.phase,'playing');assert.equal(g.warning,0);
  }
});

test('walls and closed doors occlude sight; opening a lock changes the same sight geometry',()=>{
  const g=createGame(),guard={x:100,y:240,angle:Math.PI/2,range:220,half:.8};
  assert.equal(visible(g,guard,100,340),false);
  assert.notEqual(segmentRect(100,240,100,340,STAGES[0].walls[0]),null);
  const atDoor={...guard,x:300};
  assert.equal(visible(g,atDoor,300,340),false);g.opened.push('arch');
  assert.equal(visible(g,atDoor,300,340),true);assert.equal(visible(g,atDoor,300,180),false);
  for(let stage=0;stage<STAGES.length;stage++){
    const s=createGame({stage});for(let i=0;i<roomFor(s).patrols.length;i++){
      const points=fanPoints(s,guardAt(s,i)).split(' ').flatMap(p=>p.split(',').map(Number));
      assert.ok(points.every(n=>Number.isFinite(n)&&n>=49-.01&&n<=551+.01));
    }
  }
});

test('exposure gives warning time, drains in cover, and freezes on capture',()=>{
  const g=live();place(g,300,420);run(g,{},.25);
  assert.equal(g.phase,'playing');assert.ok(g.warning>.2);
  place(g,105,500);run(g,{},.5);assert.equal(g.warning,0);assert.equal(g.exposed,false);
  const loss=live();place(loss,300,420);run(loss,{},1.5);assert.equal(loss.phase,'caught');
  const frozen=structuredClone(loss);run(loss,{x:0,y:1},2);assert.deepEqual(loss,frozen);
});

test('the guest wing needs the brass key, opened arch and stair bolt',()=>{
  const g=live();collect(g,'bolt');assert.deepEqual(g.inventory,[]);
  const key=STAGES[0].items[0];place(g,key.x+23,key.y);run(g,{},.01);assert.ok(g.inventory.includes('brass'));
  exit(g);assert.equal(g.phase,'playing');collect(g,'bolt');exit(g);assert.equal(g.phase,'playing');
  approachDoor(g);assert.deepEqual(g.opened,['arch']);exit(g);
  assert.equal(g.phase,'interlude');assert.equal(g.completed,1);
});

test('the chapel carries the brass key, but requires its own iron key and handle',()=>{
  const g=live(1);assert.deepEqual(g.inventory,['brass']);approachDoor(g);assert.deepEqual(g.opened,[]);
  collect(g,'iron');approachDoor(g);assert.deepEqual(g.opened,['cross-door']);exit(g);assert.equal(g.phase,'playing');
  collect(g,'handle');exit(g);assert.equal(g.phase,'interlude');assert.equal(g.completed,2);
});

test('the gate key releases the winch; both winch and key are needed at the final gate',()=>{
  const g=live(2);assert.ok(g.inventory.includes('handle'));
  collect(g,'winch');assert.ok(!g.inventory.includes('winch'));approachDoor(g);assert.deepEqual(g.opened,[]);
  collect(g,'gate-key');approachDoor(g);assert.deepEqual(g.opened,[]);
  collect(g,'winch');assert.ok(g.inventory.includes('winch'));approachDoor(g);assert.deepEqual(g.opened,['last-gate']);
  exit(g);assert.equal(g.phase,'escaped');assert.equal(g.completed,3);
});

test('retry discards only current-room objects; continuation carries the completed checkpoint',()=>{
  for(let stage=0;stage<STAGES.length;stage++){
    const g=live(stage);g.inventory.push('temporary');g.opened.push('temporary');g.phase='caught';g.gentle=true;
    const r=retry(g);assert.equal(r.stage,stage);assert.equal(r.completed,stage);assert.equal(r.gentle,true);
    assert.deepEqual(r.inventory,STAGES[stage].carry);assert.deepEqual(r.opened,[]);assert.equal(r.time,0);
    if(stage<STAGES.length-1){g.phase='interlude';g.completed=stage+1;const n=nextRoom(g);assert.equal(n.stage,stage+1);assert.equal(n.completed,stage+1);assert.equal(n.gentle,true);assert.deepEqual(n.inventory,STAGES[stage+1].carry);}
  }
});

test('changing patrol pace while paused preserves position and resumes at the gentler pace',()=>{
  const g=live();run(g,{},2);pause(g);const before=guardAt(g,0);g.gentle=true;run(g,{},5);assert.deepEqual(guardAt(g,0),before);
  resume(g);run(g,{},1);assert.ok(Math.abs(g.patrolTime-2.72)<.001);
});
