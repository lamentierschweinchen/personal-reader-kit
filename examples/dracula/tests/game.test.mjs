import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,start,pause,resume,update,guardAt,visible,coverAt,collides,segmentRect,COVERS,PILLARS,RADIUS,KEY,EXIT} from '../play/engine.mjs';

const run=(g,input,seconds)=>{for(let t=0;t<seconds-1e-7;t+=1/120)update(g,input,Math.min(1/120,seconds-t));};
const live=()=>{const g=createGame();start(g);return g;};
test('a frozen room never advances before start or while paused',()=>{
  const g=createGame();const before=structuredClone(g);run(g,{x:1,y:1},10);assert.deepEqual(g,before);
  start(g);run(g,{x:0,y:-1},.2);pause(g);const paused=structuredClone(g);run(g,{x:1,y:0},10);assert.deepEqual(g,paused);
  resume(g);run(g,{x:0,y:-1},.1);assert.ok(g.time>paused.time);
});
test('movement is equally fast diagonally and independent of frame rate',()=>{
  const a=live(),b=live(),c=live();run(a,{x:1,y:0},.25);run(b,{x:1,y:1},.25);
  for(let i=0;i<15;i++)update(c,{x:1,y:0},1/60);
  assert.ok(Math.abs(Math.hypot(b.player.x-112,b.player.y-495)-(a.player.x-112))<.0001);
  assert.ok(Math.abs(a.player.x-c.player.x)<.0001);
});
test('outer walls and both solid plinths stop movement without tunnelling',()=>{
  const g=live();run(g,{x:-1,y:0},4);assert.equal(g.player.x,60);
  for(const p of PILLARS){const s=live();s.player={x:p.x-15,y:p.y+p.h/2,angle:0};run(s,{x:1,y:0},.4);assert.ok(s.player.x<=p.x-RADIUS+.001);assert.equal(collides(s.player.x,s.player.y),false);}
});
test('every cover edge requires the whole player and gives a stable safe place',()=>{
  for(const c of COVERS){
    const y=c.y+c.h/2,x=c.x+RADIUS;
    assert.equal(coverAt(x-.01,y),null);assert.equal(coverAt(x,y),c.id);
    assert.equal(coverAt(c.x+c.w-RADIUS+.01,y),null);
    assert.equal(coverAt(c.x+c.w/2,c.y+RADIUS-.01),null);
    assert.equal(coverAt(c.x+c.w/2,c.y+c.h-RADIUS+.01),null);
    const g=live();g.player={x:c.x+c.w/2,y,angle:0};run(g,{x:0,y:0},40);assert.equal(g.phase,'playing');assert.equal(g.warning,0);
  }
});
test('plinths occlude sight and a patrol cannot see behind itself',()=>{
  const g={x:300,y:170,angle:Math.PI/2,range:220,half:.8};
  assert.equal(visible(g,300,280),false);assert.equal(visible({...g,x:410},410,310),true);assert.equal(visible(g,300,100),false);
  assert.notEqual(segmentRect(300,170,300,280,PILLARS[0]),null);
});
test('an exposed mistake has warning time, then loss; cover clears the warning',()=>{
  const g=live();g.player={x:300,y:313,angle:0};run(g,{x:0,y:0},.3);assert.equal(g.phase,'playing');assert.ok(g.warning>.3);
  g.player={x:110,y:280,angle:0};run(g,{x:0,y:0},.4);assert.equal(g.warning,0);
  const loss=live();loss.player={x:300,y:313,angle:0};run(loss,{x:0,y:0},1);assert.equal(loss.phase,'caught');
  const frozen=structuredClone(loss);run(loss,{x:0,y:1},2);assert.deepEqual(loss,frozen);
});
test('the exit requires a key and key collection has a forgiving reach',()=>{
  const g=live();g.player={...EXIT,angle:0};run(g,{},.05);assert.equal(g.phase,'playing');
  g.player={x:KEY.x+23,y:KEY.y,angle:0};run(g,{},.01);assert.equal(g.hasKey,true);
  g.player={...EXIT,angle:0};run(g,{},.01);assert.equal(g.phase,'escaped');
});
test('changing patrol pace while paused preserves the patrol position',()=>{
  const g=live();run(g,{},2);pause(g);const before=guardAt(g.patrolTime,0);g.gentle=true;run(g,{},5);assert.deepEqual(guardAt(g.patrolTime,0),before);
  resume(g);run(g,{},1);assert.ok(Math.abs(g.patrolTime-2.72)<.001);
});

function move(g,x,y){let n=0;while(Math.hypot(g.player.x-x,g.player.y-y)>1&&g.phase==='playing'&&n++<4000){const dx=x-g.player.x,dy=y-g.player.y;update(g,{x:Math.abs(dx)<.8?0:Math.sign(dx),y:Math.abs(dy)<.8?0:Math.sign(dy)},1/120);}assert.notEqual(g.phase,'caught',`caught travelling toward ${x},${y} at ${g.time.toFixed(2)}`);assert.ok(n<4000);}
test('a full route wins using normal movement, waiting and two galleries',()=>{
  const g=live();move(g,112,285);move(g,112,105);
  while(true){const guard=guardAt(g.patrolTime,1);if(guard.angle===Math.PI&&guard.x<260)break;run(g,{},1/60);}
  move(g,397,105);assert.equal(g.hasKey,true);move(g,500,105);move(g,500,285);
  // Wait for the lower shadow to leave the east end before coming out below it.
  while(true){const guard=guardAt(g.patrolTime,0);if(guard.angle===Math.PI&&guard.x<360)break;run(g,{},1/60);}
  move(g,500,495);move(g,300,495);move(g,300,531);
  assert.equal(g.phase,'escaped');assert.ok(g.crossings>=4);assert.ok(g.time<35);
});
