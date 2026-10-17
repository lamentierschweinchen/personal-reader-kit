// The complete game model is independent of the DOM. Units are castle-floor units.
export const WORLD = 600;
export const RADIUS = 11;
export const SPEED = 136;
export const BOUNDS = {left: 49, top: 49, right: 551, bottom: 551};
export const KEY = {x: 397, y: 91};
export const EXIT = {x: 300, y: 531};
export const PILLARS = [
  {x: 228, y: 196, w: 144, h: 60},
  {x: 228, y: 371, w: 144, h: 52},
];
export const COVERS = [
  {id:'south-west', x: 65, y: 452, w: 105, h: 88},
  {id:'south-east', x: 435, y: 452, w: 100, h: 88},
  {id:'west', x: 60, y: 244, w: 96, h: 84},
  {id:'east', x: 444, y: 244, w: 96, h: 84},
  {id:'north-west', x: 60, y: 61, w: 100, h: 83},
  {id:'north-east', x: 458, y: 61, w: 82, h: 83},
];
export const PATROLS = [
  {from: 130, to: 470, y: 313, speed: 65, range: 203, half: .70, offset: 1.0},
  {from: 132, to: 467, y: 163, speed: 57, range: 192, half: .72, offset: 4.8},
];
const TURN = .85;
export function createGame(gentle = false) {
  return {phase:'ready', gentle, time:0, patrolTime:0, player:{x:112,y:495,angle:-Math.PI/2},
    hasKey:false, warning:0, exposed:false, cover:'south-west', crossings:0,
    keyAt:null, message:'Take the key. Reach the gate.'};
}
export function start(game) { game.phase='playing'; }
export function pause(game) { if(game.phase==='playing') game.phase='paused'; }
export function resume(game) { if(game.phase==='paused') game.phase='playing'; }
export function coverAt(x,y) {
  // A fully enclosed centre ring is the promise: brushing a corner is not cover.
  return COVERS.find(c => x>=c.x+RADIUS && x<=c.x+c.w-RADIUS && y>=c.y+RADIUS && y<=c.y+c.h-RADIUS)?.id || null;
}
export function guardAt(time,index,gentle=false) {
  const p=PATROLS[index], speed=p.speed*(gentle?.72:1), travel=(p.to-p.from)/speed;
  const t=(time+p.offset)%(2*travel+2*TURN);
  let x,angle,turning=false;
  if(t<travel){x=p.from+t*speed;angle=0;}
  else if(t<travel+TURN){x=p.to;angle=(t-travel)/TURN*Math.PI;turning=true;}
  else if(t<2*travel+TURN){x=p.to-(t-travel-TURN)*speed;angle=Math.PI;}
  else{x=p.from;angle=Math.PI+(t-2*travel-TURN)/TURN*Math.PI;turning=true;}
  return {...p,x,angle,turning};
}
export function segmentRect(x1,y1,x2,y2,r) {
  // Slab intersection. The same occluders drive detection and the visible fans.
  let lo=0,hi=1;
  for(const [a,d,min,max] of [[x1,x2-x1,r.x,r.x+r.w],[y1,y2-y1,r.y,r.y+r.h]]){
    if(Math.abs(d)<1e-9){if(a<min || a>max) return null;}
    else {let u=(min-a)/d,v=(max-a)/d;if(u>v)[u,v]=[v,u];lo=Math.max(lo,u);hi=Math.min(hi,v);if(lo>hi)return null;}
  }
  return lo;
}
export function visible(guard,x,y) {
  const dx=x-guard.x,dy=y-guard.y,dist=Math.hypot(dx,dy);
  if(dist>guard.range)return false;
  const delta=Math.atan2(Math.sin(Math.atan2(dy,dx)-guard.angle),Math.cos(Math.atan2(dy,dx)-guard.angle));
  if(Math.abs(delta)>guard.half)return false;
  return !PILLARS.some(r=>segmentRect(guard.x,guard.y,x,y,r)!==null);
}
export function fanPoints(guard) {
  const points=[[guard.x,guard.y]];
  for(let i=0;i<=48;i++){
    const a=guard.angle-guard.half+2*guard.half*i/48;
    const dx=Math.cos(a)*guard.range,dy=Math.sin(a)*guard.range;
    let ratio=1;
    for(const r of PILLARS){const n=segmentRect(guard.x,guard.y,guard.x+dx,guard.y+dy,r);if(n!==null)ratio=Math.min(ratio,n);}
    // Clamp the fan against the interior walls as well.
    if(dx>0)ratio=Math.min(ratio,(BOUNDS.right-guard.x)/dx);
    if(dx<0)ratio=Math.min(ratio,(BOUNDS.left-guard.x)/dx);
    if(dy>0)ratio=Math.min(ratio,(BOUNDS.bottom-guard.y)/dy);
    if(dy<0)ratio=Math.min(ratio,(BOUNDS.top-guard.y)/dy);
    points.push([guard.x+dx*ratio,guard.y+dy*ratio]);
  }
  return points.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' ');
}
export function collides(x,y) {
  return PILLARS.some(r => Math.hypot(x-Math.max(r.x,Math.min(x,r.x+r.w)), y-Math.max(r.y,Math.min(y,r.y+r.h)))<RADIUS);
}
export function update(game,input,dt) {
  if(game.phase!=='playing') return;
  // Small steps prevent tunnelling and detection jumps, including slow frames.
  const total=Math.min(Math.max(dt,0),.12), steps=Math.max(1,Math.ceil(total/(1/90))), delta=total/steps;
  for(let i=0;i<steps && game.phase==='playing';i++) tick(game,input,delta);
}
function tick(g,input,dt) {
  g.time+=dt;
  g.patrolTime+=dt*(g.gentle?.72:1);
  const p=g.player,len=Math.hypot(input.x||0,input.y||0), moving=len>0;
  if(moving){
    const dx=input.x/len*SPEED*dt,dy=input.y/len*SPEED*dt;
    let nx=Math.max(BOUNDS.left+RADIUS,Math.min(BOUNDS.right-RADIUS,p.x+dx));
    if(!collides(nx,p.y))p.x=nx;
    let ny=Math.max(BOUNDS.top+RADIUS,Math.min(BOUNDS.bottom-RADIUS,p.y+dy));
    if(!collides(p.x,ny))p.y=ny;
    p.angle=Math.atan2(input.y,input.x);
  }
  const before=g.cover;
  g.cover=coverAt(p.x,p.y);
  if(before&&!g.cover)g.crossings++;
  const guards=PATROLS.map((_,i)=>guardAt(g.patrolTime,i));
  g.exposed=!g.cover&&guards.some(s=>visible(s,p.x,p.y)||Math.hypot(p.x-s.x,p.y-s.y)<25);
  g.warning=Math.max(0,Math.min(1,g.warning+dt*(g.exposed?(g.gentle?1/1.35:1/.85):-1.8)));
  if(g.warning>=1){g.phase='caught';g.message='The shadows found you.';return;}
  if(!g.hasKey&&Math.hypot(p.x-KEY.x,p.y-KEY.y)<26){
    g.hasKey=true;g.keyAt=g.time;g.message='Key in hand. Reach the gate.';
  }
  if(g.hasKey&&Math.hypot(p.x-EXIT.x,p.y-EXIT.y)<28){
    g.phase='escaped';g.message='The night is yours.';g.warning=0;
  }
}
