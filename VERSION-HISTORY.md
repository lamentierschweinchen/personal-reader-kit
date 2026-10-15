# History boundary

The Reading directory is one independent kit repository. Work began on `codex/reader-kit` with a local reviewed checkpoint. On 15 October 2026, after the 36-file / one-commit audit, the user explicitly selected **Publish as lamentierschweinchen/personal-reader-kit**.

The approved public destination is `https://github.com/lamentierschweinchen/personal-reader-kit`, remote `origin`, published branch `main`. It is a GitHub template repository. The initial implementation commit is `eb363c2e9b7c53be6b6b06959ef580d2b5b8a179`; its remote SHA, public visibility and template setting were verified after publication. Subsequent documentation records the now-established destination. Routine reviewed kit updates are authorized for this repository; no Vercel project was created or deployed as part of the kit publication.

Existing personal readers were inspected read-only. Their site-specific hosting authorization does not transfer to this repository. No source history or book files from them are imported here.

Ignored `.reader/` and `test-results/` can contain private intake, recovery data and local verification captures. They are not backed up by Git. Browser books, annotations, progress and preferences live in IndexedDB. Export annotations, exact prepared editions and raw originals separately. Browser storage can be evicted, and a second device does not automatically synchronize.

## Adversarial self-review · 15 October 2026

Version 0.1.1 repairs source-spacing and quotation fidelity around empty blocks, repeated-restore duplication, draft-loss navigation paths and stale connection saves. Damaged imported books are isolated and retained for raw recovery. Unsupported book structure fails explicitly. Publication protection now checks commit/tag metadata and exact Vercel upload inputs. Regression cases and current evidence are recorded in `docs/STATUS.md`. This is the kit builder's self-review; the independent Canetti review of `4eaeec6` subsequently arrived and is addressed below.

## Independent Canetti review · 15 October 2026

The 0.2.0 follow-up addresses incomplete-history auditing, content-pinned retired-file review, faithful companion excerpts, local-first startup, transactional damaged-state repair and exact-edition/origin migration. It extends literal occurrence search to imported books and stores chosen comparisons with both source references. Focus mode excludes companion administration. Editorial lessons, a sourced research case, explicit limits and the finding-by-finding disposition are in `docs/REVIEW.md`; execution and publication status are in `docs/STATUS.md`. No personal reader was changed.
