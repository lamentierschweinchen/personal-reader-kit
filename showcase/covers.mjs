// Ten single-book covers, each in its own style. A copy of the covers in
// explainer.html (kept there unchanged); used by the stills.
export const COVER_CSS = `.cover {position: absolute; left: 0; top: 0; width: 400px; height: 560px; border-radius: 4px 12px 12px 4px; overflow: hidden; box-shadow: inset 14px 0 0 rgba(0,0,0,.16), 0 30px 50px -26px rgba(40,30,10,.55); transform-origin: 50% 60%;}
  .cover .t {position: absolute; left: 56px; right: 40px;}
  .cover .a {position: absolute; left: 56px; bottom: 40px; font: 500 16px var(--sans); letter-spacing: .18em; text-transform: uppercase;}`;
export const covers = [
  `<div class="cover" style="background:#e7eef0;color:#17263b"><div class="t" style="top:70px;text-align:center;left:40px;font:400 54px/1.05 Didot,serif">Pride<br><i style="font-size:34px">and</i><br>Prejudice</div><div style="position:absolute;left:90px;right:76px;top:300px;border-top:1px solid #b89b5e;border-bottom:1px solid #b89b5e;height:6px"></div><div class="a" style="left:0;right:0;text-align:center;padding-left:14px">Jane Austen</div></div>`,
  `<div class="cover" style="background:#0f2236;color:#f1ece0"><svg style="position:absolute;left:0;bottom:0" width="400" height="300" viewBox="0 0 400 300">${[0, 1, 2, 3, 4].map(i => `<path d="M0 ${80 + i * 46} q50 -26 100 0 t100 0 t100 0 t100 0" fill="none" stroke="#f1ece0" stroke-width="2" opacity="${.7 - i * .12}"/>`).join('')}<path d="M120 90 q80 -70 170 -10 q-40 10 -60 40 q-50 -30 -110 -30z" fill="#f1ece0"/></svg><div class="t" style="top:64px;font:700 64px/1 Rockwell,Georgia,serif;letter-spacing:-.01em">MOBY-<br>DICK</div><div class="a" style="top:220px;bottom:auto;color:#9fb7cc">Herman Melville</div></div>`,
  `<div class="cover" style="background:#ffe500;color:#111"><div style="position:absolute;left:0;right:0;top:0;height:30px;background:repeating-conic-gradient(#111 0 25%,#fff 0 50%) 0 0/30px 30px"></div><div class="t" style="top:90px;font:900 96px/.9 Futura,sans-serif">${[...'ALICE'].map((c, i) => `<span style="display:inline-block;transform:rotate(${[-8, 6, -4, 9, -6][i]}deg);color:${['#ff2e88', '#00a99d', '#111', '#ff2e88', '#00a99d'][i]}">${c}</span>`).join('')}</div><div class="t" style="top:200px;font:800 22px Futura,sans-serif;letter-spacing:.14em">IN WONDERLAND</div><div style="position:absolute;right:40px;bottom:90px;width:96px;height:132px;background:#fff;border:4px solid #111;border-radius:10px;transform:rotate(10deg);color:#ff2e88;font:900 64px Futura;display:grid;place-items:center">♥</div><div class="a">Lewis Carroll</div></div>`,
  `<div class="cover" style="background:#e8ddc4;color:#233a29"><div class="t" style="top:80px;font:400 70px/1 'American Typewriter',monospace">Walden</div><div class="t" style="top:170px;font:italic 22px Charter,serif">or, Life in the Woods</div><svg style="position:absolute;left:150px;top:260px" width="160" height="160" viewBox="0 0 34 34"><path d="M17 31C9 24 6 16 10 6c5 4 13 7 14 16-1 5-4 7-7 9z" fill="#3f6b48"/><path d="M17 31C16 22 14 14 10 6" stroke="#e8ddc4" stroke-width="1" fill="none"/></svg><div class="a">Henry David Thoreau</div></div>`,
  `<div class="cover" style="background:#f6f1e7;color:#20221e"><div class="t" style="top:70px;font:400 44px/1.05 'Iowan Old Style',serif">Die Stimmen von</div><div class="t" style="top:170px;font:800 62px/1 'Avenir Next Condensed',sans-serif;letter-spacing:-.03em">Marrakesch.</div><svg style="position:absolute;left:120px;top:280px" width="170" height="170" viewBox="0 0 26 26"><circle cx="13" cy="13" r="12" fill="#b7432f"/><rect x="13" y="7" width="7" height="7" fill="#f6f1e7"/></svg><div class="a">Elias Canetti</div></div>`,
  `<div class="cover" style="background:#1b1915;color:#ece0c8"><div class="t" style="top:80px;font:400 58px/1.05 Baskerville,serif">The Sound<br>and the<br><span style="color:#e08a5a">Fury</span></div><div class="a" style="color:#a89c86">William Faulkner</div></div>`,
  `<div class="cover" style="background:#111a12;color:#b6ff4d"><div class="t" style="top:60px;font:800 60px/1 'Avenir Next Condensed',sans-serif;letter-spacing:.02em">FRANKENSTEIN</div><svg style="position:absolute;left:40px;top:250px" width="320" height="180" viewBox="0 0 320 180"><path d="M10 90 L80 90 L100 30 L130 150 L160 50 L185 120 L205 90 L310 90" fill="none" stroke="#b6ff4d" stroke-width="5" stroke-linejoin="round"/></svg><div class="a" style="color:#e8f5d4">Mary Shelley</div></div>`,
  `<div class="cover" style="background:#c41e2e;color:#efe8da"><div style="position:absolute;left:-40px;top:200px;width:520px;height:90px;background:#151413;transform:rotate(-12deg)"></div><div class="t" style="top:70px;font:800 80px/1 'Avenir Next Condensed',sans-serif">CAPITAL</div><div class="t" style="top:330px;font:700 20px 'Avenir Next Condensed',sans-serif;letter-spacing:.2em">A CRITIQUE OF POLITICAL ECONOMY</div><div class="a">Karl Marx</div></div>`,
  `<div class="cover" style="background:#f1f4f5;color:#1d2a33"><div class="t" style="top:80px;font:400 26px Didot,serif;letter-spacing:.24em;white-space:nowrap">ALSO SPRACH</div><div class="t" style="top:130px;font:400 66px/1 Didot,serif">Zarathustra</div><svg style="position:absolute;left:0;bottom:90px" width="400" height="150" viewBox="0 0 400 150"><path d="M0 150 L0 110 L80 50 L140 90 L220 10 L280 70 L340 40 L400 100 L400 150Z" fill="#dfe7ea"/><path d="M0 110 L80 50 L140 90 L220 10 L280 70 L340 40 L400 100" fill="none" stroke="#1d2a33" stroke-width="2"/></svg><div class="a">Friedrich Nietzsche</div></div>`,
  `<div class="cover" style="background:#c2643a;color:#1a1410"><div style="position:absolute;left:30px;right:30px;top:30px;height:34px;background:repeating-linear-gradient(90deg,#1a1410 0 18px,transparent 18px 36px)"></div><div class="t" style="top:120px;font:400 74px/1 'Bodoni 72',serif;letter-spacing:.06em">THE<br>ODYSSEY</div><svg style="position:absolute;left:140px;top:300px" width="130" height="150" viewBox="0 0 26 30"><path d="M8 2h10l-2 6c5 3 6 9 4 14-2 5-5 7-7 7s-5-2-7-7c-2-5-1-11 4-14z" fill="#1a1410"/></svg><div class="a">Homer</div></div>`,
];

