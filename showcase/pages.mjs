// Generates the New reading pages (index.html, learn/index.html). Run after editing copy:
//   node pages.mjs
// Builds index.html. Every quotation and count below was
// checked against the Pride and Prejudice edition in ../../../../projects
// (1894 illustrated, Gutenberg 1342): "love" 93 and "fortune" 39 across
// chapters 1–61; Ch. 1 and Ch. 34 quotations verbatim.
import {writeFile, mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {buildShelf} from './shelf/render.mjs';
const dir = fileURLToPath(new URL('.', import.meta.url));
export async function buildPages() {
const shelf = await buildShelf();
// Canonical handoffs, as on the live site; start.txt holds the full instruction.
const prompt = 'Use https://newreading.app/start.txt to help me build a personal reader. Follow the linked kit guide, then help me choose a simple reader or a custom experience.';
const learnPrompt = 'Use https://newreading.app/start.txt to help me build my own reader. Get the kit, start with a sample and show me a working preview. Then help me add my book, make the reader my own and put it on my phone.';
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const arrow = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const plus = '<svg class="plus" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14M12 5v14"/></svg>';
const copyIcon = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5H5v14h10v-4M9 3h10v12H9z"/></svg>';
const GH = 'https://github.com/lamentierschweinchen/personal-reader-kit';

const threads = {
  love: {note: 'he means it.', name: 'love', count: 93, label: 'The love edition', counts: [1,1,1,0,0,5,1,0,4,0,1,0,1,0,0,0,0,0,1,1,4,4,1,4,8,6,1,0,0,0,1,3,1,3,2,2,0,0,0,1,1,1,1,4,0,1,5,0,0,1,1,1,1,3,1,0,0,1,7,4,2],
    quote: 'You must allow me to tell you how ardently I admire and love you.', who: 'Mr. Darcy · Chapter 34'},
  money: {note: 'she means it too.', name: 'fortune', count: 39, label: 'The money edition', counts: [3,0,0,3,2,0,2,0,0,0,0,0,0,0,0,4,0,0,1,0,0,2,0,2,1,4,1,1,0,0,0,1,1,0,1,2,0,0,1,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,2,0,0,1,0,1],
    quote: 'A single man of large fortune; four or five thousand a year.', who: 'Mrs. Bennet · Chapter 1'},
};

const PRIDE = [0,0,0,0,7,0,0,1,0,0,3,0,0,0,1,11,0,0,0,1,1,0,0,1,0,0,0,0,0,0,0,0,3,4,0,1,0,0,0,0,1,0,2,3,0,0,0,0,0,1,0,2,1,0,0,0,0,1,1,0,1];
// Walden, "Economy": Thoreau's house account, verbatim and in its fixed layout.
const LEDGER = `    Boards.......................... $ 8.03½, mostly shanty boards.
    Refuse shingles for roof sides,..  4.00
    Laths,...........................  1.25
    Two second-hand windows
       with glass,...................  2.43
    One thousand old brick,..........  4.00
    Two casks of lime,...............  2.40  That was high.
    Hair,............................  0.31  More than I needed.
    Mantle-tree iron,................  0.15
    Nails,...........................  3.90
    Hinges and screws,...............  0.14
    Latch,...........................  0.10
    Chalk,...........................  0.01
    Transportation,..................  1.40  I carried a good part
                                       ————  on my back.
        In all,..................... $28.12½`;
const explore = [
  ['play', 'Play its story', 'then back to your page.', `<div class="xp xp-play"><p class="xp-top">The Odyssey · a short game</p><a class="xp-shot" href="/odyssey/play/"><img src="/assets/play-homeward.jpg" width="780" height="1180" alt="Homeward, a short sea game from the Odyssey: the crew’s boat and the bag of winds"><span class="xp-go">Play Homeward ${arrow}</span></a><p class="xp-more">Or pour <a href="/alice/play/">Tea at Six</a> with the Hatter, or find a way out of <a href="/dracula/play/">Dracula’s castle</a>.</p></div>`],
  ['places', 'Walk its places', 'walk it someday.', `<div class="xp xp-places"><p class="xp-top">Die Stimmen von Marrakesch · map preview</p><img src="/assets/personal-canetti-map.png" width="748" height="940" alt="Map preview: a suggested walk through six places in the Marrakesh medina from the book"></div>`],
  ['closer', 'Look closer', 'every line, a little closer', `<div class="xp xp-closer"><p class="xp-top">Alice · Arthur Rackham’s plates</p><div class="xp-plate"><img src="/assets/alice-rabbit.png" width="600" height="825" alt="Arthur Rackham’s White Rabbit plunging towards its hole beneath the brambles"><a class="plate-open" href="/assets/alice-rabbit.png">View illustration ${arrow}</a></div></div>`],
  ['accounts', 'Count the cost', 'every nail, priced.', `<div class="xp xp-ledger"><p class="xp-top">Walden · Economy · the house</p><pre tabindex="0" aria-label="Thoreau’s house account">${esc(LEDGER)}</pre></div>`],
  ['word', 'Find a pattern', 'who else says “pride”?', `<div class="xp xp-word"><p class="xp-top">Pride and Prejudice · patterns in the text</p><p class="xp-big">pride</p><p class="xp-meta">47 times · 61 chapters</p><div class="xp-grid">${PRIDE.map(n => `<i style="--v:${n ? (.35 + .65 * Math.min(1, n / 7)).toFixed(2) : 0}"></i>`).join('')}</div><blockquote>“I could easily forgive his pride, if he had not mortified mine.”<cite>Elizabeth · Chapter 5</cite></blockquote></div>`],
];

// Local-project routes checked against each provider’s official setup guide, 17 October 2026.
const routes = {
  codex: {name: 'Codex, in the ChatGPT desktop app', url: 'https://learn.chatgpt.com/docs/quickstart', label: 'Official Codex setup',
    account: 'Uses your ChatGPT account. Availability and usage limits depend on your plan.',
    steps: ['Install or update the ChatGPT desktop app, then sign in.', 'Select <b>Codex</b> and open your <b>My reader</b> folder as a project.', 'Start a local task in that project. Paste the instruction below.']},
  claude: {name: 'Claude Code, in the Claude desktop app', url: 'https://code.claude.com/docs/en/desktop-quickstart', label: 'Official Claude Code setup',
    account: 'Requires a paid Claude plan with Claude Code access.',
    steps: ['Install the Claude desktop app, then sign in.', 'Open <b>Code</b> and choose <b>Local</b>.', 'Select your <b>My reader</b> folder. Paste the instruction below.']},
  antigravity: {name: 'Google Antigravity', url: 'https://antigravity.google/docs/getting-started', label: 'Official Antigravity setup',
    account: 'Uses your Google account. Usage limits depend on your plan.',
    steps: ['Install the Antigravity app for your computer, then sign in.', 'Create a project using your <b>My reader</b> folder.', 'Start a task in <b>Local mode</b>. Paste the instruction below.']},
};
const head = ({title, desc, url, script}) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f5f1e7">
<title>${title}</title><meta name="description" content="${desc}">
<meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:type" content="website"><meta property="og:url" content="${url}"><meta property="og:image" content="https://newreading.app/assets/read-share.jpg?v=20261019"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="New reading: Make any book your own. Austen’s peacock binding, Rackham’s White Rabbit and Thoreau’s pond survey."><meta name="twitter:card" content="summary_large_image"><link rel="canonical" href="${url}">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preload" href="/assets/im-fell-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/assets/reenie-beanie.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/assets/martian-mono-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css">${script === '/home.mjs' ? '<link rel="stylesheet" href="/shelf/covers.css"><link rel="stylesheet" href="/shelf/style.css"><script type="module" src="/shelf/app.mjs"></script>' : ''}<script type="module" src="${script}"></script></head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
 <a class="brand" href="/" aria-label="new reading, home"><span class="brand-new">new</span><svg class="caret" viewBox="0 0 18 12" aria-hidden="true" focusable="false"><path d="m1 11 8-9 8 9"/></svg><span class="brand-reading">reading</span></a>
 <nav aria-label="Main"><a class="nav-link" href="/library/">Library</a><a class="nav-link" href="/learn/" aria-label="How it works"><span class="nav-full">How it works</span><span class="nav-short" aria-hidden="true">Guide</span></a><button type="button" class="pill" data-copy="base" aria-label="Copy prompt" hidden><span class="nav-full">Copy prompt</span><span class="nav-short" aria-hidden="true">Copy</span> ${copyIcon}</button><a class="pill pill-dark" href="${GH}">GitHub ${arrow}</a></nav>
</header>`;
const foot = `<footer class="foot"><div><a class="brand brand-foot" href="/" aria-label="new reading, home"><span class="brand-new">new</span><svg class="caret" viewBox="0 0 18 12" aria-hidden="true" focusable="false"><path d="m1 11 8-9 8 9"/></svg><span class="brand-reading">reading</span></a><p>Turn any book into your personal reader.</p></div><div class="foot-links"><a href="/learn/">How it works</a><a href="https://lookatseel.com/">Made by Lukas Seel</a><a href="${GH}">Free &amp; open source ${arrow}</a></div><p class="support"><span class="hand">Please support writers.</span> Buy the ebook from <a href="https://bookshop.org/">Bookshop.org</a>, <a href="https://www.kobo.com/">Kobo</a> or <a href="https://www.ebooks.com/">eBooks.com</a>, or straight from the publisher. Classics are free at <a href="https://standardebooks.org/">Standard Ebooks</a>.</p></footer>
<div class="toast" role="status" aria-live="polite"></div>
<dialog class="fallback" aria-labelledby="fb-title"><form method="dialog"><button aria-label="Close">Close</button></form><h2 id="fb-title">Copy by hand.</h2><p>Automatic copying wasn’t available. Select and copy the text below.</p><textarea readonly aria-label="Text to copy"></textarea></dialog>`;
const html = `${head({title: 'new reading · Turn any book into your personal reader', desc: 'Read complete books in their own editions, then make yours.', url: 'https://newreading.app/', script: '/home.mjs'})}
<main id="main">

<section class="hero" data-thread="love" aria-labelledby="hero-title">
 <div class="hero-text">
  <h1 id="hero-title">Once for <span class="thread-choice"><button type="button" class="thread" data-pick="love" aria-pressed="true" disabled>love</button><span class="dot">.</span></span><br>Again for <span class="thread-choice"><button type="button" class="thread" data-pick="money" aria-pressed="false" disabled>the money</button><span class="dot">.</span></span></h1>
  <svg class="ring" viewBox="0 0 200 80" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path pathLength="1" d="M24 55C9 34 52 9 108 7c58-2 90 18 84 40-6 23-60 31-112 28C38 72 10 60 16 41c3-10 14-18 30-24"/></svg>
  <p class="hand note-tap" data-tap aria-hidden="true"><svg class="hand-arrow" viewBox="0 0 60 40" aria-hidden="true" focusable="false"><path d="M56 6C40 4 18 10 8 32m0 0 1-10m-1 10 9-5"/></svg><span>tap a word</span></p>
 </div>
 <figure class="hero-device" aria-live="polite">
  <div class="ph"><div class="ph-screen">
   <div class="ed-top"><span>Pride &amp; Prejudice</span><span class="ed-label" data-text="label">${threads.love.label}</span></div>
   <div class="ed-word" data-text="name">love</div>
   <div class="ed-count"><span data-text="count">93</span> times · 61 chapters</div>
   <div class="ed-grid" aria-hidden="true">${threads.love.counts.map((_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
   <blockquote class="ed-quote"><p data-text="quote">${threads.love.quote}</p><cite data-text="who">${threads.love.who}</cite></blockquote>
  </div>
  <p class="hand note-hero"><svg class="hand-arrow" viewBox="0 0 60 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M56 6C40 4 18 10 8 32m0 0 1-10m-1 10 9-5"/></svg><span data-note>he means it.</span></p>
  </div>
 </figure>
 <div class="hero-cta">
  <p class="vp">Make <span class="ins"><svg class="ins-caret" viewBox="0 0 18 12" aria-hidden="true" focusable="false"><path d="m1 11 8-9 8 9"/></svg>your own</span> edition of any&nbsp;book.</p>
  <div class="actions"><a class="btn" href="#make">Start yours ${arrow}</a><a class="link" href="#samples">Read one now</a></div>
 </div>
</section>

<section class="anybook reveal" aria-labelledby="any-title">
 <div class="marquee" data-marquee><div class="marquee-track" data-covers aria-hidden="true"></div></div>
 <div class="anybook-text"><h2 id="any-title">Turn <span class="pen-under">any book</span> into your personal&nbsp;reader.</h2>
 <p class="hand any-note">An edition made just for you.</p></div>
</section>

<section class="modes" aria-labelledby="modes-title">
 <h2 id="modes-title" class="reveal">Read it. <em>Explore&nbsp;it.</em></h2>
 <div class="mode-grid">
  <article class="mode mode-read reveal">
   <div class="mode-text"><p class="kicker">Read</p><h3>A quiet place for the book.</h3>
    <ul class="chips"><li>Keep a passage</li><li>Write in the margin</li><li>Share a line</li><li>Read offline</li></ul>
    <p class="fine">Your notes stay on your device. No account, no ads, no feed.</p></div>
   <div class="shot"><img src="/assets/reader-keep.jpg" width="450" height="978" alt="The Pride and Prejudice reader keeping its first sentence, with a private note"><p class="hand note-read" aria-hidden="true">keep this one</p></div>
  </article>
  <article class="mode mode-explore reveal" data-x="${explore[0][0]}">
   <div class="mode-text"><p class="kicker">Explore</p><h3>Whatever the book makes you curious about.</h3>
    <div class="tabs" role="tablist" aria-label="Examples of explorations">${explore.map(([id, t], i) => `<button type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${i === 0}" tabindex="${i ? -1 : 0}" data-explore="${id}" data-label="${t}">${t}</button>`).join('')}</div>
    <p class="hand note-explore" data-explore-note>${explore.map(([id, , note], i) => `<span data-explore-caption="${id}" aria-hidden="${i > 0}"${i ? ' hidden' : ''}>${esc(note)}</span>`).join('')}</p></div>
   <div class="stage">${explore.map(([id, t, , panel], i) => `<div class="panel" id="panel-${id}" role="tabpanel" aria-labelledby="tab-${id}" tabindex="0"${i ? ' hidden' : ''}>${panel}</div>`).join('')}</div>
  </article>
 </div>
</section>

${shelf}

<section class="make" id="make" aria-labelledby="make-title">
 <div class="make-head reveal"><h2 id="make-title">Have a book <em>in&nbsp;mind?</em></h2><p>Name it, say what you’d like, and copy your starting point.</p></div>
 <form class="idea reveal" autocomplete="off" data-enhanced hidden>
  <label class="field field-book"><span>The book</span><input id="book" maxlength="200" placeholder="Walden"><em class="hand note-make" aria-hidden="true"><svg class="hand-arrow" viewBox="0 0 60 40" aria-hidden="true" focusable="false"><path d="M56 6C40 4 18 10 8 32m0 0 1-10m-1 10 9-5"/></svg>for Dad’s birthday?</em></label>
  <label class="field"><span>I’d like to…</span><textarea id="idea" rows="2" maxlength="1000" placeholder="make an edition for Dad, who still means to build the cabin"></textarea></label>
  <div class="ideas"><span>Or begin with</span><button type="button" data-idea="make a beautiful, quiet place to read it">a quiet place to read</button><button type="button" data-idea="follow a word that keeps catching my attention">a word that follows me</button><button type="button" data-idea="make a companion to the places in the book">the places in its pages</button><button type="button" data-idea="make an edition as a gift for someone I love">a gift for someone</button></div>
  <div class="idea-actions"><button type="submit" class="btn" data-copy="personal" hidden>Copy my starting point ${arrow}</button><p class="status" role="status"></p></div>
 </form>
 <div class="side reveal">
  <ol class="steps">
   <li><b>1</b><div><h3>Paste it into a coding app.</h3><p>Codex, Claude Code or similar. It starts with a sample, then asks for your book.</p></div></li>
   <li><b>2</b><div><h3>Read, and ask for changes.</h3><p>A quiet reader, or one shaped around your curiosity.</p></div></li>
   <li><b>3</b><div><h3>Take it with you.</h3><p>Save it on your phone, then check it offline.</p></div></li>
  </ol>
  <a class="newbie" href="/learn/"><span class="hand">Never used a coding app?</span><span class="newbie-line">The guide shows you which app to open and what to paste, step by step.</span><span class="newbie-go">Read the guide ${arrow}</span></a>
 </div>
 <div class="faq reveal">
  <details><summary>What happens to the words? ${plus}</summary><p>The original wording, emphasis and structure come first. Any converted book needs checking against the source; new features live around it.</p></details>
  <details><summary>What do I need? ${plus}</summary><p>A computer, a coding app, and a book you own or one in the public domain. The kit is free and open source; your AI app may have plan costs or usage limits.</p></details>
  <details><summary>What stays private? ${plus}</summary><p>In the finished reader, imported books and notes stay in that browser. They don’t sync between devices. Files you give an AI app may be processed by its provider; books you choose to publish will be online. This site has no analytics or third-party scripts.</p></details>
  <details><summary>Can I make one for someone else? ${plus}</summary><p>Yes, with a public-domain book or one you have permission to share. Owning a book doesn’t give permission to publish its text.</p></details>
  <details id="prompt-box" open><summary>Just the prompt, please. ${plus}</summary><textarea id="starter" readonly spellcheck="false" aria-label="Starter prompt">${esc(prompt)}</textarea><div class="prompt-actions"><button type="button" class="link" data-copy="base" hidden>Copy prompt</button><a class="link" href="/start.txt">Full instruction</a><a class="link" href="${GH}">Get the repository ${arrow}</a></div></details>
 </div>
</section>
</main>
<dialog class="illustration-dialog" aria-label="White Rabbit illustration"><form method="dialog"><button>Close</button></form><img src="/assets/alice-rabbit.png" width="600" height="825" alt="Arthur Rackham’s White Rabbit plunging towards its hole beneath the brambles"></dialog>
${foot}
<script type="application/json" id="data">${JSON.stringify({threads, explore: explore.map(([id, , note]) => [id, note])})}</script>
</body></html>`;
await writeFile(dir + 'index.html', html);
console.log('Built homepage and mixed shelf.');

// ── How it works ─────────────────────────────────────────────────────────
const learn = `${head({title: 'How it works · new reading', desc: 'Make your own reader with an AI coding app: which app to open, what to paste, and how to take it with you.', url: 'https://newreading.app/learn/', script: '/learn.mjs'})}
<main id="main" class="guide">
<section class="g-hero"><p class="kicker">How it works</p><h1>From a book to <em>your own reader.</em></h1><p class="g-lead">An AI coding app builds it with you. You bring the book and the decisions. Set it up on a computer, then read on your phone.</p></section>

<section class="g-step" id="app"><b class="g-num">1</b><div class="g-body">
 <h2>Open the right app.</h2>
 <p>First, make an empty folder called <b>My reader</b>. That’s where the reader’s files will live. Then open it in a coding app: an AI app that can create, edit and run files in a folder on your computer.</p>
 <fieldset class="learn-q" hidden><legend>Which AI do you already use?</legend>${[['chatgpt', 'ChatGPT'], ['claude', 'Claude'], ['gemini', 'Gemini'], ['none', 'None yet']].map(([v, l]) => `<label><input type="radio" name="ai" value="${v}"${v === 'chatgpt' ? ' checked' : ''}><span>${l}</span></label>`).join('')}</fieldset>
 ${Object.entries(routes).map(([id, r]) => `<div class="route" data-route="${id}"><p class="route-name">${r.name}</p><ol>${r.steps.map(x => `<li>${x}</li>`).join('')}</ol><p class="route-account">${r.account}</p><a class="link" href="${r.url}">${r.label} ${arrow}</a></div>`).join('')}
 <p class="learn-stop">For this guide, use a local project. The app needs access to your <b>My reader</b> folder so it can build and open the reader.</p>
</div></section>

<section class="g-step" id="paste"><b class="g-num">2</b><div class="g-body">
 <h2>Paste this, and watch it work.</h2>
 <label class="g-label" for="starter">Your first instruction</label>
 <textarea id="starter" readonly spellcheck="false">${esc(learnPrompt)}</textarea>
 <div class="prompt-actions"><button type="button" class="btn" data-copy="base" hidden>Copy instruction ${arrow}</button><a class="link" href="/#make">Add your book and idea first</a></div>
 <p>When it’s ready, ask it to open the preview. Read a page, highlight a sentence, save a note and reload. <span class="hand g-hand">your note should still be there.</span></p>
</div></section>

<section class="g-step" id="yours"><b class="g-num">3</b><div class="g-body">
 <h2>Make it yours.</h2>
 <p>Give it your book as a plain text file, or ask it to prepare an EPUB or PDF. Keep it simple, or ask for a companion around the book’s places, ideas or history. Then read, and ask for changes in your own words:</p>
 <blockquote class="g-ask"><span class="hand">“Make the text larger on my phone. Keep the poem’s line breaks. Show me.”</span></blockquote>
 <p class="g-fine">Book files you give an AI app may be processed by its provider. Share only what you’re comfortable sharing.</p>
</div></section>

<section class="g-step" id="phone"><b class="g-num">4</b><div class="g-body">
 <h2>Take it with you.</h2>
 <p>Ask it to put the reader online at your own address; it can walk you through GitHub and Vercel when you need them. Only include books you have permission to share; private books can be imported in the reader after publishing. Open the site on your phone and add it to your home screen.</p>
 <p>Open the reader from its new home-screen icon while you’re online. Check that your book and notes are there. In Settings, choose <b>Check offline copy</b> and wait for <b>Available offline</b>. Then turn off Wi-Fi and mobile data, reopen it and save a note. Keep a private reading bundle as your backup.</p>
 <a class="link" href="${GH}/blob/main/docs/DEPLOYMENT.md">Publishing guide ${arrow}</a>
</div></section>

<section class="g-faq faq">
 <details><summary>What do I need? ${plus}</summary><p>A computer, a coding app, and a book you own or one in the public domain. The kit is free and open source; your AI app may have plan costs or usage limits.</p></details>
 <details><summary>What are GitHub, Node and Vercel? ${plus}</summary><p>GitHub keeps a versioned copy of your project. Node runs the reader while you build it. Vercel hosts the finished website. Your app can set each up when it becomes useful; check any plan’s cost first.</p></details>
 <details><summary>Will any ebook work? ${plus}</summary><p>Plain text works directly. EPUBs and PDFs need preparation, and some layouts take extra work. DRM-protected ebooks can’t be used. The sample lets you try everything first.</p></details>
 <details><summary>What if I get stuck? ${plus}</summary><p>Tell the app what you see: “I expected a preview, but I’m seeing an error. Find the cause and explain the next step.” If it only replies with code, check that it can edit and run files in your folder.</p></details>
 <details><summary>Can I make one for someone else? ${plus}</summary><p>Yes, with a public-domain book or one you have permission to share. Owning a copy doesn’t give permission to publish its text. <a href="${GH}/blob/main/docs/RIGHTS.md">About book rights</a>.</p></details>
</section>
</main>
${foot}
</body></html>`;
await mkdir(dir + 'learn', {recursive: true});
await writeFile(dir + 'learn/index.html', learn);
console.log('Built learn.');
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await buildPages();
