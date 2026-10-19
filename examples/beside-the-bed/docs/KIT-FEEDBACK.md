# Kit observations — Beside the Bed

Only actual observations belong in this log. This project was created from kit 7c9d60c.

| Kind / status | Reproduction and consequence | Local response | Reusable proposal |
| --- | --- | --- | --- |
| Edition adapter / implemented | The bounded text contract cannot infer Nightingale's transposed census tables from HTML. A browser collapses the first table's source newlines, although the transcription describes a table. | A source-aware local adapter retains both table blocks with fixed source lines, without correcting the source's acknowledged arithmetic defect. | Document this as an edition-specific adapter case; do not make the plain importer guess tables. |
| Edition adapter / implemented | Whitman's source is a containing volume, and its first contents list does not delimit the text. | Inspect every heading through the next major work; extract the complete Specimen Days body with all local notes and verse. | Add a containing-volume scope example to intake guidance. |
| Product adaptation / implemented | The starter build intentionally accepts original samples only. A local reader needs a safe private preview without changing that public safeguard. | Explicit local build mode uses exact ignored library and study inputs; shell mode retains original-sample verification. | Consider a documented opt-in local library input. Keep the default public build original-only. |
| Optional workflow / proposed | Three private studies need working source passages without mixing preparation files into public source. | Separate, explicit study JSON is copied only by local build and listed in its receipt. | A small private-study loader may be reusable; three concepts still require editorial work. |

No upstream changes were made. Browser and editorial findings will be appended with observed evidence.

| Kind / status | Reproduction and consequence | Local response | Reusable proposal |
| --- | --- | --- | --- |
| Observed preview defect / resolved | `npm test` calls the inherited public build and overwrites `dist/` while `scripts/serve.mjs` serves it. The coordinating editor actually saw original samples under historical collection labels on first visit. | Public-boundary test now builds into an isolated ignored output directory. Runtime validates the two expected edition IDs. Build and cached-update checks are separate. | Let build accept an explicit output directory and isolate test builds by default. |
| Observed portability guard / resolved | After designating the historical books as built-ins, the starter sample-availability guard also blocked their self-contained bundle restoration when the library endpoint was unavailable. | The special original-sample guard remains limited to the two true kit samples; normal canonical collision checks protect the collection. | Distinguish original fixture IDs from built-in edition IDs in adapters. |
| Harness timing / corrected | A C-key focus check ran before the focus action finished restoring its position; later scroll handling hid recalled controls. | Await the settled focus state before sending the key. | Existing adapter guidance already covers this timing distinction. |
| Edition presentation / implemented | Whitman’s longest preformatted verse lines require sideways scrolling on a phone. | A source-line preference offers wrapping without changing characters, breaks or indentation. Tables retain fixed columns. | Optional common preference, subject to actual edition review. |

| Observed adaptation defect / resolved in visual review | Table B’s HTML formatting contains blank lines around every br. An initial raw-whitespace preservation produced excessive row gaps even while characters agreed. | Preserve explicit br row breaks, remove adjacent formatting-only newlines, and retain column spacing. Source bytes and the arithmetic warning stay unchanged. | Use this as a high-risk example showing why character agreement does not establish faithful layout. |

| Source limitation / preserved | Whitman’s supplied full digital volume contains two {A} markers with no matching definition. | Preserve the markers, leave them unlinked, and disclose the source limit in the edition record and handoff. | Keep orphan-reference inventory in source-aware fidelity receipts; do not fabricate or silently remove them. |

| Source-specific CSS / implemented | Whitman applies italics to pre blocks in its stylesheet, outside explicit i tags. | Promote the 24 full-block italic ranges into the portable text contract; retain all 313 explicit italic ranges too. | Inventory computed source styles when building an HTML adapter; markup counts alone miss emphasis. |

## Coordinator-led narrowing

The coordinator personally read all four Visits readings and their related context, both Room passages with listener marks, and all three Record passages. Visits was retained as the main companion, Room as an optional unmarked close reading, and Record was moved to a Sources essay. This supersedes the initial recommendation to present three equal private proposals; tests did not make that editorial choice. The complete earlier prototype remains ignored.

