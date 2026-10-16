# Fidelity receipt

The baseline is the downloaded Gutenberg 1342 illustrated HTML edition, accessed 16 October 2026. See [source and rights](SOURCE-RIGHTS.md) for raw hashes and the exact asset inventory. This is a complete digital-source adaptation with verified character coverage, **not a claim of full proofreading or print-facsimile fidelity**.

## Coverage and reproducibility

The reviewed adapter `scripts/prepare-austen.py` accepts only the pinned archive hash, validates archive paths, size/ratio bounds, encryption flags and symlink modes, and processes source HTML locally with lxml. It permits a closed set of source tags and refuses unmapped non-whitespace text. Pillow verifies each original image and records its dimensions; no image is modified. Original files remain untouched.

The result has 66 ordered sections: source notice/credits, cover/title/dedication and source contents, Saintsbury’s preface, the original illustration list, all 61 chapters, and the full Gutenberg license. It has 2,513 retained text/image blocks, 164 distinct image resources (104 other image resources and 60 decorated initials), 169 textual links, 496 source page markers, 536 italic ranges, 9 small-capital ranges, 6 strong ranges, 3 superscript ranges and 7 deliberately spaced punctuation ranges. The source has two tables; their row/cell/spanning structure is retained. No footnotes, verse stanzas or Greek passages were found in this HTML’s inspected structure; letters and 93 interior explicit line breaks are retained.

The adapter consumes every non-whitespace body text/tail node. A separate recursive traversal of the original body, including the text represented by initial-image alternatives, matches the prepared **non-layout character sequence in full and in order**. Its SHA-256 is `d5824830b25e09a0596ff8912cbe407c22d3c149a118a8f392ccafe6758fecda`. This differs deliberately from the raw-byte hash. Detailed XPath/block/source-line mapping and coverage counts are in ignored `.reader/reports/austen-conversion.json`.

## Explicit transformations

- Normal HTML ASCII whitespace is collapsed as reflowable text. NBSP, punctuation, spelling, accents and Unicode normalization are unchanged. No spelling modernization or dehyphenation is added. All source characters here fit in a single UTF-16 code unit; the adapter refuses an unexpected astral character until offset conversion is added.
- Interior `br` breaks remain newlines. Only decorative edge breaks around an image/heading are trimmed; structural blocks receive two newlines. Original hard-wrapped HTML lines are not mistaken for verse.
- Source italic/strong/superscript/small-cap/page/spaced ranges become validated offsets. Letter indentation, signature alignment, captions, title-page cells and the illustration index receive explicit presentation metadata. The renderer uses DOM nodes, never executable source HTML.
- All image bytes remain unchanged. Images with letter alternatives supply selectable initial characters. Chapter XXXVI’s initial has a blank source alternative, but its adjacent text already spells ELIZABETH; the existing E is shown with the source image, not doubled. Chapter XIII’s image alternative includes an opening quotation mark absent from the image itself; the reader visibly retains that supplied punctuation while keeping the actual text selectable.
- Internal contents/page references open passage context and preserve the main place. Physical page markers remain source markers, not an invented progress percentage. Source TOC/table ordering is unchanged.
- Source section headings remain verbatim inside the text; the navigation also provides Arabic chapter numbers. The home page starts at Chapter 1 by explicit choice. The source’s preface and illustration index remain before the novel, with a spoiler opt-in. The frontispiece is also warned about. These source gates are independent of the reader’s companion permissions.

## Checks and editorial limits

The book-specific browser test compares `textContent` with the exact prepared contract for all 66 sections and verifies all 164 rendered images against their recorded dimensions. It exercises the long Collins letter, actual italic text, illustrated initials, source references and chapter links. Automated agreement is separate from the settled screenshot review and from human proofreading. Screenshots are private under `.reader/reports/`; none enters history or a public build.

The selected visual checks include the cover/title page, chapter headers, a decorated initial, the long letter, large-text exact passage context, portrait/landscape reading and the source illustration index. Typography is reflowed for screens; it is not a facsimile. Many source images have empty or incomplete alternatives. Existing alternatives and captions are retained, but a full descriptive-alt-text editorial pass and screen-reader review are still pending. A human reading from first to last is also pending; counts and hashes are not that review.

## Portability

The exact prepared contract is stable for this revision and anchors notes to the raw source hash plus section/block/offset/context. Keep it with the reviewed image inventory. Private bundles and edition JSON preserve the extended contract, but image binaries are served from this example and are **not embedded in those exports**. Moving the reader to a new origin requires the reviewed application and all image assets, as well as the private bundle. The unmodified kit intentionally rejects these new source fields. It cannot yet restore this illustrated adaptation by itself.

This project does not produce EPUB. The source catalogue provides a clearly labeled source-edition EPUB3 with images; web notes do not synchronize with e-readers.
