export const RULES = Object.freeze({duration:75, capacity:260, pourRate:62, refillSeconds:1.8, emptyGrace:2.1, swaps:[23,43,59,69]});
export const GUESTS = Object.freeze([
  {id:'hatter', name:'Hatter', drain:6.0},
  {id:'hare', name:'March Hare', drain:7.8},
  {id:'dormouse', name:'Dormouse', drain:4.3},
]);

export function newGame() {
  return {phase:'ready', time:0, score:0, misses:0, spills:0, perfects:0, combo:0,
    kettle:RULES.capacity, refill:0, target:null, poured:0, pourSpilled:false, overflow:0,
    swapIndex:0, swapUntil:0, events:[], served:0,
    cups:GUESTS.map((g,i)=>({...g, seat:i, tea:[34,58,74][i], empty:0, reaction:0}))};
}
function emit(s,type,detail={}) {s.events.push({type,...detail});}
export function stopPour(s) {
  if (s.target!==null) {
    const c=s.cups[s.target];
    if(s.phase==='playing' && s.poured>=18 && !s.pourSpilled && c.tea>=82 && c.tea<=96) {
      s.combo++; s.perfects++;
      const points=30+Math.min(s.combo,5)*10;
      s.score+=points; c.reaction=1.4;
      emit(s,'perfect',{id:s.target,points});
    }
  }
  s.target=null; s.poured=0; s.pourSpilled=false; s.overflow=0;
}
export function pour(s,id) {
  if(!Number.isInteger(id) || !s.cups[id]) return false;
  if(s.phase==='ready') {s.phase='playing';emit(s,'start');}
  if(s.phase!=='playing' || s.refill>0 || s.time<s.swapUntil || s.kettle<=0) return false;
  if(s.target===id) return true;
  stopPour(s); s.target=id; return true;
}
export function refill(s) {
  if(s.phase!=='playing' || s.refill>0 || s.kettle>=RULES.capacity-1) return false;
  stopPour(s);s.refill=RULES.refillSeconds;emit(s,'refill');return true;
}
export function pause(s) {
  if(s.phase!=='playing')return;
  stopPour(s);s.phase='paused';emit(s,'pause');
}
export function resume(s) {if(s.phase==='paused'){s.phase='playing';emit(s,'resume');}}
export function tick(s,dt) {
  if(s.phase!=='playing' || !Number.isFinite(dt) || dt<=0)return;
  // Split long frames so a timer hitch cannot skip a complaint or a seat change.
  if(dt>.04){let left=dt;while(left>0){const step=Math.min(.04,left);tick(s,step);left-=step;}return;}
  s.time=Math.min(RULES.duration,s.time+dt);
  if(s.refill>0){s.refill=Math.max(0,s.refill-dt);if(s.refill===0){s.kettle=RULES.capacity;emit(s,'refilled');}}
  const swapAt=RULES.swaps[s.swapIndex];
  if(swapAt && s.time>=swapAt) {
    stopPour(s);s.swapIndex++;s.swapUntil=s.time+.9;
    s.cups.forEach(c=>c.seat=(c.seat+1)%3);emit(s,'swap');
  }
  const moving=s.time<s.swapUntil;
  for(let id=0;id<s.cups.length;id++) {
    const c=s.cups[id]; c.reaction=Math.max(0,c.reaction-dt);
    if(moving)continue;
    c.tea=Math.max(0,c.tea-c.drain*(1+.8*s.time/RULES.duration)*dt);
    if(s.target===id && !s.refill && s.kettle>0) {
      const amount=Math.min(s.kettle,RULES.pourRate*dt);
      const useful=Math.min(100-c.tea,amount),waste=amount-useful;
      s.kettle-=amount;c.tea+=useful;s.poured+=amount;s.served+=useful;s.score+=useful*.16;
      if(waste>0){s.pourSpilled=true;s.overflow+=waste;}
      if(s.overflow>=12){s.overflow-=12;s.score=Math.max(0,s.score-25);s.spills++;s.combo=0;emit(s,'spill',{id,points:-25});}
      if(s.kettle<=.0001){s.kettle=0;stopPour(s);emit(s,'emptyKettle');}
    }
    if(c.tea<=0) {
      c.empty+=dt;
      if(c.empty>=RULES.emptyGrace){
        s.misses++;s.combo=0;c.empty=0;c.tea=42;emit(s,'miss',{id});
        if(s.misses>=3){stopPour(s);s.phase='lost';emit(s,'end');return;}
      }
    } else {c.empty=0;}
  }
  if(s.time>=RULES.duration){stopPour(s);s.phase='won';s.score+=(3-s.misses)*100;emit(s,'end');}
}
