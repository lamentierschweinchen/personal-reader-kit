const $=selector=>document.querySelector(selector);
const game=$('#game'),canvas=$('#sea'),ctx=canvas.getContext('2d');
const sailors=[...document.querySelectorAll('.sailor')];
const C={sea:'#183c46',deep:'#102e36',foam:'#a8c6c3',paper:'#f3f0e6',ink:'#203437',gold:'#e8c67d',wood:'#b98858',deck:'#d8b781',danger:'#f39d78',rock:'#739190'};
const DAYS=[
 {name:'Aeolus',title:'A borrowed wind',duration:36,book:'Book X',anchor:'book-10/book-10-004/book-10-005',
  copy:'Aeolus ties the roaring winds inside an ox-hide bag and leaves the West Wind free to carry the ship. The crew have their own ideas about what the bag contains.',
  tactic:'Follow the openings between the rocks. Tap a gold sailor before the ring runs out.',
  gap:.54,first:6,spacing:4.1,centers:[.5,.71,.29,.65,.30,.69,.44],
  crew:[[5.4,0],[13.1,1],[21.4,2],[29,0]],waves:[],gusts:[],bolts:[]},
 {name:'Poseidon',title:'The sea rises',duration:38,book:'Book V',anchor:'book-05/book-05-025',
  copy:'Poseidon takes up his trident and stirs the sea. Winds rush in from every quarter, and the sky disappears into cloud.',
  tactic:'Swells sweep across the channels. Their arrows show the shove; leave room to steer back.',
  gap:.48,first:5.8,spacing:4,centers:[.70,.29,.63,.33,.70,.30,.65,.38],
  crew:[[5,1],[11.5,2],[18.1,0],[25.5,1],[31,2]],waves:[8,16,24,32],gusts:[],bolts:[]},
 {name:'Athena',title:'A way through',duration:40,book:'Book V',anchor:'book-05/book-05-031/book-05-035',
  copy:'Athena holds the winds still except for a breeze from the North. Later, beside a rocky shore, she helps the exhausted voyager keep his wits.',
  tactic:'Follow the owl. Athena stills the swells while you call back the crew; two sailors may reach at once.',
  gap:.43,first:5.8,spacing:4.2,centers:[.70,.30,.65,.35,.69,.30,.67,.34],
  crew:[[4.8,0],[6.1,1],[13.5,2],[14.5,0],[23.2,1],[24.3,2],[32.2,0],[33.4,1]],waves:[7.2,15.7,25.4,34.4],gusts:[],bolts:[]},
 {name:'Zeus',title:'Under the black cloud',duration:42,book:'Book XII',anchor:'book-12/book-12-037/book-12-038',
  copy:'A black cloud hangs over the ship, and the water darkens beneath it. A squall comes from the West; Zeus’s thunder breaks overhead.',
  tactic:'Read the gold gust arrows before they blow. Leave the lightning’s marked strip before it strikes.',
  gap:.40,first:5.5,spacing:3.9,centers:[.29,.71,.30,.69,.32,.70,.29,.65,.34],
  crew:[[4.4,0],[5.4,2],[11.7,1],[12.8,0],[19.2,2],[20.3,1],[26.3,0],[27.4,2],[33.4,1],[34.5,0]],waves:[7.7,15.6,27.2,35],gusts:[[8,1],[18,-1],[28,1],[35,-1]],bolts:[[11.9,.5],[23.6,.52],[34.8,.50]]}
];
const numerals=['I','II','III','IV'],PROGRESS_KEY='newreading-homeward-days-v1';
let saveWarning='';
function loadProgress(){try{const raw=localStorage.getItem(PROGRESS_KEY);if(!raw)return{day:0,finished:false};const p=JSON.parse(raw);if(p.version!==1||!Number.isInteger(p.day)||p.day<0||p.day>3||typeof p.finished!=='boolean')throw Error();return{day:p.day,finished:p.finished};}catch{saveWarning='This browser could not read the saved voyage. You can begin again here.';return{day:0,finished:false};}}
let progress=loadProgress(),dayIndex=progress.day;
function saveProgress(){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify({version:1,...progress}));saveWarning='';}catch{saveWarning='This browser could not keep your day. Leave this tab open to continue.';}showSaveWarning();}
function showSaveWarning(){const e=$('#save-warning');e.textContent=saveWarning;e.hidden=!saveWarning;}
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');let reduced=motionQuery.matches;
motionQuery.addEventListener('change',event=>{reduced=event.matches;});
let w=0,h=0,field=0,offset=0,sy=0,shipScale=1,dpr=1,previous=0,ambience=0;
let mode='ready',soundOn=false,audioContext=null,resumeAfterStory=false,messageUntil=0,state;
let courseIndex=0,crewIndex=0,waveIndex=0,lastCommand=-10;
const keys=new Set(),pointers=new Map(),obstacles=[],ripples=[],particles=[],gateMarkers=new Map();
const crew=Array.from({length:3},()=>({active:false,age:0,duration:3.6,thanks:0}));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const readyX=()=>w<600?.56:.72;
const day=()=>DAYS[dayIndex];
function resetState(){
 state={time:0,x:mode==='ready'?readyX():.5,velocity:0,hull:3,escapes:0,commands:0,hits:0,dodged:0,invulnerable:0,gust:0,gustDirection:1,wave:0,waveDirection:0,shake:0,weather:0,weatherDirection:0,boltHits:new Set()};
 courseIndex=0;crewIndex=0;waveIndex=0;lastCommand=-10;obstacles.length=0;ripples.length=0;particles.length=0;
 for(const e of gateMarkers.values())e.remove();gateMarkers.clear();
 crew.forEach(c=>Object.assign(c,{active:false,age:0,duration:3.6,thanks:0}));
 $('#forecast').hidden=true;$('#lightning').hidden=true;
}
function resize(){
 const oldLandscape=w>h;w=game.clientWidth;h=game.clientHeight;field=Math.min(w,560);offset=(w-field)/2;
 shipScale=h<540&&w>=600?.76:w<360?.86:w<600?.94:1.12;
 sy=h<540&&w>=600?h*.62:h*.66;
 if(mode==='ready'&&w<600&&h<650){shipScale=.72;sy=h*.72;}
 dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
 if(state&&mode==='ready')state.x=readyX();
 if(mode==='playing'&&oldLandscape!==(w>h))pause('A moment to get your bearings.');
 positionCrew();
}
function setMode(value){
 mode=value;game.dataset.mode=value;game.dataset.day=String(dayIndex+1);
 const modal=['paused','won','lost','cleared','interlude'].includes(value);
 $('.topbar').inert=modal;$('#controls').inert=modal;$('#heading').inert=value!=='ready';
 $('#pause').disabled=value!=='playing';$('#remaining').hidden=value==='ready';
 sailors.forEach(s=>s.disabled=value!=='playing');$('#left').disabled=value!=='playing';$('#right').disabled=value!=='playing';
 if(value!=='playing'){$('#forecast').hidden=true;$('#lightning').hidden=true;}
}
function clearInput(){keys.clear();pointers.clear();$('#left').classList.remove('pressed');$('#right').classList.remove('pressed');if(state)state.velocity=0;}
function announce(text,seconds=2.3){$('#message').textContent=text;messageUntil=state.time+seconds;}

