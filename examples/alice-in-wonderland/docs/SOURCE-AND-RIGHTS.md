# Source and rights receipt

> **Publication update · 18 October 2026.** This edition was subsequently admitted to the public kit and published at [newreading.app/alice/](https://newreading.app/alice/). See the [current example README](../README.md), [exact publication inventory](../../../publication.json) and [catalogue provenance](../../../showcase/ASSETS.md). The preparation-stage destination and authorization statements below record the original trial. This update clarifies project status; it does not expand the territorial evidence or rights over other editions.

Access date: **16 October 2026**. The exact chosen source is [Project Gutenberg ebook 28885](https://www.gutenberg.org/ebooks/28885), not its automatically generated synopsis. The actual HTML archive, EPUB container, source HTML/CSS, every image, and the licence text were inspected locally. No personal reader content was used.

## Edition identity

The catalogue names Lewis Carroll (1832–1898), contributor Austin Dobson (1840–1921), and illustrator Arthur Rackham (1867–1939). The title page in the actual archive reads William Heinemann, London, and Doubleday, Page & Co., New York; **it shows no publication year**. This project therefore does not label the scan as a verified 1907 printing. The catalogue gives release 19 May 2009 and last update 5 January 2021; the generated HTML metadata has a later generation timestamp. Access-date raw hashes identify the actual downloaded bytes.

The archive contains the complete twelve-chapter narrative, Dobson’s proem, Carroll’s opening poem, front matter, contents, plate list, colophon and transcriber’s notes. Its **38 distinct images** comprise 13 colour plates (the frontispiece and 12 inserted plates), 14 other story drawings (including the rabbit-hole background and the cook), 7 decorated initials, and 4 binding/front-matter images (cover, endpapers, title page and spine). There are 43 rendered uses because the A and T initials repeat. The authoritative item-by-item list is [assets.json](../edition/assets.json).

The HTML source’s credits are retained: produced by **Jana Srna, Emmy and the Online Distributed Proofreading Team**, from images made available by the **University of Florida Digital Collections**. The project does not claim to have independently located or proofread every physical scan behind that credit.

## Raw source inventory

Untouched raw downloads are ignored under `.reader/private/`. No raw archive is committed or uploaded.

| Input | URL | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| HTML archive | [pg28885-h.zip](https://www.gutenberg.org/cache/epub/28885/pg28885-h.zip) | 1,443,318 | `7f697b6970ebe918109c824fc613ff8c8027b7cb96cc23c98686edebaf4969c5` |
| Source EPUB3 with images | [28885.epub3.images](https://www.gutenberg.org/ebooks/28885.epub3.images) | 1,475,456 | `69c757719102f175303e7e8b8e508f1466e9aa78ddd9afb05609d00150699b3d` |
| Extracted original HTML member | `pg28885-images.html` inside the ZIP | 225,470 | `d0eaeb19950d989bdf76045dd55eef750b298b5e3b50074ba3f267ea8be8b4a1` |
| Catalogue | [ebook 28885](https://www.gutenberg.org/ebooks/28885) | 25,729 | `eb23c2878db03ab2bc69b197c7d5d2c00687062aa4c1b5c0d1103dcca105324f` |
| Current licence policy page | [Gutenberg licence](https://www.gutenberg.org/policy/license.html) | 32,478 | `8a5137aecb0911dc0700e4ff636834326f6eade4beb997229269658a5ccd82f7` |

Every image’s original archive path, public source URL, byte length, SHA-256, dimensions, MIME type, original source alt, editorial accessibility description and exact section/block uses are recorded individually in [edition/assets.json](../edition/assets.json). Prepared image payloads decode byte-for-byte to the original ZIP members. The separately generated EPUB uses re-encoded images; **none of those EPUB images were mixed into this reader**.

## Rights and distribution boundary

The catalogue marks the **whole ebook public domain in the USA**. That is the source basis for this local trial’s Carroll text, Dobson proem, Rackham illustration edition and associated binding/front-matter images. It is not an independent worldwide legal opinion, and contributor death dates are not being used as a shortcut to universal clearance. Other jurisdictions and any eventual host/audience remain unassessed. The user authorized processing and a reviewed local public-example candidate; **no remote destination, upload, push or deployment was authorized**.

The source’s Project Gutenberg header, production credits, transcriber note and **full licence** are retained in the prepared edition. A first-access notice shows the source’s required licence sentence with immediate offline access to the full terms; original HTML and EPUB downloads are linked without charge. The adaptation is identified as independent and changed in presentation. The Gutenberg name is attribution, not a claim of endorsement. Before public distribution, review notice prominence and the final distribution surface against [licence sections 1.E.1–1.E.7](https://www.gutenberg.org/policy/license.html). The original file can be obtained through the source links; it is not falsely presented as an app-generated export.

Software and the unchanged original kit samples retain their MIT licence. That software licence does **not** serve as a rights declaration for the historical edition. The new source adapter and interface code are project code. Editorial descriptions and prompts are new project writing and are clearly distinguished from source captions and historical fact. No generated illustrations, external OCR service, remote image processing or DRM bypass was used.

## Candidate inventory and audit boundary

The proposed book-bearing source file is **only** `edition/library.json`, with its separate provenance inventory `edition/assets.json`. The build embeds the images in `dist/library.json`; there are no remote image calls. It includes the fixed app modules/styles/icon/manifest/robots plus that library and its generated service worker, thirteen outputs total, including the passage-sharing module.

The inherited original-samples build restriction was a real incompatibility, not silently relaxed. A separate project-only gate checks the reviewed edition hash and decodes all 38 PNG/JPEG payloads to check their signatures, sizes, hashes and exact source uses. The inherited file/history scanner remains unchanged and still checks the complete local reachable history, index and working tree. The project audit additionally checks edition payloads in local refs and reflogs and hashes the exact build outputs. The original scanner cannot infer image provenance from base64 JSON; its pass alone would be insufficient. These gates are not worldwide rights clearance or publication authorization.
