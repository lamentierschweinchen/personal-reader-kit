# History boundary

This directory is the independent public kit repository; any surrounding workspace and personal readers have separate histories. Work began on `codex/reader-kit` with a local reviewed checkpoint. On 15 October 2026, after the 36-file / one-commit audit, the user explicitly selected **Publish as lamentierschweinchen/personal-reader-kit**.

The approved public destination is `https://github.com/lamentierschweinchen/personal-reader-kit`, remote `origin`, published branch `main`. It is a GitHub template repository. The initial implementation commit is `eb363c2e9b7c53be6b6b06959ef580d2b5b8a179`; its remote SHA, public visibility and template setting were verified after publication. Subsequent documentation records the now-established destination. Routine reviewed kit updates are authorized for this repository; no Vercel project was created or deployed as part of the kit publication.

Existing personal readers were inspected read-only. Their site-specific hosting authorization does not transfer to this repository. No source history or book files from them are imported here.

Ignored `.reader/` and `test-results/` can contain private intake, recovery data and local verification captures. They are not backed up by Git. Browser books, annotations, progress and preferences live in IndexedDB. Export private reading bundles, retain raw originals, and keep separate draft/recovery exports where needed. Browser storage can be evicted, and a second device does not automatically synchronize.

## Adversarial self-review · 15 October 2026

Version 0.1.1 repairs source-spacing and quotation fidelity around empty blocks, repeated-restore duplication, draft-loss navigation paths and stale connection saves. Damaged imported books are isolated and retained for raw recovery. Unsupported book structure fails explicitly. Publication protection now checks commit/tag metadata and exact Vercel upload inputs. Regression cases and current evidence are recorded in `docs/STATUS.md`. This is the kit builder's self-review; the independent Canetti review of `4eaeec6` subsequently arrived and is addressed below.

## Independent Canetti review · 15 October 2026

The 0.2.0 follow-up addresses incomplete-history auditing, content-pinned retired-file review, faithful companion excerpts, local-first startup, transactional damaged-state repair and exact-edition/origin migration. It extends literal occurrence search to imported books and stores chosen comparisons with both source references. Focus mode excludes companion administration. Editorial lessons, a sourced research case, explicit limits and the finding-by-finding disposition are in `docs/REVIEW.md`; execution and publication status are in `docs/STATUS.md`. No personal reader was changed.

## Interface and reading-experience learnings · 16 October 2026

Version 0.2.1 incorporates the recurring iPhone arrow-glyph issue reported from both reference readers. Authored interface arrows reuse one decorative SVG path with inherited color and textual control names; repeated source links omit the icon. Source-book characters and sample bytes remain unchanged. AGENTS.md, the agent guide and design guidance record the rule, the limits of emulation, and the need to judge visual/editorial quality separately from functional checks and word counts. The regression targets interface files and verifies imported literary arrows remain exact. Neither personal reader was changed.

The bounded follow-up also records range visibility, landscape reading space, both touch dimensions, quiet-mode orientation, long-title navigation, match-level search, settled captures and offline-reload evidence. Saved-passage and occurrence context in the kit now reveal their exact ranges; original-fixture browser checks cover those defects. Wider layout changes and physical-device verification remain outside this pass.

## Consolidated Carson and Canetti handoff · 16 October 2026

Version 0.3.0 integrates the completed reciprocal reviews into the existing kit. It adds explicit overlapping-selection choices, source-range extension with conflict protection, shared large-type coverage, a reserved focus exit, compact persistent context controls and full-title navigation disclosures. Original-fixture checks exercise failure paths, larger concurrent records, complete exports and offline chapter/companion return journeys. The consolidated coverage table in `docs/REVIEW.md` distinguishes existing fixes, new verification, optional future capabilities and manual gates. No personal-reader repairs or deployment were performed.

## Quiet controls after reader feedback · 16 October 2026

Version 0.3.1 applies the user-confirmed lesson that even a permanently visible Exit focus button distracts. Focus controls now stay hidden until a deliberate tap/click or keyboard recall, then hide on another tap or scrolling. Selection, holds, drags, source links and section navigation are excluded; Escape and keyboard focus return remain available. Original-fixture checks cover the interaction distinctions without claiming physical iOS verification.

## Portability and maintenance · 16 October 2026

Version 0.4.0 adds private reading bundles with selected exact editions, all saved records, integrity checking, a review step, explicit appearance choice and transactional restore. Edition collisions and concurrent changes stop restoration without overwriting work. The read-only upgrade comparator distinguishes upstream changes from personal customizations. A bounded local EPUB preparer creates provisional unstyled text-only editions and private receipts, rejecting unsupported structures rather than silently losing them. The newcomer/editorial pilot supplies concrete human acceptance tasks; it does not claim those sessions have occurred. Public presentation work remains separate.

