# Alice’s Adventures in Wonderland

Rackham’s drawings, an asymmetric storybook entrance and a close-looking companion. Portrait, tale/tail and Cat studies connect specific visual choices with exact passages; the complete permitted picture collection follows in chapter order.

The complete twelve-chapter Carroll/Rackham edition with Dobson’s proem, 19 sections and 38 embedded images from Gutenberg 28885. Source tail-verse and uniform-type views preserve the words and anchors.

This is a runnable example in [personal-reader-kit](../../README.md), adapted from reviewed trial commit `5a6b643134e885e8ac9a6688aed05767d5eac8b7`. Its reading interface, prepared editions and build assets are unchanged by packaging. The original trial history, private preparation and browser captures are not included. [Catalogue and hosting boundary](../README.md).

## Run and verify

From this directory, with Node.js 22 or later:

```sh
PORT=4192 npm run dev
npm test
npm run build
TEST_PORT=4392 npm run test:browser
TEST_PORT=4392 npm run test:share
npm run audit:public
```

Choose an unused port and keep it stable for reading. Browser checks require Playwright plus Chromium/WebKit; `PLAYWRIGHT_MODULE`, `CHROME_PATH` and `WEBKIT_PATH` can select an existing runtime. Run suites sequentially because they rebuild the same output. The audit command reviews the entire kit from its root; it needs a full clone and final staged bytes. `npm run check:examples` at the root checks every example and its exact built output. No application dependency installation or account is required.

## Reading, sharing and recovery

Select text, then **Keep or share passage** to annotate, share or copy it with attribution. Personal notes and device URLs are excluded from sharing. Wait for **Available offline** in the browser you will use before disconnecting; cached chapters, included illustrations/companions and saved annotation edits work across an offline reload. External research, source EPUB downloads and delivery by a messaging app can require a connection.

Records belong to this browser/profile and origin. Export private reading bundles and verify restoration before moving domains or clearing storage. These customized edition formats are not interchangeable with the stock kit. Native share delivery, physical iOS selection, screen-reader acceptance, complete proofreading and human newcomer testing remain separate checks.

## Source and verification evidence

- [Exact edition, credits, source links and rights scope](docs/SOURCE-AND-RIGHTS.md)
- [Fidelity and transformation decisions](docs/FIDELITY.md)
- [What the trial taught the kit](docs/KIT-FEEDBACK.md)
- [Archived original handoff and verification](docs/TRIAL-README.md)

The source catalogues declare public domain in the USA; this is not a worldwide rights warranty. Included notices and attribution remain intact. The software MIT license does not relicense third-party literary or image contributions. Source-edition EPUB links are provided; kit-generated EPUB export and e-reader note synchronization are not implemented.

Public source packaging is authorized for the established kit repository. The public reader is [newreading.app/alice/](https://newreading.app/alice/), built through the [combined showcase](../../showcase/README.md). That builder adapts runtime URLs and storage/cache/install identities while preserving the complete edition bytes. The earlier `alice.lookatseel.com` host redirects network requests to this path.

This directory also builds independently with `npm run build` and output `dist`. Use a separate origin for an unmodified standalone deployment; copying these outputs under a shared origin does not adapt their root asset URLs or storage/cache names. Preserve the chosen address once people have reading records. See the [example catalogue](../README.md) for hosting and verification scope.
