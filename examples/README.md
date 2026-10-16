# Four readers, four approaches

These are complete, runnable examples of what an agent can build with the kit. Each starts with faithful reading and takes its visual character from its edition. They are separate applications, with source-aware adapters; they are not four presets for the stock importer.

| Reader | Character and optional companion | Source |
| --- | --- | --- |
| [Pride and Prejudice](pride-and-prejudice/README.md) | An illustrated title page, fine rules and a quiet word index | Austen, Saintsbury and Thomson; [Gutenberg 1342](https://www.gutenberg.org/ebooks/1342) |
| [Alice’s Adventures in Wonderland](alice-in-wonderland/README.md) | An asymmetric Rackham storybook, shaped verse and close looking | Carroll, Dobson and Rackham; [Gutenberg 28885](https://www.gutenberg.org/ebooks/28885) |
| [Walden & Civil Disobedience](walden/README.md) | A field notebook, original pond survey and “Keeping account” | Thoreau; [Gutenberg 205](https://www.gutenberg.org/ebooks/205) |
| [Two lecture halls, one hour](schopenhauer-hegel/README.md) | A university broadside and paired philosophical readings | Hegel/Haldane and Schopenhauer/Saunders; [51635](https://www.gutenberg.org/ebooks/51635), [10731](https://www.gutenberg.org/ebooks/10731) |

## Try one

The public entrance is **[read.lookatseel.com](https://read.lookatseel.com/)**. Canonical readers: [Austen](https://austen.lookatseel.com/), [Alice](https://alice.lookatseel.com/), [Walden](https://walden.lookatseel.com/), [Two lecture halls](https://two-halls.lookatseel.com/). [Release verification](../docs/STATUS.md) distinguishes local checks from confirmed live behavior.

From the repository root, with Node.js 22 or later:

```sh
cd examples/alice-in-wonderland
PORT=4192 npm run dev
```

Open the printed address. No application dependency installation is needed. Use a different port for each reader; browser records and offline caches belong to the origin. The default root `npm run dev` still opens the small original-sample kit. The examples are not included in its build or Vercel upload list.

Each example supports reading, focus, exact passage notes, attributed sharing/copying and an offline copy. Wait for **Available offline** in the browser you will use. Then included reading and companions work across an offline reload, including saving and editing annotations. External research, EPUB downloads and message delivery can require connectivity. Export private reading bundles: browser eviction, clearing data or changing domains can make records unavailable. Austen’s images are separate application assets and must accompany a migration.

## What is public

The user selected these four reviewed editions for this public repository. Only committed source snapshots were packaged; no independent project history, original archive, private intake, personal note, device link or browser capture was copied. [catalog.json](catalog.json) records the source revision, packaging changes, source evidence and exact reviewed build bytes. Runtime modules, edition files and appearance remain identical to the reviewed trials.

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

The existing actual-book Chromium/WebKit journeys are included. Follow each README for commands; browser tests need Playwright and run sequentially within a project. Initial packaging leaves runtime bytes unchanged, so those prior journeys remain relevant; packaging verification is not a new physical-device or live-hosting claim. Actual iOS selection/share delivery, screen-reader acceptance, full proofreading and a human newcomer pilot remain unperformed.

Maintain the published examples here. The source trial commits identify their starting point; do not continually copy entire working directories from a personal project. If accepting a later trial change, review that diff, rerun its journeys, and update only the selected files and evidence. New personal projects use `publication.json.starterFiles`, which excludes this optional collection.

## A showcase and five Vercel projects

Use a small public showcase with four distinct entrances: title, author/edition, a sentence about the experience, **Read**, and **View source / make your own**. A short note can explain offline reading and browser-local annotations. The [showcase source](../showcase/README.md) borrows the personal-site theme at the user’s request. Separate presentation/video work is independent.

Connect this same repository to four Vercel projects, selecting one `examples/<reader>` directory as each project’s **Root Directory**, with `npm run build` and output `dist`. A fifth project can host the showcase. [Vercel’s monorepo documentation](https://vercel.com/docs/monorepos) describes this arrangement. These configuration files do not themselves create accounts or projects. The release status records the approved hosting setup.

Give each reader a separate canonical origin, such as `austen.your-domain`, `alice.your-domain`, `walden.your-domain` and `two-halls.your-domain`. A shared showcase can live at `shelf.your-domain`. Separate repository folders do **not** make `/alice/` and `/walden/` safe on one deployed origin: these readers use root asset URLs, the same database name and cache prefix. Follow [the hosting and migration guidance](../docs/DEPLOYMENT.md#hosting-several-customized-readers).

Before public launch, choose the canonical domains, review the final source notices and hosting audience, and verify each live site’s deployed bytes, offline reload, annotation persistence and recovery. Preserve the existing noindex defaults until an intentional indexing decision. A website launch and a public source release are separate events.
