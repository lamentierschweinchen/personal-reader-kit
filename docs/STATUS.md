# Kit status

## Adversarial self-review · 0.1.1

The local follow-up on 15 October 2026 fixes repeated-backup duplication, lost empty-block quotation separators, collapsed visual stanza spacing, unfinished-note dismissal, connection drafts lost during navigation/rerendering, stale-tab connection overwrites, and one damaged record hiding the whole local library. Prepared books now reject unsupported structure rather than silently removing it. Raw recovery exports include damaged book records. The Vercel upload list is exact, and the history audit also scans commit and annotated-tag metadata.

All 16 current Node tests pass and the public build still contains exactly 11 app/sample outputs. Chromium and WebKit pass the expanded regression at all five viewport sizes below, including measured visible stanza gaps, close/Escape/navigation draft guards, connection conflicts and draft export, healthy-book availability beside a damaged record, and raw recovery export. Both engines pass offline reload; WebKit uses a stopped origin with a failing direct network request as a negative control. Neither recorded script errors or external requests. The exact 36-file working/index set and reachable history pass the strengthened publication audit.

A separate critical review by the existing Canetti builder remains pending; reading the reference project's revision notes is not a substitute. Documented lessons already added to the agent guide include quiet reading controls, complete chapter continuation, meaningful contextual depth with measured duration, and real offline tests with negative controls. Existing personal readers remain untouched.

## Published first-release receipt

Version 0.1.0 is published as the public GitHub template [lamentierschweinchen/personal-reader-kit](https://github.com/lamentierschweinchen/personal-reader-kit), on `main`. The user approved that exact destination after the file/history review. The initial source commit `eb363c2` was verified against the remote. No Vercel site was deployed from this kit. The existing personal readers remain separate; this task made no changes to them.

Implemented: dependency-free static reader; two original sample works; direct text/prepared-JSON imports; exact text, whitespace and emphasis renderer; highlights/comments; focus and presets; per-book progress; separate spoiler boundaries; atomic browser storage; backup merge/recovery; three interactive sample experiences; local importer; explicit build inventory and publication audit; four-step agent and GitHub/Vercel guides.

Verified on 15 October 2026:

- All 12 Node tests pass, including exact Unicode/whitespace conservation, anchor/source mismatch handling, backup conflicts, independent spoiler state, excluded build files and detection of removed private files in Git history.
- Chromium and WebKit pass five viewport sizes each: 402×874, 874×402, 820×1180, 1180×820 and 320×740. Reading is also checked at the Large print preset. Source text remains exact and layouts have no page-level horizontal overflow in the tested flows.
- Both engines pass selection/highlighting, comment persistence, failed-write draft retention, independent progress, spoiler gating, same- and different-note tab conflicts, draft export, corrupt-state preservation, local Unicode import, reload and malformed backup rejection. No script errors or external requests were observed.
- Chromium passes offline reload with a locally imported book. WebKit passes reload with the origin server stopped, including the local book; a direct network request correctly fails as a negative control.
- The production build includes exactly 11 application/original-sample files. No application dependencies or backend are required.

These are automated browser-engine checks, not physical iPhone/iPad tests or a live Vercel deployment. Local screenshots and the machine-readable browser receipt are in ignored `test-results/`; exact publication inventory receipts are in ignored `.reader/`. All browser fixtures are newly written test text, not personal books or actual annotations. Final commit and publication status are in the completion handoff.

Next choices: whether the working name “Reading” should remain, and which real material-led experience to refine next. The public repository destination is established. A future personal website needs its own target, privacy choice and deployment verification using the included guide.

Known first-version limits: EPUB/PDF conversion is assisted rather than automatic; no DRM bypass, image/table renderer, interactive source-footnote engine, full-text search, live map/routing, automatic cross-device sync or authenticated hosted-book backend. Original-sample prototypes demonstrate the workflow; they do not automatically adapt to imported works. Physical iOS selection and storage behavior remain to be checked on real devices.
