export const RULES=Object.freeze({capacity:210,pourRate:62,refillSeconds:1.8,emptyGrace:1.6,swapSeconds:.8,toastSeconds:.95,cleanSeconds:1,orderSeconds:6.2});
export const GUESTS=Object.freeze([{id:'hatter',name:'Hatter',drain:8},{id:'hare',name:'March Hare',drain:10},{id:'dormouse',name:'Dormouse',drain:6}]);
export const COURSES=Object.freeze([
 {title:'Time for tea',duration:32,factor:1,swaps:[18],orders:[],dirty:[]},
 {title:'Butter belongs on bread',duration:36,factor:1.05,swaps:[19],orders:[[5,1],[13,0],[22,2],[30,1]],dirty:[]},
 {title:'A clean start',duration:40,factor:1.12,swaps:[10,22,31],orders:[[4,1],[14,2],[24,0],[33,0]],dirty:[0,2,1]},
]);
export const READINGS=Object.freeze([{at:18,kind:'places'},{at:5,kind:'bread'},{at:10,kind:'clean'}]);
export function newGame(course=0,scores=[]){
 const index=Number.isInteger(course)&&course>=0&&course<COURSES.length?course:0;
 return{phase:'intro',course:index,scores:scores.slice(0,index),time:0,score:0,misses:0,spills:0,perfects:0,combo:0,
 kettle:RULES.capacity,refill:0,target:null,poured:0,pourSpilled:false,overflow:0,swapIndex:0,swapUntil:0,orderIndex:0,
 service:null,ordersServed:0,cleaned:0,events:[],served:0,reading:null,readingSeen:false,lastReading:null,
 cups:GUESTS.map((g,i)=>({...g,seat:i,tea:[42,32,62][i],empty:0,reaction:0,chewing:0,dirty:false,order:null}))};
}
const emit=(s,type,detail={})=>s.events.push({type,...detail});
export function start(s){if(s.phase==='intro'){s.phase='playing';emit(s,'start');return true;}return false;}
export function stopPour(s,reward=true){
 if(s.target!==null){const c=s.cups[s.target];if(reward&&s.phase==='playing'&&s.poured>=18&&!s.pourSpilled&&c.tea>=82&&c.tea<=96){s.combo++;s.perfects++;const points=30+Math.min(s.combo,5)*10;s.score+=points;c.reaction=1.4;emit(s,'perfect',{id:s.target,points});}}
 s.target=null;s.poured=0;s.pourSpilled=false;s.overflow=0;
}
export function canAct(s){return s.phase==='playing'&&!s.refill&&!s.service&&s.time>=s.swapUntil;}
export function pour(s,id){
 if(!Number.isInteger(id)||!s.cups[id]||!canAct(s)||s.kettle<=0||s.cups[id].dirty)return false;
 if(s.target===id)return true;stopPour(s);s.target=id;return true;
}
export function refill(s){if(!canAct(s)||s.kettle>=RULES.capacity-1)return false;stopPour(s);s.refill=RULES.refillSeconds;emit(s,'refill');return true;}
export function serve(s,id){
 if(!Number.isInteger(id)||!s.cups[id]||!canAct(s))return false;
 const c=s.cups[id],kind=c.dirty?'clean':c.order?'toast':null;if(!kind)return false;
 stopPour(s);s.service={id,kind,left:kind==='clean'?RULES.cleanSeconds:RULES.toastSeconds};emit(s,'service',{id,kind});return true;
}
export function pause(s){if(s.phase==='playing'){stopPour(s,false);s.phase='paused';emit(s,'pause');}}
export function resume(s){if(s.phase==='paused'){s.phase='playing';emit(s,'resume');}}
export function continueReading(s){if(s.phase!=='reading')return false;s.reading=null;s.phase='playing';emit(s,'continueReading');return true;}
function complaint(s,id,reason){
 const c=s.cups[id];s.misses++;s.combo=0;c.empty=0;
 if(reason==='empty'){c.tea=35;c.dirty=false;}else c.order=null;
 emit(s,'miss',{id,reason});
 if(s.misses>=3){stopPour(s,false);s.phase='lost';emit(s,'end');}
}
export function tick(s,dt){
 if(s.phase!=='playing'||!Number.isFinite(dt)||dt<=0)return;
 if(dt>.04){let left=dt;while(left>0&&s.phase==='playing'){const step=Math.min(.04,left);tick(s,step);left-=step;}return;}
 const course=COURSES[s.course],reading=!s.readingSeen&&READINGS[s.course],reached=reading&&s.time+dt>=reading.at;
 if(reached)dt=Math.max(0,reading.at-s.time);
 s.time=Math.min(course.duration,s.time+dt);
 if(s.refill>0){s.refill=Math.max(0,s.refill-dt);if(!s.refill){s.kettle=RULES.capacity;emit(s,'refilled');}}
 if(s.service){const task=s.service;task.left=Math.max(0,task.left-dt);if(!task.left){const c=s.cups[task.id];if(task.kind==='clean'){c.tea=0;c.empty=0;c.dirty=false;s.cleaned++;s.score+=20;}else{c.order=null;c.chewing=3;s.ordersServed++;s.score+=60;}c.reaction=1.4;s.service=null;emit(s,'served',{id:task.id,kind:task.kind});}}
 const swapAt=course.swaps[s.swapIndex];
 if(!reached&&swapAt&&s.time>=swapAt){stopPour(s);s.swapUntil=s.time+RULES.swapSeconds;s.cups.forEach(c=>c.seat=(c.seat+1)%3);const id=course.dirty[s.swapIndex];if(id!==undefined){s.cups[id].dirty=true;emit(s,'dirty',{id});}s.swapIndex++;emit(s,'swap');}
 const order=course.orders[s.orderIndex];
 if(!reached&&order&&s.time>=order[0]){const id=order[1];s.cups[id].order={left:RULES.orderSeconds};s.orderIndex++;emit(s,'order',{id});}
 const moving=s.time<s.swapUntil;
 for(let id=0;id<s.cups.length;id++){
  const c=s.cups[id];c.reaction=Math.max(0,c.reaction-dt);if(moving)continue;
  c.chewing=Math.max(0,c.chewing-dt);
  c.tea=Math.max(0,c.tea-c.drain*course.factor*(1+.12*s.time/course.duration)*(c.chewing>0?.35:1)*dt);
  if(c.order&&!(s.service?.id===id&&s.service.kind==='toast')){c.order.left=Math.max(0,c.order.left-dt);if(!c.order.left){complaint(s,id,'toast');if(s.phase!=='playing')return;}}
  if(s.target===id&&canAct(s)&&s.kettle>0&&!c.dirty){
   const amount=Math.min(s.kettle,RULES.pourRate*dt),useful=Math.min(100-c.tea,amount),waste=amount-useful;
   s.kettle-=amount;c.tea+=useful;s.poured+=amount;s.served+=useful;s.score+=useful*.16;
   if(waste>0){s.pourSpilled=true;s.overflow+=waste;}
   if(s.overflow>=12){s.overflow-=12;s.score=Math.max(0,s.score-25);s.spills++;s.combo=0;emit(s,'spill',{id,points:-25});}
   if(s.kettle<=.0001){s.kettle=0;stopPour(s);emit(s,'emptyKettle');}
  }
  if(c.tea<=0){if(!(s.service?.id===id&&s.service.kind==='clean'))c.empty+=dt;if(c.empty>=RULES.emptyGrace){complaint(s,id,'empty');if(s.phase!=='playing')return;}}else c.empty=0;
 }
 if(reached){stopPour(s,false);s.reading=s.lastReading=reading.kind;s.readingSeen=true;s.phase='reading';emit(s,'reading',{kind:reading.kind});return;}
 if(s.time>=course.duration){stopPour(s);s.score+=(3-s.misses)*100;s.scores[s.course]=Math.floor(s.score);s.phase=s.course===COURSES.length-1?'won':'interlude';emit(s,'end');}
}