## Rights and real-book trials · 16 October 2026

The rights guide and import notice distinguish owning a copy, processing permission and public redistribution. Public examples require edition/contributor evidence and a reviewed asset inventory. Three independent local trials were started from v0.4.0 using Pride and Prejudice, Alice's Adventures in Wonderland and Walden with Civil Disobedience; they are not completed human-pilot or hosted-site evidence. Their sources stay outside this kit. The book-format guide scopes a proposed EPUB export and explicitly distinguishes it from the existing JSON backups and EPUB preparer; export is not yet implemented.

## Independent builder feedback and visual direction · 16 October 2026

Version 0.4.1 incorporates the four local real-book trials. Opening Import first saves the current reading place; delayed document scroll notifications no longer dismiss newly recalled focus controls without actual movement. Original-fixture regressions cover both behaviors. Search excerpts prefer complete nearby words and show omissions without changing source text or match offsets. EPUB refusals now retain the safe manifest/spine and feature inventory, while archive/XML safety and no-partial-book rules stay strict. Optional text-profile validation gives named compatibility errors without accepting unsupported media or silently rewriting legacy editions.

The adapter guide records distinct media schemas, apparatus spoilers, source-layout fidelity, exact asset/history review, actual-book journeys and honest recovery limits. The visual guide requires material-led composition rather than color-only reskins. The four examples remain independent projects; no literary files or their screenshots enter this kit. EPUB export, common media support, physical-device tests and human acceptance remain unimplemented or unperformed as documented in STATUS.md.

## Passage sharing and travel verification · 16 October 2026

Version 0.5.0 adds explicit native passage sharing and attributed plain-text copying from selected or saved passages. The outgoing payload preserves source whitespace and excludes personal annotations, other records and current/device URLs. Cancellation, blocked sharing and denied clipboard access keep drafts; a manual-copy surface remains available. Mismatched editions cannot be misattributed. The build and offline cache explicitly include the small sharing module. No note schema or book content changes.

The offline journey now creates and edits an annotation during an outage, then reloads and checks persistence, alongside chapter and companion navigation. Current execution evidence and limits are in docs/STATUS.md. Native OS share-sheet delivery and physical iOS gestures require device testing; automated sharing checks use original fixtures and API stubs.

The Walden and Two Halls trial checks exposed two related continuity defects. The kit now captures the main place before a dialog opens and suppresses delayed/visibility saves behind it; loaded built-in editions refresh a previously unavailable source on the saved-passages page. Original-fixture tests reproduce the relevant queued scroll, resized dialog, pagehide and delayed-library conditions. These are source-free behavior fixes, not imported book customizations.

## Four public examples packaged · 16 October 2026

The user explicitly selected the four completed public-domain readers for an examples folder in this established public repository. Their committed current source snapshots are included without independent histories, private preparation or captures. README, instruction and audit entry points now reflect the enclosing repository; runtime and edition bytes remain unchanged. Each remains a separate application with its own adapter and build. The root application/upload list still contains only original samples.

The complete-history auditor now accepts only exact path/hash/provenance-reviewed example edition files, including JSON with embedded images. Credential/private-path checks remain active. CI runs every example’s Node/build checks and compares every output byte with its reviewed inventory. Starter files are explicit so new personal projects omit the optional example collection. No website, domain or deployment was created.

## Public showcase and canonical hosting · 16 October 2026

The user chose `read.lookatseel.com` and asked for the personal website’s theme and existing book object. The seven-file static showcase links the four readers on separate canonical subdomains, preserving their runtime and edition bytes. The source asset review pins the three branded/font binaries and retains their separate permissions and OFL license. The stock reader and starter exclude this optional showcase. Browser checks cover phone/tablet portrait and landscape, desktop, links, disclosures, local assets and keyboard entry. Deployment and live verification are recorded in docs/STATUS.md.

The first Git deployments exposed a nested upload-rule mismatch. Release `a79a68c` retains both standalone and repository-prefixed exact inputs, disables outside-root build access, and tests required/private-path behavior. All five production projects and DNS configurations then passed. No reader runtime, edition or existing personal site changed.

Live checks account for every catalogue/reader output, isolate the workers' cache-identifier differences, and verify Chromium offline reopening, annotation creation/editing/reload and fresh-browser recovery on all four canonical origins. Chromium/WebKit live reading and inspected layouts pass. This hosting receipt does not establish physical iOS behavior, native share delivery or a human newcomer pilot. Documentation follow-ups retain the exact tested revision and limits in STATUS.md.
