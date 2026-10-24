import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {readerPaths} from '../readers.mjs';
import {cover} from './covers.mjs';

const root=new URL('../../',import.meta.url);
const GH='https://github.com/lamentierschweinchen/personal-reader-kit';
const hanslickScan='https://commons.wikimedia.org/wiki/File:The_beautiful_in_music_-_a_contribution_to_the_revisal_of_musical_aesthetics_(IA_beautifulinmusichans).pdf';
const reviewedScans={'music-and-feeling':hanslickScan,'mountains-and-heights':'https://archive.org/details/alps00conw','war-and-peace':'https://www.prlib.ru/item/1988888','douglass-narrative':'https://docsouth.unc.edu/neh/douglass/menu.html','fall-of-the-house-of-usher':'https://archive.org/details/tales00poeedgar'};
const reviewedThemedSources={"ballads-and-a-play": ["https://de.wikisource.org/wiki/Erlkönig"], "kingdom-for-a-stage": ["https://www.folger.edu/explore/shakespeares-works/download/"], "pictures-after-dark": ["https://archive.org/details/pastelsinprose00merriala"], "caesar-and-the-emperors": ["https://penelope.uchicago.edu/Thayer/E/Roman/Texts/Caesar/Gallic_War/home.html"]};
const keys=['id','exampleId','title','author','shortAuthor','kind','language','edition','editionLabel','feature','description','categories','preparedBy','sourceUrls','sourceLabels','rightsPath'];
export const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrow='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const close='<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M6 18 18 6"/></svg>';
const wordmark=`<a class="brand" href="/" aria-label="New reading, home"><span class="brand-new">new</span><svg class="caret" viewBox="0 0 18 12" aria-hidden="true" focusable="false"><path d="m1 11 8-9 8 9"/></svg><span>reading</span></a>`;

export function validateEntries(data){
 assert.deepEqual(Object.keys(data).sort(),['editions','schema']);assert.equal(data.schema,1);
 assert.ok(Array.isArray(data.editions));assert.equal(data.editions.length,Object.keys(readerPaths).length);
 const ids=new Set();
 for(const b of data.editions){
  assert.deepEqual(Object.keys(b).sort(),[...keys].sort(),'Only public discovery metadata is accepted');
  assert.equal(readerPaths[b.exampleId],b.id,'Only the explicitly reviewed hosted examples are admitted');
  assert.ok(!ids.has(b.id),'Duplicate listing');ids.add(b.id);
  for(const k of ['title','author','shortAuthor','kind','language','edition','feature','description'])assert.ok(typeof b[k]==='string'&&b[k].trim()&&b[k].length<=1400,'Invalid '+k);
  assert.ok(typeof b.editionLabel==='string'&&b.editionLabel.length<=160,'Invalid edition label');
  assert.deepEqual(Object.keys(b.preparedBy).sort(),['name','url']);
  assert.equal(b.preparedBy.name,'New reading');assert.equal(b.preparedBy.url,'https://newreading.app/');
  assert.ok(Array.isArray(b.categories)&&b.categories.length&&new Set(b.categories).size===b.categories.length);
  assert.ok(b.categories.every(k=>['words','ideas','art','game'].includes(k)));
  assert.ok(Array.isArray(b.sourceUrls)&&b.sourceUrls.length>=1&&b.sourceUrls.length<=3);
  assert.ok(Array.isArray(b.sourceLabels)&&b.sourceLabels.length===b.sourceUrls.length,'Each source needs its own label');
  assert.ok(b.sourceLabels.every(label=>typeof label==='string'&&label.trim()&&label.length<=80),'Invalid source label');
  for(const url of b.sourceUrls)assert.ok(/^https:\/\/www\.gutenberg\.org\/ebooks\/[0-9]+$/.test(url)||url===reviewedScans[b.exampleId]||reviewedThemedSources[b.exampleId]?.includes(url),'Source must be an exact reviewed edition record');
  assert.match(b.rightsPath,new RegExp('^examples/'+b.exampleId+'/docs/SOURCE-(?:AND-)?RIGHTS\\.md$'));
 }
 return data.editions;
}

