# Real-book builder trial: Pride and Prejudice

This trial used a fresh project from kit v0.4.0 (`4c386ed521dc16f1bd08c96c3eafbdf765b4f4e7`) and built a usable complete illustrated reader from Gutenberg 1342. It is an agent builder trial, **not a completed human newcomer pilot**. No other reader’s text, assets, private notes or code customization was copied. This project did not write to the reusable upstream kit.

## What worked unchanged

The small dependency-free browser application, Node build/server, IndexedDB records, source-hash/block/offset anchors, selection-to-note flow, note reload, draft recovery, theme/type settings, section routing, focus recall/exit, SVG UI icons, exact context scroll, spoiler state, service-worker cache check and transactional bundle restore were useful without replacing the architecture. Natural chapter segmentation keeps a long novel manageable. The built-in original-writing fixtures remain valuable regression coverage alongside the real book.

The baseline publication guard correctly refused arbitrary book content; it was not treated as a bug or disabled. Private input and raw reports were already ignored. The project starter gave a clean independent local history on a codex branch, with no remote.

## Concrete friction and local changes

| Observation | Classification | Local response / suggested kit improvement |
| --- | --- | --- |
| The EPUB command exits 2 at the `cover-image` manifest property, reporting `manifest-feature` and empty resource/spine arrays. The input is a legitimate illustrated EPUB3. | Expected unsupported-input boundary; diagnostic friction. | Preserve the rejection. Inventory the rest of the safe package before reporting unsupported features, and identify `cover-image` specifically. Do not delete images or CSS to obtain a green import. |
| A popular Austen edition includes 164 images, a critical preface, dedication, source index and letters. Plain text extraction would lose 60 initial letters if it used only DOM textContent. | Real-source compatibility gap. | A source-specific HTML adapter and validated renderer extensions preserve illustrations, initials, small capitals, source pages, tables and reference links. An eventual reusable illustrated-book schema needs asset portability and accessible alternatives, not arbitrary HTML. |
| The source preface and illustration captions/index discuss later events even though they precede Chapter 1. A single through-section boundary would permit the preface once Chapter 1 is allowed. | Product/model limitation observed in this source. | Keep source gates separate. This companion searches only permitted novel paragraphs, excluding front matter and captions. A reusable companion API should distinguish section role from order. |
| A single default “Open” at section zero is not the most useful novel start when source notice and a spoiler-heavy preface come first. | Editorial choice. | Home offers an explicit Begin Chapter 1; all original source sections and their order remain available. The contents dialog adds a 61-chapter selector. |
| The kit’s original-only build and binary audit cannot approve this illustrated example. | Correct upstream boundary. | A project-local pinned inventory and separate `audit:example` inspect every current/staged/historical asset version. `audit:public` remains unchanged and still reports the unsupported binaries. A future public-example build should have an explicit reviewed-asset profile. |
| Current bundles serialize text/metadata but have no media payload. | Remaining portability limitation. | This adaptation’s private bundles retain exact metadata and notes; site images are not embedded. UI and handoff explain that moving to a new origin also needs the reviewed application/assets. Do not call these bundles self-contained illustrated editions. |
| The browser-test runtime package expected a different installed browser revision. | Environment friction. | Reused installed Chromium/WebKit through explicit executable paths; no application dependencies were installed. Tests accept environment paths and default to installed Playwright when available. |
| Code review found that a highlight boundary inside a two-character initial could separate its visible glyph from its quotation mark. | Resolved local adapter defect. | Keep the complete initial range in one image/text wrapper even when marks split its runs; the real-book suite checks this case. |
| Existing fixture assertions contained product copy and navigation labels. | Test maintenance friction. | Adapted fixture labels to this reader and kept the actual assertions. Tests synchronize async focus save/restore and bundle auto-close instead of reading transient state. No product regression was inferred from those harness timeouts. |

## The companion and design decision

A modest literal concordance earns its place here: “pride,” “vanity,” “judgment,” and “opinion” can be examined by speaker and context without a plot dashboard or claims about Austen’s intention. The optional starting words are editorial choices, not claims about the novel. A click opens the exact occurrence in its chapter with the main reading place unchanged. Nothing unlocks automatically. It works offline with the supplied text. No historical money/inheritance explainer was added: that would require a separate sourced editorial treatment and would not improve the baseline conversion test.

