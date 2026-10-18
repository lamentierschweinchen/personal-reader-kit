import {readDraft, personalPrompt, setupCopy, fitHeader} from '/handoff.mjs';
fitHeader();

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];

// One recommendation for the AI you already use.
const routeFor = {chatgpt: 'codex', claude: 'claude', gemini: 'antigravity', none: 'codex'};
function updateRoute() {
  const id = routeFor[$('input[name=ai]:checked')?.value] || 'codex';
  $$('[data-route]').forEach(el => el.hidden = el.dataset.route !== id);
}
$$('input[name=ai]').forEach(r => r.addEventListener('change', updateRoute));
updateRoute();
$('.learn-q').hidden = false;

// Copy the first instruction.
const starter = $('#starter'), base = starter.value;
function updatePrompt() { starter.value = personalPrompt(base, readDraft() || {}); }
updatePrompt();
const handoff = setupCopy(() => starter.value);
window.addEventListener('pageshow', () => {updateRoute(); updatePrompt(); handoff.clear();});
