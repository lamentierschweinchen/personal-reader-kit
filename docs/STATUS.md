# Initial kit status

This is a local, public-intended version 0.1.0 in the Reading repository. No remote is established and nothing has been pushed or deployed from this kit. The existing personal readers remain separate and unchanged.

Implemented: dependency-free static reader; two original sample works; direct text/prepared-JSON imports; exact text, whitespace and emphasis renderer; highlights/comments; focus and presets; per-book progress; separate spoiler boundaries; atomic browser storage; backup merge/recovery; three interactive sample experiences; local importer; explicit build inventory and publication audit; four-step agent and GitHub/Vercel guides.

Verified on 15 October 2026:

- All 12 Node tests pass, including exact Unicode/whitespace conservation, anchor/source mismatch handling, backup conflicts, independent spoiler state, excluded build files and detection of removed private files in Git history.
- Chromium and WebKit pass five viewport sizes each: 402×874, 874×402, 820×1180, 1180×820 and 320×740. Reading is also checked at the Large print preset. Source text remains exact and layouts have no page-level horizontal overflow in the tested flows.
- Both engines pass selection/highlighting, comment persistence, failed-write draft retention, independent progress, spoiler gating, same- and different-note tab conflicts, draft export, corrupt-state preservation, local Unicode import, reload and malformed backup rejection. No script errors or external requests were observed.
- Chromium passes offline reload with a locally imported book. WebKit passes reload with the origin server stopped, including the local book; a direct network request correctly fails as a negative control.
- The production build includes exactly 11 application/original-sample files. No application dependencies or backend are required.

These are automated browser-engine checks, not physical iPhone/iPad tests or a live Vercel deployment. Local screenshots and the machine-readable browser receipt are in ignored `test-results/`; exact publication inventory receipts are in ignored `.reader/`. All browser fixtures are newly written test text, not personal books or actual annotations. Final commit and publication status are in the completion handoff.

Still to decide: the public GitHub owner/name; whether the working name “Reading” should remain; which real material-led experience to refine next. A public push requires the final exact file/history review and target confirmation. The naming decision does not block local implementation.

Known first-version limits: EPUB/PDF conversion is assisted rather than automatic; no DRM bypass, image/table renderer, interactive source-footnote engine, full-text search, live map/routing, automatic cross-device sync or authenticated hosted-book backend. Original-sample prototypes demonstrate the workflow; they do not automatically adapt to imported works. Physical iOS selection and storage behavior remain to be checked on real devices.
