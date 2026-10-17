document.documentElement.classList.add('js');
// Without JavaScript the instruction stays open and readable.
document.getElementById('prompt-box').open = false;
import {covers, moreCovers, COVER_CSS} from '/covers.mjs';

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
new ResizeObserver(() => placeRing(false)).observe(heroText);

// Any book: a slow band of distinct covers.
const style = document.createElement('style'); style.textContent = COVER_CSS; document.head.appendChild(style);
const all = [...covers, ...moreCovers];
const track = $('[data-covers]');
track.innerHTML = [...all, ...all].map(c => `<div class="cv">${c}</div>`).join('');

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
  if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
  const tabs = $$('[data-explore]'), i = tabs.indexOf(document.activeElement);
  const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
  next.focus(); pick(next);
});

// Reveal sections as they arrive.
const io = new IntersectionObserver(es => es.forEach(e => {if (e.isIntersecting) {e.target.classList.add('in'); io.unobserve(e.target);}}), {rootMargin: '0px 0px -8% 0px'});
$$('.reveal').forEach(el => io.observe(el));

// Your starting point.
const base = $('#starter').value;
$$('[data-idea]').forEach(b => b.addEventListener('click', () => {const f = $('#idea'); f.value = b.dataset.idea; f.focus();}));
function personal() {
  const book = $('#book').value.trim(), idea = $('#idea').value.trim();
  if (!book && !idea) return base;
  return base + '\n\n' + (book ? 'The book I have in mind: ' + book + '\n' : '') + (idea ? 'What I would like to make: ' + idea + '\n' : '') + 'Treat these as my starting preferences. Ask for the book files and inspect the actual edition before proposing details.';
}
const toast = $('.toast'); let timer;
const fallback = $('.fallback');
$$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
  const value = b.dataset.copy === 'personal' ? personal() : base;
  try {
    await navigator.clipboard.writeText(value);
    toast.textContent = b.dataset.copy === 'personal' ? 'Copied. Paste it into your coding app.' : 'Prompt copied. Paste it into your coding app.';
    toast.classList.add('on'); clearTimeout(timer); timer = setTimeout(() => toast.classList.remove('on'), 3000);
    if (b.dataset.copy === 'personal') $('.status').textContent = 'Copied. Paste it into your coding app to begin.';
  } catch {
    const t = fallback.querySelector('textarea'); t.value = value; fallback.showModal(); t.select();
  }
}));
