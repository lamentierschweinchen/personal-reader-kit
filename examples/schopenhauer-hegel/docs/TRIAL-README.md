# Archived trial handoff

This is the original handoff at source commit `6b160fad13729f07808248be3071a6e33afb3a80`. Statements about a local-only repository, publication permission and audit commands describe that trial. See [the current example README](../README.md) and [the shared example policy](../../README.md) for the packaged copy.

# Two lecture halls, one hour

**Schopenhauer and Hegel, across the corridor.** A working local reader with both complete supplied English editions, three substantial paired readings, private annotations and independent reading places. Built as an independent fourth trial of the personal-reader kit at `6dc8fb146e7e7ec861f4d5b99d21be6f5b696505`.

## Open it

From this project directory, with Node.js 22 or later:

```sh
PORT=4194 npm run dev
```

Open **http://127.0.0.1:4194** in your browser. Keep that address and port for your ordinary reading: a different browser or origin has separate storage. Stop the server with Ctrl-C. No application dependency installation, account, API key or external runtime service is required.

Choose a question, take a seat with either thinker, and cross the corridor. A tablet can show the passages together; a phone switches between them while preserving each passage’s scroll. Read around a passage without moving either full book’s saved place. Keep one passage, or both with your reflection. The two full-book entrances lead the noticeboard, with the compact question program beneath them; both remain available through **Books**.

Select text in a full book and choose **Keep or share passage**. **Share passage** opens the device’s sharing menu where supported; **Copy passage** copies the exact quotation with its author, title, section and edition. Your personal note and device address are excluded. Saved passages offer the same actions through **Edit note**. Dismissing sharing keeps your draft; if sharing or automatic copying is unavailable, selectable text remains. A passage whose edition no longer matches must be reunited with its exact source before sharing with attribution.

**Aa** offers Paper, Dusk and Large print, with adjustable type, spacing and width. **Focus** keeps the book and section titles, text, selection and next/previous navigation. Tap ordinary text briefly or press **C** to recall controls; scroll or hide them again, and press **Escape** to leave focus.

## The actual books

- **Hegel, Lectures on the History of Philosophy, volume 1.** E. S. Haldane’s 1892 translation, supplied in the digitized 1955 reprint. All 62 prepared sections, 173 source notes, contents tables, Greek, cover, publisher’s device and three Zeno diagrams remain. This is volume 1 of a three-volume work.
- **Schopenhauer, The Art of Controversy and accompanying essays.** T. Bailey Saunders translation, preface February 1896. All 49 prepared sections of the supplied collection remain. Saunders’s own omissions and editorial choices are disclosed; this is not a claim to reproduce the complete German writings.

The three questions concern disagreement, winning and truth, and the authority of opinion. Each side contains a continuous source argument, with edition/section labels, an optional editorial orientation and access to its context. These are later published texts, not an 1820 transcript or invented dialogue. The historically supported scheduling clash inspires the interface; adjacent halls and a one-hour duration are not asserted as facts.

Read the [source and rights review](docs/SOURCE-RIGHTS.md), [fidelity receipt](docs/FIDELITY.md), [exact asset inventory](editions/inventory.json) and [source fingerprints](docs/SOURCE-FILES.json). The catalogues identify the supplied editions as public domain in the USA. That is not worldwide clearance. No publication destination has been chosen.

## Offline and moving your library

Wait for **Available offline** after the first successful visit; Settings can recheck the cached application, both editions, their images and the paired readings. In that same browser and at the same address, you can reopen the reader, navigate the books and companion, and create or edit and save annotations without a connection. Unsaved drafts need to be saved before closing or reloading. Bibliographic websites and the linked source EPUB downloads still need a connection. Browser storage can be cleared, so offline caching is not a backup.

The automated Chromium/WebKit outage check stops the origin, confirms a direct network request fails, opens a fresh page, saves and edits an annotation, and verifies its exact quotation, note and reading place after offline reopening/reload. This is browser evidence, not a physical iOS airplane-mode test. Sharing uses the destination app’s capabilities; opening its menu does not establish delivery.

