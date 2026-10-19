# Illustrated collection contract

The selected reader extends schema 1 with `learning-to-see/illustrated@1`. The stock text profile remains supported and rejects illustrated fields. This public copy includes the complete prepared books at `edition/library.json`, selected companion references at `edition/study-data.json`, and their pin file at `edition/inventory.json`. Item-specific rights evidence and the image inventory are in `docs/`. Raw HTML/ZIP packages, private preparation and rendered review evidence remain outside this copy in the independent source project's ignored `.reader/`.

The adapter reads the complete historical digital editions, including title matter, notes, tables, running topics, index and verse. It collapses ordinary HTML layout whitespace; explicit line breaks, nonbreaking spaces, punctuation and Unicode remain. Nested index subentries retain their list depth as explicit layout metadata. Printed page labels are retained as source-link anchors and omitted from the running words. Verse lineation and indentation remain explicit. Tables retain cell boundaries and column spans; unsupported row spans fail visibly; figures retain their digital-edition placement. All source links resolve locally without changing the main reading place.

Raster originals are embedded in each prepared book with media type, decoded-byte SHA-256, actual dimensions, accessible source description and provenance. Validation checks PNG/JPEG signatures, dimensions, decoded-byte integrity and limits. HTML, SVG payloads, executable source markup and remote assets are not accepted. Illustrations travel in exact-edition and private bundle exports. A matching reader revision is required to restore them. The reader-specific export is not an EPUB.

The full-text receipt establishes character agreement after these documented transformations, not print-page proofreading. Crane’s own transcription notes describe changed figure placement and corrected typos. Ruskin’s digital source records a correction of a figure letter. These source decisions are retained, not independently repaired.

## Build boundary

`build({output})` exports the exact final output list and writes the complete collection to `library.json`. It reads `edition/library.json` and `edition/study-data.json`, verifying both byte hashes against `edition/inventory.json` before copying them to the output. `npm run build` emits `dist/`; `npm run dev` builds and serves that same complete collection. Output must be a separate project-relative directory; absolute paths and traversal are rejected. A content-versioned worker caches the complete explicit output, including both pinned Alegreya faces and their full OFL notice; see [font provenance](FONTS.md).

`dist/` and `.reader/` remain ignored in Git. The selected `.vercelignore` explicitly allows only the reviewed build inputs for standalone or combined hosting. The enclosing kit owns the public-file inventory, canonical mounting and publication review. The independent source project's raw files, private records and Git history were not imported. Its local trial used isolated build-output tests to protect the served preview; those source-project checks and their reports are historical evidence, not additional files required to rebuild this copy.

## Runtime integration

Font URLs are relative to the collection stylesheet. The standalone application uses root-relative requests: `/library.json`, `/study-data.json`, `/sw.js`, `/cover.svg`, application modules/styles, manifest and icon. UI navigation uses hashes: `#shelf`, `#read/<book>/<section>`, `#companion/comparison`, `#companion/repeat`, `#passages`.

Standalone IndexedDB: `learning-to-see-v1`. Worker cache prefix: `learning-to-see-`. First-use source notices use localStorage keys `learning-to-see-notice-<source SHA-256>`. No network requests are made for source images. All source-image data is portable in the edition. Combined hosting adapts application paths, worker scope and storage/cache namespaces for the canonical mount while preserving the prepared edition bytes.

## Verification limits

Browser emulation covers desktop, phone, tablet and short landscape geometry; exact block text, image decode, source round trips, notes and failed saves, bundle export/restore and a stopped-origin offline path. It does not establish physical-device touch selection, screen-reader performance, complete print comparison, drawing pedagogy or human editorial acceptance.

Verse has explicit per-line insets in em, independent of literary characters. The source’s 9.5em refrain and 16em attribution remain recoverable in Source lines mode. Wrap verse changes layout for the adjacent stanza group without changing source characters, emphasis, line breaks or anchors. The source heading inside the edition carries the visible section title; an accessible interface heading does not duplicate it above the book. Table columns use their actual content to keep short keys narrow while retaining cell boundaries and column spans.

The production companion centres on the olive comparison and retains the repeat workbench as optional. Three original working studies were tried before selection; the paper-step UI is archived privately and the source exercise remains a plain link. Paired detail viewBoxes change the viewport of each exact raster without stretching it or changing its pixels. The public catalogue link appears only on the shelf, with a no-JavaScript fallback.

Illustration detail fits both available dimensions after persistent controls/caption, capped at intrinsic pixels. The complete dialog wrapper has a definite height; its image viewport receives the remaining flex allocation. Original pixels and explicit zoom retain local scrolling. Source credit is recoverable in a disclosure, and the visible caption remains legible at enlarged reader settings. A current pending library load and a genuinely unresolved image are distinct states.

Actual interface text enlargement is tested independently of reader presets: all rendered computed font sizes are doubled at 320px and 390px. Masthead navigation and the complete illustration heading reflow while Aa/Close remain reachable. Source bytes and normal type sizes are unchanged.

The final enlargement matrix also covers 720px height. At 320px with doubled fonts, opened source details could consume the image allocation. The narrow control grid now groups the two image actions above the zoom controls, and the image viewport reserves 44px; Fit still uses its measured remaining width and height. Font sizes and source bytes are unchanged.
