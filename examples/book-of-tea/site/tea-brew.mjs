import {BREW_KEY,DEFAULT_SECONDS,MIN_SECONDS,MAX_SECONDS,newBrewState,validateBrewState,reduceBrew,remainingAt,phaseAt,clockText} from './tea-brew-state.mjs';

const recipes={
  sencha:{name:'Sencha',method:'Steeped leaves',yield:'One small pot',tea:'10 g',teaDetail:'about 2 tbsp leaves',water:'210 mL',waterDetail:'about 7 fl oz',heat:'80°C',heatDetail:'176°F',source:'Ippodo',url:'https://ippodotea.com/blogs/recipes-to-brew-japanese-tea/standard-sencha-brew',steps:['Put the leaves in a small teapot. Add the cooled water.','Leave the leaves undisturbed for 1 minute.','Pour through a strainer, draining the pot completely.'],note:'Ippodo’s concentrated sencha recipe. Start here, then adjust for your leaves and taste.',finish:'Pour through a strainer. Empty the pot completely.'},
  black:{name:'Black tea',method:'Steeped leaves',yield:'One cup',tea:'1 tsp',teaDetail:'loose leaves',water:'240 mL',waterDetail:'about 8 fl oz',heat:'100°C',heatDetail:'212°F · boiling',source:'Harney & Sons',url:'https://www.harney.com/blogs/news/black-tea-tips',steps:['Warm a pot with hot water, then empty it. Add the leaves.','Pour boiling water over the leaves. Steep for 4–5 minutes.','Strain into your cup, or lift out the infuser.'],note:'A starting method for black tea. This cup is 240 mL; the timer starts at 4 minutes. Follow your packet for a different tea.',finish:'Strain the tea, or lift out the infuser.'},
  matcha:{name:'Matcha',method:'Whisked powder',yield:'One small bowl · usucha',tea:'2 g',teaDetail:'1 level tsp matcha',water:'60 mL',waterDetail:'about 2 fl oz',heat:'80°C',heatDetail:'176°F',source:'Ippodo',url:'https://ippodotea.com/blogs/recipes-to-brew-japanese-tea/usucha-thin-matcha',steps:['Sift the matcha into a bowl.','Add the cooled water.','Whisk briskly in an M motion for about 15 seconds, then drink.'],note:'Ippodo’s usucha method. The powder is whisked into the water; there is no infusion to wait for.'}
};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const timeOf=deadline=>new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'}).format(new Date(deadline));
const activePhase=phase=>['running','paused'].includes(phase);

