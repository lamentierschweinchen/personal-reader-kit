# At Table — Newsreader

Selected by the coordinating editor under the human’s collection brief for this collection’s editorial, conversational character on 18 October 2026. Newsreader is used for collection headings, source reading and substantial notes. Compact operational controls retain the system sans face. It is self-hosted; there are no Google Fonts CSS or remote font requests.

## Provenance and licence

Copyright 2020 The Newsreader Project Authors, [Newsreader project](https://github.com/productiontype/Newsreader). SIL Open Font License 1.1. The complete unchanged licence/copyright notice is bundled as `site/newsreader-OFL.txt`, is included in the build/offline cache, and is linked from Sources & artwork. Fonts remain under OFL, separately from the reader’s MIT code and the historical books’ rights.

Official Google Fonts source revision: [`47d54ca1ebb14fd864695f1d39dc734f39017c33`](https://github.com/google/fonts/tree/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/newsreader).

The parent supplied complete WOFF2 compression-only files from that exact official revision, using fontTools 4.67.0 `woff2.compress`. The parent independently verified unchanged upstream name/copyright/licence tables, created/modified timestamps, cmap, horizontal metrics and every glyph outline. There is no WOFF-specific metadata, character subsetting or design change. The final supplied pins supersede an earlier preparation that changed the head.modified timestamp; those earlier bytes are not included or committed. See the [OFL FAQ on format compression](https://openfontlicense.org/ofl-faq/#2-2). Only the two WOFF2 files and licence were copied into this project’s flat site assets. No TTF, raw metadata or conversion cache is a public runtime input.

| Input or included asset | SHA-256 |
| --- | --- |
| [Original roman TTF](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/newsreader/Newsreader%5Bopsz%2Cwght%5D.ttf) | `8a08d13f8a6c0d51be379a60af84f945f65369a67e509ee3c3bdcc421254d7c1` |
| [Original italic TTF](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/newsreader/Newsreader-Italic%5Bopsz%2Cwght%5D.ttf) | `796668611f80b64d5adf182fde3b6f29ed83b4e7cbec7b96937e84ac01364792` |
| `site/newsreader-normal.woff2` · 214,960 bytes | `52f54c34206c51e23e2907bfda4f04fb11ac6ba7f75f8021b2d0075b091d1308` |
| `site/newsreader-italic.woff2` · 239,360 bytes | `8920f06c4c116e91721a2cbbbb195d1ab6997a657cb3313dab5c99b6b202d899` |
| [Original OFL](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/newsreader/OFL.txt), copied as `site/newsreader-OFL.txt` · 4,394 bytes | `fdfad38143ec470553cae82a1e45320bdd1b9ec70415d37bd0171051d8a4ded8` |

Both faces expose `wght` 200–800 (default 400) and `opsz` 6–72 (default 18). Relative CSS font URLs support canonical subpath mounting. CSS declares the correct variable weight range, distinct normal and real italic faces, `font-display: swap`, automatic optical sizing and no synthetic styles. No manual optical-size override prevents the browser from matching the current text size.

Each Newsreader face preserves 658 glyphs and 564 mapped Unicode entries; neither face provides Greek. The device serif stack remains explicit fallback for scripts outside coverage. The parent checked every actual source character against the full font cmap and found zero missing glyphs. The three frozen prepared editions contain no Greek characters; this is not a claim that Newsreader covers every possible future import. A fallback does not authorise transliteration or source-character replacement.

## Exact publication and verification

`publication.json` pins both binary paths and their exact bytes, this provenance document and the exact bundled licence hash. The enclosing kit auditor permits only these named font versions and continues scanning for private paths/credentials; it does not waive other binaries. The builder independently checks the font pins and licence before copying them. Both faces and the licence enter the flat asset list and content-versioned offline cache; the local server supplies `font/woff2`.

The source project’s font trial recorded actual loaded faces/resources and Chromium platform-font evidence, with WebKit loaded-face/measurement evidence, rather than inferring success from a CSS family name. Its private receipt/captures cover normal, large and actual 200% computed reading text on phone, tablet and short landscape; original emphasis, notes, verse/aligned tables, focus, source returns and offline reload. Physical-device and assistive-technology testing remain separate. All prepared-edition bytes must remain identical through this typography change.

## Compression structure

Independent comparison also records the exact packaging differences: WOFF2 sets head.flags bit11 and recomputes the checksum adjustment; the empty source DSIG table (zero signatures) is omitted. Created/modified timestamps and all name/license, cmap, metrics, outline and hint-program data remain unchanged. The glyph count is distinct from the Unicode cmap-entry count.
