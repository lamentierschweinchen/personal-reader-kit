(() => {
  const first = 249;
  const last = 266;
  const key = 'newreading-montaigne-page-v1';
  const item = 'essaysofmontaign00mont';
  const archivePage = page => `https://archive.org/details/${item}/page/${page}/mode/1up`;
  const scanImage = page => `https://archive.org/download/${item}/page/${page}.jpg`;
  const validPage = page => Number.isInteger(page) && page >= first && page <= last;
  const reader = document.querySelector('#scan-reader');
  const readHeading = document.querySelector('#read-title');
  const chooser = document.querySelector('#scan-page');
  const archive = document.querySelector('#archive-page');
  const folio = document.querySelector('#scan-folio');
  const saving = document.querySelector('#scan-storage');
  const starts = document.querySelectorAll('[data-start]');
  const startButton = document.querySelector('.hero [data-start]');
  const previous = reader.querySelector('[data-step="-1"]');
  const next = reader.querySelector('[data-step="1"]');
  const readingWindow = document.querySelector('#scan-window');
  let current;
  let saved;
  let comparison;

  try {
    const page = Number(localStorage.getItem(key));
    if (validPage(page)) saved = page;
  } catch {
    saving.textContent = 'This browser cannot restore your page.';
    saving.hidden = false;
  }

  function setStartLink() {
    const page = saved ?? first;
    for (const link of starts) link.href = archivePage(page);
    startButton.firstChild.textContent = saved && saved !== first ? `Continue on page ${page} ` : 'Read the essay ';
    const start = document.querySelector('#scan-start [data-start]');
    start.firstChild.textContent = `Open page ${page} `;
  }

  function save(page) {
    try {
      localStorage.setItem(key, String(page));
      if (localStorage.getItem(key) !== String(page)) throw new Error('Page was not retained');
      saved = page;
      saving.hidden = true;
      setStartLink();
    } catch {
      saving.textContent = 'Your page couldn’t be saved in this browser.';
      saving.hidden = false;
    }
  }

  function positionZoom(viewport) {
    const page = Number(viewport.dataset.page);
    // The scan puts more paper outside the printed column on alternating leaves.
    const center = page % 2 === 1 ? 0.425 : 0.555;
    viewport.scrollLeft = viewport.scrollWidth * center - viewport.clientWidth / 2;
  }

  function setZoom(viewport, control, enlarged) {
    viewport.classList.toggle('is-enlarged', enlarged);
    if (enlarged) positionZoom(viewport);
    else viewport.scrollLeft = 0;
    control.setAttribute('aria-pressed', String(enlarged));
    control.textContent = enlarged ? 'Fit page' : 'Enlarge';
    if (enlarged) viewport.tabIndex = 0;
    else viewport.removeAttribute('tabindex');
  }

  function loadPage(viewport, message, page, onLoad) {
    const image = new Image();
    viewport.dataset.page = String(page);
    image.alt = `Original 1877 scan, printed page ${page}`;
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.hidden = true;
    viewport.querySelector('img')?.remove();
    viewport.prepend(image);
    message.textContent = `Loading page ${page}…`;
    message.hidden = false;
    image.addEventListener('load', async () => {
      await image.decode().catch(() => {});
      if (!image.isConnected) return;
      image.hidden = false;
      message.hidden = true;
      if (viewport.classList.contains('is-enlarged')) positionZoom(viewport);
      onLoad?.();
    }, { once: true });
    image.addEventListener('error', () => {
      if (!image.isConnected) return;
      message.textContent = `Page ${page} couldn’t load. `;
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Try again';
      retry.addEventListener('click', () => loadPage(viewport, message, page, onLoad), { once: true });
      message.append(retry);
    }, { once: true });
    image.src = scanImage(page);
  }

  function read(page, moveToHeading = false) {
    if (!validPage(page)) return;
    if (moveToHeading && location.hash !== '#read') history.pushState(null, '', '#read');
    reader.hidden = false;
    document.querySelector('#scan-start').hidden = true;
    const changed = page !== current;
    current = page;
    chooser.value = String(page);
    folio.textContent = `Printed page ${page}`;
    archive.href = archivePage(page);
    previous.setAttribute('aria-disabled', String(page === first));
    next.setAttribute('aria-disabled', String(page === last));
    for (const link of document.querySelectorAll('[data-read]')) {
      if (Number(link.dataset.read) === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    if (changed) {
      loadPage(readingWindow, document.querySelector('#scan-message'), page, () => save(page));
    }
    if (moveToHeading) {
      readHeading.focus({ preventScroll: true });
      document.querySelector('#read').scrollIntoView();
    }
  }

  function closeComparison(restoreFocus = false) {
    if (!comparison) return;
    const { panel, trigger } = comparison;
    panel.remove();
    trigger.setAttribute('aria-expanded', 'false');
    comparison = undefined;
    if (restoreFocus) trigger.focus();
  }

  function openComparison(page, trigger) {
    if (comparison?.trigger === trigger) {
      closeComparison(true);
      return;
    }
    closeComparison();
    const panel = document.querySelector('#comparison-template').content.firstElementChild.cloneNode(true);
    const heading = panel.querySelector('h4');
    heading.textContent = `Printed page ${page}`;
    panel.querySelector('.archive-link').href = archivePage(page);
    const viewport = panel.querySelector('.scan-window');
    const enlarge = panel.querySelector('[data-enlarge]');
    panel.querySelector('[data-close]').addEventListener('click', () => closeComparison(true));
    panel.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeComparison(true);
    });
    enlarge.addEventListener('click', () => setZoom(viewport, enlarge, enlarge.getAttribute('aria-pressed') === 'false'));
    trigger.closest('article').append(panel);
    trigger.setAttribute('aria-expanded', 'true');
    comparison = { panel, trigger };
    loadPage(viewport, panel.querySelector('.scan-message'), page);
    heading.focus({ preventScroll: true });
    panel.scrollIntoView({ block: 'start' });
  }

  setStartLink();
  for (const link of document.querySelectorAll('[data-compare]')) link.setAttribute('aria-expanded', 'false');
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[data-start], a[data-read], a[data-read-nav], a[data-compare]');
    if (!link) return;
    event.preventDefault();
    if (link.dataset.compare) openComparison(Number(link.dataset.compare), link);
    else read(Number(link.dataset.read ?? current ?? saved ?? first), true);
  });
  chooser.addEventListener('change', () => read(Number(chooser.value)));
  for (const button of [previous, next]) {
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') !== 'true') read(current + Number(button.dataset.step), true);
    });
  }
  const enlarge = reader.querySelector('[data-enlarge]');
  enlarge.addEventListener('click', () => setZoom(readingWindow, enlarge, enlarge.getAttribute('aria-pressed') === 'false'));
  if (location.hash === '#read') read(saved ?? first);
})();
