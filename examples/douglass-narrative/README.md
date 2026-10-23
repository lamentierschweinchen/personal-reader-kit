# Frederick Douglass — Narrative

The complete 1845 *Narrative*, with its front and back matter, source notes and five original source figures. Three optional historical documents open beside the reading: Bingham’s complete 1817 dialogue, Douglass’s complete 1881 escape chapter, and Sections 3–4 of the 1793 federal act. Reading, notes, exact passage selection, full-bundle recovery and offline reading remain browser-local.

The owner approved this public package on 23 October 2026 for **https://newreading.app/douglass/**. It preserves the reviewed personal-reader revision `f33475ec50181f05193661a1f7d38ff3a7f7c64b`; this directory contains no owner records or raw source archives. See [source and rights](docs/SOURCE-RIGHTS.md) and the [exact inventory](docs/EDITION-INVENTORY.json). The code’s MIT licence does not license the historical sources or provider materials.

## Build and check

Node 22 or later; no build dependencies.

```sh
npm run build
npm test
npm run dev
```

The local server listens on `127.0.0.1:4483`. `build()` and its explicit `assets`/`outputFiles` exports support the catalogue mount. It verifies every approved site and edition input before replacing `dist/`. `edition-lock.json` pins the four books, generated binding, independent excerpt selection and original JPEG. Unknown files are never copied. `.vercelignore` lists the same build inputs for both example-root and repository-root evaluation. The standalone worker caches only explicit outputs; the catalogue applies its existing path, cache and database namespaces. Noindex remains in the original reader HTML; the public catalogue supplies discovery.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright CHROME_PATH=/absolute/path/to/chromium WEBKIT_PATH=/absolute/path/to/pw_run.sh npm run test:reader
npm run test:document
```

Browser outputs default to ignored `test-results/`; `DOUGLASS_REPORT` and `DOUGLASS_PREVIEW` can select another evidence directory and immutable built snapshot. The real-reader suite checks exact rendered text/emphasis, source figures/notes, selection and recovery, historical-document focus and reading-place return, four viewport widths, 36px type, missing-library restoration and stopped-origin offline use in Chromium and WebKit. The document-profile suite uses synthetic fixtures. These are automated desktop engines, not physical-device proof.

## Adaptation boundary

All 20 shipped site files retain the reviewed bytes, including the generated exact-edition binding. The public builder replaces the private preparation/build pipeline with pinned input verification. The original prepared JSON files have only been renamed to public `.json` paths; their bytes, book/source IDs and recoverable notices are unchanged. `portrait.jpg` repeats the exact embedded frontispiece bytes for the catalogue cover. Browser-test paths now use `dist/`, `edition/escape-editorial.json` and ignored reports; five proof/race tests remain from the private integration harness, with separate public packaging tests replacing its private-input builder test.

This package does not claim that the 1881 account was available to readers in 1845. The older preparation notices inside immutable portable editions record source-review limits; the owner’s current publication authorization is recorded above, separately from provider copyright statements. Changes to a source or bound object require a newly reviewed revision and lock, never an in-place claim that existing annotations still describe identical text.
