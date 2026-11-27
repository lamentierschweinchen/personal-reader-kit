import {anchorStatus, newState, validateBook} from './core.mjs';
import {loadState, updateState} from './db.mjs';
import {readSelection, renderText} from './text.mjs';

const $ = selector => document.querySelector(selector);
const verse = $('#verse');
const engravingNotes = [...$('#engraving-notes').content.cloneNode(true).children];
const endmatter = $('.endmatter');
const panel = $('#panel');
const content = $('#panel-content');
const keep = $('#keep');
const root = document.documentElement;
const templates = {
  type: `<form class="type-form">
    <label for="size">Type size</label><select id="size" name="size">
      <option value="19">Compact</option><option value="22">Standard</option><option value="26">Large</option><option value="32">Extra large</option>
    </select>
    <label for="tone">Page</label><select id="tone" name="tone"><option value="paper">Paper</option><option value="dusk">Dusk</option></select>
    <p class="error" role="alert"></p><button class="form-button">Apply</button>
  </form>`,
  note: `<blockquote class="note-quote"></blockquote><form class="note-form">
    <label for="note-text">Note <span class="fine">(optional)</span></label><textarea id="note-text" name="note" maxlength="50000"></textarea>
    <p class="fine">Saved in this browser.</p>
    <p class="error" role="alert"></p><button class="form-button">Save passage</button>
  </form>`
};
const plates = {
  frontispiece: {title: '“Buy from us with a golden curl”', file: 'frontispiece.webp', alt: 'Laura holds her hair before animal-headed goblins and platters of fruit. A figure with a pitcher looks back from the far left.', credit: 'Frontispiece · Dante Gabriel Rossetti · 1862'},
  title: {title: '“Golden head by golden head”', file: 'title-page.webp', alt: 'Two sisters embrace in bed. A circular inset shows goblins carrying fruit at night. The book title and imprint surround the scene.', credit: 'Illustrated title page · Dante Gabriel Rossetti · 1862'}
};
let book, section, layout, state = newState(), selected, edit, panelOrigin, scrollTimer, noticeTimer, saving = false, focusReturn;
let focusPointer, suppressPlace = false;

