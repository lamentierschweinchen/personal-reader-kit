document.documentElement.classList.add('js');
// Without JavaScript the instruction stays open and readable.
document.getElementById('prompt-box').open = false;
import {covers, moreCovers, COVER_CSS} from '/covers.mjs';
import {readDraft, saveDraft, personalPrompt, setupCopy, fitHeader} from '/handoff.mjs';
fitHeader();

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
// "tap a word" points at the other edition until someone has tried it.
const tap = $('[data-tap]'), phone = matchMedia('(max-width: 820px)');
let tried = false;
function placeTap() {
  const money = heroText.querySelector('[data-pick=money]'), show = !tried && hero.dataset.thread === 'love';
  hero.classList.remove('tap-below'); tap.classList.remove('below', 'on');
  if (!show) return;
  const r = money.getBoundingClientRect(), d = money.nextElementSibling.getBoundingClientRect(), t = heroText.getBoundingClientRect();
  const pad = parseFloat(getComputedStyle(heroText).paddingRight), w = tap.offsetWidth;
  if (t.right - pad - d.right - 6 >= w) Object.assign(tap.style, {left: (d.right - t.left + 4) + 'px', top: (r.top - t.top + (r.height - tap.offsetHeight) / 2) + 'px'});
  else if (phone.matches) {
    hero.classList.add('tap-below'); tap.classList.add('below');
    Object.assign(tap.style, {left: Math.min(r.left - t.left + r.width * .45, t.width - pad - tap.offsetWidth) + 'px', top: (r.bottom - t.top + 2) + 'px'});
  } else return;
  tap.classList.add('on');
}
function choose(key, animate) {setThread(key); placeRing(animate); placeTap();}
$$('[data-pick]').forEach(b => b.addEventListener('click', () => {tried = true; stopDemo(); choose(b.dataset.pick, true);}));
setThread('love');
// Measure after the headline's entrance animation settles.
const settle = () => {placeRing(false); placeTap();};
document.fonts.ready.then(() => setTimeout(() => {placeRing(true); placeTap();}, 950));
heroText.addEventListener('animationend', settle);
if (typeof ResizeObserver === 'function') new ResizeObserver(settle).observe(heroText);
else window.addEventListener('resize', settle);

// Show the switch once: money, then back to love. Any touch, key or scroll stops it.
const device = $('.hero-device'), demo = [];
let demoStopped = false;
function stopDemo() {demoStopped = true; demo.forEach(clearTimeout); demo.length = 0; device.setAttribute('aria-live', 'polite');}
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(type, stopDemo, {once: true, passive: true});
  document.fonts.ready.then(() => {if (demoStopped) return; demo.push(setTimeout(() => {
    if (demoStopped || scrollY > 40) return;
    device.setAttribute('aria-live', 'off'); choose('money', true);
    demo.push(setTimeout(() => {choose('love', true); stopDemo();}, 2600));
  }, 2600));});
}

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
