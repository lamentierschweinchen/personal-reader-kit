# Verification — 16 October 2026

Initial builder checkpoint build: `ba9258bd512163ad`, 176 explicit output files, 26,394,691 bytes of prepared edition text/metadata and original images. This is local verification; no remote or deployment was tested.

| Check | Result |
| --- | --- |
| `npm test` | 29/29 passed: contracts, exact source assets, notes, bundle integrity, EPUB boundary, history audit, publication boundary, upgrade and UI glyph regression. |
| `npm run build` | Passed; reviewed Austen edition, all images and shell included; no personal books, raw sources or private reports. |
| `TEST_PORT=4291 npm run test:book` | Passed in installed Chromium and WebKit. All 66 sections’ DOM text matched; all 164 images loaded at their recorded original dimensions. |
| Real-book layouts | 390×844 and 844×390 phone, 820×1180 and 1180×820 tablet, plus final 375px source-table review. No horizontal document overflow in any source section at the phone test size. |
| Exact passage and notes | Real Chapter 13 letter selection, save/reload, 36px context return. In both engines the highlighted range begins below the sticky dialog header and fits its viewport. |
| Navigation and source formatting | All sequential previous links checked; chapter selector jumps to 61; source TOC opens reference context; all source emphasis and images remain. Front matter has explicit spoiler gates. Source tables were visually inspected. |
| Focus | Actual book selection remains available; C reveals controls, Hide returns to reading, Escape exits; tested in all four orientations. |
| Word companion | Locked at first; explicit Chapter 5 permission reveals exact matches; preface/captions excluded; main saved position unchanged after context and return. |
| Book backup/restore | Exact book/notes bundle exported, restored into a fresh browser context, restored again without duplicating notes, then reloaded with working illustrations. Images are site assets, not embedded bundle bytes. |
| Cold offline | For each engine, stopped the test server, confirmed a raw request failed, closed the original page, then opened Chapter 61 in a new page. All 165 edition assets fetched offline with matching SHA-256; uncached fetch failed. Notes survived. |
| `TEST_PORT=4291 npm run test:browser` | Both engines passed the kit’s original-writing journeys, including draft guards, multi-block overlap/extension, multi-tab conflicts, corrupt-record quarantine/repair, synthetic write-failure rollback, optional-library failure, fresh-origin restoration and service-worker upgrade/failure cases. |
| Network and runtime | No unexpected external requests or page errors in either real-book run. Source links require an explicit reader action. |
| History and public assets | Passed for the exact 226-file review set with `npm run audit:example`. The private receipt records the checked revision and covers HEAD/all local refs, working tree and index. The original auditor’s binary refusals remain recorded separately and are resolved only for exact pinned source images. |

Machine receipts and screenshots are ignored, not public build artifacts: `.reader/reports/austen-browser-receipt.json`, `.reader/reports/austen-conversion.json`, `.reader/reports/node-tests.log`, `.reader/reports/kit-browser.log`, `test-results/browser-receipt.json`, and `.reader/example-publication-review.json`.

## Initial visual review

Settled Chromium/WebKit captures were inspected for the peacock-cover home page, phone Chapter 13 opening, portrait/landscape tablet type, 36px selected letter context, exact word context, the title-page table and source illustration list, short-landscape reading and dusk mode. At 844×390 the persistent toolbar is 69px; the masthead scrolls away. Images retain their source pixels; no contrast filter or generated replacement was applied.

The palette uses warm paper/dark ink and a dark-green accent. UI targets remain ordinary keyboard-operable buttons/links with visible focus; source icons use SVG paths. Enlarged context retains a visible sticky Close control. Source-only print page markers are not represented as modern reading-progress percentages.

## Honest limits

These are installed desktop Chromium/WebKit engines with emulated viewports, not physical iOS, tablet, e-ink, screen-reader or native touch-selection certification. Browser storage may be evicted; backups are still needed. No host headers or access controls were tested at a real deployed URL. The catalogue’s USA rights statement does not establish worldwide clearance.

There is no complete human proofreading or human newcomer/learning pilot. Character and structural coverage, representative visual inspection and functional checks are separate receipts. Existing sparse image alternatives need a dedicated accessibility editorial review. Moving to an unrelated site requires this adapter and its image assets; the standard kit cannot yet restore a self-contained illustrated bundle. EPUB export and e-reader note synchronization remain unimplemented.

## Director refinement — final Austen candidate