function warn(message) {
  const el = $('#storage-error');
  el.hidden = false;
  el.textContent = message;
}
function say(message) {
  clearTimeout(noticeTimer);
  $('#announcement').textContent = message;
  noticeTimer = setTimeout(() => { $('#announcement').textContent = ''; }, 3500);
}
function line(id) { return document.getElementById(id); }
function edge() {
  const bar = root.classList.contains('focused') ? $('.quiet-bar') : $('.bar');
  return bar.getBoundingClientRect().bottom + 16;
}
function capture() {
  const top = edge();
  const first = verse.firstElementChild;
  const last = verse.lastElementChild;
  if (!first || last.getBoundingClientRect().bottom <= top) return null;
  const active = [...verse.children].find(el => el.getBoundingClientRect().bottom > top);
  const precedingLine = active.dataset.after;
  if (precedingLine) return {sectionId: section.id, blockId: precedingLine, ratio: 0, revision: book.source.sha256};
  const rect = active.getBoundingClientRect();
  return {sectionId: section.id, blockId: active.id, ratio: Math.max(0, (top - rect.top) / rect.height), revision: book.source.sha256};
}
function restore(pos) {
  if (pos?.revision !== book?.source.sha256 || !pos.blockId) return false;
  const el = line(pos.blockId);
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  scrollBy(0, rect.top + pos.ratio * rect.height - edge());
  return true;
}
function refreshStart() {
  const continuing = state.positions[book.id]?.revision === book.source.sha256;
  $('#read-link span').textContent = continuing ? 'Continue reading' : 'Read the poem';
  $('#from-start').hidden = !continuing;
}
async function savePlace() {
  const pos = capture();
  if (!pos || suppressPlace || panel.open || verse.getBoundingClientRect().top > innerHeight * .75) return;
  if (scrollY < 4 && !root.classList.contains('focused')) return;
  const previous = state.positions[book.id];
  if (previous?.blockId === pos.blockId && Math.abs(previous.ratio - pos.ratio) < .015) return;
  try {
    state = await updateState(latest => {
      latest.positions[book.id] = pos;
      latest.lastBook = book.id;
      return latest;
    });
    refreshStart();
  } catch {
    warn('Your reading place could not be saved in this browser.');
  }
}
function applyPrefs() {
  root.style.setProperty('--verse-size', `${state.prefs.size === 21 ? 22 : state.prefs.size}px`);
  root.dataset.tone = state.prefs.theme;
}
function renderVerse(container, blocks, notes = []) {
  renderText(container, {...section, blocks}, notes);
  for (const block of [...container.children]) {
    const [indent, stanza, page, smallCaps] = layout[block.dataset.block];
    const wrap = document.createElement('div');
    wrap.className = stanza ? 'verse-line stanza' : 'verse-line';
    wrap.style.setProperty('--indent', `${indent}em`);
    if (container === verse) {
      wrap.id = block.dataset.block;
      wrap.tabIndex = -1;
      if (page) {
        const folio = document.createElement('span');
        folio.className = 'folio';
        folio.dataset.page = page;
        folio.setAttribute('aria-hidden', 'true');
        wrap.append(folio);
      }
    }
    if (smallCaps) {
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      const start = walker.nextNode();
      let end = start, offset = smallCaps;
      while (offset > end.length) {
        offset -= end.length;
        end = walker.nextNode();
      }
      const range = new Range();
      range.setStart(start, 0);
      range.setEnd(end, offset);
      const cap = document.createElement('span');
      cap.className = 'smallcaps';
      cap.append(range.extractContents());
      range.insertNode(cap);
    }
    block.before(wrap);
    wrap.append(block);
  }
}
function draw() {
  renderVerse(verse, section.blocks, state.notes.filter(note => anchorStatus(note, book).valid));
  for (const engraving of engravingNotes) line(engraving.dataset.after).after(engraving);
}
function showLine(id) {
  const el = line(id);
  if (!el) return;
  el.focus({preventScroll: true});
  el.scrollIntoView({block: 'start'});
}
function begin() {
  $('#poem-title').focus({preventScroll: true});
  $('.poem-head').scrollIntoView();
}
function revealExit() {
  $('.quiet-exit').classList.add('revealed');
}
function setFocus(on, {restorePlace = true} = {}) {
  const pos = restorePlace ? capture() : null;
  const wasReading = verse.getBoundingClientRect().top < innerHeight * .75;
  root.classList.toggle('focused', on);
  $('.quiet-bar').hidden = !on;
  $('.quiet-exit').classList.remove('revealed');
  if (restorePlace && wasReading && restore(pos)) return;
  if (on) begin();
}
async function toggleFocus(opener = document.activeElement) {
  if (!book) return;
  const on = !root.classList.contains('focused');
  if (on) {
    focusReturn = opener;
    history.replaceState(null, '', '#poem');
  }
  setFocus(on);
  if (on) $('#poem-title').focus({preventScroll: true});
  else (focusReturn?.isConnected ? focusReturn : $('.bar [data-focus]')).focus({preventScroll: true});
  try {
    state = await updateState(latest => { latest.prefs.focus = on; return latest; });
  } catch {
    warn('Your Focus setting could not be saved in this browser.');
  }
}
function readPicked() {
  if (!book || panel.open) return;
  selected = readSelection(verse, book, section);
  keep.hidden = !selected;
}
function openPanel(title, {className = '', opener = document.activeElement} = {}) {
  if (!panel.open) {
    panelOrigin = {control: opener, y: scrollY, viewport: innerWidth, pos: book && capture(),
      endOffset: endmatter.getBoundingClientRect().top};
    clearTimeout(scrollTimer);
    panel.showModal();
    root.classList.add('modal');
  }
  $('#panel-title').textContent = title;
  panel.className = className;
  content.replaceChildren();
  panel.scrollTop = 0;
  $('#close-panel').focus({preventScroll: true});
  return content;
}
function closePanel() {
  panel.close();
  finishPanelClose();
}
function requestPanelClose() {
  if (saving) return;
  const field = $('#note-text');
  if (field && edit && field.value !== (edit.note || '') && !confirm('Discard this unsaved note?')) {
    field.focus({preventScroll: true});
    return;
  }
  closePanel();
}
function showNote(note, opener) {
  edit = note;
  const box = openPanel(note.id ? 'Edit passage' : 'Keep a passage', {opener});
  box.innerHTML = templates.note;
  box.querySelector('blockquote').textContent = note.quote;
  $('#note-text').value = note.note || '';
}
function showNotes(opener) {
  const box = openPanel('Notes', {opener});
  const notes = state.notes.filter(note => note.bookId === book?.id);
  if (!notes.length) {
    box.textContent = 'Select words in the poem to keep a passage.';
    return;
  }
  for (const note of notes) {
    const item = document.createElement('section');
    item.className = 'saved-note';
    item.innerHTML = `<blockquote class="note-quote"></blockquote><p></p><div class="note-actions"></div>`;
    item.querySelector('blockquote').textContent = note.quote;
    item.querySelector('p').textContent = note.note;
    const actions = item.querySelector('.note-actions');
    if (anchorStatus(note, book).valid) {
      const context = document.createElement('button');
      context.className = 'line-link';
      context.textContent = 'Read in context';
      context.onclick = () => showNoteContext(note);
      actions.append(context);
    }
    const button = document.createElement('button');
    button.className = 'line-link';
    button.textContent = 'Edit note';
    button.onclick = () => showNote(note);
    actions.append(button);
    box.append(item);
  }
}
function renderExcerpt(box, start, end, note) {
  const blocks = section.blocks;
  const firstPage = blocks.slice(0, start + 1).findLast(block => layout[block.id][2]);
  const page = layout[firstPage.id][2];
  box.querySelector('.passage-reference').textContent = `First edition · p. ${page} · line ${start + 1}`;
  renderVerse(box.querySelector('.excerpt'), blocks.slice(Math.max(0, start - (note ? 2 : 0)), end + 1 + (note ? 2 : 0)), note ? [note] : []);
}
function showNoteContext(note) {
  const blocks = section.blocks;
  const start = blocks.findIndex(block => block.id === note.segments[0].blockId);
  const end = blocks.findIndex(block => block.id === note.segments.at(-1).blockId);
  const box = openPanel('Saved passage');
  box.innerHTML = `<p class="fine passage-reference"></p><blockquote class="excerpt"></blockquote>`;
  renderExcerpt(box, start, end, note);
  const back = document.createElement('button');
  back.className = 'line-link';
  back.textContent = 'Back to notes';
  back.onclick = () => showNotes();
  box.append(back);
}
function showPlate(key, opener) {
  const plate = plates[key];
  const box = openPanel(plate.title, {className: 'plate-panel', opener});
  box.innerHTML = `<button type="button" class="line-link" aria-pressed="false">Zoom in</button><figure class="plate-view"><div class="plate-scroll"><img></div><figcaption class="fine"></figcaption></figure>`;
  const img = box.querySelector('img');
  img.src = plate.file;
  img.alt = plate.alt;
  box.querySelector('figcaption').textContent = plate.credit;
  const zoom = box.querySelector('button');
  zoom.onclick = () => {
    const expanded = panel.classList.toggle('zoom');
    zoom.textContent = expanded ? 'Fit to window' : 'Zoom in';
    zoom.setAttribute('aria-pressed', String(expanded));
    const viewport = box.querySelector('.plate-scroll');
    viewport.tabIndex = expanded ? 0 : -1;
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-label', 'Engraving detail');
    if (!expanded) viewport.scrollTo(0, 0);
  };
}
function showType(opener) {
  openPanel('Reading type', {opener}).innerHTML = templates.type;
  $('#size').value = state.prefs.size === 21 ? '22' : state.prefs.size;
  $('#tone').value = state.prefs.theme;
}
function showSources(opener) {
  openPanel('Sources & credits', {opener}).append($('#sources').content.cloneNode(true));
}
function withoutSelection() {
  getSelection()?.removeAllRanges();
  selected = null;
  keep.hidden = true;
}

