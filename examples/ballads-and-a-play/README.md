# Ballads and a play

Five complete ballads by Goethe, Bürger and Schiller, followed by Goethe’s complete *Iphigenie auf Tauris*, in German and historical English. The two languages keep independent passages and reading records. Whole stanzas and speaker turns provide counterpart navigation. Optional notes connect the Handschuh ending with its earlier variant and Iphigenie III.3 with Kauffmann’s drawing.

This is the owner-approved public copy for [newreading.app/ballads](https://newreading.app/ballads/), prepared from local source commit `e5d909ade3d28ef84bf5c359291596b243dee163`. The independent source repository and private evidence remain local. Read [the complete source/rights record](docs/SOURCE-RIGHTS.md); source-specific licenses and territorial qualifications are distinct from publication authorization and the code’s MIT license.

```sh
npm test
npm run build
npm run dev
```

The loopback preview defaults to `http://127.0.0.1:4531/`; set `PORT` to choose another unused port. It builds first, then serves an immutable in-memory snapshot of the exact output inventory. It does not expose this checkout, edition files, tests, private records or arbitrary dist additions. [Sources](site/sources/index.html) is also built at `/sources/` and travels in the offline cache.

The custom builder validates every locked input, all twelve complete edition objects, canonical identities, source anchors and library identity **before replacing dist**. `edition-lock.json` pins the reviewed public runtime and exact source files; `docs/EDITION-INVENTORY.json` records input/output and provenance inventories. A failed pin or symlink check preserves existing output. Updating a lock requires source and editorial review; regenerating hashes alone does not approve a change.

All twelve `edition/*.json` files preserve their accepted preparation bytes exactly. Their source notices and complete Gutenberg license survive exact exports and private reading bundles. Status-only wording uses verified presentation overrides. Quotation sharing retains the four Wikisource editions’ contributor/license/source routes; the Gutenberg-associated English drama includes its required sentence and full-license URI. Oversized image attribution is refused honestly; text and exact-edition exports remain available. A verified unchanged Swanwick edition receives a remembered first-use source notice, with recoverable full terms in Sources.

Tests use the original MIT sample writing only as synthetic fixtures. Historical editions are excluded from the reusable starter. No raw archive, scan image, private note, device link, credential, research record or browser capture is part of this package. The original three PNG application icons and SVG are unchanged contemporary code artwork, separately pinned. No font binary is included.

Source collation and automated browser checks do not establish human scholarly proofreading, physical-device or assistive-technology acceptance. The final mounted catalogue, public inventory/history audit and deployment are coordinated separately.

Public runtime follow-up: modal excursions retain a transient exact source-character offset across rotation and type reflow; occupied reading chrome is bounded to the viewport. Saved block/ratio records, edition bytes, notes and deliberate navigation keep their existing contracts.