function portrait(index){
 const emblems=[
  '<path d="M22 66q30-22 49-6t-12 14M21 90q21-14 38 0M210 64q-30-20-42 0t24 17M188 99q20-9 26 2"/>',
  '<path d="M198 30v166M184 36v22q14 15 28 0V36M178 41l6-13 7 13M205 41l7-13 6 13"/>',
  '<path d="m167 145 9-9 9 10 12-10 7 18-4 24-20 13-17-16z" fill="#9eaaa0"/><circle cx="176" cy="157" r="7"/><circle cx="192" cy="157" r="7"/><path d="m183 165 4 0-2 5M175 177l9 6 11-8"/>',
  '<path d="m195 27-25 46h20l-20 43 49-59h-23l19-30z" fill="#e8c67d"/>'
 ][index];
 const crown=index===2?'<path d="M77 84q-1-54 45-54 43 0 43 53l-16-4-2-33-30-6-23 21-2 20z" fill="#6b8585"/><path d="M113 31q5-25 44-18l-7 23M90 75l56-9 15 15-47 1-9 39-11-9z" fill="#e8c67d"/>':index===1?'<path d="m80 63-5-22 18 13 5-23 17 16 12-21 12 24 20-14-2 30" fill="#e8c67d"/>':'<path d="M80 75q-13-44 33-43 46-9 48 44l-12-16-18 2-16-11-18 17z" fill="#708983"/>';
 const beard=index===2?'<path d="M82 91q-10 15-2 44l-8 35M155 88q15 20 8 55l9 25" fill="none"/>':'<path d="m84 101 15 18 17-8 16 8 22-18-7 44-28 27-30-28z" fill="#708983"/><path d="m101 130 8 24m11-29 0 33m12-26-5 20"/>';
 return `<svg viewBox="0 0 240 230" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="#203437" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="120" cy="108" r="89" stroke="#b2b9a9"/><circle cx="120" cy="108" r="95" stroke="#c8cebd" stroke-dasharray="1 7"/><path d="m54 213 8-37 41-26h35l40 26 10 37z" fill="#6b8585"/><path d="m100 148-9 30 29 30 25-32-7-28" fill="#c6b78e"/><path d="M81 76q-9 62 38 82 43-14 39-82-6-34-40-34-34 1-37 34z" fill="#d5c7a4"/>${crown}${beard}<path d="m88 88 17-4m25 0 16 4M97 94h3m36 0h3m-21-3-5 18 11 2M109 120q10 4 19-1M68 184l30 26m68-26-26 27"/>${emblems}<path d="M37 220h167" stroke="#235764"/></svg>`;
}
function showDay(index){
 clearInput();dayIndex=index;$('#curtain').hidden=true;$('#interlude').hidden=false;$('#message').textContent='';
 setMode('interlude');resetState();resize();
 $('#deity-portrait').innerHTML=portrait(index);$('#day-kicker').textContent=`Day ${numerals[index]} of IV · ${day().name}`;
 $('#day-title').textContent=day().title;$('#day-copy').textContent=day().copy;$('#day-tactic').textContent=day().tactic;
 $('#day-source').href='../#reference/'+day().anchor;$('#day-source').innerHTML=`${day().book} passage <span>(spoilers)</span>`;
 $('#day-start').textContent=`Sail day ${numerals[index]} · ${day().duration}s`;
 $('.day-sheet').scrollTop=0;$('#day-start').focus({preventScroll:true});showSaveWarning();
}
function start(){
 $('#source').close();$('#curtain').hidden=true;$('#interlude').hidden=true;clearInput();
 setMode('playing');resetState();resize();state.x=.5;progress={day:dayIndex,finished:false};saveProgress();
 positionCrew();$('#accessible-status').textContent='';announce(dayIndex===0?'Through the rocks. Hands off the bag.':dayIndex===3?'Watch the cloud. Watch the crew.':'Read the water ahead.',2.6);
 $('#pause').focus({preventScroll:true});tone('start');
}
function replayAll(){progress={day:0,finished:false};saveProgress();showDay(0);}
function pause(reason='The sea can wait.'){
 clearInput();if(mode!=='playing')return;setMode('paused');$('#curtain').hidden=false;
 $('#result-kicker').textContent=`Day ${numerals[dayIndex]} · At anchor`;$('#result-title').textContent='Take a breath.';$('#result-copy').textContent=reason;
 $('#again').textContent='Keep sailing';$('#restart').hidden=false;$('#restart').textContent='Restart this day';$('#again').focus({preventScroll:true});
}
function resume(){if(mode!=='paused')return;clearInput();$('#curtain').hidden=true;setMode('playing');$('#pause').focus({preventScroll:true});}
function finish(won,cause){
 clearInput();setMode(won?(dayIndex===3?'won':'cleared'):'lost');$('#message').textContent='';$('#curtain').hidden=false;
 $('#restart').hidden=!won||dayIndex===3;$('#restart').textContent='Sail this day again';
 $('#result-kicker').textContent=`Day ${numerals[dayIndex]} · ${won?'Safe water':Math.floor(state.time)+' seconds at sea'}`;
 $('#result-title').textContent=won?(dayIndex===3?'Home at last.':'A day nearer home.'):cause==='wind'?'Blown off course.':'Shipwrecked.';
 $('#result-copy').textContent=won?(dayIndex===3?'Four seas crossed. The crew can finally leave the bag alone.':'The oars come to rest. The ship is repaired, and the next sea can wait.'):(cause==='wind'?'Three winds escaped. Try this day again; tap the gold sailors before their rings run out.':'The hull could take no more. Try this day again; line up with the next opening before it reaches the bow.');
 if(won){progress={day:Math.min(3,dayIndex+1),finished:dayIndex===3};saveProgress();}
 $('#again').textContent=won?(dayIndex===3?'Sail the final day again':`Meet day ${numerals[dayIndex+1]}`):'Retry this day';
 $('#accessible-status').textContent=$('#result-title').textContent+' '+$('#result-copy').textContent;$('#again').focus({preventScroll:true});tone(won?'win':'loss');
}
function command(index){
 if(mode!=='playing'||state.time-lastCommand<.34)return;const c=crew[index];if(!c.active)return;
 lastCommand=state.time;c.active=false;c.thanks=.85;state.commands++;sailors[index].querySelector('.crew-prompt').textContent='Aye!';
 const p=crewPoint(index);ripples.push({x:p.x,y:p.y,age:0,color:C.gold,r:20});tone('crew');
}
function commandUrgent(){let index=-1,most=-1;crew.forEach((c,i)=>{if(c.active&&c.age/c.duration>most){most=c.age/c.duration;index=i;}});if(index>=0)command(index);}
function trouble(index){
 Object.assign(crew[index],{active:true,age:0,duration:dayIndex===0?3.8:3.6,thanks:0});sailors[index].querySelector('.crew-prompt').textContent='Tap!';
 if(crewIndex===1&&dayIndex===0)announce('Hands off! Tap the gold sailor.',3);
 $('#accessible-status').textContent=`Sailor ${index+1} is reaching for the bag. Press ${index+1} or Space.`;tone('warning');
}
function escapeWind(){
 state.escapes++;state.gust=3.5;state.gustDirection=state.x>.5?-1:1;state.shake=.35;
 ripples.push({x:offset+state.x*field,y:sy-22*shipScale,age:0,color:C.paper,r:36});tone('gust');
 if(state.escapes>=3){finish(false,'wind');return;}announce(state.escapes===1?'Wind loose! Hold your course.':'One last knot. Watch those hands!',2.5);
}
function spawnRow(){
 const i=courseIndex++,o={type:'gate',x:day().centers[i],at:day().first+i*day().spacing,gap:day().gap,hit:false,passed:false,variant:i%3};obstacles.push(o);
 const marker=document.createElement('span');marker.className='channel-marker';marker.setAttribute('role','img');marker.setAttribute('aria-label','Opening between the rocks');marker.innerHTML=dayIndex===2?'<svg viewBox="0 0 28 28" aria-hidden="true"><path d="m3 7 4-5 7 5 7-5 4 5-1 14-10 5L4 21z"/><circle cx="9" cy="12" r="3"/><circle cx="19" cy="12" r="3"/><path d="m12 18 2 3 2-3"/></svg>':'<svg viewBox="0 0 20 28" aria-hidden="true"><path d="m10 2 7 10-7 10-7-10zM10 22v4"/></svg>';
 $('#channels').append(marker);gateMarkers.set(o,marker);
}
function geometry(o){
 const speed=(sy-65)/4;
 return{x:offset+o.x*field+(o.type==='wave'?Math.sin((state.time-o.at)*1.6)*field*.13:0),y:sy+(state.time-o.at)*speed,r:o.type==='wave'?field*.12:field*.062};
}
function damage(o,cause='rock'){
 o.hit=true;if(state.invulnerable>0)return;state.hull--;state.hits++;state.invulnerable=1.3;state.shake=.35;
 const p=o.type?geometry(o):{x:offset+state.x*field,y:sy,r:24};
 for(let i=0;i<8;i++)particles.push({x:p.x,y:p.y,vx:Math.cos(i*2.4)*50,vy:Math.sin(i*2.4)*50,age:0});
 ripples.push({x:p.x,y:p.y,age:0,color:C.paper,r:p.r});tone('hit');
 if(state.hull<=0){finish(false,cause);return;}announce(`${cause==='lightning'?'Lightning struck!':'A scrape!'} ${state.hull===2?'Two hits left.':'One hit left.'}`,2.1);
}
function weather(){
 state.weather=0;let forecast='',forecastDirection=0;
 if(dayIndex===2&&crew.some(c=>c.active))forecast='Athena holds the swells';
 for(const [at,direction] of day().gusts){const until=at-state.time;if(until>0&&until<2.8){forecast=`Gust ${direction>0?'from the left':'from the right'} in ${Math.ceil(until)}`;forecastDirection=direction;}
  if(until<=0&&until>-3.2){state.weather=dayIndex===3?.12:.065;state.weatherDirection=direction;forecastDirection=direction;forecast=direction>0?'Wind pushing right · steer left':'Wind pushing left · steer right';}}
 $('#forecast-copy').textContent=forecast;$('#forecast').dataset.direction=String(forecastDirection);$('#forecast').hidden=!forecast;
 const bolt=day().bolts.find(([at])=>state.time>at-2.6&&state.time<at+.4),el=$('#lightning');
 el.hidden=!bolt;
 if(bolt){const [at,x]=bolt,until=at-state.time;el.style.left=(offset+x*field)+'px';el.style.width=(field*.19)+'px';el.classList.toggle('striking',until<=0);el.style.setProperty('--charge',String(clamp(1-until/2.6,0,1)));el.textContent=until>0?'Lightning':'Strike';
  if(until<=0&&!state.boltHits.has(at)){state.boltHits.add(at);if(Math.abs(state.x-x)<.095+24*shipScale/field)damage({hit:false},'lightning');}}
}
function update(dt){
 state.time=Math.min(day().duration,state.time+dt);
 const left=keys.has('ArrowLeft')||keys.has('a')||[...pointers.values()].includes(-1),right=keys.has('ArrowRight')||keys.has('d')||[...pointers.values()].includes(1),direction=Number(right)-Number(left);
 $('#left').classList.toggle('pressed',!!left);$('#right').classList.toggle('pressed',!!right);
 state.velocity+=(direction*.44-state.velocity)*Math.min(1,dt*14);
 weather();if(mode!=='playing')return;
 const gust=state.gust>0?state.gustDirection*.09:0,wave=state.wave>0&&!(dayIndex===2&&crew.some(c=>c.active))?state.waveDirection*.13:0;
 const edge=Math.max(.12,(28+39*shipScale-offset)/field);
 state.x=clamp(state.x+(state.velocity+gust+wave+state.weather*state.weatherDirection)*dt,edge,1-edge);
 for(const key of ['invulnerable','shake','gust','wave'])state[key]=Math.max(0,state[key]-dt);
 if(courseIndex<day().centers.length&&state.time>=day().first+courseIndex*day().spacing-5.5)spawnRow();
 if(waveIndex<day().waves.length&&state.time>=day().waves[waveIndex]-5){const at=day().waves[waveIndex++];obstacles.push({type:'wave',x:day().centers[Math.min(day().centers.length-1,Math.round((at-day().first)/day().spacing))],at,direction:waveIndex%2?1:-1,hit:false});}
 while(crewIndex<day().crew.length&&state.time>=day().crew[crewIndex][0])trouble(day().crew[crewIndex++][1]);
 for(const c of crew){c.thanks=Math.max(0,c.thanks-dt);if(c.active){c.age+=dt;if(c.age>=c.duration){c.active=false;escapeWind();if(mode!=='playing')return;}}}
 for(const o of obstacles){
  const p=geometry(o),dx=Math.abs(p.x-(offset+state.x*field)),dy=Math.abs(p.y-sy);
  if(o.type==='gate'){
   const halfSpan=Math.min(48*shipScale+22,(sy-65)*.28);
   if(!o.hit&&dy<halfSpan&&dx+45*shipScale>o.gap*field/2){damage(o);if(mode!=='playing')return;}
   if(!o.passed&&p.y>sy+halfSpan){o.passed=true;if(!o.hit)state.dodged++;}
  }else if(!o.hit&&dx<p.r+26*shipScale&&dy<22+32*shipScale){o.hit=true;state.wave=1.35;state.waveDirection=o.direction;tone('wave');}
 }
 for(let i=obstacles.length-1;i>=0;i--)if(geometry(obstacles[i]).y>h+110){gateMarkers.get(obstacles[i])?.remove();gateMarkers.delete(obstacles[i]);obstacles.splice(i,1);}
 if(state.time>messageUntil)$('#message').textContent='';
 if(state.time>=day().duration)finish(true);
}
function crewPoint(index){const positions=[[-39,12],[39,12],[0,66]];let[x,y]=positions[index];const reach=!reduced&&crew[index].active?crew[index].age/crew[index].duration:0;x*=1-reach*.12;y-=reach*8;return{x:offset+state.x*field+x*shipScale,y:sy+y*shipScale};}
function positionCrew(){
 if(!state)return;
 sailors.forEach((el,i)=>{const p=crewPoint(i),c=crew[i];el.style.left=p.x+'px';el.style.top=p.y+'px';el.classList.toggle('trouble',c.active);el.classList.toggle('urgent',c.active&&c.age/c.duration>.68);el.classList.toggle('thanked',c.thanks>0);
 el.querySelector('.arm').setAttribute('d',c.active?(i===0?'M13 36 4 43M35 36 38 6':i===1?'M13 36 10 6M35 36l9 7':'M13 36 10 5M35 36 38 5'):'M13 36 4 43M35 36l9 7');el.style.setProperty('--spent',c.active?String(c.age/c.duration*100):'0');el.setAttribute('aria-label',`${c.active?'Restless':'Rowing'} sailor ${i+1}. ${c.active?'Send back to rowing. ':''}Key ${i+1}.`);});
 $('#bag-label').style.left=(offset+state.x*field+102*shipScale)+'px';$('#bag-label').style.top=(sy-37*shipScale)+'px';
 $('#route-ship').style.left=((dayIndex+state.time/day().duration)/4*100)+'%';$('#remaining').textContent=`DAY ${numerals[dayIndex]} · ${Math.ceil(day().duration-state.time)}s`;
 for(const[o,el]of gateMarkers){const p=geometry(o);el.style.left=p.x+'px';el.style.top=p.y+'px';el.hidden=p.y<70||p.y>h-75||o.passed;}
}

