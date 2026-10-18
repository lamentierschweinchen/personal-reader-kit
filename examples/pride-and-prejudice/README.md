# Pride and Prejudice

A restrained illustrated title page, Thomson’s peacock ornament and a chapter-limited word index.

All 61 chapters plus source front matter, Saintsbury’s preface and 164 unchanged image files from Gutenberg 1342. Image files remain external to private reading bundles: retain the matching app assets when moving a library.

This is a runnable example in [personal-reader-kit](../../README.md), adapted from reviewed trial commit `335de093f27837a3b06219407d5fb9b8792c8274`. Its reading interface, prepared editions and build assets are unchanged by packaging. The original trial history, private preparation and browser captures are not included. [Catalogue and hosting boundary](../README.md).

## Run and verify

From this directory, with Node.js 22 or later:

```sh
PORT=4191 npm run dev
npm test
npm run build
TEST_PORT=4391 npm run test:book
npm run audit:public
```

Choose an unused port and keep it stable for reading. Browser checks require Playwright plus Chromium/WebKit; `PLAYWRIGHT_MODULE`, `CHROME_PATH` and `WEBKIT_PATH` can select an existing runtime. Run suites sequentially because they rebuild the same output. The audit command reviews the entire kit from its root; it needs a full clone and final staged bytes. `npm run check:examples` at the root checks every example and its exact built output. No application dependency installation or account is required.

## Reading, sharing and recovery

Select text, then **Keep or share passage** to annotate, share or copy it with attribution. Personal notes and device URLs are excluded from sharing. Wait for **Available offline** in the browser you will use before disconnecting; cached chapters, included illustrations/companions and saved annotation edits work across an offline reload. External research, source EPUB downloads and delivery by a messaging app can require a connection.

Records belong to this browser/profile and origin. Export private reading bundles and verify restoration before moving domains or clearing storage. These customized edition formats are not interchangeable with the stock kit. Native share delivery, physical iOS selection, screen-reader acceptance, complete proofreading and human newcomer testing remain separate checks.

The source notice appears once per browser/profile for the included edition, including a first visit through a chapter link. **Edition & source** keeps the full notice, licence, credits, original front matter and reading guidance available. Source visits preserve the main reading place. If the browser cannot remember showing the notice, a visible explanation says it may return after a reload; clearing storage or changing browsers can also show it again. The notice preference is separate from reading bundles and never changes the edition.

The repeated 1894 illustration copyright lines are omitted from normal reading; their historical credit is stated once under **Edition & source**. **Original text of this chapter** and full-edition bundles retain every source character. A selection crossing an omitted credit keeps the exact original quotation: the note editor shows that credit and explains its inclusion before saving, copying or sharing. Existing notes remain anchored to the unchanged edition.

## Source and verification evidence

- [Exact edition, credits, source links and rights scope](docs/SOURCE-RIGHTS.md)
- [Fidelity and transformation decisions](docs/FIDELITY.md)
- [What the trial taught the kit](docs/KIT-FEEDBACK.md)
- [Archived original handoff and verification](docs/TRIAL-README.md)

The source catalogues declare public domain in the USA; this is not a worldwide rights warranty. Included notices and attribution remain intact. The software MIT license does not relicense third-party literary or image contributions. Source-edition EPUB links are provided; kit-generated EPUB export and e-reader note synchronization are not implemented.

Public source packaging is authorized for the established kit repository. The public reader is [newreading.app/austen/](https://newreading.app/austen/), built through the [combined showcase](../../showcase/README.md). That builder adapts runtime URLs and storage/cache/install identities while preserving the complete edition bytes. The earlier `austen.lookatseel.com` host redirects network requests to this path.

This directory also builds independently with `npm run build` and output `dist`. Use a separate origin for an unmodified standalone deployment; copying these outputs under a shared origin does not adapt their root asset URLs or storage/cache names. Preserve the chosen address once people have reading records. See the [example catalogue](../README.md) for hosting and verification scope.

The word index starts with whole words at any capitalization. Open **Whole words · any capitalization** for exact capitalization or matches inside longer words. Choose a chapter from the occurrence counts, or page through all results. The index excludes source apparatus and captions; every context visit preserves the reading place.
