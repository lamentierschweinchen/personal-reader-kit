// A new five-room campaign. The three-room checkpoint is read, never rewritten.
export const SAVE_KEY='newreading-dracula-castle-v3';
export const LEGACY_KEY='newreading-dracula-castle-v2';
export const CAMPAIGN_LENGTH=5;
const fresh=()=>({version:3,completed:0,gentle:false});
const valid=(s,version,max)=>s&&s.version===version&&Number.isInteger(s.completed)&&s.completed>=0&&s.completed<=max&&typeof s.gentle==='boolean';
export function decodeProgress(current,legacy){
  if(current!==null){
    try{const s=JSON.parse(current);if(!valid(s,3,5))throw Error('shape');return {save:{version:3,completed:s.completed,gentle:s.gentle},blocked:false,migrated:false};}
    catch{return {save:fresh(),blocked:true,migrated:false,message:'The saved escape could not be read. This run will leave it untouched. Replay all rooms starts a new save.'};}
  }
  if(legacy!==null){
    try{const s=JSON.parse(legacy);if(!valid(s,2,3))throw Error('shape');return {save:{version:3,completed:Math.min(s.completed,2),gentle:s.gentle},blocked:false,migrated:true,message:s.completed===3?'Your earlier three-room escape is kept. Continue this five-room escape at the new chapel.':s.completed===2?'Your first two rooms are kept. The new chapel comes next.':'Your earlier progress is kept in this five-room escape.'};}
    catch{return {save:fresh(),blocked:false,migrated:false,message:'The earlier escape could not be read. That save is left untouched; this five-room escape starts fresh.'};}
  }
  return {save:fresh(),blocked:false,migrated:false};
}
export function loadProgress(storage){
  try{const store=storage??globalThis.localStorage;return decodeProgress(store.getItem(SAVE_KEY),store.getItem(LEGACY_KEY));}
  catch{return {save:fresh(),blocked:false,migrated:false,message:'Browser storage is unavailable. You can play in this tab; this escape may not be kept after reloading.'};}
}

// Explicit replay may replace an unreadable current save only after keeping its raw value.
export function preserveDamagedSave(storage){
 const raw=storage.getItem(SAVE_KEY);if(raw===null)return null;
 const base=SAVE_KEY+'-recovery';let key=base,n=0;
 while(storage.getItem(key)!==null)key=base+'-'+(++n);
 storage.setItem(key,raw);return key;
}
