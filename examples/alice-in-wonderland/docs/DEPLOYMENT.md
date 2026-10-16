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
4. Inspect `dist/`: it must contain only the 12 listed app/sample outputs. Confirm no input books, backups, notes, `.env`, `.vercel`, `.reader`, test screenshots or existing reader source is included. The build uses a fixed allowlist and approved original-sample hash.
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

## Verify and hand off

Do not equate a successful build with a usable site. After the approved deployment, verify:

- Root, script, stylesheet, `library.json` and worker load on the actual domain. No unexpected external requests or console errors.
- The library response contains only the two original works. Requests for `.reader/`, source books and backups return no private content; a generic error/404 is expected.
- Import a harmless original fixture from a phone/tablet. Confirm it is retained after reload and no upload request appears. Do not use a copyrighted book to probe deployment safety.
- Select text, save/edit a note, leave and resume the same section, open an exploratory passage and return. Export a backup and verify a fresh-browser restore with original fixtures.
- Confirm the offline indicator, then disconnect and reload the reader and local import. Storage limitations still apply.
- Check the actual phone/iPad selection menus, keyboard, safe areas, zoom and orientation; emulation is only partial evidence.

Return the usable URL, commit and deployment identifiers, verification receipt, privacy model, recovery instructions and remaining limits. Keep credentials and provider linkage out of Git. Do not call a URL live or a push synchronized without checking the result.

## Choose an address and move without losing your library

Choose the canonical production origin before substantial importing. Localhost, preview URLs, a custom domain and a new domain are separate browser-storage identities. Switching addresses does not transfer or delete the old library.

1. On the old address, open Settings. Export a **private reading bundle**, selecting all needed exact editions. Separate passages/edition exports remain supported. Keep these files private; edition exports include full books. Also keep the raw originals and conversion receipt. Do not rely on re-converting an EPUB/PDF later to reproduce identical anchors.
2. Open the destination in a fresh browser profile/context, or use the new device. Review and restore the bundle (or import exact edition JSON files and the separate records backup). Confirm export record counts and sizes before and after transfer, then edition IDs, source fingerprints, exact quotations, emphasis/lineation, comments, saved comparisons and reading places. Set spoiler boundaries explicitly; normal restore does not widen them.
3. Reload and check an anchored passage and continued reading. Verify offline behavior separately after the cache is ready. Retain the old address and private backup until the destination is proved usable.
4. Before software or editorial updates, repeat the exports. The public shell’s new code has access to existing same-origin browser records: review the supplier and update, not just the absence of an upload API in an earlier release.

The browser suite exercises a fresh browser context at a different loopback hostname using both a single private bundle and separate exact edition/record exports. This proves the storage/restore path in those engines; it does not establish physical-device transfer, all domain/provider behavior or indefinite storage retention.

For a future hosted or synchronized variant, inventory frontend, storage service, origin, identifiers, record versions and existing device links separately. Treat secret links as access capabilities. Verify large payloads, concurrent conditional writes, encryption/key recovery and rollback against the actual production representation. Keep the old service and private exports until complete records and device access are verified. A visible site move is not evidence that its data moved. The default kit has no device links, account service or sync backend; these are requirements for a separate design, not hidden implemented features.

## Alice trial override

The instructions above describe the original kit. This project deliberately builds a reviewed public-domain Alice edition instead of the original sample library. Read `README.md`, `docs/SOURCE-AND-RIGHTS.md`, and `docs/KIT-FEEDBACK.md` before treating any output as publishable. The current local candidate has thirteen outputs: the original twelve plus `share.mjs`. `library.json` includes the entire source text and 38 embedded images. No publication destination has been selected; no push or deployment is authorized. `npm run audit:public` runs both the inherited full-history boundary checks and a project-specific decoded-asset/edition-history gate.
