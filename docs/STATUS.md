# Kit status · 0.2.0

The kit builder’s adversarial pass and the existing Canetti builder’s independent review have both been incorporated. The external review inspected `4eaeec6`; its findings were reconciled against the self-review release `aa60a42` before this update. [Finding-by-finding response →](REVIEW.md)

The public destination remains [lamentierschweinchen/personal-reader-kit](https://github.com/lamentierschweinchen/personal-reader-kit), published on `main` as a GitHub template. No kit Vercel site has been deployed. Neither personal reference reader was changed, redeployed or copied into this repository.

## Current verification · 15 October 2026

All 18 Node tests pass. They cover exact Unicode/whitespace, source anchors, conflict-preserving and repeatable backup merges, edition-aware connections, literal occurrences, build exclusions, shallow-history rejection, reviewed retired-file hashes, historical credentials, and incomplete Git inspection and non-commit tree snapshots. A failed inspection also replaces any stale successful audit receipt with a failure.

The browser suite passes through Playwright’s Chromium API using installed Chrome and through WebKit on the desktop test host:

- Five baseline viewports per engine: 402×874, 874×402, 820×1180, 1180×820 and 320×740, including Large print. Comparison layouts also pass at phone, tablet and narrow-phone sizes. Representative phone/tablet captures were visually inspected; comparison selectors have measured touch-sized bounds and fixed verse remains locally scrollable and keyboard-focusable.
- Exact characters, measured differences between source blank runs, emphasis and fixed-line behavior in main text and companion excerpts. An index returns both occurrences in one block. Chosen comparisons preserve both passage references.
- Annotation persistence, note/dialog/navigation draft guards, quota-failure retention, tab conflicts, repeated restore, local Unicode import, malformed backups and independent reading/spoiler state. A locked sample pair is not disclosed by exporting an unbound connection draft.
- A healthy local book opens with only `library.json` blocked and workers disabled. Damaged local books are isolated and retained.
- Damaged-state repair previews a validated backup, rolls back both writes on failure, preserves the original in quarantine and keeps books. Successful recovery then saves a note through the normal UI. Stale repair cannot replace healthy state.
- Exact prepared-edition download and record export restore in a fresh browser context at a different loopback hostname. Books, annotations, connection references and missing reading places match; normal restore does not widen spoiler permissions. A separate hostname in the same browser context also starts with independent storage.
- A synthetic work of **6,483,888 characters and 15,000 blocks** saves and renders, survives a cache upgrade and reload, and retains its note. A failed precache leaves the last complete active version usable; the missing asset returns 404 as a negative control. The long-fixture checks use a bounded 90-second functional wait per load/render stage and log observed timings for slower CI hosts. This is not an acceptable-latency target or a benchmark. The check tests cache lifecycle with compatible code, not arbitrary future data-schema migrations or physical-phone performance.
- Offline reload includes a local import in both engines. WebKit uses a stopped origin and a failing direct network request as its negative control. The baseline request/error monitors report no external requests or script errors.

The public build contains exactly **11 app/original-sample outputs** with build fingerprint `12dc79aed82a5e84`. Personal files are outside both the build and Vercel input allowlists. Browser receipts and original-fixture captures stay in ignored `test-results/`. The exact staged-file/history publication receipt stays in ignored `.reader/publication-review.json`; it identifies its HEAD and local refs. The reviewed release inventory contains 39 files, including only original sample writing. Human inspection accompanies the heuristic scan.

CI now runs Node/build/publication checks and a separate Chromium/WebKit browser job. Consult [GitHub Actions](https://github.com/lamentierschweinchen/personal-reader-kit/actions) for the exact published revision’s result; a local pass is not a claim that a later remote run has finished.

## Product and editorial changes

Local reading is independent of optional demonstration content. Recovery is an intentional transaction rather than a raw export dead end. Settings exports exact editions and explains device/domain migration and the trust placed in future same-origin code. The file-handoff guide explains the agent/model processing boundary separately from the finished app’s local storage.

Echo index accepts chosen literal text across permitted books. Facing pages accepts kept passages and stores two edition-aware anchors with each connection; legacy unbound reflections remain readable. Focus hides companion administration while retaining title and continuation. Phone comparison chrome is compact; short landscape views keep one reading toolbar sticky.

The workflow delivers ordinary reading first, keeps appearance independent of exploration, and uses three material-led prototypes for an undecided exploratory choice. An already chosen direction is refined without restarting that ceremony. The [Westminster Bridge case](COMPANION-CASE-STUDY.md) records edition disagreement, historical evidence, uncertainty and reasons to decline a mechanism. Its original editorial prose does not distribute the poem, maps or private reader content.

## Remaining limits

Physical iPhone/iPad selection handles, menus, safe areas, orientation, text zoom and storage retention still require actual devices. Browser emulation and DOM Range selection do not establish those behaviors. No live Vercel deployment, cross-device transfer or authenticated hosted-book model has been verified for this kit.

The research case is a sourced editorial brief, not an on-site survey, a verified current itinerary, expert-reviewed scholarship or a demonstrated learning outcome. Those checks are explicit next work. The fictional listening walk remains labeled fiction. No automatic research or companion generation is implemented.

EPUB/PDF conversion remains assisted. There is no DRM bypass, image/table renderer, interactive source-footnote engine, linguistic/semantic search, live routing, automatic sync or authenticated hosted-book backend. Preserve exact prepared editions, raw sources and private backups. Existing historical notes recover as quotations when their source is absent or changed; the app does not guess new anchors.

## Earlier releases

The first public release used commit `eb363c2` and passed 12 Node tests plus the initial browser suite. Version 0.1.1 (`aa60a42`) passed 16 Node tests and added draft guards, source-gap fidelity, repeatable conflict restore, isolated damaged books and tighter upload/history checks. These are historical receipts; the current evidence is above.
