# Independent review and response

The Canetti builder independently reviewed `main@4eaeec6` on 15 October 2026, including the reader, guides, source contracts, publication tooling and tests. It reproduced failures with original synthetic fixtures and did not modify the kit or either reference reader. The kit builder reconciled that report against the already published self-review release `aa60a42` (0.1.1).

The useful product description is a **reusable reader shell plus a supervised editorial workflow**. This update preserves that boundary. It does not claim automated scholarship, universal ebook conversion, physical mobile dependability or hosted private libraries.

## Alice gesture follow-up, 18 October 2026

The hosted gameplay check interrupted the four-reader release after an unexpected return to course one. An instrumented run withdrew the initial resize-race hypothesis: a held cup reached an interlude, then its trusted touch release landed on the newly revealed primary button. The application had released native pointer capture before the physical gesture ended. At final completion the same button means Replay, explaining the reset.

Retaining pointer capture alone did not fix the compatibility click. The correction also associates each pointer press with its button and current game phase, then requires the same pointer, button and phase at release before a result action can run. Independent review exposed the keyboard equivalent: a held Enter or Space could activate a newly focused result or a reused button with a new meaning. Stale repeats and releases are now consumed; fresh activation remains available. The correction adds no timed input suppression and changes no game rule.

The permanent browser check deliberately holds through all three endings, proves the release point overlaps the result button and requires the complete result state to remain unchanged after release. It also holds cup and primary-button activation keys through natural losses, then verifies fresh activation. Exact Resume labels and phase assertions make the test's intended actions explicit. The guide generalizes ownership across gesture-driven transitions; physical-device and assistive-technology acceptance remain separate from browser evidence.

## First four readers revisited, 18 October 2026

The original four public readers were revisited against the stronger editorial standard. Each retained its own visual identity and complete prepared editions. Source-adjacent evidence, actual reader actions and independent review determined the changes.

| Reader | Revised experience | Reason to retain it |
| --- | --- | --- |
| Austen | Whole-word matching without case sensitivity by default, explicit alternatives, chapter counts/filtering and complete result paging. | The index reaches capitalized occurrences and later results while keeping exact quotation offsets; it avoids manufacturing an interpretation. |
| Alice | Portrait, tale/tail and Cat studies precede a chaptered gallery; phone prose has full width; artwork has a fitted, bounded view and deliberate zoom. | The images and exact chapter passages reveal specific differences worth examining. Edition-notice memory and exploration navigation no longer repeatedly interrupt or obscure them. |
| Walden | Three account views put totals beside their scope, exclusions and the narrator's qualifications; the survey reading follows a prediction into a measured trial and distinguishes the later analogy. | The reader can inspect what the figures and method establish, including their limits, instead of receiving generic questions. |
| Two lecture halls | Six optional exact landmarks sit inside the complete paired readings; citations and orientation are quieter; each hall keeps its own text position through reflow. | The landmarks make turns in the arguments findable while preserving the differing scales, qualifications and complete saved pair. |

Independent reviewers read the supporting passages and used each revised experience. They reproduced hidden-pane cue/reset failures and accumulated reading-position drift during repeated reflow; those findings were repaired and promoted into browser regressions. Parent review also rejected unnecessary default enlargement of small source artwork. Functional evidence, editorial endorsement and human literary acceptance remain distinct.