function editionContent(b){
 const code=GH+'/tree/main/examples/'+b.exampleId;
 return `<div class="edition-layout"><div class="edition-visual">${cover(b)}<p class="hand" aria-hidden="true">someone made<br>this for a reader.</p></div><div class="edition-description"><p class="eyebrow">${escape(b.kind)} · ${escape(b.language)}</p><h2 data-edition-title>${escape(b.title)}</h2><p class="edition-author">${escape(b.author)}</p>${b.editionLabel?`<p class="edition-version">${escape(b.editionLabel)}</p>`:''}<p class="edition-credit">Prepared by <b>${escape(b.preparedBy.name)}</b><span>Founding edition</span></p><div class="edition-companion"><p class="eyebrow">Inside this reader</p><h3>${escape(b.feature)}</h3><p>${escape(b.description)}</p></div><a class="button-dark" href="/${b.id}/">Read this edition ${arrow}</a><a class="text-link adapt-link" href="${code}">Make your own version</a><details class="source-details"><summary>Edition, sources &amp; reuse</summary><p>${escape(b.edition)}</p><p>Rights and reuse depend on the edition, its contributors and the territory. The code license does not relicense the book or its artwork.</p><div>${b.sourceUrls.map((u,i)=>`<a href="${u}">${escape(b.sourceLabels[i])}</a>`).join('')}<a href="${GH}/blob/main/${b.rightsPath}">Rights &amp; credits</a><a href="${code}">Reader source code</a></div></details><p class="edition-private">Reading places and notes stay in your browser.</p></div></div>`;
}

