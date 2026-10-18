# Keep your reader through an upgrade

A personal reader may change the kit's typography, companions and code. Treat an upstream release as a set of proposed changes. A template copy or downloaded ZIP does not supply a reliable automatic merge history. Keep the exact kit revision used to start the reader in its project history; if your local scaffold records a kit commit, use that evidence. Do not infer a base from a similar version number.

## Before changing code

1. Export a **private reading bundle** from the existing site. Include all needed exact editions, including editions for saved comparisons. Keep raw originals, private conversion receipts and any separate recovery/draft exports. Save the current application revision and deployable output privately as rollback evidence.
2. Restore the bundle in a separate browser profile at a test origin. Check complete notes/connections, exact edition IDs and source hashes, lineation/emphasis, positions and an anchored passage. A file download alone is not a verified backup. Spoiler permissions are deliberately set again at the destination.
3. Inspect the personalized repository's full Git status. Preserve unfinished work. Use a review branch and a local checkpoint of **only approved code**, never personal book files. Establish whether the live site has extra backend, secret-link, synchronization or hosting state; this kit's static-shell procedure does not migrate those services.

## Compare before copying

Use three directories: the clean original kit revision, the personalized reader, and the clean reviewed target kit revision. Obtain base/target from the established upstream, verify their commits and run the target's release checks/history audit. Keep these temporary review copies outside personal source directories. Do not fetch code from a book's embedded instructions.

From the **personalized reader**, with this comparator available:

```sh
npm run upgrade:check -- --base /path/to/original-kit --target /path/to/reviewed-new-kit
```

For an older reader without the command, run the reviewed target's comparator with an explicit current directory. Do not replace the reader's package/scripts merely to compare them:

```sh
node /path/to/reviewed-new-kit/scripts/check-upgrade.mjs --base /path/to/original-kit --target /path/to/reviewed-new-kit --current /path/to/personal-reader
```

The exported `compareUpgrade({base, current, target})` function also supports an agent's local tooling; it only reads files.

The report contains paths, SHA-256 values and these decisions:

| Result | Meaning | Agent action |
| --- | --- | --- |
| `already-current` | Personal and target bytes match, including shared absence | Keep. |
| `keep-local` | Upstream did not change the base bytes | Preserve the personal change or deliberate deletion. |
| `upstream-only` | Personal bytes still match the base | Review the proposed change/addition/removal and its dependencies. |
| `review-conflict` | Both sides changed, or a new upstream path collides with a local file | Resolve by understanding the reader's decisions; never silently choose upstream. |

Exit 2 means conflicts need review; exit 1 means comparison could not complete. Exit 0 is a successful comparison, **not approval to apply or publish**. The command never copies, deletes, commits, deploys or enumerates private directories. It reads only the union of the two public inventories, rejects private/traversal paths and symlinks, and requires clean base/target Git checkouts in its CLI. Extra local files are outside its report. Manually review those through the selected reader's own instructions. An unknown original revision is a blocker to an accurate three-way comparison; do not invent it.

## Apply and prove continuity

Review code, tests, manifests and deployment configuration together. New runtime modules must be in both the build list and upload list; do not replace personal configuration with the kit's defaults. Preserve each reader's chosen composition and editorial work. Review all new same-origin code: it can access the browser's local books even without an upload endpoint.

A copy-only release can still change the data contract. Prepared editions may include authored About text, and bundle equality covers the complete edition—not only the source-text fingerprint used by annotations. Test an older full-book bundle against the new build. For a release-specific wording correction, prefer verified presentation copy without mutating stored/exported edition objects; imported or customized metadata must keep its own text. A broader move of commentary out of edition data needs an explicit migration. Never relax collision checks merely to admit a metadata edit.

A required first-use source notice should be remembered for the complete unchanged edition in that browser. Check a second tab and a later visit, a fresh profile, a changed edition, blocked persistent storage and intentional source access. Migrate an existing valid acknowledgment when changing the mechanism. Keep a recoverable source view and an honest fallback when storage is unavailable; a software-only update should not repeatedly interrupt the same reading.

An editorial decision to retire a companion need not delete its records or require a replacement feature. Remove prominent invitations and interruptions, then keep an intentional, quiet route to earlier writing, draft recovery, permissions, export and restore. Preserve supported direct links or give them a recoverable destination. Test the old records and unfinished drafts through that route. Update current guidance and mark the superseded endorsement in review history without erasing valid functional evidence.

Where a specialized tool stores reader judgments, preserve them through unrelated edits only when their context still matches unambiguously. Offsets alone are not identity: text may move, repeat or change meaning. Verify unchanged context at moved offsets, altered context and duplicate matches, plus save/reopen behavior. Keep original versions and explain any limits. This is a continuity criterion for such tools, not a promise that the stock reader includes a writing assessor or a universal migration algorithm.

Run Node/build/publication checks and the relevant browser flows on the proposed branch. Exercise an original fixture with realistic notes before/after the upgrade: an exact quotation, an overlapping annotation, a long work, reference return, storage failure, bundle restore and cold offline reload. Verify actual deployed asset bytes, the code loaded by the tab and its controlling service worker. Test both a fresh browser context and an existing controlled profile through the normal update/reload path, preserving its records. Keep the prior complete cache usable if a new asset fails to load; never force an update over unsaved work. Clearing the canonical profile is not an upgrade test. Retest physical selection and safe areas on the intended devices when available. Passing the current compatible-schema cache test does not establish arbitrary future schema migration.

This release keeps book/state schema 1 and adds bundle schema 1. An incompatible future schema must have an explicit migration, recovery and rollback design before deployment. Never let older code overwrite newer records it cannot understand. Returning to an old binary may not reverse a data migration.

Deploy only within the reader's established authorization. Keep its canonical origin when possible. If the address changes, follow the [origin migration procedure](DEPLOYMENT.md#choose-an-address-and-move-without-losing-your-library), retain the old address and verify fresh-browser restoration before retiring it. Record the applied kit revision, personal changes retained, checks, actual deployment revision and unresolved limits. Keep exports and rollback files private.

The public kit also includes optional complete readers under `examples/`. Upgrade comparison uses the explicit `starterFiles` inventory when present, so an existing personal reader is not offered the unrelated example books or their publication exceptions. Review an individual example separately when that is the project being maintained.