function path(points,fill,stroke,width=1){
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}

function line(points,color,width=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}

function gate(p,o){
  const left=p.x-o.gap*field/2,right=p.x+o.gap*field/2;
  for(const [a,b,side] of [[offset-20,left,-1],[right,offset+field+20,1]]){
    ctx.save();ctx.translate(0,p.y);
    ctx.fillStyle='#0b293088';ctx.fillRect(a,5,b-a,31);
    const points=[[a,-18],[a+(b-a)*.22,-33],[a+(b-a)*.46,-25],[a+(b-a)*.72,-37],[b,-20],[b,23],[a+(b-a)*.70,34],[a+(b-a)*.39,24],[a,31]];
    path(points,o.hit?'#526d70':'#76918d',C.deep,2);
    path([[a,-18],[a+(b-a)*.22,-33],[a+(b-a)*.46,-25],[b,-20],[b-12,1],[a+(b-a)*.56,-4],[a+8,5]],'#a1b5aa');
    path([[a+5,5],[a+(b-a)*.56,-4],[b-12,1],[b,23],[a+(b-a)*.70,34],[a+(b-a)*.39,24],[a,31]],'#506e72');
    const edge=side<0?b:a;
    line([[edge+side*6,-19],[edge-side*7,-3],[edge-side*8,20]],'#d4dfcf',1.5);
    line([[a,42],[a+(b-a)*.35,36],[a+(b-a)*.7,46],[b,37]],'#a8c6c377',1);
    for(let i=1;i<4;i++){const x=a+(b-a)*i/4;line([[x,-14],[x+6,-1],[x-5,8]],'#d4ddc966',1);}
    ctx.restore();
  }
  if(dayIndex===2&&!o.passed){
    ctx.save();ctx.strokeStyle='#e8c67d66';ctx.lineWidth=1.2;ctx.setLineDash([3,9]);
    ctx.beginPath();ctx.moveTo(p.x,p.y+20);ctx.quadraticCurveTo(p.x,(p.y+sy)/2,offset+state.x*field,sy-110*shipScale);ctx.stroke();ctx.restore();
  }
}

