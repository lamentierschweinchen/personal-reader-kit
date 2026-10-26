import {STAGES,VIEW,RADIUS,cameraFor,targetFor,createGame,roomFor,start,pause,resume,retry,nextRoom,update,guardAt,fanPoints,objective} from './engine.mjs';
import {wallArt,architecture,chapterArt} from './art.mjs';
import {STORY,EDITION_SHA256,citation,storyForHash} from './story.mjs';
import {SAVE_KEY,loadProgress,preserveDamagedSave} from './progress.mjs';
const $=s=>document.querySelector(s);
const castle=$('#castle'),screen=$('#screen'),title=$('#screen-title'),copy=$('#screen-copy'),action=$('#screen-action');
const pauseButton=$('#pause'),restartButton=$('#restart'),replayButton=$('#replay-all'),notes=$('#notes'),announcement=$('#announcement');
const directions=[...document.querySelectorAll('.direction')],reduced=matchMedia('(prefers-reduced-motion: reduce)');
const loaded=loadProgress(),saved=loaded.save;
let malformedSave=loaded.blocked,storageMessage=loaded.migrated?'':loaded.message||'',migrationMessage=loaded.migrated?loaded.message:'';
let game=createGame({stage:Math.min(saved.completed,STAGES.length-1),completed:saved.completed,gentle:saved.gentle});
if(saved.completed===STAGES.length){game.phase='escaped';game.inventory.push(...roomFor(game).requires);game.opened=roomFor(game).doors.map(d=>d.id);}
let keys=new Set(),pointers=new Map(),previous=0,lastPhase='',lastSafety='',lastEvent=-1,buttonKey=null,drawnStage=-1;
const keyMap={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
const numerals=['I','II','III','IV','V'];
const rect=(r,extra='')=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" ${extra}/>`;
const art={
  key:'<circle cx="-6" cy="-5" r="6" fill="none"/><path d="m-2 0 13 13m-4-4 4-4m-8 0 4-4" fill="none"/>',
  bolt:'<rect x="-15" y="-8" width="30" height="16" fill="#b8b0a1"/><path d="M-17 0h34M7 0v-10" fill="none"/>',
  crowbar:'<path d="M-12 16 7-12q4-7 9-1l-5 5M-12 16l-3 3" fill="none" stroke-width="5"/><path d="m-12 16 3 2" fill="none"/>',
  handle:'<path d="M-13 9h11V-9h15" fill="none"/><circle cx="-13" cy="9" r="3"/><circle cx="13" cy="-9" r="3"/>',
  rope:'<ellipse rx="13" ry="16" fill="none"/><ellipse rx="8" ry="11" fill="none"/><ellipse rx="3" ry="6" fill="none"/><path d="M10 11 17 17" fill="none"/>',
  spindle:'<path d="M-15-4h30v8h-30z"/><path d="M-11-9v18M11-9v18M-16 0h-4M16 0h4" fill="none"/>',
  winch:'<circle r="13" fill="none"/><circle r="3"/><path d="M0-13V13M-13 0h26M-9-9 9 9M-9 9 9-9M-18 19h36M-8 13v6M8 13v6" fill="none"/>'
};
function storageStatus(){for(const el of document.querySelectorAll('.save-status:not(#migration-status)')){el.hidden=!storageMessage;el.textContent=storageMessage;}}
function saveProgress(){if(malformedSave){storageStatus();return;}try{localStorage.setItem(SAVE_KEY,JSON.stringify({version:3,completed:game.completed,gentle:game.gentle}));storageMessage='';}catch{storageMessage='Cleared rooms could not be saved. You can keep playing in this tab; reloading may lose this progress.';}storageStatus();}
function doorArt(d){const vertical=d.h>d.w,cx=d.x+d.w/2,cy=d.y+d.h/2;return `<g id="door-${d.id}" class="door" data-open="false">${rect(d,'fill="#d7cbb5" stroke="#655e54" stroke-width="2"')}<g class="door-leaves">${rect({...d,x:d.x+4,y:d.y+4,w:d.w-8,h:d.h-8},'fill="#743b32"')}${Array.from({length:7},(_,i)=>vertical?`<path d="M${d.x+3} ${d.y+8+i*(d.h-16)/6}h${d.w-6}"/>`:`<path d="M${d.x+8+i*(d.w-16)/6} ${d.y+3}v${d.h-6}"/>`).join('')}</g><g class="door-lock" transform="translate(${cx} ${cy})">${d.kind==='shutter'?'<path d="M-9-17 9 17M9-17-9 17" fill="none" stroke="#e5d2a3" stroke-width="4"/>':'<rect x="-6" y="-5" width="12" height="11" rx="2" fill="#e5d2a3" stroke="#292925" stroke-width="1"/><path d="M-4-5v-3a4 4 0 0 1 8 0v3" fill="none" stroke="#292925"/><circle r="1.5" fill="#292925"/>'}</g></g>`;}
function buildRoom(){
 const room=roomFor(game),w=room.width,h=room.height;drawnStage=game.stage;
 const occupied=c=>[...room.items,room.exit].some(p=>p.x>=c.x&&p.x<=c.x+c.w&&p.y>=c.y&&p.y<=c.y+c.h);
 const stones=[];
 for(let n=55;n<w-40;n+=35)stones.push(`<path d="M${n} 24v25M${n} ${h-49}v25"/>`);
 for(let n=55;n<h-40;n+=35)stones.push(`<path d="M24 ${n}h25M${w-49} ${n}h25"/>`);
 castle.innerHTML=`<defs>
 <pattern id="masonry" width="48" height="24" patternUnits="userSpaceOnUse"><rect width="48" height="24" fill="#bcb3a2"/><path d="M0 0h48M0 12h48M24 0v12M0 12v12M48 12v12" fill="none" stroke="#817968" stroke-opacity=".55" stroke-width=".8"/></pattern>
 <pattern id="paving" width="70" height="70" patternUnits="userSpaceOnUse"><path d="M0 0h70M0 35h70M0 0v35M35 35v35" fill="none" stroke="#b8b0a1" stroke-opacity=".45" stroke-width=".65"/></pattern>
 <pattern id="hatching" width="8" height="8" patternUnits="userSpaceOnUse"><path d="m-2 2 4-4M0 8 8 0m-2 10 4-4" fill="none" stroke="#f3eee3" stroke-opacity=".13" stroke-width=".8"/></pattern>
 <radialGradient id="candlelight"><stop stop-color="#e5d2a3" stop-opacity=".55"/><stop offset="1" stop-color="#e5d2a3" stop-opacity="0"/></radialGradient>
 <clipPath id="floor-clip"><rect x="49" y="49" width="${w-98}" height="${h-98}"/></clipPath>
 <mask id="shadow-mask"><rect width="${w}" height="${h}" fill="white"/>${room.covers.map(c=>rect({x:c.x+RADIUS,y:c.y+RADIUS,w:c.w-2*RADIUS,h:c.h-2*RADIUS},'fill="black"')).join('')}</mask>
 </defs>
 <rect x="24" y="24" width="${w-48}" height="${h-48}" fill="#c4bcac" stroke="#655e54" stroke-width="1.5"/>
 <g fill="none" stroke="#7f7668" stroke-opacity=".6" stroke-width="1">${stones.join('')}</g>
 <rect x="38" y="38" width="${w-76}" height="${h-76}" fill="none" stroke="#807866" stroke-width="1.2"/>
 <rect x="49" y="49" width="${w-98}" height="${h-98}" fill="${game.stage===1?'#e4dfd2':'#e9e2d5'}" stroke="#655e54" stroke-width="2"/>
 <path d="M51 ${h-51}V51H${w-51}" fill="none" stroke="#f3eee3" stroke-width="3"/>
 <rect x="49" y="49" width="${w-98}" height="${h-98}" fill="url(#paving)"/>
 ${architecture(room)}
 <g aria-hidden="true">${room.covers.map(c=>`<g data-cover="${c.id}">${rect(c,'fill="#3c413d" stroke="#292925" stroke-width="1.2"')}${rect(c,'fill="url(#hatching)"')}<path d="M${c.x+7} ${c.y+c.h-7}V${c.y+22}Q${c.x+c.w/2} ${c.y-2} ${c.x+c.w-7} ${c.y+22}V${c.y+c.h-7}" fill="none" stroke="#f3eee3" stroke-opacity=".3" stroke-width="1"/>${occupied(c)?'':`<text x="${c.x+c.w/2}" y="${c.y+c.h-9}" class="cover-label">SHADOW</text>`}</g>`).join('')}</g>
 <g clip-path="url(#floor-clip)">${room.candles.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="44" fill="url(#candlelight)"/>`).join('')}</g>
 <g>${room.patrols.map(p=>`<path class="route" d="${p.points.map((v,i)=>(i?'L':'M')+v.join(' ')).join(' ')}Z"/>`).join('')}</g>
 <g id="fans" clip-path="url(#floor-clip)" mask="url(#shadow-mask)">${room.patrols.map((_,i)=>`<polygon id="fan-${i}" class="sight"/>`).join('')}</g>
 <g>${room.walls.map(wallArt).join('')}</g>
 <g fill="none" stroke="#292925" stroke-width="2">${room.doors.map(doorArt).join('')}</g>
 <g>${room.labels.map(l=>`<text x="${l.x}" y="${l.y}" class="map-label">${l.text}</text>`).join('')}</g>
 <g id="exit" transform="translate(${room.exit.x} ${room.exit.y})"><path d="M-26 24v-34q26-30 52 0v34" fill="#9b9281" stroke="#655e54" stroke-width="3"/><path d="M-20 21v-28q20-23 40 0v28" fill="#292925"/>${game.stage<STAGES.length-1?Array.from({length:5},(_,i)=>`<path d="M-19 ${i*6-8}h38" stroke="#f3eee3" stroke-opacity="${.25+i*.15}" stroke-width="3"/>`).join(''):'<path d="M-18 20 0 2 18 20" fill="none" stroke="#f3eee3" stroke-width="2"/>'}<text y="39" class="target-label">${room.exit.label}</text></g>
 <g>${room.items.map(item=>`<g id="object-${item.id}" class="object" transform="translate(${item.x} ${item.y})" data-collected="false"><circle class="object-halo" r="22"/><g stroke="#743b32" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" fill="#e5d2a3">${art[item.kind]}</g><text y="34" class="target-label">${item.label}</text></g>`).join('')}</g>
 <g>${room.candles.map(([x,y])=>`<g transform="translate(${x} ${y})"><ellipse cy="6" rx="6" ry="3" fill="#292925"/><path d="M0 6V-2" stroke="#f3eee3" stroke-width="3"/><path class="candle-flame" d="M0-12Q-7-3 0-1Q6-4 0-12Z"/></g>`).join('')}</g>
 <g id="patrols">${room.patrols.map((_,i)=>`<g id="patrol-${i}"><ellipse cy="5" rx="17" ry="20" fill="#292925" opacity=".18"/><g class="cloak"><path d="M-7-10Q-17-7-18 7L-19 24Q-8 17 0 24Q8 17 19 24L18 7Q17-7 7-10Z" fill="#282a28" stroke="#ece5d7" stroke-width="1.2"/><path d="M-10-6 0 0 10-6" fill="#743b32"/><ellipse cy="-12" rx="8" ry="9" fill="#d9d2c2" stroke="#292925" stroke-width="2"/><path d="M-7-15Q0-24 7-15L3-20H-3Z" fill="#292925"/><path d="M-4-12h2M2-12h2" stroke="#743b32" stroke-width="2"/><path d="m-2-7 2 2 2-2" fill="none" stroke="#655e54" stroke-width="1"/><path d="M-9 6-6 18M8 4 9 18" stroke="#655e54" stroke-width="1"/></g></g>`).join('')}</g>
 <g id="harker"><circle class="player-ring" r="22"/><circle id="warning-ring" class="danger-ring" r="25" stroke-dasharray="0 158"/><g id="harker-body"><ellipse cy="13" rx="13" ry="9" fill="#292925" opacity=".22"/><path d="M-8-2-13 15Q0 20 13 15L8-2Z" fill="#dfd4bc" stroke="#292925" stroke-width="2"/><path d="M0-2v17M-7 18v4M7 18v4" stroke="#292925" stroke-width="2"/><circle cy="-10" r="7" fill="#f3eee3" stroke="#292925" stroke-width="1.6"/><path d="M-6-12Q0-19 7-11" fill="none" stroke="#292925" stroke-width="3"/><path d="M10 3 18-2" stroke="#e9e2d5" stroke-width="4"/><rect x="14" y="-5" width="8" height="11" rx="1" fill="#e5d2a3" stroke="#292925" stroke-width="1.5"/><path d="M17-5v-3h3v3M18-2v5" fill="none" stroke="#743b32" stroke-width="1"/></g></g>`;
 castle.setAttribute('tabindex','0');castle.setAttribute('aria-label',`${room.title}. ${room.intro} Red fans show the patrols’ sight. Dark alcoves hide you. Stonework and furniture block movement and sight.`);
 $('#room-label').textContent=`${numerals[game.stage]} / V · ${room.title}`;
 castle.dataset.worldWidth=String(w);castle.dataset.worldHeight=String(h);
}

function drawPlan(){
 const room=roomFor(game),camera=cameraFor(game),plan=$('#floor-plan');
 $('#plan-state').textContent=game.phase==='ready'?'Whole room · not started':'Whole room · play paused';
 const mapWidth=Math.min(Math.max(200,Math.min(560,innerWidth-24)-48),innerHeight*.45*room.width/room.height);
 const scale=room.width/mapWidth,font=11*scale,r=9*scale;
 plan.setAttribute('viewBox',`0 0 ${room.width} ${room.height}`);
 plan.setAttribute('aria-label',`${room.title}. Full floor plan with numbered objects, your position, and the exit.`);
 plan.innerHTML=`<rect x="24" y="24" width="${room.width-48}" height="${room.height-48}" fill="#e9e2d5" stroke="#655e54" stroke-width="${scale}"/>
 ${room.covers.map(c=>rect(c,'fill="#b8b0a1"')).join('')}
 ${room.walls.map(w=>rect(w,'fill="#655e54"')).join('')}
 ${room.doors.filter(d=>!game.opened.includes(d.id)).map(d=>rect(d,'fill="#743b32"')).join('')}
 <rect x="${camera.x+4}" y="${camera.y+4}" width="${VIEW-8}" height="${VIEW-8}" fill="none" stroke="#743b32" stroke-dasharray="${4*scale} ${3*scale}" stroke-width="${scale}"/>
 ${room.items.map((item,i)=>`<g opacity="${game.inventory.includes(item.id)?.4:1}"><circle cx="${item.x}" cy="${item.y}" r="${r}" fill="#f3eee3" stroke="#743b32" stroke-width="${scale}"/><text x="${item.x}" y="${item.y+font*.35}" text-anchor="middle" fill="#743b32" font-size="${font}">${i+1}</text></g>`).join('')}
 <g transform="translate(${room.exit.x} ${room.exit.y})"><path d="M${-r} ${r}V${-r/2}Q0 ${-2*r} ${r} ${-r/2}V${r}Z" fill="#292925"/><text y="${r+font*1.2}" text-anchor="middle" font-size="${font}" fill="#292925">${game.stage===STAGES.length-1?'GATE':room.exit.label}</text></g>
 <circle id="plan-you" cx="${game.player.x}" cy="${game.player.y}" r="${6*scale}" fill="#743b32" stroke="#f3eee3" stroke-width="${2*scale}"/>`;
 $('#plan-summary').textContent=room.title+'. '+objective(game)+'.';
 $('#plan-objects').innerHTML=room.items.map(item=>`<li>${item.kind==='winch'?'Winch':item.name}${game.inventory.includes(item.id)?'<span> — done</span>':''}</li>`).join('');
}
function say(text){announcement.textContent=text;}
function clearInput(){keys.clear();pointers.clear();buttonKey=null;for(const b of directions)b.setAttribute('aria-pressed','false');}
function input(){const all=new Set([...keys,...pointers.values()]);return {x:Number(all.has('right'))-Number(all.has('left')),y:Number(all.has('down'))-Number(all.has('up'))};}
function syncButtons(){const all=new Set([...keys,...pointers.values()]);for(const b of directions)b.setAttribute('aria-pressed',String(all.has(b.dataset.dir)));}
function begin(){clearInput();start(game);lastPhase='';render();castle.focus({preventScroll:true});say(roomFor(game).intro);}
function replaceGame(next,{immediate=false}={}){clearInput();game=next;lastPhase='';lastSafety='';lastEvent=-1;drawnStage=-1;buildRoom();if(immediate)begin();else{render();$('#chapter-start').focus({preventScroll:true});}}
function reset(){replaceGame(retry(game),{immediate:true});}
function replayAll(){
 if(malformedSave){try{preserveDamagedSave(localStorage);malformedSave=false;}catch{storageMessage='The unreadable save could not be copied, so it is still untouched. You can replay in this tab, but this new run cannot be saved yet.';}}
 migrationMessage='';game=createGame({gentle:game.gentle});saveProgress();replaceGame(game);
}
function stop(reason='Your place is safe. Resume when you’re ready.'){
 clearInput();if(game.phase!=='playing')return;pause(game);render();copy.textContent=reason;action.focus({preventScroll:true});say('Paused. '+reason);
}
function continueGame(){clearInput();resume(game);render();castle.focus({preventScroll:true});say('Resumed.');}
function showScreen(){
 const p=game.phase,room=roomFor(game);screen.hidden=p==='playing'||p==='ready';$('#chapter-screen').hidden=p!=='ready';document.body.dataset.mode=p;$('.game-shell').inert=p==='ready';if(p==='ready')showOpening();pauseButton.disabled=!['playing','paused'].includes(p);pauseButton.querySelector('span').textContent=p==='paused'?'Resume':'Pause';
 for(const b of directions)b.disabled=p!=='playing';
 restartButton.hidden=p!=='paused';replayButton.hidden=!['ready','paused','interlude','caught'].includes(p)||(game.completed===0&&!malformedSave);
 if(p==='playing')return;clearInput();$('#screen-kicker').textContent=`Room ${numerals[game.stage]} of V`;
 if(p==='ready'){title.textContent=room.title;copy.textContent=room.intro;action.textContent=game.completed?'Continue escape':'Enter the castle';}
 if(p==='paused'){title.textContent='The castle waits.';copy.textContent='Your place is safe. Resume when you’re ready.';action.textContent='Resume escape';}
 if(p==='caught'){title.textContent='A shadow found you.';copy.textContent=`Try ${room.title.toLowerCase()} again. Cleared rooms are kept.`;action.textContent='Retry this room';say('Caught. Retry this room. Cleared rooms are kept.');}
 if(p==='interlude'){title.textContent=room.short+' cleared.';copy.textContent=room.cleared;action.textContent='Continue to '+STAGES[game.stage+1].short.toLowerCase();saveProgress();say(title.textContent+' '+room.cleared);}
 if(p==='escaped'){$('#screen-kicker').textContent='All five rooms cleared';title.textContent='Beyond the walls.';copy.textContent=STAGES.at(-1).cleared;action.textContent='Replay all rooms';saveProgress();say('You escaped the castle. All five rooms cleared.');}
 screen.scrollTop=0;if(p!=='ready')action.focus({preventScroll:true});
}
function render(){
 if(drawnStage!==game.stage)buildRoom();
 castle.dataset.phase=game.phase;castle.dataset.stage=String(game.stage+1);castle.dataset.completed=String(game.completed);castle.dataset.playing=String(game.phase==='playing');castle.dataset.gentle=String(game.gentle);castle.dataset.time=game.time.toFixed(3);castle.dataset.patrolTime=game.patrolTime.toFixed(3);castle.dataset.inventory=game.inventory.join(',');castle.dataset.opened=game.opened.join(',');castle.dataset.warning=game.warning.toFixed(3);
 if(game.phase!==lastPhase){lastPhase=game.phase;showScreen();}
 const camera=cameraFor(game),target=targetFor(game),bearing=$('#bearing');
 castle.setAttribute('viewBox',`${camera.x.toFixed(2)} ${camera.y.toFixed(2)} ${VIEW} ${VIEW}`);
 castle.dataset.cameraX=camera.x.toFixed(2);castle.dataset.cameraY=camera.y.toFixed(2);
 bearing.toggleAttribute('hidden',target.x>=camera.x+28&&target.x<=camera.x+VIEW-28&&target.y>=camera.y+28&&target.y<=camera.y+VIEW-28);
 bearing.style.transform=`rotate(${Math.atan2(target.y-game.player.y,target.x-game.player.x)*180/Math.PI}deg)`;
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
function showOpening(){
 const room=roomFor(game),story=STORY[game.stage];
 $('#chapter-kicker').textContent=`Castle escape · Room ${numerals[game.stage]} of V`;
 $('#chapter-title').textContent=room.title;$('#chapter-illustration').innerHTML=chapterArt(game.stage);
 $('#chapter-quote').textContent=story.quote;$('#chapter-source').textContent=`Jonathan Harker’s journal · Chapter ${story.chapter}`;$('#chapter-source').href=story.href;
 $('#chapter-goal').textContent=room.intro;$('#chapter-start').textContent='Start '+room.short.toLowerCase();
 $('#chapter-replay').hidden=game.completed===0&&!malformedSave;
 $('#migration-status').hidden=!migrationMessage;$('#migration-status').textContent=migrationMessage;
 $('.chapter-scroll').scrollTop=0;
}
let sourceBook=null,referenceStory=null,referenceRequest=0;
async function readSource(story){
 const request=++referenceRequest;referenceStory=story;$('#source-citation').textContent=citation(story);
 const detail=story===STORY[2]?'In this passage Harker finds no further outlet. The courtyard stair belongs to the game.':story===STORY[4]?'Harker plans to try the castle wall. The game’s successful gatehouse escape is invented.':'';
 $('#source-detail').hidden=!detail;$('#source-detail').textContent=detail;
 $('#source-passage').replaceChildren();$('#source-loading').hidden=false;$('#source-loading').textContent='Opening the passage…';$('#source-retry').hidden=true;
 try{
  if(!sourceBook){
   const response=await fetch(new URL('../library.json',import.meta.url));if(!response.ok)throw Error('edition unavailable');
   const bytes=await response.arrayBuffer(),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
   if(hash!==EDITION_SHA256)throw Error('different edition');sourceBook=JSON.parse(new TextDecoder().decode(bytes))[0];
  }
  if(request!==referenceRequest)return;
  const section=sourceBook.sections.find(s=>s.id===story.section),blocks=story.context.map(id=>section.blocks.find(b=>b.id===id));
  if(!blocks.every(b=>b&&b.marks.length===0)||!blocks.some(b=>b.id===story.block&&b.text.slice(story.start,story.end)===story.quote))throw Error('different passage');
  for(const block of blocks){
   const p=document.createElement('p');p.dataset.block=block.id;
   if(block.id===story.block){const mark=document.createElement('mark');mark.id='source-excerpt';mark.textContent=block.text.slice(story.start,story.end);p.append(document.createTextNode(block.text.slice(0,story.start)),mark,document.createTextNode(block.text.slice(story.end)));}
   else p.textContent=block.text;$('#source-passage').append(p);
  }
  $('#source-loading').hidden=true;
  const excerpt=$('#source-excerpt'),bounds=excerpt.getBoundingClientRect(),dialogBounds=notes.getBoundingClientRect(),top=dialogBounds.top+$('.dialog-head').getBoundingClientRect().height+24;
  if(bounds.top<top||bounds.bottom>dialogBounds.bottom-24)notes.scrollTop+=bounds.top-top;
 }catch{
  if(request!==referenceRequest)return;
  $('#source-loading').textContent='The surrounding passage could not be opened. The room’s quotation is below; your game and reading place are kept.';
  const p=document.createElement('p');p.textContent=story.quote;$('#source-passage').append(p);$('#source-retry').hidden=false;
 }
}
function visitSource(story,trigger){noteTrigger=trigger;if(location.hash===story.href){openNotes('source',trigger);readSource(story);}else location.hash=story.href;}
function referenceRoute(){const story=storyForHash(location.hash);if(story){openNotes('source',noteTrigger||$('#about'));readSource(story);}else if(notes.open&&!$('#source-panel').hidden)notes.close();}
window.addEventListener('hashchange',referenceRoute);
$('#source-retry').addEventListener('click',()=>readSource(referenceStory));
$('#gentle').checked=game.gentle;if(loaded.migrated)saveProgress();storageStatus();buildRoom();render();requestAnimationFrame(frame);
action.addEventListener('click',()=>{if(game.phase==='paused')continueGame();else if(game.phase==='caught')reset();else if(game.phase==='interlude')replaceGame(nextRoom(game));else if(game.phase==='escaped')replayAll();});
$('#chapter-start').addEventListener('click',begin);$('#chapter-replay').addEventListener('click',replayAll);
restartButton.addEventListener('click',reset);replayButton.addEventListener('click',replayAll);pauseButton.addEventListener('click',()=>game.phase==='paused'?continueGame():stop());
for(const b of directions){
  b.setAttribute('aria-pressed','false');
  b.addEventListener('pointerdown',e=>{
    if(e.button!==0&&e.pointerType==='mouse')return;
    e.preventDefault();if(game.phase!=='playing')return;
    pointers.set(e.pointerId,b.dataset.dir);b.setPointerCapture(e.pointerId);syncButtons();
  });
  const release=e=>{pointers.delete(e.pointerId);syncButtons();};
  b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
  b.addEventListener('contextmenu',e=>e.preventDefault());
  // Enter/Space on a focused arrow moves a short, repeatable step as well.
  b.addEventListener('keydown',e=>{if(e.code!=='Space'&&e.code!=='Enter')return;e.preventDefault();e.stopPropagation();if(game.phase==='playing'){buttonKey=b.dataset.dir;keys.add(buttonKey);syncButtons();}});
  b.addEventListener('keyup',e=>{if(e.code!=='Space'&&e.code!=='Enter')return;e.preventDefault();e.stopPropagation();keys.delete(b.dataset.dir);buttonKey=null;syncButtons();});
}
window.addEventListener('keydown',e=>{
  if(notes.open||game.phase==='ready'||e.metaKey||e.ctrlKey||e.altKey)return;
  if(e.code==='Escape'){if(game.phase==='playing')stop();return;}
  if(e.code==='Space'&&!e.target.closest('button,a,input')){e.preventDefault();if(!e.repeat){if(game.phase==='playing')stop();else if(game.phase==='paused')continueGame();}return;}
  const dir=keyMap[e.code];if(!dir)return;e.preventDefault();
  if(game.phase==='playing'){keys.add(dir);syncButtons();}
});
window.addEventListener('keyup',e=>{const dir=keyMap[e.code];if(dir)keys.delete(dir);if((e.code==='Space'||e.code==='Enter')&&buttonKey){keys.delete(buttonKey);buttonKey=null;}syncButtons();});
window.addEventListener('blur',()=>stop('The page lost focus. Resume when you’re ready.'));
window.addEventListener('pagehide',()=>stop());
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('You stepped away. Resume when you’re ready.');});
let portrait=innerHeight>=innerWidth;
window.addEventListener('resize',()=>{const next=innerHeight>=innerWidth;if(next!==portrait){portrait=next;stop('The room has turned. Resume when you’re ready.');}else stop('The view changed. Resume when you’re ready.');if(notes.open&&!$('#map-panel').hidden)drawPlan();});
window.addEventListener('orientationchange',()=>stop('The room has turned. Resume when you’re ready.'));

let noteTrigger=null;
function openNotes(which,trigger){
  stop();clearInput();noteTrigger=trigger;
  $('#source-panel').hidden=which!=='source';$('#help-panel').hidden=which!=='help';$('#map-panel').hidden=which!=='map';if(which==='map')drawPlan();
  $('#notes-title').textContent=which==='source'?'From the novel':which==='map'?'Floor plan':'How to play';
  if(!notes.open)notes.showModal();notes.scrollTop=0;$('#close-notes').focus();
}
$('#about').addEventListener('click',e=>visitSource(STORY[game.stage],e.currentTarget));
$('#chapter-source').addEventListener('click',e=>{e.preventDefault();visitSource(STORY[game.stage],e.currentTarget);});
$('#help').addEventListener('click',e=>openNotes('help',e.currentTarget));
$('#map').addEventListener('click',e=>openNotes('map',e.currentTarget));
function clearReferenceRoute(){if(storyForHash(location.hash))history.replaceState(null,'',location.pathname+location.search);}
$('#close-notes').addEventListener('click',()=>{clearReferenceRoute();notes.close();});
notes.addEventListener('cancel',clearReferenceRoute);
notes.addEventListener('close',()=>{clearInput();clearReferenceRoute();noteTrigger?.focus({preventScroll:true});});
$('#gentle').addEventListener('change',e=>{game.gentle=e.target.checked;saveProgress();render();say(game.gentle?'Gentler patrols on.':'Normal patrols on.');});
// Nonessential CSS motion follows the system setting live; timing remains readable.
reduced.addEventListener('change',()=>render());

referenceRoute();

// Dismiss only a completed gesture that began on an already-open backdrop.
function enableBackdropDismissal(){
  let press=null,released=null;const pointers=new Set();
  const reset=()=>{press=null;released=null;};
  const outside=(modal,event)=>{const r=modal.getBoundingClientRect();return r.width>0&&r.height>0&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
  const eligible=(modal,event)=>modal.open&&modal.matches(':modal')&&document.elementFromPoint(event.clientX,event.clientY)?.closest('dialog')===modal&&outside(modal,event);
  document.addEventListener('pointerdown',event=>{
    reset();pointers.add(event.pointerId);const modal=event.target instanceof Element?event.target.closest('dialog'):null;
    if(pointers.size===1&&event.isPrimary&&event.button===0&&modal instanceof HTMLDialogElement&&eligible(modal,event))press={modal,id:event.pointerId,type:event.pointerType,x:event.clientX,y:event.clientY};
  },true);
  document.addEventListener('pointermove',event=>{if(press&&event.pointerId===press.id&&(Math.hypot(event.clientX-press.x,event.clientY-press.y)>8||!eligible(press.modal,event)))reset();},true);
  document.addEventListener('pointerup',event=>{
    const start=press,single=pointers.size===1;reset();pointers.delete(event.pointerId);
    if(start&&single&&start.id===event.pointerId&&event.button===0&&eligible(start.modal,event)&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<=8)released=start;
  },true);
  document.addEventListener('pointercancel',event=>{pointers.delete(event.pointerId);reset();},true);
  document.addEventListener('lostpointercapture',event=>{if(press?.id===event.pointerId)reset();},true);
  for(const type of ['scroll','wheel','contextmenu','keydown','close'])document.addEventListener(type,reset,{capture:true,passive:true});
  window.addEventListener('blur',()=>{pointers.clear();reset();});
  new MutationObserver(records=>{if(records.some(record=>record.target instanceof HTMLDialogElement))reset();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  document.addEventListener('click',event=>{
    const start=released;reset();
    if(!start||event.detail===0||event.button!==0||!start.modal.open||!start.modal.matches(':modal')||event.target.closest?.('dialog')!==start.modal||(event.pointerType===start.type&&event.pointerId!==start.id))return;
    // Touch hit adjustment may move the click inside; physical down/up already proved the backdrop gesture.
    event.preventDefault();event.stopImmediatePropagation();
    // Existing cancel handlers retain draft checks, source anchors and focus return.
    // A dialog without a cancel override retains its native close-event behavior.
    if(start.modal.dispatchEvent(new Event('cancel',{cancelable:true}))&&start.modal.open)start.modal.close();
  },true);
}
enableBackdropDismissal();
