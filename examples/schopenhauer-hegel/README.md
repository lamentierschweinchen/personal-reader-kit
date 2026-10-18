# Two lecture halls, one hour

A university broadside with equal doorways and three paired readings across the corridor.

Complete supplied English editions from Gutenberg 51635 and 10731: Hegel’s History of Philosophy volume 1 (of 3), translated by E. S. Haldane, and Schopenhauer’s Art of Controversy with essays, translated by T. Bailey Saunders. The paired readings are editorial comparisons, not reconstructed 1820 lecture transcripts. Saunders’s disclosed omissions remain part of this edition.

This is a runnable example in [personal-reader-kit](../../README.md), adapted from reviewed trial commit `6b160fad13729f07808248be3071a6e33afb3a80`. Its reading interface, prepared editions and build assets are unchanged by packaging. The original trial history, private preparation and browser captures are not included. [Catalogue and hosting boundary](../README.md).

Each paired reading now offers two optional landmarks within the complete source passages. Choose **Follow the argument** to mark and visit the corresponding phrases in both halls; keep an individual marked passage or save the complete pair with a reflection. Source and orientation details remain available beside each reading. Independent text positions survive hall changes, rotation and type-size changes.

## Run and verify

From this directory, with Node.js 22 or later:

```sh
PORT=4194 npm run dev
npm test
npm run build
TEST_PORT=4394 npm run test:browser
TEST_PORT=4394 npm run test:share
npm run audit:public
```

Choose an unused port and keep it stable for reading. Browser checks require Playwright plus Chromium/WebKit; `PLAYWRIGHT_MODULE`, `CHROME_PATH` and `WEBKIT_PATH` can select an existing runtime. Run suites sequentially because they rebuild the same output. The audit command reviews the entire kit from its root; it needs a full clone and final staged bytes. `npm run check:examples` at the root checks every example and its exact built output. No application dependency installation or account is required.

## Reading, sharing and recovery

Select text, then **Keep or share passage** to annotate, share or copy it with attribution. Personal notes and device URLs are excluded from sharing. Wait for **Available offline** in the browser you will use before disconnecting; cached chapters, included illustrations/companions and saved annotation edits work across an offline reload. External research, source EPUB downloads and delivery by a messaging app can require a connection.

Records belong to this browser/profile and origin. Export private reading bundles and verify restoration before moving domains or clearing storage. These customized edition formats are not interchangeable with the stock kit. Native share delivery, physical iOS selection, screen-reader acceptance, complete proofreading and human newcomer testing remain separate checks.

## Source and verification evidence

- [Exact edition, credits, source links and rights scope](docs/SOURCE-RIGHTS.md)
- [Fidelity and transformation decisions](docs/FIDELITY.md)
- [What the trial taught the kit](docs/KIT-FEEDBACK.md)
- [Archived original handoff and verification](docs/TRIAL-README.md)

The source catalogues declare public domain in the USA; this is not a worldwide rights warranty. Included notices and attribution remain intact. The software MIT license does not relicense third-party literary or image contributions. Source-edition EPUB links are provided; kit-generated EPUB export and e-reader note synchronization are not implemented.

Public source packaging is authorized for the established kit repository. The public reader is [newreading.app/two-halls/](https://newreading.app/two-halls/), built through the [combined showcase](../../showcase/README.md). That builder adapts runtime URLs and storage/cache/install identities while preserving the complete edition bytes. The earlier `two-halls.lookatseel.com` host redirects network requests to this path.

This directory also builds independently with `npm run build` and output `dist`. Use a separate origin for an unmodified standalone deployment; copying these outputs under a shared origin does not adapt their root asset URLs or storage/cache names. Preserve the chosen address once people have reading records. See the [example catalogue](../README.md) for hosting and verification scope.