function sea(){
  ctx.fillStyle=C.sea;ctx.fillRect(0,0,w,h);
  const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,['#245663','#26495c','#294e50','#26394b'][dayIndex]);grad.addColorStop(.48,'#1b424b');grad.addColorStop(1,C.deep);
  ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
  const drift=reduced?0:ambience*9;
  ctx.globalAlpha=.24;
  for(let i=0;i<40;i++){
    const x=((i*131.7+Math.sin(i*7)*70)%w+w)%w,y=((i*83.9+drift)%(h+90))-45;
    ctx.beginPath();ctx.moveTo(x-19,y);ctx.quadraticCurveTo(x-8,y-7,x,y);ctx.quadraticCurveTo(x+8,y+7,x+19,y);
    ctx.strokeStyle=i%4===0?C.paper:C.foam;ctx.lineWidth=.8;ctx.stroke();
    if(i%3===0){ctx.beginPath();ctx.moveTo(x-12,y+8);ctx.quadraticCurveTo(x,y+15,x+12,y+8);ctx.stroke();}
  }
  ctx.globalAlpha=1;
  // Engraved currents frame the navigable water, without claiming real geography.
  for(const side of [-1,1]){
    const edge=side<0?offset+8:offset+field-8;
    ctx.strokeStyle='#c7d9ce20';ctx.lineWidth=1;
    for(let j=0;j<3;j++){
      ctx.beginPath();ctx.moveTo(edge+side*j*10,80);
      ctx.bezierCurveTo(edge-side*26+side*j*10,h*.36,edge+side*12+side*j*10,h*.65,edge-side*8+side*j*10,h-90);ctx.stroke();
    }
  }
}

