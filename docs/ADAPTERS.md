# From the small reader to a real edition

Four independent public-domain trials covered an illustrated novel, an illustrated story with shaped verse, essays with accounts and a survey, and philosophy with Greek, notes and tables. Every trial needed a source-specific adapter. This demonstrates the guided workflow, not automatic support in the stock importer. Their explicitly reviewed source snapshots are now in [examples/](../examples/README.md), with separate build boundaries and exact asset reviews. Use the existing [agent workflow](AGENT-GUIDE.md), [format boundaries](BOOK-FORMAT.md) and [rights guide](RIGHTS.md).

## Inspect before extending

Read the private EPUB receipt's resources, spine, feature counts and inspection errors. A `cover-image` refusal may coexist with CSS, source notes, tables and text-bearing initials. Stopping conversion at the first unsupported item is safe; planning from only that item is incomplete. The inventory does not evaluate CSS meaning, image content or literary fidelity. Unsafe/encrypted archives can stop before a package inventory exists.

Compare the rendered source and its structure. Extracted text can miss an initial drawn inside an image, flatten shaped verse, detach a caption or omit a second work. Preserve the actual edition, including its omissions and apparatus. Identify unsupported features before calling an import complete. Do not delete them to make a validator pass.

## Give an extension an identity

Schema `1` alone does not mean that customized readers understand the same book. The stock validator accepts its exact text contract, with an optional `profile: "personal-reader/text@1"`. Older untagged text editions retain their exact bytes and remain supported. Unknown profiles fail explicitly; declaring the base profile does not permit additional fields.

A project extending the contract must choose and validate its own versioned profile, such as `project-name/illustrated@1`, and identify the reader revision that can restore it. This is a reviewed local extension, not a plugin loader or a stock media profile. Extend validation, rendering, excerpt/selection logic, build and restore checks together. Never use executable HTML or remote resources as a shortcut.

Adding a profile changes prepared edition bytes. Do not silently tag stored editions or rewrite backups: retain the old reader and exact edition, review collisions and verify migration. Bundle `kitVersion` identifies the application that wrote it; it does not prove compatibility with another project's renderer. Keep matching reader source/revision and restoration instructions with long-term recovery material.

## Make asset portability real

For every supported asset, define its identity, safe media type, decoded-byte hash, dimensions, accessible description, source placement, rights evidence and size limits. Base64 is packaging, not safety or permission. Validate decoded bytes as well as the container; explicitly reject unsupported or missing payloads.

Choose whether editions contain asset bytes or depend on a reviewed application asset set. With external assets, a JSON bundle alone is not a self-contained illustrated edition. State that beside export and in recovery instructions. Restore into a fresh browser at a different origin with the original library unavailable; open every required image and note. Recognizing metadata while the website supplies the pictures does not prove portability.

Required source notices are part of that recovery contract. A hosted license view does not prove that a downloaded edition carries its terms. Inspect both the exact-edition download and the full reading bundle; carry required notices inside the edition or in an explicit, validated supplement tied to its unchanged exact bytes. Restore and open the full notices with the original library and notice endpoints returning real HTTP failures, including service-worker requests. Preserve recovery of older exports while identifying missing notices honestly; refuse a new export that would silently omit required terms. A matching application shell can support recovered books without claiming that a book bundle also restores its companion or a complete offline website.

Media, linked source notes, table spans and per-line geometry remain unsupported in the stock kit. The four trial formats are not interchangeable. A common implementation is future work, one tested representation at a time; do not merge four bespoke schemas wholesale.

## Preserve editorial structure

Source order and the best entry point differ. A novel can begin at Chapter 1 while its preface, dedication and index remain available in original order. Front matter and captions may reveal later events. A single linear through-section boundary cannot express every permission: gate spoiler-heavy apparatus separately or omit it from the companion index until explicitly allowed. Chapter order and scrolling are not permission.

Source notes are reference excursions. Open the requested note and a return path without replacing the main place or disclosing all notes. Two works need independent positions and permissions. Pair positions and drafts belong to the originating pair, not the current route; a trip to the shelf should not discard a reflection.

