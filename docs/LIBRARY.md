# Contributing an edition to the library

The [New reading library](https://newreading.app/library/) collects prepared editions: a particular source, a useful reading experience and any companion its maker has built. Sixteen editions prepared by New reading form the current shelf, including six meetings of writers. Community proposals are reviewed before joining it.

## Propose a reader

Use [Propose a library edition](https://github.com/lamentierschweinchen/personal-reader-kit/issues/new?template=edition.yml). The GitHub form is public. Share only public links and information you are entitled to share. Never attach personal books, annotations, private reading bundles, credentials or private permission correspondence. A private bundle can contain full texts and all saved records, including quotations from books you did not select for export.

Provide a finished public reader URL; public source and exact revision; chosen maker credit; title, author, language and the actual edition’s translators, illustrators and other contributors; source links and hashes; a short description; rights evidence and proposed territories; code and asset licenses/notices; an approved thumbnail and its provenance; adapter/recovery requirements; and who maintains the reader. If you cannot use GitHub, ask your coding agent to prepare these same public fields for review. This guide does not introduce a second book-preparation workflow: use the existing [agent guide](AGENT-GUIDE.md), [rights guidance](RIGHTS.md) and [adapter decisions](ADAPTERS.md).

Proposing a listing does not grant permission to mirror a book or repository. The accepted destination, audience, attribution and thumbnail use must be explicit. Personal import permission is separate from public distribution. A public-domain title does not establish the status of a particular translation, introduction, image or digitization in every territory. Unresolved rights hold back the affected material; a territory label cannot make unrestricted hosting compliant.

## What is reviewed

Review the actual source and finished reader, using the existing source/fidelity, [design](DESIGN.md), [reader-copyeditor](../skills/reader-copyeditor/SKILL.md) and [reading-experience](AGENT-GUIDE.md#verify-the-reading-experience) procedures. Check source apparatus and notices, usable phone/tablet reading, selection and annotations, quiet mode, useful companion content, honest offline claims, recovery and update continuity. Record the review’s scope and limits; preparation coverage is not full human proofreading. A comfortable reader without a companion is welcome.

Link acceptance is specific to the reviewed revision and destination. Recheck changed or broken readers and record maintenance ownership. Reports about an existing edition can use an ordinary repository issue with its public library link and a description; do not include private records. A withdrawn listing should retain an honest catalogue state and must not delete visitors’ browser records. Changes to a hosted edition require its own review and exact publication inventory.

## Maintaining the catalogue

`showcase/library/entries.json` contains public discovery metadata only. It references the existing examples and their source reviews; it is not a list of arbitrary applications to execute or deploy. The current validator admits exactly the sixteen reviewed hosted examples. Accepting an external contribution requires a deliberate schema and review change, including a clear maker-hosted label, approved local thumbnail, revision and maintenance record. Do not weaken that validator merely to make a submission pass.

The generator renders all sixteen read links and edition disclosures into static HTML. Search, filtering, sorting and modal previews enhance it without an account or upload endpoint. A quiet Continue link appears after this browser saves a place in an exact admitted public edition, including an exact restored copy. Unrecognized or modified editions are excluded.

The local pointer contains only the edition, public work ID and timestamp. The library reads that pointed reader’s existing state and any stored edition locally, then hides the link if the saved place is unavailable. It does not scan other readers, create a missing database, migrate records or send them to analytics. The reader validates the place again on arrival. Companion and game locations never replace the main reading place.

Pointer updates use Web Locks to order saves across tabs; without that API, normal reading saves still work but no new pointer is written. Equal-millisecond saves keep the already-published pointer. The optional module joins each reader’s offline cache. The library itself is not an offline app. Reader URLs, database names, worker scopes and record schemas remain unchanged. The hosted catalogue counts bounded public interactions; [analytics](ANALYTICS.md) explains the separate event labels and exclusions.

After an accepted metadata change, run `node showcase/library/render.mjs` and review the generated HTML. The combined builder also regenerates it deterministically. Update the exact publication inventory and named deployment inputs when adding code or assets, then run the kit tests, relevant browser checks, minimal-input build and public file/history audit. Preserve the original-sample starter’s boundary. See [showcase hosting](../showcase/README.md) for the established destination.

Community code must not be mounted under arbitrary paths on `newreading.app`. Separate worker/cache/database names prevent accidental collisions but do not isolate JavaScript on one origin. Independently trusted applications need isolated origins, or a genuinely constrained data-only runtime. Inspect submitted code and build it in isolation without production credentials. Do not pull contributor updates automatically.

For now, reuse a reviewed application’s source and its specific adapter. The stock text renderer cannot represent every example’s media, tables, notes or shaped text. A future public edition-only package is separate from private backups and must declare compatibility, preserve exact identities and notices, and exclude personal records and executable contributor code. Follow [upgrade continuity](UPGRADING.md) before changing textual identities or origins.
