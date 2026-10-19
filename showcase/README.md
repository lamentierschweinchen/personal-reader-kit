# New reading

The public catalogue, library and eleven complete readers share **https://newreading.app/**. The combined build regenerates the homepage and [How it works](learn/index.html) with `pages.mjs`; `node pages.mjs` also previews copy changes. They use self-hosted IM Fell English, Reenie Beanie, Martian Mono and Piazzolla. [Asset provenance and licenses](ASSETS.md).

The homepage's mixed shelf uses the same validated `library/entries.json` and jacket artwork as the library. Titles run alphabetically, ignoring initial A, An and The. Alice, At Table and Walden initially face out on desktop; phones and tablets have one swipable row with Alice open. Activation turns a book and updates its reading link; hover only lifts it. Native scrolling owns touch gestures. Keyboard arrows, Home and End select books, with a polite announcement. Enlarged text wraps the detail area, and reduced motion removes the turn. Static links to all eleven readers remain available without JavaScript or if the shelf module fails to load.

`shelf/render.mjs` builds that section and generates `shelf/covers.css` from the library's top-level jacket rules. Every jacket selector is scoped to `.mixed-library` so the homepage's moving covers retain their own geometry. Edit the library's shared artwork styles, then rebuild; do not hand-edit the generated jacket CSS. Shelf controls use `data-shelf-book`, separate from the hero's `data-pick` controls. The standalone prototype and its preview tools are not deployment inputs.

The [community library](https://newreading.app/library/) is a separate bookshelf of eleven reviewed editions. Covers open their existing readers; About this edition previews the companion and source/reuse details. Search, category filters and sorting enhance static read links and source disclosures. Share an edition leads to a public GitHub proposal form, with a warning to exclude private books, notes and bundles. The library has no reading-storage access or upload endpoint. See [contribution and catalogue maintenance](../docs/LIBRARY.md).

`library/entries.json` holds bounded public discovery metadata. `library/render.mjs` validates it and generates `library/index.html`; the combined builder runs that generator. The public source inventory and deployment inputs name the library files explicitly. The exact example build inventories, exact edition pins, original-sample starter and personal entrance retain their separate boundaries.

**https://read.lookatseel.com/** is the short personal-site entrance: covers open into three phone screens, then an unframed “Read it. Explore it.” page with an exact Alice passage and Rackham’s rabbit, and one Get started link to New reading. Alice is centered with a selected passage, Canetti shows a map without a reader destination, and Walden shows the house account. Native HTML keeps the text sharp. Footer links and a quiet colophon hold the context. Keep [this page](personal/index.html) separate from New reading. Its local preview is `/personal/`. Native scrolling drives the opening; reduced motion, short viewports and no JavaScript show covers and previews in normal flow. Phone controls switch the illustrations in place.

The three optional games live at `/alice/play/`, `/odyssey/play/` and `/dracula/play/`. Their original vector artwork follows the corresponding reader. Each reader has a Play entrance; the catalogue links directly to each game. Return links restore the launching route, and the reader’s worker caches the complete game. Notes and reading progress remain separate from in-memory game state.

The catalogue has no account, analytics or reading storage. Its book-and-idea form keeps a bounded draft in session storage for this tab, so the setup guide and copy controls preserve the visitor’s preferences. The draft is never placed in a URL or sent to a server; typing and manual copying still work if storage or clipboard access is blocked. Each reader uses a separate database name, service-worker scope, cache prefix and install-manifest identity under `/austen/`, `/alice/`, `/walden/`, `/two-halls/`, `/odyssey/` `/dracula/`, `/at-table/`, `/inward-life/`, `/music-and-feeling/`, `/learning-to-see/` or `/beside-the-bed/`. Those namespaces prevent accidental collisions; they are not a security boundary against other code on the same origin. Install a reader from its own path. The landing page itself does not promise offline reading.

`build.mjs` copies only its named catalogue inputs. `readers.mjs` runs the eleven reader builders, compares every generated file with `examples/catalog.json`, then adapts known runtime paths and storage names. Unexpected source/output changes stop the build. Complete edition JSON and image bytes stay unchanged. Each original example still builds independently. The default kit build and personal starter remain original-samples-only.

```sh
cd showcase
npm run build
npm run dev
# With the optional Playwright runtime installed:
npm run check
# Render a candidate social image in ignored test-results, then inspect it.
npm run share-image
```

The checks cover the page at phone/tablet/desktop sizes, keyboard and no-JavaScript access, copy failure, all eleven readers together, and reload/chapter/companion/note editing with the server stopped. A separate check rebuilds from only `inputs.json` in a fresh temporary directory. The shelf check records its exact runtime hashes. On macOS, Playwright's WebKit snapshot API can flatten this CSS 3D scene and show blank book faces even when the native window paints correctly; inspect and capture the native WebKit window for visual acceptance rather than treating those snapshots as paint evidence. These are developer checks, not native home-screen installation, physical iOS gestures, screen-reader acceptance or a human onboarding session.

## Hosting

The existing `lookatseel-read` Vercel project uses this `showcase` directory, `npm run build`, output `dist`, Node 24 and `node --version` as its install command. The combined deployment requires **Include source files outside the root directory** for the eleven reviewed sibling examples; the owner approved and enabled that setting for this project on 17 October 2026. Preview authentication remains enabled. `inputs.json` and `.vercelignore` enumerate exact required files; no private workspace, source archive, intake, notes or arbitrary example directory is admitted. Deploy the reviewed Git repository, never the surrounding Reading workspace. The stock kit's root upload list remains unchanged.

Keep `vercel.json` with the output: it applies the reader CSP, worker revalidation, stable trailing-slash entrances and the examples' noindex default. The public catalogue permits indexing. Home-screen installation is per reader, not a wrapper around the catalogue.

A host-specific homepage route serves `personal/index.html` only at `read.lookatseel.com`. It must run **before the filesystem handler**: the first live check found that a high-level rewrite ran after the existing `index.html` and left the catalogue visible. The explicit `routes` array preserves the existing headers and slash redirects, then selects the personal entrance before normal file lookup. Both domains stay on the existing project; New reading's homepage and the eleven reader paths keep their own files. The loopback server previews static files without emulating Vercel's host routing, so verify both actual HTTPS homepages after publishing a routing change.

The four former book hosts use explicit homepage and wildcard-path redirects. Verify the actual root response, a deep asset request, query parameters and a chapter fragment after deployment: the first live migration check found that the wildcard rule redirected deeper paths while the homepage still served the old app. A successful build alone did not establish correct routing.

The user chose a clean launch for these previously unshared examples, so this release has no old-origin data migration. General migration guidance for personalized readers remains in [DEPLOYMENT.md](../docs/DEPLOYMENT.md). A database backup cannot install an app; the guide treats backup, installation and offline verification separately.

Release evidence belongs in [STATUS.md](../docs/STATUS.md); private captures and machine receipts stay in ignored `test-results/`. Bookshop.org is an ordinary non-affiliate support link, not a claim that its purchases can be imported.
