# A kingdom for a stage

Three complete Shakespeare plays in order: **Julius Caesar → Henry V → The Tempest**, in the Folger editions edited by Barbara A. Mowat and Paul Werstine. Read first; optional passage context connects the crowd, the campaign and the imagined island with their different histories. The Tempest includes a precise Gonzalo/Florio comparison and Watson’s later Miranda engraving.

The owner approved this exact free, noncommercial reader for **[newreading.app/shakespeare/](https://newreading.app/shakespeare/)** and a reviewed source copy in the public reader-kit repository. This package derives from source commit `6a10bd6d126422b46a7fdad709bacda531c0a9f4`. Catalogue integration and publication are recorded by the coordinator; a package build is not a claim that a release has deployed.

**The Folger edited/encoded texts and their supplied source matter are CC BY-NC 3.0 Unported, not public domain or MIT.** Reader code and original samples use MIT; the Met Miranda image is separately CC0. See [source and rights](docs/SOURCE-RIGHTS.md), [the portable source page](sources/index.html), [the license](LICENSE) and [exact inventory](docs/EDITION-INVENTORY.json). No raw source archives, provider software, private records or review captures are included.

## Build and check

Node 22 or later; no build dependencies.

```sh
npm test
npm run build
npm run dev
```

The loopback preview uses `127.0.0.1:4542` by default; `PORT` can select another local test port. The public builder verifies all pinned inputs, the complete three-book objects, source notices, embedded image and original icons before replacing only `dist/`. Unknown files are not copied. The server freezes the explicit build outputs in memory and cannot expose arbitrary files from this directory. The sources page is available at `/sources/` and is included in the offline cache.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright CHROMIUM_EXECUTABLE=/absolute/path/to/chromium WEBKIT_EXECUTABLE=/absolute/path/to/pw_run.sh npm run test:reader
```

Browser evidence belongs in ignored `test-results/`. Tests use disposable contexts/origins, exact reading and source notices, semantic stage cues, first-line emphasis/highlights, image decoding, exact bundle restoration and a stopped-origin reload. Desktop browser engines do not establish physical-device or assistive-technology acceptance.

## Exact edition boundary

Seventeen of the 18 reviewed site assets retain the source revision’s bytes. The only runtime delta is a quiet **Sources & credits** footer link to the source page. The three prepared JSON files have only been renamed under `edition/`; their bytes and source IDs are unchanged. `samples/` contains original fictional fixtures for source-free regression tests and never enters the public library. The replacement build/serve scripts, source page and public packaging documents are this package’s integration layer.

`build()` exports its explicit `assets`, `editionFiles`, `outputFiles` and `buildInputs` for the catalogue coordinator. The standalone worker uses its own cache prefix; catalogue mounting separately namespaces paths, storage and workers. The independent source repository and its raw preparation remain local. Changes to an edition require separate review and new pins; differing stored copies and their notes must remain recoverable.

Public runtime follow-up: modal excursions retain a transient exact source-character offset across rotation and type reflow; occupied reading chrome is bounded to the viewport. Saved block/ratio records, edition bytes, notes and deliberate navigation keep their existing contracts.
Long credit URLs wrap within the enlarged image caption and the Sources page on phones.
