# read

The public entrance to the four complete readers, at **https://read.lookatseel.com/**. It uses Lukas’s personal-site palette, typography and existing book graphic, with a lighter catalogue composition. [Asset provenance and licenses](ASSETS.md).

This is a separate static site, with fifteen explicit build outputs. Four artwork-led entrances link to the samples: a complete peacock binding, Rackham's rabbit, Thoreau's survey and a contemporary engraved-style illustration of Hegel and Schopenhauer. They are not interface screenshots. A short value proposition and agent handoff replace the previous long descriptions and FAQ. The only client JavaScript copies the visible short command after a click, with selectable text on clipboard failure. The command points to the full instructions in [`start.txt`](start.txt); those same instructions are also available in a native disclosure in static HTML. Both work without JavaScript and include the kit's copyediting step. There are no analytics, cookies, accounts or reading storage. Each linked reader has a separate origin for its library and service worker. The showcase itself is not an offline reading app.

The visual direction keeps warm paper and Fraunces, with larger art and restrained rules. Two columns on desktop/tablet become one generous column on phones. Each entry has one title and a visible Read/Enter action; hover/focus sharpens the link, copy feedback confirms the handoff, and reduced motion removes image movement. The full agent instructions use progressive disclosure while remaining in the static document and plain-text endpoint. A 1200 × 630 social preview shows the four editions with the site's name and offer; the owner's original book graphic remains available as a separately credited asset. Bookshop.org is an ordinary, non-affiliate link to support independent bookshops; no claim is made about importing its purchases.

[Your first reader](learn/index.html) gives newcomers four concrete steps, official agent setup links, a copyable first instruction and brief help for unfamiliar terms. The home page and repository README link to it. Native disclosures and selectable instructions remain usable without JavaScript.

```sh
cd showcase
npm run build
# With the optional Playwright runtime installed:
node check.mjs
# Render a candidate link-preview image in ignored test-results/showcase/.
# Inspect it, copy it to assets/read-share.jpg, then update its exact audit pin.
npm run share-image
# Optional: capture already-public reader interfaces for QA, not catalogue art.
# Output stays in ignored test-results/; it is not an automatic publication step.
node capture.mjs
```

Host this directory as its own Vercel project with `npm run build`, output `dist`, and `node --version` as the install command. Disable inclusion of source files outside the selected root directory. The exact upload rules support both standalone and repository-root Git builds. The root reader and the four `examples/` builds are independent. Do not deploy the surrounding local workspace. Keep all exact assets and `assets/OFL.txt` together.

The four canonical readers are `austen.lookatseel.com`, `alice.lookatseel.com`, `walden.lookatseel.com` and `two-halls.lookatseel.com`. Preserve their addresses after launch: changing origins requires a verified data migration for existing readers. The personal site’s apex and `www` addresses are separate projects.

Local and live verification receipts belong in ignored `test-results/`; release evidence is recorded in `docs/STATUS.md` at the kit root. The source examples’ noindex settings are retained. This public catalogue permits indexing.
