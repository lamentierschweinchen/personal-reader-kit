import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {STORY,EDITION_SHA256} from '../play/story.mjs';
import {decodeProgress,loadProgress,preserveDamagedSave,SAVE_KEY} from '../play/progress.mjs';
import assert from 'node:assert/strict';
import {STAGES,VIEW,RADIUS,boundsFor,cameraFor,createGame,roomFor,start,pause,resume,retry,nextRoom,update,guardAt,visible,coverAt,collides,segmentRect,fanPoints} from '../play/engine.mjs';

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
  const chapel=live(1);place(chapel,368,273);run(chapel,{x:1,y:0},.35);
  assert.ok(chapel.player.x<=392-RADIUS+.001);assert.deepEqual(chapel.opened,[]);
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
      const bounds=boundsFor(s);assert.ok(points.every((n,i)=>Number.isFinite(n)&&n>=49-.01&&n<=(i%2?bounds.bottom:bounds.right)+.01));
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

test('the library carries the brass key, but requires a crowbar to lift the bars and a handle to carry onward',()=>{
  const g=live(1);assert.deepEqual(g.inventory,['brass']);approachDoor(g);assert.deepEqual(g.opened,[]);
  collect(g,'crowbar');approachDoor(g);assert.deepEqual(g.opened,['cross-door']);exit(g);assert.equal(g.phase,'playing');
  collect(g,'handle');exit(g);assert.equal(g.phase,'interlude');assert.equal(g.completed,2);
});

