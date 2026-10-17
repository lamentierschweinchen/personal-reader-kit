const prompt=document.querySelector('#starter-prompt').value;
const fallback=document.querySelector('.copy-fallback');
const fallbackText=fallback.querySelector('textarea');
const feedback=document.querySelector('.copy-feedback');
let feedbackTimer;
document.querySelectorAll('[data-static]').forEach(el=>el.hidden=true);
document.querySelectorAll('[data-copy]').forEach(el=>el.hidden=false);
document.querySelector('#instruction').open=false;
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{
 const value=prompt;
 try{
  await navigator.clipboard.writeText(value);
  feedback.textContent='Copied. Paste it into your coding agent.';
  feedback.classList.add('visible');clearTimeout(feedbackTimer);
  feedbackTimer=setTimeout(()=>feedback.classList.remove('visible'),4000);
 }catch{fallbackText.value=value;fallback.showModal();fallbackText.focus();fallbackText.select();}
}));
fallback.addEventListener('click',event=>{
 if(event.target!==fallback)return;
 const r=fallback.getBoundingClientRect();
 if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)fallback.close();
});

const story=document.querySelector('.transformation');
const stage=story.querySelector('.stage');
const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const shortViewport=matchMedia('(max-height: 600px)');
const clamp=n=>Math.max(0,Math.min(1,n));
let frame=0;
function update(){
 frame=0;
 if(!document.documentElement.classList.contains('motion'))return;
 const top=Number.parseFloat(getComputedStyle(stage).top)||0;
 const distance=story.offsetHeight-stage.offsetHeight;
 story.style.setProperty('--reveal-distance',distance+'px');
 const progress=clamp((top-story.getBoundingClientRect().top)/Math.max(1,distance));
 const uncover=clamp((progress-.15)/.6);
 const label=clamp((progress-.65)/.2);
 story.style.setProperty('--progress',progress.toFixed(4));
 story.style.setProperty('--uncover',uncover.toFixed(4));
 story.style.setProperty('--label',label.toFixed(4));
 story.classList.toggle('is-opening',progress>=.25);
 story.classList.toggle('is-open',progress>.65);
}
function queue(){if(!frame)frame=requestAnimationFrame(update);}
function configure(){
 const reduced=motionQuery.matches||shortViewport.matches||document.documentElement.hasAttribute('data-reduced-motion');
 document.documentElement.classList.toggle('motion',!reduced);
 update();
}
window.addEventListener('scroll',queue,{passive:true});
window.addEventListener('resize',queue,{passive:true});
motionQuery.addEventListener('change',configure);
shortViewport.addEventListener('change',configure);
configure();
document.fonts.ready.then(queue);
