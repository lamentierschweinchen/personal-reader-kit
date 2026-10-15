# History boundary

The Reading directory is one independent kit repository. Work began on `codex/reader-kit` with a local reviewed checkpoint. On 15 October 2026, after the 36-file / one-commit audit, the user explicitly selected **Publish as lamentierschweinchen/personal-reader-kit**.

The approved public destination is `https://github.com/lamentierschweinchen/personal-reader-kit`, remote `origin`, published branch `main`. It is a GitHub template repository. The initial implementation commit is `eb363c2e9b7c53be6b6b06959ef580d2b5b8a179`; its remote SHA, public visibility and template setting were verified after publication. Subsequent documentation records the now-established destination. Routine reviewed kit updates are authorized for this repository; no Vercel project was created or deployed as part of the kit publication.

Existing personal readers were inspected read-only. Their site-specific hosting authorization does not transfer to this repository. No source history or book files from them are imported here.

Ignored `.reader/` and `test-results/` can contain private intake, recovery data and local verification captures. They are not backed up by Git. Browser books, annotations, progress and preferences live in IndexedDB. Export annotations and retain original book files separately. Browser storage can be evicted, and a second device does not automatically synchronize.

## Adversarial self-review · 15 October 2026

Version 0.1.1 repairs source-spacing and quotation fidelity around empty blocks, repeated-restore duplication, draft-loss navigation paths and stale connection saves. Damaged imported books are isolated and retained for raw recovery. Unsupported book structure fails explicitly. Publication protection now checks commit/tag metadata and exact Vercel upload inputs. Regression cases and current evidence are recorded in `docs/STATUS.md`. This is the kit builder's self-review; the requested review by the existing Canetti builder is still outstanding.
