# Caesar and the emperors

Complete *Gallic War* VII, all 35 sections of the *Res Gestae* with its inscribed preamble and separate later Summary, and complete *Meditations* II–III. English opens first; Latin and Greek are available at the same numbered chapter. The optional readings include complete Catiline 51, Annals I.2–4, two Pliny–Trajan exchanges, two historical siege plans and three Pliny facsimile pages.

The owner approved this selected public copy for **https://newreading.app/rome/** on October 24, 2026. Its source is the independently reviewed local reader commit `1739dcae5c975ac3297f3f8cbcc7b43f0ac53a88`. All nine portable edition files retain their exact reviewed bytes, source IDs, apparatus and embedded images. No private records, raw archives or source repository history are included. See [sources and rights](docs/SOURCE-RIGHTS.md) and the [exact inventory](docs/EDITION-INVENTORY.json).

```sh
npm test
npm run build
npm run dev
```

Node 22 or later; no build dependencies. The loopback preview defaults to `127.0.0.1:4495`. Every approved runtime, source-page and edition input is pinned in `edition-lock.json` and validated before replacing `dist/`. The server holds only the explicit built outputs in memory. Both `/sources/` and `/sources/index.html` serve the notices; the worker also handles directory navigation after a stopped-origin reload. The catalogue coordinator supplies the final path, database and cache namespaces.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright CHROMIUM_EXECUTABLE=/absolute/path/to/chromium WEBKIT_EXECUTABLE=/absolute/path/to/pw_run.sh npm run test:reader
```

Browser evidence defaults to ignored `test-results/roman/`; `ROMAN_REPORT` can select another private directory. The actual-edition journey covers all 326 sections, source marks/images, source-note and companion visits, selection/save/reload/failure, exact-bundle restoration with the library unavailable, and stopped-origin reading and source notices in Chromium and WebKit. Browser automation does not establish physical-device, native-share delivery or assistive-technology acceptance.

The public copy adds a quiet footer Sources & credits link, wraps long source-page addresses, and scales the title on the narrowest phones to fit wider fallback fonts. Its reading code, edition data and saved-record formats retain their reviewed bytes. The public builder replaces private preparation with exact pins; tests use the public edition paths and original fictional fixtures. The code/schema and independent original commentary use MIT. Perseus transcriptions retain CC BY-SA 4.0, and historical text/image contributions retain their own rights. Exact exports preserve archival metadata; current territorial-review wording is presented separately for verified snapshots. Changed editions require a new reviewed lock; saved copies and annotations are never silently rewritten.
