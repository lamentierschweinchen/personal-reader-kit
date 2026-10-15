import {validateBook,validateState,newState,fromText,anchorStatus,visibleThrough,mergeBackup,LIMIT} from './core.mjs';
import {loadState,loadBooks,saveBook,updateState,rawState,removeBook} from './db.mjs';
import {renderText,readSelection} from './text.mjs';
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const main = $('#main'), dialog = $('#dialog');
let state = newState(), books = [], samples = [], route = {view:'shelf'}, activeBook, activeSection;
let selection, editing, dialogOrigin, restored = true, requestedPosition, pendingScroll, statusTimer;
let experiment = 'walk', stop = 0, echo = 'room', offlineReady = false, storageError = false;
const bookById = id => books.find(b => b.id === id);
const path = (book,section) => `#read/${encodeURIComponent(book)}/${encodeURIComponent(section)}`;
const returnLink = () => state.lastBook && bookById(state.lastBook) ? `<button class="text" data-action="resume" data-book="${esc(state.lastBook)}">Return to your book ↗</button>` : '';
function say(message) {clearTimeout(statusTimer);$('#status').textContent = message;statusTimer = setTimeout(() => {$('#status').textContent = '';},5000);}
function showWarning(message) {storageError = true;$('#storage-warning').hidden = false;$('#storage-warning').textContent = message;}
function applyPrefs() {
  const p = state.prefs;document.documentElement.dataset.theme = p.theme;
  document.documentElement.style.setProperty('--size',`${p.size}px`);document.documentElement.style.setProperty('--leading',p.leading);
  document.documentElement.style.setProperty('--measure',p.measure === 'wide' ? '44rem' : '34rem');
  document.body.classList.toggle('focus',p.focus && route.view === 'read');$('#focus-exit').hidden = !(p.focus && route.view === 'read');
}
async function commit(change) {const next = await updateState(change);state = next;applyPrefs();return next;}
function parseRoute() {
  try {const [view='shelf',book,section] = location.hash.slice(1).split('/').map(decodeURIComponent);return ['shelf','read','companion','passages'].includes(view) ? {view,book,section} : {view:'shelf'};}
  catch {return {view:'shelf'};}
}
function readingEdge() {return state.prefs.focus ? 45 : ($('.reader-tools')?.getBoundingClientRect().bottom || $('.masthead').getBoundingClientRect().height) + 20;}
function currentPosition() {
  if (route.view !== 'read' || !activeBook || !activeSection || !restored) return null;
  const nodes = [...main.querySelectorAll('.reading-surface [data-block]')], edge = readingEdge();
  const node = nodes.find(n => n.getBoundingClientRect().bottom > edge) || nodes.at(-1);
  if (!node) return null;
  const rect = node.getBoundingClientRect();
  return {sectionId:activeSection.id,blockId:scrollY < 5 ? null : node.dataset.block,ratio:scrollY < 5 ? 0 : Math.min(1,Math.max(0,(edge-rect.top)/Math.max(1,rect.height))),revision:activeBook.source.sha256};
}
async function savePosition() {
  clearTimeout(pendingScroll);const pos = currentPosition(), book = activeBook;
  if (!pos || !book) return;
  try {await commit(s => {s.positions[book.id] = pos;s.lastBook = book.id;return s;});}
  catch {if (!storageError) showWarning('Your reading position could not be saved. Keep this tab open; export your passages from Settings.');}
}
async function restorePosition(pos) {
  restored = false;
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const el = pos?.revision === activeBook?.source.sha256 && pos.sectionId === activeSection?.id && pos.blockId ? [...main.querySelectorAll('[data-block]')].find(x => x.dataset.block === pos.blockId) : null;
  if (el) {
    const rect = el.getBoundingClientRect();scrollTo(0,Math.max(0,scrollY + rect.top + pos.ratio*rect.height - readingEdge()));
    // Sticky controls may settle at a different height after the first movement.
    const settled=el.getBoundingClientRect();scrollTo(0,Math.max(0,scrollY + settled.top + pos.ratio*settled.height - readingEdge()));
  }
  else scrollTo(0,0);
  restored = true;
}
function progressLabel(book) {
  const pos = state.positions[book.id];
  if (!pos || pos.revision !== book.source.sha256) return 'Not started';
  const index = book.sections.findIndex(s => s.id === pos.sectionId);
  return `Section ${Math.max(1,index+1)} of ${book.sections.length}`;
}
function shelf() {
  return `<section class="shelf"><div class="shelf-intro"><div><p class="eyebrow">A personal reader · yours to make</p><h1>In good<br><em>company.</em></h1></div><div class="intro-note"><p>A book to carry.<br>A place to pause.<br>A little further into the words.</p><button class="primary" data-action="import">Bring a book <span aria-hidden="true">↗</span></button></div></div><div class="shelf-list">${books.map((b,i) => `<article class="book-row"><span class="book-number">${String(i+1).padStart(2,'0')}</span><div><h2><button class="book-title" data-action="resume" data-book="${esc(b.id)}">${esc(b.title)}</button></h2><p class="small">${esc(b.author)}</p></div><div class="book-actions"><button class="text" data-action="resume" data-book="${esc(b.id)}">${state.positions[b.id] ? 'Continue reading' : 'Open the book'} ↗</button><span class="small">${esc(progressLabel(b))}</span>${!samples.some(s=>s.id===b.id) ? `<button class="small" data-action="remove-book" data-book="${esc(b.id)}">Remove from device</button>` : ''}</div></article>`).join('')}</div><div class="shelf-bottom"><p>The two opening works are original sample writing. Books you add stay in this browser, along with your notes.</p><a class="text-link" href="#companion">Try three ways of exploring ↗</a></div></section>`;
}
function reader() {
  activeBook = bookById(route.book);
  if (!activeBook) {route = {view:'shelf'};return shelf();}
  const saved = state.positions[activeBook.id];
  activeSection = activeBook.sections.find(s => s.id === route.section) || activeBook.sections.find(s => s.id === saved?.sectionId && saved?.revision === activeBook.source.sha256) || activeBook.sections[0];
  const i = activeBook.sections.indexOf(activeSection), previous = activeBook.sections[i-1], next = activeBook.sections[i+1], unlocked = visibleThrough(state,activeBook) >= i;
  return `<section class="reading"><div class="reader-tools"><div class="tool-group"><button data-action="contents">Contents</button><button data-action="background">About this work</button></div><span class="progress-label">${i+1} / ${activeBook.sections.length}</span><button data-action="focus">Focus ↗</button></div><header class="reader-heading"><p class="eyebrow">${esc(activeBook.title)} · ${esc(activeBook.author)}</p><h1>${esc(activeSection.title)}</h1></header><article id="reading-text" class="reading-surface" lang="${esc(activeBook.language)}" aria-label="Book text"></article><div class="chapter-end"><button class="boundary-button" data-action="boundary">${unlocked ? '✓ Read through here · update companion boundary' : 'I’ve read through here · allow this in Companion'}</button><nav class="chapter-links" aria-label="Sections">${previous ? `<a href="${path(activeBook.id,previous.id)}" data-section-start><span class="small">← Previous</span>${esc(previous.title)}</a>` : '<span></span>'}${next ? `<a href="${path(activeBook.id,next.id)}" data-section-start><span class="small">Next →</span>${esc(next.title)}</a>` : '<a href="#shelf"><span class="small">End of this work</span>Return to your shelf →</a>'}</nav></div><p class="reader-hint">Select words to keep a passage. Your place is saved on this device; exploring never moves it.</p></section>`;
}
function passages() {
  return `<section class="page"><header class="page-head"><p class="eyebrow">Your marginalia</p><h1>Words you<br>wanted to keep.</h1><p>Your quotations, your connections. Stored only on this device.</p>${returnLink()}</header>${state.notes.length ? `<ul class="passage-list">${[...state.notes].sort((a,b)=>b.updated-a.updated).map(n => {
    const b = bookById(n.bookId), valid = anchorStatus(n,b);
    return `<li class="passage"><div class="passage-meta"><p class="eyebrow">${esc(b?.title || 'A personal book')}</p><span class="small">${esc(b?.sections.find(s=>s.id===n.sectionId)?.title || n.sectionId)}</span></div><div><blockquote>${esc(n.quote)}</blockquote>${n.note ? `<p class="passage-note">${esc(n.note)}</p>` : ''}${!valid.valid ? `<p class="recovery">${esc(valid.reason)}</p>` : ''}<div class="passage-actions">${valid.valid ? `<button class="text" data-action="note-context" data-note="${n.id}">Read in context ↗</button>` : ''}<button class="text" data-action="edit-note" data-note="${n.id}">Edit note</button></div></div></li>`;
  }).join('')}</ul>` : '<p class="empty">Keep a sentence for later.<br>Select some words in a book to begin.</p>'}${Object.entries(state.reflections).filter(([k])=>k!=='prototype-choice').map(([key,text]) => `<div class="context-item"><p class="eyebrow">${key === 'facing-pages' ? 'Facing pages · your connection' : 'Preserved reflection'}</p><p class="passage-note">${esc(text)}</p></div>`).join('')}</section>`;
}
const stops = [
  {title:'A threshold',number:'01',prompt:'Before looking for the street’s name, listen for its smallest sound.',book:'bell',section:'arrival',block:'bell-1',note:'Pause near a doorway, or imagine one from where you are. What would be missing from a map of this moment?'},
  {title:'A crossing',number:'02',prompt:'Notice something moving, then something that stays.',book:'bell',section:'crossing',block:'bell-6',note:'A bridge is one possibility. A window, a station platform or a page will do. Give both kinds of movement a little time.'},
  {title:'A return',number:'03',prompt:'Take one part of the way back. What has changed in your attention?',book:'bell',section:'return',block:'bell-15',note:'You need not have travelled far. The exercise is to notice a difference without having to explain it.'}
];
function allowed(bookId,sectionId) {const b = bookById(bookId);return b && b.sections.findIndex(s=>s.id===sectionId) <= visibleThrough(state,b);}
function passageButton(book,section,block,label='Open the passage') {return allowed(book,section) ? `<button class="text" data-action="context" data-book="${book}" data-section="${section}" data-block="${block}">${esc(label)} ↗</button>` : '<p class="small">Passage hidden until you allow this section in Companion.</p>';}
function walk() {
  const s = stops[stop];
  return `<div class="experiment"><p class="eyebrow">01 / Reading with your feet</p><h2>A listening walk.</h2><p class="experiment-lead">Three invitations from a fictional town. Try them anywhere, or stay in your chair.</p><div class="walk-stage"><div class="walk-stops" role="group" aria-label="Listening stops">${stops.map((x,i)=>`<button data-action="stop" data-stop="${i}" aria-pressed="${i===stop}"><span>${x.number}</span>${x.title}</button>`).join('')}</div><div><p class="walk-prompt">${s.prompt}</p><p class="experiment-lead">${s.note}</p>${passageButton(s.book,s.section,s.block)}</div></div><p class="sample-notice">An editorial exercise, not a mapped route. A real walk would need place evidence, access checks and attribution.</p></div>`;
}
function echoes() {
  const hits = [];
  for (const b of samples) for (const [index,s] of b.sections.entries()) if (index <= visibleThrough(state,b)) for (const block of s.blocks) {
    const match = new RegExp(`\\b${echo}\\b`,'i').exec(block.text);
    if (match) {const previous = block.text.lastIndexOf('. ',match.index), start = previous < 0 ? 0 : previous + 2, end = block.text.indexOf('. ',match.index);hits.push({b,s,block,quote:block.text.slice(start,end < 0 ? undefined : end+1)});}
  }
  return `<div class="experiment"><p class="eyebrow">02 / A word changes rooms</p><h2>An echo index.</h2><p class="experiment-lead">Follow a word across the two works. Decide for yourself whether it means the same thing.</p><div class="echo-words" role="group" aria-label="Words to follow">${['room','sound','window','water'].map(word=>`<button data-action="echo" data-word="${word}" aria-pressed="${word===echo}">${word}</button>`).join('')}</div>${hits.length ? `<ol class="echo-list">${hits.map(h=>`<li><div><span class="eyebrow">${esc(h.b.title)}</span><span class="small">${esc(h.s.title)}</span></div><button data-action="context" data-book="${h.b.id}" data-section="${h.s.id}" data-block="${h.block.id}"><q>${esc(h.quote)}</q></button></li>`).join('')}</ol>` : '<p class="empty">These words are still ahead of you.<br>Set your reading boundary to let them in.</p>'}<p class="sample-notice">Exact word matches from permitted sections; an index, not a claim about intention.</p></div>`;
}
function facing() {
  const pairs = [{book:'bell',section:'crossing',block:'bell-8'},{book:'rain',section:'table',block:'rain-4'}];
  return `<div class="experiment"><p class="eyebrow">03 / Two works, a space between</p><h2>Facing pages.</h2><p class="experiment-lead">One fragment keeps moving. Another remains. What belongs in the space between them?</p><div class="facing-pages">${pairs.map(p=>{const b=bookById(p.book),s=b.sections.find(s=>s.id===p.section),block=s.blocks.find(b=>b.id===p.block);return `<div><p class="eyebrow">${esc(b.title)}</p>${allowed(p.book,p.section) ? `<blockquote>${esc(block.text)}</blockquote>` : '<p class="empty">A fragment waiting<br>for you to reach it.</p>'}${passageButton(p.book,p.section,p.block,'Read around it')}</div>`;}).join('')}</div><div class="reflection"><label for="reflection">Your connection</label><textarea id="reflection" maxlength="50000" placeholder="A thought, a question, or just two words…">${esc(state.reflections['facing-pages']||'')}</textarea><button class="text" data-action="save-reflection">Keep this connection ↗</button></div></div>`;
}
function companion() {
  return `<section class="page"><header class="page-head companion-heading"><p class="eyebrow">Three small experiments · original sample anthology</p><h1>Other ways<br>into a book.</h1><p>The reading stays the same. The companion can follow a place, a word, or a connection you make yourself.</p></header><div class="companion-top"><p class="small">Unread passages stay hidden. Set a boundary explicitly; opening an experiment never advances your reading place.</p><button class="secondary" data-action="boundaries">Choose what I’ve read</button></div>${returnLink()}<div class="experiment-tabs" role="group" aria-label="Experience prototypes"><button data-action="experiment" data-experiment="walk" aria-pressed="${experiment==='walk'}">01 &nbsp; A listening walk</button><button data-action="experiment" data-experiment="echo" aria-pressed="${experiment==='echo'}">02 &nbsp; An echo index</button><button data-action="experiment" data-experiment="facing" aria-pressed="${experiment==='facing'}">03 &nbsp; Facing pages</button></div>${experiment==='walk' ? walk() : experiment==='echo' ? echoes() : facing()}<div class="prototype-choice"><p>These are sketches to try. Your agent should study your own books before proposing three directions for them.</p><button class="secondary" data-action="choose-prototype">${state.reflections['prototype-choice']===experiment ? '✓ Your preferred direction' : 'Keep this direction'}</button></div></section>`;
}
async function render({keepScroll=false}={}) {
  const y = scrollY;selection = null;$('#selection-save').hidden = true;
  main.innerHTML = route.view === 'read' ? reader() : route.view === 'passages' ? passages() : route.view === 'companion' ? companion() : shelf();
  document.querySelectorAll('[data-nav]').forEach(a => a.toggleAttribute('aria-current',false));
  document.querySelector(`[data-nav="${route.view==='read'?'shelf':route.view}"]`)?.setAttribute('aria-current','page');
  applyPrefs();document.title = route.view==='read' && activeBook ? `${activeSection.title} · Reading` : 'Reading · in good company';
  if (route.view === 'read') {
    const valid = state.notes.filter(n => n.sectionId === activeSection.id && anchorStatus(n,activeBook).valid);
    renderText($('#reading-text'),activeSection,valid);
    if (!keepScroll) {const pos = requestedPosition === null ? null : requestedPosition || state.positions[activeBook.id];requestedPosition = undefined;await restorePosition(pos);}
  }
  if (keepScroll) scrollTo(0,y);else if(route.view!=='read') scrollTo(0,0);
}
function openDialog(title,html) {
  if (!dialog.open) dialogOrigin = {element:document.activeElement,scroll:scrollY};
  $('#dialog-content').innerHTML = `<div class="dialog-inner"><header class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2><button class="close-dialog" data-action="close">Close ×</button></header>${html}<p id="dialog-error" class="dialog-error" role="alert"></p></div>`;
  if (!dialog.open) dialog.showModal();
  $('#selection-save').hidden = true;
}
function finishDialog() {
  const origin=dialogOrigin;dialogOrigin=null;
  if(origin?.element?.isConnected)origin.element.focus({preventScroll:true});
  if(origin)scrollTo(0,origin.scroll);
  editing=null;selection=null;
}
function closeDialog() {dialog.close();getSelection()?.removeAllRanges();finishDialog();}
dialog.addEventListener('close',()=>{if(!dialog.open&&dialogOrigin)finishDialog();});
function fail(error) {if(dialog.open && $('#dialog-error')) $('#dialog-error').textContent=error.message || 'Could not save on this device. Your draft is still here.';else say(error.message || 'This action could not be saved.');}
function download(value,name) {const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);}
function settings() {
  const p=state.prefs;
  openDialog('Make room for reading.',`<p class="small">Simple presets, one familiar reading surface.</p><div class="settings-presets"><button data-action="preset" data-preset="paper">Paper</button><button data-action="preset" data-preset="dusk">Dusk</button><button data-action="preset" data-preset="large">Large print</button></div><form id="settings-form"><label for="size">Type size · <output id="size-value">${p.size}</output> px</label><input id="size" name="size" type="range" min="17" max="36" value="${p.size}"><label for="leading">Line spacing</label><input id="leading" name="leading" type="range" min="1.3" max="2.2" step="0.1" value="${p.leading}"><div class="form-row"><div><label for="theme">Page</label><select id="theme" name="theme">${['paper','dusk','ink'].map(t=>`<option value="${t}" ${p.theme===t?'selected':''}>${t[0].toUpperCase()+t.slice(1)}</option>`).join('')}</select></div><div><label for="measure">Line length</label><select id="measure" name="measure"><option value="book" ${p.measure==='book'?'selected':''}>Book</option><option value="wide" ${p.measure==='wide'?'selected':''}>Wide</option></select></div></div><div class="dialog-actions"><button class="primary" type="submit">Apply to my reader</button></div></form><div class="settings-group"><h3>Keep your marginalia.</h3><p>Export includes quotations and personal notes. Keep the file private. Original book files are not included. To move devices, import your books again and restore this backup.</p><button class="text" data-action="export">Export passages & progress ↗</button><label for="restore-file">Restore a backup</label><input id="restore-file" type="file" accept=".json"><p>Restore adds missing passages and preserves conflicting edits as separate notes. It keeps this device’s progress, appearance and spoiler boundaries.</p></div><div class="settings-group"><h3>On this device.</h3><p id="offline-detail">${offlineReady ? 'The application and original samples have been checked in the offline cache.' : 'The offline application copy is not verified yet. Reconnect and check again.'} Imported books and notes use browser storage. Storage can be cleared or evicted; keep your originals and exported notes.</p><button class="text" data-action="persist">Ask browser to retain local storage</button><button class="text" data-action="check-offline">Check offline copy</button>${storageError ? '<button class="text" data-action="raw-export">Export original recovery data</button>' : ''}</div>`);
}
function importDialog() {
  openDialog('Bring a book.',`<p>Choose a UTF-8 text file or a prepared reader JSON file. It stays in this browser.</p><form id="import-form"><label for="book-file">Book file · up to 8 MB</label><input id="book-file" name="file" type="file" accept=".txt,.json" required><label for="book-title">Title for a text file</label><input id="book-title" name="title" maxlength="500" placeholder="Use the file name"><label for="book-form">Text layout</label><select id="book-form" name="kind"><option value="prose">Prose · keep supplied line breaks</option><option value="verse">Poetry · keep lines, stanzas and indentation</option></select><p class="preset-note">EPUB and PDF need your agent’s conversion first. Ask it to check DRM, source quality, emphasis, notes and poetry layout. Scans need local OCR and review; protected ebooks may not be importable.</p><div class="dialog-actions"><button class="primary" type="submit">Add on this device <span aria-hidden="true">＋</span></button></div></form>`);
}
function noteDialog(note) {
  editing = structuredClone(note);
  openDialog(note.id ? 'Your kept passage.' : 'Keep this passage.',`<blockquote class="dialog-quote">${esc(note.quote)}</blockquote><form id="note-form"><label for="note-text">Your note · optional</label><textarea id="note-text" maxlength="50000" placeholder="What stays with you?">${esc(note.note||'')}</textarea><div class="dialog-actions"><button class="primary" type="submit">Save on this device</button>${note.id ? '<button type="button" class="text" data-action="delete-note">Remove passage</button>' : ''}<button type="button" class="text" data-action="export-draft">Export draft</button></div></form>`);
  $('#note-form button[type=submit]').focus({preventScroll:true});
}
function context(bookId,sectionId,blockId,note) {
  const book=bookById(bookId),section=book?.sections.find(s=>s.id===sectionId);if(!section)throw new Error('This passage is no longer available.');
  openDialog(section.title,`<p class="eyebrow">${esc(book.title)} · passage context</p><p class="small">Your main reading place stays where you left it.</p><div class="context-reading"><article id="context-text" class="reading-surface" lang="${esc(book.language)}" aria-label="Passage context"></article></div>`);
  renderText($('#context-text'),section,note?[note]:[]);
  requestAnimationFrame(()=>{const block=[...$('#context-text').querySelectorAll('[data-block]')].find(x=>x.dataset.block===blockId);if(block)dialog.scrollTop+=block.getBoundingClientRect().top-dialog.getBoundingClientRect().top-120;});
}
function boundaries() {
  openDialog('Choose what you’ve read.',`<p class="small">This controls what Companion may show. It does not change where you resume reading. Choose “None yet” to hide everything again.</p><form id="boundaries-form">${books.map(b=>`<label for="boundary-${b.id}">${esc(b.title)}</label><select id="boundary-${b.id}" name="${b.id}"><option value="-1">None yet</option>${b.sections.map((s,i)=>`<option value="${i}" ${visibleThrough(state,b)===i?'selected':''}>Through ${esc(s.title)}</option>`).join('')}</select>`).join('')}<div class="dialog-actions"><button class="primary" type="submit">Set my boundaries</button></div></form>`);
}
function background() {
  const b=activeBook, visible=b.context.filter(c=>c.through===null||allowed(b.id,c.through));
  openDialog('About this work.',`<p class="eyebrow">${esc(b.title)}</p><p class="small">${esc(b.edition)}</p>${visible.map(c=>`<section class="context-item"><p class="eyebrow">${c.kind==='editorial'?'Editorial interpretation':c.kind==='source'?'Sourced background':'Sample provenance'}</p><h3>${esc(c.label)}</h3><p>${esc(c.text)}</p>${c.url?`<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Source ↗</a>`:''}</section>`).join('')}<div class="context-item"><p class="eyebrow">Edition record</p><p class="small">${esc(b.source.description)}</p><p class="small">Edition fingerprint: ${b.source.sha256.slice(0,16)}…</p></div>`);
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
    case 'settings':settings();break;
    case 'import':importDialog();break;
    case 'offline':settings();break;
    case 'background':background();break;
    case 'boundaries':boundaries();break;
    case 'resume': {
      const b=bookById(target.dataset.book);if(!b)return;
      await savePosition();const pos=state.positions[b.id], section=b.sections.find(s=>s.id===pos?.sectionId&&pos?.revision===b.source.sha256)||b.sections[0];
      requestedPosition=pos;const hash=path(b.id,section.id);if(location.hash===hash){route=parseRoute();await render();}else location.hash=hash;break;
    }
    case 'focus': {const pos=currentPosition();await commit(s=>{s.prefs.focus=!s.prefs.focus;return s;});await restorePosition(pos);break;}
    case 'contents':openDialog('Inside this book.',`<ol class="contents-list">${activeBook.sections.map(s=>`<li><a href="${path(activeBook.id,s.id)}" data-section-start>${esc(s.title)}</a></li>`).join('')}</ol>`);break;
    case 'boundary':boundaries();break;
    case 'experiment':if($('#reflection') && $('#reflection').value !== (state.reflections['facing-pages']||'') && !confirm('Leave this unsaved connection? Choose Cancel to keep editing.'))return;experiment=target.dataset.experiment;await render({keepScroll:true});break;
    case 'stop':stop=Number(target.dataset.stop);await render({keepScroll:true});break;
    case 'echo':echo=target.dataset.word;await render({keepScroll:true});break;
    case 'choose-prototype':await commit(s=>{s.reflections['prototype-choice']=experiment;return s;});await render({keepScroll:true});say('Preference kept. Tell your agent what drew you to this direction.');break;
    case 'save-reflection': {const text=$('#reflection').value;await commit(s=>{s.reflections['facing-pages']=text;return s;});say('Connection saved on this device.');break;}
    case 'context':if(!allowed(target.dataset.book,target.dataset.section))throw new Error('Allow this section in Companion first.');context(target.dataset.book,target.dataset.section,target.dataset.block);break;
    case 'note-context': {const note=state.notes.find(n=>n.id===target.dataset.note);if(note&&anchorStatus(note,bookById(note.bookId)).valid)context(note.bookId,note.sectionId,note.segments[0].blockId,note);break;}
    case 'edit-note': {const n=state.notes.find(n=>n.id===target.dataset.note);if(n)noteDialog(n);break;}
    case 'delete-note': {
      if(!confirm('Remove this passage and its note from this device?'))return;const snapshot=editing;
      await commit(s=>{const current=s.notes.find(n=>n.id===snapshot.id);if(current&&current.updated!==snapshot.updated)throw new Error('This note changed in another tab. Your draft is still here; export it before reopening the current note.');s.notes=s.notes.filter(n=>n.id!==snapshot.id);return s;});closeDialog();await render({keepScroll:true});break;
    }
    case 'export-draft': {const backup=newState();backup.notes=[{...editing,id:editing.id||crypto.randomUUID(),updated:Date.now(),note:$('#note-text').value}];download(backup,'private-draft.reader-backup.json');break;}
    case 'export':download(await loadState(),'private-passages.reader-backup.json');say('Backup downloaded. It contains private quotations and notes.');break;
    case 'raw-export':download(await rawState(),'private-recovery.reader-backup.json');break;
    case 'preset': {
      const pos=currentPosition();await commit(s=>{const presets={paper:{theme:'paper',size:21,leading:1.7,measure:'book'},dusk:{theme:'dusk',size:22,leading:1.8,measure:'book'},large:{theme:'ink',size:29,leading:1.8,measure:'book'}};s.prefs={...s.prefs,...presets[target.dataset.preset]};return s;});settings();if(pos){await restorePosition(pos);if(dialogOrigin)dialogOrigin.scroll=scrollY;}break;
    }
    case 'persist': {const granted=await navigator.storage?.persist?.();say(granted?'Browser storage retention granted. Keep backups too.':'The browser did not grant retention. Keep original files and backups.');break;}
    case 'check-offline':await offline();$('#offline-detail').textContent=offlineReady?'The application and original samples are verified in this browser’s offline cache. Local books remain in browser storage.':'The offline copy is not verified. Stay connected and try again.';break;
    case 'remove-book': {
      const b=bookById(target.dataset.book);if(!b||samples.some(x=>x.id===b.id))return;
      if(!confirm(`Remove “${b.title}” from this device? Its notes remain recoverable; keep your original file.`))return;
      await removeBook(b.id);books=books.filter(x=>x.id!==b.id);await render();say('Book removed. Its saved quotations remain in Passages.');break;
    }
  }
}
document.addEventListener('click',event=>{
  if(event.target.closest('.skip-link')){event.preventDefault();main.focus();return;}
  const target=event.target.closest('[data-action]');
  if(target){event.preventDefault();act(target).catch(fail);return;}
  const link=event.target.closest('a[href^="#"]');
  if(link?.hasAttribute('data-section-start')){
    requestedPosition=null;
    if(link.hash===location.hash){event.preventDefault();if(dialog.open)closeDialog();void savePosition().then(()=>render());return;}
  }
  if(link && dialog.open)closeDialog();
  const mark=event.target.closest('mark[data-note]');
  if(mark && getSelection()?.isCollapsed){const note=state.notes.find(n=>n.id===mark.dataset.note);if(note)noteDialog(note);}
});
document.addEventListener('input',event=>{if(event.target.id==='size')$('#size-value').textContent=event.target.value;});
document.addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target, button=form.querySelector('[type=submit]');if(button)button.disabled=true;
  try {
    if(form.id==='import-form') {
      const file=$('#book-file').files[0];if(!file)throw new Error('Choose a book file first.');if(file.size>LIMIT)throw new Error('This file is larger than 8 MB. Ask your agent to split it into volumes.');
      const bytes=await file.arrayBuffer(),text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);let book;
      if(file.name.toLowerCase().endsWith('.txt'))book=await fromText(text,{title:$('#book-title').value||file.name.replace(/\.txt$/i,''),kind:$('#book-form').value,bytes});
      else if(file.name.toLowerCase().endsWith('.json'))book=validateBook(JSON.parse(text));
      else throw new Error('Use a UTF-8 .txt or prepared reader .json file.');
      if(samples.some(b=>b.id===book.id))throw new Error('This ID belongs to a sample. Give the prepared personal book a different ID.');
      const old=bookById(book.id);
      if(old && JSON.stringify(old)!==JSON.stringify(book) && !confirm('Replace the stored edition? Old notes will be retained and checked against the new words.'))return;
      await saveBook(book);books=[...books.filter(b=>b.id!==book.id),book];closeDialog();location.hash='#shelf';route={view:'shelf'};await render();say('Book added on this device. No upload was made.');
    } else if(form.id==='note-form') {
      const snapshot=editing,note={...snapshot,id:snapshot.id||crypto.randomUUID(),note:$('#note-text').value,updated:Date.now()};
      if(!snapshot.id&&!anchorStatus(note,bookById(note.bookId)).valid)throw new Error('The source has changed. Export this draft before continuing.');
      await commit(s=>{const old=s.notes.find(n=>n.id===note.id);if(snapshot.id&&(!old||old.updated!==snapshot.updated))throw new Error('This note changed in another tab. Export your draft, then reopen the note.');note.updated=Math.max(Date.now(),(old?.updated||0)+1);s.notes=[...s.notes.filter(n=>n.id!==note.id),note];return s;});closeDialog();await render({keepScroll:true});say('Passage saved on this device.');
    } else if(form.id==='settings-form') {
      const pos=currentPosition(),prefs={size:Number($('#size').value),leading:Number($('#leading').value),theme:$('#theme').value,measure:$('#measure').value};
      await commit(s=>{s.prefs={...s.prefs,...prefs};return s;});closeDialog();if(pos)await restorePosition(pos);
    } else if(form.id==='boundaries-form') {
      const values=new FormData(form);
      await commit(s=>{for(const b of books)s.boundaries[b.id]={index:Number(values.get(b.id)),revision:b.source.sha256};return s;});closeDialog();await render({keepScroll:true});say('Companion boundaries saved. Your reading place is unchanged.');
    }
  } catch(error) {fail(error);}finally{if(button?.isConnected)button.disabled=false;}
});
document.addEventListener('change',async event=>{
  if(event.target.id!=='restore-file')return;
  try {const file=event.target.files[0];if(!file)return;if(file.size>20*1024*1024)throw new Error('This backup is too large.');const backup=validateState(JSON.parse(await file.text()));await commit(s=>mergeBackup(s,backup));closeDialog();await render({keepScroll:true});say('Backup merged. Conflicting notes were kept separately.');}catch(e){fail(e);}
});
document.addEventListener('selectionchange',()=>{
  if(route.view!=='read'||dialog.open||!activeBook)return;
  selection=readSelection($('#reading-text'),activeBook,activeSection);$('#selection-save').hidden=!selection;
});
$('#selection-save').addEventListener('pointerdown',e=>e.preventDefault());
$('#selection-save').addEventListener('click',()=>{if(selection){const saved=selection;getSelection()?.removeAllRanges();noteDialog(saved);}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.open&&state.prefs.focus&&route.view==='read')act($('#focus-exit')).catch(fail);});
window.addEventListener('scroll',()=>{if(!restored||route.view!=='read'||dialog.open)return;clearTimeout(pendingScroll);pendingScroll=setTimeout(savePosition,250);},{passive:true});
window.addEventListener('hashchange',async()=>{await savePosition();if(dialog.open)closeDialog();route=parseRoute();await render();main.focus({preventScroll:true});});
document.addEventListener('visibilitychange',()=>{if(document.hidden)void savePosition();});
window.addEventListener('pagehide',()=>{void savePosition();});
window.addEventListener('beforeunload',event=>{const draft=$('#note-text');const reflection=$('#reflection');if((draft&&draft.value!==(editing?.note||''))||(reflection&&reflection.value!==(state.reflections['facing-pages']||''))){event.preventDefault();event.returnValue='';}});
try {
  const response=await fetch('/library.json');if(!response.ok)throw new Error('The sample library could not load. Reconnect and reload.');samples=(await response.json()).map(validateBook);books=[...samples];
  try {state=await loadState();}catch {showWarning('Saved reader data could not be opened. It has not been replaced. You can read the samples and export recovery data from Settings.');}
  try {books.push(...(await loadBooks()).filter(b=>!samples.some(s=>s.id===b.id)));}catch {showWarning('Local books could not be opened. Stored data has not been removed. Keep original files and export your notes from Settings.');}
  route=parseRoute();await render();void offline();
} catch(error) {main.innerHTML=`<section class="page"><h1>The shelf could not open.</h1><p>${esc(error.message)}</p><button data-action="settings">Open recovery settings</button></section>`;}
