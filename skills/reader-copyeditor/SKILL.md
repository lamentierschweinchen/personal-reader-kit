---
name: reader-copyeditor
description: Edit and review authored interface text, introductions and companions in a personal reader. Use before shipping reader prose or proposing exploratory concepts. Protect literary source text, preserve each edition's voice, remove production commentary and generic filler, and verify the rendered result.
---

# Reader copyeditor

This is the editorial step of [the agent guide](../../docs/AGENT-GUIDE.md), not a replacement build workflow. Use it for a new reader, a prose revision or a review of several editions. Review first; edit when the user has authorized implementation. Existing authorization to improve the reader covers ordinary reversible copy edits.

## Establish the scope

Read the project's instructions and inspect the actual routes. Record privately under `.reader/editorial/`:

- The authored files and rendered surfaces being reviewed, including introductions, captions, menus, empty/error states and secondary source views.
- Protected source files: books, quotations, source headings, historical spelling, notes, translation and illustration credits. Hash them before editing. Never run a style rewrite over an edition file.
- Three to five voice signals worth preserving: for example an Austen reader's understatement, Alice's wordplay or a philosophical reader's theatrical framing. Do not make every edition sound alike.
- Deliberate exceptions and limits: functional warnings, attributed testimony, necessary historical qualifications, and any surfaces not inspected.

Read complete passages and inspect their rendered context. A search hit in a module is not proof that readers see it: follow the route, conditional branch and data. Separate active prose from dormant inherited code. Do not extract all JavaScript strings with a regex and call that the reader's copy; template expressions, accessibility names and unused branches need inspection. Do not copy private book text into public reports.

Exercise slow or failed content loading too. A fallback bypassed by the healthy edition can still be a live surface. Check trial-era statements against the current publication and audience; keep historical records in documentation without presenting them as today's product state.

Some edition JSON mixes protected literature with separately authored context. Declare the editable fields explicitly. Protect every source/identity field and inspect a structural before/after diff; do not treat the whole file as prose or assume a hash of its chapters covers credits, notes or metadata. Prefer whole-file protection whenever possible. Before changing metadata, test an existing full-book export: bundle equality may cover more than the text fingerprint. If a copy edit breaks restoration, keep immutable editions unchanged and revise narrowly scoped presentation copy, or perform a separately reviewed migration. Scope any presentation correction to the verified built-in snapshot and leave imported or customized contexts alone. Do not weaken edition collision checks or silently rewrite stored books. Volatile publication status belongs in the application’s release/source view, not immutable literary data.

## Edit in four passes

### 1. Useful words

Every sentence must help the reader act, notice something specific, understand something supported, or consider a worthwhile question. Remove generic claims about attention, memory, journeys, connections or discovery that could accompany almost any book. A short line can still be empty; a long paragraph can be necessary.

For commentary, ask: what will the reader know or see afterwards that the book or interface did not already make obvious? Require concrete details and a precise passage relationship. A source link, word count or estimated duration does not answer that question. Delete weak material rather than embellishing it to meet a length target.

Inspect the surrounding qualifications before elevating a number or phrase. State what a total includes, excludes and covers in time; preserve a nearby concession or counterexample. A comparison needs a specific difference the reader can inspect. An index needs honest matching and coverage; a gallery needs a reason to look closely, not an instruction to admire.

A question that merely asks the reader to repeat the preceding paragraph may add no value. A generic notebook is not a companion simply because its prompts mention the book. For teaching, inspect the actual worked example and a meaningful exception; distinguish the author's rules or motives from the editor's interpretation and exercises. Preserve the conditions under which advice is useful. A flag must explain what it matched and allow a reasoned decision to keep the words.

### 2. The reader's surface

Remove self-narration: announcements of what the editor is about to do, explanations of restraint, praise for the product's sensitivity, and repeated permission to interpret or disagree. Usually start with the observation, evidence, question or action itself.

Put conversion decisions, research process, verification dates and design rationale in the project's documentation or a secondary source view. Do not merely rename every disclaimer as a footnote. Keep a short qualification beside a claim when removing it would mislead: an inferred place, a fictional route, an adapted edition, a simulated debate or a source's actual uncertainty.

