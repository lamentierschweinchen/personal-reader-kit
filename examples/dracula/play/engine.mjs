// Castle escape: deterministic room simulation; a fixed-size view follows Harker through larger rooms.
export const VIEW=600, RADIUS=11, SPEED=112;
const cover=(id,x,y,w,h)=>({id,x,y,w,h});
const patrol=(points,speed,range,half,offset=0)=>({points,speed,range,half,offset,turn:.85});
export const STAGES=[
  {
    id:'guest-wing',theme:'guest',width:600,height:600,title:'The guest wing',short:'Guest wing',intro:'Find the brass key, unlock the arch, and lift the stair bolt in the west room.',
    cleared:'The stair leads to a room lined with English books.',
    spawn:{x:105,y:500},exit:{x:495,y:95,label:'STAIR'},carry:[],requires:['brass','bolt'],
    walls:[{x:49,y:273,w:201,h:26},{x:350,y:273,w:201,h:26},{x:250,y:49,w:100,h:95,kind:'hearth'}],
    covers:[cover('start',65,458,86,82),cover('lower-east',450,458,88,82),cover('key-niche',455,308,84,72),cover('arch',262,310,76,68),cover('north-west',62,64,88,78),cover('stair',452,61,88,82)],
    items:[{id:'brass',kind:'key',name:'Brass key',label:'1 · KEY',x:497,y:342},{id:'bolt',kind:'bolt',name:'Stair bolt',label:'2 · BOLT',x:107,y:100,requires:['brass']}],
    doors:[{id:'arch',x:250,y:273,w:100,h:26,requires:['brass'],name:'Brass key needed'}],
    patrols:[patrol([[165,420],[470,420],[470,350],[165,350]],62,232,.82,1.5),patrol([[135,174],[470,174]],60,230,.84,3.2)],
    labels:[{x:300,y:435,text:'GUEST WING'},{x:163,y:240,text:'NORTH GALLERY'}],candles:[[64,284],[536,284],[252,86],[349,86]]
  },
  {
    id:'library',theme:'library',width:900,height:720,title:'The library gallery',short:'Library',
    intro:'Find the crowbar, force the barred passage, then carry the winch handle to the north stair.',
    cleared:'Below the library, a dark stair descends to the ruined chapel.',
    spawn:{x:107,y:615},exit:{x:795,y:95,label:'STAIR'},carry:['brass'],requires:['crowbar','handle'],
    walls:[{x:392,y:49,w:30,h:179},{x:392,y:320,w:30,h:351},{x:49,y:398,w:166,h:30},{x:240,y:125,w:32,h:78,kind:'books'},{x:610,y:210,w:62,h:190,kind:'table'}],
    covers:[cover('start',65,569,86,89),cover('west-turn',263,446,78,68),cover('west-middle',270,326,78,68),cover('west-niche',61,175,91,65),cover('key-niche',61,62,92,78),cover('door-west',306,223,73,49),cover('door-east',435,244,65,62),cover('right-middle',515,443,78,68),cover('handle-niche',754,571,86,89),cover('east-niche',770,340,70,69),cover('stair',752,61,88,82)],
    items:[{id:'crowbar',kind:'crowbar',name:'Crowbar',label:'1 · CROWBAR',x:106,y:99},{id:'handle',kind:'handle',name:'Winch handle',label:'2 · HANDLE',x:795,y:610}],
    doors:[{id:'cross-door',kind:'shutter',x:392,y:228,w:30,h:92,requires:['crowbar'],name:'A crowbar will lift these bars'}],
    patrols:[patrol([[285,600],[285,218]],53,214,.82,6),patrol([[455,520],[818,520]],62,240,.88,2),patrol([[460,166],[816,166]],58,235,.85,0)],
    labels:[{x:144,y:480,text:'READING ROOM'},{x:722,y:276,text:'LIBRARY'},{x:645,y:630,text:'SOUTH GALLERY'}],
    candles:[[395,75],[417,75],[615,216],[667,216],[398,552],[417,552],[637,395]]
  },
  {
    id:'ruined-chapel',theme:'chapel',width:1050,height:780,title:'The ruined chapel',short:'Chapel',
    intro:'Find the iron key, unlock the crossing, then take the rope to the courtyard stair.',
    cleared:'The chapel stair comes out beneath the courtyard arches. The gatehouse is across the yard.',
    spawn:{x:100,y:680},exit:{x:950,y:100,label:'YARD'},carry:['brass','crowbar','handle'],requires:['iron-key','rope'],
    walls:[{x:49,y:390,w:361,h:28},{x:500,y:390,w:501,h:28},{x:285,y:530,w:110,h:34,kind:'pew'},{x:650,y:530,w:110,h:34,kind:'pew'},{x:510,y:180,w:125,h:90,kind:'tomb'}],
    covers:[cover('start',61,641,80,80),cover('south-west',260,641,80,80),cover('south-middle',460,641,80,80),cover('south-east',700,641,80,80),cover('key',910,641,80,80),cover('east-low',910,425,80,72),cover('east-middle',760,425,80,72),cover('crossing-south',416,425,78,72),cover('crossing-north',416,285,78,77),cover('west-middle',260,295,80,72),cover('west-high',65,295,80,72),cover('rope',65,61,80,80),cover('north',460,61,80,80),cover('exit',910,61,80,80)],
    items:[{id:'iron-key',kind:'key',name:'Iron key',label:'1 · KEY',x:950,y:680},{id:'rope',kind:'rope',name:'Rope',label:'2 · ROPE',x:105,y:100}],
    doors:[{id:'chapel-crossing',x:410,y:390,w:90,h:28,requires:['iron-key'],name:'Find the iron key beyond the pews'}],
    patrols:[patrol([[180,590],[475,590]],62,215,.8,2),patrol([[575,590],[920,590]],60,225,.8,5),patrol([[160,300],[445,300]],60,220,.82,3),patrol([[600,150],[935,150]],66,235,.82,5)],
    labels:[{x:520,y:602,text:'SOUTH TRANSEPT'},{x:305,y:194,text:'RUINED CHAPEL'},{x:805,y:278,text:'BROKEN VAULT'}],
    candles:[[65,397],[398,397],[511,397],[986,397],[515,185],[630,185]]
  },
  {
    id:'courtyard',theme:'court',width:1120,height:840,title:'The silent courtyard',short:'Courtyard',
    intro:'Find the winch spindle and free the carriage bolt. Leave by the east stair.',
    cleared:'Handle, rope and spindle in hand, you reach the gatehouse. One last key holds the chain.',
    spawn:{x:100,y:740},exit:{x:1015,y:100,label:'STAIR'},carry:['brass','crowbar','handle','iron-key','rope'],requires:['spindle','yard-bolt'],
    walls:[{x:470,y:49,w:28,h:160},{x:470,y:309,w:28,h:482},{x:135,y:470,w:80,h:74,kind:'crates'},{x:750,y:400,w:125,h:60,kind:'cart'},{x:600,y:350,w:84,h:90,kind:'well'}],
    covers:[cover('start',61,701,80,80),cover('west-low',310,701,80,80),cover('west-middle',310,461,80,80),cover('west-high',310,231,80,80),cover('west-arch',61,231,80,80),cover('spindle',61,61,80,80),cover('door-west',402,220,56,80),cover('door-east',515,220,70,80),cover('east-high',760,225,80,80),cover('east-turn',975,225,80,80),cover('east-middle',975,461,80,80),cover('bolt',975,701,80,80),cover('exit',975,61,80,80)],
    items:[{id:'spindle',kind:'spindle',name:'Winch spindle',label:'1 · SPINDLE',x:100,y:100},{id:'yard-bolt',kind:'bolt',name:'Carriage bolt',label:'2 · BOLT',x:1015,y:740,requires:['crowbar']}],
    doors:[{id:'yard-arch',x:470,y:209,w:28,h:100,requires:['iron-key'],name:'The iron key opens this arch'}],
    patrols:[patrol([[270,690],[270,330]],60,230,.82,5),patrol([[130,180],[420,180]],64,220,.82,2),patrol([[650,620],[1015,620]],64,235,.82,4),patrol([[690,170],[1015,170]],68,230,.8,6)],
    labels:[{x:280,y:590,text:'WEST ARCHES'},{x:795,y:330,text:'COURTYARD'},{x:805,y:716,text:'CARRIAGE WAY'}],
    candles:[[475,75],[493,75],[475,565],[493,565],[609,354],[677,354]]
  },
  {
    id:'gatehouse',theme:'gate',width:1200,height:900,title:'The great gatehouse',short:'Gatehouse',
    intro:'Find the gate key in the far east. Cross the upper gallery to the winch, raise the chain, then reach the south gate.',
    cleared:'The chain lifts. The key turns. Beyond the walls, the road is empty.',
    spawn:{x:100,y:795},exit:{x:600,y:831,label:'WAY OUT'},carry:['brass','crowbar','handle','iron-key','rope','spindle'],requires:['winch','gate-key'],
    walls:[{x:49,y:420,w:161,h:26},{x:310,y:420,w:540,h:26},{x:950,y:420,w:201,h:26},{x:560,y:180,w:80,h:180},{x:100,y:600,w:100,h:100,kind:'crates'},{x:1000,y:600,w:100,h:100,kind:'crates'},{x:510,y:650,w:24,h:201},{x:666,y:650,w:24,h:201},{x:534,y:765,w:26,h:24},{x:640,y:765,w:26,h:24}],
    covers:[cover('start',61,753,82,87),cover('east-low',1055,753,83,87),cover('west-pass',227,477,66,75),cover('east-pass',867,477,66,75),cover('west-middle',378,500,76,72),cover('east-middle',778,500,76,72),cover('winch-niche',61,61,92,82),cover('key-niche',1051,61,89,82),cover('north-niche',555,61,90,82),cover('gate-niche',556,511,89,77),cover('west-high',63,351,83,57),cover('east-high',1067,351,72,57)],
    items:[{id:'gate-key',kind:'key',name:'Gate key',label:'1 · KEY',x:1095,y:100},{id:'winch',kind:'winch',name:'Chain raised',label:'2 · WINCH',x:107,y:100,requires:['handle','rope','spindle','gate-key']}],
    doors:[{id:'last-gate',x:560,y:765,w:80,h:24,requires:['winch','gate-key'],name:'Raise the chain and find the gate key'}],
    patrols:[patrol([[300,80],[300,365]],58,245,.80,3),patrol([[900,365],[900,80]],62,245,.80,6),patrol([[260,390],[900,390]],66,235,.80,4),patrol([[240,600],[500,600]],60,245,.82,3.4),patrol([[700,600],[960,600]],62,245,.82,1.8)],
    labels:[{x:450,y:280,text:'UPPER GALLERY'},{x:750,y:280,text:'EAST GALLERY'},{x:600,y:485,text:'GREAT HALL'},{x:600,y:710,text:'SOUTH GATE'}],
    candles:[[210,425],[310,425],[850,425],[950,425],[515,680],[687,680],[562,190],[638,190]]
  }
];
export function createGame({stage=0,gentle=false,completed=0}={}){
  const room=STAGES[stage];return {stage,completed,gentle,phase:'ready',time:0,patrolTime:0,
    player:{...room.spawn,angle:-Math.PI/2},inventory:[...room.carry],opened:[],warning:0,exposed:false,
    cover:coverAt(stage,room.spawn.x,room.spawn.y),crossings:0,event:0,message:'',messageAt:-10};
}
export const roomFor=g=>STAGES[g.stage];
export function boundsFor(g){const room=roomFor(g);return {left:49,top:49,right:room.width-49,bottom:room.height-49};}
export function cameraFor(g){const room=roomFor(g);return {x:Math.max(0,Math.min(room.width-VIEW,g.player.x-VIEW/2)),y:Math.max(0,Math.min(room.height-VIEW,g.player.y-VIEW/2)),width:VIEW,height:VIEW};}
export function targetFor(g){return roomFor(g).items.find(i=>!g.inventory.includes(i.id))||roomFor(g).exit;}
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
export function fanPoints(g,s){const points=[[s.x,s.y]],walls=solids(g),bounds=boundsFor(g);for(let i=0;i<=56;i++){const a=s.angle-s.half+2*s.half*i/56,dx=Math.cos(a)*s.range,dy=Math.sin(a)*s.range;let ratio=1;for(const r of walls){const n=segmentRect(s.x,s.y,s.x+dx,s.y+dy,r);if(n!==null)ratio=Math.min(ratio,n);}if(dx>0)ratio=Math.min(ratio,(bounds.right-s.x)/dx);if(dx<0)ratio=Math.min(ratio,(bounds.left-s.x)/dx);if(dy>0)ratio=Math.min(ratio,(bounds.bottom-s.y)/dy);if(dy<0)ratio=Math.min(ratio,(bounds.top-s.y)/dy);points.push([s.x+dx*ratio,s.y+dy*ratio]);}return points.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' ');}
export function distanceRect(x,y,r){return Math.hypot(x-Math.max(r.x,Math.min(x,r.x+r.w)),y-Math.max(r.y,Math.min(y,r.y+r.h)));}
export function collides(g,x,y){return solids(g).some(r=>distanceRect(x,y,r)<RADIUS);}
export function objective(g){const item=roomFor(g).items.find(i=>!g.inventory.includes(i.id));return item?(item.kind==='winch'?'Turn the winch':item.kind==='bolt'?(item.id==='yard-bolt'?'Draw the carriage bolt':'Lift the stair bolt'):'Find the '+item.name.toLowerCase()):(g.stage===STAGES.length-1?'Reach the south gate':roomFor(g).exit.label==='YARD'?'Reach the courtyard stair':'Reach the north stair');}
function notify(g,message){g.message=message;g.messageAt=g.time;g.event++;}
export function update(g,input,dt){if(g.phase!=='playing')return;const total=Math.min(Math.max(dt,0),.12),steps=Math.max(1,Math.ceil(total/(1/90)));for(let i=0;i<steps&&g.phase==='playing';i++)tick(g,input,total/steps);}
function tick(g,input,dt){
  const room=roomFor(g),p=g.player,bounds=boundsFor(g);g.time+=dt;g.patrolTime+=dt*(g.gentle?.72:1);
  for(const d of room.doors){if(!g.opened.includes(d.id)&&d.requires.every(id=>g.inventory.includes(id))&&distanceRect(p.x,p.y,d)<38){g.opened.push(d.id);notify(g,d.id==='last-gate'?'The gate is open.':d.kind==='shutter'?'The bars lift.':'The lock gives way.');}}
  const len=Math.hypot(input.x||0,input.y||0);if(len){const dx=input.x/len*SPEED*dt,dy=input.y/len*SPEED*dt;const nx=Math.max(bounds.left+RADIUS,Math.min(bounds.right-RADIUS,p.x+dx));if(!collides(g,nx,p.y))p.x=nx;const ny=Math.max(bounds.top+RADIUS,Math.min(bounds.bottom-RADIUS,p.y+dy));if(!collides(g,p.x,ny))p.y=ny;p.angle=Math.atan2(input.y,input.x);}
  const before=g.cover;g.cover=coverAt(g.stage,p.x,p.y);if(before&&!g.cover)g.crossings++;
  const patrols=room.patrols.map((_,i)=>guardAt(g,i));const contact=patrols.some(s=>Math.hypot(p.x-s.x,p.y-s.y)<25&&!solids(g).some(r=>segmentRect(s.x,s.y,p.x,p.y,r)!==null));
  g.exposed=!g.cover&&(contact||patrols.some(s=>visible(g,s,p.x,p.y)));
  g.warning=Math.max(0,Math.min(1,g.warning+dt*(g.exposed?(g.gentle?1/1.35:contact?1/.55:1/.85):-1.65)));
  if(g.warning>=1){g.phase='caught';notify(g,'A shadow found you.');return;}
  for(const item of room.items){if(!g.inventory.includes(item.id)&&(!item.requires||item.requires.every(id=>g.inventory.includes(id)))&&Math.hypot(p.x-item.x,p.y-item.y)<24){g.inventory.push(item.id);notify(g,item.kind==='winch'?'The chain is raised.':item.kind==='bolt'?(item.id==='yard-bolt'?'The carriage bolt is drawn.':'The stair is unbolted.'):item.name+' in hand.');}}
  if(len&&g.time-g.messageAt>3){const locked=room.doors.find(d=>!g.opened.includes(d.id)&&distanceRect(p.x,p.y,d)<24);if(locked)notify(g,locked.name);const station=room.items.find(i=>i.requires&&!i.requires.every(id=>g.inventory.includes(id))&&Math.hypot(p.x-i.x,p.y-i.y)<24);if(station)notify(g,station.kind==='winch'?'Find the gate key to release the winch.':'The crowbar frees this bolt.');}
  if(Math.hypot(p.x-room.exit.x,p.y-room.exit.y)<23&&room.requires.every(id=>g.inventory.includes(id))&&room.doors.every(d=>g.opened.includes(d.id))){g.completed=Math.max(g.completed,g.stage+1);g.phase=g.stage===STAGES.length-1?'escaped':'interlude';g.warning=0;g.exposed=false;notify(g,g.phase==='escaped'?'You escaped the castle.':'Room cleared.');}
}