| Kind / status | Evidence | Response | Reusable proposal |
| --- | --- | --- | --- |
| Observed phone attention cost / resolved | At 477px the coordinator found Room’s first paragraph below 650px after repeated headings, tabs and sidenotes. | Header reduced to 60px; a phone reading selector replaces repeated tabs/headings; source sidenotes keep exact text with compact visual spacing. Both engines place the first paragraph around 397px at 477px. | Measure the actual first source paragraph, not just total overflow or section existence. |
| Observed verse usability / resolved | The coordinator found the hymn horizontal-only inside Room. | Room starts with wrapped hymn lines even if the book’s global preference preserves width; an explicit choice recovers fixed width. Printed breaks, indentation and italics remain unchanged. | Verify source-layout preferences in each excerpt surface, including inherited preferences from a real browser. |
| Editorial choice / implemented | Record’s notebook/publication distinction was valuable but did not earn a third production study. | Move it to an essay beside source information; retain exact returnable source evidence and primary links. | Support retirement and relocation without losing material or forcing a replacement companion. |

## Combined-mount 200% text regression

The parent’s exact computed-font doubling at 320/390px found the settings button outside the viewport and the brand squeezed beside navigation. This was not exposed by root font scaling or the earlier normal-size captures. Local reproduction now uses the parent’s actual per-element computed font sizes, checks all header control/glyph rectangles and the full nav/brand boxes, and inspects settled screenshots in both engines.

The header now wraps naturally instead of shrinking its neighbours. A ResizeObserver updates only the sticky-toolbar offset from the measured header height; it does not feed back into header sizing. Normal type remains 60px; 200% header height is 117px and stable over 12 frames. The reading toolbar clears it during scrolling. Native settings selects also receive a text-relative explicit touch height after the same local fixture exposed undersized native controls. The selected inputs and all source bytes are unchanged. This is a resolved runtime regression, not a concept change.

## Source notices lost during export / resolved locally

A fresh-origin test removed library.json but left notices.json available, so it proved book recovery without proving recovery of the full source terms. Both collection books pointed to the source records while the generic books/state bundle omitted the separate full notice asset. The earlier description of that export as self-contained was too broad.

The local fix is an explicit project-scoped, checksum-covered notice supplement with pins for each whole prepared book, raw source and full notice text. Full reading bundles and exact-edition downloads carry it; restored notices live beside reader state without changing the book contract, anchors or source text. Missing notices block new collection-edition downloads. Legacy restore remains available with a precise missing-notice warning. Generic reader compatibility is not implied.

The replacement test uses actual UI downloads, fresh browser contexts, library.json and notices.json returning 404, exact full text in About, and offline reload. A recomputed bundle checksum cannot authorize changed notice bytes; simulated notice-storage failure rolls back books and state too. The worker can retain the application shell when optional source endpoints are absent, while its full-collection readiness check still reports incomplete. About uses textContent for the notice pre elements because HTML parsing otherwise consumes their first newline. No book metadata or literary text was repaired to hide the omission.

Reusable proposal: a portable edition is its exact text/layout plus every required attribution/license asset. Test recovery with all original source endpoints absent, and specify the compatible application/profile instead of implying that a JSON export includes a reader application.

## Edition-specific typography and no-script fallback

The coordinator selected Bitter under the human’s brief while retaining this collection’s existing empty-chair/green-linen identity. The implementation includes full real upright and italic variable faces with a separate unchanged license and content-pinned binary exceptions; a font extension or directory is not an audit exemption. CSS font URLs stay relative for canonical subpaths. Saved geometry waits for font readiness to avoid restoring against fallback metrics. Browser evidence checks loaded faces and actual glyph-font use, not only a font-family declaration.

The parent’s combined no-JavaScript test found that the inactive loading message and footer controls remained visible. The local fallback now hides loading, navigation/settings and footer actions and shows a truthful script requirement with a visible catalogue return. This view makes no claim that books or offline controls can run without script.

## Four missing host-data endpoints / final worker repair

The canonical fresh-origin check exposed an installation stall when library.json, studies.json, sources.json and notices.json all returned server-level 404 despite all shell/font files succeeding. The coordinator isolated the minimal repair: use `fetch(f, {cache: 'reload'})` for optional install requests and await `r.arrayBuffer()` for non-success responses before accepting only 404/410. Other failures retain the existing rejection behavior. The generator's worker-policy seed advances so the changed worker receives a fresh cache/release identity.

The local recovery test now serves cacheable 404 HTML bodies for all four optional JSON endpoints and requires a second server request for each during worker installation. It then restores actual full and one-edition downloads in fresh contexts and checks exact books, records, notices and font loading after stopping the destination origin. This narrows the HTTP-cache behavior; it does not expand export scope or change UI, source editions or font files. Canonical mounted verification remains with the parent.

Strict canonical WebKit verification then found uncaught worker promise rejections for the four optional URLs after actual shutdown. The bounded follow-up returns HTTP 503 only when an uncached FILES key outside SHELL fails its network fetch. Cache hits and shell failure behavior stay unchanged, and full readiness remains false. Tests collect every page error without filtering and explicitly check the offline 503 responses and cached-shell 200 response.
