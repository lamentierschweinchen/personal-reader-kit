# Archived trial handoff

This is the original handoff at source commit `2893d3cbd416275145465e2fabe00af722a819a8`. Statements about a local-only repository, publication permission and audit commands describe that trial. See [the current example README](../README.md) and [the shared example policy](../../README.md) for the packaged copy.

# Walden & Civil Disobedience · Thoreau

A complete, usable local reader for **Walden** and **On The Duty Of Civil Disobedience**, with distinct reading places, source illustrations, verse, fixed accounts, exact passage notes, portable backups and offline reading. A spare field-notebook layout puts Walden beside its original pond survey and gives Civil Disobedience a separate entry. The optional **Keeping account** companion connects the house ledger, pond survey and tax essay through sourced editorial readings.

Built from personal-reader-kit v0.4.0, commit `4c386ed521dc16f1bd08c96c3eafbdf765b4f4e7`. This is a project-local real-book trial, not an upstream kit change or a completed human newcomer pilot.

## Try it

```sh
PORT=4293 npm run dev
```

Open the printed local URL. During this trial, port 4193 was occupied by an unrelated Python process; it was left untouched. The verified alternate port is 4293 (`PORT=4293 npm run dev`). Avoid starting a second process on a busy port. The preview uses 4293; isolated browser tests use 4393 and separate browser profiles.

1. Open Walden, then use Contents to choose Economy. Scroll to a source account and move sideways to see its original columns.
2. Select words and choose **Keep or share passage**. **Share passage** opens a supported device share sheet; **Copy passage** copies the quotation and attribution. Add a private note and save it on this device if you want to keep the passage. Saved passages offer the same share/copy controls through **Edit note**.
3. Visit Companion. Its later readings stay hidden until you explicitly choose what you have read. Open source context and return to the unchanged main reading place.
4. Settings offers Paper, Dusk, Large print, local record backups and a private reading bundle. Restore the bundle in a fresh browser before retiring an old origin. It contains complete books and notes without encryption.
5. Wait for **Available offline** before disconnecting. In the same browser profile, both works, source images and the companion remain readable, and you can create or edit saved annotations and reload them offline. External bibliography pages, EPUB downloads and delivery by a chosen sharing app may need a connection. Browser storage can still be cleared or evicted; keep private backups.

Sharing preserves the selected words, blank lines and indentation, followed by author, work, section and edition. Your personal note, library metadata and current/device URL are excluded. A dismissed share sheet does not copy anything automatically; unavailable sharing or denied clipboard access leaves the full attributed text selectable. Sharing keeps the unsaved note draft and reading place. A completed share-sheet handoff does not establish delivery.

[Source-edition EPUB for an e-reader](https://www.gutenberg.org/ebooks/205.epub3.images) — supplied by Project Gutenberg and contains both works. This reader does not generate EPUB or synchronize web notes with an e-reader. The same clearly labelled link is available under **About this work**.

## Verification and recovery

Node 22+ and Python 3.10+; no application package install is required. Browser tests use an installed Playwright runtime and Chromium/WebKit executables, supplied with `PLAYWRIGHT_MODULE`, `CHROME_PATH` and `WEBKIT_PATH` if not on the normal paths.

```sh
npm test
npm run build
TEST_PORT=4393 npm run test:walden-browser
npm run audit:public
```

The browser suite owns and stops its test server, including a deliberate stopped-origin cold-offline test. It includes design/ergonomic checks, original-fixture share/clipboard stubs, and real-edition offline annotation creation/editing followed by reload. Current evidence goes to `.reader/reports/sharing/`; original trial and design-refinement evidence are retained separately. The share tests send nothing and do not establish physical iOS share-sheet delivery or native touch selection. It expects the inspected raw HTML in `.reader/private/source/pg205-images.html` and writes private screenshots, test bundles and receipts under `.reader/reports/`. The inherited `npm run test:browser` is the original kit-fixture journey and expects its fictional sample shelf; use the real-edition suite for this project.

`npm run audit:kit` runs the unmodified conservative kit scanner. It rejects the two JPEGs. The project audit retains that result and adds an exact source-image review across working files, index and all locally reachable history; it does not exempt arbitrary binary files. Stage the exact reviewed file inventory before auditing. [Source and rights](docs/SOURCE-RIGHTS.md), [fidelity](docs/FIDELITY.md), and [kit feedback](docs/KIT-FEEDBACK.md) describe what the checks do and do not establish.

The prepared edition is self-contained, including image bytes, so private bundles can carry it. Its image/style/contents extensions require this local reader; unmodified kit v0.4.0 correctly rejects those fields. Keep the exact prepared edition rather than reconverting and expecting unchanged annotation anchors.

## Scope and publication

Project: `projects/walden`; branch: `codex/walden`. Independent local Git history, no remote, no push, no deployment. Publication audience is intended public **only after destination and file review**. The catalogue declares public domain in the USA, not worldwide. Raw downloads, private intake, screenshots, generated diagnostics and test notes remain ignored under `.reader/`.

The only source-content assets reviewed for this project are `edition/library.json`, `edition/cover.jpg` and `edition/walden-pond-map.jpg`, pinned in `publication.json`. The build serves a flat explicit set; the images travel inside the prepared library. No personal-reader files or research-site images were copied. The reusable kit remains original-samples-only.
