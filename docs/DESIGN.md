# Reading in good company

Visual thesis: a pocket literary journal with warm paper, dark ink and a single vermilion margin; spacious, intimate and slightly eccentric in its typography.

Content plan: an open shelf with two original miniature works; a quiet reading surface; a separate companion with three experiential sketches; personal passages and settings close at hand. The book is the visual anchor. No dashboard, decorative map, stock travel photography or reward system.

Interaction thesis: a short page entrance, a precise underline on navigation, and a gentle dialog entrance establish continuity. Reading itself does not animate. Reduced motion removes all three. Focus mode retains a reachable exit, chapter title and continuation, while hiding spoiler administration. Short landscape windows keep only the reading toolbar sticky.

Use the device's bookish serif stack (Iowan Old Style, Palatino, Georgia) with its system UI face. Type and space carry the composition; fonts require no remote requests. A red margin rule and expressive shelf titles stay outside the text surface. Source emphasis is explicit and never inferred from a block's decorative role.

The working name is **Reading**. The published repository is `personal-reader-kit`. Simple presets are Paper, Dusk and Large print; they share exactly one reading interface and adjustable type size, leading and measure.

Source whitespace owns the reading rhythm: do not replace differing stanza gaps with uniform paragraph margins. Keep operational status quiet in the normal reading flow, while making failures legible and recovery reachable. A chapter's title and an in-flow continuation belong to the reading experience, including in focus mode.

The original sample, *The distance of a bell*, is about a walk, incomplete attention and return. *A room after rain* provides a second small work. Their three prototypes are structurally different:

1. **A listening walk**: move through three fictional situations, with attention prompts and passage context. This is an experiential sketch, not navigation.
2. **An echo index**: choose literal text and locate every occurrence in permitted sections across samples and local books, with occurrence highlights and preserved source formatting. No invented authorial intention.
3. **Facing pages**: choose two kept passages and save a private connection with both quotations and edition identities. This explores the anthology's gaps rather than presenting an automatic interpretation.

These demonstrate the breadth of the agent workflow. An undecided exploratory journey uses three new proposals grounded in the actual material. An existing choice or specific revision should be refined without imposing another selection ceremony. Choosing a sample prototype is optional and does not prescribe the design of a future import.

The shared renderer is used for source excerpts as well as main reading. Neutral comparison prompts leave room for difference, refusal or no relationship. The companion introduction stays compact on a phone so comparison does not begin after a page of administration.

## Interface icons

Unicode arrows used as interface icons have appeared as colored emoji or inconsistent fallback glyphs on iPhone in both reference-reader experiences. Treat this as a recurring platform issue. Do not rely on a preferred font or a text-presentation selector to suppress emoji.

When an arrow helps navigation, reuse the `ui-arrow` SVG path in `site/index.html` and the `arrow()` helper in `site/app.mjs`. The `.ui-icon` styles define `currentColor`, a 1.5-unit stroke, a .95em size and a -.125em baseline; direction classes rotate the shared path. Keep the icon decorative with `aria-hidden="true"` and `focusable="false"`. A visible textual link/button name must still explain the action without the icon. Check contrast and alignment in each theme, at enlarged type and in focus mode.

Quiet, repeated bibliographic links should use a clear label and underline without an arrow. The example source links deliberately do so. This rule applies only to authored interface chrome: never replace, strip or normalize arrows, emoji or other punctuation in the book, quotations or reader notes.

The scoped regression checks authored UI files for arrow glyphs; browser checks cover shared-path rendering, decoration semantics, textual control names and plain source links. Inspect phone/tablet screenshots in Chromium and WebKit for weight, baseline, clipping and unnecessary visual noise. Browser emulation does not establish physical iPhone/iPad behavior. Functional tests and sufficient word counts establish neither visual quality nor worthwhile editorial content; those require looking and reading.

## Reading ergonomics

The usable reading area matters more than a no-overflow result. Measure persistent chrome in short landscape viewports, both dimensions of touch targets, and any text hidden by floating controls. Quiet mode still needs orientation, continuation, selection and a reachable exit. Give long titles hierarchy or a navigation preview without changing full source headings.

Context should make the exact words visible. Scroll to a selected range or search occurrence inside the actual container, accounting for headers and enlarged type. Centering a very tall paragraph can leave its marked words offscreen. Review settled captures of the requested book/section after fonts and finite transitions finish; then assess the text and interaction, not merely the existence of a mark. The [agent guide's review criteria](AGENT-GUIDE.md#verify-the-reading-experience) make these distinctions explicit.