The first trial used a green accent and a cover-led entrance. The director’s refinement replaces that shared reader pattern with a centered illustrated title page, upright roman display, small-cap running title and plum/near-white palette. See [art direction](ART-DIRECTION.md). No generated art or remote fonts were added. Screen typography reflows; the reader does not pretend to reproduce the printed page exactly.

## Evidence and outstanding work

See [fidelity](FIDELITY.md), [source rights](SOURCE-RIGHTS.md), [local adapter](LOCAL-ADAPTER.md), and [verification](VERIFICATION.md). The actual-book suite tests all 66 sections and 164 images, four phone/tablet orientations in each browser, large-text exact passage context, notes/reload, chapter jump, source reference return, spoiler boundaries, focus recall/selection, fresh-context bundle restore and repeat restore. A stopped server and failing direct request are the offline negative control; every one of the 165 edition assets is fetched and hash-verified from the offline copy.

Remaining blockers for publication: no selected host/repository/domain or jurisdiction decision; no physical iPhone/iPad/e-ink selection/installation/eviction tests; no screen-reader review or full descriptive-alt-text pass; no full human proofreading, newcomer pilot, or evidence that the companion improves a human reader’s experience. The complete source edition EPUB remains a separate Gutenberg download. Web note synchronization and kit EPUB export are not implemented.

Useful upstream proposals are therefore bounded: richer fail-closed EPUB inspection receipts, role-aware spoiler filtering, an illustrated contract with media-bearing portable bundles, exact public-domain asset inventories, and a real-source acceptance suite. Keep the upstream repository original-samples-only until those policies and schemas have been reviewed separately.

## Director refinement: additional evidence

- Original artwork must survive the smallest entrance, not disappear at a mobile breakpoint. The first layout hid its cover below 540px. The revised title page keeps Thomson’s source ornament and Begin/Continue visible, including 320×568 and short landscape.
- A distinct reader needs hierarchy, composition and running navigation as well as a palette. A grayscale-comprehensible title page and a chapter-labelled index replace the first trial’s large italic hero and generic companion introduction. No schema change was needed.
- A later identity rule can override focus chrome through CSS specificity. Fresh visual inspection and a real click on recalled controls caught this in the refinement; the Austen masthead now explicitly hides in focus.
- The coordinator supplied minimal fixes for saving the current place before Import and for ignoring stationary queued document-scroll notifications during focus recall. These were carried over without copying the complete application or changing the edition contract; the actual-book checks exercise both.
- Fixed-width index windows cut ordinary words (the reviewed first result began “ut”). The coordinator’s bounded whitespace expansion and explicit omission metadata now improve excerpts without changing source bytes, search offsets or quotations. This local renderer also resets its source float-clearing pseudo-element to inline for the trailing editorial ellipsis.

## Sharing and offline write follow-up

The reusable module fits the existing passage editor without changing the book contract or introducing a sharing service. Attribution must be visible before the action, including edition; outgoing text uses the exact anchored quotation, while the private note remains separate. Native dismissal is distinct from failure and must not become a clipboard write. The denied-copy path retains selectable attributed text and the unsaved note. Original fixtures and API stubs test these boundaries without sending any book text.

A stopped-origin reading check alone does not prove offline annotation persistence. The expanded Austen journey creates and edits a note during the outage, visits a chapter and word context, reloads offline, then checks the exact quotation, note and saved block offset. The new application module also has to be present in the explicit build, precache, upload and publication inventories; a successful warm editor alone would not prove a cold offline import of that module.

The coordinator’s follow-up also addressed two continuity failures: capture the pending main place synchronously before first opening any dialog, and refuse position writes while a dialog is open; refresh the saved-passages view when its delayed built edition arrives. The local regression uses only original source fixtures and deliberately queues scrolling, resize, visibility/pagehide and delayed-library events. The Austen-specific spoiler gate remains part of the save guard.
