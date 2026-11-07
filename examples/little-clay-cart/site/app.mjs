import {validateBook,validateState,newState,fromText,anchorStatus,visibleThrough,mergeBackup,passageAt,passagesOverlap,extendPassage,findOccurrences,sha256,LIMIT} from './core.mjs';
import {loadState,loadBooks,saveBook,updateState,rawState,rawBooks,removeBook,recoverState,recoveryArchives,librarySnapshot,restoreBundle} from './db.mjs';
import {createBundle,validateBundle,planBundleRestore,snapshotToken,canonical,BUNDLE_LIMIT} from './bundle.mjs';
import {renderText,readSelection,renderPassage} from './text.mjs';
import {passageShareData,sharePassage,copyPassage} from './share.mjs';
import {mountPassageCard} from './share-card.mjs';
import {mergeLibrary} from './library.mjs';
import {encodeRecoveryGraph} from './recovery-graph.mjs';
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const amount=(number,label)=>`${number} ${label}${number===1?'':'s'}`;
const arrow = (direction='up-right') => `<svg class="ui-icon ui-icon--${direction}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><use href="#ui-arrow"></use></svg>`;
const main = $('#main'), dialog = $('#dialog');
// At extreme UI zoom, let the enlarged navigation scroll away instead of covering the reading surface.
const masthead=$('.masthead');
function adaptChrome(){if(masthead)masthead.classList.toggle('tall-chrome',masthead.getBoundingClientRect().height>innerHeight*.35);}
if(typeof ResizeObserver==='function'&&masthead)new ResizeObserver(adaptChrome).observe(masthead);
window.addEventListener('resize',adaptChrome);adaptChrome();
let libraryLoading = true, shelfRefreshPending = false;
let state = newState(), books = [], samples = [], editionConflicts = [], route = {view:'shelf'}, activeBook, activeSection;
let selection, editing, selectionChoice, editingRangeChanged=false, dialogOrigin, restored = true, requestedPosition, pendingScroll, statusTimer;
let focusControls=false,focusPointer=null,focusTap=null,focusRecallPosition={x:0,y:0};
let sourceTrail=[], noticePending=false;
const sourceSpoilerSections=new Set(['front-matter','introduction','plot-outline','cast']);
const openedSourceSections=new Set();
let experiment = 'walk', stop = 0, echo = 'room', offlineReady = false, storageError = false;
let reflectionDraft = null, reflectionBase = '', facingPair=null, facingId=null, fragments=[], contextPassages=[], recoveryCandidate=null, stateDamaged=false, bundleCandidate=null;
const sampleIds=new Set(['bell','rain']);
// Updated only after the entire prepared edition, including its terms and assets, is reviewed.
const CART_EDITION='49864da0d10244f0a95dda0c18ec8ee7e93219cae70b9b7eded281cac2d695e7';
const reviewedCart=new WeakSet();
const cartBook=()=>books.find(b=>reviewedCart.has(b));
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
function reportDownload(message,target) {
  if(!dialog.open||!target?.isConnected){say(message);return;}
  dialog.querySelector('#download-status')?.remove();
  const status=document.createElement('p');status.id='download-status';status.className='download-status';status.setAttribute('role','status');status.textContent=message;target.after(status);
  const view=dialog.getBoundingClientRect(),rect=status.getBoundingClientRect();if(rect.bottom>view.bottom-16)dialog.scrollTop+=rect.bottom-(view.bottom-16);else if(rect.top<view.top+16)dialog.scrollTop-=view.top+16-rect.top;
}
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
function shelf() {
  const cart=cartBook();
  if(cart) return cartShelf(cart);
  return `<section class="shelf"><div class="shelf-intro"><div><p class="eyebrow">A personal reader · yours to make</p><h1>In good<br><em>company.</em></h1></div><div class="intro-note"><p>Read, mark, annotate.<br>Keep a passage.<br>Take your books offline.</p><button class="primary" data-action="import">Bring a book ${arrow()}</button></div></div><div class="shelf-list">${libraryLoading&&!books.length?'<p id="library-loading" class="small" role="status">Loading the library…</p>':''}${books.map((b,i) => `<article class="book-row"><span class="book-number">${String(i+1).padStart(2,'0')}</span><div><h2><button class="book-title" data-action="resume" data-book="${esc(b.id)}">${esc(b.title)}</button></h2><p class="small">${esc(b.author)}</p></div><div class="book-actions"><button class="text" data-action="resume" data-book="${esc(b.id)}">${state.positions[b.id] ? 'Continue reading' : 'Open the book'} ${arrow()}</button><span class="small">${esc(progressLabel(b))}</span>${removable(b) ? `<button class="small" data-action="remove-book" data-book="${esc(b.id)}">Remove from device</button>` : ''}</div></article>`).join('')}</div><div class="shelf-bottom"><p>${hasReviewedSamples()?'The two opening works are original sample writing. ':''}Books you add stay in this browser, along with your notes.</p><a class="text-link" href="#companion">${hasReviewedSamples()?'Try three ways of exploring':'Explore your passages'} ${arrow()}</a></div></section>`;
}
function cartShelf(cart) {
  const others=books.filter(b=>b!==cart);
  return `<section class="shelf cart-shelf"><div class="cart-opening"><p class="eyebrow">A play in ten acts · 1905 translation</p><h1>The Little<br><em>Clay Cart</em></h1><p class="cart-byline">Attributed to Śūdraka<br>Translated by Arthur W. Ryder</p><p>A play of love, money and mistaken identities, translated from Sanskrit and Prākrits into English prose and verse.</p><button class="primary" data-action="resume" data-book="${esc(cart.id)}">${state.positions[cart.id]?'Continue reading':'Read the prologue'} ${arrow()}</button></div><div class="cart-shelf-foot"><a class="text-link" href="#companion">Objects and essays ${arrow()}</a></div>${others.length?`<div class="shelf-list">${others.map(b=>`<article class="book-row"><div><h2><button class="book-title" data-action="resume" data-book="${esc(b.id)}">${esc(b.title)}</button></h2><p class="small">${esc(b.author)}</p></div><div class="book-actions"><button class="text" data-action="resume" data-book="${esc(b.id)}">${state.positions[b.id]?'Continue reading':'Open the book'} ${arrow()}</button>${removable(b)?`<button class="small" data-action="remove-book" data-book="${esc(b.id)}">Remove from device</button>`:''}</div></article>`).join('')}</div>`:''}<div class="shelf-bottom"><button class="text" data-action="import">Bring a book ${arrow()}</button><p>Books and notes stay in this browser.</p></div></section>`;
}
const CART_SCHOLAR_KEY='cart-scholar-full-49864da0d10244f0';
const cartScholarAllowed=book=>reviewedCart.has(book)&&state.boundaries[CART_SCHOLAR_KEY]?.revision===book.source.sha256&&state.boundaries[CART_SCHOLAR_KEY]?.index===0;
let cartImage='met-cart';
function windowMuseum(book){
 const art=book.assets.find(a=>a.id===cartImage)||book.assets.find(a=>a.id==='met-cart');
 return `<figure class="object-cart"><div class="object-cart-image">${art?`<img id="cart-object-image" src="data:${art.mediaType};base64,${art.data}" width="${art.width}" height="${art.height}" alt="${esc(art.alt)}">`:''}</div><figcaption><p class="object-meta">India · 1st century BCE–1st century CE</p><h3>Toy Model of a Cart</h3><p>Terracotta, 11.1 cm high. The Metropolitan Museum of Art, 1991.455.2.</p><div class="object-views" role="group" aria-label="Views of the toy cart">${[['met-cart','Front'],['met-cart-side','Side'],['met-cart-back','Back']].filter(([id])=>book.assets.some(a=>a.id===id)).map(([id,label])=>`<button data-action="cart-view" data-asset="${id}" aria-pressed="${id===cartImage}">${label}</button>`).join('')}</div><a href="https://www.metmuseum.org/art/collection/search/38074" target="_blank" rel="noopener noreferrer">Museum record ${arrow()}</a></figcaption></figure>`;
}
function cartCompanion(book){
 return `<section class="page scholar-page"><header class="scholar-hero"><div class="scholar-hero-copy"><p class="eyebrow">The Little Clay Cart · A companion</p><h1>The city<br>and the stage.</h1><nav class="scholar-jump" aria-label="In this companion"><button data-action="scholar-jump" data-target="objects">Objects</button><button data-action="scholar-jump" data-target="scholar-reading">Essays</button></nav>${returnLink()}</div><figure class="scholar-hero-art"><img src="/commons-mathura-panel.jpg" width="1040" height="2432" alt="A red sandstone carving of two men, one standing behind the other with his hands on the front figure’s shoulders."><figcaption>Mathura, 2nd century CE · Carved red sandstone · Museo d’Arte Orientale, Turin</figcaption></figure></header>
 <section class="panel-story" id="objects" tabindex="-1"><div class="panel-lead"><p class="eyebrow">A sculpture from Mathura</p><h2>Two men<br>in stone.</h2><p>The Turin museum identifies the figures as probably Śakāra and his companion. The red Sikri sandstone was quarried between Mathura and Agra.</p></div><div class="panel-note"><h3>Another reading</h3><p>Art historian Monika Zin identifies the figure behind as a jester and questions whether the scene depicts the play.</p><button class="text panel-essay-link" data-action="scholar-jump" data-target="scholar-reading">Monika Zin’s essay ${arrow()}</button><p class="object-credit">Museo d’Arte Orientale, Turin, Inp/9. Photograph by Sailko, unaltered, <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 3.0</a>. <a href="https://www.maotorino.it/it/archivio-catalogo/lo-shakara-e-il-vita/" target="_blank" rel="noopener noreferrer">Museum record ${arrow()}</a> · <a href="https://www.ngv.vic.gov.au/essay/a-kushan-bodhisattva-and-early-indian-sculpture/" target="_blank" rel="noopener noreferrer">About the stone ${arrow()}</a> · <a href="https://commons.wikimedia.org/wiki/File:Mathura_(Uttar_pradesh),_mrcchakatika,_shakara_e_vita,_II_sec.JPG" target="_blank" rel="noopener noreferrer">Photo record ${arrow()}</a></p></div></section>
 <div class="collection-intro"><p class="eyebrow">Objects from the region and beyond</p><h2>Clay, gold, bronze, ivory.</h2><p>Objects from different parts of South Asia.</p></div>
 <section class="object-section" aria-labelledby="cart-object-title"><div class="object-copy"><p class="eyebrow">01 / A toy</p><h2 id="cart-object-title">A cart small enough to hold</h2></div>${windowMuseum(book)}</section>
 <section class="object-section object-section-jewel" aria-labelledby="jewel-title"><figure class="object-photo"><img src="/met-ear-ornament.jpg" width="4000" height="2920" loading="lazy" alt="Gold ear ornament with curling forms, rows of tiny beads and a lion in relief, against a black background."><figcaption>One from a Pair of Ear Ornaments · Andhra Pradesh · ca. 1st century BCE–1st century CE · Gold · The Metropolitan Museum of Art, 1981.398.3 · <a href="https://www.metmuseum.org/art/collection/search/39676" target="_blank" rel="noopener noreferrer">Museum record ${arrow()}</a></figcaption></figure><div class="object-copy"><p class="eyebrow">02 / Gold</p><h2 id="jewel-title">A gold ornament, a tiny lion</h2><p>Gold sheet, wire, and minute granules surround a lion in relief.</p></div></section>
 <section class="coin-record" aria-labelledby="coin-title"><div><p class="eyebrow">03 / Bronze · Ujjain</p><h2 id="coin-title">A coin found in the city</h2></div><div><p>An Archaeological Survey of India report records a bronze coin found at Gadhkalika in Ujjain and identified as an issue of the Gupta ruler Chandragupta II. The report describes an archer on one face and Lakshmi on the other.</p><a href="https://assets.ctfassets.net/l47hkrce4wip/4Q3b4wS4hdaNQYGffR9TWu/bb26633a9b97d7f4535bbe1f8611f9d5/013_Indian_Archaeology_A_Review_1968-69.pdf" target="_blank" rel="noopener noreferrer">Archaeological report · page 60 ${arrow()}</a></div></section>
 <section class="object-section object-section-die" aria-labelledby="die-title"><div class="object-copy"><p class="eyebrow">04 / A game</p><h2 id="die-title">A die that isn’t a cube</h2><p>Ivory, incised with circles. About two inches high.</p></div><figure class="object-photo"><img src="/met-gaming-die.jpg" width="3791" height="3792" loading="lazy" alt="A long ivory gaming die with circular markings on its sides, standing upright against a gray background."><figcaption>Gaming Die · Gandhara or Afghanistan · 1st–3rd century CE · Ivory · The Metropolitan Museum of Art, 2000.284.19 · <a href="https://www.metmuseum.org/art/collection/search/38716" target="_blank" rel="noopener noreferrer">Museum record ${arrow()}</a></figcaption></figure></section>
 <section class="scholar-reading" id="scholar-reading" tabindex="-1"><header class="scholar-reading-head"><p class="eyebrow">The reading room</p><h2>Writers on the play.</h2></header>${cartScholarAllowed(book)?cartScholarship():`<div class="essay-gate"><p>These authors discuss the entire play, including its ending.</p><button class="primary" data-action="allow-cart-scholar">Allow ending spoilers ${arrow()}</button></div>`}</section><div class="scholar-end">${returnLink()}</div></section>`;
}
function cartScholarship(){return `<div class="scholar-list">
 <article class="scholar-entry"><p class="scholar-no">01 / Justice</p><div><p class="scholar-author">Amartya Sen</p><h3>Law and Ideas of Justice</h3><p class="scholar-publication"><em>New American Studies Journal</em>, 2022</p><div class="scholar-links"><button class="text" data-local-essay="sen" data-action="scholar-read" data-essay="sen" hidden>Read the essay ${arrow()}</button><a href="https://nasjournal.org/NASJ/article/download/690/1201?inline=1" target="_blank" rel="noopener noreferrer">Journal ${arrow()}</a></div></div></article>
 <article class="scholar-entry"><p class="scholar-no">02 / Society</p><div><p class="scholar-author">Chirashree Mukherjee</p><h3>Mṛcchakaṭika and the contemporary society</h3><p class="scholar-publication"><em>International Journal of Sanskrit Research</em>, 2020</p><div class="scholar-links"><a href="https://www.anantaajournal.com/archives/2020/vol6issue1/PartA/9-3-7-521.pdf" target="_blank" rel="noopener noreferrer">Journal PDF ${arrow()}</a></div></div></article>
 <article class="scholar-entry"><p class="scholar-no">03 / Stone &amp; stories</p><div><p class="scholar-author">Monika Zin</p><h3>About Visual Language, Drunken Women, Jesters and Escaping the World</h3><p class="scholar-publication"><em>Cracow Indological Studies</em>, 2022</p><div class="scholar-links"><a href="https://journals.akademicka.pl/cis/article/view/4806" target="_blank" rel="noopener noreferrer">Journal and illustrated PDF ${arrow()}</a></div></div></article>
 <article class="scholar-entry"><p class="scholar-no">04 / Gender &amp; power</p><div><p class="scholar-author">Christopher R. Austin</p><h3>The eropolitical compound: immanence, transcendence and a parasitic operation of patriarchy in Sanskrit literature</h3><p class="scholar-publication"><em>Bulletin of SOAS</em>, 2023</p><div class="scholar-links"><button class="text" data-local-essay="austin" data-action="scholar-read" data-essay="austin" hidden>Read the essay ${arrow()}</button><a href="https://www.cambridge.org/core/journals/bulletin-of-the-school-of-oriental-and-african-studies/article/eropolitical-compound-immanence-transcendence-and-a-parasitic-operation-of-patriarchy-in-sanskrit-literature/A6EEF1E4BE0DFC9B0BD732905C9FA50D" target="_blank" rel="noopener noreferrer">Journal ${arrow()}</a></div></div></article>
 <article class="scholar-entry"><p class="scholar-no">05 / The city</p><div><p class="scholar-author">Shonaleeka Kaul</p><h3>Women about Town: An Exploration of the Sanskrit Kāvya Tradition</h3><p class="scholar-publication"><em>Studies in History</em>, 2006 · Full text restricted</p><div class="scholar-links"><a href="https://journals.sagepub.com/doi/10.1177/025764300502200103" target="_blank" rel="noopener noreferrer">Abstract ${arrow()}</a></div></div></article>
 <div class="scholar-sources"><button class="text" data-action="hide-cart-scholar">Hide these essays</button></div></div>`;}

