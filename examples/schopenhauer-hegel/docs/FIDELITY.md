# Fidelity receipt

Review date: 16 October 2026. Baseline: the exact HTML editions linked in [SOURCE-RIGHTS.md](SOURCE-RIGHTS.md), with their unchanged raw downloads retained privately. Fingerprints identify those digital editions; they do not prove agreement with a printed original.

## Coverage

| Item | Hegel, volume 1 | Schopenhauer collection |
| --- | ---: | ---: |
| Prepared sections | 62 | 49 |
| Prepared blocks | 992, including the source cover | 363 |
| Non-whitespace source characters | 817,471 | 136,255 |
| Approximate whitespace-delimited words | 167,931 | 29,869 |
| Internal source links resolved | 420 | 8 |
| Source illustrations retained | 5 | 0 in the chosen HTML |
| Source tables retained | 4 (three contents tables and Zeno’s diagram table) | 0 |
| Verse blocks | 19 | 8 |

Every non-whitespace text node of the literary HTML body is under an inventoried source block. An independent body-to-prepared comparison agrees for every non-whitespace character, in order. All internal link destinations resolve; Hegel’s 173 note calls and 173 notes remain. The render test separately checks `textContent` for every block of all 111 sections, including links, emphasis, tables and Greek. These are coverage and conservation receipts, **not whole-work proofreading**.

## Decisions made by the adapter

- The selected source is HTML. The EPUBs were independently retained and inspected; they were not destructively simplified to fit the kit preparer. Both narrow-preparer calls exited 2, `needs-adapter`, `manifest-feature`, without an edition. Inspection found CSS, cover-image metadata and SVG cover wrappers; Hegel additionally requires source images, tables and linked notes. Its EPUB contains 41 members/28 spine items; Schopenhauer’s contains 13 members/4 spine items. Private archive inventories include every member hash.
- Browser DOM parsing decodes HTML entities and normalizes CRLF as HTML does. Ordinary HTML indentation and wrapping collapse to rendered spaces. Explicit `br` breaks and all `pre` characters remain. Structural paragraphs receive two newlines. Decorative blank padding before divisions is not reproduced as pages of empty space. No dehyphenation, Unicode normalization, spelling modernization or substitution of Greek is performed.
- The edition retains source headings, sequence, inline notes, emphasis, small capitals, printed page labels, source contents and transcriber notes. Navigation divisions follow actual headings; source headings themselves are not rewritten. Roman numeral errors such as Schopenhauer’s **XL.** where the surrounding sequence suggests XI remain visible. “It it clear,” “three of four,” and literal `{Greek: …}` source forms remain; uncertainties are not silently repaired.
- Tables carry ordered cell offsets, column spans and indentation. Zeno’s five columns preserve the source’s unequal width proportions. Tables scroll locally if necessary. They are not flattened into ordinary prose to pass validation.
- Hegel’s quoted verse keeps explicit lineation and the 1:2 proportion of regular and deeper indentation (scaled from 6/12 em to 1.5/3 em for reading screens). Schopenhauer’s eight `pre` blocks keep source whitespace and the italics applied by source CSS. This is a reflowable adaptation, not a typographic facsimile: device font metrics, page design, title-page sizes and source line wrapping can differ.
- Source page numbers appear as small inline labels instead of out-of-flow facsimile margins. This retains their characters and link targets while making narrow screens usable. Hegel’s cover is retained ahead of the title pages; it is an addition from the same HTML’s linked source-cover resource, not a newly generated illustration.
- Hegel’s source images had empty alt attributes. The adapter adds short **editorial descriptions**, explicitly identifying the cover, device and the three diagram stages. The image bytes are untouched. These descriptions are navigation aids, not new source text or a complete mathematical transcription of the diagrams.
- Source-note visits show the requested note. Further source visits offer Back to the passage, and closing an excursion restores the main place. A stored quotation keeps the original section/block/UTF-16 offsets, source hash and surrounding characters. A changed edition is never silently matched.

## Editorial receipt

[The session definitions](../site/lectures.mjs) select continuous full-paragraph ranges with exact anchors. They do not rewrite or splice a sentence into fabricated dialogue. Every opening requires an explicit choice to reveal the pair and surrounding sections; reading progress is separate. The permissions are temporary for that visit and are not smuggled into restored backups.

1. **Disagreement:** Hegel, Introduction / Common Ideas, `h0087–h0090`; Schopenhauer, Preliminary, `s0027–s0028`. The comparison distinguishes Hegel’s historical diversity from Schopenhauer’s interpersonal obstinacy. It does not equate those scales.
2. **Winning:** Hegel, Sophists, `h0670–h0672`; Schopenhauer, Preliminary, `s0029–s0034`, including its footnotes. Both distinguish argumentative success from its end or truth. The orientation acknowledges the positive role Hegel has already assigned the Sophists and the ironical character identified by Saunders.
3. **Judgment:** Hegel, Sources, complete opening paragraph `h0258`; Schopenhauer, Stratagem XXX, `s0158–s0164`, including the note and Latin verse. Hegel qualifies his direct-source ideal; Schopenhauer questions the evidential force of repetition. Their passages do not justify a simple expert-versus-amateur opposition.

The record drawer’s sole scheduling claim comes from the [Stanford Encyclopedia of Philosophy, §1](https://plato.stanford.edu/entries/schopenhauer/). Its account of Schopenhauer’s allegation links to Stratagem III. No exact clock time, number of attendees, neighboring rooms, Hegel reply, or 1820 transcript is invented. The brief’s “one hour” is a metaphor for a competing slot; its duration is not asserted as recovered fact.

The builder structurally reviewed both whole works, closely read all selected passages and their surrounding arguments, and inspected representative high-risk source features. It has not independently proofread every word against an 1892 printing or German original. A human reader’s account of what they learned is still required; functional clicks and word counts do not prove an intellectually successful comparison.

## E-reader scope

Each About this work panel links the original **source-edition EPUB**, which needs a network connection. The reader does not generate EPUB and does not synchronize browser notes with an e-reader. A future exporter must understand tables, their relative columns, source-note links and backlinks, small capitals, source page markers, embedded images, Greek/diacritics, explicit verse breaks/indentation and per-work metadata. It also needs an explicit decision about companion prose and private notes, EPUB validation and actual e-ink testing. Reader JSON and private bundles are recovery formats, not EPUBs.