export function renderLibrary(data){
 const editions=validateEntries(data);
 const cards=editions.map((b,i)=>{
  const search=[b.title,b.author,b.shortAuthor,b.kind,b.language,b.edition,b.feature,b.description,b.preparedBy.name].join(' ').toLocaleLowerCase();
  return `<article class="book" data-edition="${b.id}" data-order="${i}" data-title="${escape(b.title)}" data-author="${escape(b.author)}" data-categories="${b.categories.join(' ')}" data-search="${escape(search)}"><a class="cover-button" href="/${b.id}/" aria-label="Read ${escape(b.title)}">${cover(b)}<span class="cover-invitation">Read this edition ${arrow}</span></a><div class="book-info"><p class="book-author">${escape(b.shortAuthor)}</p><h2><a href="/${b.id}/">${escape(b.title)}</a></h2><p class="book-feature">${escape(b.feature)}</p><p class="credit">Prepared by <span>${escape(b.preparedBy.name)}</span></p><a class="edition-link" href="#edition-${b.id}" data-preview="${b.id}">About this edition</a></div></article>`;
 }).join('\n');
 return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f5f1e7"><title>The library · New reading</title><meta name="description" content="Books prepared by readers, for readers. Browse complete books and meetings of writers, then share an edition of your own."><link rel="canonical" href="https://newreading.app/library/"><meta property="og:title" content="The library · New reading"><meta property="og:description" content="Made by one reader. Ready for the next."><meta property="og:type" content="website"><meta property="og:url" content="https://newreading.app/library/"><meta property="og:image" content="https://newreading.app/assets/read-share.jpg?v=20261019"><meta name="twitter:card" content="summary_large_image"><link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png"><link rel="preload" href="/assets/im-fell-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/assets/reenie-beanie.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/assets/martian-mono-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/library/style.css"><script type="module" src="/library/app.mjs"></script></head><body>
<a class="skip" href="#main">Skip to the library</a><header class="top">${wordmark}<nav aria-label="Main"><a class="active" href="/library/" aria-current="page">Library</a><a href="/learn/">How it works</a><a class="pill" href="#contribute">Share an edition <svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg></a></nav></header>
<main id="main"><section class="intro shelf-intro" aria-labelledby="library-title"><div><p class="eyebrow">The community library</p><h1 id="library-title">Made by one reader.<br><em>Ready for the next.</em></h1><p class="lede">Complete editions, prepared with a little curiosity.</p><p class="continuation" data-continuation hidden><a data-continuation-link></a></p><p class="sr-only" data-continuation-status role="status" aria-live="polite"></p></div><p class="hand shelf-note" aria-hidden="true">take one.<br>make one.<svg viewBox="0 0 130 65" focusable="false"><path d="M7 6c48 3 85 15 112 47m0 0-18-4m18 4-4-17"/></svg></p></section>
<section class="browse-tools" aria-label="Find an edition" hidden><label class="search"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span class="sr-only">Search the library</span><input type="search" id="search" autocomplete="off" placeholder="A title, an author, a curiosity…"></label><div class="filters" role="group" aria-label="Filter editions"><button type="button" data-filter="all" aria-pressed="true">All editions</button><button type="button" data-filter="words" aria-pressed="false">Words &amp; ideas</button><button type="button" data-filter="art" aria-pressed="false">Art &amp; observation</button><button type="button" data-filter="game" aria-pressed="false">With a game</button></div></section>
<div class="results-line"><p id="result-count" role="status" aria-live="polite">${editions.length} editions · the shelf</p><label class="sort" hidden>Sort <span class="sort-control"><select id="sort"><option value="shelf">Shelf order</option><option value="title">Title A–Z</option><option value="author">Author A–Z</option></select>${arrow}</span></label></div><section class="book-grid" id="results" aria-label="Editions">${cards}<div class="empty" hidden><p class="eyebrow">No matching editions</p><h2>That shelf is empty.</h2><p>Try another title, author or companion.</p><button type="button" class="pill" id="reset">Clear search and filters</button></div></section>
<section class="contribution-line" id="contribute" aria-labelledby="contribute-title"><div><p class="eyebrow">Add to the shelf</p><h2 id="contribute-title">There’s room for your edition, too.</h2><p class="contribution-copy">Made a public reader? Tell us about the book, its sources and what you made around it.</p></div><div class="contribution-action"><a class="button-dark" href="${GH}/issues/new?template=edition.yml">Propose an edition ${arrow}</a><p>Opens a public GitHub form. Keep personal books, notes and private backups out of your proposal.</p><a class="text-link" href="${GH}/blob/main/docs/LIBRARY.md">What we review</a></div></section>
<section class="edition-sources" aria-labelledby="sources-title"><h2 id="sources-title">About the editions</h2><p>${editions.length} editions prepared by New reading. Community proposals are reviewed before joining the shelf.</p>${editions.map(b=>`<details class="edition-source" id="edition-${b.id}"><summary>${escape(b.title)}</summary>${editionContent(b)}</details>`).join('\n')}</section></main>
<footer><div class="footer-title">A book gets better company.</div><p>Read an edition. Make it yours. Share what you make.</p><div class="footer-bottom"><span>New reading · a library of prepared editions</span><div class="footer-links"><a href="/">Make a reader</a><a href="/learn/">How it works</a><a href="/privacy/">Privacy</a><a href="${GH}">Reader kit on GitHub</a><details><summary>Credits</summary><p>Hugh Thomson’s Austen binding, Arthur Rackham’s rabbit and the Walden survey retain their edition notices. The Two Halls portraits are a contemporary generated illustration. The Odyssey, Dracula and multi-author collection covers are original vector compositions. The Alps uses McCormick’s sunset plate; War and Peace uses Repin’s portrait from the 1893 album. Nietzsche’s circle and lines are original. Their edition source notes give the credits. <a href="${GH}/blob/main/showcase/ASSETS.md">Artwork &amp; font provenance</a>.</p><p>Fonts: IM Fell English, Reenie Beanie, Martian Mono and Piazzolla. <a href="/assets/OFL-IMFell.txt">IM Fell license</a>; <a href="/assets/OFL-ReenieBeanie.txt">Reenie Beanie license</a>; <a href="/assets/OFL-MartianMono.txt">Martian Mono license</a>; <a href="/assets/OFL-Piazzolla.txt">Piazzolla license</a>.</p><p>Inside the collections: <a href="/at-table/newsreader-OFL.txt">Newsreader</a>, <a href="/inward-life/literata-OFL.txt">Literata</a>, <a href="/music-and-feeling/GentiumPlus-OFL.txt">Gentium Plus</a>, <a href="/learning-to-see/alegreya-OFL.txt">Alegreya</a> and <a href="/beside-the-bed/OFL.txt">Bitter</a>. Cover lettering follows each reader’s entrance.</p></details></div></div></footer>
<dialog id="edition-dialog" aria-labelledby="edition-title"><button type="button" class="close-dialog" aria-label="Close edition preview">${close}</button><div id="edition-content"></div></dialog></body></html>`;
}

export async function buildLibrary(){
 const data=JSON.parse(await readFile(new URL('entries.json',import.meta.url),'utf8'));
 const catalog=JSON.parse(await readFile(new URL('examples/catalog.json',root),'utf8'));
 for(const b of validateEntries(data)){
  assert.ok(catalog.examples.some(e=>e.id===b.exampleId&&e.directory==='examples/'+b.exampleId&&e.reviewedBuild.length),'Edition needs an existing exact reviewed build');
 }
 await mkdir(new URL('.',import.meta.url),{recursive:true});
 await writeFile(new URL('index.html',import.meta.url),renderLibrary(data));
 return {editions:data.editions.length};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(await buildLibrary());
