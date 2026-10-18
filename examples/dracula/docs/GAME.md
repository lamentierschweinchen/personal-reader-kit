# Castle escape

Five short rooms turn Harker’s confinement into an imagined escape. Each room opens with a brief exact passage from his journal, a distinct illustration and one objective. Start is explicit and always reachable. Openings are untimed; movement keys cannot skip them. A caught player retries the current room immediately without repeating its opening. Five rooms give the castle a bounded arc: confinement, the English library, the ruined chapel, the courtyard, and a final attempt at the gate.

| Room | Floor plan | Route and useful objects |
| --- | --- | --- |
| Guest wing | 600×600 | Find the brass key, unlock the dividing arch, lift the stair bolt and reach the north stair. |
| Library gallery | 900×720 | Find the crowbar, force the barred passage and carry the winch handle from the south gallery to the north stair. |
| Ruined chapel | 1050×780 | Cross the south transept for the iron key, unlock the crossing and take the rope to the courtyard stair. |
| Silent courtyard | 1120×840 | Find the winch spindle, use the iron key at the yard arch and draw the carriage bolt before taking the east stair. |
| Great gatehouse | 1200×900 | Find the gate key, fit the carried handle, rope and spindle to the winch, raise the chain and reach the south gate. |

The first two rooms retain the previous release’s geometry, movement, item positions and patrols. The second room is furnished and named as a library. Two distinct middle rooms precede the retained gatehouse layout, whose winch now also uses the newly carried rope and spindle. Room dimensions and walkable floor grow; the active view remains 600×600 and follows Harker without shrinking characters or movement targets. A bearing points to an objective outside the view. Floor plan pauses play and shows the entire room, numbered objects, Harker’s location and the current view. It explicitly says when a room has not started.

Original SVG art supplies pointed windows, masonry, a hearth, a book-lined library with an open volume, chapel pews and a tomb, carts, crates, a well, lamps and cloaked figures. Solid furniture uses the same footprint for drawing, movement collision and sight occlusion. Architectural light sits beneath the red sight fans, with dark waiting alcoves kept distinct. There are no image-service, font or other third-party runtime dependencies. The example’s MIT license covers original code and drawings.

There is no time limit. Full entry into an alcove gives cover; stone, furniture and closed doors block sight and movement. Brief exposure fills a warning that drains out of sight. Gentler patrols move more slowly and allow more exposure. Pause, openings, source visits, floor-plan visits, interludes and the final screen freeze the game. Switching away, resizing or rotating clears held input and pauses active play. On-screen movement and essential actions retain 44px targets on narrow phones and in landscape. Long overlays and source passages scroll.

## Journal passages and reference visits

The source is the unchanged pinned prepared Project Gutenberg edition #345. All five quotations are contiguous exact excerpts. Their anchors and offsets are in `play/story.mjs`; its whole-file edition hash guards the optional context fetch. Selected context paragraphs contain no emphasis marks; tests check that assumption. Openings show chapter citations; dates are retained in the source view. The game rearranges scenes rather than asserting a continuous chronology: the library observation is dated 7 May, before the 8 May realization used for the guest wing.

| Opening | Exact source anchor | Source-view context |
| --- | --- | --- |
| Guest wing | Chapter II, `chap02-b061`, 8 May | `chap02-b060`–`chap02-b061` |
| Library | Chapter II, `chap02-b030`, 7 May | `chap02-b030` |
| Chapel | Chapter IV, `chap04-b050`, 25 June | `chap04-b050` |
| Courtyard | Chapter IV, `chap04-b081`, 30 June | `chap04-b080`–`chap04-b081` |
| Gatehouse | Chapter IV, `chap04-b083`, 30 June | `chap04-b083` |

Chapter citations and From the novel open game-owned `play/#reference/<section>/<block>` routes. The protected Dracula reader does not provide an equivalent reference route. The dialog displays complete pinned source paragraphs locally and marks and reveals the exact quoted range and leaves reader IndexedDB records, the reading place and chapter limit untouched. Closing it or using browser Back restores the same game position and phase; an active room stays paused until Resume. A failed context fetch retains the exact short quotation with a retry action. Direct reference URLs open the same untimed source view.

The opening identifies an imagined escape and its Chapters II–IV scope. The source view credits Stoker and Harker, links to [Project Gutenberg #345](https://www.gutenberg.org/ebooks/345), and states that the layouts, patrols and tools are invented. The chapel reference alone explains that Harker finds no outlet; the final reference distinguishes the imagined gatehouse escape from his plan to try the castle wall. Early Chapter II references do not disclose those later details. Full edition notices remain recoverable in the reader.

## Checkpoints

The five-room campaign writes `newreading-dracula-castle-v3` with `{version:3, completed, gentle}`. A valid current save takes precedence. If it is absent, an earlier `newreading-dracula-castle-v2` checkpoint is read without being changed: completed counts 0, 1, 2 and 3 map to 0, 1, 2 and 2. This credits the familiar first rooms and continues at the new chapel; completing the former three-room escape never marks the five-room campaign complete. A visible migration message explains the continuation. The earlier raw save is preserved even after Replay.

A malformed legacy save is left untouched while the new campaign uses its separate key. A malformed current save is quarantined: play continues in memory without overwriting it until the explicit Replay all rooms action. Replay first preserves its raw value under a separate recovery key; if that copy fails, the unreadable save remains untouched and the new run stays in memory. Read/write failures display a warning. Reload restarts the latest uncleared room with its carried tools; Retry keeps cleared rooms. Reader records use separate storage. The separately maintained `reader-return.mjs` preserves the reader route and handles scoped offline/update behavior.

## Verification

`game.json` pins all nine runtime files. The game unit tests cover source integrity, five-room geometry, constant view scale, collision/sight agreement, stable cover, tool dependencies, frozen phases, retry and checkpoint migration. `showcase/check-dracula-game.mjs` exercises actual keyboard and trusted Chromium touch completion, actual loss/retry, explicit openings, exact source references and Back/Close returns, IndexedDB reading-place preservation, checkpoint reloads, legacy migration, malformed saves, fetch/write failures, touch cancellation, rotation and five viewport sizes. A Node model selects safe departure windows; the browser receives real held input at normal animation speed. Completion is never injected into browser game state. Checkpoint fixtures used for migration and layout are identified separately.

Browser emulation is not a physical-device playtest. WebKit receives full keyboard completion and trusted tap checks; its public automation API does not provide touch holds. This remains a visual timing game without an equivalent nonvisual play mode. The combined release checks cover offline cache upgrades and reader return. Private, quotation-bearing editorial and playtest receipts are kept outside the public artifact.
