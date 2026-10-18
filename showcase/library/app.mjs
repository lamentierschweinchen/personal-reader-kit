const grid=document.querySelector('#results');
const books=[...grid.querySelectorAll('.book')];
const input=document.querySelector('#search');
const sort=document.querySelector('#sort');
const filters=[...document.querySelectorAll('[data-filter]')];
const empty=document.querySelector('.empty');
const status=document.querySelector('#result-count');
const dialog=document.querySelector('#edition-dialog');
const dialogContent=document.querySelector('#edition-content');
let category='all',returnFocus=null,scrollBefore=0;

function render(){
 const query=input.value.toLocaleLowerCase().trim();
 const terms=query.split(/\s+/).filter(Boolean);
 let visible=0;
 for(const book of books){
  const categories=book.dataset.categories.split(' ');
  const matchedCategory=category==='all'||(category==='words'?categories.includes('words')||categories.includes('ideas'):categories.includes(category));
  book.hidden=!matchedCategory||!terms.every(term=>book.dataset.search.includes(term));
  if(!book.hidden)visible++;
 }
 const ordered=[...books].sort((a,b)=>sort.value==='shelf'?Number(a.dataset.order)-Number(b.dataset.order):a.dataset[sort.value].localeCompare(b.dataset[sort.value]));
 grid.append(...ordered,empty);
 empty.hidden=visible>0;
 status.textContent=`${visible} ${visible===1?'edition':'editions'}${query||category!=='all'?' found':' · the founding shelf'}`;
}
input.addEventListener('input',render);
sort.addEventListener('change',render);
for(const button of filters)button.addEventListener('click',()=>{category=button.dataset.filter;for(const b of filters)b.setAttribute('aria-pressed',String(b===button));render();});
document.querySelector('#reset').addEventListener('click',()=>{input.value='';category='all';for(const b of filters)b.setAttribute('aria-pressed',String(b.dataset.filter==='all'));render();input.focus();});

function preview(id,trigger){
 const source=document.querySelector(`#edition-${id} .edition-layout`);
 if(!source||typeof dialog.showModal!=='function')return false;
 returnFocus=trigger;scrollBefore=scrollY;
 const content=source.cloneNode(true);
 content.querySelector('[data-edition-title]').id='edition-title';
 dialogContent.replaceChildren(content);
 dialog.showModal();document.body.classList.add('dialog-open');dialog.scrollTop=0;
 return true;
}
document.addEventListener('click',e=>{const trigger=e.target.closest('[data-preview]');if(trigger&&preview(trigger.dataset.preview,trigger))e.preventDefault();});
dialog.querySelector('.close-dialog').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{document.body.classList.remove('dialog-open');dialogContent.replaceChildren();if(returnFocus)returnFocus.focus({preventScroll:true});scrollTo({top:scrollBefore,behavior:'instant'});});
dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();});

// Read links and source disclosures are already usable in the static HTML.
document.querySelector('.browse-tools').hidden=false;
document.querySelector('.sort').hidden=false;
document.body.dataset.libraryReady='true';
const id=location.hash.match(/^#edition-([a-z-]+)$/)?.[1];
if(id){const source=document.getElementById('edition-'+id);if(source)source.open=true;}
