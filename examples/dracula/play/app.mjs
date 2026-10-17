import {createGame,start,pause,resume,update,guardAt,fanPoints,COVERS,PILLARS,PATROLS,KEY,EXIT,RADIUS} from './engine.mjs';

const $=s=>document.querySelector(s);
const castle=$('#castle'), screen=$('#screen'), title=$('#screen-title'), copy=$('#screen-copy'), action=$('#screen-action');
const pauseButton=$('#pause'), restartButton=$('#restart'), notes=$('#notes'), announcement=$('#announcement');
const directions=[...document.querySelectorAll('.direction')];
let game=createGame(), keys=new Set(), pointers=new Map(), previous=0, lastPhase='', lastSafety='', lastKey=false, buttonKey=null;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const keyMap={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
const rect=(r,extra='')=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" ${extra}/>`;
const keyDrawing='<circle cx="-6" cy="-5" r="6" fill="none"/><path d="m-2 0 13 13m-4-4 4-4m-8 0 4-4" fill="none"/>';

function buildRoom(){
  const tiles=[];
  for(let y=56;y<551;y+=38){
    tiles.push(`<path d="M49 ${y}H551"/>`);
    for(let x=49+((y-56)/38%2)*38;x<551;x+=76)tiles.push(`<path d="M${x} ${y}v38"/>`);
  }
  const stones=[];
  for(let n=60;n<560;n+=38){stones.push(`<path d="M${n} 25v24M${n} 551v24M25 ${n}h24M551 ${n}h24"/>`);}
  castle.innerHTML=`<defs>
    <pattern id="hatching" width="8" height="8" patternUnits="userSpaceOnUse"><path d="m-2 2 4-4M0 8 8 0m-2 10 4-4" fill="none" stroke="#f3eee3" stroke-opacity=".13" stroke-width=".8"/></pattern>
    <pattern id="stone-cut" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6 6 0" stroke="#655e54" stroke-opacity=".17" stroke-width=".8"/></pattern>
    <clipPath id="floor-clip"><rect x="49" y="49" width="502" height="502"/></clipPath>
    <mask id="shadow-mask"><rect x="0" y="0" width="600" height="600" fill="white"/>${COVERS.map(c=>rect({x:c.x+RADIUS,y:c.y+RADIUS,w:c.w-2*RADIUS,h:c.h-2*RADIUS},'fill="black"')).join('')}</mask>
  </defs>
  <path d="M24 24h552v552H24Z" fill="#c8c0b0" stroke="#655e54" stroke-width="1.5"/>
  <g fill="none" stroke="#655e54" stroke-opacity=".5" stroke-width="1">${stones.join('')}</g>
  <rect x="39" y="39" width="522" height="522" fill="none" stroke="#655e54" stroke-width="1"/>
  <rect x="49" y="49" width="502" height="502" fill="#e9e2d5" stroke="#655e54" stroke-width="2"/>
  <g clip-path="url(#floor-clip)" fill="none" stroke="#b8b0a1" stroke-opacity=".38" stroke-width=".65">${tiles.join('')}</g>
  <g aria-hidden="true">${COVERS.map(c=>`<g data-cover="${c.id}">${rect(c,'fill="#44463f" stroke="#292925" stroke-width="1.2"')}${rect(c,'fill="url(#hatching)"')}<path d="M${c.x+8} ${c.y+c.h-8}V${c.y+29}Q${c.x+c.w/2} ${c.y-3} ${c.x+c.w-8} ${c.y+29}V${c.y+c.h-8}" fill="none" stroke="#f3eee3" stroke-opacity=".35" stroke-width="1"/><text x="${c.x+c.w/2}" y="${c.y+c.h-12}" class="cover-label">SHADOW</text></g>`).join('')}</g>
  <path class="route" d="M130 313h340M132 163h335"/>
  <g id="fans" clip-path="url(#floor-clip)" mask="url(#shadow-mask)">${PATROLS.map((_,i)=>`<polygon id="fan-${i}" class="sight"/>`).join('')}</g>
  <g>${PILLARS.map(p=>`<g>${rect({...p,x:p.x+5,y:p.y+6},'fill="#292925" opacity=".13"')}${rect(p,'fill="#c8c0b0" stroke="#655e54" stroke-width="1.8"')}${rect(p,'fill="url(#stone-cut)"')}${rect({...p,x:p.x+7,y:p.y+6,w:p.w-14,h:p.h-12},'fill="none" stroke="#8d8679" stroke-width=".8"')}<path d="M${p.x+p.w/2} ${p.y}v${p.h}" stroke="#8d8679" stroke-width=".7"/></g>`).join('')}</g>
  <text x="300" y="288" class="map-label">THE LONG GALLERY</text>
  <text x="300" y="466" class="map-label">GREAT HALL</text>
  <g id="gate" transform="translate(${EXIT.x} 555)">
    <path d="M-34 22v-31q34-37 68 0v31" fill="#292925" stroke="#292925" stroke-width="5"/>
    <g class="gate-leaf"><path d="M-29 18v-24Q-17-22 0-25v43Z" fill="#743b32" stroke="#f3eee3" stroke-width=".7"/><path d="M-23 12v-16m10 16v-29" stroke="#292925" stroke-width="1.5"/></g>
    <g class="gate-leaf"><path d="M29 18v-24Q17-22 0-25v43Z" fill="#743b32" stroke="#f3eee3" stroke-width=".7"/><path d="M23 12v-16M13 12v-29" stroke="#292925" stroke-width="1.5"/></g>
  </g>
  <text id="gate-label" x="300" y="509" class="target-label">LOCKED GATE</text>
  <g id="key" transform="translate(${KEY.x} ${KEY.y})"><circle class="key-halo" r="24"/><g stroke="#743b32" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${keyDrawing}</g><text x="0" y="41" class="target-label">KEY</text></g>
  <g id="patrols">${PATROLS.map((_,i)=>`<g id="patrol-${i}"><ellipse cx="0" cy="4" rx="16" ry="19" fill="#292925" opacity=".14"/><g class="cloak"><path d="M0-18C-14-14-13 1-18 20Q0 12 18 20C13 1 14-14 0-18Z" fill="#292925" stroke="#f3eee3" stroke-width="1.2"/><path d="m-7-6 7-5 7 5-7 8Z" fill="#743b32"/><path d="M-5-7h2M3-7h2" stroke="#f3eee3" stroke-width="1.6"/><path d="M0 3v11" stroke="#655e54" stroke-width="1"/></g></g>`).join('')}</g>
  <g id="harker"><circle class="player-ring" r="20"/><circle id="warning-ring" class="danger-ring" r="23" stroke-dasharray="0 145"/><g id="harker-body"><path class="player-body" d="M-8-2-11 13Q0 18 11 13L8-2Z"/><path d="M-2 0v12" stroke="#b8b0a1" stroke-width="1.4"/><circle cx="0" cy="-9" r="7" fill="#f3eee3" stroke="#292925" stroke-width="1.5"/><path d="M-5-12Q0-17 6-10" fill="none" stroke="#292925" stroke-width="2"/><path d="M9 1 15-2" stroke="#f3eee3" stroke-width="3"/><rect x="12" y="-4" width="6" height="9" rx="1" fill="#e5d2a3" stroke="#292925" stroke-width="1.2"/></g><g id="carried-key" transform="translate(22 -15) scale(.55)" stroke="#f3eee3" stroke-width="3" stroke-linecap="round" hidden>${keyDrawing}</g></g>`;
  castle.setAttribute('tabindex','0');
}
buildRoom();
const harker=$('#harker'),body=$('#harker-body'), ring=$('#warning-ring'),key=$('#key');
const guards=PATROLS.map((_,i)=>({figure:$(`#patrol-${i}`),cloak:$(`#patrol-${i} .cloak`),fan:$(`#fan-${i}`)}));

function say(text){announcement.textContent=text;}
function clearInput(){keys.clear();pointers.clear();buttonKey=null;for(const b of directions)b.setAttribute('aria-pressed','false');}
function input(){const all=new Set([...keys,...pointers.values()]);return {x:Number(all.has('right'))-Number(all.has('left')),y:Number(all.has('down'))-Number(all.has('up'))};}
function syncButtons(){const all=new Set([...keys,...pointers.values()]);for(const b of directions)b.setAttribute('aria-pressed',String(all.has(b.dataset.dir)));}
function begin(){clearInput();start(game);lastPhase='';render();castle.focus({preventScroll:true});say('Find the key near the top. Dark alcoves hide you.');}
function reset(){const gentle=game.gentle;game=createGame(gentle);lastKey=false;lastSafety='';lastPhase='';begin();}
function stop(reason='Your place is safe. Resume when you’re ready.'){
  clearInput();if(game.phase!=='playing')return;
  pause(game);render();copy.textContent=reason;action.focus({preventScroll:true});say('Paused. '+reason);
}
function continueGame(){clearInput();resume(game);render();castle.focus({preventScroll:true});say('Resumed.');}
function showScreen(){
  const p=game.phase;
  screen.hidden=p==='playing';pauseButton.disabled=p==='ready'||p==='caught'||p==='escaped';
  pauseButton.querySelector('span').textContent=p==='paused'?'Resume':'Pause';
  restartButton.hidden=p!=='paused';
  if(p==='ready')return;
  if(p==='playing')return;
  clearInput();
  if(p==='paused'){$('#screen-kicker').textContent='A moment in the shadows';title.textContent='The castle waits.';copy.textContent='Your place is safe. Resume when you’re ready.';action.innerHTML='Resume escape <svg class="icon" aria-hidden="true"><use href="#arrow"/></svg>';}
  if(p==='caught'){$('#screen-kicker').textContent='Caught in the open';title.textContent='A shadow saw you.';copy.textContent='Wait in an alcove. Cross after a patrol turns away.';action.innerHTML='Try again <svg class="icon" aria-hidden="true"><use href="#arrow"/></svg>';say('Caught. Try again. Wait in an alcove, then cross after a patrol turns away.');action.focus({preventScroll:true});}
  if(p==='escaped'){$('#screen-kicker').textContent='Out of the castle';title.textContent='Into the night.';copy.textContent=`The key turns. The gate opens. You escaped in ${Math.ceil(game.time)} seconds.`;action.innerHTML='Play again <svg class="icon" aria-hidden="true"><use href="#arrow"/></svg>';say('You escaped. The key turns and the gate opens.');action.focus({preventScroll:true});}
}
function render(){
  castle.dataset.phase=game.phase;castle.dataset.playing=String(game.phase==='playing');castle.dataset.unlocked=String(game.hasKey);
  castle.dataset.time=game.time.toFixed(3);castle.dataset.gentle=String(game.gentle);
  castle.dataset.patrolTime=game.patrolTime.toFixed(3);
  if(game.phase!==lastPhase){lastPhase=game.phase;showScreen();}
  const p=game.player;
  harker.setAttribute('transform',`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
  harker.dataset.cover=game.cover||'';
  body.setAttribute('transform',`rotate(${(p.angle*180/Math.PI+90).toFixed(2)})`);
  harker.querySelector('.player-ring').setAttribute('stroke-dasharray',game.cover?'3 3':'none');
  ring.setAttribute('stroke-dasharray',`${(game.warning*144.5).toFixed(2)} 145`);
  $('#danger-fill').style.width=(game.warning*100).toFixed(2)+'%';
  for(let i=0;i<guards.length;i++){
    const pose=guardAt(game.patrolTime,i),g=guards[i];
    g.figure.setAttribute('transform',`translate(${pose.x.toFixed(2)} ${pose.y})`);
    g.cloak.setAttribute('transform',`rotate(${(pose.angle*180/Math.PI+90).toFixed(2)})`);
    g.fan.setAttribute('points',fanPoints(pose));
  }
  const safety=game.phase==='caught'?'caught':game.phase==='escaped'?'escaped':game.exposed?'warning':game.cover?'cover':'open';
  if(safety!==lastSafety){
    lastSafety=safety;$('#safety').dataset.state=safety;
    $('#safety span').textContent=safety==='caught'?'Caught':safety==='escaped'?'Escaped':safety==='warning'?'Seen! Find cover':safety==='cover'?'In shadow':'In the open';
    $('#safety use').setAttribute('href',safety==='warning'||safety==='caught'?'#eye-icon':'#moon-icon');
    if(game.phase==='playing')say(safety==='warning'?'Seen. Get out of sight.':safety==='cover'?'In shadow. You are safe.':'In the open.');
  }
  if(game.hasKey!==lastKey){
    lastKey=game.hasKey;key.style.display=game.hasKey?'none':'';
    $('#carried-key').toggleAttribute('hidden',!game.hasKey);
    $('#objective').textContent=game.hasKey?'Reach the gate':'Take the key';
    $('#gate-label').textContent=game.hasKey?'EXIT':'LOCKED GATE';
    if(game.hasKey)say('Key in hand. Reach the gate at the bottom.');
  }
  // A restart clears the drawn key even if the previous frame ended with one.
  key.style.display=game.hasKey?'none':'';$('#carried-key').toggleAttribute('hidden',!game.hasKey);
  $('#objective').textContent=game.hasKey?'Reach the gate':'Take the key';$('#gate-label').textContent=game.hasKey?'EXIT':'LOCKED GATE';
  $('#pickup').hidden=!(game.hasKey&&game.time-game.keyAt<1.8&&game.phase==='playing');
}
function frame(now){
  const dt=previous?(now-previous)/1000:0;previous=now;
  if(game.phase==='playing'){update(game,input(),dt);render();}
  requestAnimationFrame(frame);
}
render();requestAnimationFrame(frame);

action.addEventListener('click',()=>game.phase==='paused'?continueGame():game.phase==='ready'?begin():reset());
restartButton.addEventListener('click',reset);
pauseButton.addEventListener('click',()=>game.phase==='paused'?continueGame():stop());
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
window.addEventListener('resize',()=>{const next=innerHeight>=innerWidth;if(next!==portrait){portrait=next;stop('The room has turned. Resume when you’re ready.');}else if(pointers.size)clearInput();});
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
$('#gentle').addEventListener('change',e=>{game.gentle=e.target.checked;render();say(game.gentle?'Gentler patrols on.':'Normal patrols on.');});
// Nonessential CSS motion follows the system setting live; timing remains readable.
reduced.addEventListener('change',()=>render());