For a collection, record the complete boundary of every selected work, including a work extracted from a larger volume. Keep its relevant notes and source terms, and distinguish the first publication date from the actual digital witness. A pairing is the editor's invitation; it does not establish agreement, influence or a historical meeting. Let the source's qualifications remain beside the tempting short quotation.

Keep original demonstration IDs separate from supplied historical collection IDs. The starter reserves `bell` and `rain` for its original samples; copying that reservation to every built-in historical work can prevent exact-bundle recovery when the library endpoint is unavailable. Historical editions still need canonical-byte collision checks and preservation of differing stored copies. Prove restoration with the supplied library unavailable, then open the restored source media and notes; a loaded website must not secretly supply missing recovery material.

Proofread the final transformed text. A corrected paragraph can be damaged by a later cleanup step: a quotation beginning at a printed line boundary may look like a repeated continuation mark. Enumerate destructive removals, compare their actual quotation scope with the witness, and preserve verified paragraph corrections through the remaining pipeline. Reflow joins, emphasis offsets and note boundaries need a separate final check. A proof pass over an earlier intermediate file does not establish fidelity of the delivered edition.

Shaped verse may need a documented source-layout mode and readable alternate. Both preserve characters, breaks and anchors. Check visible spacing separately from character equality. Image initials must remain whole when highlights cross their characters. Enlargement cannot create detail missing from a low-resolution source.

## Test the adapted reader

Use [the local preview](AGENT-GUIDE.md#preview-prepared-books-locally) to inspect prepared editions that fit the stock text contract. It keeps private library output separate from the original-sample public build. A new media/profile extension also needs a reviewed local build and exact asset list; the text-only helper deliberately refuses it. Do not weaken sample fingerprints, copy an entire preparation directory into the served output, or treat a local preview as permission to host books.

The original fixture suite remains regression evidence; its book IDs, labels and sample experiments are not a generic acceptance driver. Reuse `settledCapture` and `rangeInViewport` from `tests/experience-browser.mjs` when the adapted DOM contract is unchanged. Otherwise adapt their geometric assertions explicitly, preserving the usable-viewport check. Its bounded render-readiness helper checks visible artwork without scrolling to load unseen lazy images; full-page captures and complete asset coverage need separate checks.

Create a real-edition journey using stable IDs: long paragraph, multi-block selection, risky source layout, image, note/backlink where present, reference round trip and any paired reading. Verify complete source coverage separately. Exercise large type, night, quiet mode, landscape reading height, save/reload, failed writes, new-origin restoration and stopped-origin reopening. Explicit installed browser paths address runtime mismatches; an offline-emulation flag alone does not establish outage resilience.

Classify failures as a source limitation, application defect, adaptation defect, harness timing/selector error or editorial choice. Await the exact requested book/section, not merely a ready marker left on the departing section. If a fixture focuses reading before a keyboard test, use preventScroll or explicitly wait for the intended focus-induced movement to settle. For a reading-position round trip, record the departure after any required scrolling; automation may scroll a sticky link before clicking it. When the target is already visible, verify its bounds and use that visible action so the test does not manufacture a different departure position. Do not call every timeout lost data or dismiss repeatable behavior as flakiness. Native touch, screen readers, proofreading and human learning/onboarding remain separate acceptance work.

## Keep publication exact

The upstream build stays original-samples-only. An example needs its own permission decision, pinned editions/assets, exact build/upload inputs and complete-history review. Retain the conservative scanner. A project supplement may resolve only named, content-pinned assets across working files, index and every relevant historical version; all other findings remain fatal. Decode embedded assets explicitly. A successful audit is not rights clearance. Independent customized readers also need isolated deployment origins unless base paths, worker/cache namespaces and storage are deliberately adapted; see [multiple-reader hosting](DEPLOYMENT.md#hosting-several-customized-readers).

Raw archives, private notes, source screenshots and intermediates stay ignored. A source EPUB link is a separate download, not generated export or note synchronization. Finish with implemented behavior, actual checks, project-specific decisions and remaining gaps.
