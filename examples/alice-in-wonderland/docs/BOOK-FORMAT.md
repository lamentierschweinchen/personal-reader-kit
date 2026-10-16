# Source compatibility and exact text

| Input | This version | Required care |
| --- | --- | --- |
| UTF-8 `.txt` | Direct browser import or local CLI | Choose prose/poetry. Characters, newlines, tabs, leading/trailing spaces, BOM and blank-line separators are preserved. Hard wrapping is retained; no silent dehyphenation. |
| Version 1 reader `.json` | Direct import after validation | Up to 8 MB file size. Exact edition hash, stable IDs, text blocks, emphasis offsets and source provenance. |
| DRM-free EPUB | Bounded local preparer for a narrow unstyled subset; otherwise a reviewed adapter | Inspect OPF/spine, navigation, XHTML, CSS, notes, emphasis, reading order and text-bearing images. Extract locally with safe archive handling; reject traversal, symlinks, external resources and oversized/decompression-bomb archives. |
| Text PDF | Agent-assisted conversion | Verify page order, columns, headers, hyphenation, Unicode, notes and poetry. Plain extracted text alone is not a fidelity check. |
| Scanned PDF/images | Local OCR plus review, not built in | Compare OCR against source pages. Keep original scans local. Mark unresolved words; do not invent missing text. |
| DOCX/HTML | Not directly importable | A reviewed local adapter can produce the book contract. Preserve meaningful structure and strip active content. |
| DRM-protected/app-only ebooks | Unsupported | Do not bypass DRM or promise importability because a book was purchased. Ask for an authorized usable source. |

The current renderer is for text and renders a complete section at once. File/text limits are validation ceilings, not mobile performance promises. Preserve natural chapters when preparing long works and test the actual edition on the intended device; a single enormous TXT section may need a reviewed structural conversion. A text block is limited to 200,000 UTF-16 code units and an inter-block separator to 1,000; split unusually long blocks without changing their concatenated text. Genuine illustrations, complex tables, interactive source footnotes, bidirectional layout edge cases and facsimile typography require an adapter and renderer extension with tests. Do not flatten a work to fit this version and call it faithful. Greek and other Unicode characters are retained; glyph coverage depends on device fonts and must be checked for the actual language.

## Local conversion of a text file

```sh
npm run import:text -- /path/to/book.txt "Book title" verse
```

Use `prose` for prose. The CLI writes a new file in ignored `.reader/private/`, uses a source hash as the ID, and refuses to overwrite an existing conversion. Import that file through **Bring a book**. It does not deploy or commit anything. Text layout choices never change the supplied characters.

## Bounded local EPUB preparation

With Python 3.10+ available alongside Node, run:

```sh
npm run import:epub -- /path/to/book.epub
```

This local tool makes no network requests and never extracts archive members to the filesystem. It inspects the container, manifest and spine before creating a private, provisional `edition.reader.json` and `receipt.json` in a new ignored `.reader/private/epub-…/` directory. Files are created with owner-only permissions and are never overwritten. Read the receipt and compare the rendered EPUB with the candidate before importing it. **Preparation is not proofreading or proof of complete literary fidelity.** Raw source bytes remain unchanged.

The initial subset is UTF-8 EPUB 2/3, one rendition, explicit linear XHTML spine order, and unstyled text in paragraphs, headings, `pre`, `br`, `em`, `strong`, `sup`, `sub` and neutral containers/spans. It preserves decoded Unicode, explicit line breaks, `pre` whitespace/fixed verse and UTF-16 emphasis offsets. XML parsing normalizes source CRLF; structural paragraphs receive explicit two-newline separators. These are documented conversion decisions, not a byte-identical extraction of XHTML markup. Plain XHTML with wrapped/repeated whitespace requires review instead of a guess about meaningful spaces. Document-language changes also require an adapter.

Stylesheets, inline styles/classes, images, lists, tables, active content, linked source notes, specialized metadata/layout, nonlinear or unexplained non-spine resources and language/direction changes are outside this subset. A declared navigation-only file is inventoried separately; compare its hierarchy with the prepared section sequence. Unknown structures stop candidate creation instead of being silently dropped. The command exits 2 with a private report and **no edition** when it needs an adapter; exit 1 means it could not complete inspection. Many commercial and public-domain EPUBs use CSS or illustrations and will need that more capable preparation.

Archive checks reject encryption declarations (including obfuscation this adapter does not interpret), encrypted entries, unsafe or duplicate paths, symlinks, external manifest references, DTD/entity declarations and excessive sizes/compression. Limits are 64 MB compressed/expanded, 2,048 members, 8 MB per member, a 150:1 compression ratio, and the existing reader/import ceilings. A rejection is not proof of malicious content or DRM; it marks this adapter's boundary. Do not remove encryption or discard assets merely to get a green result.

The private receipt identifies the source hash, resource/spine coverage, unsupported feature and required review. It contains no claim that a count or checksum substitutes for comparison with the actual source. Complete a faithful adapter in the same project if the book warrants it. Keep the exact final prepared edition with your private bundle; a later conversion can produce different anchors.

## Book contract

The live examples are in `samples/library.json`. A book is:

