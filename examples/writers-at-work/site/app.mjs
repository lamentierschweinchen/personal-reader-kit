import {STORE,blankState,escapeHTML as esc,validateState,validateEdition,mergeState,capturePosition,restorePosition,reconcileWrite,notebookContent,createSaveQueue} from './core.mjs';
const $=s=>document.querySelector(s), main=$('#main'), dialog=$('#reference'), content=$('#dialog-content');
let activationControl=null;
let edition,state=blankState(),lastSaved=blankState(),route='',storageBlocked=false,dirty=false,rawDamaged='',dialogOrigin=null,dialogPosition=null,dialogSelection=null,openedWithHistory=false,saveTimer;
try {const raw=localStorage.getItem(STORE);if(raw)state=validateState(JSON.parse(raw));}catch(e){try{rawDamaged=localStorage.getItem(STORE)||'';}catch{}storageBlocked=true;showStorage('Your saved notebook could not be read. Open Reading settings to recover it.');}
lastSaved=structuredClone(state);
state.noteDrafts ||= {};if(state.noteDraft){state.noteDrafts[state.noteDraft.id]=state.noteDraft;state.noteDraft=null;}
function showStorage(message){const el=$('#storage-error');el.hidden=false;el.textContent=message;}
const requestSave=createSaveQueue(async()=>{
 if(storageBlocked){showStorage('Saving is paused. Open Reading settings to export your work and resolve the notebook conflict.');return false;}
 if(!navigator.locks){showStorage('This browser cannot safely save this notebook. Download your work in Reading settings before closing the tab.');return false;}
 try{
  await navigator.locks.request(STORE,()=>{
   const candidate=structuredClone(state),raw=localStorage.getItem(STORE);let latest;
   try{latest=raw?validateState(JSON.parse(raw)):blankState();}catch{rawDamaged=raw||'';storageBlocked=true;throw new Error('The saved notebook could not be read. Its original copy is intact; open Reading settings to recover it.');}
   if(((dialog.open&&$('#note-text'))||$('#draft'))&&notebookContent(latest)!==notebookContent(lastSaved)&&notebookContent(latest)!==notebookContent(candidate)){
    storageBlocked=true;throw new Error('Another tab changed writing while this editor is open. Download this tab’s work before reloading; recover the download to keep both versions.');
   }
   let merged;try{merged=reconcileWrite(lastSaved,candidate,latest);}catch(e){storageBlocked=true;throw e;}
   localStorage.setItem(STORE,JSON.stringify(merged));lastSaved=structuredClone(merged);state=merged;
  });return true;
 }catch(e){showStorage(storageBlocked?e.message:'This browser could not save your work. Keep this tab open and download your notebook in Reading settings.');return false;}
});
function persist(next=state){state=next;dirty=true;return requestSave().then(ok=>{if(ok){dirty=false;$('#storage-error').hidden=true;}return ok;});}
window.addEventListener('storage',e=>{if(e.key===STORE&&e.newValue){try{const incoming=validateState(JSON.parse(e.newValue));if(notebookContent(incoming)===notebookContent(lastSaved)){lastSaved=incoming;state.positions={...incoming.positions,...state.positions};}else if(!dirty){if((dialog.open&&$('#note-text'))||$('#draft')){storageBlocked=true;dirty=true;showStorage('Another tab changed writing while this editor is open. Download this tab’s work before reloading; recover the download to keep both versions.');}else{state={...incoming,positions:{...incoming.positions,...state.positions}};lastSaved=structuredClone(incoming);applySettings();if(route==='#notebook')notebook();}}}catch{storageBlocked=true;rawDamaged=e.newValue;showStorage('Another tab saved an unreadable notebook. Your current work remains here; download it in Reading settings.');}}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
const findAdvice=id=>{for(const a of edition.authors){const i=a.items.find(i=>i.id===id);if(i)return {a,i,s:a.sources.find(s=>s.id===i.sourceId)};}return null;};
function prose(text){return esc(text).replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g,(_,id,label)=>{
 const sourceOnly=id.startsWith('s:'),key=id.replace(/^s:/,'');
 const source=sourceOnly?edition.authors.flatMap(a=>a.sources).find(s=>s.id===key):findAdvice(key)?.s;
 return `<a class="text-ref" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer" aria-haspopup="dialog" ${sourceOnly?'data-source':'data-advice'}="${esc(key)}">${label}</a>`;
});}
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
function remember(){if(route && !dialog.open){state.positions[route]=capturePosition(main);persist();}}
function applySettings(){document.documentElement.style.setProperty('--reading-size',state.size+'px');document.body.classList.toggle('quiet',state.quiet);$('#exit-quiet').hidden=!state.quiet;}
function setQuiet(value){const position=capturePosition(main);state.quiet=value;persist();applySettings();document.querySelectorAll('[data-action="quiet"]').forEach(b=>{if(b.id!=='exit-quiet')b.textContent=state.quiet?'Exit quiet reading':'Quiet reading';});requestAnimationFrame(()=>restorePosition(main,position));}
function sourceLink(s){return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}${arrow}</a>`;}
function navigate(){
 const next=location.hash||'#home';
 if(route && next!==route){state.positions[route]=capturePosition(main);persist();}
 route=next;let [,kind,id,item]=route.split(/[\/#]/); // leading hash leaves empty first slot
 if(!kind)kind='home';
 applySettings();
 if(!edition){if(kind==='notebook')notebook();else unavailableEdition();main.focus({preventScroll:true});return;}
 document.querySelectorAll('.topbar nav a').forEach(a=>a.setAttribute('aria-current',a.hash===`#${kind}`||(kind==='writer'&&a.hash==='#writers')||(kind==='argument'&&a.hash==='#arguments')?'page':'false'));
 if(kind==='home')home();else if(kind==='writers')writers();else if(kind==='writer')author(id);else if(kind==='arguments')argumentsIndex();else if(kind==='argument')argument(id);else if(kind==='desk')desk(id);else if(kind==='notebook')notebook();else {main.innerHTML='<section class="page"><h1>That page is missing.</h1><a href="#home">Return home</a></section>';}
 if(['writer','argument'].includes(kind)){state.lastRead={route,title:document.title.split(' · ')[0]};persist();}
 requestAnimationFrame(()=>{restorePosition(main,state.positions[route]);if(item){const target=document.getElementById(item);target?.scrollIntoView({block:'center'});} main.focus({preventScroll:true});});
}
function home(){
 document.title='How writers write · New reading';
 main.innerHTML=`<section class="cover"><div class="cover-line"><span>FICTION · NONFICTION · FILM</span><span>ESSAYS &amp; EXERCISES</span></div><h1>How writers<br><span class="work-word">write<svg viewBox="0 0 450 28" aria-hidden="true"><path d="M4 22Q210-3 440 10"/></svg></span>.</h1><div class="cover-bottom"><p>Collected wisdom from Hemingway, Morrison, Atwood, and nine other writers.</p><a class="solid-link" href="#writers">Read by writer ${arrow}</a><a class="plain-link" href="#arguments">Read the comparisons ${arrow}</a></div></section><section class="opening-exchange"><p class="eyebrow">Hemingway / Steinbeck</p><h2>The trouble<br>with correcting.</h2><div class="opening-body"><p>Hemingway reread and corrected before carrying on. Steinbeck warned that rewriting could become an excuse for stopping.</p><a class="underlink" href="#argument/keep-going">Read Hemingway and Steinbeck ${arrow}</a></div></section>${state.lastRead?`<div class="continue-strip"><span>Your reading place</span><a href="${esc(state.lastRead.route)}">Continue: ${esc(state.lastRead.title)} ${arrow}</a></div>`:''}<section class="home-index"><p class="eyebrow">Fiction · nonfiction · screenwriting · working prose</p><h2>The writers.</h2>${authorRows()}</section>`;
}
function authorRows(){return `<ol class="author-index">${edition.authors.map((a,n)=>`<li><a href="#writer/${a.id}"><span class="index-number">${String(n+1).padStart(2,'0')}</span><span class="writer-name">${esc(a.name)}</span><span class="writer-angle">${esc(a.angle)}</span>${arrow}</a></li>`).join('')}</ol>`;}
function writers(){document.title='The writers · How writers write';main.innerHTML=`<section class="page directory"><p class="eyebrow">Read by writer</p><h1>The writers.</h1>${authorRows()}<p class="endnote">Concise editorial accounts of the twelve lists collected by Open Culture. Every advice point has a source note; these are not complete works or transcripts.</p></section>`;}
function author(id){
 const a=edition.authors.find(a=>a.id===id);if(!a){location.hash='#writers';return;}
 document.title=a.name+' · How writers write';
 const n=edition.authors.indexOf(a), next=edition.authors[(n+1)%edition.authors.length];
 main.innerHTML=`<div class="reader-layout"><aside class="reader-rail"><a class="backlink" href="#writers">All twelve writers</a><p class="eyebrow">${String(n+1).padStart(2,'0')} / 12</p><nav aria-label="Writers">${edition.authors.map(w=>`<a href="#writer/${w.id}" ${w.id===id?'aria-current="page"':''}>${esc(w.name)}</a>`).join('')}</nav></aside><article class="reading"><p class="eyebrow">${esc(a.genre)}</p><h1 data-anchor="title">${esc(a.name)}</h1><p class="author-angle">${esc(a.angle)}</p><div class="reading-prose introduction">${a.intro.split('\n\n').map((p,i)=>`<p data-anchor="intro-${i}">${prose(p)}</p>`).join('')}</div><div class="advice-heading"><h2>At work</h2><span>${a.items.length} points from the selected list</span></div><p class="small-label">${esc(a.coverageNote||'Editorial summaries · source wording is linked')}</p><ol class="advice-list ${a.displayKind==='source-index'?'compact-index':''}">${a.items.map(i=>`<li id="${i.id}" data-anchor="${i.id}"><span class="advice-number">${String(i.number).padStart(2,'0')}</span><div><h3>${esc(i.title)}</h3>${a.displayKind==='source-index'?'':`<p>${prose(i.text)}</p>`}<button class="source-button" data-advice="${i.id}">${a.displayKind==='source-index'?'Open rule reference':'Read source note'} <span class="source-dot ${i.verification==='primary'?'':'secondary'}" aria-hidden="true"></span></button></div></li>`).join('')}</ol><div class="qualification reading-prose" data-anchor="qualification"><h2>${esc(a.caveatHeading||'Context')}</h2><p>${prose(a.qualification)}</p></div><div class="reading-tools"><button data-action="note">Keep a note</button><button data-author-sources="${a.id}">This writer’s sources</button><button data-action="quiet">${state.quiet?'Exit quiet reading':'Quiet reading'}</button></div><a class="next-reading" href="#writer/${next.id}"><span>Next writer</span><strong>${esc(next.name)}</strong>${arrow}</a></article></div>`;
}
function argumentsIndex(){document.title='Arguments · How writers write';main.innerHTML=`<section class="page directory"><p class="eyebrow">Hemingway, Steinbeck, Morrison, and others</p><h1>Arguments.</h1><ol class="argument-index">${edition.arguments.map((a,i)=>`<li><a href="#argument/${a.id}"><span class="index-number">${String(i+1).padStart(2,'0')}</span><div><p class="eyebrow">${esc(a.participants)}</p><h2>${esc(a.title)}</h2><p>${esc(a.dek)}</p></div>${arrow}</a></li>`).join('')}</ol></section>`;}
function block(b,n){if(b.type==='h2')return `<h2 data-anchor="b${n}">${esc(b.text)}</h2>`;if(b.type==='example')return `<figure class="worked-example" data-anchor="b${n}"><figcaption>${esc(b.label||'An original example')}</figcaption><p>${esc(b.text)}</p>${b.after?`<p class="example-after">${esc(b.after)}</p>`:''}</figure>`;return `<p data-anchor="b${n}">${prose(b.text)}</p>`;}
function argument(id){const a=edition.arguments.find(a=>a.id===id);if(!a){location.hash='#arguments';return;}document.title=a.title+' · How writers write';const next=edition.arguments[(edition.arguments.indexOf(a)+1)%edition.arguments.length];main.innerHTML=`<article class="essay reading"><a class="backlink" href="#arguments">All arguments</a><p class="eyebrow">${esc(a.participants)}</p><h1 data-anchor="title">${esc(a.title)}</h1><div class="reading-prose">${a.blocks.map(block).join('')}</div><div class="reading-tools"><button data-action="note">Keep a note</button><a href="#desk/${a.moment}">Try it at the desk ${arrow}</a><button data-action="quiet">${state.quiet?'Exit quiet reading':'Quiet reading'}</button></div><a class="next-reading" href="#argument/${next.id}"><span>Next argument</span><strong>${esc(next.title)}</strong>${arrow}</a></article>`;}
function desk(id){const m=edition.moments.find(m=>m.id===id)||edition.moments[0];if(!m){main.innerHTML='<p>The desk is not ready.</p>';return;}document.title=m.title+' · At the desk';const selected=state.choices[m.id];main.innerHTML=`<section class="desk page"><div class="desk-heading"><div><p class="eyebrow">At the desk</p><h1>What would<br>you do next?</h1></div><p>Choose what to do with the draft below.<br>Then try the suggested revision.</p></div><nav class="moment-nav" aria-label="Writing situations">${edition.moments.map((x,i)=>`<a href="#desk/${x.id}" ${m.id===x.id?'aria-current="page"':''}><span>${String(i+1).padStart(2,'0')}</span> ${esc(x.short)}</a>`).join('')}</nav><div class="desk-sheet"><div class="desk-prompt"><p class="eyebrow">Situation ${edition.moments.indexOf(m)+1} / ${edition.moments.length}</p><h2 data-anchor="prompt">${esc(m.title)}</h2><p class="reading-prose">${esc(m.setup)}</p><blockquote class="draft-sentence">${esc(m.example)}</blockquote><p class="example-caption">Original example</p><fieldset class="choices"><legend>Your next move</legend>${m.choices.map((c,i)=>`<button class="choice" data-moment="${m.id}" data-choice="${i}" aria-pressed="${selected===i}"><span>${String.fromCharCode(65+i)}</span><strong>${esc(c.label)}</strong>${arrow}</button>`).join('')}</fieldset></div><div id="desk-result" aria-live="polite">${Number.isInteger(selected)?result(m,selected):'<div class="waiting-mark" aria-hidden="true"><span>?</span><p>Choose A or B.</p></div>'}</div></div></section>`;bindDraft();}
function result(m,index){const c=m.choices[index];if(!c)return '';const match=findAdvice(c.affinity),counter=findAdvice(c.dissent);if(!match||!counter)return '';return `<section class="result"><p class="eyebrow">For this choice</p><h2>${esc(match.a.name)}</h2><p class="reading-prose">${prose(c.reason)}</p><button class="source-button" data-advice="${c.affinity}" aria-label="${esc(match.a.name)}: advice and source">Advice &amp; source ${arrow}</button><div class="counter"><p class="eyebrow">${esc(c.relation||'Another approach')}</p><h3>${esc(counter.a.name)}</h3><p class="reading-prose">${prose(c.counter)}</p><button class="source-button" data-advice="${c.dissent}" aria-label="${esc(counter.a.name)}: advice and source">Advice &amp; source ${arrow}</button></div><div class="experiment"><p class="eyebrow">Experiment</p><h3>${esc(c.experimentTitle)}</h3><p>${esc(c.experiment)}</p><p class="experiment-check"><strong>Compare:</strong> ${esc(c.compare)}</p><p class="exception"><strong>When to leave this alone:</strong> ${esc(c.exception)}</p><label for="draft">Try a few lines</label><textarea id="draft" data-draft="${m.id}" rows="5" placeholder="Write here, or try this on paper.">${esc(state.drafts[m.id]||'')}</textarea><p id="draft-status" class="small-label">Your writing stays in this browser. Download it from Notebook.</p></div><div class="desk-next"><a href="#argument/${m.argument}">Read the argument ${arrow}</a><a href="#desk/${edition.moments[(edition.moments.indexOf(m)+1)%edition.moments.length].id}">Next situation ${arrow}</a></div><p class="small-label">Exercises by the editor.</p></section>`;}
function bindDraft(){const el=$('#draft');if(el)el.addEventListener('input',async()=>{state.drafts[el.dataset.draft]=el.value;const status=$('#draft-status');const ok=await persist();if(!status?.isConnected||!el.isConnected)return;status.textContent=ok?'Saved in this browser. Download a copy from Notebook.':'Not saved. Keep this tab open; download your notebook in Reading settings.';});}
function notebook(){document.title='Notebook · How writers write';main.innerHTML=`<section class="page notebook"><p class="eyebrow">Your notes and drafts</p><h1>Notebook.</h1><div class="notebook-actions"><button data-action="export">Download notebook</button><button data-action="import">Recover a notebook</button><button data-action="note">Write a note</button></div><p class="endnote">Notes and experiments stay in this browser. A download is your portable backup.</p><h2>Experiments</h2>${Object.entries(state.drafts).filter(([,v])=>v.trim()).map(([id,v])=>`<article class="saved-note"><a href="#desk/${esc(id)}">${esc(edition?.moments.find(m=>m.id===id)?.title||'Experiment')}</a><p>${esc(v)}</p></article>`).join('')||'<p class="empty">No experiments saved yet. <a href="#desk">Open the desk.</a></p>'}${Object.values(state.noteDrafts).length?`<h2>Unfinished notes</h2>${Object.values(state.noteDrafts).map(n=>`<article class="saved-note"><p class="small-label">${esc(n.title)}</p><p>${esc(n.text)||'No words yet.'}</p><button class="source-button" data-edit-note="${esc(n.id)}">Continue unfinished note</button></article>`).join('')}`:''}<h2>Reading notes</h2>${state.notes.map(n=>`<article class="saved-note"><a href="${esc(n.route)}">${esc(n.title)}</a>${n.quote?`<blockquote>${esc(n.quote)}</blockquote>`:''}<p>${esc(n.text)}</p><button class="source-button" data-edit-note="${esc(n.id)}">Edit note</button></article>`).join('')||'<p class="empty">Select text before choosing Keep a note to include it here.</p>'}</section>`;}
function openDialog(html,label='Reference'){
 if(!dialog.open){dialogOrigin=activationControl||document.activeElement;dialogPosition=capturePosition(main);const sel=window.getSelection();dialogSelection=sel?.rangeCount?sel.getRangeAt(0).cloneRange():null;history.pushState({writersDialog:true},'',location.href);openedWithHistory=true;}
 $('#dialog-label').textContent=label;content.innerHTML=html;dialog.showModal();document.body.classList.add('dialog-open');dialog.scrollTop=0;$('#close-dialog').focus({preventScroll:true});
}
function closeDialog(){if(openedWithHistory){history.back();}else finishClose();}
function finishClose(){if(!dialog.open)return;dialog.close();document.body.classList.remove('dialog-open');openedWithHistory=false;requestAnimationFrame(()=>{restorePosition(main,dialogPosition);if(dialogSelection){const sel=window.getSelection();sel.removeAllRanges();try{sel.addRange(dialogSelection);}catch{}}dialogOrigin?.focus({preventScroll:true});});}
window.addEventListener('popstate',()=>{if(dialog.open)finishClose();});
dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});$('#close-dialog').addEventListener('click',closeDialog);
let backdropStart=null;dialog.addEventListener('pointerdown',e=>{if(e.target===dialog)backdropStart={x:e.clientX,y:e.clientY};else backdropStart=null;});dialog.addEventListener('pointerup',e=>{const b=dialog.getBoundingClientRect();if(backdropStart&&e.target===dialog&&Math.hypot(e.clientX-backdropStart.x,e.clientY-backdropStart.y)<6&&(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom))closeDialog();backdropStart=null;});
function advice(id){const found=findAdvice(id);if(!found)return;const {a,i,s}=found;openDialog(`<h2 id="dialog-title">${esc(a.name)}<br><span>${esc(i.title)}</span></h2><p class="dialog-advice">${a.displayKind==='source-index'?'Read the complete rule at the source below.':esc(i.text)}</p><p class="small-label">${a.displayKind==='source-index'?'Topic index':'Editorial summary'} · selected list point ${i.number}</p>${i.context&&a.displayKind!=='source-index'?`<p>${esc(i.context)}</p>`:''}<dl class="source-details"><dt>Witness</dt><dd>${esc(s.title)}</dd><dt>Context</dt><dd>${esc(s.date||'Date not established')}${s.context?' · '+esc(s.context):''}</dd><dt>Location</dt><dd>${esc(i.locator)}</dd><dt>Evidence</dt><dd>${i.verification==='primary'?'Primary text inspected':'Attributed through the secondary list'}${s.limitation?' · '+esc(s.limitation):''}</dd></dl><p class="external-source">${sourceLink(s)}</p>${a.sources.find(x=>x.url.includes('openculture.com')&&x.id!==s.id)?`<p class="external-source">${sourceLink(a.sources.find(s=>s.url.includes('openculture.com')))}</p>`:''}`,'Advice & source');}
function sourceReference(id){const s=edition.authors.flatMap(a=>a.sources).find(s=>s.id===id);if(s)openDialog(`<h2 id="dialog-title">${esc(s.title)}</h2><p>${esc(s.context)}</p><p>${esc(s.limitation)}</p><p class="small-label">${esc(s.date)}</p><p class="external-source">${sourceLink(s)}</p>`,'Source reference');}
function authorSources(id){const a=edition.authors.find(a=>a.id===id);openDialog(`<h2 id="dialog-title">${esc(a.name)}: sources</h2>${a.sources.map(s=>`<section class="source-entry">${sourceLink(s)}<p>${esc(s.context)}</p><p class="small-label">${esc(s.date||'Undated')}. ${esc(s.limitation||'')}</p></section>`).join('')}`,'Sources');}
function sources(){if(!edition){openDialog('<h2 id="dialog-title">Edition unavailable</h2><p>Source details could not load. You can still download your notebook in Reading settings. Check your connection, then reload.</p>','Sources & edition');return;}openDialog(`<h2 id="dialog-title">How writers write</h2><p>This collection follows twelve writing-advice lists selected by Open Culture. It contains 105 short editorial summaries and ten linked topic cues for Margaret Atwood, with six comparative essays and six writing exercises. The scenes and worked revisions are original examples.</p><p>Source notes identify the work, its context, and the evidence inspected. Some points were checked in a primary text; others remain attributed through a later selection or recollection. A later interview may support a principle without confirming the earlier wording. Complete sources are linked; some require a subscription.</p><p>The summaries use the editor’s wording. The referenced works retain their own rights and are not licensed by the reader kit’s MIT license.</p><p>Notes, drafts, reading places, and text settings are saved in this browser. Download your notebook to keep a backup. Your writing is not sent to a model or service. Reading and external source links require a connection.</p><p class="small-label">Revision ${esc(edition.revision)} · Sources checked October 28, 2026; publication review November 2, 2026.</p><h3>Sources by writer</h3><div class="sources-list">${edition.authors.map(a=>`<button data-author-sources="${a.id}">${esc(a.name)}</button>`).join('')}</div>`,'About this edition');}
function settings(){openDialog(`<h2 id="dialog-title">Reading settings</h2><label class="size-label" for="text-size">Reading text: <output id="size-value">${state.size}</output> px</label><input id="text-size" type="range" min="16" max="32" step="2" value="${state.size}"><p>Applies to author readings, arguments, references and desk responses.</p><button data-action="quiet">${state.quiet?'Exit quiet reading':'Quiet reading'}</button><h3>Your notebook</h3><button data-action="export">Download notebook</button><button data-action="import">Recover a notebook</button>${rawDamaged?'<p>Your unreadable saved copy is still intact.</p><button data-action="damaged">Download unreadable copy</button><button data-action="fresh">Keep that copy and start fresh</button>':''}${storageBlocked&&!rawDamaged?'<p>Saving is paused. Download your current work, then reload to read the other tab’s changes. Recover your download to combine both copies.</p>':''}`,'Reading settings');$('#text-size').addEventListener('input',e=>{state.size=Number(e.target.value);$('#size-value').textContent=state.size;applySettings();persist();});}
function note(id){
 state.noteDrafts ||= {};
 const existing=state.notes.find(n=>n.id===id), sel=window.getSelection()?.toString()||'';
 const draft=state.noteDrafts[id]||existing||{id:crypto.randomUUID(),route,title:document.title.split(' · ')[0],quote:sel,text:'',created:new Date().toISOString()};
 state.noteDrafts[draft.id]={...draft};persist();
 openDialog(`<h2 id="dialog-title">Keep a note</h2>${draft.quote?`<blockquote class="note-quote">${esc(draft.quote)}</blockquote>`:''}<label for="note-text">Your note</label><textarea id="note-text" rows="7">${esc(draft.text)}</textarea><p class="small-label">${esc(draft.title)} · Closing keeps this unfinished note in Notebook.</p><button id="save-note" class="solid-link">Save note</button><p id="note-status" role="status"></p>`,'Notebook');
 $('#note-text').addEventListener('input',e=>{state.noteDrafts[draft.id]={...draft,text:e.target.value};persist();});
 $('#save-note').addEventListener('click',async()=>{const saved={...draft,text:$('#note-text').value};const pending={...state.noteDrafts};delete pending[draft.id];const next={...state,notes:[...state.notes.filter(n=>n.id!==saved.id),saved],noteDrafts:pending};if(await persist(next)){closeDialog();if(route==='#notebook')notebook();}else{state.noteDrafts[draft.id]=saved;$('#note-status').textContent='Not saved. Your text remains here. Download the notebook before closing this tab.';}});
}
function download(data,name,type='application/json'){const blob=new Blob([data],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function freshNotebook(){
 if(!navigator.locks){showStorage('Download the unreadable copy; this browser cannot safely reset it.');return;}
 try{await navigator.locks.request(STORE,async()=>{
  if(localStorage.getItem(STORE)!==rawDamaged)throw new Error('The saved copy changed in another tab. Reload before attempting recovery.');
  localStorage.setItem(STORE+'-damaged-'+Date.now(),rawDamaged);
  const fresh=blankState();localStorage.setItem(STORE,JSON.stringify(fresh));state=fresh;lastSaved=structuredClone(fresh);storageBlocked=false;rawDamaged='';dirty=false;$('#storage-error').hidden=true;applySettings();settings();
 });}catch(e){showStorage(e.message||'The original could not be preserved. Download it before continuing.');}
}
function exportNotebook(){download(JSON.stringify({format:'how-writers-work-notebook',edition:edition?.revision??null,exported:new Date().toISOString(),state},null,2),'how-writers-write-notebook.json');}
function importNotebook(){
 openDialog('<h2 id="dialog-title">Recover a notebook</h2><p>Notes are added without replacing your current notes. Different versions of the same experiment are kept as recovered notes.</p><label for="import-file">Choose your notebook download</label><input type="file" id="import-file" accept="application/json,.json"><p id="import-status" role="status"></p><div id="import-confirm"></div>','Notebook recovery');
 const input=$('#import-file'),status=$('#import-status'),confirm=$('#import-confirm');
 let selected=0;
 input.addEventListener('change',async e=>{
  const selection=++selected;confirm.innerHTML='';status.textContent='';
  try{
   const file=e.target.files[0];if(!file)return;
   if(file.size>6500000)throw new Error('This file is larger than 6 MB.');
   const data=JSON.parse(await file.text());
   if(selection!==selected||!input.isConnected)return;
   if(data.format!=='how-writers-work-notebook')throw new Error('Choose a How writers write notebook.');
   validateState(data.state);
   const preview=mergeState(state,data.state);
   status.textContent=`Ready to add ${preview.notes.length-state.notes.length} notes, retain ${Object.keys(preview.noteDrafts).length} unfinished ${Object.keys(preview.noteDrafts).length===1?'note':'notes'}, and recover available experiments.`;
   confirm.innerHTML='<button id="confirm-import">Add to this notebook</button>';
   confirm.onclick=async()=>{
    const button=confirm.querySelector('button');if(!button||button.disabled)return;
    button.disabled=true;
    try{
     // The preview may be old: merge at confirmation, then let the locked save detect later competing writes.
     if(await persist(mergeState(state,data.state))){
      if(status.isConnected){status.textContent='Recovered. Your existing notes are kept.';confirm.innerHTML='';}
      if(route==='#notebook')notebook();
     }else if(status.isConnected)status.textContent='Recovery could not be saved. Keep both downloads and retry when browser storage is available.';
    }catch(error){if(status.isConnected)status.textContent=error.message;}
    finally{if(button.isConnected)button.disabled=false;}
   };
  }catch(error){if(selection===selected&&status.isConnected){status.textContent=error.message;confirm.innerHTML='';}}
 });
}

document.addEventListener('click',e=>{
 const nav=e.target.closest('.topbar a[href^="#"]');
 if(!edition&&nav){e.preventDefault();if(location.hash===nav.hash)navigate();else location.hash=nav.hash;return;}
 const el=e.target.closest('button,a.text-ref');if(!el)return;
 if(el.matches('a.text-ref')){if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();}
 activationControl=el;
 try{
 if(el.dataset.advice)advice(el.dataset.advice);
 if(el.dataset.source)sourceReference(el.dataset.source);
 if(el.dataset.authorSources)authorSources(el.dataset.authorSources);
 if(el.dataset.editNote)note(el.dataset.editNote);
 if(el.hasAttribute('data-choice')){const m=edition.moments.find(m=>m.id===el.dataset.moment),i=Number(el.dataset.choice);state.choices[m.id]=i;persist();document.querySelectorAll('.choice').forEach((b,n)=>b.setAttribute('aria-pressed',n===i));$('#desk-result').innerHTML=result(m,i);bindDraft();}
 switch(el.dataset.action){case 'sources':sources();break;case 'note':note();break;case 'export':exportNotebook();break;case 'import':importNotebook();break;case 'quiet':setQuiet(!state.quiet);break;case 'damaged':download(rawDamaged,'unreadable-notebook.txt','text/plain');break;case 'fresh':freshNotebook();break;}
 }finally{activationControl=null;}
});
$('#settings').onclick=e=>{activationControl=e.currentTarget;try{settings();}finally{activationControl=null;}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&state.quiet&&!dialog.open){e.preventDefault();setQuiet(false);}});
$('.skip').addEventListener('click',e=>{e.preventDefault();main.focus();main.scrollIntoView();});
window.addEventListener('hashchange',()=>{if(dialog.open)finishClose();navigate();});
window.addEventListener('scroll',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(!dialog.open&&route){state.positions[route]=capturePosition(main);persist();}},300);},{passive:true});
try{const response=await fetch('./edition.json');if(!response.ok)throw new Error();edition=validateEdition(await response.json());navigate();}
catch{unavailableEdition();}
function unavailableEdition(){main.innerHTML='<section class="page"><h1>The reader could not load.</h1><p>Open Reading settings to download your notebook. Check your connection, then try again.</p><button id="retry">Try again</button></section>';$('#retry').onclick=()=>location.reload();}