Keep consequential information at the action: spoiler scope, storage failure, privacy, rights, irreversible effects and accessibility instructions. These are not expendable "backroom" copy. Prefer a clear behavior description over implementation vocabulary. Exercise the actual state before accepting a promise such as “hide everything”, “only on this device” or “chapters you have read”: selected spoiler permissions are not inferred reading progress, and portable exports are not confined to one device.

### 3. Claims and voice

Keep author, narrator, translator and editor distinct. Check facts against the relevant evidence; distinguish historical events, later testimony and current conditions. Do not turn a deletion into a stronger unsupported assertion or a later event into the cause of an earlier action. Preserve ambiguity and allow a proposed comparison to fail. Never invent a quotation, authorial intention or scholarly consensus. In a comparison, check who speaks, which narrative level they occupy, and which contributor or edition supplied the passage or image. Do not turn an ambiguous identity into a definite character record. Check spoilers in front matter, indexes and captions as well as chapter prose.

Read aloud for cadence and check neighboring paragraphs for repeated openings, conclusions and rhetorical gestures. Keep particularity, humor and deliberate rhythm. Do not impose a universal sentence length, spelling convention, punctuation ban or "AI score". A phrase list can locate candidates; it cannot decide whether prose is good or generated.

### 4. The whole experience

Inspect the edited surfaces on phone and tablet, with the actual requested section loaded. Check labels, hierarchy, links and large type as well as paragraphs. Distinguish authored text from its styling: CSS capitalization can change `innerText()` without changing `textContent()`, and neither proves comfortable reading. Wait for fonts and finite transitions before screenshots. Review sibling editions for repeated stock prose, while preserving useful consistent control labels.

Follow the route to the material itself. Cut repeated titles and introductions that delay the actual example or action; keep method details secondary while retaining qualifications needed to understand a claim. A phone comparison must remain useful when its passages stack. Review the loaded application revision as well as the content, so a cached interface is not mistaken for the latest change.

Use a fresh editorial reader when one is available or requested. Give that reviewer the scope, protected material and intended voice before giving them your findings. They should be able to retain strong prose and find nothing wrong. Do not require a quota of defects or silently equate a second pass by the writer with an independent review.

## Finish with evidence

For a consequential behavior claim, record the starting state, action and observed result; reading the string is not enough. For each finding record its location, reader-facing problem and disposition: **cut, revise, relocate or retain**, with a reason. Identify dormant-code cleanup separately. Record reviewed surfaces, edition integrity checks, remaining uncertainty and who actually reviewed the result. Keep quotation-bearing working receipts private.

The optional `scripts/editorial-review.mjs` command checks receipt coverage, current file hashes and unchanged protected sources. It does **not** extract prose, establish route reachability, fact-check claims or certify quality. Use `--help` for its small snapshot/check workflow. An untouched receipt must not pass, and changing reviewed code requires another review.

For release, resolve material findings, inspect the resulting rendered experience, run the relevant application checks and the public file/history audit. A documented exception needs a reason; unsupported factual claims or altered source text are release blockers. Report manual editorial judgment separately from automated checks, and do not claim human reader acceptance without it.

The responsible agent must personally endorse the resulting experience within the reviewed scope, including its benefit and attention cost; a favourable delegated report alone is insufficient. If later review rejects an earlier endorsement, mark it superseded and state whether the feature is cut, simplified or retained. Preserve the valid technical evidence and the reader's records, but do not use either as a reason to retain a weak interaction. Existing receipt summaries and limits can record this decision; the receipt checker does not certify it. If the user delegated creative judgment, make and refine that decision before presenting a finished result rather than asking them to rescue unfinished options.

## Before proposing a companion

Use the three proposal families in [the agent guide](../../docs/AGENT-GUIDE.md#3-try-three-things-then-build): straightforward, scholarly and experimental. They are different approaches, not ascending quality tiers. Each needs evidence and a representative piece of finished prose before its interaction is built.

Reject a concept if its sample could be transferred unchanged to another book, if its interest depends on an invented premise, or if it asks for more attention than its benefit warrants. An experimental pairing must show where the comparison breaks down, not just make an unexpected association. Ask what the proposal adds beyond existing controls; a useful paragraph may need only a source link, not another interface. Keep the proposal-family labels in the design discussion, rather than repeating the production taxonomy in the reader. Keep plain reading and omission of an unhelpful companion legitimate outcomes. Honor a direction the user already chose.
