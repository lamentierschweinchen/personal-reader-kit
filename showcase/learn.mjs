const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
$$('[data-copy]').forEach(el => el.hidden = false);

// One recommendation for the AI you already use.
const routeFor = {chatgpt: 'codex', claude: 'claude', gemini: 'antigravity', none: 'codex'};
$$('input[name=ai]').forEach(r => r.addEventListener('change', () => {
  const id = routeFor[r.value];
  $$('[data-route]').forEach(el => el.hidden = el.dataset.route !== id);
}));

// Copy the first instruction.
const base = $('#starter').value, toast = $('.toast'), fallback = $('.fallback'); let timer;
$$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(base);
    toast.textContent = 'Copied. Paste it into your coding app.';
    toast.classList.add('on'); clearTimeout(timer); timer = setTimeout(() => toast.classList.remove('on'), 3000);
  } catch {
    const t = fallback.querySelector('textarea'); t.value = base; fallback.showModal(); t.select();
  }
}));