```js
{
  schema: 1,
  id: "stable-work-id",
  title: "Title",
  author: "Author as supplied",
  edition: "Edition description",
  language: "en",
  source: {
    sha256: "64 lowercase hexadecimal characters from the source bytes",
    format: "text/plain",
    description: "Import method and provenance, without private filesystem paths"
  },
  sections: [{
    id: "section-1",
    title: "First section",
    blocks: [{
      id: "block-1",
      kind: "verse", // prose | verse | heading | note
      text: "One line\n    another line",
      after: "\n\n", // exact source separator after this block
      marks: [{ kind: "em", start: 0, end: 3 }],
      layout: "reflow" // optional: reflow | fixed
    }]
  }],
  context: [{
    label: "About this edition",
    text: "A factual note or explicitly identified interpretation.",
    kind: "source", // source | editorial | author (sample provenance)
    url: "https://example.org/primary-source", // optional real supporting source
    through: null // null = introductory; section ID = explicit spoiler boundary
  }]
}
```

Offsets are JavaScript UTF-16 code-unit offsets, the same model as DOM Range. Do not index by encoded UTF-8 bytes. Preserve Unicode normalization exactly. `em`, `strong`, `sup` and `sub` ranges can overlap; the renderer splits intervals without changing text. Raw HTML and unknown contract fields are deliberately rejected, including unsupported source-note or image fields. Extend and test the adapter/renderer together rather than dropping them. CSS `pre-wrap` retains whitespace and allows a long line to wrap to the screen; `fixed` preserves line geometry with keyboard-focusable local horizontal scrolling. Source separators, including those on empty blocks, control visible stanza gaps. Structural block styles must never invent italics absent from the source.

Book/section/block IDs must be stable ASCII identifiers, not titles or filesystem paths. A changed source must have a new source hash. Stable work IDs allow the UI to retain old notes for review when a new edition replaces a stored book. Text imports use content-derived IDs, so changed text is a separate book by default.

Do not claim an EPUB/PDF text hash proves transcription fidelity. Its raw source hash identifies the edition; separately compare the converted text and structure to its source. Keep detailed page/element mappings, local paths and uncertainty reports in `.reader/private/`. The public sample hashes prove only the exact original demonstration text and build input.

## Annotation and recovery contract

A saved passage records the book hash, section, block IDs, start/end offsets, exact quote, and up to 40 characters of prefix/suffix context for each segment. Separators between selected blocks are retained. Highlight wrappers must leave DOM `textContent` exactly unchanged. Quotes are checked against their source before rendering or opening them.

If a book is missing or changed, show the saved quote and note with the recovery reason. Never fuzzy-match and move it automatically. Backup import preserves conflicting notes under separate IDs, fills missing reading places, keeps existing places and appearance, and never widens spoiler boundaries. Corrupt stored state must not be replaced with an empty object; export its raw data for private recovery.

Restoring an unchanged backup repeatedly must not multiply preserved conflict copies. A damaged book is isolated from valid records. Settings can export raw recovery data containing local books as well as state; this private recovery bundle is for repair by the reader's agent, not the normal annotation-restore input. Nothing is deleted automatically.

Connections in state schema 1 are an optional `connections` array for compatibility with older backups. Each entry has `id`, `note`, `updated`, and exactly two `passages`. Each side uses the annotation’s `bookId`, `sectionId`, `revision`, `quote` and `segments`; it is not a global reflection or a pair of mutable URLs. Conflict copies retain both source identities. Use the current reader to restore these backups; older application versions may not understand the added records. Legacy unbound reflections are kept without assigning invented passage references.

Settings exports each exact prepared book contract for migration. Retain that file alongside raw sources and the records backup: the source-byte hash alone does not reproduce an adapter’s block IDs, marks or layout. A repair of unreadable state is a separate explicit operation from a normal backup merge. It archives the original object and installs a validated backup atomically, preserving the book store. Recovery archives are included in raw export; they are never silently deleted.

## Private portable bundle

Settings can pack selected exact editions and **all saved reading records** in a version 1 `personal-reader-bundle` JSON file (up to 64 MB and 200 editions). Unchecked books' saved quotations still travel with the records. The bundle records the kit version and a SHA-256 of canonical JSON for accidental corruption detection. This checksum is neither authentication nor encryption. The file includes private full texts/notes; keep it out of repositories and public uploads. Unsaved drafts and damaged records/recovery archives require their separate exports.

Restore validates the file, previews added/existing editions and recoverable unresolved quotations, and refuses a colliding book ID with different prepared content. Confirmation commits new books and merged records in one IndexedDB transaction. A failure changes neither store. Concurrent state or edition changes invalidate the preview; reopen it against the current library. Existing reading places remain, missing places return, and saved appearance is opt-in. Spoiler permissions are never widened by an ordinary bundle restore. Conflicting notes/connections remain separate and repeat restores do not multiply them. A missing edition leaves recoverable quotations without guessed anchors.

Unreadable state still uses the separate repair transaction. Retain a raw recovery export, then use a validated state backup (a bundle's validated `state` object can supply it through an authorized local repair). Ordinary restore never overwrites damaged state or silently deletes damaged books. A fresh-browser restore and later reload are required before retiring the source origin.

## Alice project adapter (local, not upstream v0.4.0)

This project adds bounded embedded PNG/JPEG `assets` with per-file hashes, dimensions and alt text, plus `figure`/`initial` references, `rule` blocks, `smallcaps` marks, exact per-line `lines` geometry, `pages`, `sourceNotes` and `links`. No raw HTML, executable SVG, remote image URL or arbitrary CSS is accepted. The original schema fields remain intact. See `site/core.mjs` for the full validation boundary and `docs/FIDELITY.md` for the source-specific transformations.

The exact JSON and its image bytes travel in portable bundles. Upstream kit v0.4.0 does not understand these additional fields and should reject them. Restore with this adapted application; do not strip fields to make a bundle import into the text-only upstream kit. This is an edition-specific implementation, not a general-purpose illustrated EPUB importer.
