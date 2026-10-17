const $ = selector => document.querySelector(selector);
const game = $('#game'), canvas = $('#sea'), ctx = canvas.getContext('2d');
const sailors = [...document.querySelectorAll('.sailor')];
const DURATION = 72;
const C = {sea:'#183c46',deep:'#102e36',foam:'#a8c6c3',paper:'#f3f0e6',ink:'#203437',gold:'#e8c67d',wood:'#b98858',deck:'#d8b781',danger:'#f39d78',rock:'#739190'};
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionQuery.matches;
motionQuery.addEventListener('change', event => { reduced = event.matches; });
let w=0, h=0, field=0, offset=0, sy=0, shipScale=1, dpr=1, previous=0, ambience=0;
let mode='ready', soundOn=false, audioContext=null, resumeAfterStory=false, messageUntil=0;
let state, courseIndex=0, crewIndex=0, nextCrew=6, lastCommand=-10;
const keys = new Set(), pointers = new Map();
const obstacles=[], ripples=[], particles=[];
const crew = Array.from({length:3},()=>({active:false,age:0,duration:3.8,thanks:0}));
const course = [
  ['rock',.40], ['rock',.75], ['rocks',.18,.56], ['wave',.50,-1],
  ['rocks',.44,.82], ['rock',.33], ['rocks',.18,.56], ['wave',.72,1],
  ['rock',.62], ['rocks',.44,.82], ['rock',.50], ['wave',.28,-1],
  ['rocks',.18,.56], ['rocks',.44,.82], ['rock',.40], ['wave',.55,1],
  ['rocks',.18,.56]
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const readyX=()=>w<600?.56:.72;

function resetState(){
  state={time:0,x:readyX(),velocity:0,hull:3,escapes:0,commands:0,hits:0,dodged:0,
    invulnerable:0,gust:0,gustDirection:1,wave:0,waveDirection:0,shake:0};
  courseIndex=0;crewIndex=0;nextCrew=6;lastCommand=-10;
  obstacles.length=0;ripples.length=0;particles.length=0;
  crew.forEach(c=>Object.assign(c,{active:false,age:0,duration:3.8,thanks:0}));
}

function resize(){
  const oldLandscape=w>h;
  w=game.clientWidth;h=game.clientHeight;field=Math.min(w,760);offset=(w-field)/2;
  const compact=h<540&&w>=600;
  shipScale=compact?.79:(w<600?.94:1.12);
  sy=compact?h*.59:h*.66;
  dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(state&&mode==='ready')state.x=readyX();
  if(mode==='playing'&&oldLandscape!==(w>h))pause('A moment to get your bearings.');
  positionCrew();
}

function setMode(value){
  mode=value;game.dataset.mode=value;
  const modal=['paused','won','lost'].includes(value);
  $('.topbar').inert=modal;$('#controls').inert=modal;
  $('#pause').disabled=value!=='playing';
  $('#remaining').hidden=value==='ready';
  sailors.forEach(s=>s.disabled=value!=='playing');
  $('#left').disabled=value!=='playing';$('#right').disabled=value!=='playing';
}

function clearInput(){
  keys.clear();pointers.clear();
  $('#left').classList.remove('pressed');$('#right').classList.remove('pressed');
  if(state)state.velocity=0;
}

function announce(text, seconds=2.3){
  $('#message').textContent=text;messageUntil=state.time+seconds;
}

function start(){
  $('#source').close();$('#curtain').hidden=true;
  clearInput();resetState();setMode('playing');
  positionCrew();$('#accessible-status').textContent='';
  announce('Dodge the rocks. Keep the bag tied.',3.4);
  $('#pause').focus({preventScroll:true});
  tone('start');
}

function pause(reason='The sea can wait.'){
  if(mode!=='playing')return;
  clearInput();setMode('paused');
  $('#curtain').hidden=false;
  $('#result-kicker').textContent='At anchor';$('#result-title').textContent='Take a breath.';
  $('#result-copy').textContent=reason;
  $('#again').textContent='Keep sailing';$('#restart').hidden=false;
  $('#story').hidden=false;$('#again').focus({preventScroll:true});
}

function resume(){
  if(mode!=='paused')return;
  clearInput();$('#curtain').hidden=true;setMode('playing');
  $('#pause').focus({preventScroll:true});
}

function finish(won, cause){
  clearInput();setMode(won?'won':'lost');
  $('#message').textContent='';$('#curtain').hidden=false;
  $('#restart').hidden=true;$('#story').hidden=false;
  $('#result-kicker').textContent=won?'Ithaca · Landfall':`${Math.floor(state.time)} seconds at sea`;
  $('#result-title').textContent=won?'Home at last.':cause==='wind'?'Blown off course.':'Shipwrecked.';
  $('#result-copy').textContent=won
    ? (state.hits===0&&state.escapes===0?'An unbroken hull. A tightly tied bag. Even the crew looks impressed.':`${state.commands} sailors sent back to the oars. ${state.hits?`${state.hits} rock ${state.hits===1?'hit':'hits'}. A battered ship is still a ship that made it home.`:'A few loose winds. All three sailors home.'}`)
    : cause==='wind'?'The crew let the winds escape three times. Tap a gold sailor before the ring runs out.':'Three rocks were one too many. The wide side of each channel gives you room to watch the crew.';
  $('#again').textContent=won?'Sail again':'Try again';
  $('#accessible-status').textContent=$('#result-title').textContent+' '+$('#result-copy').textContent;
  $('#again').focus({preventScroll:true});tone(won?'win':'loss');
}

function command(index){
  if(mode!=='playing'||state.time-lastCommand<.18)return;
  const c=crew[index];
  if(!c.active)return;
  lastCommand=state.time;c.active=false;c.thanks=1.05;state.commands++;
  sailors[index].querySelector('.crew-prompt').textContent='Aye!';
  const point=crewPoint(index);
  ripples.push({x:point.x,y:point.y,age:0,color:C.gold,r:20});
  tone('crew');
}

function commandUrgent(){
  let index=-1,most=-1;
  crew.forEach((c,i)=>{if(c.active&&c.age/c.duration>most){most=c.age/c.duration;index=i;}});
  if(index>=0)command(index);
}

function trouble(){
  // This short, fixed course teaches a recognizable rhythm; the sailor rotates.
  const order=[0,1,2,1,0,2,0,2,1,2,1,0,1,2,0];
  const index=order[crewIndex++%order.length];
  Object.assign(crew[index],{active:true,age:0,duration:state.time<18?3.8:state.time<46?3.3:2.9,thanks:0});
  sailors[index].querySelector('.crew-prompt').textContent='Tap!';
  if(crewIndex===1)announce('Hands off the bag! Tap the gold sailor.',3.8);
  $('#accessible-status').textContent=`Sailor ${index+1} is reaching for the bag. Press ${index+1} or Space.`;
  tone('warning');
}

function escapeWind(){
  state.escapes++;state.gust=4.5;state.gustDirection=state.x>.5?-1:1;state.shake=.5;
  ripples.push({x:offset+state.x*field,y:sy-22*shipScale,age:0,color:C.paper,r:36});
  tone('gust');
  if(state.escapes>=3){finish(false,'wind');return;}
  announce(state.escapes===1?'Wind loose! Steer against the gust.':'One last knot. Watch those hands!',3.1);
}

function spawnRow(){
  const row=course[courseIndex++], type=row[0];
  for(const x of type==='rocks'?row.slice(1):[row[1]]){
    obstacles.push({type:type==='wave'?'wave':'rock',x,travel:0,hit:false,passed:false,
      direction:type==='wave'?row[2]:0,variant:courseIndex%3});
  }
}

function geometry(obstacle){
  const y=-65+obstacle.travel*(sy+65);
  return {x:offset+obstacle.x*field,y,r:obstacle.type==='rock'?field*.062:field*.12};
}

function hitRock(o){
  o.hit=true;
  if(state.invulnerable>0)return;
  state.hull--;state.hits++;state.invulnerable=1.7;state.shake=.35;
  const point=geometry(o);
  for(let i=0;i<10;i++)particles.push({x:point.x,y:point.y,vx:Math.cos(i*2.4)*50,vy:Math.sin(i*2.4)*50,age:0});
  ripples.push({x:point.x,y:point.y,age:0,color:C.paper,r:point.r});
  tone('hit');
  if(state.hull<=0){finish(false,'rock');return;}
  announce(state.hull===2?'A scrape! Two hits left.':'Hull cracking. One hit left.',2.8);
}

function update(dt){
  state.time=Math.min(DURATION,state.time+dt);
  const left=keys.has('ArrowLeft')||keys.has('a')||[...pointers.values()].includes(-1);
  const right=keys.has('ArrowRight')||keys.has('d')||[...pointers.values()].includes(1);
  const direction=Number(right)-Number(left);
  $('#left').classList.toggle('pressed',!!left);$('#right').classList.toggle('pressed',!!right);
  state.velocity+=(direction*.40-state.velocity)*Math.min(1,dt*13);
  const gust=state.gust>0?state.gustDirection*.075*(.65+.35*Math.sin(state.time*4)):0;
  const wave=state.wave>0?state.waveDirection*.085:0;
  state.x=clamp(state.x+(state.velocity+gust+wave)*dt,.13,.87);
  state.invulnerable=Math.max(0,state.invulnerable-dt);state.shake=Math.max(0,state.shake-dt);
  state.gust=Math.max(0,state.gust-dt);state.wave=Math.max(0,state.wave-dt);
  if(state.time>=1.2+courseIndex*3.6&&courseIndex<course.length)spawnRow();
  if(state.time>=nextCrew&&state.time<66){trouble();nextCrew+=state.time<28?6.1:5.2;}
  for(const c of crew){
    c.thanks=Math.max(0,c.thanks-dt);
    if(c.active){c.age+=dt;if(c.age>=c.duration){c.active=false;escapeWind();if(mode!=='playing')return;}}
  }
  for(const o of obstacles){
    o.travel+=dt/(state.time<24?6.3:5.6);
    const p=geometry(o), dx=Math.abs(p.x-(offset+state.x*field)),dy=Math.abs(p.y-sy);
    // The submerged hull is deliberately smaller than oars and the raised prow.
    const rx=o.type==='rock'?p.r*.78+31*shipScale:p.r+26*shipScale;
    const ry=o.type==='rock'?p.r*.65+68*shipScale:25+48*shipScale;
    if(!o.hit&&dx*dx/(rx*rx)+dy*dy/(ry*ry)<1){
      if(o.type==='rock'){hitRock(o);if(mode!=='playing')return;}
      else{o.hit=true;state.wave=1.2;state.waveDirection=o.direction;tone('wave');announce('Cross-current. Hold your course.',1.5);}
    }
    if(!o.passed&&p.y>sy+120){o.passed=true;if(!o.hit&&o.type==='rock')state.dodged++;}
  }
  while(obstacles.length&&geometry(obstacles[0]).y>h+130)obstacles.shift();
  if(state.time>messageUntil)$('#message').textContent='';
  if(state.time>=DURATION)finish(true);
}

function crewPoint(index){
  const positions=[[-39,12],[39,12],[0,66]];
  let [x,y]=positions[index];
  const reach=!reduced&&crew[index].active?crew[index].age/crew[index].duration:0;
  x*=1-reach*.12;y-=reach*8;
  return {x:offset+state.x*field+x*shipScale,y:sy+y*shipScale};
}

function positionCrew(){
  if(!state)return;
  sailors.forEach((el,i)=>{
    const point=crewPoint(i),c=crew[i];
    el.style.left=point.x+'px';el.style.top=point.y+'px';
    el.classList.toggle('trouble',c.active);el.classList.toggle('urgent',c.active&&c.age/c.duration>.68);
    el.classList.toggle('thanked',c.thanks>0);
    el.querySelector('.arm').setAttribute('d',c.active?(i===0?'M13 36 4 43M35 36 38 6':i===1?'M13 36 10 6M35 36l9 7':'M13 36 10 5M35 36 38 5'):'M13 36 4 43M35 36l9 7');
    el.style.setProperty('--spent',c.active?String(c.age/c.duration*100):'0');
    el.setAttribute('aria-label',`${c.active?'Restless':'Rowing'} sailor ${i+1}. ${c.active?'Send back to rowing. ':''}Key ${i+1}.`);
  });
  $('#bag-label').style.left=(offset+state.x*field+102*shipScale)+'px';
  $('#bag-label').style.top=(sy-37*shipScale)+'px';
  $('#route-ship').style.left=(state.time/DURATION*100)+'%';
  $('#remaining').textContent=mode==='won'?'ITHACA':`${Math.ceil(DURATION-state.time)}s TO ITHACA`;
}

function path(points,fill,stroke,width=1){
  ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}

function line(points,color,width=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}

function sea(){
  ctx.fillStyle=C.sea;ctx.fillRect(0,0,w,h);
  const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#245663');grad.addColorStop(.48,'#1b424b');grad.addColorStop(1,C.deep);
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
  const progress=mode==='ready'?0:clamp((state.time-58)/14,0,1);
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
  ctx.strokeStyle=C.foam;ctx.lineWidth=2;
  for(let row=0;row<3;row++){
    ctx.beginPath();ctx.moveTo(-p.r,row*9);
    for(let j=0;j<4;j++){
      const x=-p.r+j*p.r*.5;
      ctx.quadraticCurveTo(x+p.r*.12,row*9-14,x+p.r*.25,row*9);
      ctx.quadraticCurveTo(x+p.r*.37,row*9+14,x+p.r*.5,row*9);
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
  if(state.gust<=0)return;
  ctx.save();ctx.globalAlpha=.6;ctx.strokeStyle=C.paper;ctx.lineWidth=1.3;
  for(let i=0;i<6;i++){
    const y=130+i*(h-200)/6,x=reduced?w*.5:((ambience*180*state.gustDirection+i*130)% (w+200)+w+200)%(w+200)-100;
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
  for(const o of obstacles){const p=geometry(o);if(p.y>-130&&p.y<h+130)o.type==='rock'?rock(p,o.variant,o.hit):wave(p,o.direction,o.hit);}
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
  if(!$('#curtain').hidden&&event.key==='Tab'){
    const items=[...$('#curtain').querySelectorAll('button:not([hidden]),a')],first=items[0],last=items.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
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
$('#start').addEventListener('click',start);
$('#pause').addEventListener('click',()=>pause());
$('#again').addEventListener('click',()=>mode==='paused'?resume():start());
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
resetState();resize();setMode('ready');requestAnimationFrame(tick);
