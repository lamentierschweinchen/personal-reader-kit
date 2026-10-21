import * as edition from './edition.mjs';
import {validateBook,validateState,newState,fromText,anchorStatus,visibleThrough,mergeBackup,passageAt,passagesOverlap,extendPassage,findOccurrences,sha256,LIMIT} from './core.mjs';
import {loadState,loadBooks,saveBook,updateState,rawState,rawBooks,removeBook,recoverState,recoveryArchives,librarySnapshot,restoreBundle} from './db.mjs';
import {createBundle,validateBundle,planBundleRestore,snapshotToken,canonical,BUNDLE_LIMIT} from './bundle.mjs';
import {renderText,readSelection,renderPassage} from './text.mjs';
import {passageShareData,sharePassage,copyPassage} from './share.mjs';
import {mountPassageCard} from './share-card.mjs';
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const amount=(number,label)=>`${number} ${label}${number===1?'':'s'}`;
const arrow = (direction='up-right') => `<svg class="ui-icon ui-icon--${direction}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#ui-arrow"></use></svg>`;
const main = $('#main'), dialog = $('#dialog');
let state = newState(), books = [], samples = [], route = {view:'shelf'}, activeBook, activeSection;
let selection, editing, selectionChoice, editingRangeChanged=false, dialogOrigin, restored = true, requestedPosition, pendingScroll, statusTimer;
let fixedPosition=null,fixedPositionY=0,reflowTimer;
let focusControls=false,focusPointer=null,focusTap=null,focusRecallPosition={x:0,y:0};
let experiment = 'walk', stop = 0, echo = 'room', offlineReady = false, storageError = false;
let reflectionDraft = null, reflectionBase = '', facingPair=null, facingId=null, fragments=[], contextPassages=[], recoveryCandidate=null, stateDamaged=false, bundleCandidate=null;
const sampleIds=new Set(['bell','rain']);
const SOURCE_NOTICE_PREFIX='war-and-peace-maude:source-notice:v1:';
const sourceNoticesSeen=new Set();let sourceNoticeStorageFailed=false;
function firstSourceNotice(){
  const book=bookById(edition.EDITION_ID),text=book?.context.filter(c=>c.kind==='source').flatMap(c=>c.text.split('\n\n')).find(p=>p.startsWith('This eBook is for the use of anyone'));
  if(!text)return '';const key=SOURCE_NOTICE_PREFIX+book.source.sha256;
  try{if(localStorage.getItem(key)==='shown')sourceNoticesSeen.add(key);}catch{}
  if(sourceNoticesSeen.has(key))return '';
  return `<aside id="first-source-notice" class="first-source-notice" data-notice-key="${esc(key)}" aria-label="Source notice"><p class="eyebrow">Source notice</p><p>${esc(text).replace('www.gutenberg.org','<a href="https://www.gutenberg.org/" target="_blank" rel="noopener noreferrer">www.gutenberg.org</a>')}</p><div class="source-notice-actions"><button class="text" data-action="source-notices">Full Project Gutenberg licence</button><button class="text" data-action="dismiss-source-notice">Dismiss notice</button></div></aside>`;
}
function rememberSourceNotice(){
  const notice=$('#first-source-notice'),key=notice?.dataset.noticeKey;
  if(key&&!sourceNoticesSeen.has(key)&&notice.getClientRects().length){
    sourceNoticesSeen.add(key);
    try{localStorage.setItem(key,'shown');if(localStorage.getItem(key)!=='shown')throw Error('Not saved');}
    catch{sourceNoticeStorageFailed=true;}
  }
  $('#source-notice-memory').hidden=!sourceNoticeStorageFailed;
}
const dirtyNote = () => dialog.open && editing && $('#note-text') && (editingRangeChanged || $('#note-text').value !== (editing.note || ''));
const dirtyReflection = () => reflectionDraft && reflectionDraft.text !== reflectionDraft.base;
const bookById = id => books.find(b => b.id === id);
const path = (book,section) => `#read/${encodeURIComponent(book)}/${encodeURIComponent(section)}`;
const returnLink = () => state.lastBook && bookById(state.lastBook) ? `<button class="text" data-action="resume" data-book="${esc(state.lastBook)}">Return to your book ${arrow()}</button>` : '';
function say(message) {clearTimeout(statusTimer);$('#status').textContent = message;statusTimer = setTimeout(() => {$('#status').textContent = '';},5000);}
function showWarning(message,storage=true) {if(storage)storageError=true;$('#storage-warning').hidden=false;$('#storage-warning').textContent=[$('#storage-warning').textContent,message].filter(Boolean).join(' ');}
function applyPrefs() {
  const p = state.prefs;document.documentElement.dataset.theme = p.theme;
  document.documentElement.style.setProperty('--size',`${p.size}px`);document.documentElement.style.setProperty('--leading',p.leading);
  document.documentElement.style.setProperty('--measure',p.measure === 'wide' ? '44rem' : '34rem');
  const focused=p.focus && route.view === 'read';document.body.classList.toggle('focus',focused);if(!focused)focusControls=false;$('#focus-tools').hidden=!(focused&&focusControls);$('#focus-exit').hidden=!focused;$('#focus-reveal').hidden=!focused||focusControls;$('#focus-reveal').setAttribute('aria-expanded',String(focusControls));main.toggleAttribute('aria-describedby',focused);if(focused)main.setAttribute('aria-describedby','focus-help');
}
async function commit(change) {const next = await updateState(change);state = next;applyPrefs();return next;}
function parseRoute() {
  try {const [view='shelf',book,section] = location.hash.slice(1).split('/').map(decodeURIComponent);return ['shelf','read','companion','passages'].includes(view) ? {view,book,section} : {view:'shelf'};}
  catch {return {view:'shelf'};}
}
function readingEdge() {return state.prefs.focus ? 12 : ($('.reader-tools')?.getBoundingClientRect().bottom || $('.masthead').getBoundingClientRect().height) + 20;}
function currentPosition() {
  if (route.view !== 'read' || !activeBook || !activeSection || !restored) return null;
  if(fixedPosition?.sectionId===activeSection.id&&Math.abs(scrollY-fixedPositionY)<2)return structuredClone(fixedPosition);
  fixedPosition=null;
  const nodes = [...main.querySelectorAll('.reading-surface [data-block]')], edge = readingEdge();
  const node = nodes.find(n => n.getBoundingClientRect().bottom > edge) || nodes.at(-1);
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  const result={sectionId:activeSection.id,blockId:scrollY < 5 ? null : node.dataset.block,ratio:scrollY < 5 ? 0 : Math.min(1,Math.max(0,(edge-rect.top)/Math.max(1,rect.height))),revision:activeBook.source.sha256};
  if(result.blockId){
    const range=document.createRange(),walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let part,offset=0;
    while((part=walker.nextNode())){
      if(!part.length)continue;
      const rectAt=start=>{range.setStart(part,start);range.setEnd(part,start+1);return range.getBoundingClientRect();};
      if(rectAt(part.length-1).bottom>edge){
        let low=0,high=part.length-1;
        while(low<high){const middle=Math.floor((low+high)/2);if(rectAt(middle).bottom>edge)high=middle;else low=middle+1;}
        const r=rectAt(low);if(r.height){result.character=offset+low;return result;}
      }
      offset+=part.length;
    }
  }
  return result;
}
async function savePosition() {
  clearTimeout(pendingScroll);if(dialog.open)return;const pos = currentPosition(), book = activeBook;
  if (!pos || !book) return;
  try {await commit(s => {s.positions[book.id] = pos;s.lastBook = book.id;return s;});}
  catch {if (!storageError) showWarning('Your reading position could not be saved. Keep this tab open; export your passages from Settings.');}
}
async function restorePosition(pos) {
  restored = false;
  $('#reading-text')?.setAttribute('data-position-ready','false');
  await document.fonts.ready;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const el = pos?.revision === activeBook?.source.sha256 && pos.sectionId === activeSection?.id && pos.blockId ? [...main.querySelectorAll('[data-block]')].find(x => x.dataset.block === pos.blockId) : null;
  if (el) {
    let characterRect=null;
    if(Number.isInteger(pos.character)&&pos.character>=0&&pos.character<el.textContent.length){
      const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let node,offset=pos.character;
      while((node=walker.nextNode())){if(offset<node.length){const r=document.createRange();r.setStart(node,offset);r.setEnd(node,offset+1);characterRect=r;break;}offset-=node.length;}
    }
    const rect = characterRect?.getBoundingClientRect()||el.getBoundingClientRect();scrollTo(0,Math.max(0,scrollY + rect.top + (characterRect?0:pos.ratio*rect.height) - readingEdge()));
    // Sticky controls may settle at a different height after the first movement.
    const settled=characterRect?.getBoundingClientRect()||el.getBoundingClientRect();scrollTo(0,Math.max(0,scrollY + settled.top + (characterRect?0:pos.ratio*settled.height) - readingEdge()));
  }
  else scrollTo(0,0);
  restored = true;
  fixedPosition=pos?.sectionId===activeSection?.id?structuredClone(pos):null;fixedPositionY=scrollY;
  $('#reading-text')?.setAttribute('data-position-ready','true');
}
function progressLabel(book) {
  const pos = state.positions[book.id];
  if (!pos || pos.revision !== book.source.sha256) return 'Not started';
  const index = book.sections.findIndex(s => s.id === pos.sectionId);
  return `Chapter ${Math.max(1,index+1)} of ${book.sections.length}`;
}
function shelf() {
  const book=bookById(edition.EDITION_ID);
  if(book)return edition.cover(book,state);
  return `<section class="page"><h1>War and Peace</h1><p class="loading">Opening the complete Maude translation…</p><p class="small">If it does not open, reload while the local preview is running. Your saved records have not been changed.</p><button class="text" data-action="import">Restore an exact edition</button></section>`;
}
function reader() {
  activeBook=bookById(route.book);
  if(!activeBook){route={view:'shelf'};return shelf();}
  const saved=state.positions[activeBook.id];
  activeSection=activeBook.sections.find(s=>s.id===route.section)||activeBook.sections.find(s=>s.id===saved?.sectionId&&saved?.revision===activeBook.source.sha256)||activeBook.sections[0];
  const i=activeBook.sections.indexOf(activeSection),previous=activeBook.sections[i-1],next=activeBook.sections[i+1];
  const group=edition.groupFor(activeSection.id),pictures=edition.apparatus.pictures.filter(p=>p.through===activeSection.id);
  return `<section class="reading"><div class="reader-tools"><div class="tool-group"><button data-action="contents">Contents</button><button data-action="at-hand">At hand</button></div><span class="progress-label">${i+1} / ${activeBook.sections.length}</span><button data-action="focus" aria-describedby="focus-help">Quiet ${arrow()}</button></div><header class="reader-heading"><p class="eyebrow">${esc(group?.title??activeBook.title)}</p><h1>${esc(edition.chapterHeading(activeSection))}</h1></header><article id="reading-text" data-book="${esc(activeBook.id)}" data-section="${esc(activeSection.id)}" class="reading-surface" lang="${esc(activeBook.language)}" aria-label="Book text"></article><div class="chapter-end">${pictures.length?`<div class="chapter-picture"><span class="small">From the 1893 album</span><button class="text" data-action="reveal-picture" data-picture="${pictures[0].id}">A picture for this chapter ${arrow()}</button></div>`:''}<nav class="chapter-links" aria-label="Chapters">${previous?`<a href="${path(activeBook.id,previous.id)}" data-section-start><span class="small">${arrow('left')} Previous</span><span class="nav-title">${esc(edition.chapterHeading(previous))}</span>${edition.groupFor(previous.id)!==group?`<span class="small">${esc(edition.groupFor(previous.id)?.title)}</span>`:''}</a>`:'<span></span>'}${next?`<a href="${path(activeBook.id,next.id)}" data-section-start><span class="small">Next ${arrow('right')}</span><span class="nav-title">${esc(edition.chapterHeading(next))}</span>${edition.groupFor(next.id)!==group?`<span class="small">${esc(edition.groupFor(next.id)?.title)}</span>`:''}</a>`:`<a href="#shelf">End of the novel ${arrow()}</a>`}</nav></div><p class="reader-hint">Select words to keep a passage.</p></section>`;
}
function passages() {
  return `<section class="page"><header class="page-head"><p class="eyebrow">Your marginalia</p><h1>Kept passages.</h1><p>Your passages and notes, stored in this browser.</p>${returnLink()}</header>${state.notes.length ? `<ul class="passage-list">${[...state.notes].sort((a,b)=>b.updated-a.updated).map(n => {
    const b = bookById(n.bookId), valid = anchorStatus(n,b);
    return `<li class="passage"><div class="passage-meta"><p class="eyebrow">${esc(b?.title || 'A personal book')}</p><span class="small">${esc(b?.sections.find(s=>s.id===n.sectionId)?.title || n.sectionId)}</span></div><div><blockquote>${esc(n.quote)}</blockquote>${n.note ? `<p class="passage-note">${esc(n.note)}</p>` : ''}${!valid.valid ? `<p class="recovery">${esc(valid.reason)}</p>` : ''}<div class="passage-actions">${valid.valid ? `<button class="text" data-action="note-context" data-note="${n.id}">Read in context ${arrow()}</button>` : ''}<button class="text" data-action="edit-note" data-note="${n.id}">Edit note</button></div></div></li>`;
  }).join('')}</ul>` : '<p class="empty">Select words in a book, then choose “Keep or share passage”.</p>'}${state.connections.map(c=>`<section class="saved-connection context-item"><p class="eyebrow">Your connection</p><div class="facing-pages">${c.passages.map(p=>`<div><p class="small">${esc(bookById(p.bookId)?.title||p.bookId)} · ${esc(p.sectionId)}</p>${fragment(p)}</div>`).join('')}</div><p class="passage-note">${esc(c.note)}</p></section>`).join('')}${Object.entries(state.reflections).filter(([k])=>k!=='prototype-choice').map(([key,text]) => `<div class="context-item"><p class="eyebrow">${key === 'facing-pages' ? 'Facing pages · your connection' : 'Preserved reflection'}</p><p class="passage-note">${esc(text)}</p></div>`).join('')}</section>`;
}
const stops = [
  {title:'A threshold',number:'01',prompt:'Listen for a sound whose source you cannot see.',book:'bell',section:'arrival',block:'bell-1',note:'Listen before looking. Then find what made the sound. Which details could you tell by ear?'},
  {title:'A crossing',number:'02',prompt:'Follow one moving thing until it passes the same point twice.',book:'bell',section:'crossing',block:'bell-6',note:'A leaf in an eddy, a swinging branch, a turning wheel: compare its motion with what moves past it.'},
  {title:'A return',number:'03',prompt:'Listen to the same sound from two distances.',book:'bell',section:'return',block:'bell-15',note:'At each distance, listen for the end of the sound as well as its beginning. Does the pause become easier to hear?'}
];
function allowed(bookId,sectionId) {const b = bookById(bookId);const index=b?.sections.findIndex(s=>s.id===sectionId);return b && index>=0 && index<=visibleThrough(state,b);}
function passageButton(book,section,block,label='Open the passage',passage=null) {const ref=passage&&allowed(book,section)?contextPassages.push(passage)-1:null;return allowed(book,section) ? `<button class="text" data-action="context" data-context-passage="${ref??''}" data-book="${book}" data-section="${section}" data-block="${block}">${esc(label)} ${arrow()}</button>` : '<p class="small">Passage hidden until you allow this section in Companion.</p>';}
function walk() {
  const s = stops[stop];
  return `<div class="experiment"><p class="eyebrow">01 / Reading with your feet</p><h2>A listening walk.</h2><p class="experiment-lead">Three invitations from a fictional town. Try them anywhere, or stay in your chair.</p><div class="walk-stage"><div class="walk-stops" role="group" aria-label="Listening stops">${stops.map((x,i)=>`<button data-action="stop" data-stop="${i}" aria-pressed="${i===stop}"><span>${x.number}</span>${x.title}</button>`).join('')}</div><div><p class="walk-prompt">${s.prompt}</p><p class="experiment-lead">${s.note}</p>${passageButton(s.book,s.section,s.block)}</div></div><p class="sample-notice">Fictional setting; no mapped route.</p></div>`;
}
function fragment(passage,hit) {
  const book=bookById(passage.bookId),valid=anchorStatus(passage,book);
  if(!valid.valid)return `<blockquote>${esc(passage.quote)}</blockquote><p class="recovery">${esc(valid.reason)}</p>`;
  const index=fragments.push({passage,book,hit})-1;
  return `<blockquote class="reading-surface fragment-surface" data-fragment="${index}" lang="${esc(book.language)}"></blockquote>`;
}
function echoes() {
  const {hits,count}=findOccurrences(books,state,echo);
  return `<div class="experiment"><p class="eyebrow">02 / A word changes rooms</p><h2>An echo index.</h2><form id="echo-form" class="echo-search"><label for="echo-term">Text to follow through your permitted sections</label><div><input id="echo-term" name="term" value="${esc(echo)}" maxlength="100" required><button type="submit" class="secondary">Find occurrences</button></div></form><p class="small">Exact spelling and capitalization; matches may occur within longer words. ${count} found${count>hits.length?`; showing the first ${hits.length}. Narrow the text to see others`:''}.</p>${hits.length?`<ol class="echo-list">${hits.map((h,i)=>{const p=h.passage,b=bookById(p.bookId),section=b.sections.find(s=>s.id===p.sectionId);return `<li><div><span class="eyebrow">${esc(b.title)}</span><span class="small">${esc(section.title)} · occurrence ${i+1}</span></div><div>${fragment(p,h)}${passageButton(b.id,section.id,p.segments[0].blockId,'Read around this occurrence',passageAt(b,section,section.blocks.find(x=>x.id===p.segments[0].blockId),h.offset,h.offset+echo.length))}</div></li>`;}).join('')}</ol>`:'<p class="empty">No matches in the sections you have allowed. Try different text or review your boundary.</p>'}</div>`;
}
function defaultPair() {
  return [{book:'bell',section:'crossing',block:'bell-8'},{book:'rain',section:'table',block:'rain-4'}].map(p=>{const b=bookById(p.book),s=b?.sections.find(s=>s.id===p.section),block=s?.blocks.find(b=>b.id===p.block);return block?passageAt(b,s,block):null;});
}
const pairKey=pair=>JSON.stringify(pair);
function facingChoices() {
  return [...defaultPair().filter(Boolean),...state.notes.map(({bookId,sectionId,revision,quote,segments})=>({bookId,sectionId,revision,quote,segments}))].filter(p=>allowed(p.bookId,p.sectionId)&&anchorStatus(p,bookById(p.bookId)).valid).filter((p,i,a)=>a.findIndex(other=>pairKey(other)===pairKey(p))===i);
}
function facing() {
  if(!facingPair||facingPair.every(p=>!p))facingPair=defaultPair();
  const existing=state.connections.find(c=>pairKey(c.passages)===pairKey(facingPair));
  if(!reflectionDraft){reflectionBase=existing?.note||'';facingId=existing?.id||null;}
  const choices=facingChoices(),ready=facingPair.every(p=>p&&allowed(p.bookId,p.sectionId)&&anchorStatus(p,bookById(p.bookId)).valid);
  return `<div class="experiment"><p class="eyebrow">03 / Two passages, a space between</p><h2>Facing pages.</h2><p class="small">Choose from your kept passages, or try the sample pair.</p><div class="facing-pages">${facingPair.map((p,i)=>{const b=p&&bookById(p.bookId);return `<div><label for="facing-${i}">${i===0?'Left':'Right'} passage</label><select id="facing-${i}" data-facing="${i}"><option value="">${b?esc(b.title):'Choose a kept passage'}</option>${choices.map((choice,j)=>`<option value="${j}" ${pairKey(choice)===pairKey(p)?'selected':''}>${esc(bookById(choice.bookId).title)} · ${esc(choice.quote.slice(0,70))}</option>`).join('')}</select>${p&&allowed(p.bookId,p.sectionId)?fragment(p):'<p class="empty">Allow this section, or choose a kept passage you have allowed.</p>'}${p?passageButton(p.bookId,p.sectionId,p.segments[0].blockId,'Read around it',p):''}</div>`;}).join('')}</div><div class="reflection"><label for="reflection">Your connection · or a reason to leave them apart</label><textarea id="reflection" maxlength="50000" aria-describedby="reflection-status" placeholder="What do you notice?">${esc(reflectionDraft?.text??reflectionBase)}</textarea><p id="reflection-status" class="small" role="status">${dirtyReflection()?'Unsaved draft · kept in this tab while you explore.':'Find saved connections in Passages.'}</p><button class="text" data-action="save-reflection" ${ready?'':'disabled'}>Keep this connection ${arrow()}</button> <button class="text" data-action="export-reflection">Export connection draft</button></div></div>`;
}
function companion() {
  const book=bookById(edition.EDITION_ID);
  return book?edition.gallery(book,state,visibleThrough(state,book)):shelf();
}
async function render({keepScroll=false}={}) {
  const y = scrollY;hideFocusControls();fragments=[];contextPassages=[];selection = null;$('#selection-save').hidden = true;
  main.innerHTML = route.view === 'read' ? reader() : route.view === 'passages' ? passages() : route.view === 'companion' ? companion() : shelf();
  main.insertAdjacentHTML('afterbegin',firstSourceNotice());rememberSourceNotice();
  document.querySelectorAll('[data-nav]').forEach(a => a.toggleAttribute('aria-current',false));
  document.querySelector(`[data-nav="${route.view==='read'?'shelf':route.view}"]`)?.setAttribute('aria-current','page');
  applyPrefs();document.title = route.view==='read' && activeBook ? `${activeBook.title} · ${activeSection.title}` : 'War and Peace · Leo Tolstoy';
  if (route.view === 'read') {
    const valid = state.notes.filter(n => n.sectionId === activeSection.id && anchorStatus(n,activeBook).valid);
    renderText($('#reading-text'),activeSection,valid);
    if (!keepScroll) {const pos = requestedPosition === null ? null : requestedPosition || state.positions[activeBook.id];requestedPosition = undefined;await restorePosition(pos);}
    $('#reading-text').dataset.positionReady='true';
  }
  for(const node of main.querySelectorAll('[data-fragment]')){const f=fragments[Number(node.dataset.fragment)];renderPassage(node,f.passage,f.book,f.hit);}
  if (keepScroll) scrollTo(0,y);else if(route.view!=='read') scrollTo(0,0);
}
let disposePassageCard=()=>{};
function openDialog(title,html) {
  dialog.classList.remove('picture-dialog');
  disposePassageCard();disposePassageCard=()=>{};
  if (!dialog.open) {const position=currentPosition();void savePosition();dialogOrigin = {element:document.activeElement,scroll:scrollY,position};}
  $('#dialog-content').innerHTML = `<div class="dialog-inner"><header class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2><button class="close-dialog" data-action="close">Close</button></header>${html}<p id="dialog-error" class="dialog-error" role="alert"></p></div>`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop=0;
  $('#selection-save').hidden = true;
}
function finishDialog() {
  dialog.classList.remove('picture-dialog');
  disposePassageCard();disposePassageCard=()=>{};
  const origin=dialogOrigin;dialogOrigin=null;
  if(origin?.element?.isConnected)origin.element.focus({preventScroll:true});
  if(origin?.position&&route.view==='read')void restorePosition(origin.position);else if(origin)scrollTo(0,origin.scroll);
  editing=null;selection=null;selectionChoice=null;editingRangeChanged=false;bundleCandidate=null;
}
function closeDialog(saved=false) {
  if (!saved && dirtyNote() && !confirm('Discard this unsaved note? Choose Cancel to keep editing or export the draft.')) return false;
  dialog.close();getSelection()?.removeAllRanges();finishDialog();return true;
}
dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
dialog.addEventListener('close',()=>{if(!dialog.open&&dialogOrigin)finishDialog();});
function fail(error) {if(dialog.open && $('#dialog-error')) $('#dialog-error').textContent=error.message || 'Could not save on this device. Your draft is still here.';else say(error.message || 'This action could not be saved.');}
function download(value,name,compact=false) {const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,compact?undefined:2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);}
function settings() {
  const p=state.prefs;
  openDialog('Reading settings',`<p class="small">Type size and spacing apply to books, passage context, quotations, notes and companion readings. Navigation labels stay compact.</p><div class="settings-presets"><button data-action="preset" data-preset="paper">Paper</button><button data-action="preset" data-preset="dusk">Dusk</button><button data-action="preset" data-preset="large">Large print</button></div><form id="settings-form"><label for="size">Type size · <output id="size-value">${p.size}</output> px</label><input id="size" name="size" type="range" min="17" max="36" value="${p.size}"><label for="leading">Line spacing</label><input id="leading" name="leading" type="range" min="1.3" max="2.2" step="0.1" value="${p.leading}"><div class="form-row"><div><label for="theme">Page</label><select id="theme" name="theme">${['paper','dusk','ink'].map(t=>`<option value="${t}" ${p.theme===t?'selected':''}>${t[0].toUpperCase()+t.slice(1)}</option>`).join('')}</select></div><div><label for="measure">Line length</label><select id="measure" name="measure"><option value="book" ${p.measure==='book'?'selected':''}>Book</option><option value="wide" ${p.measure==='wide'?'selected':''}>Wide</option></select></div></div><div class="dialog-actions"><button class="primary" type="submit">Apply to my reader</button></div></form><div class="settings-group"><h3>Take your reading with you.</h3><p>One private file can carry exact editions, saved passages, connections and reading places to another browser or address. It contains full books and notes, without encryption. Keep it somewhere private.</p><button class="text" data-action="bundle-export">Export a private reading bundle</button><label for="bundle-file">Restore a reading bundle</label><input id="bundle-file" type="file" accept=".json"><p class="small">Review what will be added before saving. The text bundle does not include the picture companion or fonts; keep a copy of this reader project too. Unsaved drafts and damaged recovery records use their separate exports.</p></div><div class="settings-group"><h3>Separate record backups.</h3><p>Export includes quotations and personal notes. Keep the file private. Book files are not included. For another device or site address, also export your exact editions below.</p><button class="text" data-action="export">Export passages & progress ${arrow()}</button><label for="restore-file">Restore a backup</label><input id="restore-file" type="file" accept=".json"><p>Restore adds missing passages and preserves conflicting edits as separate notes. It keeps this device’s progress, appearance and spoiler boundaries.</p></div><div class="settings-group"><h3>On this device.</h3><p id="offline-detail">${offlineReady ? 'The complete novel, pictures and reading fonts have been checked in the offline cache.' : 'The offline application copy is not verified yet. Reconnect and check again.'} Imported books and notes use browser storage. Storage can be cleared or evicted; keep your originals and exported notes.</p><button class="text" data-action="persist">Ask browser to retain local storage</button><button class="text" data-action="check-offline">Check offline copy</button></div>`);
  const migration=document.createElement('section');migration.className='settings-group';
  migration.innerHTML=`<h3>Move to another device or address.</h3><p>Your library belongs to <strong>${esc(location.origin)}</strong> in this browser. A new domain, preview URL or browser starts with a separate library.</p><p>Export a private reading bundle above, restore it at the new address, and verify quotations and reading places before retiring this address. Separate edition and record exports remain available below. Re-converting an EPUB or PDF may produce different anchors. These downloads contain full books; keep them private.</p>${books.filter(b=>!sampleIds.has(b.id)).map(b=>`<button class="text" data-action="export-edition" data-book="${esc(b.id)}">Export exact edition: ${esc(b.title)}</button>`).join('')||'<p class="small">No personal editions on this device yet.</p>'}<p class="small">Future software served at this address can read its local books. Use a host and update process you trust.</p><button class="text" data-action="raw-export">Export original recovery data</button>${stateDamaged?'<button class="secondary" data-action="repair">Repair unreadable state</button>':''}`;
  dialog.querySelector('.dialog-inner').append(migration);
  if(storageError) {
    const explanation=document.createElement('p');explanation.textContent='Raw recovery includes full local books and notes, including damaged records. Keep it private; ask your agent to repair it before restoring.';
    dialog.querySelector('[data-action="raw-export"]')?.before(explanation);
  }
}
function bundleBooks(local) {
  const result=[...local];
  for(const sample of samples){const local=result.find(b=>b.id===sample.id);if(local&&sampleIds.has(sample.id)&&canonical(local)!==canonical(sample))throw new Error('A stored demonstration ID has different edition content. Export original recovery data and review it before bundling.');if(!local)result.push(sample);}
  return result;
}
async function bundleExportDialog() {
  await savePosition();const snapshot=await librarySnapshot(),available=bundleBooks(snapshot.books);
  openDialog('Pack your reading.',`<p>Choose the exact editions to include. <strong>All saved records are included</strong>, even quotations from unchecked books. This file is private and unencrypted.</p><form id="bundle-export-form"><fieldset><legend>Full editions</legend>${available.map(b=>`<label class="bundle-choice"><input name="edition" type="checkbox" value="${esc(b.id)}" checked><span>${esc(b.title)}<span class="small"> · ${esc(b.author)}</span></span></label>`).join('')||'<p>No editions available. You can still export saved records.</p>'}</fieldset><p class="small">Up to 64 MB and 200 editions per file. Unsaved drafts, damaged records and recovery archives use their separate exports. Nothing is uploaded.</p><button class="primary" type="submit">Download private bundle</button></form>`);
}
function recoveryDialog() {
  recoveryCandidate=null;
  openDialog('Recover your reading records.',`<p>Your current saved state is unreadable. Export recovery data first if you have not already. Repair saves the damaged object in a separate recovery archive, keeps all local books, and replaces only the reader state with a validated backup.</p><button class="text" data-action="raw-export">Export original recovery data</button><label for="repair-file">A valid passages & progress backup</label><input id="repair-file" type="file" accept=".json"><p id="repair-preview" role="status">Choose a backup to review before applying it. If you have none, retain the raw export and ask your agent to recover its records into a valid backup.</p><button id="repair-apply" class="primary" data-action="repair-apply" disabled>Archive damaged state and apply backup</button>`);
}
function importDialog() {
  openDialog('Bring a book.',`<p>Choose a UTF-8 text file or a prepared reader JSON file. It stays in this browser.</p><p class="preset-note">Import only material you’re entitled to use. Owning a copy does not give permission to publish it.</p><form id="import-form"><label for="book-file">Book file · up to 8 MB</label><input id="book-file" name="file" type="file" accept=".txt,.json" required><label for="book-title">Title for a text file</label><input id="book-title" name="title" maxlength="500" placeholder="Use the file name"><label for="book-form">Text layout</label><select id="book-form" name="kind"><option value="prose">Prose · keep supplied line breaks</option><option value="verse">Poetry · keep lines, stanzas and indentation</option></select><p class="preset-note">EPUB and PDF need your agent’s conversion first. Ask it to check DRM, source quality, emphasis, notes and poetry layout. Scans need local OCR and review; protected ebooks may not be importable.</p><div class="dialog-actions"><button class="primary" type="submit">Add on this device ${arrow()}</button></div></form>`);
}
function noteDialog(note,rangeChanged=false) {
  editing = structuredClone(note);editingRangeChanged=rangeChanged;
  const book=bookById(note.bookId),valid=anchorStatus(note,book).valid;
  const sharing=valid?`<section class="passage-sharing" aria-label="Share the quotation"><p class="small">${esc(book.author)} · ${esc(book.title)}<br>${esc(book.sections.find(s=>s.id===note.sectionId).title)}${book.edition?`<br>${esc(book.edition)}`:''}</p><div class="dialog-actions"><button type="button" class="text" data-action="share-passage">Share passage</button><button type="button" class="text" data-action="copy-passage">Copy passage</button></div><p class="small" id="share-status" role="status">Quotation and source attribution only. Your note stays private.</p><div id="share-fallback" hidden><label for="share-text">Passage with attribution · select to copy</label><textarea id="share-text" readonly rows="7" spellcheck="false"></textarea></div></section>`:'<p class="small">Restore the exact edition to share this passage with attribution. Your saved quotation remains available.</p>';
  openDialog(note.id ? 'Your kept passage.' : 'Keep this passage.',`<blockquote class="dialog-quote">${esc(note.quote)}</blockquote>${sharing}<form id="note-form"><label for="note-text">Your note · optional</label><textarea id="note-text" maxlength="50000" placeholder="Add a note…">${esc(note.note||'')}</textarea><div class="dialog-actions"><button class="primary" type="submit">Save on this device</button>${note.id ? '<button type="button" class="text" data-action="delete-note">Remove passage</button>' : ''}<button type="button" class="text" data-action="export-draft">Export draft</button></div></form>`);
  if(valid)disposePassageCard=mountPassageCard(dialog.querySelector('.passage-sharing'),note,book);
  $('#dialog-title').tabIndex=-1;$('#dialog-title').focus({preventScroll:true});
}
async function sendPassage(action) {
  const data=passageShareData(editing,bookById(editing.bookId)),status=$('#share-status'),fallback=$('#share-fallback'),field=$('#share-text');
  const controls=[...dialog.querySelectorAll('[data-action="share-passage"],[data-action="copy-passage"]')];
  controls.forEach(button=>button.disabled=true);
  try {
    const result=action==='share-passage'?await sharePassage(data):await copyPassage(data);
    if(!status.isConnected)return;
    fallback.hidden=true;
    if(action==='share-passage') {
      status.textContent=result==='opened'?'Share menu opened. Delivery depends on the app you choose.':result==='cancelled'?'Share dismissed. Your passage and note are unchanged.':'Sharing is unavailable here. Use Copy passage, or select the text below.';
      if(result!=='unavailable')return;
    }else {
      status.textContent=result?'Passage and attribution copied. Your note was not included.':'Automatic copy is unavailable. Select and copy the text below.';
      if(result)return;
    }
    fallback.hidden=false;field.value=data.text;field.focus();field.select();
  }finally{controls.forEach(button=>{if(button.isConnected)button.disabled=false;});}
}
function beginSelection(passage) {
  const matches=state.notes.filter(n=>anchorStatus(n,activeBook).valid&&passagesOverlap(n,passage));
  if(!matches.length){noteDialog(passage);return;}
  selectionChoice={passage:structuredClone(passage),notes:structuredClone(matches)};
  openDialog('Keep your selection.',`<p>Your selected words overlap ${matches.length===1?'a kept passage':'kept passages'}. Choose how to keep them.</p><blockquote class="dialog-quote">${esc(passage.quote)}</blockquote><button class="primary" data-action="selection-new">Keep as a new passage</button>${matches.map((n,i)=>`<section class="context-item"><p class="eyebrow">Existing passage ${i+1}</p><blockquote class="dialog-quote">${esc(n.quote)}</blockquote>${n.note?`<p class="passage-note">${esc(n.note)}</p>`:''}<div class="dialog-actions"><button class="text" data-action="selection-extend" data-choice="${i}">Extend this passage</button><button class="text" data-action="selection-edit" data-choice="${i}">Edit existing note</button></div></section>`).join('')}<p class="small">Extending keeps the existing note and all words in either range. Nothing changes until you save.</p>`);
}
async function context(bookId,sectionId,blockId,note) {
  const book=bookById(bookId),section=book?.sections.find(s=>s.id===sectionId);if(!section)throw new Error('This passage is no longer available.');
  openDialog(section.title,`<p class="eyebrow">${esc(book.title)} · passage context</p><p class="small">Your main reading place stays where you left it.</p><div class="context-reading"><article id="context-text" data-book="${esc(book.id)}" data-section="${esc(section.id)}" class="reading-surface" lang="${esc(book.language)}" aria-label="Passage context"></article></div>`);
  const container=$('#context-text');renderText(container,section,note?[note]:[]);
  await locateContext(container,note,blockId);
}
async function locateContext(container,note,blockId=note?.segments[0]?.blockId) {
  await document.fonts.ready;
  await Promise.allSettled(dialog.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a=>a.finished));
  await new Promise(resolve=>requestAnimationFrame(resolve));
  if(!dialog.open||$('#context-text')!==container)return;
  const block=[...container.querySelectorAll('[data-block]')].find(x=>x.dataset.block===blockId);
  const marks=note?[...container.querySelectorAll('mark')].filter(x=>x.dataset.note===note.id):[];
  const first=marks[0]||block,last=marks.at(-1)||first;if(!first)return;
  const range=document.createRange();range.setStart(first,0);range.setEnd(last,last.childNodes.length);
  let rectangles=[...range.getClientRects()].filter(r=>r.width&&r.height);if(!rectangles.length)return;
  const fixed=first.closest('.fixed-lines');
  if(fixed&&fixed.scrollWidth>fixed.clientWidth){fixed.scrollLeft+=rectangles[0].left-fixed.getBoundingClientRect().left-12;rectangles=[...range.getClientRects()].filter(r=>r.width&&r.height);}
  const viewport=dialog.getBoundingClientRect(),header=dialog.querySelector('.dialog-header'),headerStyle=getComputedStyle(header);
  const top=Math.max(0,viewport.top+dialog.clientTop,['sticky','fixed'].includes(headerStyle.position)?header.getBoundingClientRect().bottom:0),bottom=Math.min(innerHeight,viewport.bottom-dialog.clientTop);
  const rangeHeight=Math.max(...rectangles.map(r=>r.bottom))-rectangles[0].top,padding=Math.max(0,Math.min(16,(bottom-top-rangeHeight)/2));
  dialog.scrollTop+=rectangles[0].top-top-padding;
  container.dataset.locationReady='true';
}
function showContents(book,current){
  activeBook=book;
  openDialog('Contents',edition.contents(book,current));
}
function showEditionAbout(){
  const book=bookById(edition.EDITION_ID);
  openDialog('Text & pictures',edition.aboutHTML());
  const notices=$('#source-notices');
  if(notices)notices.textContent=book?.context.filter(n=>n.kind==='source').map(n=>n.text).join('\n\n')||'Restore the exact edition to read its source notices.';
}
function showPicture(id){
  const p=edition.pictureById(id),book=bookById(edition.EDITION_ID);
  if(!p)throw new Error('This picture is unavailable.');
  if(p.through&&!allowed(book.id,p.through))throw new Error('Choose the chapters you have read before opening this scene.');
  openDialog(p.title,edition.pictureHTML(p,book));
  dialog.classList.add('picture-dialog');
}
function atHand(){
  const i=activeBook.sections.indexOf(activeSection),names=(edition.apparatus.names??[]).filter(n=>activeBook.sections.findIndex(s=>s.id===n.through)<=i);
  const picture=edition.apparatus.pictures.find(p=>p.through===activeSection.id);
  openDialog('At hand',`<div class="at-hand">${picture?`<p class="small">This chapter has an illustration in the 1893 album.</p><button class="text" data-action="reveal-picture" data-picture="${picture.id}">Open this chapter’s picture</button>`:''}<details open><summary>Names from the opening</summary><dl class="names-list">${names.map(n=>`<div><dt>${esc(n.name)}</dt><dd>${esc(n.text)}</dd></div>`).join('')}</dl></details><details><summary>French, accents & dates</summary>${(edition.apparatus.readingNotes??[]).map(p=>`<p class="companion-reading">${esc(p)}</p>`).join('')}${(edition.apparatus.readingNoteSources??[]).map(n=>`<p class="small"><a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">${esc(n.label)}</a></p>`).join('')}</details><button class="text" data-action="edition-about">Text & pictures · sources</button></div>`);
}
function pictureChapterOptions(groupId,selected){
  const group=edition.structure.groups.find(g=>g.id===groupId),book=bookById(edition.EDITION_ID);
  return (group?.sections||[]).map(id=>`<option value="${book.sections.findIndex(s=>s.id===id)}" ${id===selected?'selected':''}>${esc(edition.chapterHeading(book.sections.find(s=>s.id===id)))}</option>`).join('');
}
function boundaries() {
  const book=bookById(edition.EDITION_ID),through=visibleThrough(state,book),position=state.positions[book.id];
  const chosen=state.boundaries[book.id]?.revision===book.source.sha256;
  const selected=chosen?(through>=0?book.sections[through]?.id:null):position?.revision===book.source.sha256?position.sectionId:null;
  const group=edition.groupFor(selected);
  openDialog('Pictures through…',`<p class="small">Choose the last chapter you have read. The pictures and captions may show anything through that chapter. Your reading place stays where it is.</p><form id="boundaries-form"><div class="form-row"><div><label for="picture-book">Book</label><select id="picture-book"><option value="none" ${group?'':'selected'}>None yet</option>${edition.structure.groups.map(g=>`<option value="${g.id}" ${g.id===group?.id?'selected':''}>${esc(g.title)}</option>`).join('')}</select></div><div><label for="picture-chapter">Chapter</label><select id="picture-chapter" name="${book.id}" ${group?'':'disabled'}>${group?pictureChapterOptions(group.id,selected):'<option value="-1">None yet</option>'}</select></div></div><div class="dialog-actions"><button class="primary" type="submit">Show pictures</button></div></form><div class="settings-group"><p class="small">The complete album includes later scenes.</p><button class="text" data-action="all-pictures">Show all pictures</button></div>`);
}
async function setPictureBoundary(index){
  const book=bookById(edition.EDITION_ID);
  await commit(s=>{s.boundaries[book.id]={index,revision:book.source.sha256};return s;});closeDialog();await render({keepScroll:true});say('Pictures updated.');
}

// Display copy is separate from immutable sample editions so old full-book
// bundles remain byte-compatible. Personal/imported contexts are not rewritten.
const sampleContextCopy={
  bell:{revision:'29cd14b715090846f13c849cccae225fb1e4c0a416ce6b0a2572c4323d9c5dfd',edition:'aa76278f65b35cddd62fcb23ba77f538285a78fe48e097e40c7f6feba7179cba',texts:[
    'An original travel miniature in four movements. Its town and route are fictional.',
    'Created with an AI assistant for this kit. The sample writing is free to reuse under the MIT license.',
    'The map shows the station and harbour but leaves out the doorway and the woman with jars. Compare those omissions with the room’s shifting tree shadow: what can each way of marking a place record?'
  ]},
  rain:{revision:'fe4603287eb45aa5db5f9d8d411e164d2baa2781a2fdc0fb053fd2a90507a235',edition:'01b74ea887bd5d81d1bb864c4e28385a7851eabf526056d72e44d147bc1de16a',texts:[
    'Three original fragments about a window, a table and leaving a room. Created with an AI assistant for this kit; free to reuse under the MIT license.'
  ]}
};
const reviewedSampleCopy=new WeakSet();
async function prepareSampleCopy(){
  for(const book of samples){
    const copy=sampleContextCopy[book.id];
    if(!copy||copy.revision!==book.source.sha256)continue;
    try{if(await sha256(new TextEncoder().encode(canonical(book)))===copy.edition)reviewedSampleCopy.add(book);}catch{/* Retain supplied context if verification is unavailable. */}
  }
}
function backgroundText(book,context){
  const copy=sampleContextCopy[book.id];
  return reviewedSampleCopy.has(book)&&copy?.revision===book.source.sha256 ? copy.texts[book.context.indexOf(context)]??context.text : context.text;
}
function background() {
  const b=activeBook, visible=b.context.filter(c=>c.through===null||allowed(b.id,c.through));
  openDialog('About this work.',`<p class="eyebrow">${esc(b.title)}</p><p class="small">${esc(b.edition)}</p>${visible.map(c=>`<section class="context-item"><p class="eyebrow">${c.kind==='editorial'?'Editorial interpretation':c.kind==='source'?'Sourced background':'Sample provenance'}</p><h3>${esc(c.label)}</h3><p class="companion-reading">${esc(backgroundText(b,c))}</p>${c.url?`<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Source</a>`:''}</section>`).join('')}<div class="context-item"><p class="eyebrow">Edition record</p><p class="small">${esc(b.source.description)}</p><p class="small">Edition fingerprint: ${b.source.sha256.slice(0,16)}…</p></div>`);
}
async function offline() {
  try {
    if(!navigator.serviceWorker)throw new Error('Unavailable');
    const registration=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
    await navigator.serviceWorker.ready;
    const worker=registration.active;if(!worker)throw new Error('Still saving');
    const result=await new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(new Error('Offline check timed out.')),4000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};worker.postMessage('CHECK_OFFLINE',[channel.port2]);});
    offlineReady=result.ready;$('#offline-status').textContent=offlineReady?'Available offline':'Offline copy incomplete';
  } catch {offlineReady=false;$('#offline-status').textContent='Offline copy not verified';}
}
async function act(target) {
  const action=target.dataset.action;
  switch(action) {
    case 'dismiss-source-notice':{const position=currentPosition();$('#first-source-notice')?.remove();main.focus({preventScroll:true});if(position)await restorePosition(position);break;}
    case 'source-notices':{showEditionAbout();$('#source-notices').closest('details').open=true;$('#source-notices').scrollIntoView({block:'start'});break;}
    case 'close':closeDialog();break;
    case 'settings':await savePosition();settings();break;
    case 'import':await savePosition();importDialog();break;
    case 'offline':await savePosition();settings();break;
    case 'background':background();break;
    case 'boundaries':boundaries();break;
    case 'all-pictures':await setPictureBoundary(bookById(edition.EDITION_ID).sections.length-1);break;
    case 'resume': {
      const b=bookById(target.dataset.book);if(!b)return;
      await savePosition();const pos=state.positions[b.id], section=b.sections.find(s=>s.id===pos?.sectionId&&pos?.revision===b.source.sha256)||b.sections[0];
      requestedPosition=pos;const hash=path(b.id,section.id);if(location.hash===hash){route=parseRoute();await render();}else location.hash=hash;break;
    }
    case 'focus': {main.dataset.focusReady='false';const pos=currentPosition();await commit(s=>{s.prefs.focus=!s.prefs.focus;return s;});hideFocusControls();await restorePosition(pos);if(state.prefs.focus)main.focus({preventScroll:true});else main.querySelector('[data-action="focus"]')?.focus({preventScroll:true});main.dataset.focusReady='true';break;}
    case 'focus-reveal':showFocusControls(true);break;
    case 'focus-hide':hideFocusControls(true);break;
    case 'contents':showContents(activeBook,activeSection?.id);break;
    case 'contents-home':showContents(bookById(edition.EDITION_ID),state.positions[edition.EDITION_ID]?.sectionId);break;
    case 'edition-about':showEditionAbout();break;
    case 'at-hand':atHand();break;
    case 'picture':showPicture(target.dataset.picture);break;
    case 'reveal-picture':{
      const book=bookById(edition.EDITION_ID),p=edition.pictureById(target.dataset.picture),i=book.sections.findIndex(s=>s.id===p?.through);
      if(i<=visibleThrough(state,book)){showPicture(p.id);break;}
      openDialog('Open this chapter’s picture?',`<p class="companion-reading">The picture and caption show a scene from ${esc(edition.chapterLabel(book,p.through))}.</p><button class="primary" data-action="allow-picture" data-picture="${p.id}">I’ve read this chapter · show the picture</button>`);break;
    }
    case 'allow-picture':{
      const book=bookById(edition.EDITION_ID),p=edition.pictureById(target.dataset.picture),index=book.sections.findIndex(s=>s.id===p.through);
      await commit(s=>{s.boundaries[book.id]={index:Math.max(index,visibleThrough(s,book)),revision:book.source.sha256};return s;});showPicture(p.id);break;
    }
    case 'picture-context':{
      const book=bookById(edition.EDITION_ID),p=edition.pictureById(target.dataset.picture);
      if(!p||!allowed(book.id,p.through))throw new Error('Choose the chapters you have read before opening this scene.');
      const section=book.sections.find(s=>s.id===p.through);
      openDialog(edition.chapterLabel(book,section.id),`<article id="context-text" class="reading-surface context-reading"></article>`);
      const back=document.createElement('button');back.className='picture-back';back.dataset.action='picture';back.dataset.picture=p.id;back.setAttribute('aria-label','Back to the picture');back.innerHTML=`${arrow('left')} Picture`;dialog.querySelector('.dialog-header').prepend(back);
      const container=$('#context-text');renderText(container,section);const block=section.blocks.find(b=>b.id===p.block)||section.blocks[0];await locateContext(container,passageAt(book,section,block));break;
    }
    case 'picture-zoom':{
      const viewport=dialog.querySelector('.picture-viewport');if(viewport){viewport.classList.add('enlarged');viewport.focus({preventScroll:true});dialog.querySelector('[data-action="picture-zoom"]').setAttribute('aria-pressed','true');dialog.querySelector('[data-action="picture-fit"]').setAttribute('aria-pressed','false');dialog.querySelector('.picture-toolbar .small').hidden=false;}break;
    }
    case 'picture-fit':{
      const viewport=dialog.querySelector('.picture-viewport');if(viewport){viewport.classList.remove('enlarged');viewport.scrollTo(0,0);dialog.querySelector('[data-action="picture-zoom"]').setAttribute('aria-pressed','false');dialog.querySelector('[data-action="picture-fit"]').setAttribute('aria-pressed','true');dialog.querySelector('.picture-toolbar .small').hidden=true;}break;
    }
    case 'boundary':boundaries();break;
    case 'experiment':experiment=target.dataset.experiment;await render({keepScroll:true});break;
    case 'stop':stop=Number(target.dataset.stop);await render({keepScroll:true});break;
    case 'echo':echo=target.dataset.word;await render({keepScroll:true});break;
    case 'choose-prototype':await commit(s=>{s.reflections['prototype-choice']=experiment;return s;});await render({keepScroll:true});say('Preference kept. Tell your agent what drew you to this direction.');break;
    case 'save-reflection': {
      if(!facingPair.every(p=>p&&allowed(p.bookId,p.sectionId)&&anchorStatus(p,bookById(p.bookId)).valid))throw new Error('Choose two permitted, available passages first. Your draft remains here.');
      const text=$('#reflection').value,base=reflectionDraft?.base??reflectionBase,id=facingId||crypto.randomUUID(),passages=structuredClone(facingPair);
      await commit(s=>{const current=s.connections.find(c=>c.id===facingId)||s.connections.find(c=>pairKey(c.passages)===pairKey(passages));if((current?.note||'')!==base&&(current?.note||'')!==text)throw new Error('This connection changed in another tab. Your draft is still here; export it before reloading the saved version.');const record={id:current?.id||id,passages,note:text,updated:Date.now()};s.connections=[...s.connections.filter(c=>c.id!==record.id),record];facingId=record.id;return s;});
      reflectionDraft=null;reflectionBase=text;$('#reflection-status').textContent='Connection saved on this device.';say('Connection saved on this device.');break;
    }
    case 'export-reflection': {
      const backup=newState(),passages=reflectionDraft?.passages||(facingPair.every(p=>p&&allowed(p.bookId,p.sectionId)&&anchorStatus(p,bookById(p.bookId)).valid)?facingPair:null);
      if(passages)backup.connections=[{id:facingId||crypto.randomUUID(),passages:structuredClone(passages),note:$('#reflection').value,updated:Date.now()}];
      else backup.reflections['facing-pages']=$('#reflection').value; // Export the draft without revealing a locked default pair.
      download(backup,'private-connection.reader-backup.json');break;
    }
    case 'context': {if(!allowed(target.dataset.book,target.dataset.section))throw new Error('Allow this section in Companion first.');const passage=target.dataset.contextPassage===''?null:contextPassages[Number(target.dataset.contextPassage)];if(passage&&!anchorStatus(passage,bookById(passage.bookId)).valid)throw new Error('This source range has changed.');await context(target.dataset.book,target.dataset.section,target.dataset.block,passage?{...passage,id:'context-passage'}:null);break;}
    case 'note-context': {const note=state.notes.find(n=>n.id===target.dataset.note);if(note&&anchorStatus(note,bookById(note.bookId)).valid)await context(note.bookId,note.sectionId,note.segments[0].blockId,note);break;}
    case 'selection-new': {if(selectionChoice)noteDialog(selectionChoice.passage);break;}
    case 'selection-extend': {if(!selectionChoice)break;const old=selectionChoice.notes[Number(target.dataset.choice)];if(old)noteDialog({...old,...extendPassage(old,selectionChoice.passage,bookById(old.bookId))},true);break;}
    case 'selection-edit': {const old=selectionChoice?.notes[Number(target.dataset.choice)];if(old)noteDialog(old);break;}
    case 'edit-note': {const n=state.notes.find(n=>n.id===target.dataset.note);if(n)noteDialog(n);break;}
    case 'share-passage':case 'copy-passage':await sendPassage(action);break;
    case 'delete-note': {
      if(!confirm('Remove this passage and its note from this device?'))return;const snapshot=editing;
      await commit(s=>{const current=s.notes.find(n=>n.id===snapshot.id);if(current&&current.updated!==snapshot.updated)throw new Error('This note changed in another tab. Your draft is still here; export it before reopening the current note.');s.notes=s.notes.filter(n=>n.id!==snapshot.id);return s;});closeDialog(true);await render({keepScroll:true});break;
    }
    case 'export-draft': {const backup=newState();backup.notes=[{...editing,id:editing.id||crypto.randomUUID(),updated:Date.now(),note:$('#note-text').value}];download(backup,'private-draft.reader-backup.json');break;}
    case 'bundle-export':await bundleExportDialog();break;
    case 'bundle-apply': {
      if(!bundleCandidate)throw new Error('Choose a bundle to review first.');
      target.disabled=true;
      try {
        const result=await restoreBundle(bundleCandidate.bundle,bundleCandidate.token,samples,{appearance:$('#bundle-appearance').checked});
        state=result.state;const local=await loadBooks();const merged=edition.mergeEditions(local.books,samples);books=merged.books;if(merged.conflicts.includes(edition.EDITION_ID))edition.clearApparatus();
        closeDialog(true);await render({keepScroll:true});say('Bundle restored on this device. Check your passages and reading places; choose companion permissions separately.');
      }finally{if(target.isConnected)target.disabled=false;}
      break;
    }
    case 'export':download(await loadState(),'private-passages.reader-backup.json');say('Backup downloaded. It contains private quotations and notes.');break;
    case 'raw-export':download({state:await rawState(),books:await rawBooks(),archives:await recoveryArchives()},'private-raw-recovery.json');say('Raw recovery downloaded. It includes full local books and notes; keep it private.');break;
    case 'export-edition': {const book=bookById(target.dataset.book);if(book&&!sampleIds.has(book.id))download(book,`${book.id}.reader.json`);break;}
    case 'repair':recoveryDialog();break;
    case 'repair-apply': {
      if(!recoveryCandidate)throw new Error('Choose a valid backup first.');
      state=await recoverState(recoveryCandidate);stateDamaged=false;recoveryCandidate=null;closeDialog(true);await render();$('#storage-warning').textContent='Reader state repaired. The original damaged state is retained in recovery data; local books were kept.';say('Recovery saved. Reading records are writable again.');break;
    }
    case 'preset': {
      const pos=currentPosition();await commit(s=>{const presets={paper:{theme:'paper',size:21,leading:1.7,measure:'book'},dusk:{theme:'dusk',size:22,leading:1.8,measure:'book'},large:{theme:'ink',size:29,leading:1.8,measure:'book'}};s.prefs={...s.prefs,...presets[target.dataset.preset]};return s;});settings();if(pos){await restorePosition(pos);if(dialogOrigin)dialogOrigin.scroll=scrollY;}break;
    }
    case 'persist': {const granted=await navigator.storage?.persist?.();say(granted?'Browser storage retention granted. Keep backups too.':'The browser did not grant retention. Keep original files and backups.');break;}
    case 'check-offline':await offline();$('#offline-detail').textContent=offlineReady?'The novel, pictures and fonts are verified in this browser’s offline cache. Notes remain in browser storage.':'The offline copy is not verified. Stay connected and try again.';break;
    case 'remove-book': {
      const b=bookById(target.dataset.book);if(!b||samples.some(x=>x.id===b.id))return;
      if(!confirm(`Remove “${b.title}” from this device? Its notes remain recoverable; keep your original file.`))return;
      await removeBook(b.id);books=books.filter(x=>x.id!==b.id);await render();say('Book removed. Its saved quotations remain in Passages.');break;
    }
  }
}
const inFocus=()=>state.prefs.focus&&route.view==='read'&&!dialog.open;
const focusActionTarget=target=>target.closest('a,button,input,textarea,select,label,summary,[role="button"],[contenteditable],mark[data-note]');
function hideFocusControls(returnFocus=false) {
  const hadFocus=$('#focus-tools').contains(document.activeElement);focusControls=false;applyPrefs();
  if(returnFocus||(hadFocus&&getSelection()?.isCollapsed))main.focus({preventScroll:true});
}
function showFocusControls(keyboard=false) {
  if(!inFocus())return;focusRecallPosition={x:scrollX,y:scrollY};focusControls=true;applyPrefs();if(keyboard)$('#focus-exit').focus({preventScroll:true});
}
// Only a short stationary pointer gesture on non-interactive reading content
// recalls chrome. Record selection before the browser can clear it on pointerdown.
document.addEventListener('pointerdown',event=>{
  focusPointer=null;focusTap=null;
  if(!inFocus()||!event.isPrimary||event.button!==0||!event.target.closest('.reading')||focusActionTarget(event.target))return;
  focusPointer={id:event.pointerId,x:event.clientX,y:event.clientY,scrollX,scrollY,at:performance.now(),moved:false,hadSelection:!getSelection()?.isCollapsed};
},true);
document.addEventListener('pointermove',event=>{if(focusPointer?.id===event.pointerId&&Math.hypot(event.clientX-focusPointer.x,event.clientY-focusPointer.y)>10)focusPointer.moved=true;},{passive:true});
document.addEventListener('pointercancel',()=>{focusPointer=null;focusTap=null;});
document.addEventListener('scroll',event=>{
  const nested=event.target!==document&&event.target!==window;
  if(focusPointer&&(nested||Math.abs(scrollX-focusPointer.scrollX)>1||Math.abs(scrollY-focusPointer.scrollY)>1))focusPointer.moved=true;
  // Restoring a place can queue a document scroll notification until after
  // keyboard recall. Hide only for movement since recall, or nested scrolling.
  if(inFocus()&&focusControls&&(nested||Math.abs(scrollX-focusRecallPosition.x)>1||Math.abs(scrollY-focusRecallPosition.y)>1))hideFocusControls();
},{capture:true,passive:true});
document.addEventListener('pointerup',event=>{if(focusPointer?.id===event.pointerId){focusTap={...focusPointer,ended:performance.now()};focusPointer=null;}});
document.addEventListener('click',event=>{
  const gesture=focusTap;focusTap=null;
  if(inFocus()&&event.detail===1&&gesture&&!gesture.moved&&!gesture.hadSelection&&gesture.ended-gesture.at<350&&performance.now()-gesture.ended<500&&getSelection()?.isCollapsed&&event.target.closest('.reading')&&!focusActionTarget(event.target)) {
    if(focusControls)hideFocusControls();else showFocusControls();return;
  }

  if(event.target.closest('.skip-link')){event.preventDefault();main.focus();return;}
  const target=event.target.closest('[data-action]');
  if(target){event.preventDefault();act(target).catch(fail);return;}
  const link=event.target.closest('a[href^="#"]');
  if(link?.hasAttribute('data-section-start')){
    requestedPosition=null;
    if(link.hash===location.hash){event.preventDefault();if(dialog.open&&!closeDialog())return;void savePosition().then(()=>render());return;}
  }
  if(link && dialog.open && !closeDialog()){event.preventDefault();return;}
  const mark=event.target.closest('mark[data-note]');
  if(mark && getSelection()?.isCollapsed){const note=state.notes.find(n=>n.id===mark.dataset.note);if(note)noteDialog(note);}
});
document.addEventListener('input',event=>{
  if(event.target.id==='size')$('#size-value').textContent=event.target.value;
  if(event.target.id==='reflection') {
    reflectionDraft={text:event.target.value,base:reflectionDraft?.base ?? reflectionBase,passages:facingPair?.every(p=>p&&allowed(p.bookId,p.sectionId)&&anchorStatus(p,bookById(p.bookId)).valid)?structuredClone(facingPair):reflectionDraft?.passages};
    $('#reflection-status').textContent=dirtyReflection()?'Unsaved draft · kept in this tab while you explore.':'No changes to save.';
  }
});
document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target, button=form.querySelector('[type=submit]');if(button)button.disabled=true;
  try {
    if(form.id==='import-form') {
      const file=$('#book-file').files[0];if(!file)throw new Error('Choose a book file first.');if(file.size>LIMIT)throw new Error('This file is larger than 8 MB. Ask your agent to split it into volumes.');
      const bytes=await file.arrayBuffer(),text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);let book;
      if(file.name.toLowerCase().endsWith('.txt'))book=await fromText(text,{title:$('#book-title').value||file.name.replace(/\.txt$/i,''),kind:$('#book-form').value,bytes});
      else if(file.name.toLowerCase().endsWith('.json'))book=validateBook(JSON.parse(text));
      else throw new Error('Use a UTF-8 .txt or prepared reader .json file.');
      if(sampleIds.has(book.id))throw new Error('This ID belongs to a sample. Give the prepared personal book a different ID.');
      const old=bookById(book.id);
      if(old && JSON.stringify(old)!==JSON.stringify(book) && !confirm('Replace the stored edition? Old notes will be retained and checked against the new words.'))return;
      await saveBook(book);books=[...books.filter(b=>b.id!==book.id),book];closeDialog();location.hash='#shelf';route={view:'shelf'};await render();say('Book added on this device. No upload was made.');
    } else if(form.id==='bundle-export-form') {
      const snapshot=await librarySnapshot(),available=bundleBooks(snapshot.books),selected=[...form.querySelectorAll('[name=edition]:checked')].map(input=>input.value);
      const bundle=await createBundle({...snapshot,books:available},selected);
      download(bundle,'private-reading.reader-bundle.json',true);closeDialog(true);say('Private bundle downloaded. It contains saved records and your selected full editions.');
    } else if(form.id==='echo-form') {echo=$('#echo-term').value;await render({keepScroll:true});$('#echo-term').focus();
    } else if(form.id==='note-form') {
      const snapshot=editing,note={...snapshot,id:snapshot.id||crypto.randomUUID(),note:$('#note-text').value,updated:Date.now()};
      if(!snapshot.id&&!anchorStatus(note,bookById(note.bookId)).valid)throw new Error('The source has changed. Export this draft before continuing.');
      await commit(s=>{const old=s.notes.find(n=>n.id===note.id);if(snapshot.id&&(!old||old.updated!==snapshot.updated))throw new Error('This note changed in another tab. Export your draft, then reopen the note.');note.updated=Math.max(Date.now(),(old?.updated||0)+1);s.notes=[...s.notes.filter(n=>n.id!==note.id),note];return s;});closeDialog(true);await render({keepScroll:true});say('Passage saved on this device.');
    } else if(form.id==='settings-form') {
      const pos=currentPosition(),prefs={size:Number($('#size').value),leading:Number($('#leading').value),theme:$('#theme').value,measure:$('#measure').value};
      await commit(s=>{s.prefs={...s.prefs,...prefs};return s;});closeDialog();if(pos)await restorePosition(pos);
    } else if(form.id==='boundaries-form') {
      await setPictureBoundary($('#picture-book').value==='none'?-1:Number($('#picture-chapter').value));
    }
  } catch(error) {fail(error);}finally{if(button?.isConnected)button.disabled=false;}
});
document.addEventListener('change',async event=>{
  try {
    if(event.target.id==='picture-book'){const chapters=$('#picture-chapter'),group=event.target.value;chapters.disabled=group==='none';chapters.innerHTML=group==='none'?'<option value="-1">None yet</option>':pictureChapterOptions(group);return;}
    if(event.target.hasAttribute('data-facing')) {
      if(dirtyReflection()&&!confirm('Discard this connection draft to change passages? Cancel to keep or export it.')){await render({keepScroll:true});return;}
      const choice=facingChoices()[Number(event.target.value)];if(event.target.value===''||!choice)return;
      reflectionDraft=null;facingPair[Number(event.target.dataset.facing)]=choice;await render({keepScroll:true});return;
    }
    if(event.target.id==='bundle-file') {
      bundleCandidate=null;const input=event.target,file=input.files[0];if(!file)return;
      if(file.size>BUNDLE_LIMIT)throw new Error('This reading bundle exceeds 64 MB. Export fewer editions at a time.');
      const bundle=await validateBundle(JSON.parse(await file.text()));
      if(bundle.books.some(b=>sampleIds.has(b.id)&&!samples.some(s=>s.id===b.id)))throw new Error('An original sample is unavailable for edition comparison. Reconnect and retry, or export a bundle containing only your personal editions. Nothing was imported.');
      await savePosition();const snapshot=await librarySnapshot();
      if(!input.isConnected||input.files[0]!==file)return;
      const plan=planBundleRestore(bundle,snapshot,samples);bundleCandidate={bundle,token:snapshotToken(snapshot)};
      openDialog('Review your reading bundle.',`<p>This private file contains ${amount(bundle.books.length,'edition')}, ${amount(bundle.state.notes.length,'passage')} and ${amount((bundle.state.connections||[]).length,'connection')}.</p><ul><li>${amount(plan.additions.length,'edition')} to add; ${plan.existing.length} already available.</li><li>${amount(plan.addedNotes,'passage')} and ${amount(plan.addedConnections,'connection')} to add, including any separate conflict copies.</li><li>Existing reading places stay; missing places are restored. Companion permissions stay as they are.</li></ul>${plan.unresolved||plan.unresolvedConnections?`<p>${amount(plan.unresolved,'passage')} and ${amount(plan.unresolvedConnections,'connection')} lack a matching edition. Their quotations remain recoverable; no anchors will be guessed.</p>`:''}${plan.conflicts.length?`<p class="dialog-error">These book IDs already have different edition content: ${plan.conflicts.map(b=>esc(b.title)).join(', ')}. Nothing will be restored. Keep both private files and ask your agent to reconcile the editions.</p>`:''}<label class="bundle-choice"><input id="bundle-appearance" type="checkbox"><span>Use the bundle’s saved appearance and focus preference</span></label><p class="small">Other local books and notes remain. Conflicting records are kept separately; restoring this file again does not multiply those copies.</p><button class="primary" data-action="bundle-apply" ${plan.conflicts.length?'disabled':''}>Restore on this device</button>`);
      return;
    }
    if(!['restore-file','repair-file'].includes(event.target.id))return;
    const file=event.target.files[0];if(!file)return;if(file.size>20*1024*1024)throw new Error('This backup is too large.');const backup=validateState(JSON.parse(await file.text()));
    if(event.target.id==='repair-file') {
      recoveryCandidate=backup;$('#repair-preview').textContent=`Validated backup: ${backup.notes.length} passages, ${backup.connections.length} connections, ${Object.keys(backup.positions).length} reading places. This replaces unreadable state, including backed-up appearance and spoiler permissions, while retaining its original object and all local books.`;$('#repair-apply').disabled=false;
    }else {await commit(s=>mergeBackup(s,backup));closeDialog();await render({keepScroll:true});say('Backup merged. Conflicting records were kept separately.');}
  }catch(e){if(event.target.id==='repair-file'){recoveryCandidate=null;$('#repair-apply').disabled=true;}fail(e);}
});
document.addEventListener('selectionchange',()=>{
  if(route.view!=='read'||dialog.open||!activeBook)return;
  if(!getSelection()?.isCollapsed){if(focusPointer)focusPointer.hadSelection=true;if(inFocus())hideFocusControls();}
  selection=readSelection($('#reading-text'),activeBook,activeSection);$('#selection-save').hidden=!(selection||selectionTouch);
});
const selectionButton=$('#selection-save');
let selectionTouch=null,selectionTouchTimer;
function clearSelectionTouch() {
  clearTimeout(selectionTouchTimer);selectionTouch=null;selectionButton.hidden=!selection;
}
function keepSelection(passage=selection) {
  if(!passage||dialog.open)return;
  getSelection()?.removeAllRanges();beginSelection(passage);
}
// Cancelling a touch pointerdown suppresses WebKit's click. Let the native tap
// finish, retaining its source range if the browser collapses the selection.
selectionButton.addEventListener('pointerdown',event=>{
  clearSelectionTouch();
  if(event.pointerType!=='touch'){event.preventDefault();return;}
  if(!event.isPrimary||event.button!==0||!selection)return;
  const rect=selectionButton.getBoundingClientRect();
  selectionTouch={id:event.pointerId,x:event.clientX,y:event.clientY,at:performance.now(),scrollX,scrollY,moved:false,passage:selection,left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};
});
document.addEventListener('pointerdown',event=>{if(selectionTouch&&event.pointerId!==selectionTouch.id)selectionTouch.moved=true;},true);
document.addEventListener('pointermove',event=>{if(selectionTouch?.id===event.pointerId&&Math.hypot(event.clientX-selectionTouch.x,event.clientY-selectionTouch.y)>10)selectionTouch.moved=true;},{passive:true});
function endSelectionTouch(event,cancelled=false) {
  const gesture=selectionTouch;if(!gesture||gesture.id!==event.pointerId)return;
  gesture.ended=performance.now();gesture.cancelled ||= cancelled;
  gesture.moved ||= Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>10||Math.abs(scrollX-gesture.scrollX)>1||Math.abs(scrollY-gesture.scrollY)>1||event.clientX<gesture.left||event.clientX>gesture.right||event.clientY<gesture.top||event.clientY>gesture.bottom;
  clearTimeout(selectionTouchTimer);
  selectionTouchTimer=setTimeout(()=>{if(selectionTouch===gesture)clearSelectionTouch();},700);
}
document.addEventListener('pointercancel',event=>endSelectionTouch(event,true));
document.addEventListener('pointerup',event=>endSelectionTouch(event));
selectionButton.addEventListener('click',event=>{
  const gesture=selectionTouch;clearSelectionTouch();
  if(event.detail&&gesture) {
    if(gesture.cancelled||gesture.moved||!gesture.ended||gesture.ended-gesture.at>500||performance.now()-gesture.ended>700)return;
    if(route.view!=='read'||gesture.passage.bookId!==activeBook?.id||gesture.passage.sectionId!==activeSection?.id||gesture.passage.revision!==activeBook?.source.sha256)return;
    keepSelection(gesture.passage);
  }else keepSelection();
});
document.addEventListener('keydown',event=>{if(!inFocus())return;if(event.key==='Escape'){event.preventDefault();act($('#focus-exit')).catch(fail);}else if(event.key.toLowerCase()==='c'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!focusActionTarget(event.target)){event.preventDefault();showFocusControls(true);}});
window.addEventListener('scroll',()=>{if(!restored||route.view!=='read'||dialog.open)return;clearTimeout(pendingScroll);pendingScroll=setTimeout(savePosition,250);},{passive:true});
const mastheadObserver=new ResizeObserver(()=>document.documentElement.style.setProperty('--mast-height',`${$('.masthead').getBoundingClientRect().height}px`));mastheadObserver.observe($('.masthead'));
window.addEventListener('resize',()=>{
  if(route.view!=='read'||dialog.open||!restored)return;
  const anchor=fixedPosition||state.positions[activeBook?.id];if(!anchor)return;
  clearTimeout(reflowTimer);reflowTimer=setTimeout(()=>void restorePosition(anchor),100);
});
window.addEventListener('hashchange',async event=>{
  if(dialog.open&&!closeDialog()){history.replaceState(null,'',event.oldURL);requestedPosition=undefined;return;}
  await savePosition();route=parseRoute();await render();main.focus({preventScroll:true});
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)void savePosition();});
window.addEventListener('pagehide',()=>{void savePosition();});
window.addEventListener('beforeunload',event=>{if(dirtyNote()||dirtyReflection()){event.preventDefault();event.returnValue='';}});
// Local reading must not depend on the optional demonstration download.
try {state=await loadState();}catch {stateDamaged=true;showWarning('Saved reader data is unreadable and has not been replaced. Use Settings to export recovery data and repair it from a valid backup.');}
try {const local=await loadBooks();books=local.books;if(local.rejected.length)showWarning(`${local.rejected.length} local book record(s) need recovery. Other books are available. Nothing was removed; export original recovery data from Settings.`);}catch {showWarning('Local books could not be opened. Stored data has not been removed. Keep original files and export your notes from Settings.');}
route=parseRoute();await render();
try {
  const response=await fetch('/library.json',{signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('Unavailable');
  const records=await response.json();if(!Array.isArray(records))throw new Error('Invalid sample library');
  samples=records.map(validateBook);await prepareSampleCopy();const merged=edition.mergeEditions(books,samples);books=merged.books;
  if(merged.conflicts.includes(edition.EDITION_ID)){edition.clearApparatus();showWarning('Your restored edition differs from the supplied copy and has been preserved. Its text and notes remain available; the illustration companion is unavailable for that edition.',false);}
  else try{await edition.loadApparatus();}catch{showWarning('Pictures and chapter grouping are unavailable. The novel and your records are still readable.',false);}
  // Do not disturb a reader, selection or open import dialog when a slow download finishes.
  if(!dialog.open&&route.view==='shelf'){route=parseRoute();await render({keepScroll:route.view!=='read'});}
  else if(!dialog.open&&route.view==='passages')await render({keepScroll:true});
  else if(!dialog.open&&route.view==='companion'&&!dirtyReflection())await render({keepScroll:true});
}catch {showWarning('The complete edition could not be opened. Your saved records have not been removed. Reconnect and reload, or restore the exact edition from Settings.',false);}
void offline();
