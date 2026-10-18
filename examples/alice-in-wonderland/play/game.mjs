import {RULES,GUESTS,COURSES,newGame,start,pour,stopPour,refill,serve,pause,resume,continueReading,tick,canAct} from './engine.mjs';
import {characters,cupArt,kettleArt,garden,toastArt,cleanArt} from './art.mjs';
const $=s=>document.querySelector(s),progressKey='newreading-tea-courses-v1';
let storageWarning='',last=performance.now(),pointerId=null,heldKey=null,soundOn=false,audio=null,lastDrop=0,lastStatus='',aboutWasPlaying=false,readingBlockedKey=null;
function load(){try{const p=JSON.parse(sessionStorage.getItem(progressKey)||'null');if(!p||p.version!==1||!Number.isInteger(p.course)||p.course<0||p.course>2||!Array.isArray(p.scores)||!p.scores.every(n=>Number.isInteger(n)&&n>=0&&n<100000))return newGame();if(p.scores.length!==(p.complete?3:p.course))return newGame();const s=newGame(p.course,p.scores);if(p.complete){s.phase='won';s.scores=p.scores;s.score=p.scores[2];s.time=COURSES[2].duration;}return s;}catch{return newGame();}}
let state=load(),shown='',noticeText='',noticeUntil=0;
const table=$('#table'),overlay=$('#overlay');
const icons={pause:'<path d="M8 5v14M16 5v14" stroke-width="3"/>',play:'<path d="M7 4l13 8-13 8z"/>',mute:'<path d="M11 5L6 9H3v6h3l5 4zM16 9l6 6m0-6-6 6"/>',sound:'<path d="M11 5L6 9H3v6h3l5 4zM15 8q5 4 0 8M18 4q8 8 0 16"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
$('#sound').innerHTML=icon('mute');$('#pause').innerHTML=icon('pause');
$('.garden').innerHTML=garden;$('.garden svg').setAttribute('preserveAspectRatio','none');
$('#guests').innerHTML=GUESTS.map((g,i)=>`<div class="guest" data-id="${g.id}" data-index="${i}">${characters[g.id]}<div class="speech" hidden></div></div>`).join('');
$('#cups').innerHTML=GUESTS.map((g,i)=>`<button class="cup" data-id="${i}" aria-label="Pour for ${g.name}. Hold to fill.">${cupArt(i)}<span class="cup-warning" aria-hidden="true">Tea, please!</span><span class="cup-name"><kbd aria-hidden="true">${i+1}</kbd> ${g.name}</span></button>`).join('');
$('#orders').innerHTML=GUESTS.map((g,i)=>`<button class="order" data-id="${i}" hidden><span class="order-art" aria-hidden="true"></span><span class="order-copy"><b></b><small></small></span></button>`).join('');
$('.kettle-art').innerHTML=kettleArt.replaceAll('kettle-clip','home-kettle-clip');$('#flying-kettle').innerHTML=kettleArt.replaceAll('kettle-clip','flying-kettle-clip');
const cups=[...document.querySelectorAll('.cup')],guests=[...document.querySelectorAll('.guest')],orders=[...document.querySelectorAll('.order')];
guests.forEach(g=>{g.querySelector('svg').setAttribute('viewBox','30 0 200 330');g.querySelector('svg').setAttribute('preserveAspectRatio','xMidYMax meet');});
$('#chances').innerHTML='<svg class="chance" viewBox="0 0 30 28" aria-hidden="true"><path d="M4 6h17v11q-8 10-17 0zM22 8h5v8h-6"/><path d="M2 25h22" fill="none"/></svg>'.repeat(3);
const opening={speaker:'Hatter',line:'What must never be empty, though we spend all afternoon emptying it?',reply:'March Hare',answer:'Our cups. Mine is already making a start.',rule:'Hold a cup to pour. Let go at the dotted line. Refill the kettle before it runs dry.'};
const readings={
 places:{title:'Change places.',speaker:'Hatter',line:'How can we change places without leaving the table?',reply:'March Hare',answer:'One place round. Mind whose cup you fill.',rule:'Each guest moves one seat. Follow their cup; keys 1–3 still pour left to right.',action:'Continue · change places'},
 bread:{title:'Butter belongs on bread.',speaker:'March Hare',line:'What makes good bread better, but makes a watch worse?',reply:'Hatter',answer:'Butter. Kindly keep it on the bread this time.',rule:'Tap a bread-and-butter request before its countdown ends. Serving stops pouring briefly; chewing slows that guest’s drinking.',action:'Continue · bring the bread'},
 clean:{title:'A clean cup.',speaker:'Hatter',line:'When is an empty cup better than a full one?',reply:'Dormouse',answer:'When the full one is dirty. But only for a moment.',rule:'After a seat change, a guest may need a clean cup. Tap Clean cup before pouring; the tea inside is discarded. Choose your moment.',action:'Continue · change places'},
};
const courseNotes=[opening.rule,'Keep the cups filled. The March Hare has an appetite.','Keep serving tea and bread. Watch who moves into each seat.'];
function exchange(ex){for(const [name,line] of [[ex.speaker,ex.line],[ex.reply,ex.answer]]){const p=document.createElement('p'),b=document.createElement('b');b.textContent=name;p.append(b,document.createTextNode(line));$('#course-dialogue').append(p);}}
function say(text){$('#live').textContent=text;}
function notice(text,seconds=2){noticeText=text;noticeUntil=state.time+seconds;}
function save(course=state.course,scores=state.scores.slice(0,course),complete=false){try{sessionStorage.setItem(progressKey,JSON.stringify({version:1,course,scores,complete}));storageWarning='';}catch{storageWarning='Course progress can’t be saved in this tab. Keep this page open to keep your place.';}}
function tone(freq=440,length=.1,volume=.035){if(!soundOn)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(freq,audio.currentTime);oscillator.frequency.exponentialRampToValueAtTime(freq*.72,audio.currentTime+length);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+length);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+length);}catch{soundOn=false;$('#sound').innerHTML=icon('mute');$('#sound').setAttribute('aria-label','Sound unavailable');}}
function positions(){return matchMedia('(max-width:700px)').matches?[18,50,82]:[24,50,76];}
function floating(id,text,bad=false){const n=document.createElement('span');n.className='float'+(bad?' bad':'');n.textContent=text;n.style.left=positions()[state.cups[id].seat]+'%';n.style.top='57%';$('#feedback').append(n);setTimeout(()=>n.remove(),1400);}
function clearInputs(reward=false){const captured=pointerId;pointerId=null;heldKey=null;stopPour(state,reward);if(captured!==null&&table.hasPointerCapture(captured))table.releasePointerCapture(captured);}
function beginPour(id){if(state.phase!=='playing')return false;if(state.cups[id].dirty){notice('Tap Clean cup first.');return false;}if(state.kettle===0){notice('Empty kettle. Tap Refill.');return false;}const ok=pour(state,id);if(ok)tone(350+id*70,.055,.02);render();return ok;}
function doRefill(){clearInputs(true);if(refill(state)){notice('Refilling…',RULES.refillSeconds);tone(250,.2);}render();}
function doServe(id){clearInputs(true);if(serve(state,id))tone(420,.1);render();}
function togglePause(){if(state.phase==='playing'){readingBlockedKey=heldKey;clearInputs();pause(state);}else if(state.phase==='paused')resume(state);render();}
function retry(){clearInputs();readingBlockedKey=null;state=newGame(state.course,state.scores);shown='';noticeUntil=0;lastStatus='';$('#feedback').replaceChildren();save();queueMicrotask(()=>say(`Course ${state.course+1}. Start when you’re ready.`));render();}
function replay(){clearInputs();readingBlockedKey=null;state=newGame();shown='';noticeUntil=0;lastStatus='';$('#feedback').replaceChildren();save();say('A new tea party. Start course one when you’re ready.');render();}
function primary(){if(['reading','paused'].includes(state.phase)&&readingBlockedKey)return;if(state.phase==='reading'){continueReading(state);}else if(state.phase==='paused')resume(state);else if(state.phase==='intro')start(state);else if(state.phase==='interlude'){state=newGame(state.course+1,state.scores);start(state);}else if(state.phase==='lost'){retry();start(state);}else if(state.phase==='won'){replay();start(state);}shown='';render();}
function showOverlay(){
 const key=state.phase+':'+state.course;if(key===shown)return;shown=key;
 const phase=state.phase;overlay.hidden=phase==='playing';if(overlay.hidden)return;
 const next=phase==='interlude'?state.course+1:state.course,course=COURSES[next];
 $('#retry-course').textContent=phase==='interlude'?`Replay course ${state.course+1}`:'Retry this course';
 $('#course-dialogue').replaceChildren();$('#result-stats').replaceChildren();$('#result-tip').textContent='';$('#retry-course').hidden=!['interlude','lost','won','paused'].includes(phase);$('#replay-all').hidden=state.course===0&&phase!=='won';
 if(phase==='intro'||phase==='interlude'){
  $('#result-eyebrow').textContent=`Course ${next+1} of 3 · take your time`;
  $('#overlay-title').textContent=course.title;
  if(next===0)exchange(opening);
  $('#result-description').textContent=courseNotes[next];$('#primary-action').textContent=`Start course ${next+1} · ${course.duration}s`;
  $('#result-tip').textContent=phase==='interlude'?`Course ${state.course+1} cleared · ${Math.floor(state.score).toLocaleString()} points. All clocks are stopped.`:'Three complaints lose this course. All clocks wait for you.';
 }else if(phase==='reading'){
  const ex=readings[state.reading];$('#result-eyebrow').textContent=`Course ${state.course+1} · reading break`;$('#overlay-title').textContent=ex.title;exchange(ex);$('#result-description').textContent=ex.rule;$('#primary-action').textContent=ex.action;$('#retry-course').hidden=$('#replay-all').hidden=true;$('#result-tip').textContent='Tea, requests and clock are stopped.';
 }else if(phase==='paused'){
  const ex=state.lastReading?readings[state.lastReading]:state.course===0?opening:null;
  $('#result-eyebrow').textContent=`Course ${state.course+1} · paused${state.lastReading?' · last reading break':ex?' · opening exchange':''}`;$('#overlay-title').textContent=ex?.title||course.title;$('#result-description').textContent=ex?.rule||courseNotes[state.course];$('#primary-action').textContent='Keep pouring';$('#result-tip').textContent='Tea, requests and clock are stopped.';
  if(ex)exchange(ex);
 }else{
  const won=phase==='won';$('#result-eyebrow').textContent=won?'Three courses. Still six o’clock.':`Course ${state.course+1} · three complaints`;
  $('#overlay-title').textContent=won?'Splendidly served.':'This course is over.';
  $('#result-description').textContent=won?'Three courses served, and not a minute closer to supper. The guests take all the credit.':state.course?'Try this course again. Your earlier courses are safe.':'The guests are ready to give you another chance.';
  const total=won?state.scores.reduce((a,b)=>a+b,0):Math.floor(state.score);$('#result-stats').innerHTML=`<strong class="result-score">${total.toLocaleString()}</strong>${won?'total points':`course points · ${state.perfects} lovely pours`}`;
  $('#primary-action').textContent=won?'Play all three again':'Retry this course';$('#retry-course').hidden=!won;$('#replay-all').hidden=won||state.course===0;
  $('#result-tip').textContent=won?'Try for fewer complaints and less tea on the table.':state.course===2?'Let a dirty cup run low before replacing it. Keep the other cups ready.':state.course===1?'Fill the other cups before serving bread or refilling the kettle.':'Fill the thirstiest cup first. Leave everyone tea before refilling.';
 }
 overlay.dataset.dialogue=String($('#course-dialogue').childElementCount>0);
 $('#progress-note').textContent=storageWarning;
 overlay.scrollTop=0;
 if(!$('#about-dialog').open)$(['reading','paused'].includes(phase)?'#overlay-title':'#primary-action').focus({preventScroll:true});
}
function processEvents(){for(const e of state.events.splice(0)){lastStatus='';
 if(e.type==='reading'){readingBlockedKey=heldKey;clearInputs();noticeUntil=0;$('#feedback').replaceChildren();say('Reading break. Tea, requests and clock are stopped. Continue when you are ready.');}
 if(e.type==='continueReading'){say('Back to the table. Choose a cup or request.');}
 if(e.type==='start'){notice(`Course ${state.course+1}`,1.5);say(`Course ${state.course+1} started. ${COURSES[state.course].duration} seconds.`);}
 if(e.type==='perfect'){floating(e.id,`Lovely! +${e.points}`);tone(650,.1);}
 if(e.type==='spill'){floating(e.id,'Spill −25',true);say('Spill. 25 points lost.');}
 if(e.type==='miss'){floating(e.id,e.reason==='toast'?'Bread, please!':'Empty!',true);notice(`${3-state.misses} chance${state.misses===2?'':'s'} left.`,2.5);say(`${GUESTS[e.id].name}: ${e.reason==='toast'?'bread order missed':'empty cup'}. ${3-state.misses} chances left.`);tone(130,.3);}
 if(e.type==='emptyKettle'){notice('Empty kettle! Tap Refill.',2.8);say('Kettle empty. Refill with R or the kettle button.');}
 if(e.type==='refilled'){notice('Fresh tea!',1.1);tone(620,.1);}
 if(e.type==='swap'){clearInputs();notice('Change places!',1.8);say('Guests changed places. Release and choose a cup again.');}
 if(e.type==='order'){say(`${GUESTS[e.id].name} wants bread and butter. Tap the request.`);}
 if(e.type==='dirty'){say(`${GUESTS[e.id].name} needs a clean cup before more tea.`);}
 if(e.type==='served'){floating(e.id,e.kind==='clean'?'Clean cup!':'Munch! +60');tone(730,.12);}
 if(e.type==='end'){clearInputs();if(state.phase==='interlude')save(state.course+1,state.scores);else if(state.phase==='won')save(2,state.scores,true);say(state.phase==='lost'?'Course lost. Retry this course.':state.phase==='won'?'All three courses complete.':`Course ${state.course+1} complete. Take your time with the next request.`);}
}}
function render(){
 processEvents();const course=COURSES[state.course],left=Math.max(0,Math.ceil(course.duration-state.time)),active=canAct(state),moving=state.time<state.swapUntil;
 $('#time').textContent=`0:${String(left).padStart(2,'0')}`;$('#course-label').textContent=`Course ${state.course+1} of 3`;
 $('#score').textContent=(state.scores.slice(0,state.course).reduce((a,b)=>a+b,0)+Math.floor(state.score)).toLocaleString();$('#chances-label').textContent=`${3-state.misses} chance${state.misses===2?'':'s'}`;$('.chances').setAttribute('aria-label',`${3-state.misses} chances remaining`);[...$('#chances').children].forEach((c,i)=>c.classList.toggle('used',i<state.misses));
 const xs=positions();state.cups.forEach((c,i)=>{
  const cup=cups[i],guest=guests[i],order=orders[i],y=133-c.tea*.82;
  cup.style.left=guest.style.left=order.style.left=xs[c.seat]+'%';cup.querySelector('.tea-fill').setAttribute('y',y);cup.querySelector('.tea-fill').setAttribute('height',137-y);cup.querySelector('.tea-surface').setAttribute('cy',y);cup.querySelector('.tea-surface').style.opacity=c.tea<1?'0':'1';
  cup.classList.toggle('low',c.tea<23);cup.classList.toggle('empty',c.tea<=0);cup.classList.toggle('dirty',c.dirty);cup.classList.toggle('pouring',state.target===i);cup.classList.toggle('spilling',state.target===i&&c.tea>99);cup.querySelector('.cup-warning').textContent=c.dirty?'Dirty cup':c.tea<=0?'EMPTY!':'Tea, please!';cup.querySelector('kbd').textContent=c.seat+1;cup.disabled=!active;
  guest.classList.toggle('thirsty',c.tea<23);guest.classList.toggle('angry',c.empty>0);guest.classList.toggle('happy',c.reaction>0);guest.classList.toggle('chewing',c.chewing>0);
  const working=state.service?.id===i,kind=working?state.service.kind:c.dirty?'clean':c.order?'toast':'';order.hidden=!kind||!['playing','paused'].includes(state.phase);order.disabled=!active;order.dataset.kind=kind;order.dataset.left=c.order?c.order.left.toFixed(2):'';
  if(order.dataset.art!==kind){order.querySelector('.order-art').innerHTML=kind==='clean'?cleanArt:toastArt;order.dataset.art=kind;}
  order.querySelector('b').textContent=working?'Serving…':kind==='clean'?'Clean cup':'Bread & butter';
  order.querySelector('small').textContent=working?`${state.service.left.toFixed(1)}s`:kind==='clean'?`${['Q','W','E'][c.seat]} · discards tea`:`${Math.ceil(c.order?.left||0)}s · ${['Q','W','E'][c.seat]}`;
  order.classList.toggle('urgent',!c.dirty&&c.order?.left<2.5);order.setAttribute('aria-label',`${kind==='clean'?'Replace dirty cup':'Serve bread and butter'} for ${c.name}. ${kind==='clean'?'Remaining tea will be discarded.':`${Math.ceil(c.order?.left||0)} seconds left.`} Key ${['Q','W','E'][c.seat]}.`);
 });
 const percent=Math.round(state.kettle/RULES.capacity*100),brewing=state.refill>0;
 $('#refill').classList.toggle('needed',state.kettle<60);$('#refill').classList.toggle('brewing',brewing);$('#refill').classList.toggle('away',state.target!==null);$('#refill').disabled=!active;$('#refill b').textContent=brewing?'Refilling…':state.service?'Serving…':state.kettle===0?'Kettle empty!':'Refill kettle';$('#kettle-state').textContent=brewing?`${state.refill.toFixed(1)} seconds`:state.kettle===0?'Tap here · R':`${percent}% left · 1.8s`;
 document.querySelectorAll('.kettle-tea').forEach(n=>n.setAttribute('y',brewing?145-(1-state.refill/RULES.refillSeconds)*67:145-percent*.67));
 $('#pause').disabled=!['playing','paused'].includes(state.phase);$('#pause').innerHTML=icon(state.phase==='paused'?'play':'pause');$('#pause').setAttribute('aria-label',state.phase==='paused'?'Resume game':'Pause game');
 $('#announcement span').textContent=noticeUntil>state.time?noticeText:state.service?state.service.kind==='clean'?'A fresh cup…':'Bread and butter…':'Tea at six.';
 const flow=state.target!==null&&active&&state.kettle>0;$('#flying-kettle').style.display=$('#stream').style.display=flow?'block':'none';
 if(flow){const r=cups[state.target].getBoundingClientRect(),b=table.getBoundingClientRect(),x=r.x-b.x+r.width*.46,y=r.y-b.y+(r.height-29)*.27;$('#flying-kettle').style.left=x+10+'px';$('#flying-kettle').style.top=y-53+'px';$('#stream path').setAttribute('d',`M${x+10} ${y-53}Q${x-5} ${y-30} ${x} ${y+15}`);$('#stream circle').setAttribute('cx',x);$('#stream circle').setAttribute('cy',y+15);if(state.time-lastDrop>.16){lastDrop=state.time;tone(600,.045,.012);}}
 const status=state.phase+Math.floor(state.time);if(status!==lastStatus){lastStatus=status;state.cups.forEach((c,i)=>cups[i].setAttribute('aria-label',`${c.name}, ${Math.round(c.tea)} percent full.${c.dirty?' Dirty cup: replace before pouring.':` Hold ${c.seat+1} to pour.`}`));$('#refill').setAttribute('aria-label',`Refill kettle, ${percent} percent remaining. Takes 1.8 seconds. Keyboard R.`);}
 table.dataset.phase=state.phase;table.dataset.course=state.course+1;table.dataset.time=state.time.toFixed(2);table.dataset.score=Math.floor(state.score);table.dataset.completed=state.phase==='interlude'||state.phase==='won'?state.course+1:state.course;table.dataset.service=state.service?.kind||'';table.dataset.reading=state.reading||'';table.dataset.lastReading=state.lastReading||'';
 $('#instructions').innerHTML=state.course===0?'<strong>Hold a cup to pour.</strong> Release at the line.':'<strong>Hold cups to pour.</strong> Tap their requests.';
 showOverlay();
}
function frame(now){tick(state,Math.min(.1,(now-last)/1000));last=now;render();requestAnimationFrame(frame);}
// Only actual cup holds pour. No click-to-run automation or hidden simulation controls.
table.addEventListener('pointerdown',e=>{const b=e.target.closest('.cup');if(!b||b.disabled||pointerId!==null||e.button!==0)return;e.preventDefault();heldKey=null;b.focus({preventScroll:true});if(beginPour(Number(b.dataset.id))){pointerId=e.pointerId;table.setPointerCapture(e.pointerId);}});
table.addEventListener('pointermove',e=>{if(e.pointerId!==pointerId)return;const b=document.elementFromPoint(e.clientX,e.clientY)?.closest('.cup');if(b&&!b.disabled){if(Number(b.dataset.id)!==state.target)beginPour(Number(b.dataset.id));}else stopPour(state);});
function release(e){if(e.pointerId===pointerId){pointerId=null;stopPour(state);render();}}
for(const name of ['pointerup','pointercancel','lostpointercapture'])table.addEventListener(name,release);
cups.forEach((b,i)=>{b.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat){heldKey=e.key;beginPour(i);}}});b.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();stopPour(state);heldKey=null;render();}});b.addEventListener('blur',()=>{if([' ','Enter'].includes(heldKey)){stopPour(state);heldKey=null;}});});
orders.forEach((b,i)=>b.addEventListener('click',()=>doServe(i)));
document.addEventListener('keydown',e=>{if($('#about-dialog').open||e.ctrlKey||e.metaKey||e.altKey)return;const key=e.key.toLowerCase();if(['reading','paused'].includes(state.phase)&&e.target===$('#overlay-title')&&['Enter',' '].includes(e.key)){e.preventDefault();if(!e.repeat)primary();return;}if(['1','2','3'].includes(key)){e.preventDefault();if(!e.repeat){heldKey=e.key;beginPour(state.cups.findIndex(c=>c.seat===Number(key)-1));}}else if(['q','w','e'].includes(key)&&!e.repeat){e.preventDefault();doServe(state.cups.findIndex(c=>c.seat===['q','w','e'].indexOf(key)));}else if(key==='r'&&!e.repeat){e.preventDefault();doRefill();}else if(['p','escape'].includes(key)&&!e.repeat){e.preventDefault();togglePause();}});
document.addEventListener('keyup',e=>{if(e.key===readingBlockedKey){e.preventDefault();readingBlockedKey=null;}if(e.key===heldKey){stopPour(state);heldKey=null;render();}});
$('#primary-action').addEventListener('keydown',e=>{if(['reading','paused'].includes(state.phase)&&e.repeat&&['Enter',' '].includes(e.key))e.preventDefault();});
$('#refill').addEventListener('click',doRefill);$('#pause').addEventListener('click',togglePause);$('#restart').addEventListener('click',retry);$('#retry-course').addEventListener('click',retry);$('#replay-all').addEventListener('click',replay);$('#primary-action').addEventListener('click',primary);
$('#sound').addEventListener('click',()=>{soundOn=!soundOn;$('#sound').innerHTML=icon(soundOn?'sound':'mute');$('#sound').setAttribute('aria-label',soundOn?'Turn sound off':'Turn sound on');tone(620,.12);});
$('#about').addEventListener('click',()=>{aboutWasPlaying=state.phase==='playing';if(aboutWasPlaying){clearInputs();pause(state);}$('#about-dialog').showModal();render();});$('#close-about').addEventListener('click',()=>$('#about-dialog').close());$('#about-dialog').addEventListener('close',()=>{shown='';render();if(!aboutWasPlaying&&state.phase==='playing')$('#about').focus();aboutWasPlaying=false;});
function autoPause(){readingBlockedKey=null;clearInputs();if(state.phase==='playing')pause(state);render();}
window.addEventListener('blur',autoPause);window.addEventListener('pagehide',autoPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});window.addEventListener('resize',autoPause);window.addEventListener('orientationchange',autoPause);
render();requestAnimationFrame(frame);
