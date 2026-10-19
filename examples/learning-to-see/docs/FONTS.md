# Alegreya — font provenance and license

Learning to See uses Alegreya for source reading, saved passages and headings. Its calligraphic book rhythm suits drawing instruction; the spare drawing-studio composition and compact system UI remain. The coordinator selected the family as part of the human’s distinct-edition typography direction.

Both faces are self-hosted, full WOFF2 fonts with no character subsetting. Upright and real italic each declare variable weight **400–900** and `font-display: swap`. The supplied axis inventory contains only `wght`; it contains no `opsz` axis. `font-optical-sizing: auto` is inherited, and has no optical-axis variation to apply to these exact files. Synthetic styles are disabled. Source characters, Unicode, emphasis markup, table/verse structure, notes and edition identities are unchanged.

## Exact distributed files

| Flat preparation asset | Bytes | SHA-256 |
| --- | ---: | --- |
| `site/alegreya-italic.woff2` | 170792 | `bb51b7d7a138ab9314eb8518b359534d1a51d91652a6fc60dae371a088ac7f77` |
| `site/alegreya-normal.woff2` | 161220 | `7b280b08beda4f54bed2c2e1cdc64063bc5b5bf38832cffbf04f5efadf3bfa87` |
| `site/alegreya-OFL.txt` | 4395 | `f6f60d5d4cf4f4b1fc4e41353c897a2f5a16e6396c0cd8fa8bdfd2f4586a9a68` |

`publication.json` pins each binary by its exact path, byte count, SHA-256, this provenance document and the tracked license path. The enclosing kit audit allows only those two named binary paths and matching bytes; private-path and credential checks still apply. The build’s explicit flat asset list includes both faces and the license; its worker caches them with the edition. No Google Fonts stylesheet, CDN or other remote font request is used. Relative CSS font URLs work in both the standalone public copy and the canonical mount.

## Official source and conversion receipt

Source repository: [Google Fonts Alegreya](https://github.com/google/fonts/tree/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/alegreya), revision `47d54ca1ebb14fd864695f1d39dc734f39017c33`.

The coordinator supplied the official-source receipt and converted files. Its final conversion receipt records WOFF2 compression only with fontTools 4.67.0 `woff2.compress`. The coordinator independently verified unchanged upstream name/copyright/license tables, created/modified timestamps, cmap, horizontal metrics and every glyph outline; no WOFF-specific metadata, subsetting or design changes. The earlier timestamp-modified preparation was superseded before this project’s font commit and is not distributed. See the [OFL compression-only guidance](https://openfontlicense.org/ofl-faq/#2-2). Both faces have 1,254 mapped Unicode entries; the complete upright preserves 2,172 glyphs and the italic preserves 2,179 glyphs. The recorded Greek check is `αἴσθησις`. This project copied the two supplied WOFF2 files and license byte-for-byte; it did not regenerate or alter the fonts. The coordinator’s independent cmap review found zero missing characters across the complete prepared library. The local Greek browser probe is verification material and is never inserted into either prepared book.

| Official input | Bytes | SHA-256 |
| --- | ---: | --- |
| [Alegreya-Italic[wght].ttf](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/alegreya/Alegreya-Italic%5Bwght%5D.ttf) | 425852 | `fa915eec76227935dc5fb678953c94b71287c360928013cfdb441dfe52f5a391` |
| [Alegreya[wght].ttf](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/alegreya/Alegreya%5Bwght%5D.ttf) | 425288 | `ba5564634b93a8f8ba57b48cd4f1ae7417d2b4656fbac779028679b00de3cf12` |

Copyright 2011 The Alegreya Project Authors (https://github.com/huertatipografica/Alegreya). The fonts are distributed under **SIL Open Font License 1.1**. The complete notice/license is included as [alegreya-OFL.txt](../site/alegreya-OFL.txt) and in the flat build output. The fonts remain under that license, separate from the project’s MIT code/artwork grant. Attribution does not imply endorsement by the font authors.

## Verification boundary

Receipts distinguish loaded font faces from a CSS family declaration. Browser checks wait for font loading, inspect FontFace status and exact same-origin font bytes, and inspect actual Chromium platform-font use for upright, italic and Greek text. Normal, Large print, actual 200% computed-font enlargement, tablet/landscape, source apparatus, source/quiet returns and offline loading are reviewed separately. Physical-device and screen-reader performance remain outside these browser checks. Private source-bearing screenshots and detailed receipts stay in ignored `.reader/`.

## Compression structure

Independent comparison also records the exact packaging differences: WOFF2 sets head.flags bit11 and recomputes the checksum adjustment; the empty source DSIG table (zero signatures) is omitted. Created/modified timestamps and all name/license, cmap, metrics, outline, variation and hint-program data remain unchanged. No WOFF metadata or private payload is added.