function island(){
  const progress=mode==='ready'||dayIndex<3?0:clamp((state.time-(day().duration-8))/8,0,1);
  if(progress<=0)return;
  const center=offset+field*.5,top=56,scale=reduced?1:progress;
  ctx.save();ctx.translate(center,top);ctx.scale(scale,scale);
  ctx.globalAlpha=reduced?1:.3+.7*progress;
  path([[-195,3],[-160,-15],[-135,-6],[-97,-39],[-45,-25],[0,-52],[48,-21],[75,-31],[115,-9],[145,-13],[193,3]],'#658581');
  path([[-195,3],[-118,-8],[-72,3],[-15,-13],[53,2],[100,-3],[193,3],[155,16],[60,28],[-80,23]],'#94a999');
  line([[-165,25],[-70,33],[50,37],[168,25]],'#d9dfc5',1.5);
  for(let i=0;i<6;i++){
    const x=-85+i*31,y=-2+Math.sin(i*5)*5;
    ctx.fillStyle=C.paper;ctx.fillRect(x,y,8,10);path([[x-2,y],[x+4,y-6],[x+10,y]],C.gold);
  }
  ctx.fillStyle=C.paper;ctx.font='10px -apple-system,sans-serif';ctx.textAlign='center';ctx.fillText('I T H A C A',0,56);
  ctx.restore();
}

