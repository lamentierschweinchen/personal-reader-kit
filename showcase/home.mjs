document.documentElement.classList.add('js');
// Without JavaScript the instruction stays open and readable.
document.getElementById('prompt-box').open = false;
import {covers, moreCovers, COVER_CSS} from '/covers.mjs';
import {readDraft, saveDraft, personalPrompt, setupCopy} from '/handoff.mjs';

const data = JSON.parse(document.getElementById('data').textContent);
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
$$('[data-enhanced],[data-copy]').forEach(el => el.hidden = false);

// Hero: "love" and "money" switch the edition on the phone.
const hero = $('.hero'), cells = $$('.ed-grid i');
function setThread(key) {
  const t = data.threads[key];
  hero.dataset.thread = key;
  $$('[data-pick]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pick === key)));
  for (const k of ['label', 'name', 'count', 'quote', 'who']) hero.querySelector(`[data-text="${k}"]`).textContent = t[k];
  hero.querySelector('[data-note]').textContent = t.note;
  const max = Math.max(...t.counts);
  cells.forEach((c, i) => c.style.setProperty('--v', t.counts[i] ? (.35 + .65 * Math.min(1, t.counts[i] / (max * .6))).toFixed(2) : 0));
}
// The red-pencil circle follows the chosen word.
const ring = $('.ring'), heroText = $('.hero-text');
function placeRing(animate) {
  const b = heroText.querySelector('[data-pick][aria-pressed=true]'); if (!b) return;
  const r = b.getBoundingClientRect(), t = heroText.getBoundingClientRect(), padX = Math.max(14, r.width * .07), padY = r.height * .16;
  Object.assign(ring.style, {left: (r.left - t.left - padX) + 'px', top: (r.top - t.top - padY) + 'px', width: (r.width + padX * 2) + 'px', height: (r.height + padY * 2) + 'px'});
  if (animate) {ring.classList.remove('drawing'); void ring.getBoundingClientRect(); ring.classList.add('drawing');}
}
$$('[data-pick]').forEach(b => b.addEventListener('click', () => {setThread(b.dataset.pick); placeRing(true);}));
setThread('love');
// Measure after the headline's entrance animation settles.
document.fonts.ready.then(() => setTimeout(() => placeRing(true), 950));
heroText.addEventListener('animationend', () => placeRing(false));
if (typeof ResizeObserver === 'function') new ResizeObserver(() => placeRing(false)).observe(heroText);
else window.addEventListener('resize', () => placeRing(false));

// Any book: a slow band of distinct covers.
const style = document.createElement('style'); style.textContent = COVER_CSS; document.head.appendChild(style);
const all = [...covers, ...moreCovers];
const track = $('[data-covers]');
track.innerHTML = [...all, ...all].map(c => `<div class="cv">${c}</div>`).join('');
const coverMotion = $('[data-cover-motion]'), motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let coversPaused = false;
function updateCoverMotion() {
  coverMotion.hidden = motionPreference.matches;
  coverMotion.textContent = coversPaused ? 'Resume covers' : 'Pause covers';
  coverMotion.removeAttribute('aria-pressed');
  track.style.animationPlayState = motionPreference.matches || coversPaused ? 'paused' : 'running';
}
coverMotion.addEventListener('click', () => {coversPaused = !coversPaused; updateCoverMotion();});
if (motionPreference.addEventListener) motionPreference.addEventListener('change', updateCoverMotion);
else motionPreference.addListener(updateCoverMotion);
updateCoverMotion();

// Explore tabs: each example is its own design.
const notes = Object.fromEntries(data.explore);
const xcard = $('.mode-explore');
function pick(tab) {
  $$('[data-explore]').forEach(t => {const on = t === tab; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1;});
  $$('.panel').forEach(p => p.hidden = p.id !== 'panel-' + tab.dataset.explore);
  xcard.dataset.x = tab.dataset.explore;
  $('[data-explore-note]').textContent = notes[tab.dataset.explore];
}
$$('[data-explore]').forEach(tab => tab.addEventListener('click', () => pick(tab)));
$('.tabs').addEventListener('keydown', e => {
  if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return;
  const tabs = $$('[data-explore]'), i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  const index = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
  const next = tabs[index];
  next.focus(); pick(next);
});

// Keep an enlarged plate beside its chosen example; the link still works without JavaScript.
const illustration = $('.illustration-dialog');
let illustrationReturn = null;
if (illustration && typeof illustration.showModal === 'function') {
  $$('.plate-open').forEach(link => link.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const position = {left: scrollX, top: scrollY};
    try {
      illustration.showModal();
      illustrationReturn = {link, position};
      e.preventDefault();
    } catch { /* Retain the image link if a modal cannot open. */ }
  }));
  illustration.addEventListener('close', () => {
    if (illustration.open) return;
    const restore = illustrationReturn; illustrationReturn = null;
    if (restore?.link.isConnected) {
      restore.link.focus({preventScroll: true});
      window.scrollTo({...restore.position, behavior: 'instant'});
    }
  });
}

// Reveal sections as they arrive.
const reveals = $$('.reveal');
try {
  const io = new IntersectionObserver(es => es.forEach(e => {if (e.isIntersecting) {e.target.classList.add('in'); io.unobserve(e.target);}}), {rootMargin: '0px 0px -8% 0px'});
  reveals.forEach(el => io.observe(el));
} catch { reveals.forEach(el => el.classList.add('in')); }
document.addEventListener('focusin', e => {
  for (let el = e.target; el; el = el.parentElement) if (el.classList?.contains('reveal')) el.classList.add('in');
});

// Your starting point.
const starter = $('#starter'), base = starter.value, book = $('#book'), idea = $('#idea');
const currentDraft = () => ({book: book.value, idea: idea.value});
const handoff = setupCopy(() => personalPrompt(base, currentDraft()));
function updateDraft() {
  saveDraft(currentDraft());
  starter.value = personalPrompt(base, currentDraft());
  handoff.clear();
}
function restoreDraft() {
  const draft = readDraft();
  if (draft) {book.value = draft.book; idea.value = draft.idea;}
  starter.value = personalPrompt(base, currentDraft());
  handoff.clear();
}
restoreDraft();
book.addEventListener('input', updateDraft); idea.addEventListener('input', updateDraft);
window.addEventListener('pageshow', restoreDraft);
window.addEventListener('pagehide', () => saveDraft(currentDraft()));
$('.idea').addEventListener('submit', e => {
  e.preventDefault();
  handoff.copy($('[data-copy="personal"]'));
});
$$('[data-idea]').forEach(button => button.addEventListener('click', () => {
  const suggestion = button.dataset.idea, normalize = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const present = idea.value.split(/\r?\n/).some(line => normalize(line) === normalize(suggestion));
  const next = idea.value.trim() ? idea.value + (idea.value.endsWith('\n') ? '' : '\n') + suggestion : suggestion;
  handoff.clear();
  if (!present && next.length <= idea.maxLength) {idea.value = next; updateDraft();}
  else if (!present) $('.status').textContent = 'Your idea is full. Edit it before adding another.';
  idea.focus(); idea.setSelectionRange(idea.value.length, idea.value.length);
}));
