# Fidelity receipt

Source: the exact HTML and its linked images documented in [SOURCE-RIGHTS.md](SOURCE-RIGHTS.md). Preparation: `scripts/prepare-walden.py`, a deliberately source-pinned adapter. It refuses a changed raw source hash and unexplained structures. Detailed per-element text hashes and UTF-16 emphasis maps are in ignored `.reader/reports/fidelity.json`.

The kit EPUB preparer returned exit 2, `needs-adapter`, issue `manifest-feature`, with no candidate. Its early refusal did not enumerate later CSS/image/table features. The actual archive was separately inspected; it includes styled XHTML, a generated SVG cover wrapper, two JPEGs, a contents table and fixed accounts. No unsupported content was deleted to make the narrow preparer pass.

## Coverage and transformation

- Both complete works: Walden's title/contents/epigraph and all eighteen chapters; the full civil-disobedience essay. They have distinct IDs and reading places. The source's heading wording is preserved.
- 536 literary paragraph elements, including 38 verse passages; eight preformatted accounts; 20 contents rows; 280 italic elements; both source images. The source's `THE END` remains at the end of Walden.
- Source licence/header moved to a clearly named appendix in each work so a separately exported work retains its source terms. These appendices are counted as sections, never as printed pages or chapters.
- Ordinary HTML ASCII whitespace collapses as in its browser rendering. Explicit `br` becomes a newline; nonbreaking spaces, diacritics, ligatures and Unicode punctuation remain. `<pre>` spaces and newlines are exact after CRLF-to-LF normalization. No dehyphenation, spelling repair or Unicode normalization.
- Source italic elements become exact UTF-16 ranges. Source `.poem` indentation, `.p2` separation, and fixed account geometry receive explicit local styles; structural headings do not invent italic emphasis.
- The one-column source contents table is represented as ordered source rows with live links. The source's `WALDEN` contents anchor leads to Economy, immediately after its work heading; the second work's link opens its own identity. There are no linked source footnotes in this edition. Inline qualifications and parenthetical notes remain in the prose.
- The HTML cover and survey stay in the original order and location. Original pixels are embedded in the exact prepared edition and also retained as separately reviewable binary assets. The EPUB's cover placement/recompression is not substituted for the HTML edition.

The complete text is selectable. Fixed accounts scroll locally by keyboard or touch instead of losing columns. Source illustrations can be enlarged without changing reading position; the map's small labels require enlargement on phones.

## Checks and limits

`tests/walden-browser.mjs` reconstructs logical text independently using the browser's HTML parser and compares every source leaf with the prepared edition, all chapter headings, and every rendered section in Chromium and WebKit. It also exercises actual accounts, indented verse, complete image decoding, large type and late-range annotation return. `tests/walden.test.mjs` checks both work identities, feature counts, image hashes, rejected unsupported fields and a real-source portable bundle.

These establish extraction coverage, logical-character agreement and representative visual fidelity to this digital edition. They are not line-by-line proofreading against a print exemplar or an assertion that Gutenberg contains no errors. For example, the source's civil-disobedience verse reads “Out love of industry”; that wording remains untouched. No alternate edition was silently substituted.

The typography is a reflowing reader, not a facsimile. The original paragraph indentation and justified typesetting are not reproduced globally; paragraph boundaries, source emphasis, verse line breaks and account alignment are. The map's alt description is partial, not a replacement for every printed measurement. Native touch selection, physical iOS, e-ink rendering, a screen-reader reading journey and a human newcomer pilot remain untested.

A future kit EPUB exporter would need two-work navigation, title matter, source terms, attributed illustrations and alt descriptions, exact verse breaks/NBSP indentation, fixed accounts (or equivalently faithful accessible tables), emphasis ranges, and portable image bytes. This project provides the source publisher's EPUB link. It does not export EPUB, and web notes do not synchronize with e-reader notes.
