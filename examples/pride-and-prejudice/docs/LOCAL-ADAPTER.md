# Project-local illustrated book contract

This project extends the kit v0.4.0 schema-1 contract in a bounded way. It is not an upstream format release. Unknown fields still fail; `html` and `image` remain rejected. Keep this source version when restoring its private bundles.

Text blocks may include `styles` from a closed list, `figures`, `initial`, `links`, and `table`. Figures contain a same-origin `/austen-…jpg|png` path, SHA-256, original dimensions/alternative text, and a position in the block. An initial also declares the selectable character range represented by its original image. No remote image URL, script, stylesheet or raw HTML is admitted. Table metadata contains a known group ID, row/column index and colspan. Internal textual links name an existing section/block/offset; external source links must be HTTPS.

The build checks the pinned edition inventory and exact image/library hashes before copying its explicit file set. The runtime renderer creates known elements and never interprets source markup. Context views retain figures/tables; clipped quotations retain text and emphasis and deliberately omit out-of-range artwork. Full context remains available.

The source preparer requires Python with lxml and Pillow; the already-prepared application needs only Node 22+ and no dependency installation. To reproduce, retain the raw ZIP at `.reader/private/source/pg1342-h.zip` and run `python3 scripts/prepare-austen.py`. A source hash mismatch requires a new inspection. Re-run fidelity/browser checks, review `edition/inventory.json`, then pin its new hash in `publication.json`. Do not silently upgrade a prepared edition whose notes already exist.

The original-sample fixture build is selected only by `READER_FIXTURES=1` on the local development server. The standard build always uses the reviewed Austen edition. Browser regression tests use port 4291; the optional review preview uses 4191. Both serve only the flat, explicit `dist` directory, never `.reader` or the repository root.
