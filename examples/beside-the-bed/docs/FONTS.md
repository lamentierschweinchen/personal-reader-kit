# Bitter typeface provenance

The coordinator selected Bitter under the human’s typography brief for Beside the Bed: a sturdy slab serif for screen reading, headings and the existing empty-chair identity. Navigation, controls, sidenotes and source-license text retain the compact system UI face. Books, annotation anchors and saved state are unchanged.

Source: the [Google Fonts Bitter directory](https://github.com/google/fonts/tree/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/bitter), pinned to revision `47d54ca1ebb14fd864695f1d39dc734f39017c33`. Copyright 2011 The Bitter Project Authors; Reserved Font Name “Bitter Pro”. Full SIL Open Font License 1.1 is preserved at [site/OFL.txt](../site/OFL.txt), distributed and cached with the two font files. It is separate from the MIT application license and the book source notices.

| Original upstream file | SHA-256 |
| --- | --- |
| [Bitter variable upright TTF](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/bitter/Bitter%5Bwght%5D.ttf) | `ef2b9a711fb02f1e5823b34da1b7450e0fc76793b7d733a8b41006e24916d4a7` |
| [Bitter variable italic TTF](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/bitter/Bitter-Italic%5Bwght%5D.ttf) | `5e6e0af503171c9d7b4be7a22c16f474d7a638cf83a80051d825bcc58d664bc3` |
| [OFL.txt](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/bitter/OFL.txt) | `152a1e283e23b42c4940da4c72f2f5bebaa17969cb77c76d7af05903846006f1` |

The final supplied release receipt records compression only with fontTools 4.67.0 `woff2.compress`. The coordinator independently verified unchanged upstream name/copyright/license tables, created/modified timestamps, cmap, horizontal metrics and every glyph outline, with no WOFF metadata, subsetting or design changes. The earlier timestamp-changing preparation is superseded. See [OFL FAQ 2.2](https://openfontlicense.org/ofl-faq/#2-2) for the WOFF compression exception and its metadata requirements. Both faces contain 977 glyphs and only the `wght` axis, range 100–900. There is no optical-size axis to configure. CSS declares that full weight range, separate normal and real italic faces, `font-display: swap`, and no synthetic italics/weight. Greek is outside this font's coverage and uses the explicit Georgia / Times New Roman / serif fallback; no source character is substituted.

| Shipped flat asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `site/bitter-normal.woff2` | 113984 | `909e4081666953dc96de920c7fd5158daaca30ad6b2c352c859cc425dbf86ae1` |
| `site/bitter-italic.woff2` | 113520 | `edda4dc6263ff6a4e43df69ccc58d69e9b9b6f4a06f29bba3f35927fd61cfe28` |
| `site/OFL.txt` | 4424 | `152a1e283e23b42c4940da4c72f2f5bebaa17969cb77c76d7af05903846006f1` |

Only these two converted fonts and the unchanged license are copied into the flat runtime inventory. No TTF, release receipt, remote CSS or remote font request enters the application. The exact binary hashes and provenance/license paths are admitted by `publication.json`; the audit rejects changed hashes, unknown font paths and an unpinned binary. The build/worker includes both faces and the license; the local server uses `font/woff2` MIME. The public-copy integrator must preserve this inventory, provenance and license while applying its mount/cache namespace.

Verification uses loaded FontFace objects and text-metric differences from fallback, with Chromium platform-font evidence on actual source text and italics. Normal, large, computed 200% text, source layout/return, annotation and offline checks remain separate from publication and final identity-chat acceptance.