Build `ddcb722cd988ca66` retains 176 output files and the exact 165-asset edition inventory. No file under `edition/` changed. The title page, running navigation, chapter framing and index follow [ART-DIRECTION.md](ART-DIRECTION.md). The operational EPUB/bundle paragraph was removed from the entrance; the existing edition details and export help retain those limitations, and the complete required source notice remains.

`npm test` passes 30/30, including the original-fixture excerpt-boundary and exact-anchor regression. The expanded actual-book suite passes in Chromium and WebKit: all 66 source sections match textContent, all 164 source images retain recorded dimensions, source/spoiler gates remain, and the final index uses bounded whole-word context plus visible editorial omission markers. A result still opens only the exact occurrence in context; whole passages and source-book text acquire no omission characters. The staged `audit:example` passes the exact 227-file inventory, complete local reachable history, working tree and index; the final post-commit receipt identifies the reviewed HEAD.

| Final entrance viewport | Source ornament height | Begin button bottom | Result in both browsers |
| --- | ---: | ---: | --- |
| Phone portrait, 390×844 | 144px | 528px | Artwork and action visible |
| Phone landscape, 844×390 | 150px | 278px | Artwork and action visible |
| Tablet portrait, 820×1180 | 176px | 601px | Artwork and action visible |
| Tablet landscape, 1180×820 | 176px | 633px | Artwork and action visible |
| Small phone, 320×568 | 100px | 437px | Artwork and action visible |

Continue also remains visible after fresh-context bundle restore. The reading toolbar is 53px; after scrolling, the landscape phone has 337px of usable height. Portrait phone retains 727px, portrait tablet 1063px and landscape tablet 703px. Measured navigation, reader tools, source-gate actions, index actions, chapter continuation and recalled focus controls meet 44×44 CSS pixels (DOMRect assertions allow 0.01px floating-point rounding). Paper text/muted/accent contrast against paper is 14.17/5.84/8.04:1; Dusk is 12.24/7.67/8.46:1. This is not a full accessibility certification.

The real-book run also verifies 36px Dusk text; exact large passage context below the sticky dialog header; C recall and deliberate Hide; no masthead in focus; selection and Escape; a stationary queued scroll notification preserving recalled controls; Import saving the current place before its scroll debounce; an unfinished note surviving a cancelled Escape; note save/reload; unchanged main position after index and source excursions; fresh-context bundle restore and repeat restore; and cold offline access with stopped server, failed network control and all 165 edition asset hashes checked. Both engines report no page errors or unexpected external requests.

The final inherited original-writing browser suite also passes in Chromium and WebKit after the excerpt patch, including exact multi-block annotations, failed-write draft retention, conflicting tabs, damaged-record quarantine/repair, optional-library failure, service-worker upgrade/failure, fresh-origin restoration and stopped-origin offline controls. Its receipt remains `test-results/browser-receipt.json`; the run log is `.reader/reports/direction-fixtures-final.log`.

### Final private visual evidence

Fresh captures wait for images/fonts, finite animations, position restoration and completed theme changes; index captures also wait for the transient status notice to clear. Personally inspected Chromium and WebKit phone/tablet home, chapter opening and actual reading, index, focus, 36px night text and unsaved-note dialog captures. The final index begins with a complete boundary word and puts ellipses outside the source text. The source artwork remains visible on the entrance, including phone landscape.

All following paths are ignored local evidence under `.reader/reports/`; none is part of the commit or public build. Each `webkit-` capture has a matching `chromium-` capture.

- Home phone/tablet: `webkit-direction-home-phone-portrait.png`, `webkit-direction-home-tablet-portrait.png`; additional `home-phone-landscape`, `home-tablet-landscape`, `home-small-phone` and `home-resume` captures.
- Chapter framing and actual reading: `webkit-austen-phone-portrait.png`, `webkit-direction-reading-phone-portrait.png`, `webkit-direction-reading-phone-landscape.png`, `webkit-direction-reading-tablet-portrait.png`, `webkit-direction-reading-tablet-landscape.png`.
- Companion: `webkit-direction-word-index-phone.png`, `webkit-direction-word-index-tablet.png`, `webkit-austen-word-context.png`.
- Awkward/quiet states: `webkit-direction-unsaved-note.png`, `webkit-direction-source-gate.png`, `webkit-direction-night-large.png`, `webkit-direction-focus-phone-portrait.png`, `webkit-austen-large-context.png`.
- Machine evidence: `austen-browser-receipt.json`, `direction-book-final.log`, `direction-node-tests.log`, `direction-audit-staged.log`; the post-commit exact-history receipt is `../example-publication-review.json`.

