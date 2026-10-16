# Archived trial handoff

This is the original handoff at source commit `335de093f27837a3b06219407d5fb9b8792c8274`. Statements about a local-only repository, publication permission and audit commands describe that trial. See [the current example README](../README.md) and [the shared example policy](../../README.md) for the packaged copy.

# Pride and Prejudice — illustrated reader

A complete local reader of Jane Austen’s novel, from Gutenberg’s 1894 illustrated edition: all 61 chapters, illustrations by Hugh Thomson (164 image resources), George Saintsbury’s preface, the original front matter and source license. Built from personal-reader-kit v0.4.0 on 16 October 2026. Nothing has been pushed or deployed.

```sh
PORT=4191 npm run dev
```

Open http://127.0.0.1:4191. Choose **Begin Chapter 1**. **Contents** jumps to any chapter; original front matter stays in source order and warns about spoilers. Select words, then choose **Keep or share passage**. **Aa** changes type, spacing and theme and provides private backup/restore. Focus mode supports C to recall controls and Escape to exit.

**Words** is a small, optional concordance. Explicitly choose the chapters you have read, then follow a word into its exact source context. The main reading position stays put. The preface, illustration index and captions are excluded from its results. Search uses exact spelling and capitalization; matches may occur within longer words.

## Sharing and offline reading

In the passage editor, **Share passage** opens the device’s share sheet when available; **Copy passage** copies the text for pasting into a message or notes app. The same actions are available through **Edit note** on a saved passage. Both carry the exact quotation, including indentation and blank lines, plus author, title, section and edition. Your personal note, private preparation metadata and device URL are excluded. Cancelling sharing leaves the draft intact and never triggers copying. If sharing or copying is unavailable, the full attributed text remains selectable. A resolved share action does not confirm delivery by another app.

Before going offline, open this reader in the browser you will use and wait for **Available offline**. In that browser and at that same address, the cached book, illustrations and word index can be read without the origin; notes can be created or edited, saved locally and recovered after an offline reload. This was tested with the local server stopped and a failing direct-network control, not on a physical device in airplane mode. Browser storage can be evicted or cleared, so retain private backups. A destination app may require a connection to deliver a shared quotation.

## Source and e-reader

The actual source is [Gutenberg 1342](https://www.gutenberg.org/ebooks/1342), updated 29 September 2026. Its catalogue and downloaded files state public domain in the USA. This is not worldwide clearance. The full Gutenberg source notice/license and production credits are retained; this independent free example is not endorsed by Gutenberg.

For an e-reader, use [the source-edition EPUB options](https://www.gutenberg.org/ebooks/1342) and choose EPUB3 with images. This reader does **not** export EPUB or synchronize web notes with an e-reader.

## Verification and handoff

```sh
npm test
npm run build
TEST_PORT=4291 npm run test:browser
TEST_PORT=4291 npm run test:book
npm run audit:example
```

The application needs Node 22+ and no application dependency installation. Browser checks need Playwright/Chromium/WebKit. To reuse a local runtime, set `PLAYWRIGHT_MODULE`, `CHROME_PATH` and `WEBKIT_PATH` to the installed package/executables. Browser test servers stop automatically. Run browser suites sequentially: both use port 4291 and rebuild the same `dist` directory. The original-fixture suite builds the kit samples; finish with `npm run build` or start the preview to restore the Austen build.

- [Art direction](docs/ART-DIRECTION.md)
- [Verification evidence and limits](docs/VERIFICATION.md)
- [Source/rights receipt and exact proposed file set](docs/SOURCE-RIGHTS.md)
- [Fidelity receipt and transformation decisions](docs/FIDELITY.md)
- [Builder feedback and suggested kit improvements](docs/KIT-FEEDBACK.md)
- [Project-local adapter contract](docs/LOCAL-ADAPTER.md)
- [Original kit agent workflow](docs/AGENT-GUIDE.md)

The real-book checks cover all 66 source sections, 164 images, portrait/landscape phone and tablet layouts, large-text passage return, notes/reload, focus, spoiler permissions, source reference excursions, fresh-context backup/restore and cold offline reload with the server stopped and a failing network control, including creating/editing an annotation and restoring its exact quotation and reading place. Sharing checks use original fixtures and stubbed native/clipboard APIs; nothing is actually sent. They do not establish physical iOS/e-ink behavior, complete proofreading, screen-reader accessibility, or a successful human newcomer pilot.

## Recovery and publication boundary

The complete site is cached only after **Available offline** appears. Notes and places belong to this browser and origin. Export a private reading bundle before clearing browser storage or moving origins. Restore it into a fresh browser and check your notes and reading place before retiring the old one. Bundles contain exact text/metadata and notes; **image binaries are not embedded**. A move to another site also needs this reviewed application and all edition assets. An unmodified kit cannot yet import this extended illustrated contract.

Raw archives, preparation maps, browser captures and test note exports stay ignored under `.reader/` or `test-results/`. `edition/inventory.json` pins every proposed public-domain text/image asset; the build refuses changed bytes. `audit:example` inspects all complete local reachable history, index and working files, with exact source-image provenance. The unchanged upstream `audit:public` deliberately still refuses binaries and is not the acceptance command for this adapted project.

Repository: this project only, branch `codex/pride-and-prejudice`; history is local-only, with no remote. It is independent of the workspace root, kit and sibling readers. Only the coordinator updates the shared registry. Public destination, jurisdiction review and publication approval are still pending. No hosting credentials or deployment configuration have been attached.
