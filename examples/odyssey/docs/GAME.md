# Homeward

Four short sea crossings lead toward Ithaca. Each day has an original deity portrait, a self-paced introduction and an explicit sail button. A cleared day waits for the player; a lost day can be retried immediately with a repaired ship. Replay from day one is always a separate choice.

| Day | Active time | What changes |
| --- | --- | --- |
| Aeolus | 36 seconds | Broad rock channels and a first restless crew member |
| Poseidon | 38 seconds | Moving swells that push the ship sideways |
| Athena | 40 seconds | Narrower channels and overlapping crew warnings; pale brackets mark the passage, and Athena stills wave pushes while a sailor is reaching |
| Zeus | 42 seconds | Forecast crosswinds, narrower channels, moving swells, paired crew warnings and marked lightning strips |

The active voyage totals 156 seconds. No timer runs in an introduction, result, source view or pause. Separate counters show hull hits and wind-bag knots remaining throughout active sailing. Each warning sailor is untying the bag, with a visible seconds countdown. A successful tap says “Knot safe” and preserves the current allowance; a miss says “Knot lost”, removes one knot and releases a steering gust. Either counter reaching zero ends the current day. A last-hit or last-knot warning persists until the day ends or is restarted. Fast commands to two different active sailors are both accepted. P or Escape pauses; steering and crew commands also work with the keyboard. Rotation, loss of visibility and page departure clear held controls and pause play. A stalled animation frame also pauses instead of skipping into a hazard.

The ship, sea, rocks, island, wake, wind bag, sailors, deity portraits and icons are original canvas/SVG drawings. The palette and system serif/sans stacks follow the Odyssey reader. No source-cover pixels, remote assets, fonts or image services are used. Optional sound is newly authored with Web Audio and starts off. Original code/drawings use this example’s MIT license.

## Literary sources

The introductions paraphrase the pinned Samuel Butler edition. Aeolus’s ox-hide bag, silver binding, fair West wind and suspicious sailors come from Book X, especially `book-10-004`. Poseidon’s trident and storm come from `book-05-025`. Athena’s restraint of the winds and help beside the rocks come from `book-05-031` and `book-05-034`–`book-05-035`. Zeus’s cloud, West squall and lightning come from `book-12-037`–`book-12-038`. Butler names these gods Neptune, Minerva and Jove.

Book X, `book-10-006`, supplies the consequence of the crew loosening the bag: the released winds carry the ship away.

The game rearranges and condenses Books V, X and XII; these are not four consecutive days in Homer. The rock channels, three game-invented knots, repeatable crew warnings, pale passage guides, dodgeable lightning and second chances are game inventions. The quiet source view makes this distinction. Optional passage links are marked as spoilers and open the reader’s reference view in another tab, preserving the game and reading place.

The single quotation is an exact substring of `book-10-004`, attributed to Homer, Samuel Butler’s translation (1900), [Project Gutenberg 1727](https://www.gutenberg.org/ebooks/1727). Complete edition notices remain in the reader.

## Storage and integration

`game.json` pins the five runtime files. The existing return-route integration and scoped offline worker remain unchanged. The game does not import the reader database or change books, notes, highlights or reading positions.

The game alone writes `localStorage['newreading-homeward-days-v1']`: a version number, current day index and completion flag. A cleared day saves the next day; retry saves the day being played. Reload offers the saved day’s introduction. Replay from day one resets only this game key. An unreadable save offers day one with an explanation; a failed write warns the player to keep the tab open. There are no accounts or analytics.

## Browser checks

`showcase/check-odyssey-game.mjs` uses ordinary trusted input and the visible passage guides. It covers full real-time progression, overlapping crew warnings, rock and wind losses, current-day retries, saved progress, replay, input release/cancel, simultaneous steering and crew taps in Chromium, rotation, pause/source views, focus containment, reader-storage isolation, reduced motion and storage failures. It verifies hull and knot allowances decrement separately from 3 to 0, success preserves knots, and rapid commands to paired sailors succeed. It never changes the game clock or injects a winning state. Five layout profiles cover 320×568 through 1280×800; Chromium and WebKit can be selected with `BROWSER` and the corresponding browser executable path.

Canvas and crew geometry follow the game container after load and on later size changes. Observation begins after load because an unstyled canvas can contribute to its parent's height. This fixes a WebKit initialization race in which the module measured the page before the stylesheet applied. Repeated measurements keep the existing drawing buffer when its dimensions have not changed; zero-sized containers are ignored. Day timing, courses and input rules are unchanged.

The layout regression holds the screen stylesheet until the module initializes, then checks actual canvas backing pixels, displayed canvas bounds and all three crew targets, including disabled sailors on the ready screen. It also changes container dimensions without a window resize and checks rotation before and during play. Both engines run all five profiles at twice the CSS pixel density. `LAYOUT_ONLY=1` runs this bounded regression without the full campaigns; the default check includes it alongside the existing gameplay checks.

Real navigation checks `pagehide`; separate synthetic blur and visibility events check their handlers. Headless lifecycle commands are recorded without claiming that they reproduce a physical phone switching apps. Browser emulation does not establish physical-device acceptance. This remains a visual action game with keyboard support, without an equivalent nonvisual mode.

The browser check runs at most two full campaigns concurrently by default (`CAMPAIGN_CONCURRENCY`). Production caps frame time for fair collision handling, so a constrained browser may take longer than the nominal crossing duration. The test requires continuing visible progress, fails after a 15-second progress stall, and has a finite wall limit of four times the initial countdown plus 15 seconds (minimum 90 seconds). Exact cleared/won and failure assertions remain mandatory. This replaces a fixed 60-second wall limit that expired while large WebKit canvases were still advancing on CI.
