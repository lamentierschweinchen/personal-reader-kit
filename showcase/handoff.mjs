// A small draft follows the reader between these two pages in this tab only.
const draftKey = 'newreading-starting-point-v1';
const limits = {book: 200, idea: 1000};
// Text enlargement can wrap the header. Anchor destinations must clear its actual height.
export function fitHeader() {
  const header = document.querySelector('header.top');
  if (!header) return;
  const measure = () => document.documentElement.style.setProperty('--header-clearance', Math.ceil((getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().height : 0) + 12) + 'px');
  measure();
  if (typeof ResizeObserver === 'function') new ResizeObserver(measure).observe(header);
  else addEventListener('resize', measure);
  document.fonts.ready.then(measure);
}
export function boundedDraft(value = {}) {
  return Object.fromEntries(Object.entries(limits).map(([key, limit]) => [key, typeof value[key] === 'string' ? value[key].slice(0, limit) : '']));
}
export function readDraft() {
  try {
    const raw = sessionStorage.getItem(draftKey);
    if (!raw || raw.length > 8000) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value.book !== 'string' || typeof value.idea !== 'string') return null;
    return boundedDraft(value);
  } catch { return null; }
}
export function saveDraft(value) {
  try { sessionStorage.setItem(draftKey, JSON.stringify(boundedDraft(value))); } catch { /* Copying still works when storage is unavailable. */ }
}
export function personalPrompt(base, value) {
  const draft = boundedDraft(value), book = draft.book.trim(), idea = draft.idea.trim();
  if (!book && !idea) return base;
  return base + '\n\n' + (book ? 'The book I have in mind: ' + book + '\n' : '') + (idea ? 'What I would like to make: ' + idea + '\n' : '') + 'Treat these as my starting preferences. Ask for the book files and inspect the actual edition before proposing details.';
}

export function setupCopy(getText) {
  const buttons = [...document.querySelectorAll('[data-copy]')];
  const toast = document.querySelector('.toast'), status = document.querySelector('.status');
  const fallback = document.querySelector('.fallback'), text = fallback.querySelector('textarea');
  let busy = false, revision = 0, trigger = null, timer;
  function clear() {
    revision++;
    clearTimeout(timer);
    toast.classList.remove('on'); toast.textContent = '';
    if (status) status.textContent = '';
  }
  fallback.addEventListener('close', () => {
    if (fallback.open) return;
    const restore = trigger; trigger = null;
    if (restore?.isConnected) restore.focus({preventScroll: true});
  });
  async function copy(button) {
    if (busy || fallback.open) return;
    clear();
    const value = getText(), attempt = revision;
    busy = true; button.setAttribute('aria-busy', 'true');
    try {
      await navigator.clipboard.writeText(value);
      // A draft edited while permission was pending is no longer the copied draft.
      if (attempt !== revision || value !== getText()) return;
      document.dispatchEvent(new CustomEvent('newreading:analytics', {detail: {name: 'prompt_copy', outcome: 'copied'}}));
      if (button.dataset.copy === 'personal' && status) {
        status.textContent = 'Copied. Paste it into your coding app to begin.';
      } else {
        toast.textContent = 'Copied. Paste it into your coding app.';
        toast.classList.add('on');
        timer = setTimeout(() => {toast.classList.remove('on'); toast.textContent = '';}, 3000);
      }
    } catch {
      if (attempt !== revision || value !== getText()) return;
      trigger = button; text.value = value;
      if (!fallback.open) fallback.showModal();
      document.dispatchEvent(new CustomEvent('newreading:analytics', {detail: {name: 'prompt_copy', outcome: 'fallback'}}));
      text.focus({preventScroll: true}); text.select();
    } finally {
      busy = false; button.removeAttribute('aria-busy');
    }
  }
  buttons.forEach(button => {
    button.hidden = false;
    // The form's submit handler also covers Enter in its book field.
    if (button.type !== 'submit' || !button.form) button.addEventListener('click', () => copy(button));
  });
  window.addEventListener('pagehide', clear);
  return {copy, clear};
}
