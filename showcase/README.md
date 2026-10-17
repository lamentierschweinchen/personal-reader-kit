# read

The public entrance to the four complete readers, at **https://read.lookatseel.com/**. It uses Lukas’s personal-site palette, typography and existing book graphic, with a lighter catalogue composition. [Asset provenance and licenses](ASSETS.md).

This is a separate static site, with thirteen explicit build outputs. Four real reader previews lead to the samples; a short value proposition and agent handoff replace the previous long descriptions and FAQ. The only client JavaScript copies the visible prompt after a click, with selectable text on clipboard failure. The same prompt is in static HTML and [`start.txt`](start.txt), so agents and visitors without JavaScript can use it. There are no analytics, cookies, accounts or reading storage. Each linked reader has a separate origin for its library and service worker. The showcase itself is not an offline reading app.

The visual direction keeps the warm paper, Fraunces and small book graphic. Preview images carry the page; hover/focus identifies the link, copy feedback confirms the action, and reduced motion removes preview movement. All substantive copy is visible without interaction. Bookshop.org is an ordinary, non-affiliate link to support independent bookshops; no claim is made about importing its purchases.

```sh
cd showcase
npm run build
# With the optional Playwright runtime installed:
node check.mjs
# Optional: recapture already-public previews into ignored test-results/.
# Review the loaded designs and provenance before replacing/pinning any asset.
node capture.mjs
```

Host this directory as its own Vercel project with `npm run build`, output `dist`, and `node --version` as the install command. Disable inclusion of source files outside the selected root directory. The exact upload rules support both standalone and repository-root Git builds. The root reader and the four `examples/` builds are independent. Do not deploy the surrounding local workspace. Keep all exact assets and `assets/OFL.txt` together.

The four canonical readers are `austen.lookatseel.com`, `alice.lookatseel.com`, `walden.lookatseel.com` and `two-halls.lookatseel.com`. Preserve their addresses after launch: changing origins requires a verified data migration for existing readers. The personal site’s apex and `www` addresses are separate projects.

Local and live verification receipts belong in ignored `test-results/`; release evidence is recorded in `docs/STATUS.md` at the kit root. The source examples’ noindex settings are retained. This public catalogue permits indexing.
