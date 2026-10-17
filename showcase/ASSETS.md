# Showcase assets

The showcase at `read.lookatseel.com` follows the visual language of [Lukas Seel’s personal website](https://lookatseel.com/), at his explicit request on 16 October 2026. It borrows the warm paper palette, Fraunces typography and the existing book object. It does not copy personal-reader material or presentation captures.

- `assets/book.webp`: the existing [book graphic](https://lookatseel.com/_astro/book.CGxSQOGY_Zcbmoi.webp), downloaded unchanged from the public personal site. Lukas specifically authorized its use here. This branded artwork is not represented as public domain or licensed under the kit’s MIT code license; replace it in an independently branded fork unless you have permission to reuse it.
- `assets/fraunces-normal.woff2` and `assets/fraunces-italic.woff2`: unchanged Latin variable font subsets served by that site ([normal](https://lookatseel.com/_astro/fraunces-latin-wght-normal.ukD16Tqj.woff2), [italic](https://lookatseel.com/_astro/fraunces-latin-wght-italic.Py8at3oI.woff2)). Copyright 2018 The Fraunces Project Authors. Licensed under SIL Open Font License 1.1; the complete [license](assets/OFL.txt), from [the upstream project](https://github.com/undercasetype/Fraunces/blob/master/OFL.txt), accompanies the files and the website build.
- `favicon.svg`: original vector artwork for this showcase, under the kit’s MIT license.

## Reader previews · 17 October 2026

Four JPEGs show the actual public reader entrances, captured in fresh browser profiles with no annotations or reading positions. `capture.mjs` waits for each edition's loaded content, images and fonts before capturing. The 4:5 crops start at the main content and omit browser chrome. Austen, Alice and Walden are 960 × 1200 pixels; Two Halls is 1200 × 1500 to include both entrances. Captures were visually reviewed before copying into `assets/`; intermediate captures and receipts remain ignored. The source reader code and editions are unchanged from kit `7fb6849`.

- `assets/austen-preview.jpg`: [Austen](https://austen.lookatseel.com/), with Hugh Thomson's 1894 peacock ornament. [Edition and contributor evidence](../examples/pride-and-prejudice/docs/SOURCE-RIGHTS.md).
- `assets/alice-preview.jpg`: [Alice](https://alice.lookatseel.com/), with Arthur Rackham's rabbit-hole illustration. [Edition and contributor evidence](../examples/alice-in-wonderland/docs/SOURCE-AND-RIGHTS.md).
- `assets/walden-preview.jpg`: [Walden](https://walden.lookatseel.com/), with the source pond survey. [Edition and contributor evidence](../examples/walden/docs/SOURCE-RIGHTS.md).
- `assets/two-halls-preview.jpg`: [Two Halls](https://two-halls.lookatseel.com/), showing the original interface composition and source titles. [Edition and contributor evidence](../examples/schopenhauer-hegel/docs/SOURCE-RIGHTS.md).

These are previews of the specifically authorized public examples, not personal-library or promotional-video captures. The linked edition rights, source terms and jurisdiction limits still apply; the kit's MIT code license does not relicense source artwork. Each preview links directly to its complete reader and source notices.

`publication.json.reviewedSiteAssets` pins the exact seven binary assets to this provenance document. No asset directory receives a blanket scanner exemption. These assets and the showcase are excluded from `starterFiles` and the stock reader build. All images and fonts are served locally; opening the catalogue makes no request to the personal site, sample readers or a font provider.