function finishPanelClose() {
  const origin = panelOrigin;
  panelOrigin = null;
  edit = null;
  root.classList.remove('modal');
  if (!origin) return;
  if (origin.viewport === innerWidth && !origin.reflow) scrollTo(0, origin.y);
  else if (!restore(origin.pos) && origin.endOffset < innerHeight) {
    scrollBy(0, endmatter.getBoundingClientRect().top - origin.endOffset);
  } else if (!origin.pos) scrollTo(0, origin.y);
  if (origin.control?.isConnected && !origin.control.hidden) origin.control.focus({preventScroll: true});
  else if (origin.pos?.blockId) line(origin.pos.blockId)?.focus({preventScroll: true});
}
panel.addEventListener('close', () => {
  if (!panel.open && panelOrigin) finishPanelClose();
});
$('#close-panel').addEventListener('click', requestPanelClose);
panel.addEventListener('cancel', event => {
  event.preventDefault();
  requestPanelClose();
});

// Only a completed gesture that began on the open backdrop can dismiss the panel.
function enableBackdropDismissal() {
  let press, released;
  const pointers = new Set();
  const reset = () => { press = released = null; };
  const onBackdrop = event => {
    const rect = panel.getBoundingClientRect();
    return panel.open && panel.matches(':modal') && rect.width > 0 && rect.height > 0 &&
      document.elementFromPoint(event.clientX, event.clientY)?.closest('dialog') === panel &&
      (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom);
  };
  const moved = event => Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8;
  document.addEventListener('pointerdown', event => {
    reset();
    pointers.add(event.pointerId);
    if (pointers.size === 1 && event.isPrimary && event.button === 0 && onBackdrop(event)) {
      press = {id: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY};
    }
  }, true);
  document.addEventListener('pointermove', event => {
    if (press?.id === event.pointerId && (moved(event) || !onBackdrop(event))) reset();
  }, true);
  document.addEventListener('pointerup', event => {
    const completed = press?.id === event.pointerId && pointers.size === 1 &&
      event.button === 0 && !moved(event) && onBackdrop(event);
    released = completed ? press : null;
    press = null;
    pointers.delete(event.pointerId);
  }, true);
  document.addEventListener('pointercancel', event => { pointers.delete(event.pointerId); reset(); }, true);
  document.addEventListener('lostpointercapture', event => { if (press?.id === event.pointerId) reset(); }, true);
  for (const type of ['scroll', 'wheel', 'contextmenu', 'keydown', 'close']) {
    document.addEventListener(type, reset, {capture: true, passive: true});
  }
  window.addEventListener('blur', () => { pointers.clear(); reset(); });
  new MutationObserver(reset).observe(panel, {attributes: true, attributeFilter: ['open']});
  document.addEventListener('click', event => {
    const start = released;
    reset();
    if (!start || event.detail === 0 || event.button !== 0 || !panel.open || !panel.matches(':modal') ||
        event.target.closest?.('dialog') !== panel || (event.pointerType === start.type && event.pointerId !== start.id)) return;
    // A touch click may shift inward; the physical down and up established the gesture.
    event.preventDefault();
    event.stopImmediatePropagation();
    requestPanelClose();
  }, true);
}
enableBackdropDismissal();

