import {readFile, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {cover} from '../library/covers.mjs';
import {escape, validateEntries} from '../library/render.mjs';

const arrow = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
const back = '<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 12H5m6-6-6 6 6 6"/></svg>';
const short = {alice:'Alice in Wonderland', walden:'Walden', 'two-halls':'Two lecture halls', 'music-and-feeling':'What can music say?'};
const lines = {
  'at-table':'Asparagus, stock and coffee, compared.',
  'inward-life':'Three accounts of spiritual experience.',
  'music-and-feeling':'One symphony, two judgments.',
  'learning-to-see':'From branch to pattern.',
  'beside-the-bed':'What does useful company require?',
};
// These dimensions compose the shelf; they do not represent page counts.
const dimensions = {
  'at-table':[318,48], 'inward-life':[337,53], 'music-and-feeling':[296,45],
  'learning-to-see':[328,45], 'beside-the-bed':[306,51], austen:[330,47],
  alice:[306,46], walden:[318,52], 'two-halls':[293,46], odyssey:[332,52], dracula:[314,48],
};
const faceout = new Set(['alice','at-table','walden']);
const sortTitle = b => b.title.replace(/^(a|an|the)\s+/i, '');
const detail = b => `<div class="chosen-bibliography"><p class="chosen-author">${escape(b.shortAuthor)}</p><h3>${escape(b.title)}</h3></div><p class="chosen-feature">${escape(lines[b.id] || b.feature)}</p><a class="chosen-read" href="/${b.id}/">Read this edition ${arrow}</a>`;
// A button accepts phrasing content. Keep the shared jacket's inner artwork intact.
const buttonCover = b => cover(b).replace('<div class=', '<span class=').replace(/<\/div>$/, '</span>');

export function renderShelf(data) {
  const books = [...validateEntries(data)].sort((a,b) => sortTitle(a).localeCompare(sortTitle(b),'en'));
  const volumes = books.map((b,i) => {
    const [height,thickness] = dimensions[b.id] || [318,48];
    return `<li class="shelf-volume volume-${b.id}${faceout.has(b.id)?' is-faceout':''}${i===0?' is-selected':''}" style="--book-height:${height}px;--thickness:${thickness}px" data-volume="${b.id}"><button type="button" class="book-pick" aria-label="Preview ${escape(b.title)}" aria-pressed="${i===0}" aria-describedby="shelf-help" data-shelf-book="${b.id}"><span class="book-object" aria-hidden="true"><span class="book-spine"><span class="spine-title">${escape(short[b.id] || b.title)}</span><span class="spine-imprint">nr<span></span></span></span><span class="book-front">${buttonCover(b)}</span><span class="book-back"></span><span class="book-top"></span><span class="book-pages"></span></span></button></li>`;
  }).join('\n');
  return `<section class="mixed-library" id="samples" aria-labelledby="samples-title">
 <div class="shelf-heading"><h2 id="samples-title">Read one <span class="pen-circle">now</span>.</h2><a class="all-editions" href="/library/">The library <span>${books.length} editions</span> ${arrow}</a></div>
 <div class="shelf-interactive" hidden>
  <div class="shelf-preamble"><p class="shelf-hand">Take one off the shelf.</p><a href="/library/" class="covers-switch">Show all covers ${arrow}</a><div class="shelf-controls" role="group" aria-label="Choose a book"><button type="button" data-shelf-step="-1" aria-label="Previous book">${back}</button><button type="button" data-shelf-step="1" aria-label="Next book">${arrow}</button></div></div>
  <p class="shelf-sr" id="shelf-help">Select a book to see its cover and reading link. With a book focused, use the Left and Right arrow keys to choose another.</p>
  <div class="shelf-room"><ul class="bookcase" aria-label="${books.length} editions, alphabetical by title">${volumes}</ul><div class="shelf-edge" aria-hidden="true"></div></div>
  <div class="chosen-book" id="chosen-book">${detail(books[0])}</div>
  <span class="shelf-sr" id="selection-status" role="status" aria-live="polite" aria-atomic="true"></span>
 </div>
 <ul class="shelf-fallback" aria-label="Read an edition">${books.map(b=>`<li><a href="/${b.id}/" aria-label="Read ${escape(b.title)}">${cover(b)}<h3>${escape(b.title)}</h3><p>${escape(b.shortAuthor)}</p></a></li>`).join('\n')}</ul>
 <div hidden>${books.map(b=>`<template data-shelf-detail="${b.id}">${detail(b)}</template>`).join('')}</div>
</section>`;
}

// Share the library's jacket artwork without its page layout, hover rules or
// responsive grid. Only top-level font faces and jacket selectors are admitted.
// Scoping is essential: the homepage marquee has its own .cover geometry.
export function shelfCoverCSS(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = ['/* Generated from library/style.css by shelf/render.mjs. */'];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf('{', cursor);
    if (start < 0) break;
    const selector = source.slice(cursor, start).trim();
    let end = start + 1, depth = 1;
    for (; end < source.length && depth; end++) {
      if (source[end] === '{') depth++;
      if (source[end] === '}') depth--;
    }
    assert.equal(depth, 0, 'Unbalanced library CSS');
    const body = source.slice(start, end);
    if (selector === '@font-face' && !body.includes("/assets/")) rules.push(selector + body);
    else if (!selector.startsWith('@')) {
      const jackets = selector.split(',').map(s=>s.trim()).filter(s => /^\.cover(?:\b|-[\w-]+)/.test(s) && !/^\.cover-(?:button|invitation)\b/.test(s));
      if (jackets.length) rules.push(jackets.map(s=>'.mixed-library '+s).join(',') + body);
    }
    cursor = end;
  }
  assert.ok(rules.some(r=>r.startsWith('.mixed-library .cover{')), 'Missing jacket geometry');
  return rules.join('\n') + '\n';
}

export async function buildShelf() {
  const data = JSON.parse(await readFile(new URL('../library/entries.json',import.meta.url),'utf8'));
  const html = renderShelf(data);
  const css = shelfCoverCSS(await readFile(new URL('../library/style.css',import.meta.url),'utf8'));
  await writeFile(new URL('covers.css',import.meta.url), css);
  return html;
}
