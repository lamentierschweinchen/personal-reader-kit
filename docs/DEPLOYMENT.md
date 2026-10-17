# Step four: your personal website

The default deployment is a public reader shell with original samples. Open its URL on each device and import your books there. Your book bytes do not need to reach GitHub or Vercel. This is the smallest complete path to a usable personal site.

## Get the repository

If GitHub is unfamiliar, your agent should guide you through creating/signing into your own account in the browser. Never send credentials in chat. Once the public kit's repository is available, either download its ZIP, clone its exact URL, or use **Use this template** if the maintainer has enabled that option. Choose your own repository name and visibility. A private personal copy is a useful default for future custom work, but still keep books out of Git.

The public kit is [lamentierschweinchen/personal-reader-kit](https://github.com/lamentierschweinchen/personal-reader-kit), published on `main` with **Use this template** enabled. Give the user's personal copy its own name and destination; do not push their books or personal changes back to the upstream kit. GitHub documents [template repositories](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-template-repository).

Install Node.js 22 or later if needed. Open the folder in your agent and run `npm run dev`. Verify the sample reader locally before connecting a hosting account. No application packages or API keys are needed.

## Choose the privacy model

| Choice | What reaches the host | What the agent must do |
| --- | --- | --- |
| Recommended: shell + device-local books | Application and original samples | Use the default build. Import personal books in the browser. Explain separate device storage and backups. |
| Private hosted books | Authorized books behind real authentication | Design this separately. Obtain the user's specific hosting authorization, configure protection before upload, and test every raw URL unauthenticated. This version does not implement a hosted private library. |

A public shell may be useful on a free account; do not promise a particular plan or price. Vercel's protection scope and features can change. Its current documentation distinguishes **Standard Protection**, which excludes production domains, from **All Deployments**, which includes them. Confirm the actual scope and available method in the user's project before relying on it. [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection) (checked 15 October 2026).

Noindex discourages search engines. An unshared URL and a private Git repository do not make a deployed site private. A personal hosted-book decision requires a concrete audience and direct-asset tests; never upload a book to an unprotected preview as a test.

## Prepare the exact release

1. Confirm the intended GitHub owner/name, repository visibility, Vercel account/project, production branch and audience. Reuse established choices; do not ask again unnecessarily.
2. Run `npm test`, `npm run build`, and `npm run test:browser`. Review limitations and the actual reader on a phone/tablet when available.
3. Stage only intended files, review the diff, and run `npm run audit:public`. Inspect its full `.reader/publication-review.json` inventory, HEAD/ref scope and complete local history. A shallow or partial clone must not pass; fetch the complete intended refs before reviewing. Safe retired public files need content-pinned historical review entries, not a weakened current inventory. Verify sample provenance. This scanner cannot prove copyright status or catch every secret.
4. Inspect `dist/`: the stock build must contain only the 13 listed app/original-sample outputs. Separately approved examples and the catalogue have their own explicit inventories. Confirm no personal input books, backups, notes, `.env`, `.vercel`, `.reader`, test screenshots or existing private reader source is included. The build uses a fixed allowlist and approved source hashes.
5. Commit the reviewed source. Show the user the commit, file inventory, output boundary and exact target. Obtain any still-required publication approval at this point, with a reviewable result ready.

## Connect and deploy the public shell

In Vercel, sign in through the provider's UI and add a project from your chosen GitHub repository. Grant access only to the needed repository. Confirm the branch and these settings, which are also in `vercel.json`:

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `node --version` (zero app dependencies) |
| Node | A supported version at least 22 |
| Environment variables | None for the default reader |

The Git integration can deploy subsequent pushes automatically. Keep personal files out of every branch and deployment source, even if output files are allowlisted. Review the provider's [GitHub integration instructions](https://vercel.com/docs/git/vercel-for-github) when performing setup. For a CLI deployment, inspect the linked project and exact upload set; `.vercelignore` provides an allowlist, not authorization to deploy. Do not link or overwrite either reference reader's live project.

## Add the reader to your home screen

Open the reader's final HTTPS address first. Install the individual reader, not the catalogue that links to it. The stock reader and four public examples already include a web-app manifest and an offline worker; no app-store account is needed.

| Device | Steps |
| --- | --- |
| iPhone or iPad | In Safari, open **Share** (sometimes inside the page menu), then **Add to Home Screen**. Enable **Open as Web App** if that option appears, then tap **Add**. If the action is missing, look in **Edit Actions**. |
| Android phone or tablet | In Chrome's menu, choose **Install and create shortcut**, then **Install**, and follow the device's instructions. Older browser versions may label the action **Add to Home screen** or **Install app**. |
| Computer with Chrome | Open the menu, then **Cast, save, and share**, then **Install page as app**. An install icon may also appear in the address bar. |
| Mac with Safari | On macOS Sonoma 14 or later, choose **File**, then **Add to Dock** and **Add**. |

Menu wording and installation options depend on the browser and operating system. These steps follow [Apple's iPhone guidance](https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iph42ab2f3a7/ios), [Chrome's Android guidance](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en), [Chrome's computer guidance](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DDesktop&hl=en) and [Safari's Mac guidance](https://support.apple.com/en-us/104996), checked 17 October 2026. They are instructions to try on the actual device, not evidence that native installation has been tested on every platform.

Open the new icon while still online. Confirm your book and notes are present; an installed web app can have separate browser storage. If needed, export a **private reading bundle** from the browser where you were reading, then restore it in the installed app. Keep that backup until the book, annotations and reading place survive a close and reopen.

In the installed reader, open **Settings**, choose **Check offline copy** and wait for **Available offline**. With both Wi-Fi and mobile data off, close and reopen it, change chapters, save a test annotation and reopen again to confirm it remains. Adding an icon alone does not establish offline readiness. Included books and companions can work offline; external research and directions links still need a connection. Retain backups because installation does not prevent cleared or evicted storage.

## Verify and hand off

Do not equate a successful build with a usable site. After the approved deployment, verify:

- Root, script, stylesheet, `library.json` and worker load on the actual domain. No unexpected external requests or console errors.
- The library response contains only the two original works. Requests for `.reader/`, source books and backups return no private content; a generic error/404 is expected.
- Import a harmless original fixture from a phone/tablet. Confirm it is retained after reload and no upload request appears. Do not use a copyrighted book to probe deployment safety.
- Select text, save/edit a note, leave and resume the same section, open an exploratory passage and return. Export a backup and verify a fresh-browser restore with original fixtures.
- Confirm the offline indicator, then disconnect and reload the reader and local import. If the user adds it to their home screen, repeat this from the new icon, including an annotation save and reopen. Storage limitations still apply.
- Check the actual phone/iPad selection menus, keyboard, safe areas, zoom and orientation; emulation is only partial evidence.

Return the usable URL, commit and deployment identifiers, verification receipt, privacy model, recovery instructions and remaining limits. Keep credentials and provider linkage out of Git. Do not call a URL live or a push synchronized without checking the result.

## Hosting several customized readers

Use separate origins for independently customized copies of this kit; a shared catalogue may link to them. The current application assumes the origin root: asset URLs, worker registration and the web-app start URL begin with `/`. Every unmodified copy opens the same `reading-kit-v1` IndexedDB database, and worker activation removes other `reading-kit-` caches. Different paths on one origin do not isolate those records or caches.

Do not place independent builds under `/alice`, `/walden` or similar paths and assume isolation. A subpath deployment requires deliberate base-URL handling, worker scope, cache namespaces, database names and a tested migration for existing records. Alternatively build one intentional multi-book application with compatible edition profiles. Neither arrangement is provided by copying the current output folders. Verify simultaneous use and offline upgrades if that architecture is implemented. An iframe on a different origin retains that origin's storage rules and is not a substitute for testing its privacy and usability.

The included [showcase](../showcase/README.md) implements a bounded exception for its four reviewed examples. Its builder verifies all standalone outputs, then adapts known URLs, database names, cache/worker scopes and manifest identities before mounting them at four paths. Combined-origin tests cover simultaneous use and offline reloads. This is a reviewed adapter for those examples, not general subpath support in the stock reader. Same-origin namespaces do not provide a security boundary. The owner explicitly chose a clean launch; personalized copies should follow the migration procedure below.

## Choose an address and move without losing your library

Choose the canonical production origin before substantial importing. Localhost, preview URLs, a custom domain and a new domain are separate browser-storage identities. Switching addresses does not transfer or delete the old library.

1. On the old address, open Settings. Export a **private reading bundle**, selecting all needed exact editions. Separate passages/edition exports remain supported. Keep these files private; edition exports include full books. Also keep the raw originals and conversion receipt. Do not rely on re-converting an EPUB/PDF later to reproduce identical anchors.
2. Open the destination in a fresh browser profile/context, or use the new device. Review and restore the bundle (or import exact edition JSON files and the separate records backup). Confirm export record counts and sizes before and after transfer, then edition IDs, source fingerprints, exact quotations, emphasis/lineation, comments, saved comparisons and reading places. Set spoiler boundaries explicitly; normal restore does not widen them.
3. Reload and check an anchored passage and continued reading. Verify offline behavior separately after the cache is ready. Retain the old address and private backup until the destination is proved usable.
4. Before software or editorial updates, repeat the exports. The public shell’s new code has access to existing same-origin browser records: review the supplier and update, not just the absence of an upload API in an earlier release.

The browser suite exercises a fresh browser context at a different loopback hostname using both a single private bundle and separate exact edition/record exports. This proves the storage/restore path in those engines; it does not establish physical-device transfer, all domain/provider behavior or indefinite storage retention.

For a future hosted or synchronized variant, inventory frontend, storage service, origin, identifiers, record versions and existing device links separately. Treat secret links as access capabilities. Verify large payloads, concurrent conditional writes, encryption/key recovery and rollback against the actual production representation. Keep the old service and private exports until complete records and device access are verified. A visible site move is not evidence that its data moved. The default kit has no device links, account service or sync backend; these are requirements for a separate design, not hidden implemented features.

### Exact upload rules in the example monorepo

The first public trial found that Vercel’s Git build applies the selected application’s `.vercelignore` to repository-root paths. An allowlist that worked for a standalone CLI project removed the nested package; npm then picked up the parent kit or failed after isolation. Each packaged application now lists both its exact standalone inputs and their exact `examples/<reader>/` (or `showcase/`) counterparts, including the required ancestor directories. There is no wildcard exception for a whole application or collection. The stock root upload list remains unchanged.

Set **Include source files outside of the Root Directory in the Build Step** to **off** for these self-contained projects (`sourceFilesOutsideRootDirectory: false`). Confirm that build logs name the intended package and that the deployed outputs match the reviewed inventory. `npm run check:examples` exercises both ignore-rule scopes against required files and private/unreviewed sentinels, then compares every output byte. A green local build alone did not catch this hosting integration failure.

Compare deployed bytes rather than trusting the cache name alone. The example builders hash the raw hosting configuration as well as application assets. In the first Vercel release, all application/edition bytes and each worker's file list and logic matched; the generated worker differed only at its two identical cache-version substitutions. Record local/live hashes and isolate that exact difference before accepting it. Do not normalize arbitrary worker code or treat a matching identifier as evidence of complete caching. The live browser still has to verify its cache and pass an outage journey.
