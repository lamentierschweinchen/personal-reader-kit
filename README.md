# Reading, in good company

A personal reader kit for people who carry books into the world—and want to spend a little more time inside them.

Give your own agent this repository and one or more book files. This is a reusable reader shell plus a supervised editorial workflow: your agent prepares faithful editions, helps you choose useful exploration, and guides your personal site online. The kit includes a working example, an agent guide, and original writing you can freely share.

**Giving files to an agent may send their contents to its model provider. Check that processing boundary before supplying books; it is separate from the finished reader’s local storage.**

**Use only material you are entitled to use. Owning a copy does not give permission to publish it.** Public examples need edition-specific public-domain, license or permission evidence, including illustrations and translations. [Books and permissions](docs/RIGHTS.md)

**The default website hosts the reader and original samples. Your imported books and notes stay in your browser.** There is no book upload endpoint, analytics, remote font request, AI API key or account requirement inside the reader. A public repository should never become your personal library.

**Public beta:** ready to try with your own agent and private backups. Browser verification covers the core flows; physical iPhone/iPad gestures and a new user’s end-to-end deployment still need direct testing. [Exact evidence and limits](docs/STATUS.md)

## Try it

**How it works:** [Follow the short guide](https://newreading.app/learn/): choose an agent, open a project folder and try the kit's sample before bringing your book. It explains the unfamiliar terms and gives you a first instruction to copy.

**Browse the [library](https://newreading.app/library/):** eleven editions, including five meetings of writers, with maker credit, companion previews and source details. [Propose a public edition](docs/LIBRARY.md) for review; keep personal books and reading records out of proposals.

**Read a complete example:** [Pride and Prejudice](https://newreading.app/austen/), [Alice](https://newreading.app/alice/), [Walden & Civil Disobedience](https://newreading.app/walden/), [Two lecture halls: Schopenhauer and Hegel](https://newreading.app/two-halls/), [The Odyssey](https://newreading.app/odyssey/), or [Dracula](https://newreading.app/dracula/). Alice, Odyssey and Dracula also have short visual games beside the reader. Each has its own visual identity, source adapter, credited edition and offline reading. [Example source and hosting details](examples/README.md). The public entrance is [newreading.app](https://newreading.app/); [release status](docs/STATUS.md) records the live verification and its limits.

Five meetings of writers extend the shelf: [At Table](https://newreading.app/at-table/) on cooking and hospitality; [The Inward Life](https://newreading.app/inward-life/) on spiritual experience; [What Can Music Say?](https://newreading.app/music-and-feeling/) on musical judgment; [Learning to See](https://newreading.app/learning-to-see/) on drawing and ornament; and [Beside the Bed](https://newreading.app/beside-the-bed/) on care and observation. Each has complete selected historical texts, its own visual identity and a companion built around a specific encounter between the writers. The exact witnesses and omissions are recorded with each edition.

Get [the public kit on GitHub](https://github.com/lamentierschweinchen/personal-reader-kit). Choose **Use this template** for your own repository, download the ZIP, or clone it:

```sh
git clone https://github.com/lamentierschweinchen/personal-reader-kit.git
cd personal-reader-kit
```

With Node.js 22 or later installed, open a terminal in the kit folder:

```sh
npm run dev
```

Open **http://127.0.0.1:4173**. No package installation is needed for the application. You can read two original miniature works, select words to keep, share or copy a passage, add a comment, change the type, enter focus mode, and try three companion sketches. In focus mode, tap the reading surface to recall controls; scrolling hides them again. Keyboard users can reveal controls with C or the Show reading controls action, and leave with Escape. Your place and notes survive a reload. Stay online until **Available offline** is confirmed; Settings → **Check offline copy** verifies the download before travel.

**Share something that stays with you.** Select text and choose **Keep or share passage**, then **Share passage** for your device’s share menu or **Copy passage** for a notes app. The same actions are available when editing a saved passage. The plain text includes exact words, line breaks, indentation, author, title, section and edition; personal notes and device/site URLs are excluded. If the browser cannot share or copy automatically, it offers selectable text. The destination app may change visual spacing and does not receive rich-text emphasis. No passage is uploaded by the reader, and dismissing sharing leaves an unfinished note intact.

**Make a quotation card.** Choose **Make card** beside the sharing actions to preview a PNG in the reader’s colours and type. **Share image** opens your device’s share menu when it supports files; **Save image** downloads the card. The image contains the selected words and their source attribution, without your private note. Long selections that cannot fit legibly need a shorter selection; they are never silently cut. Cards are made in your browser, including from a verified offline copy.

**Read in airplane mode.** After the offline copy is verified in this browser, you can reload, navigate chapters, open included companions, and create/edit saved annotations without a connection. Imported books are already stored locally. External research websites and downloads still need internet. Reopen the same address in the same browser/profile; an installed app can have separate storage, so open and verify it before disconnecting. Private browsing, cleared site data or browser eviction can remove the offline copy and records. Keep a private reading bundle as a backup. Copying to a local notes app can work offline; sending to a friend depends on the receiving app and connectivity.

Choose **Bring a book** to add a UTF-8 `.txt` or prepared reader `.json` file, up to 8 MB. Files are stored locally in IndexedDB. Imports on a phone, tablet and desktop are separate; export a **private reading bundle** from Settings. It carries selected exact editions and all saved records in one unencrypted file, with a restore preview and conflict checks. Separate record/edition exports remain available. A different site address also has a separate library; [verify a restore before moving](docs/DEPLOYMENT.md#choose-an-address-and-move-without-losing-your-library). See [file compatibility](docs/BOOK-FORMAT.md).

The real-book trials required adapters for illustrations, notes, tables and shaped verse. The stock kit still uses its narrow text contract. [Adapter decisions](docs/ADAPTERS.md) explain compatibility, asset recovery and how to test an adapted reader without overstating automatic import support.

**Keep it on your home screen.** Open the reader in Safari on iPhone/iPad or Chrome on Android, then use **Add to Home Screen** or **Install**. Desktop browsers offer app installation too. Open the new icon while online, confirm your books and notes, then check its offline copy before travelling. [Device-by-device instructions and backup steps](docs/DEPLOYMENT.md#add-the-reader-to-your-home-screen)

## Make your reader, with an agent

If you have the repository open in an agent that can work with local files, start with:

> Read AGENTS.md and docs/AGENT-GUIDE.md. Help me make a personal reader from these book files: [local paths]. Inspect them before choosing an approach. Keep my originals unchanged and my books out of public code and history. Ask me whether I want simple presets or a more exploratory experience. Keep reading comfortable on my phone and tablet, and guide me through a usable personal website when the reader is ready.

The agent follows four steps:

1. **Meet the books.** Check formats, edition, languages, source quality and import rights. Prepare local reading files with exact wording, poetry structure and an honest conversion report.
2. **Choose the kind of companion.** First make ordinary reading useful. Presets are available in either mode; optional exploration starts with questions about your interests, travel, attention and spoilers.
3. **Try, then make.** For exploratory mode, the agent studies the material and proposes a straightforward companion, a scholarly approach and an experimental idea, with material-led alternatives where needed. It reviews a sample of the actual prose, makes a small working prototype of each, asks what draws you in, and refines your choice. Reading remains available throughout. If you already chose a direction, tell the agent; it should refine that choice instead of restarting an unwanted selection exercise.
4. **Make it yours online.** The agent helps you get the repository through GitHub if needed, set up Vercel, choose the right privacy boundary, deploy, and verify the actual site on your devices. [Deployment guide](docs/DEPLOYMENT.md)

A walk, map, historical context, secondary literature, a visual experiment or a conversation between works may fit. None is compulsory. The kit’s three sample sketches show different structures; they are not automatic templates to impose on every book.

## What is working in this version

- Phone and tablet layouts; focus mode; adjustable type size, spacing, measure and page color; keyboard-accessible controls.
- Exact text rendering, emphasis ranges, hard line breaks, stanza gaps and indentation. Fixed-layout verse can scroll within its block.
- Passage sharing through the device menu, attributed plain-text copying and a manual-copy fallback; private notes remain excluded.
- Multi-block highlights and comments, explicit new/extend choices for overlapping selections, edition-aware anchors, saved reading places and separate spoiler boundaries.
- Private browser imports, local persistence, portable private reading bundles, repeatable records export/merge, exact-edition export, retained conflicting notes/connections, and an explicit repair transaction that archives damaged state and preserves local books.
- Three interactive companions: a fictional listening walk, literal occurrence search across permitted books, and comparisons between your own kept passages with edition-aware saved connections.
- Offline application and original samples; imported books remain in browser storage. Storage eviction is still possible.
- An explicit public build list, original-sample fingerprints, and a complete-local-history audit that rejects shallow views and records its exact ref scope.

This is an early reusable kit, not a universal ebook converter. EPUB/PDF conversion is agent-assisted. An optional [bounded EPUB preparer](docs/BOOK-FORMAT.md#bounded-local-epub-preparation) handles a narrow unstyled text-only subset and produces a provisional edition for proofreading; unsupported features stop preparation. DRM bypass, automatic OCR, image/facsimile blocks, interactive source footnotes, live routing, linguistic/semantic search, automatic sync and authenticated hosted libraries are not implemented. Complex works need a reviewed adapter, not a lossy shortcut. Physical iOS selection gestures still need on-device testing.

**E-reader export is not implemented yet.** The current JSON edition/bundle exports are for this reader. A future EPUB export can carry the book and explicitly selected static commentary; interactive companions and automatic note synchronization need separate treatment. See [the proposed export boundary](docs/BOOK-FORMAT.md#e-reader-export-proposed).

## For maintainers

The portable [reader-copyeditor skill](skills/reader-copyeditor/SKILL.md) reviews authored prose without rewriting literary sources. It covers useful content, production commentary, claims, voice and the rendered experience. Its optional receipt check verifies coverage and file integrity, not writing quality.

Personalized readers have a [read-only upgrade comparison and migration procedure](docs/UPGRADING.md). The [three-newcomer and editorial pilot](docs/PILOT.md) defines the human evidence still needed for broader dependability claims. The application needs only Node; the optional EPUB preparer and its Node test fixtures additionally require Python 3.10 or later. No Python packages are installed.

```sh
npm test              # Source fidelity, anchors, recovery, spoiler and build-boundary tests
npm run build        # Public shell + reviewed original samples only, into dist/
npm run audit:public # Exact staged/working inventory and all reachable Git history
npm run check:examples # Optional collection: each reader's tests and exact build bytes
npm run editorial:check -- .reader/editorial/review.json # Review coverage and file integrity
```

The public audit expects the final file set to be staged and a complete clone. Shallow/partial history, replacement refs, grafts and inspection errors cannot pass. The receipt identifies HEAD and all locally present refs; it cannot inspect unfetched remote refs or unreachable objects. For a safely retired or renamed public file, keep its reviewed old path, SHA-256 and reason in `publication.json.reviewedHistoricalFiles`. This list does not admit the file into the current build or weaken private-path checks. It writes its receipt to ignored `.reader/publication-review.json`. It rejects unexpected paths, recognized credentials, unreviewed binary files and differences between the index and working copy; commit and annotated-tag metadata are scanned too. The eleven optional example editions have separate path/hash/provenance entries; their source-specific build gates also validate decoded images. Human review remains required: a scanner cannot establish rights or detect every secret. The Vercel CLI upload exceptions also enumerate the exact build inputs, rather than allowing every file in an application directory.

Optional browser verification:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium webkit
npm run test:browser
```

The harness starts and stops its own loopback server. It checks Chromium and WebKit, including five phone/tablet sizes and offline reload. `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `WEBKIT_PATH`, `QA_ENGINE` and `TEST_PORT` can select an existing test runtime. Outputs stay in ignored `test-results/`.

[Independent review and response](docs/REVIEW.md) · [A demanding editorial case](docs/COMPANION-CASE-STUDY.md) · [Architecture and reuse decisions](docs/ARCHITECTURE.md) · [Agent guide](docs/AGENT-GUIDE.md) · [Book format](docs/BOOK-FORMAT.md) · [Privacy](docs/PRIVACY.md) · [Design](docs/DESIGN.md) · [Release status](docs/STATUS.md)

Code and original samples are provided under [MIT](LICENSE). See [sample provenance](samples/README.md). The public-domain examples retain their edition-specific credits and source terms; the MIT license does not relicense third-party contributions. Supplied personal books retain their existing rights and are not covered by this license.
