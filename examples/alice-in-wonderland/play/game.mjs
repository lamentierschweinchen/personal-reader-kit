import {RULES,GUESTS,newGame,pour,stopPour,refill,pause,resume,tick} from './engine.mjs';
import {characters,cupArt,kettleArt,garden} from './art.mjs';

const $=s=>document.querySelector(s);
let state=newGame(), last=performance.now(), best=0, endShown=false, pointerId=null, heldKey=null;
let soundOn=false,audio=null,lastDrop=0,lastStatus=-1,aboutWasPlaying=false;
const table=$('#table'),overlay=$('#overlay');
const icons={
 pause:'<path d="M8 5v14M16 5v14" stroke-width="3"/>',
 play:'<path d="M7 4l13 8-13 8z"/>',
 mute:'<path d="M11 5L6 9H3v6h3l5 4zM16 9l6 6m0-6-6 6"/>',
 sound:'<path d="M11 5L6 9H3v6h3l5 4zM15 8q5 4 0 8M18 4q8 8 0 16"/>'
};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
$('#sound').innerHTML=icon('mute');$('#pause').innerHTML=icon('pause');
$('.garden').innerHTML=garden;$('.garden svg').setAttribute('preserveAspectRatio','none');
$('#guests').innerHTML=GUESTS.map((g,i)=>`<div class="guest" data-id="${g.id}" data-index="${i}">${characters[g.id]}<div class="speech"></div></div>`).join('');
$('#cups').innerHTML=GUESTS.map((g,i)=>`<button class="cup" data-id="${i}" aria-label="Pour for ${g.name}. Hold to fill.">${cupArt(i)}<span class="cup-warning" aria-hidden="true">Tea, please!</span><span class="cup-name"><kbd aria-hidden="true">${i+1}</kbd> ${g.name}</span></button>`).join('');
$('.kettle-art').innerHTML=kettleArt.replaceAll('kettle-clip','home-kettle-clip');
$('#flying-kettle').innerHTML=kettleArt.replaceAll('kettle-clip','flying-kettle-clip');
const cups=[...document.querySelectorAll('.cup')],guests=[...document.querySelectorAll('.guest')];
guests.forEach(guest=>{const drawing=guest.querySelector('svg');drawing.setAttribute('viewBox','30 0 200 330');drawing.setAttribute('preserveAspectRatio','xMidYMax meet');});
const bubbles=GUESTS.map(()=>({until:0,text:''}));
const talks=[
 [4,0,'No butter in the watch today.'],[7.5,1,'But it was excellent butter.'],
 [13,2,'I was listening in my sleep.'],[18,0,'Any news from the writing-desk?'],
 [28,1,'The raven has declined to say.'],[34,2,'I dreamt of a treacle well.'],
 [38,0,'Can it refill the kettle?'],[48,1,'What an inconveniently empty cup.'],
 [54,2,'Wake me when it’s yesterday.'],[63,0,'Time is taking this personally.']
];
let talkIndex=0,noticeUntil=4,noticeText='It’s always tea-time here.',noticeUrgent=false;
const tinyCup='<svg class="chance" viewBox="0 0 30 28" aria-hidden="true"><path d="M4 6h17v11q-8 10-17 0zM22 8h5v8h-6"/><path d="M2 25h22" fill="none"/></svg>';
$('#chances').innerHTML=tinyCup.repeat(3);
function say(text){$('#live').textContent=text;}
function notice(text,seconds=2.5,urgent=false){noticeText=text;noticeUntil=state.time+seconds;noticeUrgent=urgent;}
function speech(id,text,seconds=3.2){bubbles[id]={text,until:state.time+seconds};}
function tone(freq=440,length=.1,volume=.035){
  if(!soundOn)return;
  try{
    audio??=new(window.AudioContext||window.webkitAudioContext)();
    if(audio.state==='suspended')audio.resume();
    const oscillator=audio.createOscillator(),gain=audio.createGain();
    oscillator.type='sine';oscillator.frequency.setValueAtTime(freq,audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(freq*.72,audio.currentTime+length);
    gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+length);
    oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+length);
  }catch{soundOn=false;$('#sound').innerHTML=icon('mute');$('#sound').setAttribute('aria-label','Sound unavailable');}
}
function positions(){return matchMedia('(max-width:700px)').matches?[18,50,82]:[24,50,76];}
function floating(id,text,bad=false){
  const node=document.createElement('span');node.className='float'+(bad?' bad':'');node.textContent=text;
  node.style.left=positions()[state.cups[id].seat]+'%';node.style.top='59%';$('#feedback').append(node);
  setTimeout(()=>node.remove(),1400);
}
function clearInputs(){pointerId=null;heldKey=null;stopPour(state);}
function beginPour(id){
  if(state.phase==='playing' && state.kettle===0){notice('The kettle’s empty. Refill!',2,true);tone(160);return false;}
  if(state.refill>0){notice('Brewing… nearly there.',1);return false;}
  const ok=pour(state,id);if(ok){tone(350+id*70,.055,.02);render();}return ok;
}
function doRefill(){clearInputs();if(refill(state)){notice('A moment to refill…',1.8);tone(250,.2);render();}}
function togglePause(){
  if(state.phase==='playing'){clearInputs();pause(state);showPause();}
  else if(state.phase==='paused'){resume(state);overlay.hidden=true;$('#pause').focus();}
  render();
}
function showPause(){
  $('#result-eyebrow').textContent='EVEN TIME NEEDS A MOMENT';$('#overlay-title').textContent='Tea can wait.';
  $('#result-description').textContent='Your cups are exactly as you left them.';$('#result-stats').textContent='';
  $('#result-tip').textContent='Hold a cup to pour · R to refill · P to pause';
  $('#primary-action').textContent='Keep pouring';overlay.hidden=false;$('#primary-action').focus();
}
function reset(){
  clearInputs();state=newGame();talkIndex=0;endShown=false;lastStatus=-1;noticeUntil=4;noticeText='It’s always tea-time here.';noticeUrgent=false;
  bubbles.forEach((b,i)=>bubbles[i]={text:'',until:0});$('#feedback').replaceChildren();overlay.hidden=true;
  $('#first-move').hidden=false;last=performance.now();render();cups[0].focus({preventScroll:true});
}
function finish(){
  if(endShown)return;endShown=true;clearInputs();best=Math.max(best,Math.floor(state.score));
  const won=state.phase==='won';
  $('#result-eyebrow').textContent=won?'75 SECONDS. STILL SIX O’CLOCK.':'THREE EMPTY CUPS. AN UPROAR.';
  $('#overlay-title').textContent=won?'Splendidly served.':'Tea-party over.';
  $('#result-description').textContent=won?'You kept the party going. The guests take all the credit.':`You lasted ${Math.floor(state.time)} seconds. They’re terribly particular about tea.`;
  $('#result-stats').innerHTML=`<strong class="result-score">${Math.floor(state.score).toLocaleString()}</strong>points · ${state.perfects} lovely pours · ${state.spills} spills<br>Best this visit: ${best.toLocaleString()}`;
  $('#primary-action').textContent='Another cup? Play again';
  $('#result-tip').textContent=state.spills>2?'Release at the dotted line. A little room saves a lot of tea.':state.misses>0?'Top everyone up before you refill the kettle.': 'A lovely pour lands near the line. Can you beat your score?';
  overlay.hidden=false;$('#primary-action').focus();say(`${won?'Round complete':'Party over'}. ${Math.floor(state.score)} points. Play again available.`);
  tone(won?740:180,.4,.045);
}
function processEvents(){
  for(const e of state.events.splice(0)) {
    lastStatus=-1;
    if(e.type==='start'){$('#first-move').hidden=true;notice('Release at the dotted line.',3);say('Party started. Keep all three cups filled for 75 seconds.');}
    if(e.type==='perfect'){floating(e.id,`Lovely! +${e.points}`);tone(580+Math.min(state.combo,5)*90,.13);}
    if(e.type==='spill'){floating(e.id,'Spill −25',true);speech(e.id,['The table isn’t thirsty.','That’s quite enough!','My saucer is swimming.'][e.id],2);tone(135,.15);say('Spill. 25 points lost.');}
    if(e.type==='miss'){floating(e.id,'Empty!',true);speech(e.id,['Outrageously empty!','More tea, less air!','That woke me up.'][e.id]);notice(`${3-state.misses} chance${state.misses===2?'':'s'} left. Keep the tea coming!`,2.5,true);tone(130,.3,.05);say(`${GUESTS[e.id].name}'s cup ran dry. ${3-state.misses} chances remain.`);}
    if(e.type==='emptyKettle'){notice('Empty kettle! Tap it to refill.',2.8,true);say('Kettle empty. Press R or tap the kettle to refill.');}
    if(e.type==='refilled'){notice('Fresh tea. Back to it!',1.6);tone(620,.15);say('Kettle refilled.');}
    if(e.type==='swap'){clearInputs();notice('Change places! Choose a cup again.',2.5);say('Guests changed places. Release and choose a cup again.');tone(420,.2);}
    if(e.type==='end')finish();
  }
}
function render(){
  processEvents();
  const timeLeft=Math.max(0,Math.ceil(RULES.duration-state.time));
  $('#time').textContent=`${Math.floor(timeLeft/60)}:${String(timeLeft%60).padStart(2,'0')}`;
  $('#score').textContent=Math.floor(state.score).toLocaleString();
  $('#chances-label').textContent=`${3-state.misses} chance${state.misses===2?'':'s'}`;
  $('.chances').setAttribute('aria-label',`${3-state.misses} chances remaining`);
  [...$('#chances').children].forEach((c,i)=>c.classList.toggle('used',i<state.misses));
  const active=['ready','playing'].includes(state.phase),moving=state.time<state.swapUntil;
  const xs=positions();
  state.cups.forEach((c,i)=>{
    const cup=cups[i],guest=guests[i],y=133-c.tea*.82;
    cup.style.left=guest.style.left=xs[c.seat]+'%';
    cup.querySelector('.tea-fill').setAttribute('y',y);cup.querySelector('.tea-fill').setAttribute('height',137-y);
    cup.querySelector('.tea-surface').setAttribute('cy',y);
    cup.querySelector('.tea-surface').style.opacity=c.tea<1?'0':'1';
    cup.classList.toggle('low',c.tea<23);cup.classList.toggle('empty',c.tea<=0);
    cup.classList.toggle('pouring',state.target===i);cup.classList.toggle('spilling',state.target===i&&c.tea>99);
    cup.querySelector('.cup-warning').textContent=c.tea<=0?'EMPTY!':'Tea, please!';
    cup.querySelector('kbd').textContent=c.seat+1;cup.disabled=!active||moving;
    guest.classList.toggle('thirsty',c.tea<23);guest.classList.toggle('angry',c.empty>0);guest.classList.toggle('happy',c.reaction>0);
    const bubble=guest.querySelector('.speech');bubble.textContent=bubbles[i].text;
    const visible=bubbles[i].until>state.time && !moving && noticeUntil<=state.time && !['won','lost'].includes(state.phase);
    bubble.classList.toggle('visible',visible);bubble.hidden=!visible;
  });
  const percent=Math.round(state.kettle/RULES.capacity*100),brewing=state.refill>0;
  $('.refill').classList.toggle('needed',state.kettle<60);$('.refill').classList.toggle('brewing',brewing);$('.refill').classList.toggle('away',state.target!==null);
  $('#refill').disabled=state.phase!=='playing'||brewing;
  $('#refill b').textContent=brewing?'Refilling…':state.kettle===0?'Kettle empty!':'Refill kettle';
  $('#kettle-state').textContent=brewing?`${state.refill.toFixed(1)} seconds`:state.kettle===0?'Tap here · R':`${percent}% left · takes 1.8s`;
  document.querySelectorAll('.kettle-tea').forEach(node=>node.setAttribute('y',brewing?145-(1-state.refill/RULES.refillSeconds)*67:145-percent*.67));
  $('#pause').disabled=['ready','won','lost'].includes(state.phase);$('#pause').innerHTML=icon(state.phase==='paused'?'play':'pause');
  $('#pause').setAttribute('aria-label',state.phase==='paused'?'Resume game':'Pause game');
  $('#announcement span').textContent=noticeUntil>state.time?noticeText:(state.time>60?'One last round. Faster, please!':state.time>38?'They’re getting rather thirsty.':'75 seconds. Three empty cups and you’re out.');
  $('#announcement').classList.toggle('urgent',noticeUntil>state.time&&noticeUrgent);
  $('#announcement').style.visibility=guests.some(g=>!g.querySelector('.speech').hidden)?'hidden':'visible';
  const flowing=state.target!==null&&state.phase==='playing'&&!brewing&&!moving&&state.kettle>0;
  $('#flying-kettle').style.display=$('#stream').style.display=flowing?'block':'none';
  if(flowing){
    const rect=cups[state.target].getBoundingClientRect(),bounds=table.getBoundingClientRect();
    const targetX=rect.x-bounds.x+rect.width*.46,targetY=rect.y-bounds.y+(rect.height-29)*.27;
    const streamStartX=targetX+10,streamStartY=targetY-53;
    $('#flying-kettle').style.left=streamStartX+'px';$('#flying-kettle').style.top=streamStartY+'px';
    $('#stream path').setAttribute('d',`M${streamStartX} ${streamStartY}Q${targetX-5} ${targetY-30} ${targetX} ${targetY+15}`);
    $('#stream circle').setAttribute('cx',targetX);$('#stream circle').setAttribute('cy',targetY+15);
    if(state.time-lastDrop>.16){lastDrop=state.time;tone(500+Math.random()*300,.045,.012);}
  }
  if(Math.floor(state.time)!==lastStatus){
    lastStatus=Math.floor(state.time);
    state.cups.forEach((c,i)=>cups[i].setAttribute('aria-label',`${c.name}, ${Math.round(c.tea)} percent full. Hold ${c.seat+1} or hold this button to pour.`));
    $('#refill').setAttribute('aria-label',`Refill kettle, ${percent} percent remaining. Takes 1.8 seconds. Keyboard R.`);
    // Expose urgent changes without announcing the live fill percentage every frame.
    const low=state.cups.filter(c=>c.tea<18 && c.tea>0).map(c=>c.name);
    if(low.length && !state.events.length && lastStatus%4===0)say(`${low.join(' and ')} need tea.`);
  }
  // Read-only diagnostic snapshot for local verification; no controls or time cheats.
  table.dataset.phase=state.phase;table.dataset.time=state.time.toFixed(2);table.dataset.score=Math.floor(state.score);
}
function frame(now){
  const dt=Math.min(.1,(now-last)/1000);last=now;
  tick(state,dt);
  if(state.phase==='playing'){
    const warningAt=RULES.swaps[state.swapIndex];
    if(warningAt&&warningAt-state.time>0&&warningAt-state.time<1.6&&noticeText!=='Clean cups! Moving in a moment…')notice('Clean cups! Moving in a moment…',1.7);
    if(talks[talkIndex]&&state.time>=talks[talkIndex][0]){
      const [,id,line]=talks[talkIndex++];if(state.cups[id].tea>20)speech(id,line,3.5);
    }
  }
  render();requestAnimationFrame(frame);
}
table.addEventListener('pointerdown',e=>{
  const button=e.target.closest('.cup');if(!button||button.disabled||pointerId!==null||e.button!==0)return;
  e.preventDefault();pointerId=e.pointerId;heldKey=null;button.focus({preventScroll:true});
  table.setPointerCapture(e.pointerId);beginPour(Number(button.dataset.id));
});
table.addEventListener('pointermove',e=>{
  if(pointerId!==e.pointerId)return;
  const button=document.elementFromPoint(e.clientX,e.clientY)?.closest('.cup');
  if(button&&!button.disabled){const id=Number(button.dataset.id);if(id!==state.target)beginPour(id);}
  else stopPour(state);
});
function releasePointer(e){if(pointerId===e.pointerId){stopPour(state);pointerId=null;render();}}
table.addEventListener('pointerup',releasePointer);table.addEventListener('pointercancel',releasePointer);table.addEventListener('lostpointercapture',releasePointer);
// Keyboard activation holds the same continuous pour as a mouse or finger.
cups.forEach((cup,id)=>{
  cup.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat){heldKey=e.key;beginPour(id);}}});
  cup.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();stopPour(state);heldKey=null;render();}});
  cup.addEventListener('blur',()=>{if(heldKey===' '||heldKey==='Enter'){stopPour(state);heldKey=null;}});
});
document.addEventListener('keydown',e=>{
  if($('#about-dialog').open)return;
  if(['1','2','3'].includes(e.key)){
    e.preventDefault();if(!e.repeat){heldKey=e.key;beginPour(state.cups.findIndex(c=>c.seat===Number(e.key)-1));}
  }else if(e.key.toLowerCase()==='r'&&!e.repeat){e.preventDefault();doRefill();}
  else if(['p','escape'].includes(e.key.toLowerCase())&&!e.repeat){e.preventDefault();togglePause();}
});
document.addEventListener('keyup',e=>{if(e.key===heldKey){stopPour(state);heldKey=null;render();}});
$('#refill').addEventListener('click',doRefill);$('#pause').addEventListener('click',togglePause);$('#restart').addEventListener('click',reset);
$('#primary-action').addEventListener('click',()=>state.phase==='paused'?togglePause():reset());
$('#sound').addEventListener('click',()=>{soundOn=!soundOn;$('#sound').innerHTML=icon(soundOn?'sound':'mute');$('#sound').setAttribute('aria-label',soundOn?'Turn sound off':'Turn sound on');$('#sound').title=soundOn?'Turn sound off':'Turn sound on';tone(620,.12);});
$('#about').addEventListener('click',()=>{
  aboutWasPlaying=state.phase==='playing';if(aboutWasPlaying){clearInputs();pause(state);}
  $('#about-dialog').showModal();render();
});
$('#close-about').addEventListener('click',()=>$('#about-dialog').close());
$('#about-dialog').addEventListener('close',()=>{if(aboutWasPlaying&&state.phase==='paused'){showPause();}else $('#about').focus();aboutWasPlaying=false;});
function autoPause(){if(state.phase==='playing'){clearInputs();pause(state);showPause();render();}}
window.addEventListener('blur',autoPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});
window.addEventListener('resize',()=>{clearInputs();render();});
render();requestAnimationFrame(frame);
