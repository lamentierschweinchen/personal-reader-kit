// Tea preparation is separate from book editions, annotations and their backups.
export const BREW_KEY='book-of-tea-brew@1';
export const DEFAULT_SECONDS=Object.freeze({sencha:60,black:240});
export const MIN_SECONDS=15,MAX_SECONDS=1800;
const recipes=['sencha','black','matcha'];
const MAX_DATE=8640000000000000;
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
export const newBrewState=()=>({schema:1,recipe:'sencha',seconds:{...DEFAULT_SECONDS},timer:null});
export function validateBrewState(value){
  const valid=value&&value.schema===1&&recipes.includes(value.recipe)&&value.seconds&&Object.keys(DEFAULT_SECONDS).every(id=>integer(value.seconds[id],MIN_SECONDS,MAX_SECONDS));
  if(!valid)throw Error('Unreadable tea preparation.');
  const timer=value.timer;
  if(timer!==null){
    if(!timer||value.recipe==='matcha'||timer.recipe!==value.recipe||typeof timer.id!=='string'||!timer.id||timer.id.length>100||!integer(timer.durationMs,MIN_SECONDS*1000,MAX_SECONDS*1000)||!integer(timer.remainingMs,0,timer.durationMs)||!['running','paused','done'].includes(timer.status))throw Error('Unreadable tea timer.');
    if(timer.status==='paused'?timer.deadline!==null:!integer(timer.deadline,0,MAX_DATE))throw Error('Unreadable finish time.');
  }
  return {schema:1,recipe:value.recipe,seconds:{sencha:value.seconds.sencha,black:value.seconds.black},timer:timer?{id:timer.id,recipe:timer.recipe,durationMs:timer.durationMs,remainingMs:timer.remainingMs,deadline:timer.deadline,status:timer.status}:null};
}
export const remainingAt=(timer,now)=>!timer?0:timer.status==='running'?Math.max(0,Math.min(timer.durationMs,timer.deadline-now)):timer.status==='done'?0:timer.remainingMs;
export const phaseAt=(state,now)=>state.timer?.status==='running'&&state.timer.deadline<=now?'done':state.timer?.status||'idle';
export function reduceBrew(value,action,now){
  if(!integer(now,0,MAX_DATE-MAX_SECONDS*1000))throw Error('The device clock is unavailable.');
  const state=validateBrewState(value),timer=state.timer;
  if(timer?.status==='running'&&timer.deadline<=now){timer.status='done';timer.remainingMs=0;}
  const active=timer&&timer.status!=='done';
  switch(action.type){
    case 'select':
      if(!recipes.includes(action.recipe))throw Error('Choose an available tea.');
      if(!active){state.recipe=action.recipe;state.timer=null;}break;
    case 'adjust':
      if(!active&&state.recipe!=='matcha'&&[-15,15].includes(action.seconds)){state.seconds[state.recipe]=Math.max(MIN_SECONDS,Math.min(MAX_SECONDS,state.seconds[state.recipe]+action.seconds));state.timer=null;}break;
    case 'recommended':
      if(!active&&state.recipe!=='matcha'){state.seconds[state.recipe]=DEFAULT_SECONDS[state.recipe];state.timer=null;}break;
    case 'start':
      if(!active&&state.recipe!=='matcha'){
        const durationMs=state.seconds[state.recipe]*1000;
        state.timer={id:action.id,recipe:state.recipe,durationMs,remainingMs:durationMs,deadline:now+durationMs,status:'running'};
      }break;
    case 'pause':
      if(timer?.status==='running'){timer.remainingMs=remainingAt(timer,now);timer.deadline=null;timer.status='paused';}break;
    case 'resume':
      if(timer?.status==='paused'){timer.deadline=now+timer.remainingMs;timer.status='running';}break;
    case 'reset':state.timer=null;break;
    case 'tick':break;
    default:throw Error('Unknown tea action.');
  }
  return validateBrewState(state);
}
export function clockText(milliseconds){
  const seconds=Math.max(0,Math.ceil(milliseconds/1000));
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}
