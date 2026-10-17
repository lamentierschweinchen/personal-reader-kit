# New reading

The public catalogue and four complete readers share **https://newreading.app/**. The selected Open Shelf direction uses self-hosted Bricolage Grotesque, four reviewed artworks, a short agent handoff and [How it works](learn/index.html). [Asset provenance and licenses](ASSETS.md).

**https://read.lookatseel.com/** has a separate, deliberately small landing page linking to New reading. Its [personal-site design](personal/index.html) restores the original warm paper, Fraunces type and approved book graphic. Keep this page separate from future New reading redesigns; its local preview is `/personal/`. It uses the shared `book.webp` and Fraunces font assets, so those remain build inputs even if the main catalogue stops using them.

The catalogue has no account, analytics or reading storage. Each reader uses a separate database name, service-worker scope, cache prefix and install-manifest identity under `/austen/`, `/alice/`, `/walden/` or `/two-halls/`. Those namespaces prevent accidental collisions; they are not a security boundary against other code on the same origin. Install a reader from its own path. The landing page itself does not promise offline reading.

`build.mjs` copies only its named catalogue inputs. `readers.mjs` runs the four existing builders, compares every generated file with `examples/catalog.json`, then adapts known runtime paths and storage names. Unexpected source/output changes stop the build. Complete edition JSON and image bytes stay unchanged. Each original example still builds independently. The default kit build and personal starter remain original-samples-only.

```sh
cd showcase
npm run build
npm run dev
# With the optional Playwright runtime installed:
npm run check
# Render a candidate social image in ignored test-results, then inspect it.
npm run share-image
```

The checks cover the page at phone/tablet/desktop sizes, keyboard and no-JavaScript access, copy failure, all four readers together, and reload/chapter/companion/note editing with the server stopped. A separate check rebuilds from only `inputs.json` in a fresh temporary directory. These are developer checks, not native home-screen installation, physical iOS gestures, screen-reader acceptance or a human onboarding session.

## Hosting

The existing `lookatseel-read` Vercel project uses this `showcase` directory, `npm run build`, output `dist`, Node 24 and `node --version` as its install command. The combined deployment requires **Include source files outside the root directory** for the four reviewed sibling examples; the owner approved and enabled that setting for this project on 17 October 2026. Preview authentication remains enabled. `inputs.json` and `.vercelignore` enumerate exact required files; no private workspace, source archive, intake, notes or arbitrary example directory is admitted. Deploy the reviewed Git repository, never the surrounding Reading workspace. The stock kit's root upload list remains unchanged.

Keep `vercel.json` with the output: it applies the reader CSP, worker revalidation, stable trailing-slash entrances and the examples' noindex default. The public catalogue permits indexing. Home-screen installation is per reader, not a wrapper around the catalogue.

A host-specific homepage rewrite serves `personal/index.html` only at `read.lookatseel.com`. Both domains stay on the existing project; New reading's homepage and the four reader paths keep their own files. The loopback server previews static files without emulating Vercel's host routing, so verify both actual HTTPS homepages after publishing a routing change.

The four former book hosts use explicit homepage and wildcard-path redirects. Verify the actual root response, a deep asset request, query parameters and a chapter fragment after deployment: the first live migration check found that the wildcard rule redirected deeper paths while the homepage still served the old app. A successful build alone did not establish correct routing.

The user chose a clean launch for these previously unshared examples, so this release has no old-origin data migration. General migration guidance for personalized readers remains in [DEPLOYMENT.md](../docs/DEPLOYMENT.md). A database backup cannot install an app; the guide treats backup, installation and offline verification separately.

Release evidence belongs in [STATUS.md](../docs/STATUS.md); private captures and machine receipts stay in ignored `test-results/`. Bookshop.org is an ordinary non-affiliate support link, not a claim that its purchases can be imported.