Use **Aa → Export a private reading bundle**, include both editions, and retain the downloaded file privately. It contains exact prepared books, saved passages/connections, reading places and preferences; it is not encrypted. Unsaved drafts and damaged records have separate export actions. At another address or browser, open Settings, choose that bundle, inspect the preview and restore it. Verify quotations and places before retiring the original browser. Restore does not widen companion permissions. Repeat restore does not multiply unchanged records.

Restore these editions using **this project’s reader**. Its local book contract adds source notes, tables, page markers, small capitals and embedded JPEGs; the unmodified kit rejects those extra fields. The inherited bundle envelope still reports base kit version `0.4.0`, which does not identify this local dialect. Keep the project revision alongside the bundle. See [the format extension](docs/BOOK-FORMAT.md#this-trials-source-aware-extension).

The About this work panels link each original source-edition EPUB for separate e-reader use. This app does not generate EPUB or synchronize e-reader annotations.

## Reproduce and check

```sh
npm test
npm run build
npm run audit:public
```

The audit requires the reviewed final bytes to be staged or committed. It checks the exact file inventory, working tree/index and complete locally reachable Git history. It also verifies the two edition files and their five embedded image identities; it does not grant publication permission.

For actual-book browser checks, provide Playwright and installed Chromium/WebKit executables:

```sh
PLAYWRIGHT_MODULE=/path/to/playwright \
CHROME_PATH=/path/to/chromium-executable \
WEBKIT_PATH=/path/to/pw_run.sh \
TEST_PORT=4294 npm run test:browser
```

`CHROME_PATH` and `WEBKIT_PATH` may be omitted when Playwright’s matching browsers are installed. The runner starts/stops its own loopback server, uses isolated browser contexts, writes private evidence under `.reader/reports/browser/`, and exercises both real editions. The old original-fixture browser drivers remain as upstream reference; `test:browser` deliberately runs `tests/trial-browser.mjs` for this project.

With the same browser environment variables, `npm run test:design` checks the broadside, equal hall geometry, touch targets, night/large type, reading chrome, focus recall, Import continuity and a failed-save state. Its settled captures and receipt stay private in `.reader/reports/art-direction/`. `npm run test:share` uses original writing and stubbed sharing/clipboard APIs to check exact attribution, cancellations, failures, manual copying, saved passages, draft/place continuity and phone/tablet geometry; nothing is actually sent. Its evidence is in `.reader/reports/sharing/`. Run browser commands sequentially because each owns test port 4294 and rebuilds the output.

The source adapter is a one-edition-pair tool, not a general HTML importer. `npm run prepare:sources` needs the exact private HTML/image inputs and Playwright described in [SOURCE-FILES.json](docs/SOURCE-FILES.json) and the private intake. It refuses different raw HTML hashes. Its candidates and coverage maps are private; promotion to the two pinned `editions/*.json` files is a separate reviewed step. The ordinary build uses the already-reviewed editions and needs none of those private inputs.

Both EPUBs were first tried with the kit’s bounded preparer. Both returned `needs-adapter` without an edition. The HTML adapter and renderer extension preserve the features that the narrow preparer cannot accept; the EPUBs were not stripped to make them pass.

## Handoff

The [art direction](docs/ART-DIRECTION.md) records the upright university broadside and its phone/tablet layout.

[KIT-FEEDBACK.md](docs/KIT-FEEDBACK.md) records what worked unchanged, friction, project-specific changes, test evidence and reusable proposals. [VERSION-HISTORY.md](VERSION-HISTORY.md) records the trial checkpoint. Source/render conservation and automated behavior checks passed; whole-work print proofreading, a human learning/onboarding pilot, physical iOS touch and e-ink verification remain unperformed.

This repository is **local only**, on `codex/schopenhauer-hegel`, with no remote or deployment. The root workspace, upstream kit and other readers are independent repositories. Raw downloads, browser captures, notes, recovery bundles and preparation reports remain ignored under `.reader/`. The code retains the kit’s MIT license; third-party literary and image rights are described separately.
