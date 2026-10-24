# Twenty readers and three small games

These are complete, runnable examples of what an agent can build with the kit. Each starts with faithful reading and takes its visual character from its edition. They are separate applications, with source-aware adapters; they are not presets for the stock importer.

| Reader | Character and optional companion | Source |
| --- | --- | --- |
| [Pride and Prejudice](pride-and-prejudice/README.md) | An illustrated title page, fine rules and a quiet word index | Austen, Saintsbury and Thomson; [Gutenberg 1342](https://www.gutenberg.org/ebooks/1342) |
| [Alice’s Adventures in Wonderland](alice-in-wonderland/README.md) | An asymmetric Rackham storybook, shaped verse, close looking and Tea at Six | Carroll, Dobson and Rackham; [Gutenberg 28885](https://www.gutenberg.org/ebooks/28885) |
| [Walden & Civil Disobedience](walden/README.md) | A field notebook, original pond survey and “Keeping account” | Thoreau; [Gutenberg 205](https://www.gutenberg.org/ebooks/205) |
| [Two lecture halls, one hour](schopenhauer-hegel/README.md) | A university broadside and paired philosophical readings | Hegel/Haldane and Schopenhauer/Saunders; [51635](https://www.gutenberg.org/ebooks/51635), [10731](https://www.gutenberg.org/ebooks/10731) |
| [The Odyssey](odyssey/README.md) | Sea-green type, complete Butler translation and Homeward | Homer/Butler/Jones; [1727](https://www.gutenberg.org/ebooks/1727) |
| [Dracula](dracula/README.md) | Warm paper, journal forms and Castle escape | Stoker; [345](https://www.gutenberg.org/ebooks/345) |
| [At Table](at-table/README.md) | A cream-and-red place setting, three ingredient comparisons and a cook’s authorship | Brillat-Savarin/Robinson, Beeton and Estes; [5434](https://www.gutenberg.org/ebooks/5434), [10136](https://www.gutenberg.org/ebooks/10136), [18435](https://www.gutenberg.org/ebooks/18435) |
| [The Inward Life](inward-life/README.md) | Violet and gold, three doors into spiritual experience and the voices behind the English texts | Julian/Warrack, Tagore and James; [52958](https://www.gutenberg.org/ebooks/52958), [6842](https://www.gutenberg.org/ebooks/6842), [621](https://www.gutenberg.org/ebooks/621) |
| [What Can Music Say?](music-and-feeling/README.md) | A spare listening room and two judgments of Beethoven’s Ninth | Hanslick/Cohen, 1891-dated scan; Tolstoy/Maude, [64908](https://www.gutenberg.org/ebooks/64908) |
| [Learning to See](learning-to-see/README.md) | Two olive branches, complete source plates and an adjustable repeating sprig | Ruskin and Crane; [30325](https://www.gutenberg.org/ebooks/30325), [25290](https://www.gutenberg.org/ebooks/25290) |
| [Beside the Bed](beside-the-bed/README.md) | An empty chair, the visitor’s work and close reading of sound | Nightingale and Whitman’s complete Specimen Days; [12439](https://www.gutenberg.org/ebooks/12439), [8813](https://www.gutenberg.org/ebooks/8813) |
| [The Alps](mountains-and-heights/README.md) | Conway’s complete book, seventy paintings and paired views of snow and rock | Conway and McCormick; [39542](https://www.gutenberg.org/ebooks/39542), [1904 scan](https://archive.org/details/alps00conw) |
| [Nietzsche in company](nietzsche-in-company/README.md) | The complete Joyful Wisdom, read beside Epicurus’s letter | Nietzsche and Epicurus; [52124](https://www.gutenberg.org/ebooks/52124), [57342](https://www.gutenberg.org/ebooks/57342) |
| [War and Peace](war-and-peace/README.md) | The complete Maude translation and twelve 1893 plates, opened by chapter | Tolstoy/Maude; [2600](https://www.gutenberg.org/ebooks/2600), [album](https://www.prlib.ru/item/1988888) |

| [Douglass](douglass-narrative/README.md) | The complete 1845 Narrative beside its schoolbook, the law and a later escape account | [Sources](douglass-narrative/docs/SOURCE-RIGHTS.md) |
| [The Fall of the House of Usher](fall-of-the-house-of-usher/README.md) | Poe’s complete 1845 story, two artists and linked adaptations | [Sources](fall-of-the-house-of-usher/docs/SOURCE-RIGHTS.md) |
| [Ballads and a play](ballads-and-a-play/README.md) | Five ballads and Iphigenie in German and historical English | [Witnesses and licenses](ballads-and-a-play/docs/SOURCE-RIGHTS.md) |
| [A kingdom for a stage](kingdom-for-a-stage/README.md) | Three complete Shakespeare plays with historical context | [Folger CC BY-NC 3.0 editions](kingdom-for-a-stage/docs/SOURCE-RIGHTS.md) |
| [Pictures after dark](pictures-after-dark/README.md) | Eight French works, historical English and illustrated pages | [Witnesses, images and licenses](pictures-after-dark/docs/SOURCE-RIGHTS.md) |
| [Caesar and the emperors](caesar-and-the-emperors/README.md) | Campaign, public record and reflections, with rival accounts | [Latin, Greek and English witnesses](caesar-and-the-emperors/docs/SOURCE-RIGHTS.md) |

## Try one

The public entrance is **[newreading.app](https://newreading.app/)**. Canonical readers: [Austen](https://newreading.app/austen/), [Alice](https://newreading.app/alice/), [Walden](https://newreading.app/walden/), [Two lecture halls](https://newreading.app/two-halls/), [The Odyssey](https://newreading.app/odyssey/), [Dracula](https://newreading.app/dracula/). [Release verification](../docs/STATUS.md) distinguishes local checks from confirmed live behavior.

From the repository root, with Node.js 22 or later:

```sh
cd examples/alice-in-wonderland
PORT=4192 npm run dev
```

Open the printed address. No application dependency installation is needed. Use a different port for each reader; browser records and offline caches belong to the origin. The default root `npm run dev` still opens the small original-sample kit. The examples are not included in its build or Vercel upload list.

Each example supports reading, focus, exact passage notes, attributed sharing/copying and an offline copy. Wait for **Available offline** in the browser you will use. Then included reading and companions work across an offline reload, including saving and editing annotations. External research, EPUB downloads and message delivery can require connectivity. Export private reading bundles: browser eviction, clearing data or changing domains can make records unavailable. Austen’s illustrations and the music reader’s scan leaves are separate application assets. Their recovery instructions describe the required matching files; a records export alone does not carry those assets.

Where the edition supports faithful image export, **Make card** creates a quotation image in that reader’s colors and type. Preview it, then **Share image** or **Save image**. Cards contain the quotation and attribution; personal notes remain separate. The image is generated locally and can be made from a verified offline copy. A long passage and its required credits must fit legibly in full or be shortened by making a new selection. Shakespeare’s drama profile offers attributed text and exact editions, without flattening its stage layout into cards. Some critical signs also require exact-edition export.

## What is public

The user selected these twenty reviewed editions for this public repository. The original four examples were packaged from committed source snapshots. Odyssey and Dracula add narrowly selected application files and exactly pinned prepared editions from their recorded local source commits; no independent project history, original archive, private intake, personal note, device link or browser capture was copied. [catalog.json](catalog.json) records the source revision, packaging changes, source evidence and exact reviewed build bytes. Those snapshots establish the initial editions and designs. Later reviewed maintenance is listed in `maintenanceChanges`, with updated exact build bytes; it does not silently replace the source snapshots or their rights evidence.

Each example retains its edition-specific rights, fidelity and builder-feedback documents. Historical public-domain claims are scoped to the named edition and territory. Modern Folger texts retain **CC BY-NC 3.0**; admitted Wikisource and Perseus transcriptions retain **CC BY-SA 4.0**. The MIT software license does not relicense them. No declaration establishes worldwide clearance. Translations, prefaces, illustrations, publisher devices and required notices are part of that review. Code and original samples use MIT; third-party editions retain their own source terms. The examples are free independent adaptations, without source-provider endorsement. Consult [the rights guide](../docs/RIGHTS.md) before redistributing in a different territory or context.

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

## Two further editions · 23 October 2026

The owner approved the complete Douglass Narrative and its three historical documents, and delegated final acceptance of Poe’s Usher reader. These separate packages retain their exact prepared books, original notes, images and contribution-specific rights records. Douglass pairs Chapters VII and XI with the schoolbook dialogue, the later escape account and the 1793 law; Poe pairs passages with two historical illustrations and four linked adaptations. Raw scans and private preparation are excluded.

- [Douglass](https://newreading.app/douglass/): [source and rights](douglass-narrative/docs/SOURCE-RIGHTS.md).
- [Poe](https://newreading.app/poe/): [source and rights](fall-of-the-house-of-usher/docs/SOURCE-RIGHTS.md).

## Four themed collections · October 24

The owner approved these four collections after their separate build and review. `/ballads/`, `/shakespeare/`, `/pictures-after-dark/` and `/rome/` have explicit source/license pages, exact source inventories and distinct reading interfaces. Translations remain separate editions; compare stanzas, paragraphs or numbered chapters without pretending the witnesses agree word for word. The selected Roman books are bounded parts, clearly labeled at the entrance.

## One catalogue, twenty reader paths

[newreading.app](https://newreading.app/) is built by the [showcase](../showcase/README.md) with the founding readers at `/austen/`, `/alice/`, `/walden/`, `/two-halls/`, `/odyssey/` and `/dracula/`. The five meetings have their own paths at `/at-table/`, `/inward-life/`, `/music-and-feeling/`, `/learning-to-see/` and `/beside-the-bed/`. It uses one Vercel project with `showcase` as the Root Directory. The existing `read.lookatseel.com` address remains available. The earlier book subdomains redirect network requests to the corresponding new paths.

The combined builder checks each complete standalone output against this catalogue before adapting explicit asset URLs, database names, worker/cache scopes and install identities. Edition JSON and illustrations stay byte-identical. These namespaces prevent accidental collisions, not access by other code on the same origin. All twenty applications share the same trusted publisher. Do not generalize this packaging to arbitrary readers without reviewing and testing their adapters.

Each example can still be built independently with `npm run build` and output `dist`. Unmodified standalone builds need separate origins: their root URLs, database names and cache prefixes collide if their folders are simply copied under one address. The old-host redirect rules apply only to the four named `lookatseel.com` book hosts, so a new owner's deployment is unaffected. See [hosting and migration guidance](../docs/DEPLOYMENT.md#hosting-several-customized-readers).

The user chose a clean launch for these unshared examples. Existing offline installations can retain an older cached app; open the new reader address and install it from there. General personal-library moves still require exact-edition backups and restore verification. Before travel, wait for **Available offline** in the browser or installed app you will use, then test a reload and a saved note without connectivity. See [release evidence and limits](../docs/STATUS.md).

The five collections added in October 2026 carry a quiet, optional Made with newreading.app footer. Their catalogue packagingChanges explicitly list the index and stylesheet refinement; At Table also has a phone-only source-heading adjustment from the final identity review. Complete edition, font/license and source-image bytes retain their reviewed pins. Older examples retain their existing UI. The default starter has the same removable credit; see the agent guide for its single-paragraph removal.
