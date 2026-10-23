# The Fall of the House of Usher

Edgar Allan Poe’s complete 1845 story, with two illustrations and four film/music encounters. The story reads continuously; its six verse stanzas, emphasis and original note remain intact. Illustration and search visits preserve the main reading place. Ending material requires an explicit reveal. External films and music open only on request; no recording is hosted or loaded automatically.

This packaged candidate preserves the reviewed text, art and font bytes from source commit `3dc8c10aff69c9073022637c8f451a0d8c019b3a`. Publication and live verification are recorded by the catalogue’s release coordinator; a successful local build is not a deployment receipt.

```sh
npm test
npm run build
npm run dev
npm run test:reader
npm run test:cards
```

The fixed `dist/` build uses only explicit inputs, validates all nine asset pins before replacing output, and includes the original icons and full font licence. `edition-lock.json` and [the asset inventory](docs/EDITION-INVENTORY.json) name the exact admitted files. Private source archives, preparation and browser records are not part of this package. The original source project remains separate.

Selection supports exact passage keeping, plain-text sharing and quotation cards. Cards carry selected source text and attribution, never private notes. Settings exports records and private reading bundles. Browser storage is tied to the address and may be cleared; a saved offline copy is not a backup. Images are part of the website’s offline cache, not embedded in its text-only reading bundle.

Read [source and rights](docs/SOURCE-RIGHTS.md), [text decisions](docs/SOURCES.md), [illustration provenance](docs/ART-SOURCES.md) and [Home Screen artwork](docs/HOME-SCREEN.md). Code is MIT; third-party contributions retain their separate terms. No global rights warranty is claimed.

Browser tests use disposable profiles and loopback servers; `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `WEBKIT_PATH`, `TEST_PORT` and `QA_ENGINE` select the available runtime. Outputs remain ignored in `test-results/`. Engine and emulated-viewport checks do not establish physical-device gestures, native share-sheet behavior or a human reader’s editorial acceptance.