const scholarTexts={
 sen:{hash:'202e9908b4de1cc1e885aff43db23ef4ccf4b6dc6a3fe342542d9ee92de01da6',title:'Law and Ideas of Justice',author:'Amartya Sen',credit:'© 2022 Göttingen University Press, Göttingen. Reflowed from the journal’s HTML; author portrait omitted.',publication:'New American Studies Journal · 2022',url:'https://nasjournal.org/NASJ/article/view/690'},
 austin:{hash:'799714f691a6fc5856645e6265152c32a34816eefcec31dddd2b85c5cff1a23d',title:'The eropolitical compound: immanence, transcendence and a parasitic operation of patriarchy in Sanskrit literature',author:'Christopher R. Austin',credit:'© The Author(s), 2023. Published by Cambridge University Press on behalf of SOAS University of London. Reflowed from the journal’s HTML.',publication:'Bulletin of SOAS · 2023',url:'https://www.cambridge.org/core/journals/bulletin-of-the-school-of-oriental-and-african-studies/article/eropolitical-compound-immanence-transcendence-and-a-parasitic-operation-of-patriarchy-in-sanskrit-literature/A6EEF1E4BE0DFC9B0BD732905C9FA50D'}
};
let scholarTrail=[];
async function readScholar(id){
 const item=scholarTexts[id];if(!item||!cartScholarAllowed(cartBook()))return;
 const response=await fetch('/scholar-'+id+'-reader.json');if(!response.ok)throw new Error('This essay is unavailable in this preview.');
 const bytes=await response.arrayBuffer();if(bytes.byteLength>2_000_000||await sha256(bytes)!==item.hash)throw new Error('This essay does not match its reviewed source.');
 const article=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));if(article.schema!=='scholar-reader@1'||article.id!==id||typeof article.body!=='string')throw new Error('This essay could not be opened.');
 scholarTrail=[];
 openDialog(item.title,`<article class="scholar-fulltext"><header><p class="eyebrow">${esc(item.publication)}</p><h1>${esc(item.title)}</h1><p class="scholar-byline">${esc(item.author)}</p></header><button class="text scholar-back" data-action="scholar-back" hidden>Return to text</button><div class="scholar-body">${article.body}</div><footer><a href="${item.url}" target="_blank" rel="noopener noreferrer">Journal source</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> · ${esc(item.credit)}</footer></article>`);
}

