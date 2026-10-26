import {ANTIGONE_ID,prepareAntigoneRights,decorateAntigone,antigoneEntrances,hasAntigoneStudy,clearAntigoneLayout} from './antigone.mjs';
import {validateBook,validateState,newState,fromText,anchorStatus,visibleThrough,mergeBackup,passageAt,passagesOverlap,extendPassage,findOccurrences,sha256,LIMIT} from './core.mjs';
import {loadState,loadBooks,saveBook,updateState,rawState,rawBooks,removeBook,recoverState,recoveryArchives,librarySnapshot,restoreBundle} from './db.mjs';
import {createBundle,validateBundle,planBundleRestore,snapshotToken,canonical,BUNDLE_LIMIT} from './bundle.mjs';
import {renderText,readSelection,renderPassage} from './text.mjs';
import {passageShareData,sharePassage,copyPassage} from './share.mjs';
import {mountPassageCard} from './share-card.mjs';
import {mergeLibrary} from './library.mjs';
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const amount=(number,label)=>`${number} ${label}${number===1?'':'s'}`;
const arrow = (direction='up-right') => `<svg class="ui-icon ui-icon--${direction}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#ui-arrow"></use></svg>`;
const main = $('#main'), dialog = $('#dialog');
new ResizeObserver(()=>{document.documentElement.style.setProperty('--header-height',`${$('.masthead').getBoundingClientRect().height}px`);updateStudyMargin();}).observe($('.masthead'));
let libraryLoading = true, shelfRefreshPending = false;
let state = newState(), books = [], samples = [], editionConflicts = [], route = {view:'shelf'}, activeBook, activeSection;
let selection, editing, selectionChoice, editingRangeChanged=false, dialogOrigin, restored = true, requestedPosition, pendingScroll, statusTimer;
let focusControls=false,focusPointer=null,focusTap=null,focusRecallPosition={x:0,y:0};
let experiment = 'walk', stop = 0, echo = '', offlineReady = false, storageError = false;
let reflectionDraft = null, reflectionBase = '', facingPair=null, facingId=null, fragments=[], contextPassages=[], recoveryCandidate=null, stateDamaged=false, bundleCandidate=null;
let stainHeld='food',stainFull=false,stainBriefScroll=0,studyReturn=null,pendingStudyReturn=null,studyMarginObserver;
const sampleIds=new Set(['bell','rain']);
const dirtyNote = () => dialog.open && editing && $('#note-text') && (editingRangeChanged || $('#note-text').value !== (editing.note || ''));
const dirtyReflection = () => reflectionDraft && reflectionDraft.text !== reflectionDraft.base;
const bookById = id => books.find(b => b.id === id);
const suppliedForRestore=()=>samples.filter(book=>!editionConflicts.some(conflict=>conflict.supplied.id===book.id));
const removable=book=>!samples.some(s=>s.id===book.id)||editionConflicts.some(conflict=>conflict.stored===book);
const conflictNotice=()=>editionConflicts.length?`The supplied edition differs from your saved copy of ${editionConflicts.map(({stored})=>`“${stored.title}”`).join(', ')}. You are reading the saved edition. Your notes are unchanged. Export both editions from Settings before reconciling them.`:'';
function mergeAvailable(local) {
  const merged=mergeLibrary(samples,local);books=merged.books;editionConflicts=merged.conflicts;
  let notice=$('#edition-warning');
  if(!notice){notice=document.createElement('div');notice.id='edition-warning';notice.className='warning';notice.setAttribute('role','status');$('#storage-warning').after(notice);}
  notice.textContent=conflictNotice();notice.hidden=!editionConflicts.length;
}
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
  try {const [view='shelf',book,section] = location.hash.slice(1).split('/').map(decodeURIComponent);return ['shelf','read','passages','study'].includes(view) ? {view,book,section} : {view:'shelf'};}
  catch {return {view:'shelf'};}
}
function readingEdge() {return state.prefs.focus ? 12 : Math.max(0,...[...document.querySelectorAll('.masthead,.reader-tools')].map(node=>node.getBoundingClientRect()).filter(rect=>rect.width>0&&rect.height>0&&rect.top<innerHeight&&rect.bottom>0).map(rect=>Math.min(innerHeight,rect.bottom))) + 20;}
function currentPosition() {
  if (route.view !== 'read' || !activeBook || !activeSection || !restored) return null;
  const nodes = [...main.querySelectorAll('.reading-surface [data-block]')], edge = readingEdge();
  const node = nodes.find(n => n.getBoundingClientRect().bottom > edge) || nodes.at(-1);
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  return {sectionId:activeSection.id,blockId:scrollY < 5 ? null : node.dataset.block,ratio:scrollY < 5 ? 0 : Math.min(1,Math.max(0,(edge-rect.top)/Math.max(1,rect.height))),revision:activeBook.source.sha256};
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
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const el = pos?.revision === activeBook?.source.sha256 && pos.sectionId === activeSection?.id && pos.blockId ? [...main.querySelectorAll('[data-block]')].find(x => x.dataset.block === pos.blockId) : null;
  if (el) {
    const rect = el.getBoundingClientRect();scrollTo(0,Math.max(0,scrollY + rect.top + pos.ratio*rect.height - readingEdge()));
    // Sticky controls may settle at a different height after the first movement.
    const settled=el.getBoundingClientRect();scrollTo(0,Math.max(0,scrollY + settled.top + pos.ratio*settled.height - readingEdge()));
  }
  else scrollTo(0,0);
  restored = true;
  $('#reading-text')?.setAttribute('data-position-ready','true');
}
function progressLabel(book) {
  const pos = state.positions[book.id];
  if (!pos || pos.revision !== book.source.sha256) return 'Not started';
  const index = book.sections.findIndex(s => s.id === pos.sectionId);
  return `Section ${Math.max(1,index+1)} of ${book.sections.length}`;
}
function otherBooks() {
 const other=books.filter(b=>b.id!==ANTIGONE_ID);if(!other.length)return '';
 return `<details class="other-books"><summary>Other books on this device</summary><ul>${other.map(b=>`<li><button data-action="resume" data-book="${esc(b.id)}">${esc(b.title)}</button></li>`).join('')}</ul></details>`;
}
function shelf() {
 const book=bookById(ANTIGONE_ID);
 if(!book)return `<section class="page"><p class="eyebrow">Antigone</p><h1>Open the play</h1><p id="edition-status" role="status">${libraryLoading?'Opening the edition…':'The supplied edition is unavailable. Restore an exact edition or reading bundle in Settings.'}</p><button data-action="settings">Settings & recovery</button><button data-action="import">Add an edition</button>${otherBooks()}</section>`;
 const saved=state.positions[book.id],valid=saved?.revision===book.source.sha256&&book.sections.some(s=>s.id===saved.sectionId),section=valid?saved.sectionId:'play',reviewed=hasAntigoneStudy(book),asset=reviewed&&book.assets.find(a=>a.id==='met-lekythos');
 return `<section class="antigone-entrance"><div class="entrance-copy"><p class="entrance-author">${esc(book.author)}</p><h1>${esc(book.title)}</h1>${reviewed?'<p class="entrance-premise">Creon, ruler of Thebes, forbids anyone to bury or mourn Antigone’s dead brother. She chooses to bury him anyway.</p>':''}<a class="opening-read" href="${path(book.id,section)}">${valid?'Continue reading':'Read the play'} ${arrow('right')}</a><p class="entrance-translation">${reviewed?'English translation by<br>Richard Claverhouse Jebb':esc(book.edition||'')}</p></div>${asset?`<figure class="burial-object"><button data-action="rites" aria-label="About the oil flask and mourning rites"><img src="${asset.data}" alt="${esc(asset.alt)}" width="${asset.width}" height="${asset.height}"></button><figcaption><span>A mourner beside a grave marker.</span><button data-action="rites">Attic oil flask, ca. 440 BCE · The Met</button></figcaption></figure>`:''}</section><section class="entrance-notes">${reviewed?`<section class="study-invitation"><div><p class="scope">A closer reading · includes the ending</p><h2>A public stain</h2></div><div><p>Follow Creon’s change of mind, from his defense of the burial orders to the prophet’s warning and his attempt to undo the harm.</p><button data-action="study">Compare the passages ${arrow('right')}</button></div></section>`:''}<details class="opening-background"><summary>Persons, background & edition</summary><button data-action="program-cast">Persons & scene</button><button data-action="program-before">Before the action</button><button data-action="sources">Sources & edition</button></details>${otherBooks()}</section>`;
}
function studyUnavailable(){return bookById(ANTIGONE_ID)?'This study belongs to the supplied Jebb edition. Your saved edition remains available for reading and exact export.':'The study’s source edition is unavailable. Restore the exact Jebb edition or a reading bundle in Settings.';}
function study() {
 if(!hasAntigoneStudy(bookById(ANTIGONE_ID)))return `<section class="page"><h1>A public stain</h1><p id="edition-status" role="status">${libraryLoading?'Opening the edition…':studyUnavailable()}</p><a href="#shelf">Back to the opening</a></section>`;
 return `<article class="stain-study"><header class="study-head"><p class="eyebrow">Antigone · a reading across the burial scenes</p><h1>A public stain</h1><p class="scope">Includes the ending.</p><p class="introduction">Creon proposes leaving food in Antigone’s tomb so that the city may avoid a “public stain.” Teiresias later says that birds and dogs have carried flesh from Polyneices to its altars. Hold the earlier claim beside that accusation and Creon’s reply: no mortal, he insists, can defile the gods.</p></header><nav class="study-toolbar" aria-label="Study controls"><button data-action="study-recall">Recall the earlier passage</button><button data-action="study-return">${studyReturn?.position?'Return to your reading':'Back to the opening'}</button></nav><section class="comparison" aria-label="Earlier claim beside later warning"><aside class="held"><h2>Earlier · Creon</h2><div class="choice" role="group" aria-label="Choose the earlier passage"><button data-action="study-hold" data-held="food" aria-pressed="true">Food in the tomb</button><button data-action="study-hold" data-held="hands" aria-pressed="false">Clean hands</button></div><div id="held-source" class="reading-surface"></div><button class="context-link" data-action="study-held-context">Read before and after</button></aside><section class="later"><h2>Later · Teiresias and Creon</h2><div id="later-source"></div><button class="exchange-control" data-action="study-exchange">Read their whole exchange</button></section></section><section class="interpretation"><h2>The two wrong places</h2><p class="reading-note">Teiresias joins the two orders: a living woman has been put below ground, while a dead man has been kept above it. He predicts the loss of Creon’s own child in return for these acts.</p><div id="inversion-source" class="reading-surface"></div><button class="source-link" data-action="study-prophecy">Read the accusation and its aftermath</button></section><section class="repair"><h2>Creon’s reversal</h2><p class="reading-note">The chorus names two tasks—free Antigone and bury Polyneices—without saying which must come first. The messenger reports the funeral first, then the visit to the tomb. The report does not tell us whether an earlier rescue would have saved her.</p><div class="repair-pair"><div class="advice"><p class="speaker-label">The chorus’s advice</p><div id="advice-source" class="reading-surface"></div><button class="source-link" data-action="study-advice">Read Creon’s answer</button></div><div class="report"><p class="speaker-label">The messenger’s account</p><div id="report-source" class="reading-surface"></div><p class="speaker-label">What they find at the tomb</p><div id="finding-source" class="reading-surface"></div><button class="source-link" data-action="study-report">Read the complete report</button></div></div></section><footer class="study-foot"><button data-action="study-antigone">Antigone’s last address</button><button data-action="sources">Edition & sources</button><button data-action="resume" data-book="${ANTIGONE_ID}">Continue reading</button><p class="quiet">Sophocles · Jebb’s English prose, 1904 collection, 1917 reprint. Source passages retain the edition’s wording. Reading notes by the present editor.</p></footer></article>`;
}
function studyRange(selector,start,end=start){
 const book=bookById(ANTIGONE_ID),node=typeof selector==='string'?$(selector):selector;
 if(!node||!hasAntigoneStudy(book))return;
 const section={...book.sections.find(s=>s.id==='play')};section.blocks=section.blocks.slice(start-1,end);
 renderText(node,section);decorateAntigone(node,book,section);
}
function renderStainHeld(){studyRange('#held-source',stainHeld==='food'?237:251);for(const n of main.querySelectorAll('[data-held]'))n.setAttribute('aria-pressed',String(n.dataset.held===stainHeld));}
function renderStainLater(){
 const n=$('#later-source');for(const node of [n,...n.querySelectorAll('.reading-surface')])clearAntigoneLayout(node);n.replaceChildren();n.classList.toggle('reading-surface',stainFull);
 if(stainFull)studyRange(n,266,310);
 else for(const [label,start,end,id] of [['Teiresias, after the failed sacrifice',277,279,'seer'],['Creon’s reply',280,280,'reply']]){const p=document.createElement('p');p.className='speaker-label';p.textContent=label;n.append(p);const div=document.createElement('div');div.id='stain-'+id;div.className='reading-surface';n.append(div);studyRange(div,start,end);}
 $('[data-action="study-exchange"]').textContent=stainFull?'Return to the paired passages':'Read their whole exchange';
}
function renderStudy(){
 if(!$('#held-source'))return;
 renderStainHeld();renderStainLater();studyRange('#inversion-source',297);studyRange('#advice-source',305);studyRange('#report-source',329);studyRange('#finding-source',331);
 studyMarginObserver=new ResizeObserver(updateStudyMargin);studyMarginObserver.observe(main.querySelector('.held'));updateStudyMargin();
}
function updateStudyMargin(){const held=main.querySelector('.held');if(!held)return;const header=$('.masthead'),inset=getComputedStyle(header).position==='sticky'?header.getBoundingClientRect().height:0;held.closest('.stain-study').classList.toggle('tall-margin',held.getBoundingClientRect().height>innerHeight-inset-44);}
function studyEdge(){return [...document.querySelectorAll('.masthead,.study-toolbar')].filter(n=>getComputedStyle(n).position==='sticky').reduce((height,n)=>height+n.getBoundingClientRect().height,0);}
async function studyContext(title,start,end=start,targetId){
 if(!hasAntigoneStudy(bookById(ANTIGONE_ID)))throw Error('The study’s source edition is unavailable. Your saved edition is unchanged.');
 openDialog(title,'<div class="context-reading"><article id="study-context" class="reading-surface" lang="en" aria-label="Source passage"></article></div>');
 studyRange('#study-context',start,end);
 await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(resolve));
 if(!dialog.open||!$('#study-context'))return;
 if(targetId){const node=$('#study-context').querySelector(`[data-block="${targetId}"]`);if(node)dialog.scrollTop+=node.getBoundingClientRect().top-dialog.querySelector('.dialog-header').getBoundingClientRect().bottom-18;}
 dialog.querySelector('.close-dialog').focus({preventScroll:true});$('#study-context').dataset.locationReady='true';
}
function studyInvitation(){openDialog('A public stain','<p>Follow Creon’s change of mind, from his defense of the burial orders to the prophet’s warning and his attempt to undo the harm.</p><p class="study-disclosure">Includes the ending.</p><button class="text" data-action="study">Compare the passages</button>');}
async function enterStudy(){
 if(!hasAntigoneStudy(bookById(ANTIGONE_ID)))throw Error('This study requires the supplied Jebb edition.');
 await savePosition();
 const origin=dialogOrigin||{element:document.activeElement,scroll:scrollY,hash:location.hash,bookId:activeBook?.id,position:currentPosition(),textAnchor:dialogTextAnchor(currentPosition()),layout:dialogReadingLayout()};
 if(dialog.open&&!closeDialog())return;
 studyReturn={...origin,hash:origin.hash||'#shelf',action:origin.element?.dataset.action};
 stainHeld='food';stainFull=false;location.hash='#study';
}
function leaveStudy(){
 if(!studyReturn){location.hash='#shelf';return;}
 pendingStudyReturn=studyReturn;studyReturn=null;
 if(pendingStudyReturn.position)requestedPosition=pendingStudyReturn.position;
 location.hash=pendingStudyReturn.hash;
}
function reader() {
  activeBook = bookById(route.book);
  if (!activeBook) {route = {view:'shelf'};return shelf();}
  const saved = state.positions[activeBook.id];
  activeSection = activeBook.sections.find(s => s.id === route.section) || activeBook.sections.find(s => s.id === saved?.sectionId && saved?.revision === activeBook.source.sha256) || activeBook.sections[0];
  const readingSections=activeBook.sections.filter(s=>s.id!=='jebb-note'),i=activeBook.sections.indexOf(activeSection),j=readingSections.indexOf(activeSection),previous=readingSections[j-1],next=readingSections[j+1];
  return `<section class="reading"><div class="reader-tools"><div class="tool-group"><button data-action="contents">Contents</button><button data-action="sources">Sources</button></div><span class="progress-label">Jebb · English prose</span><button data-action="focus" aria-describedby="focus-help">Focus ${arrow()}</button></div>${activeSection.id==='play'||activeSection.id==='cast'?'':`<header class="reader-heading"><p class="eyebrow">${esc(activeBook.title)} · ${esc(activeBook.author)}</p><h1>${esc(activeSection.title)}</h1></header>`}<article id="reading-text" data-book="${esc(activeBook.id)}" data-section="${esc(activeSection.id)}" class="reading-surface" lang="${esc(activeBook.language)}" aria-label="Book text"></article><div class="chapter-end"><nav class="chapter-links" aria-label="Sections">${previous ? `<a href="${path(activeBook.id,previous.id)}" data-section-start><span class="small">${arrow('left')} Previous</span><span class="nav-title">${esc(previous.title)}</span></a>` : '<span></span>'}${next ? `<a href="${path(activeBook.id,next.id)}" data-section-start><span class="small">Next ${arrow('right')}</span><span class="nav-title">${esc(next.title)}</span></a>` : `<a href="#shelf"><span class="small">End of this work</span>Return to the opening ${arrow('right')}</a>`}</nav></div><p class="reader-hint">Select words to keep or share a passage. Your reading place is saved in this browser.</p></section>`;
}
function passages() {
  return `<section class="page"><header class="page-head"><h1>Kept passages</h1><p>Saved in this browser.</p>${returnLink()}</header>${state.notes.length ? `<ul class="passage-list">${[...state.notes].sort((a,b)=>b.updated-a.updated).map(n => {
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
function passageButton(book,section,block,label='Open the passage',passage=null) {const ref=passage&&allowed(book,section)?contextPassages.push(passage)-1:null;return allowed(book,section) ? `<button class="text" data-action="context" data-context-passage="${ref??''}" data-book="${book}" data-section="${section}" data-block="${block}">${esc(label)} ${arrow()}</button>` : '<p class="small">Passage hidden until you include this section in search.</p>';}
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
  return `<div class="experiment"><form id="echo-form" class="echo-search"><label for="echo-term">Text to find</label><div><input id="echo-term" name="term" value="${esc(echo)}" maxlength="100" required><button type="submit" class="secondary">Find occurrences</button></div></form><p class="small">Exact spelling and capitalization; matches may occur within longer words. ${count} found${count>hits.length?`; showing the first ${hits.length}. Narrow the text to see others`:''}.</p>${hits.length?`<ol class="echo-list">${hits.map((h,i)=>{const p=h.passage,b=bookById(p.bookId),section=b.sections.find(s=>s.id===p.sectionId);return `<li><div><span class="eyebrow">${esc(b.title)}</span><span class="small">${esc(section.title)} · occurrence ${i+1}</span></div><div>${fragment(p,h)}${passageButton(b.id,section.id,p.segments[0].blockId,'Read around this occurrence',passageAt(b,section,section.blocks.find(x=>x.id===p.segments[0].blockId),h.offset,h.offset+echo.length))}</div></li>`;}).join('')}</ol>`:`<p class="empty">${echo?'No matches in the sections you have allowed. Try different text or review your boundary.':'Enter text to search the sections you have allowed.'}</p>`}</div>`;
}
function defaultPair() {
  if(!hasReviewedSamples())return [null,null];
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
  return `<div class="experiment"><p class="eyebrow">03 / Two passages, a space between</p><h2>Facing pages.</h2><p class="small">${hasReviewedSamples()?'Choose from your kept passages, or try the sample pair.':'Choose two kept passages to read together.'}</p><div class="facing-pages">${facingPair.map((p,i)=>{const b=p&&bookById(p.bookId);return `<div><label for="facing-${i}">${i===0?'Left':'Right'} passage</label><select id="facing-${i}" data-facing="${i}"><option value="">${b?esc(b.title):'Choose a kept passage'}</option>${choices.map((choice,j)=>`<option value="${j}" ${pairKey(choice)===pairKey(p)?'selected':''}>${esc(bookById(choice.bookId).title)} · ${esc(choice.quote.slice(0,70))}</option>`).join('')}</select>${p&&allowed(p.bookId,p.sectionId)?fragment(p):'<p class="empty">Allow this section, or choose a kept passage you have allowed.</p>'}${p?passageButton(p.bookId,p.sectionId,p.segments[0].blockId,'Read around it',p):''}</div>`;}).join('')}</div><div class="reflection"><label for="reflection">Your connection · or a reason to leave them apart</label><textarea id="reflection" maxlength="50000" aria-describedby="reflection-status" placeholder="What do you notice?">${esc(reflectionDraft?.text??reflectionBase)}</textarea><p id="reflection-status" class="small" role="status">${dirtyReflection()?'Unsaved draft · kept in this tab while you explore.':'Find saved connections in Passages.'}</p><button class="text" data-action="save-reflection" ${ready?'':'disabled'}>Keep this connection ${arrow()}</button> <button class="text" data-action="export-reflection">Export connection draft</button></div></div>`;
}

async function render({keepScroll=false}={}) {
  if(['shelf','study'].includes(route.view))shelfRefreshPending=false;
  const y = scrollY;hideFocusControls();fragments=[];contextPassages=[];selection = null;$('#selection-save').hidden = true;
  studyMarginObserver?.disconnect();studyMarginObserver=null;
  for(const node of main.querySelectorAll('.reading-surface'))clearAntigoneLayout(node);
  main.innerHTML = route.view === 'study' ? study() : route.view === 'read' ? reader() : route.view === 'passages' ? passages() : shelf();
  document.querySelectorAll('[data-nav]').forEach(a => a.toggleAttribute('aria-current',false));
  document.querySelector(`[data-nav="${['read','study'].includes(route.view)?'shelf':route.view}"]`)?.setAttribute('aria-current','page');
  applyPrefs();document.body.dataset.view=route.view;$('#study-nav').hidden=route.view!=='read'||!hasAntigoneStudy(activeBook);document.title=route.view==='read'&&activeBook?`${activeSection.title} · Antigone`:route.view==='study'?'A public stain · Antigone':'Antigone · Sophocles';
  if(route.view==='study')renderStudy();
  if (route.view === 'read') {
    const valid = state.notes.filter(n => n.sectionId === activeSection.id && anchorStatus(n,activeBook).valid);
    renderText($('#reading-text'),activeSection,valid);decorateAntigone($('#reading-text'),activeBook,activeSection);

    if (!keepScroll) {const pos = requestedPosition === null ? null : requestedPosition || state.positions[activeBook.id];requestedPosition = undefined;await restorePosition(pos);}
    $('#reading-text').dataset.positionReady='true';
  }
  for(const node of main.querySelectorAll('[data-fragment]')){const f=fragments[Number(node.dataset.fragment)];renderPassage(node,f.passage,f.book,f.hit);}
  if (keepScroll) scrollTo(0,y);else if(route.view!=='read') scrollTo(0,0);
  if(pendingStudyReturn){const origin=pendingStudyReturn;pendingStudyReturn=null;restoreDialogScroll(origin);document.querySelector(`[data-action="${CSS.escape(origin.action||'study')}"]`)?.focus({preventScroll:true});return true;}
}
let disposePassageCard=()=>{};
function dialogReadingLayout() {
  const text=route.view==='read'&&$('#reading-text');
  if(!text)return null;
  const rect=text.getBoundingClientRect();return [rect.width,rect.height,readingEdge()].join(':');
}
// A modal keeps a transient source character, without changing saved progress records.
function sourceCharacterRect(block,offset) {
  const walker=document.createTreeWalker(block,NodeFilter.SHOW_TEXT);let node,left=offset;
  while((node=walker.nextNode())){
    if(left<node.length){const range=document.createRange();range.setStart(node,left);range.setEnd(node,left+1);return range.getBoundingClientRect();}
    left-=node.length;
  }
  return null;
}
function dialogTextAnchor(position) {
  if(!position?.blockId)return null;
  const block=[...main.querySelectorAll('#reading-text [data-block]')].find(node=>node.dataset.block===position.blockId);
  const source=activeSection?.blocks.find(item=>item.id===position.blockId);
  if(!block||!source||block.textContent!==source.text)return null;
  const offsets=[];for(let i=0;i<source.text.length;i++)if(!/\s/u.test(source.text[i]))offsets.push(i);
  if(!offsets.length)return null;
  const edge=readingEdge();let lo=0,hi=offsets.length-1;
  while(lo<hi){const mid=Math.floor((lo+hi)/2),rect=sourceCharacterRect(block,offsets[mid]);if(rect&&rect.top>=edge)hi=mid;else lo=mid+1;}
  const offset=offsets[lo],rect=sourceCharacterRect(block,offset);
  if(!rect||rect.bottom<=edge||rect.top>=innerHeight)return null;
  return {blockId:position.blockId,offset,character:source.text[offset],inset:Math.max(0,rect.top-edge)};
}
function restoreDialogTextAnchor(origin) {
  const anchor=origin.textAnchor;if(!anchor)return false;
  const block=[...main.querySelectorAll('#reading-text [data-block]')].find(node=>node.dataset.block===anchor.blockId);
  const source=activeSection?.blocks.find(item=>item.id===anchor.blockId);
  if(!block||!source||block.textContent!==source.text||source.text[anchor.offset]!==anchor.character)return false;
  for(let pass=0;pass<2;pass++){
    const rect=sourceCharacterRect(block,anchor.offset);if(!rect)return false;
    const edge=readingEdge(),inset=Math.min(anchor.inset,Math.max(0,innerHeight-edge-rect.height));
    scrollTo(0,Math.max(0,scrollY+rect.top-edge-inset));
  }
  return true;
}
function restoreDialogScroll(origin) {
  if(location.hash!==origin.hash)return;
  const pos=origin.position;
  if(pos&&(route.view!=='read'||origin.bookId!==activeBook?.id||pos.revision!==activeBook?.source.sha256||pos.sectionId!==activeSection?.id))return;
  if(pos?.blockId&&origin.layout!==dialogReadingLayout()){
    if(restoreDialogTextAnchor(origin))return;
    const el=[...main.querySelectorAll('#reading-text [data-block]')].find(node=>node.dataset.block===pos.blockId);
    if(!el)return;
    // Reflow changes pixels; keep the existing source block and ratio instead.
    for(let pass=0;pass<2;pass++){
      const rect=el.getBoundingClientRect();scrollTo(0,Math.max(0,scrollY+rect.top+pos.ratio*rect.height-readingEdge()));
    }
  }else scrollTo(0,origin.scroll);
}
const dialogPosition=()=>dialogOrigin?.hash===location.hash&&dialogOrigin.position?dialogOrigin.position:currentPosition();
function openDialog(title,html) {
  disposePassageCard();disposePassageCard=()=>{};
  for(const node of dialog.querySelectorAll('.reading-surface'))clearAntigoneLayout(node);
  if (!dialog.open) {void savePosition();dialogOrigin = {element:document.activeElement,scroll:scrollY,hash:location.hash,bookId:activeBook?.id,position:currentPosition(),textAnchor:dialogTextAnchor(currentPosition()),layout:dialogReadingLayout()};}
  $('#dialog-content').innerHTML = `<div class="dialog-inner"><header class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2><button class="close-dialog" data-action="close">Close ×</button></header>${html}<p id="dialog-error" class="dialog-error" role="alert"></p></div>`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop=0;
  $('#selection-save').hidden = true;
}
function finishDialog() {
  disposePassageCard();disposePassageCard=()=>{};
  const origin=dialogOrigin;dialogOrigin=null;
  const refreshShelf=shelfRefreshPending&&['shelf','study'].includes(route.view);
  if(refreshShelf){shelfRefreshPending=false;void render({keepScroll:true});}
  const action=origin?.element?.dataset.action;
  const focusTarget=origin?.element?.isConnected?origin.element:refreshShelf&&action?main.querySelector(`[data-action="${CSS.escape(action)}"]`):null;
  focusTarget?.focus({preventScroll:true});
  if(origin)restoreDialogScroll(origin);
  editing=null;selection=null;selectionChoice=null;editingRangeChanged=false;bundleCandidate=null;
}
function closeDialog(saved=false) {
  if (!saved && dirtyNote() && !confirm('Discard this unsaved note? Choose Cancel to keep editing or export the draft.')) return false;
  dialog.close();getSelection()?.removeAllRanges();finishDialog();return true;
}
dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
// Dismiss only a completed gesture that began on an already-open backdrop.
function enableBackdropDismissal(){
  let press=null,released=null;const pointers=new Set();
  const reset=()=>{press=null;released=null;};
  const outside=(modal,event)=>{const r=modal.getBoundingClientRect();return r.width>0&&r.height>0&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
  const eligible=(modal,event)=>modal.open&&modal.matches(':modal')&&document.elementFromPoint(event.clientX,event.clientY)?.closest('dialog')===modal&&outside(modal,event);
  document.addEventListener('pointerdown',event=>{
    reset();pointers.add(event.pointerId);const modal=event.target instanceof Element?event.target.closest('dialog'):null;
    if(pointers.size===1&&event.isPrimary&&event.button===0&&modal instanceof HTMLDialogElement&&eligible(modal,event))press={modal,id:event.pointerId,type:event.pointerType,x:event.clientX,y:event.clientY};
  },true);
  document.addEventListener('pointermove',event=>{if(press&&event.pointerId===press.id&&(Math.hypot(event.clientX-press.x,event.clientY-press.y)>8||!eligible(press.modal,event)))reset();},true);
  document.addEventListener('pointerup',event=>{
    const start=press,single=pointers.size===1;reset();pointers.delete(event.pointerId);
    if(start&&single&&start.id===event.pointerId&&event.button===0&&eligible(start.modal,event)&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<=8)released=start;
  },true);
  document.addEventListener('pointercancel',event=>{pointers.delete(event.pointerId);reset();},true);
  document.addEventListener('lostpointercapture',event=>{if(press?.id===event.pointerId)reset();},true);
  for(const type of ['scroll','wheel','contextmenu','keydown','close'])document.addEventListener(type,reset,{capture:true,passive:true});
  window.addEventListener('blur',()=>{pointers.clear();reset();});
  new MutationObserver(records=>{if(records.some(record=>record.target instanceof HTMLDialogElement))reset();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  document.addEventListener('click',event=>{
    const start=released;reset();
    if(!start||event.detail===0||event.button!==0||!start.modal.open||!start.modal.matches(':modal')||event.target.closest?.('dialog')!==start.modal||(event.pointerType===start.type&&event.pointerId!==start.id))return;
    // Touch hit adjustment may move the click inside; physical down/up already proved the backdrop gesture.
    event.preventDefault();event.stopImmediatePropagation();
    // Existing cancel handlers retain draft checks, source anchors and focus return.
    // A dialog without a cancel override retains its native close-event behavior.
    if(start.modal.dispatchEvent(new Event('cancel',{cancelable:true}))&&start.modal.open)start.modal.close();
  },true);
}
enableBackdropDismissal();

dialog.addEventListener('close',()=>{if(!dialog.open&&dialogOrigin)finishDialog();});
function fail(error) {
  const alert=dialog.open && $('#dialog-error');
  if(!alert){say(error.message || 'This action could not be saved.');return;}
  alert.textContent=error.message || 'Could not save on this device. Your draft is still here.';
  const bounds=dialog.getBoundingClientRect(),message=alert.getBoundingClientRect();
  const top=Math.max(bounds.top+dialog.clientTop,dialog.querySelector('.dialog-header')?.getBoundingClientRect().bottom||0)+8;
  const bottom=bounds.top+dialog.clientTop+dialog.clientHeight-8;
  // Scroll only the modal, retaining the draft, keyboard focus and reading place.
  if(message.height>bottom-top || message.top<top)dialog.scrollTop+=message.top-top;
  else if(message.bottom>bottom)dialog.scrollTop+=message.bottom-bottom;
}
function download(value,name,compact=false) {const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,compact?undefined:2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);}
function settings() {
  const p=state.prefs;
  openDialog('Reading settings',`<p class="small">Type size and spacing apply to books, passage context, quotations, notes and reference readings. Navigation labels stay compact.</p><div class="settings-presets"><button data-action="preset" data-preset="paper">Paper</button><button data-action="preset" data-preset="dusk">Dusk</button><button data-action="preset" data-preset="large">Large print</button></div><form id="settings-form"><label for="size">Type size · <output id="size-value">${p.size}</output> px</label><input id="size" name="size" type="range" min="17" max="36" value="${p.size}"><label for="leading">Line spacing</label><input id="leading" name="leading" type="range" min="1.3" max="2.2" step="0.1" value="${p.leading}"><div class="form-row"><div><label for="theme">Page</label><select id="theme" name="theme">${['paper','dusk','ink'].map(t=>`<option value="${t}" ${p.theme===t?'selected':''}>${t[0].toUpperCase()+t.slice(1)}</option>`).join('')}</select></div><div><label for="measure">Line length</label><select id="measure" name="measure"><option value="book" ${p.measure==='book'?'selected':''}>Book</option><option value="wide" ${p.measure==='wide'?'selected':''}>Wide</option></select></div></div><div class="dialog-actions"><button class="primary" type="submit">Apply to my reader</button></div></form><div class="settings-group"><h3>Export & restore</h3><p>One private file can carry exact editions, saved passages, connections and reading places to another browser or address. It contains full books and notes, without encryption. Keep it somewhere private.</p><button class="text" data-action="bundle-export">Export a private reading bundle</button><label for="bundle-file">Restore a reading bundle</label><input id="bundle-file" type="file" accept=".json"><p class="small">Review what will be added before saving. Unsaved drafts and damaged recovery records are not included; use their separate exports.</p></div><div class="settings-group"><h3>Passages & progress</h3><p>Export includes quotations and personal notes. Keep the file private. Book files are not included. For another device or site address, also export your exact editions below.</p><button class="text" data-action="export">Export passages & progress ${arrow()}</button><label for="restore-file">Restore a backup</label><input id="restore-file" type="file" accept=".json"><p>Restore adds missing passages and preserves conflicting edits as separate notes. It keeps this device’s progress, appearance and spoiler boundaries.</p></div><div class="settings-group"><h3>Device storage</h3><p id="offline-detail">${offlineReady ? 'The application and supplied library have been checked in the offline cache.' : 'The offline application copy is not verified yet. Reconnect and check again.'} Imported books and notes use browser storage. Storage can be cleared or evicted; keep your originals and exported notes.</p><button class="text" data-action="persist">Ask browser to retain local storage</button><button class="text" data-action="check-offline">Check offline copy</button></div>`);
  const migration=document.createElement('section');migration.className='settings-group';
  migration.innerHTML=`<h3>Move to another device or address.</h3><p>Your library belongs to <strong>${esc(location.origin)}</strong> in this browser. A new domain, preview URL or browser starts with a separate library.</p><p>Export a private reading bundle above, restore it at the new address, and verify quotations and reading places before retiring this address. Separate edition and record exports remain available below. Re-converting an EPUB or PDF may produce different anchors. These downloads contain full books; keep them private.</p>${books.filter(b=>!sampleIds.has(b.id)).map(b=>`<button class="text" data-action="export-edition" data-book="${esc(b.id)}">Export exact edition: ${esc(b.title)}</button>`).join('')||'<p class="small">No personal editions on this device yet.</p>'}<p class="small">Future software served at this address can read its local books. Use a host and update process you trust.</p><button class="text" data-action="raw-export">Export original recovery data</button>${stateDamaged?'<button class="secondary" data-action="repair">Repair unreadable state</button>':''}`;
  dialog.querySelector('.dialog-inner').append(migration);
  if(editionConflicts.length){
    const recovery=document.createElement('section');recovery.className='settings-group';recovery.innerHTML=`<h3>Different editions.</h3><p>${esc(conflictNotice())}</p>${editionConflicts.map(({stored,supplied})=>`<button class="text" data-action="export-edition" data-book="${esc(stored.id)}">Export saved edition: ${esc(stored.title)}</button><button class="text" data-action="export-supplied-edition" data-book="${esc(supplied.id)}">Export supplied edition: ${esc(supplied.title)}</button>`).join('')}`;dialog.querySelector('.dialog-inner').append(recovery);
  }
  if(storageError) {
    const explanation=document.createElement('p');explanation.textContent='Raw recovery includes full local books and notes, including damaged records. Keep it private; ask your agent to repair it before restoring.';
    dialog.querySelector('[data-action="raw-export"]')?.before(explanation);
  }
}
function bundleBooks(local) {
  return mergeLibrary(samples,local).books;
}
async function bundleExportDialog() {
  await savePosition();const snapshot=await librarySnapshot(),available=bundleBooks(snapshot.books);
  openDialog('Pack your reading.',`<p>Choose the exact editions to include. <strong>All saved records are included</strong>, even quotations from unchecked books. This file is private and unencrypted.</p>${editionConflicts.length?`<p class="recovery">This bundle includes your saved editions. Different supplied editions are available as separate downloads in Settings.</p>`:''}<form id="bundle-export-form"><fieldset><legend>Full editions</legend>${available.map(b=>`<label class="bundle-choice"><input name="edition" type="checkbox" value="${esc(b.id)}" checked><span>${esc(b.title)}<span class="small"> · ${esc(b.author)}</span></span></label>`).join('')||'<p>No editions available. You can still export saved records.</p>'}</fieldset><p class="small">Up to 64 MB and 200 editions per file. Unsaved drafts, damaged records and recovery archives use their separate exports. Nothing is uploaded.</p><button class="primary" type="submit">Download private bundle</button></form>`);
}
function recoveryDialog() {
  recoveryCandidate=null;
  openDialog('Recover your reading records.',`<p>Your current saved state is unreadable. Export recovery data first if you have not already. Repair saves the damaged object in a separate recovery archive, keeps all local books, and replaces only the reader state with a validated backup.</p><button class="text" data-action="raw-export">Export original recovery data</button><label for="repair-file">A valid passages & progress backup</label><input id="repair-file" type="file" accept=".json"><p id="repair-preview" role="status">Choose a backup to review before applying it. If you have none, retain the raw export and ask your agent to recover its records into a valid backup.</p><button id="repair-apply" class="primary" data-action="repair-apply" disabled>Archive damaged state and apply backup</button>`);
}
function importDialog() {
  openDialog('Bring a book.',`<p>Choose a UTF-8 text file or a prepared reader JSON file. It stays in this browser.</p><p class="preset-note">Import only material you’re entitled to use. Owning a copy does not give permission to publish it.</p><form id="import-form"><label for="book-file">Book file · up to 8 MB</label><input id="book-file" name="file" type="file" accept=".txt,.json" required><label for="book-title">Title for a text file</label><input id="book-title" name="title" maxlength="500" placeholder="Use the file name"><label for="book-form">Text layout</label><select id="book-form" name="kind"><option value="prose">Prose · keep supplied line breaks</option><option value="verse">Poetry · keep lines, stanzas and indentation</option></select><p class="preset-note">EPUB and PDF need your agent’s conversion first. Ask it to check DRM, source quality, emphasis, notes and poetry layout. Scans need local OCR and review; protected ebooks may not be importable.</p><div class="dialog-actions"><button class="primary" type="submit">Add on this device <span aria-hidden="true">＋</span></button></div></form>`);
}
function noteDialog(note,rangeChanged=false) {
  editing = structuredClone(note);editingRangeChanged=rangeChanged;
  const book=bookById(note.bookId),valid=anchorStatus(note,book).valid;
  const sharing=valid?`<section class="passage-sharing" aria-label="Share the quotation"><p class="small">${esc(book.author)} · ${esc(book.title)}<br>${esc(book.sections.find(s=>s.id===note.sectionId).title)}${book.edition?`<br>${esc(book.edition)}`:''}</p><div class="dialog-actions"><button type="button" class="text" data-action="share-passage">Share passage</button><button type="button" class="text" data-action="copy-passage">Copy passage</button></div><p class="small" id="share-status" role="status">Quotation and source attribution only. Your note stays private.</p><div id="share-fallback" hidden><label for="share-text">Passage with attribution · select to copy</label><textarea id="share-text" readonly rows="7" spellcheck="false"></textarea></div></section>`:'<p class="small">Restore the exact edition to share this passage with attribution. Your saved quotation remains available.</p>';
  openDialog(note.id ? 'Your kept passage.' : 'Keep this passage.',`<blockquote class="dialog-quote">${esc(note.quote)}</blockquote>${sharing}<form id="note-form"><label for="note-text">Your note · optional</label><textarea id="note-text" maxlength="50000" placeholder="Add a note">${esc(note.note||'')}</textarea><div class="dialog-actions"><button class="primary" type="submit">Save on this device</button>${note.id ? '<button type="button" class="text" data-action="delete-note">Remove passage</button>' : ''}<button type="button" class="text" data-action="export-draft">Export draft</button></div></form>`);
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
async function context(bookId,sectionId,blockId,note,entrance=false) {
  const book=bookById(bookId),section=book?.sections.find(s=>s.id===sectionId);if(!section)throw new Error('This passage is no longer available.');
  openDialog(section.title,`<p class="eyebrow">${esc(book.title)} · passage context</p><p class="small">Your main reading place stays where you left it.</p><div class="context-reading"><article id="context-text" data-book="${esc(book.id)}" data-section="${esc(section.id)}" class="reading-surface" lang="${esc(book.language)}" aria-label="Passage context"></article></div>`);
  if(entrance){
    const controls=document.createElement('div');controls.className='context-navigation';
    controls.innerHTML=`<button data-action="entrances-back">Back to entrances</button><button data-action="read-entry" data-block="${esc(blockId)}" data-book="${esc(book.id)}">Read from here ${arrow('right')}</button>`;
    dialog.querySelector('.dialog-header').append(controls);
  }
  const container=$('#context-text');renderText(container,section,note?[note]:[]);decorateAntigone(container,book,section);
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
function boundaries() {
  openDialog('Choose what you’ve read.',`<p class="small">Search shows only the sections you allow here. Your reading place stays unchanged. Choose “None yet” to remove a book from search.</p><form id="boundaries-form">${books.map(b=>`<label for="boundary-${b.id}">${esc(b.title)}</label><select id="boundary-${b.id}" name="${b.id}"><option value="-1">None yet</option>${b.sections.map((s,i)=>`<option value="${i}" ${visibleThrough(state,b)===i?'selected':''}>Through ${esc(s.title)}</option>`).join('')}</select>`).join('')}<div class="dialog-actions"><button class="primary" type="submit">Set my boundaries</button></div></form>`);
}
// Display copy is separate from immutable sample editions so old full-book
// bundles remain byte-compatible. Personal/imported contexts are not rewritten.
const sampleContextCopy={
  "antigone-jebb-1917":{"revision":"d6dbcc2c4efb58d2386be871b62745f7b9f0ce1f7ccd79d0eca72d6aa20f25fe","edition":"1d9fe9ad69d2b276d7895671ae5935dfd34bb0fe2b528d768fba812e6a6aca73","texts":{"2":"Applicable Wikisource community transcription/encoding contributions and adaptations: CC BY-SA 4.0, https://creativecommons.org/licenses/by-sa/4.0/ . Credit: Wikisource contributors, with source and contributor-history links below. Historical Jebb text has its own US/UK term basis; no worldwide clearance is asserted. The Commons scan is marked PD-old-100-expired/PDM, a qualified status statement, not a worldwide license. This public edition retains the source credits, change notice and contributor-history links. Independent reader code uses MIT; that does not relicense the book or contributed encoding."}},
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
const hasReviewedSample=id=>reviewedSampleCopy.has(bookById(id));
const hasReviewedSamples=()=>[...sampleIds].every(hasReviewedSample);
const currentExperiment=()=>experiment==='walk'&&!hasReviewedSample('bell')?'echo':experiment;
async function prepareSampleCopy(){
  await prepareAntigoneRights(books);
  for(const book of books){
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
 const b=route.view==='read'?activeBook:bookById(ANTIGONE_ID);if(!b)return;
 const note=b.sections.find(s=>s.id==='jebb-note');
 openDialog('Sources & edition',`<p class="small">${esc(b.edition)}</p>${b.profile==='antigone/jebb@1'&&b.context.some(c=>c.label==='Family rites')?'<button class="text" data-action="rites">Family rites · object and note</button>':''}${b.context.filter(c=>c.kind==='source').map(c=>`<section class="context-item"><h3>${esc(c.label)}</h3><p class="source-record">${esc(backgroundText(b,c))}</p>${c.url?`<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Source</a>`:''}</section>`).join('')}${note?'<section class="context-item"><h3>Jebb’s general Note</h3><article id="jebb-note" class="reading-surface" aria-label="Jebb’s 1904 Note"></article></section>':''}`);
 if(note)renderText($('#jebb-note'),note);
}
let entranceReturn=null;
function entrances(returning=false){
 const b=route.view==='read'?activeBook:bookById(ANTIGONE_ID),entries=antigoneEntrances(b);if(!entries.length)return;
 openDialog('Entrances',`<p class="index-note">Jebb’s explicit stage directions. Some arrivals are given in the dialogue instead.</p><details class="entrance-index" ${returning?'open':''}><summary>Show all ${amount(entries.length,'entrance')} · includes later action</summary><ol>${entries.map(e=>`<li><button class="entrance-cue" data-action="entry-context" data-block="${esc(e.id)}" data-book="${esc(b.id)}"><span class="entry-words" data-entry="${esc(e.id)}"></span>${arrow('right')}</button></li>`).join('')}</ol></details>`);
 for(const node of dialog.querySelectorAll('[data-entry]'))renderText(node,{blocks:[{...entries.find(e=>e.id===node.dataset.entry),after:''}]});
 if(returning&&entranceReturn){dialog.scrollTop=entranceReturn.scroll;dialog.querySelector(`[data-action="entry-context"][data-block="${CSS.escape(entranceReturn.block)}"]`)?.focus({preventScroll:true});}
 else dialog.querySelector('summary').focus({preventScroll:true});
}
let ritesReturn=null;
function rites(fullImage=false){
 const b=route.view==='read'?activeBook:bookById(ANTIGONE_ID),note=b?.context.find(c=>c.label==='Family rites'),asset=b?.assets?.find(a=>a.id==='met-lekythos');if(!note||!asset)return;
 if(fullImage){ritesReturn={scroll:dialog.scrollTop};openDialog('The lekythos',`<button class="text" data-action="rites">Back to Family rites</button><figure class="full-object"><img src="${asset.data}" alt="${esc(asset.alt)}"><figcaption>${esc(asset.credit)}</figcaption></figure>`);dialog.querySelector('[data-action="rites"]').focus({preventScroll:true});return;}
 const returning=!!dialog.querySelector('.full-object');
 openDialog('Family rites',`<div class="rites-study"><figure><button class="object-button" data-action="object" aria-label="Look closely at the lekythos"><img src="${asset.data}" alt="${esc(asset.alt)}"></button><figcaption>A mourner beside a ribboned grave marker.<br>Attic lekythos, attributed to the Achilles Painter, ca. 440 BCE. The Met, 1989.281.72.</figcaption></figure><div class="context-reading">${note.text.split('\n\n').map(p=>`<p class="companion-reading">${esc(p)}</p>`).join('')}</div></div><button class="text" data-action="sources">Sources & image credit</button>`);
 if(returning&&ritesReturn){dialog.scrollTop=ritesReturn.scroll;dialog.querySelector('[data-action="object"]').focus({preventScroll:true});}else dialog.querySelector('.close-dialog').focus({preventScroll:true});
}
async function offline() {
  try {
    if(!navigator.serviceWorker)throw new Error('Unavailable');
    const registration=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});
    await navigator.serviceWorker.ready;
    const worker=registration.active;if(!worker)throw new Error('Still saving');
    const result=await new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>reject(new Error('Offline check timed out.')),4000);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data);};worker.postMessage('CHECK_OFFLINE',[channel.port2]);});
    offlineReady=result.ready;$('#offline-status').textContent=offlineReady?'✓ Available offline':'Offline copy incomplete';
  } catch {offlineReady=false;$('#offline-status').textContent='Offline copy not verified';}
}
async function act(target) {
  const action=target.dataset.action;
  switch(action) {
    case 'close':closeDialog();break;
    case 'study-intro':studyInvitation();break;
    case 'study':await enterStudy();break;
    case 'study-return':leaveStudy();break;
    case 'study-hold':stainHeld=target.dataset.held==='hands'?'hands':'food';renderStainHeld();break;
    case 'study-exchange':{
      if(!stainFull)stainBriefScroll=scrollY;stainFull=!stainFull;renderStainLater();
      if(stainFull)scrollTo(0,scrollY+$('#later-source').getBoundingClientRect().top-studyEdge()-24);else scrollTo(0,stainBriefScroll);
      target.focus({preventScroll:true});break;
    }
    case 'study-recall':await studyContext(stainHeld==='food'?'Earlier · food in the tomb':'Earlier · clean hands',stainHeld==='food'?237:251);break;
    case 'study-held-context':await studyContext(stainHeld==='food'?'After Haemon leaves':'Antigone’s last address',stainHeld==='food'?232:241,260,stainHeld==='food'?'play-237':'play-251');break;
    case 'study-prophecy':await studyContext('The accusation and its aftermath',280,310,'play-297');break;
    case 'study-advice':await studyContext('The change of counsel',301,310);break;
    case 'study-report':await studyContext('The messenger’s report to Eurydicè',327,339);break;
    case 'study-antigone':await studyContext('Antigone’s last address',251,260);break;
    case 'settings':await savePosition();settings();break;
    case 'import':await savePosition();importDialog();break;
    case 'offline':await savePosition();settings();break;
    case 'background':case 'sources':background();break;
    case 'rites':if(!dialog.open)target.focus({preventScroll:true});rites();break;
    case 'object':rites(true);break;
    case 'program-cast':target.focus({preventScroll:true});await context(ANTIGONE_ID,'cast','cast-001');break;
    case 'program-before':target.focus({preventScroll:true});await context(ANTIGONE_ID,'before','before-001');break;
    case 'entrances':target.focus({preventScroll:true});entranceReturn=null;entrances();break;
    case 'entrances-back':entrances(true);break;
    case 'entry-context':entranceReturn={scroll:dialog.scrollTop,block:target.dataset.block};await context(target.dataset.book,'play',target.dataset.block,null,true);dialog.querySelector('[data-action="entrances-back"]')?.focus({preventScroll:true});break;
    case 'read-entry':{
      const b=bookById(target.dataset.book),block=antigoneEntrances(b).find(e=>e.id===target.dataset.block);if(!block)return;
      if(!closeDialog())return;
      requestedPosition={sectionId:'play',blockId:block.id,ratio:0,revision:b.source.sha256};
      const hash=path(b.id,'play');if(location.hash===hash){route=parseRoute();await render();await savePosition();}else location.hash=hash;
      break;
    }
    case 'boundaries':boundaries();break;
    case 'resume': {
      const b=bookById(target.dataset.book);if(!b)return;
      await savePosition();const pos=state.positions[b.id], section=b.sections.find(s=>s.id===pos?.sectionId&&pos?.revision===b.source.sha256)||b.sections[0];
      requestedPosition=pos;const hash=path(b.id,section.id);if(location.hash===hash){route=parseRoute();await render();}else location.hash=hash;break;
    }
    case 'focus': {const pos=currentPosition();await commit(s=>{s.prefs.focus=!s.prefs.focus;return s;});hideFocusControls();await restorePosition(pos);if(state.prefs.focus)main.focus({preventScroll:true});else main.querySelector('[data-action="focus"]')?.focus({preventScroll:true});break;}
    case 'focus-reveal':showFocusControls(true);break;
    case 'focus-hide':hideFocusControls(true);break;
    case 'contents':openDialog('Contents',`<ol class="contents-list">${activeBook.sections.filter(s=>s.id!=='jebb-note').map((s,i)=>`<li><a href="${path(activeBook.id,s.id)}" data-section-start ${s.id===activeSection.id?'aria-current="location"':''}><span class="small">Section ${i+1}</span><span class="nav-title">${esc(s.title)}</span></a>${s.title.length>100?`<details><summary>Full section title</summary><p>${esc(s.title)}</p></details>`:''}</li>`).join('')}</ol>${antigoneEntrances(activeBook).length?'<button class="text" data-action="entrances">Index of stage entrances</button>':''}`);break;
    case 'boundary':boundaries();break;
    case 'experiment':experiment=target.dataset.experiment;await render({keepScroll:true});break;
    case 'stop':stop=Number(target.dataset.stop);await render({keepScroll:true});break;
    case 'echo':echo=target.dataset.word;await render({keepScroll:true});break;
    case 'choose-prototype':await commit(s=>{s.reflections['prototype-choice']=currentExperiment();return s;});await render({keepScroll:true});say('Preference kept. Tell your agent what drew you to this direction.');break;
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
    case 'context': {if(!allowed(target.dataset.book,target.dataset.section))throw new Error('Include this section in search first.');const passage=target.dataset.contextPassage===''?null:contextPassages[Number(target.dataset.contextPassage)];if(passage&&!anchorStatus(passage,bookById(passage.bookId)).valid)throw new Error('This source range has changed.');await context(target.dataset.book,target.dataset.section,target.dataset.block,passage?{...passage,id:'context-passage'}:null);break;}
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
        const result=await restoreBundle(bundleCandidate.bundle,bundleCandidate.token,suppliedForRestore(),{appearance:$('#bundle-appearance').checked});
        state=result.state;const local=await loadBooks();mergeAvailable(local.books);await prepareSampleCopy();
        closeDialog(true);await render({keepScroll:true});say('Bundle restored on this device. Check your passages and reading places.');
      }finally{if(target.isConnected)target.disabled=false;}
      break;
    }
    case 'export':download(await loadState(),'private-passages.reader-backup.json');say('Backup downloaded. It contains private quotations and notes.');break;
    case 'raw-export':download({state:await rawState(),books:await rawBooks(),archives:await recoveryArchives()},'private-raw-recovery.json');say('Raw recovery downloaded. It includes full local books and notes; keep it private.');break;
    case 'export-edition': {const book=bookById(target.dataset.book);if(book&&(!sampleIds.has(book.id)||editionConflicts.some(conflict=>conflict.stored===book)))download(book,`${book.id}.reader.json`);break;}
    case 'export-supplied-edition': {const book=editionConflicts.find(conflict=>conflict.supplied.id===target.dataset.book)?.supplied;if(book)download(book,`${book.id}.supplied.reader.json`);break;}
    case 'repair':recoveryDialog();break;
    case 'repair-apply': {
      if(!recoveryCandidate)throw new Error('Choose a valid backup first.');
      state=await recoverState(recoveryCandidate);stateDamaged=false;recoveryCandidate=null;closeDialog(true);await render();$('#storage-warning').textContent='Reader state repaired. The original damaged state is retained in recovery data; local books were kept.';say('Recovery saved. Reading records are writable again.');break;
    }
    case 'preset': {
      const pos=dialogPosition();await commit(s=>{const presets={paper:{theme:'paper',size:21,leading:1.7,measure:'book'},dusk:{theme:'dusk',size:22,leading:1.8,measure:'book'},large:{theme:'ink',size:29,leading:1.8,measure:'book'}};s.prefs={...s.prefs,...presets[target.dataset.preset]};return s;});settings();if(pos){await restorePosition(pos);if(dialogOrigin){restoreDialogScroll(dialogOrigin);dialogOrigin.scroll=scrollY;dialogOrigin.layout=dialogReadingLayout();}}break;
    }
    case 'persist': {const granted=await navigator.storage?.persist?.();say(granted?'Browser storage retention granted. Keep backups too.':'The browser did not grant retention. Keep original files and backups.');break;}
    case 'check-offline':await offline();$('#offline-detail').textContent=offlineReady?'The application and supplied library are verified in this browser’s offline cache. Local books remain in browser storage.':'The offline copy is not verified. Stay connected and try again.';break;
    case 'remove-book': {
      const b=bookById(target.dataset.book);if(!b||!removable(b))return;
      const conflict=editionConflicts.some(item=>item.stored===b);
      if(!confirm(conflict?`Remove the saved edition of “${b.title}”? The different supplied edition will appear. Notes remain but may no longer match. Export both editions and your notes from Settings first.`:`Remove “${b.title}” from this device? Its notes remain recoverable; keep your original file.`))return;
      await removeBook(b.id);mergeAvailable((await loadBooks()).books);await prepareSampleCopy();await render();say('Book removed. Its saved quotations remain in Passages.');break;
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
  if(target){event.preventDefault();target.focus({preventScroll:true});act(target).catch(fail);return;}
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
  event.preventDefault();const form=event.target, button=form.querySelector('[type=submit]'),focused=document.activeElement;if(button)button.disabled=true;
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
      await saveBook(book);mergeAvailable((await loadBooks()).books);await prepareSampleCopy();closeDialog();location.hash='#shelf';route={view:'shelf'};await render();say('Book added on this device. No upload was made.');
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
      const pos=dialogPosition(),prefs={size:Number($('#size').value),leading:Number($('#leading').value),theme:$('#theme').value,measure:$('#measure').value};
      await commit(s=>{s.prefs={...s.prefs,...prefs};return s;});if(pos)await restorePosition(pos);closeDialog();
    } else if(form.id==='boundaries-form') {
      const values=new FormData(form);
      await commit(s=>{for(const b of books)s.boundaries[b.id]={index:Number(values.get(b.id)),revision:b.source.sha256};return s;});closeDialog();await render({keepScroll:true});say('Search boundaries saved. Your reading place is unchanged.');
    }
  } catch(error) {fail(error);}finally{if(button?.isConnected){button.disabled=false;if(dialog.open&&focused===button&&document.activeElement===document.body)button.focus({preventScroll:true});}}
});
document.addEventListener('change',async event=>{
  try {
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
      const plan=planBundleRestore(bundle,snapshot,suppliedForRestore());bundleCandidate={bundle,token:snapshotToken(snapshot)};
      openDialog('Review your reading bundle.',`<p>This private file contains ${amount(bundle.books.length,'edition')}, ${amount(bundle.state.notes.length,'passage')} and ${amount((bundle.state.connections||[]).length,'connection')}.</p><ul><li>${amount(plan.additions.length,'edition')} to add; ${plan.existing.length} already available.</li><li>${amount(plan.addedNotes,'passage')} and ${amount(plan.addedConnections,'connection')} to add, including any separate conflict copies.</li><li>Existing reading places stay; missing places are restored.</li></ul>${plan.unresolved||plan.unresolvedConnections?`<p>${amount(plan.unresolved,'passage')} and ${amount(plan.unresolvedConnections,'connection')} lack a matching edition. Their quotations remain recoverable; no anchors will be guessed.</p>`:''}${plan.conflicts.length?`<p class="dialog-error">These book IDs already have different edition content: ${plan.conflicts.map(b=>esc(b.title)).join(', ')}. Nothing will be restored. Keep both private files and ask your agent to reconcile the editions.</p>`:''}<label class="bundle-choice"><input id="bundle-appearance" type="checkbox"><span>Use the bundle’s saved appearance and focus preference</span></label><p class="small">Other local books and notes remain. Conflicting records are kept separately; restoring this file again does not multiply those copies.</p><button class="primary" data-action="bundle-apply" ${plan.conflicts.length?'disabled':''}>Restore on this device</button>`);
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
window.addEventListener('resize',updateStudyMargin,{passive:true});
window.addEventListener('hashchange',async event=>{
  if(route.view==='study'&&studyReturn&&new URL(event.newURL).hash===studyReturn.hash){pendingStudyReturn=studyReturn;studyReturn=null;if(pendingStudyReturn.position)requestedPosition=pendingStudyReturn.position;}
  const fromDialog=dialog.open;
  if(fromDialog&&!closeDialog()){history.replaceState(null,'',event.oldURL);requestedPosition=undefined;return;}
  if(!fromDialog)await savePosition();route=parseRoute();const returned=await render();if(!returned)main.focus({preventScroll:true});
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)void savePosition();});
window.addEventListener('pagehide',()=>{void savePosition();});
window.addEventListener('beforeunload',event=>{if(dirtyNote()||dirtyReflection()){event.preventDefault();event.returnValue='';}});
// Local reading must not depend on the optional demonstration download.
try {state=await loadState();}catch {stateDamaged=true;showWarning('Saved reader data is unreadable and has not been replaced. Use Settings to export recovery data and repair it from a valid backup.');}
try {const local=await loadBooks();books=local.books;if(local.rejected.length)showWarning(`${local.rejected.length} local book record(s) need recovery. Other books are available. Nothing was removed; export original recovery data from Settings.`);}catch {showWarning('Local books could not be opened. Stored data has not been removed. Keep original files and export your notes from Settings.');}
await prepareSampleCopy();
route=parseRoute();await render();
try {
  const response=await fetch('/library.json',{signal:AbortSignal.timeout(90000)});if(!response.ok)throw new Error('Unavailable');
  const records=await response.json();if(!Array.isArray(records))throw new Error('Invalid sample library');
  const supplied=records.map(validateBook);mergeLibrary(supplied,[]);samples=supplied;mergeAvailable(books);await prepareSampleCopy();libraryLoading=false;
  // Defer a covered shelf until the dialog closes; keep active reading untouched.
  if(dialog.open&&['shelf','study'].includes(route.view))shelfRefreshPending=true;
  // Do not disturb a reader, selection or open import dialog when a slow download finishes.
  if(!dialog.open&&['shelf','study'].includes(route.view)){route=parseRoute();await render({keepScroll:route.view!=='read'});}
  else if(!dialog.open&&route.view==='passages')await render({keepScroll:true});
  else if(!dialog.open&&route.view==='companion'&&!dirtyReflection())await render({keepScroll:true});
}catch {showWarning('The supplied library is unavailable. Your local books and records are independent; reconnect and reload to retry.',false);}
finally {libraryLoading=false;$('#library-loading')?.remove();const status=$('#edition-status');if(status)status.textContent=route.view==='study'?studyUnavailable():'The supplied edition is unavailable. Restore an exact edition or reading bundle in Settings.';}
void offline();
