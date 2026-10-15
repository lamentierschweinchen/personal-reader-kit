# Source compatibility and exact text

| Input | This version | Required care |
| --- | --- | --- |
| UTF-8 `.txt` | Direct browser import or local CLI | Choose prose/poetry. Characters, newlines, tabs, leading/trailing spaces, BOM and blank-line separators are preserved. Hard wrapping is retained; no silent dehyphenation. |
| Version 1 reader `.json` | Direct import after validation | Up to 8 MB file size. Exact edition hash, stable IDs, text blocks, emphasis offsets and source provenance. |
| DRM-free EPUB | Agent-assisted conversion | Inspect OPF/spine, navigation, XHTML, CSS, notes, emphasis, reading order and text-bearing images. Extract locally with safe archive handling; reject traversal, symlinks, external resources and oversized/decompression-bomb archives. |
| Text PDF | Agent-assisted conversion | Verify page order, columns, headers, hyphenation, Unicode, notes and poetry. Plain extracted text alone is not a fidelity check. |
| Scanned PDF/images | Local OCR plus review, not built in | Compare OCR against source pages. Keep original scans local. Mark unresolved words; do not invent missing text. |
| DOCX/HTML | Not directly importable | A reviewed local adapter can produce the book contract. Preserve meaningful structure and strip active content. |
| DRM-protected/app-only ebooks | Unsupported | Do not bypass DRM or promise importability because a book was purchased. Ask for an authorized usable source. |

The current renderer is for text. A text block is limited to 200,000 UTF-16 code units and an inter-block separator to 1,000; split unusually long blocks without changing their concatenated text. Genuine illustrations, complex tables, interactive source footnotes, bidirectional layout edge cases and facsimile typography require an adapter and renderer extension with tests. Do not flatten a work to fit this version and call it faithful. Greek and other Unicode characters are retained; glyph coverage depends on device fonts and must be checked for the actual language.

## Local conversion of a text file

```sh
npm run import:text -- /path/to/book.txt "Book title" verse
```

Use `prose` for prose. The CLI writes a new file in ignored `.reader/private/`, uses a source hash as the ID, and refuses to overwrite an existing conversion. Import that file through **Bring a book**. It does not deploy or commit anything. Text layout choices never change the supplied characters.

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
