# Tea at Six

Three short tea-service courses inspired by Chapter VII of Lewis Carroll’s *Alice’s Adventures in Wonderland*. The original blue-ink tea party remains. A short exchange introduces pouring; further riddles interrupt the courses at the moment a new demand matters. Each exchange is untimed, with one Continue button and no answer entry or quiz gate.

1. **Time for tea — 32 seconds.** Hold cups to pour, release near the dotted line, and find a safe moment to refill the kettle. One seat change interrupts service.
2. **Butter belongs on bread — 36 seconds.** Four bread-and-butter requests compete with pouring and refilling. Serving occupies the player for 0.95 seconds, but the guest drinks more slowly while chewing. A missed request costs a chance.
3. **A clean start — 40 seconds.** Three seat changes introduce dirty cups, alongside four food requests. A dirty cup cannot be topped up. Replacing it takes one second and discards the tea inside; waiting saves tea but leaves less time to recover.

Three complaints lose the current course. Retry and Restart repeat that course while retaining earlier results. Replay all three starts a new run. Cleared-course checkpoints use the game-only sessionStorage key `newreading-tea-courses-v1`; reopening a checkpoint shows an untimed introduction. Storage failure is reported at the result or introduction. This is tab progress, not a permanent record or a reader bookmark.

## Time to read

Each course has one automatic reading break: at 18 seconds before the first seat change, at 5 seconds before the first bread request, and at 10 seconds before the first dirty-cup move. The pending demand begins only after Continue. The panel retains the exchange and its practical consequence for as long as the player needs. Later demands use the same visible request buttons and rules.

Reading breaks freeze tea, score, chances, empty-cup grace, refilling, service, requests and the course clock. They release held input and focus the heading; an old held key or pointer cannot continue pouring through the break. Continue requires a fresh deliberate action. Pause reopens the last reading exchange and rule, labeled “last reading break”; its wording applies to any guest with that request. Before the first break, Pause retains the opening exchange or course instructions. Brief status cues during pouring carry no essential dialogue.

All timers also stop during introductions, interludes, pause and About. Switching away, resizing or changing orientation releases held input and pauses active play. The player resumes explicitly. Touch and mouse holds pour; 1–3 pour by seat, Q/W/E serve that seat’s request, R refills, and P/Escape pauses. Cup buttons also accept held Enter or Space. A fresh Enter or Space on a focused reading heading continues. Sound starts off.

## Source and adaptation

The chapter’s riddles and quarrel with Time support the game’s frame. The butter-in-the-watch exchange supports course two; tea and bread-and-butter appear at the party. Moving round the table supports the first reading break, and the Hatter’s demand for a clean cup supports course three. In the packaged edition these are Chapter VII, blocks `chapter-07-b014`–`chapter-07-b023`, `chapter-07-b028`–`chapter-07-b031`, `chapter-07-b039`–`chapter-07-b068`, `chapter-07-b086`, and `chapter-07-b093`–`chapter-07-b094`.

The service timers, scoring, bread requests, dirty-cup tradeoff, guests moving with their cups and every exchange are original game inventions. They are not claims about rules or quotations in Carroll’s story. All SVG drawings are original; no Rackham image pixels or book excerpts are copied into the game. About credits the [source edition](https://www.gutenberg.org/ebooks/28885). Code and original drawings use this example’s MIT license. There are no external fonts, images, analytics or accounts.

The `game.json` inventory pins all six runtime files. `reader-return.mjs` retains its existing reader-return and scoped service-worker behavior. Reader notes, permissions, reading place and exact edition files remain separate and unchanged.

## Verification

`showcase/check-alice-game.mjs` exercises a complete run with normal browser inputs in Chromium and WebKit: natural loss and current-course retry in every course, all five seat changes, food and cleaning requests, frozen interludes, checkpoint reloads, final completion, replay, cancellation, orientation pause and About. It verifies each reading break, held-input release, explicit continuation, delayed demand, retained Pause speech and accurate recap when a different guest later requests service. Reading and recap panels are checked at 320×568, 390×844, 844×390, 820×1180 and 1280×800. No game-state writes or clock acceleration are used. Chromium uses touch holds and taps; WebKit also holds Space across a reading boundary. Emulation is not physical-device testing. Engine regressions independently freeze the entire state, including a refill and an active service, through each break.

The checker accepts `TEST_URL`, `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `WEBKIT_PATH`, `TEST_OUTPUT` and an optional comma-separated `ENGINES` filter. Its screenshots and receipts default to ignored `.reader/game-clarity/alice/browser/`. Publication still requires the complete kit build, inventory and public-boundary checks.
