# Literata — font provenance and license

The coordinating editor selected Literata for The Inward Life on 18 October 2026 under the human’s request for a distinct, topic-fitting and legible face for every edition. Its quiet humanist forms serve source reading and headings; the violet/gold aperture and the writers’ distinct commitments remain. The navigation wordmark, compact controls and metadata use the system UI face.

## Exact upstream and conversion

Pinned Google Fonts revision: `47d54ca1ebb14fd864695f1d39dc734f39017c33`, `ofl/literata/`. These were supplied as reviewed official inputs by the parent; no source passages were sent to a font or generation service. The upstream notice is Copyright 2017 The Literata Project Authors, with the [project repository](https://github.com/googlefonts/literata) named by the license.

| Upstream input | Pinned URL | SHA-256 |
| --- | --- | --- |
| Literata-Italic[opsz,wght].ttf | [Pinned upstream file](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/literata/Literata-Italic%5Bopsz%2Cwght%5D.ttf) | `d483dfaeba9cbf4ce71d32a52ee65df82f7e35b15fff8d1011cdb242d1fcd465` |
| Literata[opsz,wght].ttf | [Pinned upstream file](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/literata/Literata%5Bopsz%2Cwght%5D.ttf) | `b41138c9373112f32abb589cc22e8674b06ed4048b0c513be922bdd26f274440` |
| OFL.txt | [Pinned upstream file](https://raw.githubusercontent.com/google/fonts/47d54ca1ebb14fd864695f1d39dc734f39017c33/ofl/literata/OFL.txt) | `8742963604cd89dc81437811a850018fc03b2bfad686d7422c8235967c87614e` |

The final parent conversion uses fontTools 4.67.0 `woff2.compress`, preserving created/modified timestamps. The parent independently compared name/copyright/license tables, timestamps, cmap, horizontal metrics and every glyph outline with upstream and found them unchanged; there is no WOFF-specific metadata or character subsetting. These final compression-only files supersede the earlier timestamp-modified trial copies, which were never committed or admitted to publication. Each output retains 1,163 mapped Unicode entries. The complete upright face preserves 1,789 glyphs and the italic preserves 1,769 glyphs. Both retain the variable axes: `wght` 200–900 (default 400) and `opsz` 7–72 (default 12). Normal and real italic are separate full variable faces; italic is not synthesized from the upright file. The parent checked every character in the complete prepared library against the full Literata cmap and reported zero missing glyphs. Local browser verification additionally checks actual loaded face use and the supplied Greek coverage probe, emphasis and source layouts. These particular prepared witnesses contain no literal Greek codepoints; the probe is kept outside source text and is not presented as a quotation.

| Shipped flat asset | Bytes | SHA-256 |
| --- | --- | --- |
| `site/literata-italic.woff2` | 396676 | `38060b182b46a8b6c5f521982e86c59480f8811e77852ed563ce8a66a4adecb6` |
| `site/literata-normal.woff2` | 397212 | `230e5b1de4f4ace4d49c9fda9c8cf0851acb5425dce9067d89ff88aed93f325d` |
| `site/literata-OFL.txt` | 4389 | `8742963604cd89dc81437811a850018fc03b2bfad686d7422c8235967c87614e` |

## License and delivery

Both fonts remain under the SIL Open Font License 1.1, with the complete copyright notice and license shipped as [literata-OFL.txt](../site/literata-OFL.txt). The compression-only handling is documented with the [official OFL FAQ 2.2](https://openfontlicense.org/ofl-faq/#2-2); no reserved font name is declared in the supplied notice. The fonts are bundled with the reader and are not sold on their own. They are not relabelled as MIT-licensed; the reader code and original commentary retain their separate license.

CSS uses relative `./literata-normal.woff2` and `./literata-italic.woff2` URLs, `font-weight: 200 900`, `font-display: swap`, and inherited `font-optical-sizing: auto`. The service worker precaches both fonts and the license, and the local server sends `font/woff2`. No remote font requests are made. Browser positions wait for the current font set before restoration so a late face swap does not misplace the saved source block. Exact book bytes, source offsets, notes, drafts, storage keys and recovery formats are unchanged.

`publication.json` contains exact path/hash/provenance pins for the two binary fonts. The build enforces them before copying, and the enclosing kit publication audit admits only those exact WOFF2 bytes while retaining normal credential, private-path and unknown-binary checks. A font upgrade needs a new explicit review rather than a directory-wide exception.

Font-loaded phone 320/390px normal/large/actual 200% text, tablet/landscape, normal/italic/Greek, source notes/verse/contents table, focus/reference return, same-origin record continuity and stopped-origin offline reading are checked privately. Browser emulation does not certify physical device or screen-reader use. The no-JavaScript view hides active loading and controls and provides a truthful explanation and catalogue return.

## Compression structure

Independent comparison records the exact packaging differences: WOFF2 sets head.flags bit11 and recomputes the checksum adjustment. No source table is dropped. Created/modified timestamps and all name/license, cmap, metrics, outline, variation and hint-program data remain unchanged. No WOFF metadata or private payload is added.