Validated lessons are integrated into the existing agent, design, copyeditor and upgrade instructions. No second workflow or general writing-assessment engine was added. The stock sample index retains its documented literal-match and result-cap scope; the richer index belongs to the Austen example. Source editions, apparatus, old bundles, notes, complete paired reflections, permission boundaries and games remain intact. Private quotation-bearing receipts and screenshots stay ignored. [Release checks and limits](STATUS.md#four-reader-refinement-18-october-2026).

## Production and editorial review, 18 October 2026

Recent reader trials required a separate editorial decision after functional checks had passed. The reusable findings below are generalized; private texts, notebooks, prototypes and captures remain outside the kit.

| Observed issue | Reusable response | Scope |
| --- | --- | --- |
| Themed questions repeated the adjacent commentary; a notebook added little beyond marginalia. | Judge the complete interaction's benefit and attention cost. Withdraw an earlier endorsement when warranted; remove promotion while retaining earlier writing and recovery. A replacement companion is optional. | Agent guide, copyeditor and upgrade guidance. |
| A teaching companion offered exercises without enough demonstration. | Teach through actual contrasting examples, preserve exceptions and distinguish the author's claims from editorial exercises. Explain bounded automated checks and permit deliberate disagreement. | Editorial guidance; no general writing assessor added. |
| Large headings and repeated introductions pushed examples and feedback out of useful view despite passing layout checks. | Inspect how promptly the actual material and next action appear, including the cost of stacked comparisons on a phone. Keep original versions accessible and method details secondary. | Design and copyeditor guidance; no universal first-viewport requirement. |
| First-input confirmation added friction, while re-review erased decisions on unchanged sentences. | Distinguish first use from replacement recovery. Preserve judgments only in unchanged, unambiguous contexts and test changed or duplicate contexts separately. | Conditional guidance for specialized tools; stock import and bundle safeguards remain. |
| A newly built server and an existing offline tab could show different revisions. | Identify the loaded code and controlling worker; compare fresh-context evidence with the normal existing-profile update path, preserving records. | Verification discipline, not a newly diagnosed worker defect. |

Artwork comparisons also need an exact depicted moment and contribution: related images can represent different scenes, editions or kinds of response. The design and rights guides now connect that editorial check to reproduction quality, spoiler handling and the existing asset receipt.

The stock touch-selection correction is already published. No private companion schema, lesson text, phrase detector, prototype or source asset is being ported. The existing receipt format can record superseded approval; adding a machine-generated quality verdict would not solve the editorial failure. This update changes guidance, not reader runtime, saved data or edition files. Its release checks and limits are recorded in [STATUS.md](STATUS.md#production-and-editorial-guidance-18-october-2026).

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

The reciprocal review also supplied future QA criteria: complete reference excursions must preserve the main reading place; success feedback must follow confirmed storage writes, including removal/reset; malformed storage must survive recovery; a larger selection around an old highlight must not be silently replaced; and text-size scope must include long companion readings or be explicit. These were added to the guide without further implementation. Existing kit checks cover independent exploration, failed note-save retention and raw-state preservation/repair. They do not establish every bookmark removal/reset path, overlap gesture or long-essay typography case; those are not reported as newly reproduced kit defects.

## Consolidated handoff: 16 October 2026

Both reference-reader reviewers completed their reciprocal reviews and supplied one canonical handoff. The user then authorized integrating the lessons into the kit. Version 0.3.0 follows that handoff without changing either personal reader or importing their text, assets or history. This table supersedes the earlier “guidance/future QA only” disposition for the specific kit paths now exercised; it does not declare the reference readers repaired.

| Learning | Kit disposition | Evidence and boundary |
| --- | --- | --- |
| Reading first; quiet mode retains essentials | Existing baseline and independent spoiler permission retained. Deliberately recalled focus controls, persistent compact context header, section-labelled counts and long-title navigation disclosures. | Focus survives reload; controls hidden by default, with a 56px strip when recalled at the tested phone/tablet sizes; full source headings remain exact. Source diagnostics stay in secondary views. Physical comfort still needs readers. Navigation is a flat numbered section list; richer source-supported front-matter/volume grouping needs an adapter. |
| Whole-phone quality and SVG icons | Shared vector arrows and quiet source links already implemented in 0.2.1. New large-type coverage includes substantial context, quotes, notes and companion readings. | Scoped glyph guard, both touch dimensions, phone/tablet screenshots and actual range rectangles. Shared type does not enlarge navigation labels. No claim of physical iOS verification. |
| Exact words and continuity | Existing edition/evidence anchors, separators, independent excursions and occurrence search retained. New explicit new/extend/edit choice for overlapping selections; extension preserves the union and existing comment. | Original multi-node/multi-paragraph fixtures, failed-extension draft retention, source emphasis, exact context return, retained search query/list position and unchanged reading place after a full companion round trip. Native drag handles remain untested. “Adopt this new place” and occurrence paging are optional, not implemented. |
| Truthful persistence and recoverable records | Existing atomic state updates, corrupt-record quarantine/repair and idempotent conflict merge retained. Newly inject failed note and book removal. | Failed mutations retain stored records and show the error; note removal succeeds on retry. Actual IndexedDB representation exercised with 1,200 notes, approximately 2.34 MB, competing tab writes and a complete export comparison. No standalone bookmark/reset, account, device-link or sync feature is claimed. |
| Hosting and storage migrations | Existing exact-edition export and fresh-context/new-origin restore retained. Guidance now requires complete record counts, versions, device-link inventory where applicable and rollback evidence. | Automated origin restore uses original fixtures. Production provider behavior, encrypted sync and conditional-write protocols require separate testing if those optional architectures are chosen. |
| Offline needs an outage | Existing content-versioned cache and interrupted-upgrade recovery retained. Expanded cold-reload checks include imported text, chapter navigation and companion context/return. | Chromium offline mode with a failing uncached fetch; WebKit with the origin stopped and a failing direct network request. External research/directions links remain online. No deployed kit asset comparison yet. |
| Fidelity is more than coverage | Existing exact-character, visible spacing, emphasis and anchor checks retained. Guide separates import completeness, OCR/character conservation and proofreading. | Unsupported source structures fail explicitly. Illustrated/facsimile and interactive-footnote adapters remain future work; tests do not establish proofreading. |
| Companions must earn attention | Existing sourced editorial case and reject-a-mechanism exercise retained. Guidance now prioritizes concrete people/events/institutions, historical layers, narrative ambivalence and editorial density over filler or duration targets. | This is workflow guidance and a research brief, not a new historical essay or measured learning outcome. Reader benefit and subject review remain manual gates. |
| Maps must be useful and honest | Guidance adds a complete place inventory, recognizable streets/scale/orientation, evidence levels, pedestrian continuity, offline assets and map licensing. | Maps are deliberately optional. The sample listening walk remains clearly fictional; there is no production map, live routing or verified historical itinerary to claim tested. |

The test receipts distinguish executed checks from recommendations. The existing draft-loss, repeated-restore, source-separator, damaged-book and Vercel-upload fixes retain their earlier provenance; these are not new discoveries. Screen-reader testing, native touch/keyboard behavior, actual reader/editorial feedback and a live personal-site onboarding are still separate gates. The public beta is useful for readers working with an agent and keeping private backups; it is not a claim of universal import or unattended scholarly judgment.

A later user-confirmed Carson lesson refined this further in 0.3.1: a permanently visible Exit focus control was itself distracting. The kit now hides focus controls until a deliberate tap/click or keyboard action recalls them, then dismisses them on another tap or scrolling. Original-fixture interaction checks cover hold/drag, selection clearing, link/navigation exclusions, annotation, keyboard reveal and Escape/focus return. These are desktop-engine tests; physical iPhone/iPad gesture behavior remains a manual gate.

## Portability follow-through · 0.4.0

The next iteration turns separate migration exports into a private, integrity-checked bundle with a concrete restore preview and one transaction for books/records. Original-fixture browser checks cover fresh-origin restore, interrupted writes, concurrent changes and edition collisions. It also adds a read-only upgrade comparison and a deliberately narrow EPUB preparer; unsupported literary structure produces a private report instead of a partial edition. These changes make the existing recovery/fidelity principles easier to follow. They do not establish physical-device, newcomer or editorial acceptance. [The pilot](PILOT.md) defines those remaining observations explicitly.

## Four real-book builder trials · 16 October 2026

Independent local builders worked with Pride and Prejudice, Alice's Adventures in Wonderland, Walden with Civil Disobedience, and the Schopenhauer/Hegel comparison. Their source files and project-specific tests remain outside the kit. These are agent integration trials, not human onboarding or learning studies. The findings below distinguish reusable defects from intentional limits.

| Finding | Disposition in 0.4.1 |
| --- | --- |
| Import could open before the current section was saved | Fixed: save the main place before opening Import; original-fixture browser regression covers the transition. |
| A deferred document scroll notification could dismiss recalled focus controls | Fixed: compare actual position since recall, retaining real/nested scroll dismissal. A WebKit probe reproduced the deferred-scroll failure; original-fixture Chromium/WebKit checks verify the correction. |
| Search excerpts could begin inside an ordinary word without marking the omission | Fixed: bounded expansion toward whitespace and editorial omission indicators outside source text. Original fixtures verify exact quotations, match offsets and rendered indicators. |
| Early EPUB refusal concealed the rest of the source's adaptation needs | Implemented: full safe resource/spine inventory and XML feature counts precede conversion refusal. Unsafe archives still stop early; no partial candidate or expanded format support. |
| Different extensions all called themselves schema 1 | Implemented guard and documented migration: optional base text profile, named unsupported-profile error, strict field validation. Existing editions are not silently retagged; no common media profile is implemented. |
| Illustrated initials, shaped verse, notes, table cells and source pages need faithful representations | Documented adapter obligations and rendered checks. The stock text renderer's boundary remains. Local trial fixes are not relabeled as upstream capabilities. |
| Illustrated bundles may still depend on the old site's images | Explicit recovery requirement and fresh-origin test guidance. Embedded and external-asset designs are distinguished; the four formats are not interchangeable. |
| Front matter and caption/index text can spoil later chapters | Apparatus-aware permission guidance. The base linear section boundary is unchanged; dedicated apparatus gating remains an adapter responsibility. |
| A public example needs reviewed assets outside the original-sample build | Exact project inventory/history and decoded-media supplement guidance. The upstream build and scanner remain conservative and original-samples-only. |
| Sample-specific browser journeys required rewriting | Existing settled-capture and range-geometry helpers are exported for reuse; actual-edition journey guidance names the required fixtures. No universal test driver is claimed. |
| Matching text, word counts and test passes missed visual or editorial weakness | Material-led art direction and whole-flow comparison added to the design/agent guides. Human learning, proofreading, native touch and screen-reader review remain separate. |
| Inherited header offsets and additional sticky source controls reduced reading space | Design guidance now names old breakpoint overrides and every persistent control row. The tailored projects own their responsive fixes; no universal source-layout toolbar is added upstream. |
| Browser/runtime mismatch, asynchronous UI assertions and offline-emulation errors | Documented as environment/harness issues where evidence supports that classification. Actual outage controls and awaited state transitions remain required. |

See [adapter decisions](ADAPTERS.md) for the concrete preparation, versioning, source-reference, draft, asset and publication rules. Distinct source-adapter implementations should be reconciled deliberately, not merged wholesale into this small reader.


## Editorial workflow and four-edition review · 17 October 2026

The user asked for stricter prose editing and then sent each of the four existing builders through the new [reader-copyeditor skill](../skills/reader-copyeditor/SKILL.md). This is a portable editorial step in the existing agent guide, not a new reader architecture. The guide now asks for straightforward, scholarly and experimental proposals, each with a textual basis, reader action, representative finished prose, research/rights and spoiler costs, and a reason to reject or simplify it. A chosen direction does not restart that exercise; a poorly fitting family needs an honest alternative.

The workflow separates useful interface instructions, original commentary and protected literature. It requires declared voice signals, actual rendered scope, claim checking, sibling review and explicit cut/revise/relocate/retain decisions. It does not use an AI score, banned-punctuation rule, word-count quality threshold or mandatory quota of defects. Necessary source uncertainty, rights, privacy and failure messages stay visible where they matter.

| Edition | Reviewed result | Preserved |
| --- | --- | --- |
| Austen | More accurate search/permission wording and empty states; a clear missing-edition path replaces unrelated sample experiments. | The spare word index, bibliographic title page and source exclusions. |
| Alice | More specific looking and typography questions; fewer method announcements; explicit front-matter spoiler scope. | Wordplay, contributor distinctions, source notices and exact image/verse structure. |
| Walden | Shorter account, survey and tax readings that retain their concrete evidence; corrected permission wording. | Historical details, source links, the limits of the comparison and the field-notebook design. |
| Two Halls | Clearer read-through controls and shorter recurring labels; less framing around the existing comparisons. | The hall metaphor, historical qualifications, translators' distinctions and questions without a declared winner. |

Each builder also produced three private proposal briefs with finished sample prose. The exercise yielded possible later additions, and reasons to use existing controls or omit a feature. It did not trigger new companion builds. Austen and Alice document the builder's own editorial review; Walden and Two Halls also received fresh agent readings. These are not human acceptance studies.

The optional receipt helper checks declared coverage and source integrity. A blank receipt fails, reviewed file changes invalidate it, and refresh cannot accept changed protected source fields. Explicit JSON pointers support prepared files that mix protected literature with authored context; the full diff still needs review. It does not extract prose from JavaScript, establish route reachability, fact-check or certify editorial quality. Private receipts stay under `.reader/editorial/`.

Findings already transferred from the edition reviews into the workflow:

- **Check statements against behavior.** A selected chapter boundary is not inferred reading progress. “None yet” does not hide an always-visible introduction. Exportable browser records are not necessarily confined to one device.
- **Inspect fallback routes.** A generic branch bypassed by a healthy edition may become visible when a download fails; do not dismiss it as dormant based on the happy path alone.
- **Inspect mixed metadata.** Trial-era publication statements can survive inside About panels even when ordinary UI copy is good. Change separately authored fields only, preserving all literature, source identities, credits and assets.
- **Test a finished paragraph before building.** The Alice briefs exposed unsupported speaker identities, an unreviewed illustration and a foreshadowing claim before implementation. Walden’s briefs showed that existing passage controls already supplied much of the proposed benefit. The guide now explicitly asks what a new feature adds beyond those controls. These are design findings, not measured learning outcomes.
- **A source hash is not the whole compatibility contract.** Alice’s trial context edit left text anchors valid but made old full-book bundles conflict, because bundles compare complete editions. The release therefore keeps edition JSON unchanged and scopes current About wording to the presentation layer. Copy edits must test old exports; do not weaken collision checks to make them pass.
- **Preserve useful differences.** Austen's restrained index is a positive control, not an invitation to manufacture more commentary. A staged philosophical comparison needs one clear historical qualification; that is different from repeated editorial self-narration.

The stock pass removes the generic index maxim and process commentary, gives the listening sketch concrete sensory actions, and clarifies storage and boundary instructions. Four original-sample context strings are presented with revised wording; the complete stored/exported sample editions remain unchanged. The fictional walk is still a small demonstration, not evidence of a researched itinerary or measured reader learning. Execution evidence and remaining limits are recorded in [STATUS.md](STATUS.md).
