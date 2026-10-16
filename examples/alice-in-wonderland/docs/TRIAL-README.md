# Archived trial handoff

This is the original handoff at source commit `5a6b643134e885e8ac9a6688aed05767d5eac8b7`. Statements about a local-only repository, publication permission and audit commands describe that trial. See [the current example README](../README.md) and [the shared example policy](../../README.md) for the packaged copy.

# Alice’s Adventures in Wonderland — the illustrated reader

A complete, usable local reader for Lewis Carroll’s **Alice’s Adventures in Wonderland**, with **Arthur Rackham’s illustrations and Austin Dobson’s proem**, prepared from Project Gutenberg **28885**. Built from personal-reader-kit v0.4.0 (`4c386ed521dc16f1bd08c96c3eafbdf765b4f4e7`). This is an independent example project, not an upstream kit change.

The edition has 19 sections: front matter, both introductory poems, the original contents and plate list, all twelve chapters, the colophon/transcriber’s note, and the full source notice/licence. All 38 source image files are included locally, at their 43 source uses. There is no abridgment or mixing with Tenniel, Under Ground, or PG19033.

```sh
PORT=4192 npm run dev
npm test
npm run build
TEST_PORT=4292 npm run test:browser
TEST_PORT=4292 npm run test:share
npm run audit:public
```

Node 22+ is sufficient for the app, build, unit tests and audit. Browser checks require an installed Playwright module and Chromium/WebKit; `PLAYWRIGHT_MODULE`, `CHROME_PATH` and `WEBKIT_PATH` can select existing runtimes. No runtime download is performed by the test. The source adapter/checker requires Python with `lxml` and Pillow, and the retained ignored original archive. The app has no third-party runtime dependencies or remote fonts.

Open the edition, select some words and keep a note. Settings offer paper/dusk/ink, type up to 36 px, spacing, focus mode, and private export/restore. Images open in an enlargement dialog. The mouse’s tail has its original HTML line indentation and shrinking type, plus **Uniform type**, which retains the exact words and line breaks. The optional **Looking closer** companion offers two short editorial exercises and a literal phrase finder. Later text and images require explicit chapter permission. Excursions preserve the main reading place.

Select a sentence or several paragraphs, then choose **Keep or share passage**. **Share passage** opens the device share sheet when supported; **Copy passage** copies plain text for a message or notes app. Both include the exact quotation’s characters, line breaks, blank lines and indentation, followed by author, title, section and edition. The attribution is visible before sharing. Your personal note, private library metadata and this device’s URL are excluded. Saved passages use the same actions through **Edit note**. A mismatched edition must be restored before attributed sharing is offered.

Dismissing the native share sheet leaves the draft and place intact and does not copy anything automatically. If native sharing or clipboard access is unavailable, a selectable full-text fallback stays in the editor. A resolved native share request is not confirmation that a recipient received it. The reader does not create public quote URLs or upload quotation cards.

After **Available offline** appears, this browser can read the cached edition, visit permitted companion passages, and create or edit saved annotations without the origin being available, provided its cache and local storage remain intact. Chromium and WebKit checks stop the server, prove direct network requests fail, restart the browser from its persistent profile, then create/edit a note and verify its exact text and reading place after offline reloads. Native airplane-mode controls and physical iOS share-sheet delivery have not been tested. Other apps may need a connection to deliver a shared passage. Keep a private bundle backup; notes remain local and do not synchronize between devices.

The [Alice art direction](docs/DESIGN.md) uses an upright blue title and Rackham’s rabbit-hole drawing for the entrance, with compact reading controls and a separate illustration study. “Meet Alice twice” compares the frontispiece with the opening paragraph after explicit Chapter I permission. In Chapter III, **Tail type** opens the source-shape/uniform choice. Images fit the study window before enlargement, and retain their original paper and colors in dusk.

Project Gutenberg’s notice is shown on first access in each tab, with immediate access to the complete included licence. The source catalogue and unmodified source-edition downloads remain linked. [Source EPUB with images](https://www.gutenberg.org/ebooks/28885.epub3.images) is a separate Gutenberg file: **the kit does not export EPUB, and web notes do not synchronize with an e-reader**.

## Evidence and handoff

- [Source, rights and asset provenance](docs/SOURCE-AND-RIGHTS.md), including raw hashes and jurisdiction limits.
- [Fidelity and adaptation receipt](docs/FIDELITY.md): exact scope, retained features, deliberate presentation changes and proofreading limits.
- [Kit feedback and verification](docs/KIT-FEEDBACK.md): what worked, observed problems, project fixes and remaining blockers.
- [Per-image inventory](edition/assets.json): original member paths, URLs, hashes, dimensions, original and editorial alt text, rights basis and every use.

The adapted prepared edition is `edition/library.json`. Image bytes are embedded as bounded PNG/JPEG data inside that exact contract, so offline reading and private bundles carry them together. The build verifies its pinned hash and each decoded image against the reviewed inventory. The original sample gate remains intact; those samples are not the displayed library. The project-specific image/line/annotation fields require **this adapted reader**; upstream v0.4.0 correctly rejects them.

Raw ZIP/EPUB/HTML, the completed intake, detailed mappings, screenshots, browser profiles, failure evidence, private bundles and audit receipts remain under ignored `.reader/`. `dist/` is ignored and has exactly thirteen outputs. Personal imports and notes stay in browser storage; storage can be cleared or evicted. Export a private reading bundle and verify restoration at the new origin before moving a library. A bundle contains full text and personal notes, without encryption.

This repository is local-only, on `codex/alice-in-wonderland`, with **no remote, push or deployment**. The intended example audience is public, but no destination or publication authorization has been selected. A source catalogue’s “public domain in the USA” is not worldwide clearance. Before any publication, review the destination, jurisdiction, full history, precise candidate assets and source-notice presentation. The copied kit deployment guides describe the original-samples baseline; the local adaptation and its boundaries are documented here.

This trial demonstrates an agent building with a real book. It is not a completed human newcomer pilot, physical iOS test, e-ink device test, screen-reader audit, or complete human proofreading of a print edition.
