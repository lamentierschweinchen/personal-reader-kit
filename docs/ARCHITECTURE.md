# A small reader with room beside it

## Assessment of the reference implementations

Two existing personal readers were inspected read-only. Their libraries, deployments, configuration and history remain separate. No book text, app code, image, font or map was copied from either project.

The Canetti reader demonstrates a lightweight static application, browser-local reading records, source-preserving selection, focus mode and a fully cached reading experience. Its new annotated walk links six main stops and two detours to specific passages. Named places, approximate areas and geographic inferences stay distinct. Street continuity, pedestrian edges, offline use and touch layouts have concrete tests. This suggests an optional experience layer, not a mandatory map in every reader.

The Carson reader demonstrates a multi-work collection, explicit edition/block identities, source-aware selection, optional personal connections and reading positions independent of context panels. Its renderer audits compare canonical text and emphasis, including Greek and complicated verse. Its recovery work shows why a note needs quoted evidence as well as an offset, and why source changes must remain visible. That project's encrypted synchronization and framework/hosting infrastructure are outside this kit's initial scope.

Their current sites were reported live by the owner. This task inspected source and existing verification receipts; it did not redeploy them or independently certify their current production state. Both had ongoing local changes and were left untouched.

## Reuse decision

Reuse the contracts and tested behavior, with a clean implementation. Transplanting either site's history risks mixing personal editions and hosting assumptions into a public kit. A framework-independent ES module core makes the smallest reliable shell straightforward to deploy and easy for a reader's agent to extend.

```text
Public repository
  AGENTS.md + docs/       agent workflow, import and deployment guidance
  site/core.mjs          validated books, exact anchors, recovery, spoiler boundaries
  site/db.mjs            serialized IndexedDB transactions for books and reader state
  site/text.mjs          exact text rendering, emphasis and selection
  site/app.mjs           shelf, reader, passages, optional companion prototypes
  samples/               reviewed original writing only
  scripts/               local importer, allowlisted build, local preview, history audit
  tests/                 source/anchor/boundary tests and real browser workflows

Private local material
  .reader/private/       input conversions and private agent receipts; ignored
  browser IndexedDB     imported books, annotations, progress, preferences
  exported backups      private quotations/notes; keep outside the public repository

Public website output
  dist/                  exactly 11 application/sample files; no private inputs
```

There are zero application dependencies, no backend and no runtime model calls. Node is only the build/import/test tool. Passage-based companions, including imported-book matches and reader-chosen comparisons, use the common source renderer and a modal context surface; opening it never touches main progress. Spoiler permission is an explicit section boundary, independent of scroll position. A reader can skim ahead without automatically being shown later interpretations.

IndexedDB read/write transactions read the latest state before each mutation, preventing one tab's stale full snapshot from replacing another tab's notes. Conflicting edits of the same note are rejected with the draft retained. Corrupt state is read-only until an explicit repair transaction archives it and installs a validated replacement. Both writes commit together; local books are untouched, and a healthy state cannot be replaced by a stale repair dialog. Backup merges preserve conflicts rather than choosing a silent winner. There is no remote synchronization; cross-device or cross-origin use requires exact prepared edition exports and record backups. A raw EPUB/PDF alone may not recreate the same conversion.

Local books/state hydrate before optional sample fetching. Failed demonstration downloads produce a limited warning, not a failed shelf. Connections carry two edition-aware passage records and private commentary; legacy unbound reflections remain readable without inventing source relationships. Literal occurrence search includes all permitted books, returns individual ranges, caps displayed results explicitly and makes no language-specific tokenization claim.

The default presentation keeps the fictional walk separate from a sourced [editorial research case](COMPANION-CASE-STUDY.md). That case records unresolved access and learning validation; it is not a claim of automated research or a live itinerary.

The default publishing model is a public shell with browser-local books. It makes a useful personal site without distributing books or asking for authentication infrastructure. A privately hosted shared library is a later backend/access-control project, not a hidden build flag.

## Priorities

1. **P0, working foundation:** exact text, selectable highlights/comments, recoverable persistence, progress, focus and responsive reading; safe public shell and original samples.
2. **P1, guided product:** the four-step agent workflow, honest format limits, three differentiated prototypes, sourced background contract, explicit spoilers, GitHub/Vercel walkthrough and publication review.
3. **Next, earned by real use:** physical iOS selection and device-scale large-book performance; reviewed EPUB adapter with notes/illustrations; local PDF/OCR tools and proofing; linguistic or semantic search; reader-chosen experience on a real book.
4. **Only if needed:** authenticated hosted libraries or encrypted multi-device sync, route/map extensions, complex source geometry and richer anthology tools.

Do not add a universal importer, map engine, database service or model API to every installation. Add an adapter when the actual book and user's preferred experience require it. Preserve the small dependable reading path.