function vessel(recipe){
  // Original vector geometry. The liquid's shade follows elapsed time; no looped animation.
  const handle=recipe==='black'?'<path class="brew-vessel-line" d="M222 91c62-20 60 69-10 53"/>':'';
  const whisk=recipe==='matcha'?'<g class="brew-vessel-line brew-whisk"><path d="M181 9l-25 73m19-74l-25 73m13-51c-14 17-27 36-27 53m30-53c-3 25-5 39-13 55m17-55c3 21 3 40-8 58m-23-11c8 13 18 16 27 7"/></g>':'';
  const leaves=recipe==='matcha'?'<g class="brew-foam"><circle cx="113" cy="91" r="2.4"/><circle cx="143" cy="85" r="3"/><circle cx="172" cy="94" r="2"/><circle cx="155" cy="99" r="1.5"/><circle cx="127" cy="101" r="1.8"/></g>':'<g class="brew-leaves"><path d="M112 90q19-18 30-6-17 16-30 6m42 10q8-19 26-10-5 17-26 10"/></g>';
  return `<svg class="brew-vessel" viewBox="0 0 300 190" aria-hidden="true" focusable="false"><ellipse class="brew-shadow" cx="149" cy="172" rx="80" ry="6"/>${handle}<path class="brew-ceramic" d="M66 84c7 59 22 78 46 83h77c25-5 42-27 47-83z"/><ellipse class="brew-rim" cx="151" cy="84" rx="85" ry="26"/><ellipse class="brew-liquid" cx="151" cy="88" rx="73" ry="19"/>${leaves}<path class="brew-vessel-line" d="M67 86c8 55 23 75 47 80h73c26-5 42-28 48-80M114 166v6h73v-6"/>${whisk}</svg>`;
}
function controls(state,now,damaged){
  const phase=phaseAt(state,now),timer=state.timer,seconds=state.seconds[state.recipe],active=activePhase(phase);
  if(damaged)return '<button class="primary" data-brew-action="repair" data-brew-focus="repair">Reset saved timer</button>';
  if(state.recipe==='matcha')return '<button class="brew-return" data-action="close">Back to the book</button>';
  const action=phase==='running'?'pause':phase==='paused'?'resume':'start';
  const label=phase==='running'?'Pause timer':phase==='paused'?'Resume timer':phase==='done'?'Steep again':'Start infusion';
  return `<div class="brew-time-adjust" role="group" aria-label="Infusion time"><button data-brew-action="less" data-brew-focus="less" aria-label="Shorten by 15 seconds" ${active||seconds<=MIN_SECONDS?'disabled':''}>−</button><span>${active?'Chosen time':'Set time'} <span data-brew-total>${clockText((timer?.durationMs)||seconds*1000)}</span></span><button data-brew-action="more" data-brew-focus="more" aria-label="Add 15 seconds" ${active||seconds>=MAX_SECONDS?'disabled':''}>+</button></div><div class="brew-buttons"><button class="primary" data-brew-action="${action}" data-brew-focus="primary" data-brew-phase="${phase}">${label}</button>${timer?'<button class="brew-reset" data-brew-action="reset" data-brew-focus="reset">Reset</button>':''}</div>${!active&&seconds!==DEFAULT_SECONDS[state.recipe]?`<button class="brew-recommended" data-brew-action="recommended" data-brew-focus="recommended">Use ${clockText(DEFAULT_SECONDS[state.recipe]*1000)} starting time</button>`:''}<button class="brew-return" data-action="close">Keep reading</button>`;
}
function panelHTML(state,now,{error='',damaged=false}={}){
  const r=recipes[state.recipe],phase=phaseAt(state,now),active=activePhase(phase);
  return `<p class="brew-intro">Modern ways to make a cup beside the book.</p><div class="brew-choices" role="group" aria-label="Choose tea">${Object.entries(recipes).map(([id,item])=>`<button data-brew-action="select" data-recipe="${id}" data-brew-focus="${id}" aria-pressed="${id===state.recipe}" ${active&&id!==state.recipe?'disabled':''}>${item.name}</button>`).join('')}</div><div class="brew-workbench" data-recipe="${state.recipe}" data-phase="${phase}"><section class="brew-making" aria-label="${state.recipe==='matcha'?'Whisking':'Infusion timer'}"><div class="brew-vessel-wrap">${vessel(state.recipe)}</div><div class="brew-clock-group"><p class="brew-phase" data-brew-status></p>${state.recipe==='matcha'?'<p class="brew-whisk-label">Whisk &amp; drink</p>':'<p class="brew-clock" role="timer" aria-live="off" aria-label="Time remaining" data-brew-clock></p>'}<p class="brew-timing" data-brew-timing></p></div><div class="brew-control-area">${controls(state,now,damaged)}</div><p class="brew-error" role="alert" ${error?'':'hidden'}>${esc(error)}</p><p class="brew-alarm-note">${state.recipe==='matcha'?'':active?'Your timer stays saved.':''}</p>${active?'<p class="brew-change-note">Reset to change tea or time.</p>':''}</section><section class="brew-recipe" aria-label="Preparation"><p class="brew-method">${r.method}</p><h3>${r.yield}</h3><dl class="brew-amounts"><div><dt>Tea</dt><dd>${r.tea}<small>${r.teaDetail}</small></dd></div><div><dt>Water</dt><dd>${r.water}<small>${r.waterDetail}</small></dd></div><div><dt>Heat</dt><dd>${r.heat}<small>${r.heatDetail}</small></dd></div></dl><ol class="brew-steps">${r.steps.map(text=>`<li>${text}</li>`).join('')}</ol><p class="brew-recipe-note">${r.note}</p></section></div><details class="brew-sources"><summary>From the book, and for this cup</summary><p>In Chapter II, Okakura roughly divides tea into boiled cake tea, whipped powder, and steeped leaves. He also resists a single perfect recipe. These are present-day starting methods from tea producers; they do not reconstruct his historical preparations.</p><button class="text" data-action="tea-brew-source">Read the three schools in Chapter II</button><p class="brew-source-link">This preparation: <a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.source}</a>. ${state.recipe==='black'?'The 240 mL cup and 4-minute starting time are editorial choices within the linked guidance.':''} Adjust for your tea and taste.</p><p class="brew-source-link">The recipes and timer work offline once the reader is saved. Producer links need a connection.</p></details>`;
}