function rock(p,variant,hit=false){
  const {x,y,r}=p;ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#0b293088';ctx.beginPath();ctx.ellipse(3,r*.45,r*1.18,r*.72,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(0,4,r*1.24,r*.83,0,0,Math.PI*2);ctx.strokeStyle='#c4d9ce99';ctx.lineWidth=1.2;ctx.stroke();
  ctx.beginPath();ctx.ellipse(-3,8,r*1.41,r*.99,0,.3,2.6);ctx.strokeStyle='#c4d9ce55';ctx.stroke();
  const rotation=variant*.35;ctx.rotate(rotation);
  path([[-r,.13*r],[-r*.78,-r*.53],[-r*.22,-r*.93],[r*.4,-r*.76],[r*.91,-r*.19],[r*.83,r*.5],[r*.23,r*.78],[-r*.6,r*.64]],hit?'#526d70':C.rock,C.deep,2);
  path([[-r*.78,-r*.53],[-r*.22,-r*.93],[r*.1,-r*.16],[-r*.18,r*.54],[-r*.6,r*.64]],'#a1b5aa');
  path([[r*.1,-r*.16],[r*.4,-r*.76],[r*.91,-r*.19],[r*.23,r*.78],[-r*.18,r*.54]],'#506e72');
  line([[-r*.56,-r*.4],[-r*.29,-r*.67],[-r*.1,-r*.23]],'#d4ddc9',1.2);
  line([[r*.27,-r*.31],[r*.57,-r*.16],[r*.4,r*.24]],'#b3c6b6',1);
  ctx.restore();
}

function wave(p,direction,hit){
  ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=hit?.32:.85;
  const amplitude=dayIndex===2&&crew.some(c=>c.active)?3:14;
  ctx.strokeStyle=C.foam;ctx.lineWidth=2;
  for(let row=0;row<3;row++){
    ctx.beginPath();ctx.moveTo(-p.r,row*9);
    for(let j=0;j<4;j++){
      const x=-p.r+j*p.r*.5;
      ctx.quadraticCurveTo(x+p.r*.12,row*9-amplitude,x+p.r*.25,row*9);
      ctx.quadraticCurveTo(x+p.r*.37,row*9+amplitude,x+p.r*.5,row*9);
    }ctx.stroke();
  }
  line([[-direction*15,-18],[direction*15,-18],[direction*8,-25]],C.paper,1.5);
  line([[direction*15,-18],[direction*8,-11]],C.paper,1.5);ctx.restore();
}

