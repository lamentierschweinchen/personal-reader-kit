# At Table adapter

`at-table/illustrated@1` extends the kit’s text contract for this collection. Stock text editions still validate unchanged. Other profiles and unsupported fields fail explicitly.

During the source project's local preparation, a Python adapter read three pinned HTML documents and their archives from ignored inputs. The preparer and raw inputs are excluded from this public copy. It traversed every body element, retained all text, source order, emphasis, explicit breaks and indents, and relocated the digital header/footer credits and licence to a quiet final source section. Ordinary HTML whitespace reflows; source alignment using nonbreaking spaces and explicit breaks remains fixed and horizontally scrollable. Ordinary 2% and 5% inset prose retains its literal source characters and lineation in the edition/export, reflows visually by default and offers its source lines in Settings. The wrapping option for aligned verse/tables is separate. Two unusually indented source forms retain their literal lines. Structural block separators are explicit two-newline strings. These are conversion decisions, not facsimile reproduction.

All selected digital content remains included. Beeton’s textual illustration descriptions cannot supply the engravings absent from the package. A separate 1861 scan was located and its title page inspected; it is a possible future supplement only after full witness/placement matching. No later expanded Beeton edition, invented illustration or generated reconstruction has been substituted.

The profile adds:

- `image` blocks with self-contained JPEG bytes, SHA-256, decoded dimensions and accessible descriptions. Decoded-byte hashes and JPEG dimensions are validated synchronously, including cached inputs; malformed/missing payloads fail. These assets travel in book and collection exports.
- An `initial` asset for the text-bearing ornamental first letter. The literary string contains one selectable T; the source JPEG paints that same character’s span. Its letters are neither missing nor duplicated in selection, export or quotation.
- A `table` block for the two actual single-column source tables. Row order and breaks are retained. This is not a general table-span implementation.
- `links` with exact source text offsets and validated section/block targets. Source contents and page-index references open a context excursion without adopting the destination as the main place.
- `inset` values restricted to the source’s 0%, 2% and 5% paragraph insets.

Use this matching application revision with exports. Schema 1 alone does not make the illustrated editions compatible with the stock kit. The exact prepared bytes and private bundle must be retained for recovery. `source.sha256` identifies the downloaded HTML witness; complete prepared-file hashes are separately recorded in the fidelity receipt.

The packaged `build()` reads `edition/library.json`, verifies its byte hash against `edition/manifest.json`, and returns its exact flat output files. `build({shell:true})` retains the original-sample build. `build({output})` can isolate verification output. During the source project's local trial, an isolated publication unit check guarded the served `dist/`; that private trial check is not included in this selected copy. The enclosing kit owns the exact public-file inventory and publication review. Newsreader normal and real italic, plus the full OFL notice, are explicit build/offline assets; see [font provenance](FONTS.md).

The standalone packaged reader uses root-relative application modules, `/library.json`, `/table.svg`, `/icon.svg`, `/manifest.webmanifest` and `/sw.js`. IndexedDB is `at-table-v1`; worker caches use `at-table-` plus a content fingerprint. Combined hosting adapts these explicitly for the canonical mount while preserving the prepared edition bytes.

Verification separates character conservation, selected rendered checks and editorial acceptance. Original fixtures remain regression evidence; the actual-edition journey covers the initial, image portability, exact section text, source links, annotations, independent places, the studies, type controls and outage reload. Physical devices, assistive technology and word-by-word proofreading remain separate.
