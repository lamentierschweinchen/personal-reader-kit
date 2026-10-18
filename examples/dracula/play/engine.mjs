// Castle escape: deterministic, DOM-free room simulation. One room is always visible.
export const WORLD=600, RADIUS=11, SPEED=112;
export const BOUNDS={left:49,top:49,right:551,bottom:551};
const cover=(id,x,y,w,h)=>({id,x,y,w,h});
const patrol=(points,speed,range,half,offset=0)=>({points,speed,range,half,offset,turn:.85});
export const STAGES=[
  {
    id:'guest-wing',title:'The guest wing',short:'Guest wing',intro:'Find the brass key, unlock the arch, and lift the stair bolt in the west room.',
    cleared:'The stair leads down to a shuttered chapel. A second lock bars the passage beyond it.',
    spawn:{x:105,y:500},exit:{x:495,y:95,label:'STAIR'},carry:[],requires:['brass','bolt'],
    walls:[{x:49,y:273,w:201,h:26},{x:350,y:273,w:201,h:26},{x:250,y:49,w:100,h:95}],
    covers:[cover('start',65,458,86,82),cover('lower-east',450,458,88,82),cover('key-niche',455,308,84,72),cover('arch',262,310,76,68),cover('north-west',62,64,88,78),cover('stair',452,61,88,82)],
    items:[{id:'brass',kind:'key',name:'Brass key',label:'1 · KEY',x:497,y:342},{id:'bolt',kind:'bolt',name:'Stair bolt',label:'2 · BOLT',x:107,y:100,requires:['brass']}],
    doors:[{id:'arch',x:250,y:273,w:100,h:26,requires:['brass'],name:'Brass key needed'}],
    patrols:[patrol([[165,420],[470,420],[470,350],[165,350]],62,232,.82,1.5),patrol([[135,174],[470,174]],60,230,.84,3.2)],
    labels:[{x:300,y:435,text:'GUEST WING'},{x:163,y:240,text:'NORTH GALLERY'}],candles:[[64,284],[536,284],[252,86],[349,86]]
  },
  {
    id:'chapel',title:'The shuttered chapel',short:'Chapel',intro:'The iron key opens the cross-door. Take the winch handle through the chapel to the stair.',
    cleared:'The handle fits the gatehouse winch. Find the last key, raise the chain, and leave the castle.',
    spawn:{x:107,y:497},exit:{x:495,y:95,label:'STAIR'},carry:['brass'],requires:['iron','handle'],
    walls:[{x:282,y:49,w:30,h:179},{x:282,y:320,w:30,h:231},{x:49,y:278,w:116,h:32},{x:202,y:125,w:32,h:78},{x:390,y:210,w:62,h:140}],
    covers:[cover('start',65,451,86,89),cover('west-turn',183,326,78,68),cover('west-niche',61,175,91,65),cover('key-niche',61,62,92,78),cover('door-west',196,223,73,49),cover('door-east',325,244,56,62),cover('handle-niche',454,451,86,89),cover('east-niche',470,270,70,69),cover('stair',452,61,88,82)],
    items:[{id:'iron',kind:'key',name:'Iron key',label:'1 · KEY',x:106,y:99},{id:'handle',kind:'handle',name:'Winch handle',label:'2 · HANDLE',x:496,y:490}],
    doors:[{id:'cross-door',x:282,y:228,w:30,h:92,requires:['brass','iron'],name:'Iron key needed'}],
    patrols:[patrol([[190,470],[190,218]],53,214,.82,0),patrol([[346,412],[518,412]],57,210,.88,1.7),patrol([[350,166],[516,166]],52,207,.85,3.5)],
    labels:[{x:116,y:354,text:'VESTRY'},{x:485,y:238,text:'CHAPEL'}],candles:[[285,75],[307,75],[395,216],[447,216],[288,492],[307,492]]
  },
  {
    id:'gatehouse',title:'The gatehouse',short:'Gatehouse',intro:'Find the gate key. It releases the winch: fit the handle, raise the chain, then reach the south gate.',
    cleared:'The chain lifts. The key turns. Beyond the walls, the road is empty.',
    spawn:{x:100,y:495},exit:{x:300,y:531,label:'WAY OUT'},carry:['brass','iron','handle'],requires:['winch','gate-key'],
    walls:[{x:49,y:280,w:121,h:26},{x:245,y:280,w:140,h:26},{x:460,y:280,w:91,h:26},{x:280,y:140,w:40,h:90},{x:100,y:360,w:65,h:65},{x:435,y:360,w:60,h:65},{x:210,y:400,w:24,h:151},{x:366,y:400,w:24,h:151},{x:234,y:465,w:26,h:24},{x:340,y:465,w:26,h:24}],
    covers:[cover('start',61,453,82,87),cover('east-low',455,453,83,87),cover('west-pass',177,317,62,65),cover('east-pass',393,317,62,65),cover('winch-niche',61,61,92,82),cover('key-niche',451,61,89,82),cover('gate-niche',256,321,89,67),cover('west-high',63,211,83,57),cover('east-high',467,211,72,57)],
    items:[{id:'gate-key',kind:'key',name:'Gate key',label:'1 · KEY',x:496,y:100},{id:'winch',kind:'winch',name:'Chain raised',label:'2 · WINCH',x:107,y:100,requires:['handle','gate-key']}],
    doors:[{id:'last-gate',x:260,y:465,w:80,h:24,requires:['winch','gate-key'],name:'Raise the chain and find the gate key'}],
    patrols:[patrol([[200,80],[200,235]],53,235,.80,3),patrol([[400,235],[400,80]],57,235,.80,6),patrol([[180,250],[421,250]],58,223,.80,4),patrol([[187,370],[417,370]],55,206,.82,3.4)],
    labels:[{x:300,y:261,text:'CROSSING'},{x:300,y:435,text:'SOUTH GATE'}],candles:[[170,285],[246,285],[384,285],[460,285],[215,430],[387,430]]
  }
];
export function createGame({stage=0,gentle=false,completed=0}={}){
  const room=STAGES[stage];return {stage,completed,gentle,phase:'ready',time:0,patrolTime:0,
    player:{...room.spawn,angle:-Math.PI/2},inventory:[...room.carry],opened:[],warning:0,exposed:false,
    cover:coverAt(stage,room.spawn.x,room.spawn.y),crossings:0,event:0,message:'',messageAt:-10};
}
export const roomFor=g=>STAGES[g.stage];
export function start(g){if(g.phase==='ready')g.phase='playing';}
export function pause(g){if(g.phase==='playing')g.phase='paused';}
export function resume(g){if(g.phase==='paused')g.phase='playing';}
export function retry(g){return createGame({stage:g.stage,gentle:g.gentle,completed:g.completed});}
export function nextRoom(g){return createGame({stage:g.stage+1,gentle:g.gentle,completed:g.completed});}
export function coverAt(stage,x,y){return STAGES[stage].covers.find(c=>x>=c.x+RADIUS&&x<=c.x+c.w-RADIUS&&y>=c.y+RADIUS&&y<=c.y+c.h-RADIUS)?.id||null;}
export function solids(g){return [...roomFor(g).walls,...roomFor(g).doors.filter(d=>!g.opened.includes(d.id))];}
export function segmentRect(x1,y1,x2,y2,r){
  let lo=0,hi=1;for(const[a,d,min,max]of[[x1,x2-x1,r.x,r.x+r.w],[y1,y2-y1,r.y,r.y+r.h]]){
    if(Math.abs(d)<1e-9){if(a<min||a>max)return null;}else{let u=(min-a)/d,v=(max-a)/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)return null;}}
  return lo;
}
export function guardAt(g,index){
  const p=roomFor(g).patrols[index],legs=p.points.map((a,i)=>{const b=p.points[(i+1)%p.points.length];return {a,b,duration:Math.hypot(b[0]-a[0],b[1]-a[1])/p.speed,angle:Math.atan2(b[1]-a[1],b[0]-a[0])};});
  const cycle=legs.reduce((n,l)=>n+l.duration+p.turn,0);let t=(g.patrolTime+p.offset)%cycle;
  for(let i=0;i<legs.length;i++){
    const l=legs[i];if(t<=l.duration)return {...p,x:l.a[0]+(l.b[0]-l.a[0])*t/l.duration,y:l.a[1]+(l.b[1]-l.a[1])*t/l.duration,angle:l.angle,turning:false};
    t-=l.duration;if(t<=p.turn){const next=legs[(i+1)%legs.length].angle;let angle=Math.atan2(Math.sin(next-l.angle),Math.cos(next-l.angle));if(Math.abs(angle+Math.PI)<.001)angle=Math.PI;return {...p,x:l.b[0],y:l.b[1],angle:l.angle+angle*t/p.turn,turning:true};}t-=p.turn;
  }return {...p,x:p.points[0][0],y:p.points[0][1],angle:0,turning:false};
}
export function visible(g,s,x,y){const dx=x-s.x,dy=y-s.y;if(Math.hypot(dx,dy)>s.range)return false;const a=Math.atan2(Math.sin(Math.atan2(dy,dx)-s.angle),Math.cos(Math.atan2(dy,dx)-s.angle));return Math.abs(a)<=s.half&&!solids(g).some(r=>segmentRect(s.x,s.y,x,y,r)!==null);}
export function fanPoints(g,s){const points=[[s.x,s.y]],walls=solids(g);for(let i=0;i<=56;i++){const a=s.angle-s.half+2*s.half*i/56,dx=Math.cos(a)*s.range,dy=Math.sin(a)*s.range;let ratio=1;for(const r of walls){const n=segmentRect(s.x,s.y,s.x+dx,s.y+dy,r);if(n!==null)ratio=Math.min(ratio,n);}if(dx>0)ratio=Math.min(ratio,(BOUNDS.right-s.x)/dx);if(dx<0)ratio=Math.min(ratio,(BOUNDS.left-s.x)/dx);if(dy>0)ratio=Math.min(ratio,(BOUNDS.bottom-s.y)/dy);if(dy<0)ratio=Math.min(ratio,(BOUNDS.top-s.y)/dy);points.push([s.x+dx*ratio,s.y+dy*ratio]);}return points.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' ');}
export function distanceRect(x,y,r){return Math.hypot(x-Math.max(r.x,Math.min(x,r.x+r.w)),y-Math.max(r.y,Math.min(y,r.y+r.h)));}
export function collides(g,x,y){return solids(g).some(r=>distanceRect(x,y,r)<RADIUS);}
export function objective(g){const item=roomFor(g).items.find(i=>!g.inventory.includes(i.id));return item?(item.kind==='winch'?'Turn the winch':item.kind==='bolt'?'Lift the stair bolt':'Find the '+item.name.toLowerCase()):(g.stage===2?'Reach the south gate':'Reach the north stair');}
function notify(g,message){g.message=message;g.messageAt=g.time;g.event++;}
export function update(g,input,dt){if(g.phase!=='playing')return;const total=Math.min(Math.max(dt,0),.12),steps=Math.max(1,Math.ceil(total/(1/90)));for(let i=0;i<steps&&g.phase==='playing';i++)tick(g,input,total/steps);}
function tick(g,input,dt){
  const room=roomFor(g),p=g.player;g.time+=dt;g.patrolTime+=dt*(g.gentle?.72:1);
  for(const d of room.doors){if(!g.opened.includes(d.id)&&d.requires.every(id=>g.inventory.includes(id))&&distanceRect(p.x,p.y,d)<38){g.opened.push(d.id);notify(g,d.id==='last-gate'?'The gate is open.':'The lock gives way.');}}
  const len=Math.hypot(input.x||0,input.y||0);if(len){const dx=input.x/len*SPEED*dt,dy=input.y/len*SPEED*dt;const nx=Math.max(60,Math.min(540,p.x+dx));if(!collides(g,nx,p.y))p.x=nx;const ny=Math.max(60,Math.min(540,p.y+dy));if(!collides(g,p.x,ny))p.y=ny;p.angle=Math.atan2(input.y,input.x);}
  const before=g.cover;g.cover=coverAt(g.stage,p.x,p.y);if(before&&!g.cover)g.crossings++;
  const patrols=room.patrols.map((_,i)=>guardAt(g,i));const contact=patrols.some(s=>Math.hypot(p.x-s.x,p.y-s.y)<25&&!solids(g).some(r=>segmentRect(s.x,s.y,p.x,p.y,r)!==null));
  g.exposed=!g.cover&&(contact||patrols.some(s=>visible(g,s,p.x,p.y)));
  g.warning=Math.max(0,Math.min(1,g.warning+dt*(g.exposed?(g.gentle?1/1.35:contact?1/.55:1/.85):-1.65)));
  if(g.warning>=1){g.phase='caught';notify(g,'A shadow found you.');return;}
  for(const item of room.items){if(!g.inventory.includes(item.id)&&(!item.requires||item.requires.every(id=>g.inventory.includes(id)))&&Math.hypot(p.x-item.x,p.y-item.y)<24){g.inventory.push(item.id);notify(g,item.kind==='winch'?'The chain is raised.':item.kind==='bolt'?'The stair is unbolted.':item.name+' in hand.');}}
  if(len&&g.time-g.messageAt>3){const locked=room.doors.find(d=>!g.opened.includes(d.id)&&distanceRect(p.x,p.y,d)<24);if(locked)notify(g,locked.name);const station=room.items.find(i=>i.requires&&!i.requires.every(id=>g.inventory.includes(id))&&Math.hypot(p.x-i.x,p.y-i.y)<24);if(station)notify(g,'The gate key releases the winch.');}
  if(Math.hypot(p.x-room.exit.x,p.y-room.exit.y)<23&&room.requires.every(id=>g.inventory.includes(id))&&room.doors.every(d=>g.opened.includes(d.id))){g.completed=Math.max(g.completed,g.stage+1);g.phase=g.stage===STAGES.length-1?'escaped':'interlude';g.warning=0;g.exposed=false;notify(g,g.phase==='escaped'?'You escaped the castle.':'Room cleared.');}
}