export function createTeaBrewer({openDialog,announce=()=>{}}){
  let state=newBrewState(),loaded=false,available=false,memoryOnly=false,damaged=false,error='',rawDamaged='',queue=Promise.resolve(),lastPhase='idle';
  let pointer=null,heldKey=null,tickPending=false;
  let audio=null,soundWanted=false,soundPending=false,soundText='Off by default. Enable a soft chime for this tab.',chimedId=null;
  const now=()=>Date.now();
  const messageMemory='This timer is kept in this tab only because the browser could not save it. Keep the tab open.';
  function soundUI(){
    const enabled=soundWanted&&audio?.state==='running';
    document.querySelectorAll('[data-brew-action=sound]').forEach(button=>{button.setAttribute('aria-pressed',String(enabled));button.disabled=soundPending;});
    document.querySelectorAll('[data-brew-sound-note]').forEach(node=>{node.textContent=soundText;});
  }
  function tone(){
    if(audio?.state!=='running')return false;
    const start=audio.currentTime;
    for(const [frequency,level] of [[880,.035],[1320,.012]]){
      const oscillator=audio.createOscillator(),gain=audio.createGain();
      oscillator.type='sine';oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+.75);
      oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(start);oscillator.stop(start+.8);
      oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};
    }
    return true;
  }
  async function toggleSound(){
    // Called directly by the user's button gesture, never by a timer or permission prompt.
    if(soundPending)return;soundPending=true;soundUI();
    if(soundWanted&&audio?.state==='running'){soundWanted=false;await audio.suspend().catch(()=>{});soundText='Chime off.';soundPending=false;soundUI();return;}
    try{
      const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)throw Error('Unavailable');
      if(!audio||audio.state==='closed'){
        audio=new Audio();
        audio.addEventListener('statechange',()=>{if(soundWanted&&audio.state!=='running')soundText='Audio is suspended. Tap Soft chime to enable it again.';soundUI();});
      }
      soundWanted=true;await audio.resume();
      if(!tone())throw Error('Suspended');
      soundText='Chime on for this tab. It cannot wake a sleeping device.';
    }catch{soundWanted=false;soundText='Sound is unavailable. The timer will still show when to pour.';}
    soundPending=false;soundUI();
  }
  function finishSound(timer,time){
    if(!soundWanted||chimedId===timer.id)return;chimedId=timer.id;
    if(time-timer.deadline>1500)soundText='The time ended before this tab could play the chime. No late chime was played.';
    else if(audio?.state!=='running')soundText='Audio was suspended, so no chime played. The infusion time is up.';
    else try{tone();soundText='The finish chime played in this tab.';}catch{soundText='The chime could not play. The infusion time is up.';}
    soundUI();
  }
  function load(){
    if(loaded)return;loaded=true;
    try{const raw=localStorage.getItem(BREW_KEY);if(raw!==null){try{state=validateBrewState(JSON.parse(raw));}catch{damaged=true;rawDamaged=raw;error='The saved timer could not be read. Reset it to begin again; your reading records are unaffected.';}}}
    catch{memoryOnly=true;error=messageMemory;}
    lastPhase=phaseAt(state,now());
  }
  function currentFromStorage(){
    if(memoryOnly||damaged)return state;
    try{const raw=localStorage.getItem(BREW_KEY);if(raw===null)return newBrewState();try{return validateBrewState(JSON.parse(raw));}catch{damaged=true;rawDamaged=raw;error='The saved timer changed and could not be read. Reset it to begin again.';return null;}}
    catch{memoryOnly=true;error=messageMemory;return state;}
  }
  function persist(next){
    state=next;
    try{localStorage.setItem(BREW_KEY,JSON.stringify(state));memoryOnly=false;error='';}
    catch{memoryOnly=true;error=messageMemory;}
  }
  function draw({preserveFocus=true}={}){
    const panel=document.querySelector('#tea-brew-panel');if(!panel)return;
    const focused=panel.contains(document.activeElement)?document.activeElement.dataset.brewFocus:null,opened=panel.querySelector('.brew-sources')?.open;
    panel.innerHTML=panelHTML(state,now(),{error,damaged});
    if(state.recipe!=='matcha'){
      const option=document.createElement('div');option.className='brew-sound';
      option.innerHTML='<button data-brew-action="sound" data-brew-focus="sound" aria-pressed="false"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 13V8a5 5 0 0 1 10 0v5l2 2H3l2-2m3 4h4"/></svg>Soft chime</button><p data-brew-sound-note role="status"></p>';
      panel.querySelector('.brew-control-area').after(option);
    }
    if(opened)panel.querySelector('.brew-sources').open=true;
    if(focused&&preserveFocus)panel.querySelector(`[data-brew-focus="${focused}"]`)?.focus({preventScroll:true});
    update();soundUI();
  }
  const text=(selector,value)=>document.querySelectorAll(selector).forEach(node=>{if(node.textContent!==value)node.textContent=value;});
  function update(){
    if(!loaded)return;
    const time=now(),phase=phaseAt(state,time),timer=state.timer,r=recipes[state.recipe];
    const remaining=timer?remainingAt(timer,time):state.recipe==='matcha'?0:state.seconds[state.recipe]*1000;
    const label=phase==='running'?`Tea · ${clockText(remaining)}`:phase==='paused'?'Tea · paused':phase==='done'?'Tea · ready':'Make tea';
    text('[data-tea-brew-label]',label);
    document.querySelectorAll('[data-tea-brew-entry]').forEach(button=>{button.hidden=!available;button.setAttribute('aria-label',phase==='idle'?'Make tea':`Make tea. ${r.name}. ${phase==='running'?clockText(remaining)+' remaining':phase}.`);});
    text('[data-brew-clock]',clockText(remaining));
    text('[data-brew-status]',state.recipe==='matcha'?'No steeping interval':phase==='running'?'Infusing':phase==='paused'?'Timer paused':phase==='done'?'Time to pour':'');
    const timing=state.recipe==='matcha'?'Whisk briskly for about 15 seconds.':phase==='running'?`Finish at ${timeOf(timer.deadline)}`:phase==='paused'?'Only the clock is paused; leaves still in water keep infusing.':phase==='done'?`${r.finish} Time ended at ${timeOf(timer.deadline)}.`:'Add water, then start.';
    text('[data-brew-timing]',timing);
    const panel=document.querySelector('#tea-brew-panel'),workbench=panel?.querySelector('.brew-workbench');
    if(workbench){workbench.dataset.phase=phase;const progress=timer?1-remaining/timer.durationMs:0;workbench.style.setProperty('--brew-depth',String(.18+.65*progress));}
    if(memoryOnly&&panel)text('.brew-alarm-note',messageMemory);
    if(phase!==lastPhase){lastPhase=phase;if(phase==='done'&&available){finishSound(timer,time);announce('The infusion time is up. Open Make tea to pour.');}}
  }
  async function perform(action){
    if(damaged&&action.type!=='repair')return;
    const change=()=>{
      if(action.type==='repair'){
        try{localStorage.setItem(`${BREW_KEY}:unreadable:${now()}`,rawDamaged);localStorage.setItem(BREW_KEY,JSON.stringify(newBrewState()));state=newBrewState();damaged=false;memoryOnly=false;error='';}
        catch{error='The unreadable timer was kept. This browser could not save a fresh one. Try again when storage is available.';}
      }else {const current=currentFromStorage();if(current)persist(reduceBrew(current,{...action,...(action.type==='start'?{id:crypto.randomUUID()}:{})},now()));}
      draw();update();
    };
    if(navigator.locks?.request)await navigator.locks.request(BREW_KEY,change);else change();
  }
  function dispatch(action){queue=queue.then(()=>perform(action)).catch(()=>{error='The tea timer could not be updated. Your reading records are unaffected.';draw();});return queue;}
  function tick(){
    if(!loaded)return;update();
    if(state.timer?.status==='running'&&state.timer.deadline<=now()&&!tickPending){tickPending=true;void dispatch({type:'tick'}).finally(()=>{tickPending=false;});}
  }
  function mount(){
    const panel=document.querySelector('#tea-brew-panel');
    panel.addEventListener('pointerdown',event=>{const button=event.target.closest('[data-brew-action]');pointer=button?{node:button,action:button.dataset.brewAction,phase:phaseAt(state,now()),id:event.pointerId}:null;});
    panel.addEventListener('pointercancel',()=>{pointer=null;});
    panel.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key)||!event.target.closest('[data-brew-action]'))return;if(event.repeat){event.preventDefault();return;}heldKey={node:event.target,action:event.target.dataset.brewAction,phase:phaseAt(state,now()),key:event.key};});
    panel.addEventListener('keyup',event=>{if(heldKey?.key===event.key)setTimeout(()=>{heldKey=null;},0);});
    panel.addEventListener('click',event=>{
      const button=event.target.closest('[data-brew-action]');if(!button)return;
      event.preventDefault();const action=button.dataset.brewAction,gesture=event.detail?pointer:heldKey;
      if(gesture&&(gesture.node!==button||gesture.action!==action||gesture.phase!==phaseAt(state,now()))){pointer=null;return;}
      pointer=null;
      if(action==='sound')void toggleSound();
      else if(action==='select')void dispatch({type:'select',recipe:button.dataset.recipe});
      else if(action==='less'||action==='more')void dispatch({type:'adjust',seconds:action==='less'?-15:15});
      else void dispatch({type:action});
    });
    draw({preserveFocus:false});
  }
  window.addEventListener('storage',event=>{
    if(event.key!==BREW_KEY||!loaded||memoryOnly)return;
    try{state=event.newValue===null?newBrewState():validateBrewState(JSON.parse(event.newValue));damaged=false;error='';draw();update();}
    catch{damaged=true;rawDamaged=event.newValue;error='The saved timer changed and could not be read. Reset it to begin again.';draw();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')tick();});
  window.addEventListener('pageshow',tick);window.addEventListener('focus',tick);
  setInterval(tick,250);
  return {
    setAvailable(value){available=value;if(value)load();update();},
    open(){if(!available)return;load();openDialog('Make tea','<div id="tea-brew-panel"></div>');mount();tick();}
  };
}
