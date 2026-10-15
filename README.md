# Reading, in good company

A personal reader kit for people who carry books into the world—and want to spend a little more time inside them.

Give your own agent this repository and one or more book files. This is a reusable reader shell plus a supervised editorial workflow: your agent prepares faithful editions, helps you choose useful exploration, and guides your personal site online. The kit includes a working example, an agent guide, and original writing you can freely share.

**Giving files to an agent may send their contents to its model provider. Check that processing boundary before supplying books; it is separate from the finished reader’s local storage.**

**The default website hosts the reader and original samples. Your imported books and notes stay in your browser.** There is no book upload endpoint, analytics, remote font request, AI API key or account requirement inside the reader. A public repository should never become your personal library.

## Try it

Get [the public kit on GitHub](https://github.com/lamentierschweinchen/personal-reader-kit). Choose **Use this template** for your own repository, download the ZIP, or clone it:

```sh
git clone https://github.com/lamentierschweinchen/personal-reader-kit.git
cd personal-reader-kit
```

With Node.js 22 or later installed, open a terminal in the kit folder:

```sh
npm run dev
```

Open **http://127.0.0.1:4173**. No package installation is needed for the application. You can read two original miniature works, select words to save a passage, add a comment, change the type, enter focus mode, and try three companion sketches. Your place and notes survive a reload. The application saves an offline copy once loaded successfully.

Choose **Bring a book** to add a UTF-8 `.txt` or prepared reader `.json` file, up to 8 MB. Files are stored locally in IndexedDB. Imports on a phone, tablet and desktop are separate; export your notes and **exact prepared editions** from Settings. A different site address also has a separate library; [verify a restore before moving](docs/DEPLOYMENT.md#choose-an-address-and-move-without-losing-your-library). See [file compatibility](docs/BOOK-FORMAT.md).

## Make your reader, with an agent

If you have the repository open in an agent that can work with local files, start with:

> Read AGENTS.md and docs/AGENT-GUIDE.md. Help me make a personal reader from these book files: [local paths]. Inspect them before choosing an approach. Keep my originals unchanged and my books out of public code and history. Ask me whether I want simple presets or a more exploratory experience. Keep reading comfortable on my phone and tablet, and guide me through a usable personal website when the reader is ready.

The agent follows four steps:

1. **Meet the books.** Check formats, edition, languages, source quality and import rights. Prepare local reading files with exact wording, poetry structure and an honest conversion report.
2. **Choose the kind of companion.** First make ordinary reading useful. Presets are available in either mode; optional exploration starts with questions about your interests, travel, attention and spoilers.
3. **Try, then make.** For exploratory mode, the agent studies the material and proposes three genuinely different experiences, makes a small working prototype of each, asks what draws you in, and refines your choice. Reading remains available throughout. If you already chose a direction, tell the agent; it should refine that choice instead of restarting an unwanted selection exercise.
4. **Make it yours online.** The agent helps you get the repository through GitHub if needed, set up Vercel, choose the right privacy boundary, deploy, and verify the actual site on your devices. [Deployment guide →](docs/DEPLOYMENT.md)

A walk, map, historical context, secondary literature, a visual experiment or a conversation between works may fit. None is compulsory. The kit’s three sample sketches show different structures; they are not automatic templates to impose on every book.

## What is working in this version

- Phone and tablet layouts; focus mode; adjustable type size, spacing, measure and page color; keyboard-accessible controls.
- Exact text rendering, emphasis ranges, hard line breaks, stanza gaps and indentation. Fixed-layout verse can scroll within its block.
- Multi-block highlights and comments, edition-aware anchors, saved reading places and separate spoiler boundaries.
- Private browser imports, local persistence, repeatable records export/merge, exact-edition export, retained conflicting notes/connections, and an explicit repair transaction that archives damaged state and preserves local books.
- Three interactive companions: a fictional listening walk, literal occurrence search across permitted books, and comparisons between your own kept passages with edition-aware saved connections.
- Offline application and original samples; imported books remain in browser storage. Storage eviction is still possible.
- An explicit public build list, original-sample fingerprints, and a complete-local-history audit that rejects shallow views and records its exact ref scope.

This is a small first release, not a universal ebook converter. EPUB/PDF conversion is agent-assisted; DRM bypass, automatic OCR, image/facsimile blocks, interactive source footnotes, live routing, linguistic/semantic search, automatic sync and authenticated hosted libraries are not implemented. Complex works need a reviewed adapter, not a lossy shortcut. Physical iOS selection gestures still need on-device testing.

## For maintainers

```sh
npm test              # Source fidelity, anchors, recovery, spoiler and build-boundary tests
npm run build        # Public shell + reviewed original samples only, into dist/
npm run audit:public # Exact staged/working inventory and all reachable Git history
```

The public audit expects the final file set to be staged and a complete clone. Shallow/partial history, replacement refs, grafts and inspection errors cannot pass. The receipt identifies HEAD and all locally present refs; it cannot inspect unfetched remote refs or unreachable objects. For a safely retired or renamed public file, keep its reviewed old path, SHA-256 and reason in `publication.json.reviewedHistoricalFiles`. This list does not admit the file into the current build or weaken private-path checks. It writes its receipt to ignored `.reader/publication-review.json`. It rejects unexpected paths, recognized credentials, binary files and differences between the index and working copy; commit and annotated-tag metadata are scanned too. Human review remains required: a scanner cannot establish rights or detect every secret. The Vercel CLI upload exceptions also enumerate the exact build inputs, rather than allowing every file in an application directory.

Optional browser verification:

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium webkit
npm run test:browser
```

The harness starts and stops its own loopback server. It checks Chromium and WebKit, including five phone/tablet sizes and offline reload. `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `WEBKIT_PATH`, `QA_ENGINE` and `TEST_PORT` can select an existing test runtime. Outputs stay in ignored `test-results/`.

[Independent review and response](docs/REVIEW.md) · [A demanding editorial case](docs/COMPANION-CASE-STUDY.md) · [Architecture and reuse decisions](docs/ARCHITECTURE.md) · [Agent guide](docs/AGENT-GUIDE.md) · [Book format](docs/BOOK-FORMAT.md) · [Privacy](docs/PRIVACY.md) · [Design](docs/DESIGN.md) · [Release status](docs/STATUS.md)

Code and original samples are provided under [MIT](LICENSE). See [sample provenance](samples/README.md). Supplied personal books retain their existing rights and are not covered by this license.