keep.addEventListener('pointerdown', event => event.preventDefault());
keep.addEventListener('click', () => {
  if (!selected) return;
  showNote(selected, keep);
  withoutSelection();
  $('#note-text').focus({preventScroll: true});
});
document.addEventListener('selectionchange', readPicked);
verse.addEventListener('pointerup', readPicked);
document.addEventListener('click', event => {
  const control = event.target.closest('button, a');
  if (!control) return;
  if ('focus' in control.dataset) toggleFocus(control);
  if (control.dataset.dialog === 'notes') showNotes(control);
  if (control.dataset.dialog === 'type') showType(control);
  if (control.dataset.dialog === 'sources') showSources(control);
  if (control.dataset.plate) showPlate(control.dataset.plate, control);
  if (control.id === 'read-link' && book) {
    event.preventDefault();
    history.replaceState(null, '', '#poem');
    if (!restore(state.positions[book.id])) begin();
    else line(state.positions[book.id].blockId)?.focus({preventScroll: true});
  }
  if (control.id === 'from-start' || control.classList.contains('skip')) {
    event.preventDefault();
    history.replaceState(null, '', '#poem');
    begin();
  }
});
window.addEventListener('hashchange', () => {
  if (location.hash === '#poem') begin();
  else if (/^#line-\d+$/.test(location.hash)) showLine(location.hash.slice(1));
});
document.addEventListener('pointerdown', event => {
  if (!root.classList.contains('focused') || panel.open || event.target.closest('button, a') || !getSelection()?.isCollapsed) return;
  focusPointer = {x: event.clientX, y: event.clientY, started: performance.now(), pointer: event.pointerId};
});
document.addEventListener('pointercancel', () => { focusPointer = null; });
document.addEventListener('pointerup', event => {
  if (!focusPointer || focusPointer.pointer !== event.pointerId) return;
  const {x, y, started} = focusPointer;
  focusPointer = null;
  if (Math.hypot(x - event.clientX, y - event.clientY) < 8 && performance.now() - started < 350 && getSelection()?.isCollapsed) revealExit();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !panel.open && root.classList.contains('focused')) toggleFocus();
});
window.addEventListener('scroll', () => {
  if (panel.open || !book) return;
  $('.quiet-exit').classList.remove('revealed');
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(savePlace, 170);
}, {passive: true});
content.addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  const form = event.target;
  const error = form.querySelector('.error');
  const submit = form.querySelector('button');
  if (form.className === 'type-form') {
    const settings = new FormData(form);
    saving = true;
    submit.disabled = true;
    $('#close-panel').disabled = true;
    try {
      state = await updateState(latest => {
        latest.prefs.size = Number(settings.get('size'));
        latest.prefs.theme = settings.get('tone');
        return latest;
      });
      applyPrefs();
      panelOrigin.reflow = true;
      closePanel();
    } catch {
      error.textContent = 'Your reading type could not be saved. Try again.';
    } finally {
      saving = false;
      submit.disabled = false;
      $('#close-panel').disabled = false;
    }
    return;
  }
  if (form.className !== 'note-form') return;
  const original = edit;
  const note = {...original, id: original.id || crypto.randomUUID(), note: $('#note-text').value};
  saving = true;
  submit.disabled = true;
  $('#close-panel').disabled = true;
  try {
    state = await updateState(latest => {
      const prior = latest.notes.find(item => item.id === note.id);
      if (original.id && prior?.updated !== original.updated) throw new Error('conflict');
      note.updated = Math.max(Date.now(), (prior?.updated || 0) + 1);
      latest.notes = [...latest.notes.filter(item => item.id !== note.id), note];
      return latest;
    });
    draw();
    closePanel();
    say('Passage saved');
  } catch (reason) {
    error.textContent = reason.message === 'conflict' ? 'This note changed in another tab. Copy your draft before reopening it.' : 'Your passage could not be saved. The draft is still here.';
    error.scrollIntoView({block: 'nearest'});
  } finally {
    saving = false;
    submit.disabled = false;
    $('#close-panel').disabled = false;
  }
});

try {
  const response = await fetch('edition.json');
  if (!response.ok) throw new Error('Edition unavailable.');
  const data = await response.json();
  book = validateBook(data.book);
  section = book.sections[0];
  layout = data.layout;
  try { state = await loadState(); }
  catch { warn('Saved records could not be opened. You can still read the poem.'); }
  applyPrefs();
  draw();
  refreshStart();
  $('#load-message').hidden = true;
  endmatter.hidden = false;
  await document.fonts.ready;
  suppressPlace = true;
  if (state.prefs.focus && location.hash !== '#cover') {
    setFocus(true, {restorePlace: false});
    if (!/^#line-\d+$/.test(location.hash)) restore(state.positions[book.id]);
  }
  if (/^#line-\d+$/.test(location.hash)) showLine(location.hash.slice(1));
  else if (location.hash === '#poem' && !restore(state.positions[book.id])) begin();
  requestAnimationFrame(() => { suppressPlace = false; verse.dataset.ready = 'true'; });
} catch {
  $('#load-message').textContent = 'The poem could not be opened. Reload this page to try again.';
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
