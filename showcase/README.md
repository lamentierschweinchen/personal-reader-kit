# read

The public entrance to the four complete readers, at **https://read.lookatseel.com/**. It uses Lukas’s personal-site palette, typography and existing book graphic, with a lighter catalogue composition. [Asset provenance and licenses](ASSETS.md).

This is a separate static site, with seven explicit build outputs. It has no client JavaScript, analytics, cookies, account or reading storage. Each linked reader has a separate origin for its library and service worker. The showcase itself is not an offline reading app.

```sh
cd showcase
npm run build
# With the optional Playwright runtime installed:
node check.mjs
```

Host this directory as its own Vercel project with `npm run build`, output `dist`, and `node --version` as the install command. The root reader and the four `examples/` builds are independent. Do not deploy the surrounding local workspace. Keep all exact assets and `assets/OFL.txt` together.

The four canonical readers are `austen.lookatseel.com`, `alice.lookatseel.com`, `walden.lookatseel.com` and `two-halls.lookatseel.com`. Preserve their addresses after launch: changing origins requires a verified data migration for existing readers. The personal site’s apex and `www` addresses are separate projects.

Local and live verification receipts belong in ignored `test-results/`; release evidence is recorded in `docs/STATUS.md` at the kit root. The source examples’ noindex settings are retained. This public catalogue permits indexing.
