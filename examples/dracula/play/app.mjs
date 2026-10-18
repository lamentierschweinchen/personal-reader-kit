import {STAGES,RADIUS,createGame,roomFor,start,pause,resume,retry,nextRoom,update,guardAt,fanPoints,objective} from './engine.mjs';
const $=s=>document.querySelector(s);
const castle=$('#castle'),screen=$('#screen'),title=$('#screen-title'),copy=$('#screen-copy'),action=$('#screen-action');
const pauseButton=$('#pause'),restartButton=$('#restart'),replayButton=$('#replay-all'),notes=$('#notes'),announcement=$('#announcement');
const directions=[...document.querySelectorAll('.direction')],reduced=matchMedia('(prefers-reduced-motion: reduce)');
const SAVE_KEY='newreading-dracula-castle-v2';
let malformedSave=false,storageMessage='';
function loadProgress(){try{const raw=localStorage.getItem(SAVE_KEY);if(!raw)return {completed:0,gentle:false};const d=JSON.parse(raw);if(d.version!==2||!Number.isInteger(d.completed)||d.completed<0||d.completed>STAGES.length||typeof d.gentle!=='boolean')throw Error('format');return d;}catch(e){malformedSave=true;storageMessage='The saved escape could not be read. This run will leave it untouched. Replay all rooms starts a new save.';return {completed:0,gentle:false};}}
const saved=loadProgress();
let game=createGame({stage:Math.min(saved.completed,STAGES.length-1),completed:saved.completed,gentle:saved.gentle});
if(saved.completed===STAGES.length){game.phase='escaped';game.inventory.push(...roomFor(game).requires);game.opened=roomFor(game).doors.map(d=>d.id);}
let keys=new Set(),pointers=new Map(),previous=0,lastPhase='',lastSafety='',lastEvent=-1,buttonKey=null,drawnStage=-1;
const keyMap={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
const numerals=['I','II','III'];
const rect=(r,extra='')=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" ${extra}/>`;
const art={
  key:'<circle cx="-6" cy="-5" r="6" fill="none"/><path d="m-2 0 13 13m-4-4 4-4m-8 0 4-4" fill="none"/>',
  bolt:'<rect x="-15" y="-8" width="30" height="16" fill="#b8b0a1"/><path d="M-17 0h34M7 0v-10" fill="none"/>',
  handle:'<path d="M-13 9h11V-9h15" fill="none"/><circle cx="-13" cy="9" r="3"/><circle cx="13" cy="-9" r="3"/>',
  winch:'<circle r="13" fill="none"/><circle r="3"/><path d="M0-13V13M-13 0h26M-9-9 9 9M-9 9 9-9M-18 19h36M-8 13v6M8 13v6" fill="none"/>'
};
function storageStatus(){for(const el of document.querySelectorAll('.save-status')){el.hidden=!storageMessage;el.textContent=storageMessage;}}
function saveProgress(){if(malformedSave){storageStatus();return;}try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:2,completed:game.completed,gentle:game.gentle}));storageMessage='';}catch{storageMessage='Cleared rooms could not be saved. You can keep playing in this tab; reloading may lose this progress.';}storageStatus();}
function wallArt(w){return `<g>${rect({...w,x:w.x+5,y:w.y+7},'fill="#292925" opacity=".16"')}${rect(w,'fill="url(#masonry)" stroke="#655e54" stroke-width="1.8"')}<path d="M${w.x+3} ${w.y+w.h-3}V${w.y+3}H${w.x+w.w-3}" fill="none" stroke="#f3eee3" stroke-width="2"/><path d="M${w.x+4} ${w.y+w.h-3}H${w.x+w.w-3}V${w.y+4}" fill="none" stroke="#8d8474" stroke-width="2"/></g>`;}
function doorArt(d){const vertical=d.h>d.w,cx=d.x+d.w/2,cy=d.y+d.h/2;return `<g id="door-${d.id}" class="door" data-open="false">${rect(d,'fill="#d7cbb5" stroke="#655e54" stroke-width="2"')}<g class="door-leaves">${rect({...d,x:d.x+4,y:d.y+4,w:d.w-8,h:d.h-8},'fill="#743b32"')}${Array.from({length:7},(_,i)=>vertical?`<path d="M${d.x+3} ${d.y+8+i*(d.h-16)/6}h${d.w-6}"/>`:`<path d="M${d.x+8+i*(d.w-16)/6} ${d.y+3}v${d.h-6}"/>`).join('')}</g><g class="door-lock" transform="translate(${cx} ${cy})"><rect x="-6" y="-5" width="12" height="11" rx="2" fill="#e5d2a3" stroke="#292925" stroke-width="1"/><path d="M-4-5v-3a4 4 0 0 1 8 0v3" fill="none" stroke="#292925"/><circle r="1.5" fill="#292925"/></g></g>`;}
function buildRoom(){
 const room=roomFor(game),tiles=[];drawnStage=game.stage;
 const occupied=c=>[...room.items,room.exit].some(p=>p.x>=c.x&&p.x<=c.x+c.w&&p.y>=c.y&&p.y<=c.y+c.h);
 for(let y=55;y<551;y+=35){tiles.push(`<path d="M49 ${y}H551"/>`);for(let x=49+((y-55)/35%2)*35;x<551;x+=70)tiles.push(`<path d="M${x} ${y}v35"/>`);}
 const stones=[];for(let n=55;n<560;n+=35)stones.push(`<path d="M${n} 24v25M${n} 551v25M24 ${n}h25M551 ${n}h25"/>`);
 castle.innerHTML=`<defs>
 <pattern id="masonry" width="48" height="24" patternUnits="userSpaceOnUse"><rect width="48" height="24" fill="#bcb3a2"/><path d="M0 0h48M0 12h48M24 0v12M0 12v12M48 12v12" fill="none" stroke="#817968" stroke-opacity=".55" stroke-width=".8"/></pattern>
 <pattern id="hatching" width="8" height="8" patternUnits="userSpaceOnUse"><path d="m-2 2 4-4M0 8 8 0m-2 10 4-4" fill="none" stroke="#f3eee3" stroke-opacity=".13" stroke-width=".8"/></pattern>
 <radialGradient id="candlelight"><stop stop-color="#e5d2a3" stop-opacity=".55"/><stop offset="1" stop-color="#e5d2a3" stop-opacity="0"/></radialGradient>
 <clipPath id="floor-clip"><rect x="49" y="49" width="502" height="502"/></clipPath>
 <mask id="shadow-mask"><rect width="600" height="600" fill="white"/>${room.covers.map(c=>rect({x:c.x+RADIUS,y:c.y+RADIUS,w:c.w-2*RADIUS,h:c.h-2*RADIUS},'fill="black"')).join('')}</mask>
 </defs>
 <rect x="24" y="24" width="552" height="552" fill="#c4bcac" stroke="#655e54" stroke-width="1.5"/>
 <g fill="none" stroke="#7f7668" stroke-opacity=".6" stroke-width="1">${stones.join('')}</g>
 <rect x="38" y="38" width="524" height="524" fill="none" stroke="#807866" stroke-width="1.2"/>
 <rect x="49" y="49" width="502" height="502" fill="${game.stage===1?'#e4dfd2':'#e9e2d5'}" stroke="#655e54" stroke-width="2"/>
 <path d="M51 549V51H549" fill="none" stroke="#f3eee3" stroke-width="3"/>
 <g clip-path="url(#floor-clip)" fill="none" stroke="#b8b0a1" stroke-opacity=".45" stroke-width=".65">${tiles.join('')}</g>
 <g aria-hidden="true">${room.covers.map(c=>`<g data-cover="${c.id}">${rect(c,'fill="#3c413d" stroke="#292925" stroke-width="1.2"')}${rect(c,'fill="url(#hatching)"')}<path d="M${c.x+7} ${c.y+c.h-7}V${c.y+22}Q${c.x+c.w/2} ${c.y-2} ${c.x+c.w-7} ${c.y+22}V${c.y+c.h-7}" fill="none" stroke="#f3eee3" stroke-opacity=".3" stroke-width="1"/>${occupied(c)?'':`<text x="${c.x+c.w/2}" y="${c.y+c.h-9}" class="cover-label">SHADOW</text>`}</g>`).join('')}</g>
 <g clip-path="url(#floor-clip)">${room.candles.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="44" fill="url(#candlelight)"/>`).join('')}</g>
 <g>${room.patrols.map(p=>`<path class="route" d="${p.points.map((v,i)=>(i?'L':'M')+v.join(' ')).join(' ')}Z"/>`).join('')}</g>
 <g id="fans" clip-path="url(#floor-clip)" mask="url(#shadow-mask)">${room.patrols.map((_,i)=>`<polygon id="fan-${i}" class="sight"/>`).join('')}</g>
 <g>${room.walls.map(wallArt).join('')}</g>
 <g fill="none" stroke="#292925" stroke-width="2">${room.doors.map(doorArt).join('')}</g>
 <g>${room.labels.map(l=>`<text x="${l.x}" y="${l.y}" class="map-label">${l.text}</text>`).join('')}</g>
 <g id="exit" transform="translate(${room.exit.x} ${room.exit.y})"><path d="M-26 24v-34q26-30 52 0v34" fill="#9b9281" stroke="#655e54" stroke-width="3"/><path d="M-20 21v-28q20-23 40 0v28" fill="#292925"/>${game.stage<2?Array.from({length:5},(_,i)=>`<path d="M-19 ${i*6-8}h38" stroke="#f3eee3" stroke-opacity="${.25+i*.15}" stroke-width="3"/>`).join(''):'<path d="M-18 20 0 2 18 20" fill="none" stroke="#f3eee3" stroke-width="2"/>'}<text y="39" class="target-label">${room.exit.label}</text></g>
 <g>${room.items.map(item=>`<g id="object-${item.id}" class="object" transform="translate(${item.x} ${item.y})" data-collected="false"><circle class="object-halo" r="22"/><g stroke="#743b32" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" fill="#e5d2a3">${art[item.kind]}</g><text y="34" class="target-label">${item.label}</text></g>`).join('')}</g>
 <g>${room.candles.map(([x,y])=>`<g transform="translate(${x} ${y})"><ellipse cy="6" rx="6" ry="3" fill="#292925"/><path d="M0 6V-2" stroke="#f3eee3" stroke-width="3"/><path class="candle-flame" d="M0-12Q-7-3 0-1Q6-4 0-12Z"/></g>`).join('')}</g>
 <g id="patrols">${room.patrols.map((_,i)=>`<g id="patrol-${i}"><ellipse cy="5" rx="17" ry="20" fill="#292925" opacity=".18"/><g class="cloak"><path d="M-7-10Q-17-7-18 7L-19 24Q-8 17 0 24Q8 17 19 24L18 7Q17-7 7-10Z" fill="#282a28" stroke="#ece5d7" stroke-width="1.2"/><path d="M-10-6 0 0 10-6" fill="#743b32"/><ellipse cy="-12" rx="8" ry="9" fill="#d9d2c2" stroke="#292925" stroke-width="2"/><path d="M-7-15Q0-24 7-15L3-20H-3Z" fill="#292925"/><path d="M-4-12h2M2-12h2" stroke="#743b32" stroke-width="2"/><path d="m-2-7 2 2 2-2" fill="none" stroke="#655e54" stroke-width="1"/><path d="M-9 6-6 18M8 4 9 18" stroke="#655e54" stroke-width="1"/></g></g>`).join('')}</g>
 <g id="harker"><circle class="player-ring" r="22"/><circle id="warning-ring" class="danger-ring" r="25" stroke-dasharray="0 158"/><g id="harker-body"><ellipse cy="13" rx="13" ry="9" fill="#292925" opacity=".22"/><path d="M-8-2-13 15Q0 20 13 15L8-2Z" fill="#dfd4bc" stroke="#292925" stroke-width="2"/><path d="M0-2v17M-7 18v4M7 18v4" stroke="#292925" stroke-width="2"/><circle cy="-10" r="7" fill="#f3eee3" stroke="#292925" stroke-width="1.6"/><path d="M-6-12Q0-19 7-11" fill="none" stroke="#292925" stroke-width="3"/><path d="M10 3 18-2" stroke="#e9e2d5" stroke-width="4"/><rect x="14" y="-5" width="8" height="11" rx="1" fill="#e5d2a3" stroke="#292925" stroke-width="1.5"/><path d="M17-5v-3h3v3M18-2v5" fill="none" stroke="#743b32" stroke-width="1"/></g></g>`;
 castle.setAttribute('tabindex','0');castle.setAttribute('aria-label',`${room.title}. ${room.intro} Red fans show the patrols’ sight. Dark alcoves hide you. Solid masonry blocks movement.`);
 $('#room-label').textContent=`${numerals[game.stage]} / III · ${room.title}`;
}
function say(text){announcement.textContent=text;}
function clearInput(){keys.clear();pointers.clear();buttonKey=null;for(const b of directions)b.setAttribute('aria-pressed','false');}
function input(){const all=new Set([...keys,...pointers.values()]);return {x:Number(all.has('right'))-Number(all.has('left')),y:Number(all.has('down'))-Number(all.has('up'))};}
function syncButtons(){const all=new Set([...keys,...pointers.values()]);for(const b of directions)b.setAttribute('aria-pressed',String(all.has(b.dataset.dir)));}
function begin(){clearInput();start(game);lastPhase='';render();castle.focus({preventScroll:true});say(roomFor(game).intro);}
function replaceGame(next){clearInput();game=next;lastPhase='';lastSafety='';lastEvent=-1;drawnStage=-1;buildRoom();begin();}
function reset(){replaceGame(retry(game));}
function replayAll(){malformedSave=false;game=createGame({gentle:game.gentle});saveProgress();replaceGame(game);}
function stop(reason='Your place is safe. Resume when you’re ready.'){
 clearInput();if(game.phase!=='playing')return;pause(game);render();copy.textContent=reason;action.focus({preventScroll:true});say('Paused. '+reason);
}
function continueGame(){clearInput();resume(game);render();castle.focus({preventScroll:true});say('Resumed.');}
function showScreen(){
 const p=game.phase,room=roomFor(game);screen.hidden=p==='playing';pauseButton.disabled=!['playing','paused'].includes(p);pauseButton.querySelector('span').textContent=p==='paused'?'Resume':'Pause';
 for(const b of directions)b.disabled=!['ready','playing'].includes(p);
 restartButton.hidden=p!=='paused';replayButton.hidden=!['ready','paused','interlude','caught'].includes(p)||(game.completed===0&&!malformedSave);
 if(p==='playing')return;clearInput();$('#screen-kicker').textContent=`Room ${numerals[game.stage]} of III`;
 if(p==='ready'){title.textContent=room.title;copy.textContent=room.intro;action.textContent=game.completed?'Continue escape':'Enter the castle';}
 if(p==='paused'){title.textContent='The castle waits.';copy.textContent='Your place is safe. Resume when you’re ready.';action.textContent='Resume escape';}
 if(p==='caught'){title.textContent='A shadow found you.';copy.textContent=`Try ${room.short.toLowerCase()} again. Cleared rooms are kept.`;action.textContent='Retry this room';say('Caught. Retry this room. Cleared rooms are kept.');}
 if(p==='interlude'){title.textContent=room.short+' cleared.';copy.textContent=room.cleared;action.textContent='Enter '+(game.stage===0?'the chapel':'the gatehouse');saveProgress();say(title.textContent+' '+room.cleared);}
 if(p==='escaped'){$('#screen-kicker').textContent='All three rooms cleared';title.textContent='Beyond the walls.';copy.textContent=STAGES[2].cleared;action.textContent='Replay all rooms';saveProgress();say('You escaped the castle. All three rooms cleared.');}
 screen.scrollTop=0;if(p!=='ready')action.focus({preventScroll:true});
}
function render(){
 if(drawnStage!==game.stage)buildRoom();
 castle.dataset.phase=game.phase;castle.dataset.stage=String(game.stage+1);castle.dataset.completed=String(game.completed);castle.dataset.playing=String(game.phase==='playing');castle.dataset.gentle=String(game.gentle);castle.dataset.time=game.time.toFixed(3);castle.dataset.patrolTime=game.patrolTime.toFixed(3);castle.dataset.inventory=game.inventory.join(',');castle.dataset.opened=game.opened.join(',');castle.dataset.warning=game.warning.toFixed(3);
 if(game.phase!==lastPhase){lastPhase=game.phase;showScreen();}
 const p=game.player,harker=$('#harker');harker.setAttribute('transform',`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);harker.dataset.cover=game.cover||'';$('#harker-body').setAttribute('transform',`rotate(${(p.angle*180/Math.PI+90).toFixed(2)})`);harker.querySelector('.player-ring').setAttribute('stroke-dasharray',game.cover?'3 3':'none');$('#warning-ring').setAttribute('stroke-dasharray',`${(game.warning*157).toFixed(2)} 158`);$('#danger-fill').style.width=(game.warning*100).toFixed(2)+'%';
 const room=roomFor(game);room.patrols.forEach((_,i)=>{const s=guardAt(game,i);$(`#patrol-${i}`).setAttribute('transform',`translate(${s.x.toFixed(2)} ${s.y.toFixed(2)})`);$(`#patrol-${i} .cloak`).setAttribute('transform',`rotate(${(s.angle*180/Math.PI+90).toFixed(2)})`);$(`#fan-${i}`).setAttribute('points',fanPoints(game,s));});
 for(const item of room.items)$(`#object-${item.id}`).dataset.collected=String(game.inventory.includes(item.id));
 for(const door of room.doors)$(`#door-${door.id}`).dataset.open=String(game.opened.includes(door.id));
 for(const step of document.querySelectorAll('[data-step]')){const n=Number(step.dataset.step);step.dataset.done=String(game.completed>n);if(n===game.stage)step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');}
 const safety=['caught','escaped','interlude'].includes(game.phase)?game.phase:game.exposed?'warning':game.cover?'cover':'open';
 if(safety!==lastSafety){lastSafety=safety;$('#safety').dataset.state=safety;$('#safety span').textContent=({caught:'Caught',escaped:'Escaped',interlude:'Room cleared',warning:'Seen! Find cover',cover:'In shadow',open:'In the open'})[safety];$('#safety use').setAttribute('href',safety==='warning'||safety==='caught'?'#eye-icon':'#moon-icon');if(game.phase==='playing')say(safety==='warning'?'Seen. Get out of sight.':safety==='cover'?'In shadow.':'In the open.');}
 $('#objective').textContent=objective(game);
 if(game.event!==lastEvent){lastEvent=game.event;if(game.message&&game.phase==='playing')say(game.message);$('#pickup').textContent=game.message;}
 $('#pickup').hidden=!(game.message&&game.time-game.messageAt<1.5&&game.phase==='playing');
}
function frame(now){const dt=previous?(now-previous)/1000:0;previous=now;if(game.phase==='playing'){update(game,input(),dt);render();}requestAnimationFrame(frame);}
$('#gentle').checked=game.gentle;storageStatus();buildRoom();render();requestAnimationFrame(frame);
action.addEventListener('click',()=>{if(game.phase==='paused')continueGame();else if(game.phase==='ready')begin();else if(game.phase==='caught')reset();else if(game.phase==='interlude')replaceGame(nextRoom(game));else if(game.phase==='escaped')replayAll();});
restartButton.addEventListener('click',reset);replayButton.addEventListener('click',replayAll);pauseButton.addEventListener('click',()=>game.phase==='paused'?continueGame():stop());
for(const b of directions){
  b.setAttribute('aria-pressed','false');
  b.addEventListener('pointerdown',e=>{
    if(e.button!==0&&e.pointerType==='mouse')return;
    e.preventDefault();if(game.phase==='ready')begin();if(game.phase!=='playing')return;
    pointers.set(e.pointerId,b.dataset.dir);b.setPointerCapture(e.pointerId);syncButtons();
  });
  const release=e=>{pointers.delete(e.pointerId);syncButtons();};
  b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
  b.addEventListener('contextmenu',e=>e.preventDefault());
  // Enter/Space on a focused arrow moves a short, repeatable step as well.
  b.addEventListener('keydown',e=>{if(e.code!=='Space'&&e.code!=='Enter')return;e.preventDefault();e.stopPropagation();if(game.phase==='ready')begin();if(game.phase==='playing'){buttonKey=b.dataset.dir;keys.add(buttonKey);syncButtons();}});
  b.addEventListener('keyup',e=>{if(e.code!=='Space'&&e.code!=='Enter')return;e.preventDefault();e.stopPropagation();keys.delete(b.dataset.dir);buttonKey=null;syncButtons();});
}
window.addEventListener('keydown',e=>{
  if(notes.open||e.metaKey||e.ctrlKey||e.altKey)return;
  if(e.code==='Escape'){if(game.phase==='playing')stop();return;}
  if(e.code==='Space'&&!e.target.closest('button,a,input')){e.preventDefault();if(!e.repeat){if(game.phase==='playing')stop();else if(game.phase==='paused')continueGame();}return;}
  const dir=keyMap[e.code];if(!dir)return;e.preventDefault();
  if(game.phase==='ready')begin();if(game.phase==='playing'){keys.add(dir);syncButtons();}
});
window.addEventListener('keyup',e=>{const dir=keyMap[e.code];if(dir)keys.delete(dir);if((e.code==='Space'||e.code==='Enter')&&buttonKey){keys.delete(buttonKey);buttonKey=null;}syncButtons();});
window.addEventListener('blur',()=>stop('The page lost focus. Resume when you’re ready.'));
window.addEventListener('pagehide',()=>stop());
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('You stepped away. Resume when you’re ready.');});
let portrait=innerHeight>=innerWidth;
window.addEventListener('resize',()=>{const next=innerHeight>=innerWidth;if(next!==portrait){portrait=next;stop('The room has turned. Resume when you’re ready.');}else stop('The view changed. Resume when you’re ready.');});
window.addEventListener('orientationchange',()=>stop('The room has turned. Resume when you’re ready.'));

let noteTrigger=null;
function openNotes(which,trigger){
  stop();clearInput();noteTrigger=trigger;
  $('#source-panel').hidden=which!=='source';$('#help-panel').hidden=which!=='help';
  $('#notes-title').textContent=which==='source'?'From the novel':'How to play';
  notes.showModal();notes.scrollTop=0;$('#close-notes').focus();
}
$('#about').addEventListener('click',e=>openNotes('source',e.currentTarget));
$('#help').addEventListener('click',e=>openNotes('help',e.currentTarget));
$('#close-notes').addEventListener('click',()=>notes.close());
notes.addEventListener('close',()=>{clearInput();noteTrigger?.focus({preventScroll:true});});
$('#gentle').addEventListener('change',e=>{game.gentle=e.target.checked;saveProgress();render();say(game.gentle?'Gentler patrols on.':'Normal patrols on.');});
// Nonessential CSS motion follows the system setting live; timing remains readable.
reduced.addEventListener('change',()=>render());
