# Four readers, four approaches

These are complete, runnable examples of what an agent can build with the kit. Each starts with faithful reading and takes its visual character from its edition. They are separate applications, with source-aware adapters; they are not four presets for the stock importer.

| Reader | Character and optional companion | Source |
| --- | --- | --- |
| [Pride and Prejudice](pride-and-prejudice/README.md) | An illustrated title page, fine rules and a quiet word index | Austen, Saintsbury and Thomson; [Gutenberg 1342](https://www.gutenberg.org/ebooks/1342) |
| [Alice’s Adventures in Wonderland](alice-in-wonderland/README.md) | An asymmetric Rackham storybook, shaped verse and close looking | Carroll, Dobson and Rackham; [Gutenberg 28885](https://www.gutenberg.org/ebooks/28885) |
| [Walden & Civil Disobedience](walden/README.md) | A field notebook, original pond survey and “Keeping account” | Thoreau; [Gutenberg 205](https://www.gutenberg.org/ebooks/205) |
| [Two lecture halls, one hour](schopenhauer-hegel/README.md) | A university broadside and paired philosophical readings | Hegel/Haldane and Schopenhauer/Saunders; [51635](https://www.gutenberg.org/ebooks/51635), [10731](https://www.gutenberg.org/ebooks/10731) |

## Try one

The public entrance is **[newreading.app](https://newreading.app/)**. Canonical readers: [Austen](https://newreading.app/austen/), [Alice](https://newreading.app/alice/), [Walden](https://newreading.app/walden/), [Two lecture halls](https://newreading.app/two-halls/). [Release verification](../docs/STATUS.md) distinguishes local checks from confirmed live behavior.

From the repository root, with Node.js 22 or later:

```sh
cd examples/alice-in-wonderland
PORT=4192 npm run dev
```

Open the printed address. No application dependency installation is needed. Use a different port for each reader; browser records and offline caches belong to the origin. The default root `npm run dev` still opens the small original-sample kit. The examples are not included in its build or Vercel upload list.

Each example supports reading, focus, exact passage notes, attributed sharing/copying and an offline copy. Wait for **Available offline** in the browser you will use. Then included reading and companions work across an offline reload, including saving and editing annotations. External research, EPUB downloads and message delivery can require connectivity. Export private reading bundles: browser eviction, clearing data or changing domains can make records unavailable. Austen’s images are separate application assets and must accompany a migration.

## What is public

The user selected these four reviewed editions for this public repository. Only committed source snapshots were packaged; no independent project history, original archive, private intake, personal note, device link or browser capture was copied. [catalog.json](catalog.json) records the source revision, packaging changes, source evidence and exact reviewed build bytes. Those snapshots establish the initial editions and designs. Later reviewed maintenance is listed in `maintenanceChanges`, with updated exact build bytes; it does not silently replace the source snapshots or their rights evidence.

Each example retains its edition-specific rights, fidelity and builder-feedback documents. The catalogue declarations establish **public domain in the USA**, not worldwide clearance. Translations, prefaces, illustrations, publisher devices and required notices are part of that review. Code and original samples use MIT; third-party editions retain their own source terms. The examples are free independent adaptations, without source-provider endorsement. Consult [the rights guide](../docs/RIGHTS.md) before redistributing in a different territory or context.

Copied trial documents and legacy audit modules record how the independent readers were built. Their old statements about local-only publication describe that historical trial. The current READMEs and enclosing kit instructions govern these packaged copies. All `audit:*` package commands now use the enclosing kit’s complete file/history audit. Keep source archives outside public Git; adapter scripts need separately downloaded exact inputs, while normal builds use the prepared editions already supplied.

## Verify and maintain

At the kit root:

```sh
npm test
npm run build
npm run check:examples
npm run audit:public
```

`check:examples` runs each example’s Node checks and build, then compares **every output byte** with its reviewed build inventory. The build gates validate the edition-specific external or decoded embedded images. The public audit pins all edition files, including binary and base64-bearing JSON, in working files, index and complete locally reachable history. Changed assets need a deliberate provenance review and updated exact hashes. No binary directory is broadly permitted.

The existing actual-book Chromium/WebKit journeys are included. Follow each README for commands; browser tests need Playwright and run sequentially within a project. Initial packaging left runtime bytes unchanged. Later maintenance runs the changed edition’s relevant journeys and updates the catalogue’s exact build inventory. Packaging verification alone is not a new physical-device or live-hosting claim. Actual iOS selection/share delivery, screen-reader acceptance, full proofreading and a human newcomer pilot remain unperformed.

Before shipping authored UI or companion prose, follow the enclosing [reader-copyeditor skill](../skills/reader-copyeditor/SKILL.md). Review active routes and fallback states, protect source text and credits, and preserve each edition’s voice. Mechanical integrity checks do not establish good prose.

Maintain the published examples here. The source trial commits identify their starting point; do not continually copy entire working directories from a personal project. If accepting a later trial change, review that diff, rerun its journeys, and update only the selected files and evidence. New personal projects use `publication.json.starterFiles`, which excludes this optional collection.

## One catalogue, four reader paths

[newreading.app](https://newreading.app/) is built by the [showcase](../showcase/README.md) with all four readers at `/austen/`, `/alice/`, `/walden/` and `/two-halls/`. It uses one Vercel project with `showcase` as the Root Directory. The existing `read.lookatseel.com` address remains available. The earlier book subdomains redirect network requests to the corresponding new paths.

The combined builder checks each complete standalone output against this catalogue before adapting explicit asset URLs, database names, worker/cache scopes and install identities. Edition JSON and illustrations stay byte-identical. These namespaces prevent accidental collisions, not access by other code on the same origin. All four applications share the same trusted publisher. Do not generalize this packaging to arbitrary readers without reviewing and testing their adapters.

Each example can still be built independently with `npm run build` and output `dist`. Unmodified standalone builds need separate origins: their root URLs, database names and cache prefixes collide if their folders are simply copied under one address. The old-host redirect rules apply only to the four named `lookatseel.com` book hosts, so a new owner's deployment is unaffected. See [hosting and migration guidance](../docs/DEPLOYMENT.md#hosting-several-customized-readers).

The user chose a clean launch for these unshared examples. Existing offline installations can retain an older cached app; open the new reader address and install it from there. General personal-library moves still require exact-edition backups and restore verification. Before travel, wait for **Available offline** in the browser or installed app you will use, then test a reload and a saved note without connectivity. See [release evidence and limits](../docs/STATUS.md).
