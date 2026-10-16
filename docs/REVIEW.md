# Independent review and response

The Canetti builder independently reviewed `main@4eaeec6` on 15 October 2026, including the reader, guides, source contracts, publication tooling and tests. It reproduced failures with original synthetic fixtures and did not modify the kit or either reference reader. The kit builder reconciled that report against the already published self-review release `aa60a42` (0.1.1).

The useful product description is a **reusable reader shell plus a supervised editorial workflow**. This update preserves that boundary. It does not claim automated scholarship, universal ebook conversion, physical mobile dependability or hosted private libraries.

## Findings and disposition

| Finding | Response in 0.2.0 | Evidence / remaining limit |
| --- | --- | --- |
| Shallow history passes; removed public files cannot be maintained safely | Reject shallow/partial clones, grafts, replacement refs and unreviewed standalone objects; Git inspection errors are fatal. Record exact HEAD and local refs, including editor tree snapshots. Retired public bytes use a separate path/SHA-256/reason list. | Synthetic full-history and shallow-clone tests; wrong retired content hash fails. Unfetched remote refs and unreachable objects are outside the stated scope. Human provenance review remains mandatory. |
| Visible stanza gaps collapse | Already corrected in 0.1.1; source separators determine spacing. | Character identity and measured blank-run geometry are distinct browser assertions. |
| Facing/Echo remove emphasis | Both now use the common passage renderer, including clipped marks, indentation and fixed lines. | Browser fixtures include emphasis and fixed verse in main reading, occurrence results and chosen comparisons. |
| Optional samples block healthy local reading | Hydrate local books/state before requesting samples. A failed sample download produces a limited warning. | Block only `library.json` with workers disabled; reopen the retained local book. |
| Damaged state has export but no repair | Explicit validated-backup preview, atomic quarantine/replacement, unchanged book store and rejection of stale repair on healthy state. Recovery archives remain exportable. | Force a failed replacement write to prove rollback; then repair and save through the ordinary note interface. Unknown records cannot be reconstructed automatically. |
| Origin migration is unaddressed | Show the current origin in Settings, export exact prepared editions, and document canonical-domain choice and export/import/verify before retiring an address. | Fresh-context/new-origin restore verifies exact book, note and connection identities, positions and unchanged spoiler permission policy. Physical device transfer still needs testing. |
| Local storage promise hides other trust boundaries | Put agent/model processing beside the initial file handoff. Explain that future same-origin code can access local books. | README, agent guide, privacy guide and deployment procedure. No new upload service. |
| Focus contains companion administration; landscape chrome is large | Hide boundary administration in focus, retain chapter title and continuation; only the reading toolbar stays sticky in short landscape windows. | Focus assertions and phone/tablet layout checks. Comfort still needs reader feedback. |
| Echo is hardcoded and omits occurrences | Reader-chosen literal text across all permitted books; each non-overlapping occurrence gets a source range, location and highlight. | Case-sensitive substring semantics are explicit. Display capped at 200 with total count; no stemming, linguistic segmentation or semantic search claim. |
| Facing is one fixed pair and an unbound global string | Choose from kept passages; persist two full source references/quotations with each connection; preserve emphasis, conflicts and recovery. Shorter phone introduction and neutral prompt. | Old unbound reflections remain readable without assigning invented provenance. Locked default fragments are not included in a text-only draft export. |
| Fictional walk cannot establish researched depth | Retain its honest fiction label; add a sourced Westminster Bridge editorial case with edition disagreement, historical evidence, uncertainty and reasons to reject a mechanism. | The case is an editorial brief. Current access, reader learning and expert review remain explicitly unverified; no live route is claimed. |
| Three prototypes become a universal gate | Baseline reading works first; appearance is independent of exploration. Keep three material-led prototypes for an undecided exploratory journey, honoring the original product direction. | When a reader has chosen or requests a specific revision, refine that instruction and test the remaining uncertainty. Do not impose a new choice ceremony. |
| Tests conflate preservation with recovery and characters with fidelity | Add separate checks for repair, visible geometry, semantic marks, exact-edition migration, optional network failure, long-form rendering and cache lifecycle. Add both browser engines to CI. | See dated execution results in STATUS.md. Native selection handles, physical storage eviction, safe-area behavior and live Vercel verification remain open. |

## Editorial lessons carried into the workflow

Quiet is an attention contract: text, title, continuation and an unobtrusive exit remain available. Administration surfaces when the reader asks for it. A companion must earn the attention it takes from the book; inspect what someone notices or understands after using it, not just clicks or time spent.

Word count and duration are scope information, not educational acceptance. Context needs a learning objective, concrete examinable detail, a precise passage relation and factual review. Literary ambiguity can be a useful result. Keep scene, historical identification and present-day access as three evidence layers; never use a source for one to certify another.

A schema, a map pin and a bibliography field cannot supply scholarly judgment. The real-material case exposes choices the friendly original samples do not: conflicting headings, later construction, unverified access, and a mechanism worth declining. It includes a reader test and an explicit subject-review gate before promoting its claims.

Editorial revisions are lifecycle events. Preserve exact prepared editions as well as raw sources, quotation evidence and record identities through reconversion, software upgrades, domain changes and device changes. Recovery must leave a person able to keep reading and saving, not merely produce a file of damaged data.

## What is deliberately still open

Physical iPhone/iPad selection, touch menus, storage retention, zoom and safe areas need actual devices. No kit deployment or private hosted-book access control has been verified. The research case has not undergone an on-site route survey, subject-expert review or reader learning study. Those are concrete next checks, not accomplishments inferred from a browser test or a long essay. Neither reference reader was changed.

## Follow-up experience observations · 16 October 2026

The reference-reader handoff identified recurring iPhone arrow glyphs and additional distinctions between passing functional tests and a usable reading experience. The kit now uses shared decorative SVG arrows and plain source links. The general criteria are recorded in [the agent guide](AGENT-GUIDE.md#verify-the-reading-experience) and [design notes](DESIGN.md#reading-ergonomics): visible range geometry, available reading height, both touch dimensions, quiet-mode orientation, title hierarchy, exact search matches, settled screenshots and offline reload.

Inspection found two related kit defects: context scrolled to the containing block rather than a late saved range, and an occurrence's context button dropped its offsets. The bounded correction retains those ranges and reveals their start, with original-fixture geometry checks. The existing focus-exit overlay placement and broader title/layout design were not changed. See [status](STATUS.md) for the exact verification scope and remaining physical-device limits. No personal reader text, screenshots, notes or assets were copied.
