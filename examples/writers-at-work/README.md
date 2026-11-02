# How writers write

[Open the reader](https://newreading.app/writers/).

Collected wisdom from Hemingway, Morrison, Atwood, and nine other writers. The collection has 105 short advice summaries, ten Atwood source cues, six comparative essays, and six writing exercises. Every advice item has a source note. Notes, unfinished notes and exercise drafts stay in the browser; download and recover a notebook to move or back up that work.

This is an original editorial collection about writing. It does not reproduce the complete works discussed. [Sources, rights and credits](docs/SOURCE-RIGHTS.md) distinguish the material included here from the linked works.

Run `npm test` and `npm run build` with Node 22 or later. The build reads only the exact pinned `edition/edition.json` and the named `site/` files; output goes to `dist/`. The default reader-kit build does not include this collection. The mounted browser journey is `node showcase/check-writing-reader.mjs --skip-build` from the kit root after building the showcase.

Reading requires a connection. The app has a bespoke Home Screen icon; installing it does not create an offline copy. Notebook exports remain accessible if the page shell loads but edition content does not. External source links open another tab and may require a subscription.

The public mount measures the same bounded pageview and library-link actions as the existing site. It sends no notebook text or hash-route values. This custom reader does not emit a reading-duration event or use the other readers’ IndexedDB/continuation format. Its own Continue link and notebook preserve its reading places.

The source project and its preparation history remain private. The kit contains only this reviewed package. No raw source captures, owner records or private research are included.
