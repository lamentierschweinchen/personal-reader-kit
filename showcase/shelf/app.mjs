// Native scrolling owns touch gestures. Only activation turns a book; pointer
// focus, dragging and swiping must never change the selection.
const root = document.querySelector('#samples.mixed-library');
if (root) enhanceShelf(root);

function enhanceShelf(root) {
  const picks = [...root.querySelectorAll('[data-shelf-book]')];
  const volumes = [...root.querySelectorAll('[data-volume]')];
  const details = root.querySelector('#chosen-book');
  const status = root.querySelector('#selection-status');
  const bookcase = root.querySelector('.bookcase');
  const controls = [...root.querySelectorAll('[data-shelf-step]')];
  const templates = new Map([...root.querySelectorAll('template[data-shelf-detail]')].map(t=>[t.dataset.shelfDetail,t]));
  if (!picks.length || !details || !status || !bookcase || picks.some(p=>!templates.has(p.dataset.shelfBook))) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 1100px)');
  let chosen = picks[0].dataset.shelfBook;
  let open = volumes.filter(v=>v.classList.contains('is-faceout')).map(v=>v.dataset.volume);
  let fade;

  function renderSelection() {
    const visible = narrow.matches ? [chosen] : open;
    volumes.forEach((v,i) => {
      v.classList.toggle('is-faceout', visible.includes(v.dataset.volume));
      v.classList.toggle('is-selected', v.dataset.volume === chosen);
      picks[i].setAttribute('aria-pressed', String(v.dataset.volume === chosen));
    });
    const index = picks.findIndex(p=>p.dataset.shelfBook === chosen);
    controls.forEach(b=>b.disabled = Number(b.dataset.shelfStep)<0 ? index===0 : index===picks.length-1);
  }

  function revealSelected(animate=true) {
    if (!narrow.matches) { bookcase.scrollLeft = 0; return; }
    const selected = volumes.find(v=>v.dataset.volume === chosen);
    const left = bookcase.scrollLeft + selected.getBoundingClientRect().left - bookcase.getBoundingClientRect().left - parseFloat(getComputedStyle(bookcase).paddingLeft);
    bookcase.scrollTo({left:Math.max(0,Math.min(left,bookcase.scrollWidth-bookcase.clientWidth)), behavior:reduced.matches || !animate ? 'instant' : 'smooth'});
  }

  function choose(index) {
    const id = picks[index]?.dataset.shelfBook;
    if (!id) return;
    if (id === chosen) { revealSelected(); return; }
    root.classList.add('shelf-interacted');
    chosen = id;
    if (!open.includes(id)) { open.shift(); open.push(id); }
    renderSelection();
    details.replaceChildren(templates.get(id).content.cloneNode(true));
    status.textContent = details.querySelector('h3').textContent + ' selected. Read this edition below the shelf.';
    fade?.cancel();
    if (!reduced.matches) fade = details.animate([{opacity:.5},{opacity:1}],{duration:200,easing:'ease-out'});
    revealSelected();
  }

  picks.forEach((p,i) => {
    p.addEventListener('click',()=>choose(i));
    p.addEventListener('keydown',e=>{
      let next;
      if (e.key === 'ArrowRight') next = (i+1)%picks.length;
      if (e.key === 'ArrowLeft') next = (i-1+picks.length)%picks.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = picks.length-1;
      if (next !== undefined) {
        e.preventDefault();
        picks[next].focus({preventScroll:true});
        choose(next);
      }
    });
  });
  controls.forEach(b=>b.addEventListener('click',()=>choose(picks.findIndex(p=>p.dataset.shelfBook === chosen)+Number(b.dataset.shelfStep))));
  narrow.addEventListener('change',()=>{
    root.classList.remove('shelf-interacted');
    renderSelection();
    revealSelected(false);
  });
  reduced.addEventListener('change',()=>{ if (reduced.matches) { fade?.cancel(); revealSelected(false); } });

  // The static reading links remain available if this module fails to load.
  // Reveal controls only after all their data and handlers are ready.
  renderSelection();
  root.querySelector('.shelf-interactive').hidden = false;
  root.querySelector('.shelf-fallback').hidden = true;
}