// More single books, drawn from a few cover templates so a pile looks varied.
const MORE = [
  ['Middlemarch', 'George Eliot', 'frame', '#6b2737', '#f3e3c2'], ['Jane Eyre', 'Charlotte Brontë', 'serif', '#2e3a2f', '#e9dfc8'],
  ['Dracula', 'Bram Stoker', 'cond', '#0d0d0d', '#d9202b'], ['The Great Gatsby', 'F. Scott Fitzgerald', 'deco', '#0f1d3a', '#e8c66a'],
  ['Ulysses', 'James Joyce', 'circle', '#1f5c7a', '#f2efe6'], ['Don Quixote', 'Miguel de Cervantes', 'band', '#e3b23c', '#2a1f14'],
  ['War and Peace', 'Leo Tolstoy', 'serif', '#7c1e1e', '#f1e6d2'], ['Madame Bovary', 'Gustave Flaubert', 'frame', '#c9d6c1', '#3b2a36'],
  ['Crime and Punishment', 'Fyodor Dostoevsky', 'cond', '#e6e1d6', '#1a1a1a'], ['The Iliad', 'Homer', 'stripes', '#1b1b1b', '#c2643a'],
  ['Leaves of Grass', 'Walt Whitman', 'leaf', '#dfe6c9', '#2f4a2a'], ['Hamlet', 'William Shakespeare', 'band', '#141414', '#e7e0cf'],
  ['Mrs Dalloway', 'Virginia Woolf', 'circle', '#f0c8b6', '#3a2f5b'], ['Anna Karenina', 'Leo Tolstoy', 'deco', '#3b0f1f', '#f0d9b5'],
  ['Wuthering Heights', 'Emily Brontë', 'stripes', '#5b6b73', '#eef0ec'], ['Heart of Darkness', 'Joseph Conrad', 'cond', '#20301f', '#d8c48a'],
  ['The Metamorphosis', 'Franz Kafka', 'circle', '#e9e4d8', '#111'], ['Candide', 'Voltaire', 'frame', '#2d4b8e', '#f4ead5'],
  ['Emma', 'Jane Austen', 'serif', '#f1dfe0', '#5b2333'], ['Meditations', 'Marcus Aurelius', 'band', '#d8cfbd', '#3a3026'],
];
const tpl = {
  serif: (t, a, bg, fg) => `<div class="t" style="top:90px;font:400 58px/1.04 Georgia,serif">${t}</div><div style="position:absolute;left:56px;top:300px;width:80px;height:3px;background:${fg}"></div>`,
  cond: (t, a, bg, fg) => `<div class="t" style="top:60px;font:800 72px/.92 'Avenir Next Condensed',sans-serif;text-transform:uppercase">${t}</div>`,
  frame: (t, a, bg, fg) => `<div style="position:absolute;inset:26px 26px 26px 40px;border:3px double ${fg}"></div><div class="t" style="top:150px;left:70px;right:56px;text-align:center;font:italic 400 54px/1.05 'Hoefler Text',Georgia,serif">${t}</div>`,
  deco: (t, a, bg, fg) => `<svg style="position:absolute;left:0;top:0" width="400" height="560"><g stroke="${fg}" stroke-width="2" fill="none">${[0, 1, 2, 3, 4, 5].map(i => `<path d="M200 330 L${88 + i * 45} 470"/>`).join('')}<circle cx="200" cy="330" r="46"/></g></svg><div class="t" style="top:70px;text-align:center;left:40px;font:600 50px/1.05 Didot,serif;letter-spacing:.06em;text-transform:uppercase">${t}</div>`,
  circle: (t, a, bg, fg) => `<div style="position:absolute;left:96px;top:250px;width:230px;height:230px;border-radius:50%;background:${fg};opacity:.9"></div><div class="t" style="top:70px;font:500 52px/1.02 'Futura','Avenir Next',sans-serif">${t}</div>`,
  band: (t, a, bg, fg) => `<div style="position:absolute;left:0;right:0;top:200px;height:150px;background:${fg}"></div><div class="t" style="top:226px;font:700 52px/1 'Bodoni 72',Didot,serif;color:${bg}">${t}</div>`,
  stripes: (t, a, bg, fg) => `<div style="position:absolute;left:0;right:0;bottom:120px;height:180px;background:repeating-linear-gradient(0deg,${fg} 0 14px,transparent 14px 28px)"></div><div class="t" style="top:80px;font:400 62px/1 'Bodoni 72',serif;letter-spacing:.04em;text-transform:uppercase">${t}</div>`,
  leaf: (t, a, bg, fg) => `<svg style="position:absolute;left:120px;top:250px" width="170" height="210" viewBox="0 0 34 42"><path d="M17 40C7 30 4 18 9 4c6 5 15 9 16 21-1 7-4 10-8 15z" fill="${fg}"/></svg><div class="t" style="top:80px;font:italic 400 58px/1.02 Georgia,serif">${t}</div>`,
};
export const moreCovers = MORE.map(([t, a, k, bg, fg]) => `<div class="cover" style="background:${bg};color:${fg}">${tpl[k](t, a, bg, fg)}<div class="a">${a}</div></div>`);

// Titles are set in each device's own fonts, so shrink any word that would
// run off its cover instead of breaking or clipping it.
export function fitCovers(root) {
  for (const t of root.querySelectorAll('.cover .t')) {
    let size = parseFloat(getComputedStyle(t).fontSize);
    while (t.scrollWidth > t.clientWidth + 1 && size > 16) t.style.fontSize = (size -= 2) + 'px';
  }
}
