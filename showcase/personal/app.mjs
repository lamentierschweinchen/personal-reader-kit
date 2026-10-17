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
 story.style.setProperty('--progress',progress.toFixed(4));
 story.style.setProperty('--uncover',clamp((progress-.15)/.6).toFixed(4));
 story.style.setProperty('--label',clamp((progress-.65)/.2).toFixed(4));
 story.classList.toggle('is-opening',progress>=.25);
 story.classList.toggle('is-open',progress>.65);
}
function queue(){if(!frame)frame=requestAnimationFrame(update);}
function configure(){
 document.documentElement.classList.toggle('motion',!motionQuery.matches&&!shortViewport.matches&&!document.documentElement.hasAttribute('data-reduced-motion'));
 update();
}
for(const button of document.querySelectorAll('[data-preview]'))button.addEventListener('click',()=>{
 const names=['canetti','alice','walden'];
 story.style.setProperty('--active',String(names.indexOf(button.dataset.preview)));
 document.querySelectorAll('[data-book]').forEach(book=>book.classList.toggle('active',book.dataset.book===button.dataset.preview));
 document.querySelectorAll('[data-preview]').forEach(choice=>choice.setAttribute('aria-pressed',String(choice===button)));
});
window.addEventListener('scroll',queue,{passive:true});
window.addEventListener('resize',queue,{passive:true});
motionQuery.addEventListener('change',configure);
shortViewport.addEventListener('change',configure);
configure();document.fonts.ready.then(queue);