function ship(){
  const sx=offset+state.x*field;
  ctx.save();ctx.translate(sx,sy);
  const tilt=reduced?0:state.velocity*.11+Math.sin(ambience*1.4)*.006;
  ctx.rotate(tilt);ctx.scale(shipScale,shipScale);
  // Wake is drawn behind the hull; reduced motion omits the periodic ripples.
  ctx.strokeStyle='#d8e6d355';ctx.lineWidth=1.2;
  for(const side of [-1,1]){
    ctx.beginPath();ctx.moveTo(side*39,-92);ctx.bezierCurveTo(side*70,-30,side*83,57,side*110,128);ctx.stroke();
    if(!reduced){ctx.beginPath();ctx.moveTo(side*56,24);ctx.quadraticCurveTo(side*80,95,side*100,141+(ambience*12%30));ctx.stroke();}
  }
  // Shadow and six paired oars.
  ctx.fillStyle='#0a222a77';ctx.beginPath();ctx.ellipse(5,15,77,129,0,0,Math.PI*2);ctx.fill();
  for(let i=0;i<5;i++)for(const side of [-1,1]){
    const y=-37+i*29,swing=reduced?0:Math.sin(ambience*3+i*.15)*8;
    line([[side*46,y],[side*83,y+26+swing]],C.deck,3);
    line([[side*83,y+26+swing],[side*89,y+36+swing]],C.paper,5);
  }
  const outline=[[-12,-125],[-39,-95],[-61,-47],[-66,15],[-52,81],[-30,110],[29,110],[53,81],[66,15],[61,-47],[39,-95],[12,-125],[0,-145]];
  path(outline,C.wood,C.ink,3);
  path([[-8,-114],[-31,-86],[-52,-40],[-55,15],[-43,75],[-23,96],[22,96],[44,75],[55,15],[52,-40],[31,-86],[8,-114]],C.deck,C.ink,1.5);
  for(let i=-2;i<=2;i++)line([[i*17,-66],[i*17,85]],'#8e714c66',1);
  for(const y of [-67,-5,48,85])line([[-47,y],[47,y]],'#9f7e53',2);
  // The sail stays at the bow, leaving the deck and its hands visible.
  line([[0,-112],[0,-53]],C.ink,4);line([[-39,-101],[39,-101]],C.ink,3);
  ctx.beginPath();ctx.moveTo(-37,-99);ctx.quadraticCurveTo(-42,-76,-33,-57);ctx.quadraticCurveTo(0,-46,34,-57);ctx.quadraticCurveTo(40,-75,37,-99);ctx.closePath();ctx.fillStyle=C.paper;ctx.fill();ctx.strokeStyle='#b8bfad';ctx.lineWidth=1;ctx.stroke();
  line([[0,-98],[0,-57]],'#a3afa3',1);ctx.strokeStyle='#235764';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,-77,10,Math.PI*.25,Math.PI*1.8);ctx.stroke();
  ctx.beginPath();ctx.arc(1,-77,5,0,Math.PI*1.4);ctx.stroke();
  // Ox-hide bag, with three actual silver ties that disappear as winds escape.
  ctx.save();ctx.translate(0,-26);
  const breathe=reduced?1:1+Math.sin(ambience*3)*.025;ctx.scale(breathe,breathe);
  path([[-10,-20],[-6,-10],[-18,1],[-19,17],[-9,24],[9,24],[19,17],[18,1],[6,-10],[10,-20],[0,-17]],'#805735',C.ink,2);
  path([[-6,-8],[-11,1],[-12,17],[-5,20],[1,14],[-2,-7]],'#b18c56');
  for(let i=0;i<3-state.escapes;i++)line([[-8,-9+i*3],[8,-9+i*3]],'#e1e6de',1.8);
  if(crew.some(c=>c.active)){
    ctx.strokeStyle=C.gold;ctx.lineWidth=1.6;ctx.beginPath();ctx.ellipse(0,5,25,29,0,0,Math.PI*2);ctx.stroke();
  }
  ctx.restore();
  // Hull cracks are persistent damage, never a detached health dashboard.
  for(let i=0;i<state.hits;i++){
    const x=i===0?-44:i===1?42:-23,y=i===2?81:44;
    line([[x,y-20],[x-4,y-8],[x+5,y],[x-4,y+11],[x+2,y+19]],C.deep,3);
    line([[x+4,y],[x+12,y+3]],C.deep,2);
  }
  if(state.invulnerable>0){ctx.beginPath();ctx.ellipse(0,-1,76,128,0,0,Math.PI*2);ctx.strokeStyle=C.danger;ctx.lineWidth=2;ctx.setLineDash([7,7]);ctx.stroke();ctx.setLineDash([]);}
  ctx.restore();
}

function wind(){
  if(state.gust<=0&&!state.weather)return;
  ctx.save();ctx.globalAlpha=.6;ctx.strokeStyle=C.paper;ctx.lineWidth=1.3;
  for(let i=0;i<6;i++){
    const y=130+i*(h-200)/6,x=reduced?w*.5:((ambience*180*(state.gust>0?state.gustDirection:state.weatherDirection)+i*130)% (w+200)+w+200)%(w+200)-100;
    ctx.beginPath();ctx.moveTo(x-70,y);ctx.bezierCurveTo(x-20,y-20,x+50,y+20,x+65,y-5);ctx.bezierCurveTo(x+80,y-30,x+43,y-35,x+40,y-13);ctx.stroke();
  }ctx.restore();
}

function render(dt){
  ctx.save();
  if(!reduced&&state.shake>0)ctx.translate(Math.sin(ambience*75)*state.shake*5,Math.cos(ambience*95)*state.shake*3);
  sea();island();
  if(mode==='ready'){
    rock({x:offset+field*.84,y:h*.27,r:field*.07},1);
    rock({x:offset+field*.12,y:h*.65,r:field*.04},2);
  }
  for(const o of obstacles){const p=geometry(o);if(p.y>-130&&p.y<h+130)o.type==='gate'?gate(p,o):wave(p,o.direction,o.hit);}
  ship();wind();
  for(let i=ripples.length-1;i>=0;i--){
    const p=ripples[i];if(mode==='playing')p.age+=dt;
    if(p.age>1){ripples.splice(i,1);continue;}
    ctx.globalAlpha=1-p.age;ctx.strokeStyle=p.color;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r+(reduced?0:p.age*50),0,Math.PI*2);ctx.stroke();
  }ctx.globalAlpha=1;
  if(!reduced)for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];if(mode==='playing')p.age+=dt;
    if(p.age>.6){particles.splice(i,1);continue;}
    ctx.fillStyle=C.paper;ctx.globalAlpha=1-p.age/.6;ctx.fillRect(p.x+p.vx*p.age,p.y+p.vy*p.age,3,3);
  }
  ctx.globalAlpha=1;ctx.restore();positionCrew();
}

function tick(now){
  const elapsed=previous?(now-previous)/1000:0;previous=now;
  // A stalled or backgrounded tab never advances several seconds into a hazard.
  if(elapsed>1&&mode==='playing')pause('Paused while you were away.');
  const dt=Math.min(elapsed,.05);
  if(mode==='playing'||mode==='ready')ambience+=dt;
  if(mode==='playing')update(dt);
  render(dt);requestAnimationFrame(tick);
}