test('the gate key releases the winch; both winch and key are needed at the final gate',()=>{
  const g=live(4);assert.ok(g.inventory.includes('handle'));
  collect(g,'winch');assert.ok(!g.inventory.includes('winch'));approachDoor(g);assert.deepEqual(g.opened,[]);
  collect(g,'gate-key');approachDoor(g);assert.deepEqual(g.opened,[]);
  collect(g,'winch');assert.ok(g.inventory.includes('winch'));approachDoor(g);assert.deepEqual(g.opened,['last-gate']);
  exit(g);assert.equal(g.phase,'escaped');assert.equal(g.completed,5);
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


test('each room grows in width, depth and walkable floor, with useful objects on its far sides',()=>{
  assert.deepEqual(STAGES.map(({width,height})=>[width,height]),[[600,600],[900,720],[1050,780],[1120,840],[1200,900]]);
  let area=0;
  for(let i=0;i<STAGES.length;i++){
    const room=STAGES[i],walkable=(room.width-98)*(room.height-98)-room.walls.reduce((sum,w)=>sum+w.w*w.h,0);
    assert.ok(walkable>area);area=walkable;
    if(i){assert.ok(room.items.some(p=>p.x>room.width-160));assert.ok([...room.items,room.exit].some(p=>p.y>room.height-160));}
  }
});

test('camera follows across the expanded floor without reducing its view scale or leaving world bounds',()=>{
  for(let stage=0;stage<STAGES.length;stage++){
    const g=live(stage),room=roomFor(g),bounds=boundsFor(g);
    for(const p of [room.spawn,...room.items,room.exit,{x:bounds.right-RADIUS,y:bounds.bottom-RADIUS}]){
      place(g,p.x,p.y);const camera=cameraFor(g);
      assert.equal(camera.width,VIEW);assert.equal(camera.height,VIEW);
      assert.ok(camera.x>=0&&camera.x+VIEW<=room.width);assert.ok(camera.y>=0&&camera.y+VIEW<=room.height);
      assert.ok(p.x>=camera.x&&p.x<=camera.x+VIEW&&p.y>=camera.y&&p.y<=camera.y+VIEW);
    }
    if(stage){place(g,bounds.right-RADIUS,bounds.bottom-RADIUS);assert.equal(cameraFor(g).x,room.width-VIEW);assert.equal(cameraFor(g).y,room.height-VIEW);}
  }
});


test('new chapel and courtyard require their useful objects and preserve the onward tools',()=>{
 for(const stage of [2,3]){
  const g=live(stage);exit(g);assert.equal(g.phase,'playing');
  for(const item of roomFor(g).items)collect(g,item.id);
  approachDoor(g);exit(g);assert.equal(g.phase,'interlude');assert.equal(g.completed,stage+1);
  const n=nextRoom(g);assert.ok(n.inventory.includes(stage===2?'rope':'spindle'));
 }
 const g=live(4);g.inventory=g.inventory.filter(id=>id!=='spindle');collect(g,'gate-key');collect(g,'winch');assert.ok(!g.inventory.includes('winch'));
 g.inventory.push('spindle');collect(g,'winch');assert.ok(g.inventory.includes('winch'));
});

test('five journal excerpts are contiguous, exact and attributed to the pinned source paragraphs',async()=>{
 const bytes=await readFile(new URL('../edition/library.json',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),EDITION_SHA256);
 const book=JSON.parse(bytes)[0];assert.equal(STORY.length,STAGES.length);
 for(const story of STORY){
  const section=book.sections.find(s=>s.id===story.section),block=section.blocks.find(b=>b.id===story.block);
  assert.equal(block.text.slice(story.start,story.end),story.quote);assert.ok(story.quote.split(/\s+/).length<=40);
  assert.ok(story.context.includes(story.block));assert.equal(story.href,'#reference/'+story.section+'/'+story.block);
  for(const id of story.context){const b=section.blocks.find(b=>b.id===id);assert.ok(b);assert.deepEqual(b.marks,[]);assert.equal(b.kind,'prose');}
 }
});

test('legacy checkpoints credit only the unchanged first two rooms and never complete five',()=>{
 for(const completed of [0,1,2,3]){
  const old=JSON.stringify({version:2,completed,gentle:true});const result=decodeProgress(null,old);
  assert.equal(result.save.completed,Math.min(completed,2));assert.equal(result.save.version,3);assert.equal(result.save.gentle,true);assert.equal(result.blocked,false);assert.equal(result.migrated,true);
 }
});

test('current checkpoints win over legacy, while malformed current data stays quarantined',()=>{
 const prior=JSON.stringify({version:2,completed:3,gentle:true});
 for(const completed of [0,1,2,3,4,5]){
  const current={version:3,completed,gentle:false};const result=decodeProgress(JSON.stringify(current),prior);
  assert.deepEqual(result.save,current);assert.equal(result.migrated,false);assert.equal(result.blocked,false);
 }
 for(const bad of ['','{broken','null','[]',JSON.stringify({version:3,completed:6,gentle:false}),JSON.stringify({version:2,completed:3,gentle:false})]){
  const result=decodeProgress(bad,prior);assert.equal(result.blocked,true);assert.equal(result.save.completed,0);
 }
 const legacyBad=decodeProgress(null,'{broken');assert.equal(legacyBad.blocked,false);assert.equal(legacyBad.save.completed,0);assert.match(legacyBad.message,/left untouched/);
 const blocked=loadProgress({getItem(){throw Error('blocked');}});assert.equal(blocked.save.completed,0);assert.match(blocked.message,/storage is unavailable/);
});


test('explicit replay preserves malformed current raw data without replacing an older recovery',()=>{
 const map=new Map([[SAVE_KEY,'{broken'],[SAVE_KEY+'-recovery','older damage']]);
 const storage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};
 const key=preserveDamagedSave(storage);assert.equal(key,SAVE_KEY+'-recovery-1');assert.equal(map.get(key),'{broken');assert.equal(map.get(SAVE_KEY),'{broken');assert.equal(map.get(SAVE_KEY+'-recovery'),'older damage');
 assert.throws(()=>preserveDamagedSave({...storage,setItem(){throw Error('quota');}}));assert.equal(map.get(SAVE_KEY),'{broken');
});
