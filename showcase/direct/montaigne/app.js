(() => {
  const key = 'newreading-montaigne-page-v1';
  const form = document.getElementById('bookmark');
  const select = document.getElementById('saved-page');
  const status = document.getElementById('bookmark-status');
  const link = document.getElementById('bookmark-open');
  const valid = value => /^(24[9]|25[0-9]|26[0-6])$/.test(value || '');
  function show(value) {
    if (!valid(value)) { link.hidden = true; return; }
    select.value = value;
    link.href = `https://archive.org/details/essaysofmontaign00mont/page/${value}/mode/1up`;
    link.textContent = `Open saved page ${value} in the scan`;
    link.hidden = false;
  }
  form.hidden = false;
  try {
    const saved = localStorage.getItem(key);
    if (saved && !valid(saved)) status.textContent = 'Saved page unreadable. Choose a page and save it again.';
    else if (saved) { show(saved); status.textContent = `Saved page ${saved}.`; }
  } catch { status.textContent = 'Saved pages are unavailable. Bookmark the scan in your browser.'; }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const value = select.value;
    if (!valid(value)) return;
    try {
      localStorage.setItem(key, value);
      if (localStorage.getItem(key) !== value) throw new Error('Page was not retained');
      show(value);
      status.textContent = `Saved page ${value} in this browser.`;
    } catch { status.textContent = 'Page could not be saved. Bookmark the scan in your browser.'; }
  });
})();