These checks remain emulated desktop browser evidence. Physical touch/iOS/e-ink behavior, complete proofreading, screen-reader review, human learning value and worldwide rights clearance are not claimed. No remote, publication destination or deployment was added.

## Passage sharing and offline writes — 16 October 2026

Candidate build `64ba7631ffafdc7d` adds `share.mjs` to all explicit application, cache and upload inputs: 177 output files, with the exact same 165 edition assets. No prepared book, image, source ID or anchor format changed. The sharing actions sit in the existing note editor with visible author, title, section and edition; no sharing server, quote-card renderer or automatic external URL was added.

The 33 Node tests pass. The sharing browser tests use original verse/prose fixtures and replace native sharing/clipboard APIs before application code runs. They verify exact Unicode, indentation and blank lines; exact author/title/section/edition payload; no private note, preparation record or device URL; no copy after native cancellation; unsupported/failed sharing and denied copy leaving fully selected readonly text; successful copy; unsaved draft and main-place retention; sharing a saved passage after reload; and refusal to borrow attribution from a changed edition. Resolved sharing is labelled as a handoff whose delivery depends on the chosen app. No native recipient, clipboard or real delivery is exercised by these tests.

Two continuity regressions are included using original fixtures: a reading scroll queued immediately before opening the editor is captured before the dialog, then stays unchanged through resizing, visibility/pagehide notifications and the 250ms debounce; a saved passage whose built edition arrives late regains its valid context/share actions without losing the page’s scroll. The corresponding kit fixes were carried over narrowly, preserving this reader’s source-gate save guard.

Sharing layout coverage is 390×844 and 844×390 phone, 820×1180 and 1180×820 tablet, each at 21px Paper and 36px Dusk. The two sharing actions measure approximately 107×45 and 103×45 CSS pixels, remain reachable below the sticky header, and introduce no document or dialog horizontal overflow. Fresh settled captures include the actual Austen note editor as well as the original-fixture success/manual-copy states.

The actual-edition outage journey first waits for Available offline, stops the test origin, verifies a direct-network failure, opens Chapter 61 in a new page, and checks all 165 edition asset hashes from cache. While the origin remains stopped it navigates to Chapter 60, creates an exact-source annotation, visits a permitted word’s context and returns, edits the new note, then reloads offline. Both the original note and the new edited note persist; the selected quotation is unchanged, and a nonzero saved block/ratio is restored to the reading edge. A second direct-network request still fails after those writes. This strengthens the earlier read-only outage evidence; it does not depend on a successful online write before the outage.

The final actual-edition and inherited original-writing suites both pass in Chromium and WebKit, with no page errors or unexpected external requests. The inherited suite also checks damaged-record recovery, failed writes, conflicting tabs, portable backups, service-worker upgrades, quiet controls and stopped-origin navigation. The normal Austen build was restored after that fixture run. Personally inspected settled phone/tablet, large-type landscape, manual-copy and actual-edition note/offline captures from both engines.

The staged `audit:example` passes for the exact 230-file publication inventory, including complete reachable local history, index and working files, and all 164 pinned image versions. The upstream binary refusal remains intact; only the existing exact source-image review applies. The staging log is `.reader/reports/share-audit-staged.log`; the final history receipt is `.reader/example-publication-review.json`. `edition/` has no changes, and private captures, test receipts and build output remain ignored.

Private evidence stays ignored under `.reader/reports/`: `share-node-tests.log`, `share-book-final.log`, `share-fixtures-final.log`, and the sharing/continuity/offlineWrites entries in `austen-browser-receipt.json`; the inherited receipt is `test-results/browser-receipt.json`. Capture examples (each with Chromium and WebKit variants):

- `webkit-share-phone.png`, `webkit-share-tablet.png` and `webkit-share-phone-landscape.png`.
- `webkit-share-phone-large.png`, `webkit-share-phone-landscape-large.png`, `webkit-share-tablet-large.png`, `webkit-share-tablet-landscape-large.png`.
- `webkit-share-manual-copy-phone.png`, `webkit-share-edition-mismatch.png`, and the actual-edition `webkit-direction-unsaved-note.png`.
- `webkit-austen-offline-note-reloaded.png` and `webkit-austen-offline-saved-notes.png`.

Airplane-mode use requires the initial complete offline cache in the same browser/origin. Browser storage can still be cleared or evicted; keep backups. A recipient app may need connectivity to deliver a shared passage. Physical iOS/native share sheets, delivery to friends/notes apps, and physical airplane-mode operation are not certified here. Local-only repository; no remote, push or deployment.
