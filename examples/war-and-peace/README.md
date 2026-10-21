# War and Peace

The complete Louise and Aylmer Maude translation, with Repin's portrait and
eleven scenes from the 1893 illustration album. Read the novel, keep passages,
and open the pictures through the chapters you choose. A picture's source
passage returns you to the same reading place.

This public example derives from reviewed source commit
`40ce940dab021fd09d7103bf0410b854db93cf01`. Its exact text, historical images,
fonts and original icons are pinned in [edition-lock.json](edition-lock.json).
[Source and reuse notes](docs/SOURCE-RIGHTS.md) describe the edition, faithful
scan basis, actual service terms and excluded decorative cover.

With Node 22 or newer:

```sh
npm test
npm run build
npm run dev
```

The preview binds only `127.0.0.1`, at port 4476 by default (`PORT` changes it).
It serves an in-memory snapshot of the exact `dist/` outputs. Stop and restart
after changes. It cannot serve source, Git metadata or private evidence.

Browser checks use Playwright's Chromium and WebKit in fresh isolated contexts:

```sh
npm run test:reader
npm run test:offline
```

Set `PLAYWRIGHT_MODULE`, `CHROMIUM_PATH` or `WEBKIT_PATH` only when using an
external runtime. `QA_ENGINE=chromium` or `QA_ENGINE=webkit` selects one engine.
Each check builds this example and starts its own loopback origin; it does not
use an existing reader's server or records. Receipts and screenshots go to ignored
`test-results/`. The reader checks exact rendering, annotations, source returns,
picture gates, typography and small-screen layout. The offline check stops its
origin and verifies an independent failed-network request before exercising
reading, saving, pictures, a first PNG card and exact-edition bundle recovery.

The catalogue serves this reader at
[newreading.app/war-and-peace/](https://newreading.app/war-and-peace/).
The parent showcase adapts root-relative paths and cache scope for that mount.
The standalone output keeps its own root scope. Do not publish a parent workspace
or a personal reader's files in place of this explicit public package.

Reading records stay in the browser. A private text bundle contains the exact
novel, full source notices and selected saved records. It does not contain the
picture companion or font files; retain a copy of this reader project as well.
Browser storage can be cleared, so keep exports somewhere private. The first-use
source notice is remembered separately and remains available in Text & pictures.
