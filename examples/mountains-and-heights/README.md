# Mountains and heights

W. Martin Conway’s complete *The Alps* (1904), with A. D. McCormick’s seventy colour plates. Read the twelve chapters, enlarge any plate, or open the optional Snow and rock, Pallanza and Chillon studies. Notes and reading places stay in the browser; private bundles carry the complete illustrated edition and saved records.

```sh
npm test
npm run build
npm run dev
# http://127.0.0.1:4572/
```

`npm run build` creates the exact reviewed standalone reader in ignored `dist/`. It uses only named software assets and the pinned `edition/library.json` and `edition/experience.json`; no source-project preparation or browser records are needed. Run `PLAYWRIGHT_MODULE=/path/to/playwright/index.js npm run test:reader` after building. `npm run test:design` covers the three studies and responsive layouts; `npm run test:notice` covers first-use notices and fallback guards. `npm run test:first-load` delays the complete illustrated library beyond eight seconds and verifies that fresh readers still open it. `CHROME_PATH`, `WEBKIT_PATH`, `TEST_PORT` and `REVIEW_OUTPUT` may select installed browsers, isolated loopback ports and ignored evidence output.

This example is the public maintenance copy selected from source revision `ae78483dee45db2e8b77ce2789c13648ad66c2d2`. The catalogue route is `/mountains/`; the combined-site adapter supplies that route and isolates its worker and records. This standalone build uses its origin root. Moving to another origin does not automatically transfer existing browser records: export a private bundle first and restore it in the matching illustrated reader.

The original source object, including metadata, all image payloads and full Gutenberg notice, is preserved exactly. Publication wording is a presentation layer; it does not rewrite old exported books. The `mountains/illustrated@1` format is deliberately local to this application: the stock text-only starter cannot restore its images. Keep this matching software with a backup. The companion configuration belongs to the application rather than the portable edition.

See [source and rights](docs/SOURCE-RIGHTS.md), [fidelity and adapter](docs/SOURCE-ADAPTER.md), [asset inventory](docs/EDITION-INVENTORY.json) and [Home Screen icons and fonts](docs/APP-ICONS.md). No new full print proofreading, physical-device installation or screen-reader acceptance is claimed. Offline availability must first be checked from the address used for reading; browser storage is not a backup.
