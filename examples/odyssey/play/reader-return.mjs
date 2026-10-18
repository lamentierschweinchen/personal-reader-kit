// Return to the reader route that launched this game. Never change reader records.
const key='newreading-game-return-odyssey';
let hash='';try{hash=sessionStorage.getItem(key)||'';}catch{}
if(!/^#(?:shelf|companion|passages|read\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+)$/.test(hash))hash='';
for(const a of document.querySelectorAll('a[href="../"]'))a.href='../'+hash;
// Keep an open game aware of a new offline copy without interrupting a round.
if ('serviceWorker' in navigator) {
  const workers = navigator.serviceWorker;
  let currentController = workers.controller;
  const stage = document.querySelector('#table, #game, #castle');
  let registration, checking = false, pending = false, notice;
  function showUpdate() {
    if (!pending) return;
    const playing = stage?.dataset.phase === 'playing' || stage?.dataset.mode === 'playing';
    if (!notice && !playing) {
      notice = document.createElement('aside');
      notice.id = 'game-update';
      notice.setAttribute('aria-label', 'Game update');
      // Isolate the notice from the three games' button and layout rules.
      const root = notice.attachShadow({mode: 'open'});
      root.innerHTML = `<style>
        :host{position:fixed;z-index:1000;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(440px,calc(100% - 24px));color:var(--ink,#292925);font:14px/1.35 system-ui,sans-serif}
        :host([hidden]){display:none}
        section{display:flex;align-items:center;gap:14px;padding:12px 14px;background:var(--paper,#fffaf0);border:1px solid var(--line,#655e54);box-shadow:0 4px 20px #0002}
        p{margin:0;flex:1}small{display:block;margin-top:3px;font-size:12px}
        button{flex:none;min-height:44px;min-width:44px;padding:8px 12px;font:inherit;font-weight:600;color:inherit;background:transparent;border:1px solid currentColor;border-radius:3px;cursor:pointer}
        button:focus-visible{outline:3px solid currentColor;outline-offset:3px}
        button.later{border:0;padding:8px 0;font-size:12px;font-weight:400}
        @media(max-width:350px){section{gap:8px;padding:10px}button{padding:8px}}
      </style><section><p role="status">Game update ready.<small>Reload restarts this stage.</small></p><button type="button">Reload game</button><button type="button" class="later">Later</button></section>`;
      for (const type of ['keydown', 'keyup']) root.addEventListener(type, event => event.stopPropagation());
      root.querySelector('button').addEventListener('click', () => location.reload());
      root.querySelector('.later').addEventListener('click', () => { pending = false; notice.hidden = true; });
      document.body.append(notice);
    }
    if (notice) notice.hidden = playing;
  }
  workers.addEventListener('controllerchange', () => {
    if (currentController && workers.controller && workers.controller !== currentController) {
      pending = true;
      showUpdate();
    }
    currentController = workers.controller;
  });
  if (stage) new MutationObserver(showUpdate).observe(stage, {attributes: true, attributeFilter: ['data-phase', 'data-mode']});
  async function checkUpdate() {
    if (!registration || checking || document.hidden) return;
    checking = true;
    try { await registration.update(); } catch { /* Keep the downloaded game usable offline. */ }
    finally { checking = false; }
  }
  workers.register(new URL('../sw.js', import.meta.url), {
    scope: new URL('../', import.meta.url).pathname,
    updateViaCache: 'none'
  }).then(value => { registration = value; }).catch(() => {});
  document.addEventListener('visibilitychange', checkUpdate);
  window.addEventListener('focus', checkUpdate);
  window.addEventListener('online', checkUpdate);
  setInterval(checkUpdate, 60000);
}