function tone(kind){
  if(!soundOn)return;
  try{
    if(!audioContext)audioContext=new (window.AudioContext||window.webkitAudioContext)();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    const patterns={start:[220,330,440],crew:[440,660],warning:[330,392],hit:[100,62],wave:[180,230],gust:[110,160,80],win:[330,440,550,660],loss:[220,165,110]};
    (patterns[kind]||[440]).forEach((frequency,i)=>{
      const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),time=audioContext.currentTime+i*.10;
      oscillator.type=kind==='hit'?'triangle':'sine';oscillator.frequency.setValueAtTime(frequency,time);
      gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.055,time+.012);gain.gain.exponentialRampToValueAtTime(.001,time+.15);
      oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(time);oscillator.stop(time+.16);
    });
  }catch{soundOn=false;$('#sound').setAttribute('aria-pressed','false');$('#sound').setAttribute('aria-label','Sound unavailable');}
}

function wireSteering(button,direction){
  button.addEventListener('pointerdown',event=>{
    if(mode!=='playing'||(event.pointerType==='mouse'&&event.button!==0))return;
    event.preventDefault();pointers.set(event.pointerId,direction);button.setPointerCapture(event.pointerId);
  });
  const release=event=>pointers.delete(event.pointerId);
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  button.addEventListener('contextmenu',event=>event.preventDefault());
  const key=direction<0?'ArrowLeft':'ArrowRight';
  button.addEventListener('keydown',event=>{
    if(mode==='playing'&&(event.key===' '||event.key==='Enter')){event.preventDefault();event.stopPropagation();keys.add(key);}
  });
  button.addEventListener('keyup',event=>{
    if(event.key===' '||event.key==='Enter'){event.preventDefault();event.stopPropagation();keys.delete(key);}
  });
  button.addEventListener('blur',()=>keys.delete(key));
}
wireSteering($('#left'),-1);wireSteering($('#right'),1);
window.addEventListener('pointerup',event=>pointers.delete(event.pointerId));
window.addEventListener('pointercancel',event=>pointers.delete(event.pointerId));
sailors.forEach((el,i)=>{
  el.addEventListener('pointerdown',event=>{if(mode!=='playing'||(event.pointerType==='mouse'&&event.button!==0))return;event.preventDefault();command(i);});
  el.addEventListener('click',event=>{if(event.detail===0)command(i);});
  el.addEventListener('contextmenu',event=>event.preventDefault());
});
window.addEventListener('keydown',event=>{
  if($('#source').open)return;
  if((!$('#curtain').hidden||!$('#interlude').hidden)&&event.key==='Tab'){
    const modal=$('#interlude').hidden?$('#curtain'):$('#interlude');
    const items=[...modal.querySelectorAll('button:not([hidden]),a')].filter(el=>el.getClientRects().length);
    const current=items.indexOf(document.activeElement),next=current<0?(event.shiftKey?items.length-1:0):(current+(event.shiftKey?-1:1)+items.length)%items.length;
    event.preventDefault();items[next]?.focus();
    return;
  }
  const key=event.key.length===1?event.key.toLowerCase():event.key;
  if((key==='Escape'||key==='p')&&!event.repeat){event.preventDefault();mode==='playing'?pause():mode==='paused'?resume():null;return;}
  if(mode!=='playing')return;
  if(['ArrowLeft','ArrowRight','a','d'].includes(key)){event.preventDefault();keys.add(key);}
  if(key===' '){event.preventDefault();if(!event.repeat)commandUrgent();}
  if(['1','2','3'].includes(key)&&!event.repeat){event.preventDefault();command(Number(key)-1);}
});
window.addEventListener('keyup',event=>{keys.delete(event.key.length===1?event.key.toLowerCase():event.key);});
window.addEventListener('blur',()=>pause('Paused while you were away.'));
window.addEventListener('pagehide',()=>pause('Paused while you were away.'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('Paused while you were away.');});
document.addEventListener('freeze',()=>pause('Paused while you were away.'));
window.addEventListener('resize',resize);
$('#start').addEventListener('click',()=>showDay(progress.day));
$('#day-start').addEventListener('click',start);
$('#replay-all').addEventListener('click',replayAll);
$('#replay-opening').addEventListener('click',replayAll);
$('#pause').addEventListener('click',()=>pause());
$('#again').addEventListener('click',()=>mode==='paused'?resume():mode==='cleared'?showDay(progress.day):start());
$('#restart').addEventListener('click',start);
function openStory(){resumeAfterStory=mode==='playing';if(resumeAfterStory)pause();$('#source').showModal();}
$('#about').addEventListener('click',openStory);$('#story').addEventListener('click',openStory);
$('#source').addEventListener('close',()=>{if(resumeAfterStory){resumeAfterStory=false;$('#again').focus();}});
$('#sound').addEventListener('click',()=>{
  soundOn=!soundOn;
  $('#sound').setAttribute('aria-pressed',String(soundOn));$('#sound').setAttribute('aria-label',soundOn?'Turn sound off':'Turn sound on');
  $('#sound').innerHTML=soundOn?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 8q5 4 0 8M19 5q8 7 0 14"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6"/></svg>';
  tone('crew');
});
resetState();resize();setMode('ready');showSaveWarning();
if(progress.day>0||progress.finished){$('#start').textContent=progress.finished?'Sail the final day again':`Continue · day ${numerals[progress.day]}`;$('#replay-opening').hidden=false;}
requestAnimationFrame(tick);