function reader() {
  activeBook = bookById(route.book);
  if (!activeBook) {route = {view:'shelf'};return shelf();}
  const saved = state.positions[activeBook.id];
  activeSection = activeBook.sections.find(s => s.id === route.section) || activeBook.sections.find(s => s.id === saved?.sectionId && saved?.revision === activeBook.source.sha256) || activeBook.sections[0];
  const i = activeBook.sections.indexOf(activeSection), previous = activeBook.sections[i-1], next = activeBook.sections[i+1], unlocked = visibleThrough(state,activeBook) >= i;
  if(reviewedCart.has(activeBook)&&sourceSpoilerSections.has(activeSection.id)&&!openedSourceSections.has(activeSection.id))return `<section class="reading"><div class="source-spoiler"><h1>${esc(activeSection.title)}</h1><p>This original front matter may reveal events from the play.</p><button class="primary" data-action="open-source-section">Open this section</button> <a class="text-link" href="#shelf">Back to books</a></div></section>`;
  return `<section class="reading${reviewedCart.has(activeBook)?' cart-reading':''}"><div class="reader-tools"><div class="tool-group"><button data-action="contents">Contents</button><button data-action="background">About this work</button></div><span class="progress-label">Section ${i+1} of ${activeBook.sections.length}</span><button data-action="focus" aria-describedby="focus-help">Focus ${arrow()}</button></div><header class="reader-heading"><p class="eyebrow">${esc(activeBook.title)} · ${esc(activeBook.author)}</p><h1>${esc(activeSection.title)}</h1></header><article id="reading-text" data-book="${esc(activeBook.id)}" data-section="${esc(activeSection.id)}" class="reading-surface" lang="${esc(activeBook.language)}" aria-label="Book text"></article><div class="chapter-end"><button class="boundary-button" data-action="boundary">${unlocked ? 'Allowed in Companion · change' : 'Allow this section in Companion'}</button><nav class="chapter-links" aria-label="Sections">${previous ? `<a href="${path(activeBook.id,previous.id)}" data-section-start><span class="small">${arrow('left')} Previous</span><span class="nav-title">${esc(previous.title)}</span></a>` : '<span></span>'}${next ? `<a href="${path(activeBook.id,next.id)}" data-section-start><span class="small">Next ${arrow('right')}</span><span class="nav-title">${esc(next.title)}</span></a>` : `<a href="#shelf"><span class="small">End of this work</span>Return to your shelf ${arrow('right')}</a>`}</nav></div><p class="reader-hint">Select words to keep or share a passage. Your reading place is saved in this browser.</p></section>`;
}
function passages() {
  return `<section class="page"><header class="page-head"><h1>Saved passages</h1><p>Saved passages and connections, stored in this browser.</p>${returnLink()}</header>${state.notes.length ? `<ul class="passage-list">${[...state.notes].sort((a,b)=>b.updated-a.updated).map(n => {
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
function companion() {
  const cart=cartBook();if(cart)return cartCompanion(cart);
  const sampleWalk=hasReviewedSample('bell'),selected=currentExperiment();
  return `<section class="page${selected==='walk'?'':' companion-compact'}"><header class="page-head companion-heading"><p class="eyebrow">An optional companion</p><h1>${selected==='walk'?'A little further.':'Companion'}</h1><p>${sampleWalk?'A fictional listening walk, an index across your books, and a place to compare passages.':'Follow a word across your books, or compare passages you have kept.'}</p></header><div class="companion-top"><p class="small">Unread passages stay hidden. Set a boundary explicitly; opening an experiment never advances your reading place.</p><button class="secondary" data-action="boundaries">Choose spoiler limit</button></div>${returnLink()}<div class="experiment-tabs" role="group" aria-label="Experience prototypes">${sampleWalk?`<button data-action="experiment" data-experiment="walk" aria-pressed="${selected==='walk'}">01 &nbsp; A listening walk</button>`:''}<button data-action="experiment" data-experiment="echo" aria-pressed="${selected==='echo'}">02 &nbsp; An echo index</button><button data-action="experiment" data-experiment="facing" aria-pressed="${selected==='facing'}">03 &nbsp; Facing pages</button></div>${selected==='walk' ? walk() : selected==='echo' ? echoes() : facing()}<div class="prototype-choice"><p>Save a preference to discuss with your agent.</p><button class="secondary" data-action="choose-prototype">${state.reflections['prototype-choice']===selected ? '✓ Your preferred direction' : 'Keep this direction'}</button></div></section>`;
}
async function render({keepScroll=false}={}) {
  if(route.view==='shelf')shelfRefreshPending=false;
  const y = scrollY;hideFocusControls();fragments=[];contextPassages=[];selection = null;$('#selection-save').hidden = true;
  main.innerHTML = route.view === 'read' ? reader() : route.view === 'passages' ? passages() : route.view === 'companion' ? companion() : shelf();
  document.querySelectorAll('[data-nav]').forEach(a => a.toggleAttribute('aria-current',false));
  document.querySelector(`[data-nav="${route.view==='read'?'shelf':route.view}"]`)?.setAttribute('aria-current','page');
  applyPrefs();document.title = route.view==='read' && activeBook ? `${activeSection.title} · Reading` : cartBook() ? 'The Little Clay Cart · Reading' : 'Reading · in good company';
  if (route.view === 'read') {
    const valid = state.notes.filter(n => n.sectionId === activeSection.id && anchorStatus(n,activeBook).valid);
    if($('#reading-text'))renderText($('#reading-text'),activeSection,valid,activeBook,reviewedCart.has(activeBook));
    if ($('#reading-text')&&!keepScroll) {const pos = requestedPosition === null ? null : requestedPosition || state.positions[activeBook.id];requestedPosition = undefined;await restorePosition(pos);}
    if($('#reading-text'))$('#reading-text').dataset.positionReady='true';
  }
  for(const link of main.querySelectorAll('[data-local-essay]')){const name=link.dataset.localEssay;if(!scholarTexts[name])continue;fetch('/scholar-'+name+'-reader.json').then(response=>{if(response.ok&&response.headers.get('content-type')?.startsWith('application/json')&&link.isConnected)link.hidden=false;}).catch(()=>{});}
  for(const node of main.querySelectorAll('[data-fragment]')){const f=fragments[Number(node.dataset.fragment)];renderPassage(node,f.passage,f.book,f.hit);}
  if (keepScroll) scrollTo(0,y);else if(route.view!=='read') scrollTo(0,0);
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
  if (!dialog.open) {void savePosition();dialogOrigin = {element:document.activeElement,scroll:scrollY,hash:location.hash,bookId:activeBook?.id,position:currentPosition(),textAnchor:dialogTextAnchor(currentPosition()),layout:dialogReadingLayout()};}
  $('#dialog-content').innerHTML = `<div class="dialog-inner"><header class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2><button class="close-dialog" data-action="close">Close ×</button></header>${html}<p id="dialog-error" class="dialog-error" role="alert"></p></div>`;
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop=0;
  $('#selection-save').hidden = true;
}
function finishDialog() {
  disposePassageCard();disposePassageCard=()=>{};
  const origin=dialogOrigin;dialogOrigin=null;
  const refreshShelf=shelfRefreshPending&&route.view==='shelf';
  if(refreshShelf){shelfRefreshPending=false;void render({keepScroll:true});}
  const action=origin?.element?.dataset.action;
  const focusTarget=origin?.element?.isConnected?origin.element:refreshShelf&&action?main.querySelector(`[data-action="${CSS.escape(action)}"]`):null;
  focusTarget?.focus({preventScroll:true});
  if(origin)restoreDialogScroll(origin);
  editing=null;selection=null;selectionChoice=null;editingRangeChanged=false;bundleCandidate=null;sourceTrail=[];
  if(noticePending){noticePending=false;queueMicrotask(offerCartNotice);}
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
  openDialog('Reading settings',`<p class="small">Type size and spacing apply to books, passage context, quotations, notes and companion readings. Navigation labels stay compact.</p><div class="settings-presets"><button data-action="preset" data-preset="paper">Paper</button><button data-action="preset" data-preset="dusk">Dusk</button><button data-action="preset" data-preset="large">Large print</button></div><form id="settings-form"><label for="size">Type size · <output id="size-value">${p.size}</output> px</label><input id="size" name="size" type="range" min="17" max="36" value="${p.size}"><label for="leading">Line spacing</label><input id="leading" name="leading" type="range" min="1.3" max="2.2" step="0.1" value="${p.leading}"><div class="form-row"><div><label for="theme">Page</label><select id="theme" name="theme">${['paper','dusk','ink'].map(t=>`<option value="${t}" ${p.theme===t?'selected':''}>${t[0].toUpperCase()+t.slice(1)}</option>`).join('')}</select></div><div><label for="measure">Line length</label><select id="measure" name="measure"><option value="book" ${p.measure==='book'?'selected':''}>Book</option><option value="wide" ${p.measure==='wide'?'selected':''}>Wide</option></select></div></div><div class="dialog-actions"><button class="primary" type="submit">Apply to my reader</button></div></form><div class="settings-group"><h3>Take your reading with you.</h3><p>One private file can carry exact editions, saved passages, connections and reading places to another browser or address. It contains full books and notes, without encryption. Keep it somewhere private.</p><button class="text" data-action="bundle-export">Export a private reading bundle</button><label for="bundle-file">Restore a reading bundle</label><input id="bundle-file" type="file" accept=".json"><p class="small">Review what will be added before saving. Unsaved drafts and damaged recovery records are not included; use their separate exports.</p></div><div class="settings-group"><h3>Separate record backups.</h3><p>Export includes quotations and personal notes. Keep the file private. Book files are not included. For another device or site address, also export your exact editions below.</p><button class="text" data-action="export">Export passages & progress ${arrow()}</button><label for="restore-file">Restore a backup</label><input id="restore-file" type="file" accept=".json"><p>Restore adds missing passages and preserves conflicting edits as separate notes. It keeps this device’s progress, appearance and spoiler boundaries.</p></div><div class="settings-group"><h3>On this device.</h3><p id="offline-detail">${offlineReady ? 'The application and supplied library have been checked in the offline cache.' : 'The offline application copy is not verified yet. Reconnect and check again.'} Imported books and notes use browser storage. Storage can be cleared or evicted; keep your originals and exported notes.</p><button class="text" data-action="persist">Ask browser to retain local storage</button><button class="text" data-action="check-offline">Check offline copy</button></div>`);
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
  const customDrama=book?.profile==='little-clay-cart/drama@1'&&!reviewedCart.has(book);
  const sharing=valid&&!customDrama?`<section class="passage-sharing" aria-label="Share the quotation"><p class="small">${esc(book.author)} · ${esc(book.title)}<br>${esc(book.sections.find(s=>s.id===note.sectionId).title)}${book.edition?`<br>${esc(book.edition)}`:''}</p><div class="dialog-actions"><button type="button" class="text" data-action="share-passage">Share passage</button><button type="button" class="text" data-action="copy-passage">Copy passage</button></div><p class="small" id="share-status" role="status">Quotation and source attribution only. Your note stays private.</p><div id="share-fallback" hidden><label for="share-text">Passage with attribution · select to copy</label><textarea id="share-text" readonly rows="7" spellcheck="false"></textarea></div></section>`:customDrama?'<p class="small">Sharing is unavailable for this edition. Export it from Settings and review its source terms before sharing. Your saved passage remains here.</p>':'<p class="small">Restore the exact edition to share this passage with attribution. Your saved quotation remains available.</p>';
  openDialog(note.id ? 'Your kept passage.' : 'Keep this passage.',`<blockquote class="dialog-quote">${esc(note.quote)}</blockquote>${sharing}<form id="note-form"><label for="note-text">Your note · optional</label><textarea id="note-text" maxlength="50000" placeholder="What stays with you?">${esc(note.note||'')}</textarea><div class="dialog-actions"><button class="primary" type="submit">Save on this device</button>${note.id ? '<button type="button" class="text" data-action="delete-note">Remove passage</button>' : ''}<button type="button" class="text" data-action="export-draft">Export draft</button></div></form>`);
  if(valid&&!customDrama)disposePassageCard=mountPassageCard(dialog.querySelector('.passage-sharing'),note,book,reviewedCart.has(book)?{extraAttribution:cartShareAttribution(book,note.quote.length)}:{});
  if(valid&&reviewedCart.has(book))$('#share-status').textContent=note.quote.length<=1200?'The edition attribution and source link accompany the passage. Your note stays private.':'The full source terms accompany this passage. Your note stays private.';
  $('#dialog-title').tabIndex=-1;$('#dialog-title').focus({preventScroll:true});
}
async function sendPassage(action) {
  const sourceBook=bookById(editing.bookId),data=passageShareData(editing,sourceBook);if(reviewedCart.has(sourceBook))data.text+='\n\n'+cartShareAttribution(sourceBook,editing.quote.length).join('\n');const status=$('#share-status'),fallback=$('#share-fallback'),field=$('#share-text');
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
  const container=$('#context-text');renderText(container,section,note?[note]:[],book,reviewedCart.has(book));
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
  openDialog('Choose Companion’s spoiler limit.',`<p class="small">Choose which sections Companion may show. This does not change where you resume reading. Choose “None yet” to hide this book’s passages from Companion again.</p><form id="boundaries-form">${books.map(b=>`<label for="boundary-${b.id}">${esc(b.title)}</label><select id="boundary-${b.id}" name="${b.id}"><option value="-1">None yet</option>${b.sections.map((s,i)=>`<option value="${i}" ${visibleThrough(state,b)===i?'selected':''}>Through ${esc(s.title)}</option>`).join('')}</select>`).join('')}<div class="dialog-actions"><button class="primary" type="submit">Set my boundaries</button></div></form>`);
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
const hasReviewedSample=id=>reviewedSampleCopy.has(bookById(id));
const hasReviewedSamples=()=>[...sampleIds].every(hasReviewedSample);
const currentExperiment=()=>experiment==='walk'&&!hasReviewedSample('bell')?'echo':experiment;
async function prepareSampleCopy(){
  for(const book of books){
    if(book.id==='clay-cart-ryder-1905' && CART_EDITION!=='PENDING')try{if(await sha256(new TextEncoder().encode(canonical(book)))===CART_EDITION)reviewedCart.add(book);}catch{}
    const copy=sampleContextCopy[book.id];
    if(!copy||copy.revision!==book.source.sha256)continue;
    try{if(await sha256(new TextEncoder().encode(canonical(book)))===copy.edition)reviewedSampleCopy.add(book);}catch{/* Retain supplied context if verification is unavailable. */}
  }
}
function cartTerms(book) {
  const header=book.context.find(c=>c.label==='Gutenberg source notice')?.text||'';
  const terms=book.context.filter(c=>c.label.startsWith('Gutenberg terms')).map(c=>c.text).join('');
  const notice=terms.match(/This eBook is for[\s\S]*?before using this eBook\./)?.[0]||'';
  return [notice,header,terms].join('\n\n');
}
// This display policy applies only after the complete edition fingerprint matches.
// 1200 is the existing card limit, not a copyright or fair-use threshold.
function cartShareAttribution(book,quoteLength) {
  const source='https://www.gutenberg.org/ebooks/21020';
  return quoteLength<=1200?[source]:[cartTerms(book),source];
}

function recoverySourceNotice(references=null) {
  const exact=cartBook();
  if(exact){const anchorsMatch=Array.isArray(references)&&references.length>0&&references.every(p=>anchorStatus(p,exact).valid);
    return {title:exact.title,status:'notice-from-verified-edition',anchorsMatch,warning:anchorsMatch?'These quotations match this edition, but we have not established which edition they originally came from. Review the source before sharing.':'This notice belongs to the verified edition available in this browser. The provenance of the saved records has not been established; review them before sharing.',text:cartTerms(exact)};
  }
  const loaded=bookById('clay-cart-ryder-1905');
  const source=loaded?.context?.some(c=>c.label==='Gutenberg source notice'||c.label.startsWith('Gutenberg terms'))?cartTerms(loaded):'';
  return {title:'Source notice for recovery',status:source?'unverified-current-edition':'unavailable',
    warning:source?'The following notice came from the currently loaded edition. Its relationship to the saved quotations has not been verified. Keep the original edition and review its terms before sharing.':'The exact source notice is unavailable here. Keep this recovery file private with its original edition and review its source terms before sharing.',...(source?{text:source}:{})};
}
function withCartTerms(stateToExport) {
  const references=[...(stateToExport.notes||[]),...(stateToExport.connections||[]).flatMap(c=>c.passages||[])];
  const related=references.filter(p=>p.bookId==='clay-cart-ryder-1905'||p.revision==='a5fd5c905644f1af49d9c8c9bdbfe7a625b238ef52380320d41effb6d506a599');
  if(!related.length)return stateToExport;
  const notice=recoverySourceNotice(related);
  // Preserve unknown legacy metadata even if it is malformed; recovery must not discard it.
  if(stateToExport.sourceNotices!==undefined&&!Array.isArray(stateToExport.sourceNotices)){let key='sourceNoticeRecovery';while(Object.hasOwn(stateToExport,key))key+='_';return {...stateToExport,[key]:notice};}
  const {sourceNotices:existing=[],...rest}=stateToExport;
  return {sourceNotices:[...existing,notice],...rest};
}
// Preserve the historical raw JSON shape only when JSON round-trips every value.
function isOrdinaryRecoveryJSON(value,seen=new Set()) {
  if(value===null||typeof value==='string'||typeof value==='boolean')return true;
  if(typeof value==='number')return Number.isFinite(value)&&!Object.is(value,-0);
  if(typeof value!=='object'||seen.has(value))return false;
  if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype)return false;
  seen.add(value);const keys=Reflect.ownKeys(value);
  if(keys.some(k=>typeof k!=='string'))return false;
  if(Array.isArray(value)){if(!Object.getOwnPropertyDescriptor(value,'length')?.writable)return false;for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,i))return false;if(keys.some(key=>key!=='length'&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length)))return false;}
  for(const key of keys){if(Array.isArray(value)&&key==='length')continue;const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value')||!d.enumerable||!d.writable||!d.configurable||!isOrdinaryRecoveryJSON(d.value,seen))return false;}
  return true;
}
function recoveryNoticeMessage(value) {
  const notices=[...(Array.isArray(value?.sourceNotices)?value.sourceNotices:[]),...Object.entries(value||{}).filter(([key])=>/^sourceNoticeRecovery_*$/.test(key)).map(([,notice])=>notice)].filter(Boolean);
  return notices.some(n=>n.warning||n.status&&n.status!=='notice-from-verified-edition')?'Downloaded. Source attribution needs review; see the notice in the downloaded file before sharing.':null;
}

function offerCartNotice() {
  const book=cartBook();if(!book)return;
  try{if(localStorage.getItem('cart-notice-'+CART_EDITION)==='seen')return;}catch{}
  if(dialog.open){noticePending=true;return;}
  const header=book.context.find(c=>c.label==='Gutenberg source notice')?.text||'';
  const terms=book.context.filter(c=>c.label.startsWith('Gutenberg terms')).map(c=>c.text).join('');
  const notice=terms.match(/This eBook is for[\s\S]*?before using this eBook\./)?.[0]||header;
  openDialog('About this edition',`<div class="source-terms"><p>${esc(notice)}</p><button class="primary" data-action="cart-notice-continue">Continue</button><p class="small" id="notice-save-status" role="status"></p><details><summary>Complete source header and credits</summary><p>${esc(header)}</p></details><details><summary>Full Project Gutenberg License</summary><p>${esc(terms)}</p></details><p><a href="https://www.gutenberg.org/ebooks/21020" target="_blank" rel="noopener noreferrer">Original Gutenberg formats</a></p></div>`);
}
function backgroundText(book,context){
  const copy=sampleContextCopy[book.id];
  return reviewedSampleCopy.has(book)&&copy?.revision===book.source.sha256 ? copy.texts[book.context.indexOf(context)]??context.text : context.text;
}
function background() {
  const b=activeBook, visible=b.context.filter(c=>(c.through===null||allowed(b.id,c.through))&&(!reviewedCart.has(b)||!c.label.startsWith('Gutenberg')));
  const cartContext=reviewedCart.has(b)?'<section class="context-item"><h3>About this edition</h3><p>Arthur W. Ryder’s translation appeared in 1905 as volume 9 of the Harvard Oriental Series, edited by Charles Rockwell Lanman. The play is attributed to Śūdraka; its authorship and date remain uncertain. This reading follows Project Gutenberg’s transcription, which is not a verified facsimile of a single printed copy.</p><p>The small numbers identify verses, numbered after Parab’s edition. The small references marked P. and S. point to the editions of Parab and Stenzler; Ryder placed these references at the heads of printed pages.</p></section>':'';
  const cartSource=reviewedCart.has(b)?`<section class="context-item source-terms"><details><summary>Source header and credits</summary><p>${esc(b.context.find(c=>c.label==='Gutenberg source notice')?.text||'')}</p></details><details><summary>Full Project Gutenberg License</summary><p>${esc(b.context.filter(c=>c.label.startsWith('Gutenberg terms')).map(c=>c.text).join(''))}</p></details><p><a href="https://www.gutenberg.org/ebooks/21020" target="_blank" rel="noopener noreferrer">Original Gutenberg formats</a></p></section>`:'';
  openDialog('About this work.',`<p class="eyebrow">${esc(b.title)}</p><p class="small">${esc(b.edition)}</p>${cartContext}${cartSource}${visible.map(c=>`<section class="context-item"><p class="eyebrow">${c.kind==='editorial'?'Editorial interpretation':c.kind==='source'?'Sourced background':'Sample provenance'}</p><h3>${esc(c.label)}</h3><p class="companion-reading">${esc(backgroundText(b,c))}</p>${c.url?`<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Source</a>`:''}</section>`).join('')}<div class="context-item"><p class="eyebrow">Edition record</p><p class="small">${esc(b.source.description)}</p><p class="small">Source file SHA-256: ${b.source.sha256.slice(0,16)}…</p></div>`);
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
// Original edition references open in a separate, reversible reading surface.
function sourceReference(target) {
  const host=target.closest('[data-book]'), book=bookById(host?.dataset.book)||activeBook;
  if(!book?.sourceNotes||!target.dataset.sourceReference)return;
  const [kind,key]=target.dataset.sourceReference.split(':');
  if(kind==='anchor') {
    const here=target.closest('.reading-surface')?.querySelector(`[data-source-anchor="${CSS.escape(key)}"]`);
    if(here){here.scrollIntoView({block:'center'});return;}
  }
  let item, title;
  if(kind==='note'){item=book.sourceNotes.find(n=>n.id===key);title=item?.label;}
  if(kind==='anchor'){
    item=book.sections.find(s=>s.blocks.some(b=>(b.anchors||[]).some(a=>a.id===key)))||book.sourceNotes.find(n=>n.blocks.some(b=>(b.anchors||[]).some(a=>a.id===key)));
    title=item?.title||item?.label;
  }
  if(!item)throw new Error('This source reference is unavailable. The reading place is unchanged.');
  if(reviewedCart.has(book)&&sourceSpoilerSections.has(item.id)&&!openedSourceSections.has(item.id)){if(!confirm('This original front matter may reveal events from the play. Open it?'))return;openedSourceSections.add(item.id);}
  if(dialog.open){const old=$('#dialog-content').firstElementChild;if(old){sourceTrail.push({node:old,scroll:dialog.scrollTop,focus:target});old.remove();}}
  openDialog(title||'Source reference',`${sourceTrail.length?'<button class="text" data-action="source-back">Back to previous reference</button>':''}<article id="source-reference-text" data-book="${esc(book.id)}" class="reading-surface" aria-label="Source reference"></article>`);
  const surface=$('#source-reference-text');renderText(surface,{blocks:item.blocks},[],book,reviewedCart.has(book));
  if(kind==='anchor')surface.querySelector(`[data-source-anchor="${CSS.escape(key)}"]`)?.scrollIntoView({block:'center'});
}
async function act(target) {
  const action=target.dataset.action;
  switch(action) {
    case 'close':closeDialog();break;
    case 'scholar-read':target.focus({preventScroll:true});await readScholar(target.dataset.essay);break;
    case 'scholar-reference': {const destination=dialog.querySelector('#'+CSS.escape(target.dataset.ref||''));if(destination){scholarTrail.push({scroll:dialog.scrollTop,focus:target});dialog.querySelector('.scholar-back').hidden=false;destination.setAttribute('tabindex','-1');destination.scrollIntoView({block:'start'});destination.focus({preventScroll:true});}break;}
    case 'scholar-back': {const previous=scholarTrail.pop();if(previous){dialog.scrollTop=previous.scroll;previous.focus?.focus({preventScroll:true});}target.hidden=!scholarTrail.length;break;}
    case 'cart-notice-continue': {try{localStorage.setItem('cart-notice-'+CART_EDITION,'seen');closeDialog(true);}catch{const status=$('#notice-save-status');status.textContent='This browser could not remember the notice. It may appear again; reading remains available.';target.dataset.action='close';target.textContent='Continue reading';}break;}
    case 'source-back': {const previous=sourceTrail.pop();if(previous){$('#dialog-content').replaceChildren(previous.node);dialog.scrollTop=previous.scroll;previous.focus?.focus({preventScroll:true});}break;}
    case 'settings':await savePosition();settings();break;
    case 'import':await savePosition();importDialog();break;
    case 'offline':await savePosition();settings();break;
    case 'background':background();break;
    case 'boundaries':boundaries();break;
    case 'resume': {
      const b=bookById(target.dataset.book);if(!b)return;
      await savePosition();const pos=state.positions[b.id], section=b.sections.find(s=>s.id===pos?.sectionId&&pos?.revision===b.source.sha256)||(reviewedCart.has(b)?b.sections.find(s=>s.id==='prologue'):null)||b.sections[0];
      requestedPosition=pos;const hash=path(b.id,section.id);if(location.hash===hash){route=parseRoute();await render();}else location.hash=hash;break;
    }
    case 'open-source-section': {if(!activeSection||!activeBook||!reviewedCart.has(activeBook))return;openedSourceSections.add(activeSection.id);requestedPosition=null;await render();break;}
    case 'focus': {const pos=currentPosition();await commit(s=>{s.prefs.focus=!s.prefs.focus;return s;});hideFocusControls();await restorePosition(pos);if(state.prefs.focus)main.focus({preventScroll:true});else main.querySelector('[data-action="focus"]')?.focus({preventScroll:true});break;}
    case 'focus-reveal':showFocusControls(true);break;
    case 'focus-hide':hideFocusControls(true);break;
    case 'contents':openDialog('Contents',`<ol class="contents-list">${activeBook.sections.map((s,i)=>`<li><a href="${path(activeBook.id,s.id)}" data-section-start ${s.id===activeSection.id?'aria-current="location"':''}><span class="small">Section ${i+1}</span><span class="nav-title">${esc(s.title)}</span></a>${s.title.length>100?`<details><summary>Full section title</summary><p>${esc(s.title)}</p></details>`:''}</li>`).join('')}</ol>`);break;
    case 'boundary':boundaries();break;
    case 'allow-cart-scholar':case 'hide-cart-scholar': {const b=cartBook();if(!b)return;await commit(s=>{s.boundaries[CART_SCHOLAR_KEY]={index:action==='allow-cart-scholar'?0:-1,revision:b.source.sha256};return s;});await render({keepScroll:true});main.querySelector(action==='allow-cart-scholar'?'.scholar-entry a:not([hidden])':'[data-action=allow-cart-scholar]')?.focus({preventScroll:true});break;}
    case 'scholar-jump': {const section=main.querySelector('#'+target.dataset.target);if(section&&['objects','scholar-reading'].includes(target.dataset.target)){section.scrollIntoView({behavior:'auto',block:'start'});section.focus({preventScroll:true});}break;}
    case 'cart-view': {const b=cartBook(),asset=b?.assets.find(a=>a.id===target.dataset.asset),image=$('#cart-object-image');if(!asset||!image)return;cartImage=asset.id;image.src=`data:${asset.mediaType};base64,${asset.data}`;image.alt=asset.alt;for(const button of main.querySelectorAll('[data-action=cart-view]'))button.setAttribute('aria-pressed',String(button===target));break;}
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
      const output=withCartTerms(backup);download(output,'private-connection.reader-backup.json');const message=recoveryNoticeMessage(output);if(message)reportDownload(message,target);break;
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
    case 'export-draft': {const backup=newState();backup.notes=[{...editing,id:editing.id||crypto.randomUUID(),updated:Date.now(),note:$('#note-text').value}];const output=withCartTerms(backup);download(output,'private-draft.reader-backup.json');const message=recoveryNoticeMessage(output);if(message)reportDownload(message,target);break;}
    case 'bundle-export':await bundleExportDialog();break;
    case 'bundle-apply': {
      if(!bundleCandidate)throw new Error('Choose a bundle to review first.');
      target.disabled=true;
      try {
        const result=await restoreBundle(bundleCandidate.bundle,bundleCandidate.token,suppliedForRestore(),{appearance:$('#bundle-appearance').checked});
        state=result.state;const local=await loadBooks();mergeAvailable(local.books);await prepareSampleCopy();
        closeDialog(true);await render({keepScroll:true});offerCartNotice();say('Bundle restored on this device. Check your passages and reading places; choose companion permissions separately.');
      }finally{if(target.isConnected)target.disabled=false;}
      break;
    }
    case 'export': {const output=withCartTerms(await loadState());download(output,'private-passages.reader-backup.json');reportDownload(recoveryNoticeMessage(output)||'Backup downloaded. It contains private quotations and notes.',target);break;}
    case 'raw-export': {const raw={state:await rawState(),books:await rawBooks(),archives:await recoveryArchives()};const ordinary=isOrdinaryRecoveryJSON(raw),projections=Object.fromEntries(Object.entries(raw).filter(([,value])=>isOrdinaryRecoveryJSON(value)));const payload=ordinary?raw:{format:'personal-reader-raw-recovery-graph',schema:1,recoveryGraph:await encodeRecoveryGraph(raw),...projections};const output={sourceNotices:[recoverySourceNotice()],...payload};download(output,'private-raw-recovery.json');reportDownload(recoveryNoticeMessage(output)||'Raw recovery downloaded. It includes full local books and notes; keep it private.',target);break;}
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
  const sourceTarget=event.target.closest('[data-source-reference]');
  if(sourceTarget){event.preventDefault();try{sourceReference(sourceTarget);}catch(error){fail(error);}return;}
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
      await saveBook(book);mergeAvailable((await loadBooks()).books);await prepareSampleCopy();closeDialog();location.hash='#shelf';route={view:'shelf'};await render();offerCartNotice();say('Book added on this device. No upload was made.');
    } else if(form.id==='bundle-export-form') {
      const snapshot=await librarySnapshot(),available=bundleBooks(snapshot.books),selected=[...form.querySelectorAll('[name=edition]:checked')].map(input=>input.value);
      const bundle=await createBundle({...snapshot,books:available,state:withCartTerms(snapshot.state)},selected);
      download(bundle,'private-reading.reader-bundle.json',true);closeDialog(true);say(recoveryNoticeMessage(bundle.state)||'Private bundle downloaded. It contains saved records and your selected full editions.');
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
      await commit(s=>{for(const b of books)s.boundaries[b.id]={index:Number(values.get(b.id)),revision:b.source.sha256};return s;});closeDialog();await render({keepScroll:true});say('Companion boundaries saved. Your reading place is unchanged.');
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
// Preserve the edition's actual separators when a selection crosses styled apparatus.
// Browser-generated text for block layout can otherwise add or collapse line breaks.
document.addEventListener('copy',event=>{
  const selected=getSelection();if(!event.clipboardData||!selected?.rangeCount||selected.isCollapsed)return;
  const range=selected.getRangeAt(0);
  for(const surface of document.querySelectorAll('#reading-text,#context-text')){
    if(!surface.contains(range.startContainer)||!surface.contains(range.endContainer))continue;
    const book=bookById(surface.dataset.book),section=book?.sections.find(s=>s.id===surface.dataset.section);
    if(!reviewedCart.has(book)||!section||![...surface.querySelectorAll('.apparatus-running-reference,.apparatus-verse-number')].some(node=>range.intersectsNode(node)))return;
    const passage=readSelection(surface,book,section);if(!passage)return;
    event.clipboardData.setData('text/plain',passage.quote);event.preventDefault();return;
  }
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
window.addEventListener('hashchange',async event=>{
  const fromDialog=dialog.open;
  if(fromDialog&&!closeDialog()){history.replaceState(null,'',event.oldURL);requestedPosition=undefined;return;}
  if(!fromDialog)await savePosition();route=parseRoute();await render();main.focus({preventScroll:true});
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)void savePosition();});
window.addEventListener('pagehide',()=>{void savePosition();});
window.addEventListener('beforeunload',event=>{if(dirtyNote()||dirtyReflection()){event.preventDefault();event.returnValue='';}});
// Local reading must not depend on the optional demonstration download.
try {state=await loadState();}catch {stateDamaged=true;showWarning('Saved reader data is unreadable and has not been replaced. Use Settings to export recovery data and repair it from a valid backup.');}
try {const local=await loadBooks();books=local.books;if(local.rejected.length)showWarning(`${local.rejected.length} local book record(s) need recovery. Other books are available. Nothing was removed; export original recovery data from Settings.`);}catch {showWarning('Local books could not be opened. Stored data has not been removed. Keep original files and export your notes from Settings.');}
await prepareSampleCopy();route=parseRoute();await render();offerCartNotice();
try {
  const response=await fetch('/library.json',{signal:AbortSignal.timeout(90000)});if(!response.ok)throw new Error('Unavailable');
  const records=await response.json();if(!Array.isArray(records))throw new Error('Invalid sample library');
  const supplied=records.map(validateBook);mergeLibrary(supplied,[]);samples=supplied;mergeAvailable(books);await prepareSampleCopy();libraryLoading=false;
  // Defer a covered shelf until the dialog closes; keep active reading untouched.
  if(dialog.open&&route.view==='shelf')shelfRefreshPending=true;
  // Do not disturb a reader, selection or open import dialog when a slow download finishes.
  if(!dialog.open&&route.view==='shelf'){route=parseRoute();await render({keepScroll:route.view!=='read'});}
  else if(!dialog.open&&route.view==='passages')await render({keepScroll:true});
  else if(!dialog.open&&route.view==='companion'&&!dirtyReflection())await render({keepScroll:true});
  offerCartNotice();
}catch {showWarning('The supplied library is unavailable. Your local books and records are independent; reconnect and reload to retry.',false);}
finally {libraryLoading=false;$('#library-loading')?.remove();}
void offline();
