# Fidelity and preparation receipt

Prepared from the exact PG 28885 HTML ZIP identified in [SOURCE-AND-RIGHTS.md](SOURCE-AND-RIGHTS.md). The adapter is [prepare-alice.py](../scripts/prepare-alice.py); the independent comparison is [check-alice-source.py](../scripts/check-alice-source.py). Private element-to-block mappings and detailed receipts are in `.reader/reports/`. The exact prepared file and image hashes are pinned in [assets.json](../edition/assets.json).

## Coverage established

| Feature | Result |
| --- | --- |
| Reading sections | 19, including all front matter and the complete 12-chapter narrative |
| Prepared blocks | 964 |
| Literary character sequence | 119,279 non-whitespace characters, identical in order to the supplied HTML body after accounting for page labels and image initials |
| Source header, credits and complete licence | Complete character sequence agrees independently |
| Verse and chorus blocks | 19; every explicit line break and blank line compared |
| Source emphasis | 296 ranges in the literary body; strings and multiplicity agree, including nested smallcaps and the bold caption |
| Transcriber corrections | All 13 corrected strings and explanations retained; touch/keyboard-accessible explanations |
| Source page markers | All 168 labels retained in source order, including the source’s non-monotonic front-matter labels |
| Image assets / placements | 38 original byte payloads, 43 uses; all decoded payloads agree with ZIP members |
| Tail poem | 49 printed lines plus its explicit trailing break, with each HTML indentation and size fraction preserved |
| Offset model | This pinned source uses BMP characters; Python offsets equal browser UTF-16 offsets. Asserted, not assumed for future inputs. |

The bounded kit EPUB preparation returned exit 2, `needs-adapter`, `manifest-feature`, no candidate. Its first unsupported specialized image resource stopped inspection; its receipt is **not** a full EPUB coverage report. The local adapter instead processes the pinned HTML archive, whose resources, structure and actual content were inspected. The untouched source EPUB remains available as an independent e-reader download.

## Deliberate, visible adaptations

- The source’s HTML line-wrap whitespace is collapsed according to HTML reading semantics. Paragraphs use explicit two-newline separators. No dehyphenation, spelling modernization, quote replacement or Unicode normalization is performed. Source `br` breaks remain, including blank verse lines and the three-break gap before the closing “BUT” paragraph.
- Literal source headings remain. A duplicate interface heading is visually suppressed on chapter pages, leaving the source chapter number and title visible in normal and focus reading.
- Small capitals are typographic spans over unchanged characters; italic/bold/superscript/subscript ranges are retained. The shrinking mouse’s tail is live selectable text, not a screenshot. The source’s repeated `tale21` size and unscaled “nothing” line are retained rather than silently regularized.
- **Uniform type** removes the tail’s shrinking and indentation, retaining the exact characters, breaks, emphasis and annotation anchors. Source shape remains available. At 36 px on a narrow phone its original geometry needs local horizontal scrolling; the alternate uniform view is deliberately available beside it. Ordinary long verse lines can wrap within the reading width without losing explicit line breaks.
- Image initials are retained as ornaments beside transcribed selectable opening letters. This avoids losing the opening A, T, or quotation mark during selection/export. It is an accessible reading adaptation, not a facsimile.
- The rabbit-hole drawing was a CSS background behind two prose paragraphs in a 600 px layout table. Both paragraphs remain in order, and the unchanged drawing follows them. Empty HTML `br` spacers used solely to size that background are replaced by the image’s intrinsic dimensions. This repositioning is documented; the original composite page has not been claimed as reproduced.
- Source plate captions remain where they occur in the source’s logical order, generally before the image. Table-based plate layouts become sequential caption/image blocks. The contents, plate list and edition-comparison tables keep row/cell order, tabs and links, with local horizontal scrolling where needed. The separate Contents navigation gives a more accessible section route.
- Margin page labels are metadata anchored to exact text offsets, not inserted into quotations. Their visual labels are separate from the text’s `textContent`. Source corrections open their original explanations, preserving the corrected source words. The source’s incorrect or imprecise image alt text is inventoried separately; new descriptions reflect the inspected pictures (for example, the source calls the Chapter III mouse a “Dormouse”).
- The source header and full licence are collected in a separate final section, not presented as Carroll’s prose. The full licence remains immediately accessible offline; the source’s licence notice is shown on first tab access. Edition-comparison links retain their displayed source numbers; the source’s malformed self-link is repaired to the catalogue, and insecure Gutenberg links become HTTPS. Internal contents/plate links resolve to their section while preserving the printed page labels.

## What this does not establish

Character conservation is not the same as accurate print transcription. The source retains its own supplied corrections, oddities and possible defects. The digital text has not been compared line-by-line with a separate physical volume or all underlying scans. Visual review covered the source contact sheet, title page, representative plates, original HTML tail/proem layout, and settled app captures of the actual text at phone/tablet sizes, including enlarged type. This is a faithful, documented digital-source adaptation; **not** a claim of complete human proofreading, exact facsimile typography, physical touch QA, screen-reader certification or e-ink acceptance.

Future EPUB export must carry local images and alt text, page anchors, corrected-source notes, captions, smallcaps/emphasis, exact verse breaks and CSS geometry or a documented accessible alternate, navigation order, source credits/licence, and precise edition identity. Export of web annotations would require a separate mapping/format design. A link to the source EPUB does not implement that export or synchronization.
