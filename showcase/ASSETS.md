# Showcase assets

The catalogue first published at `read.lookatseel.com` followed the visual language of [Lukas Seel’s personal website](https://lookatseel.com/), at his explicit request on 16 October 2026. That first release borrowed the warm paper palette, Fraunces typography and the existing book object. That first release did not copy personal-reader material or presentation captures.

## Personal cover opening · 17 October 2026

At the owner’s explicit request, `personal/` now uses the accepted short cover-to-reader opening, adapted to the tan palette and Fraunces typography of lookatseel.com. The three covers are original HTML/CSS compositions. Alice reuses the reviewed Rackham rabbit; Walden reuses the reviewed pond survey. Canetti’s typographic cover uses an original simple open-circle motif derived from the existing reader’s identity, not a publisher’s cover scan. The Canetti title/author identify the linked book; no book text is copied.

- `assets/personal-alice-reader.jpg`: 450 × 700 screenshot of the maintained public Alice reader, open at Chapter I with no saved notes or personal reading data. Captured from the reviewed local app during the accepted prototype. The exact [edition and contributor evidence](../examples/alice-in-wonderland/docs/SOURCE-AND-RIGHTS.md) applies. This is one of the four specifically authorized public examples.
- `assets/personal-canetti-map.jpg`: 450 × 700 screenshot of the existing [Canetti walking tour](https://marrakesch-reader.vercel.app/#walk), with its map expanded. Captured 17 October 2026. The owner explicitly selected this personal reader for the catalogue. Only the map, map controls and route legend appear: no literary prose, private notes, reading records or device location. Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under ODbL. The screenshot preserves the visible attribution; a clickable attribution is also in the page’s credits. The suggested present-day route is editorial, not a reconstruction of Canetti’s exact itinerary. This single approved presentation image does not authorize copying the Canetti application, book, EPUB or map database into this kit.
- `assets/personal-walden-reader.jpg`: 450 × 700 screenshot of the current public [Walden companion](https://newreading.app/walden/#companion), captured 17 October 2026 without annotations or personal records. It shows “Keeping account”, a sourced editorial companion. [Edition and contributor evidence](../examples/walden/docs/SOURCE-RIGHTS.md).
- `assets/personal-opening-share.jpg`: 1200 × 630 screenshot of the new opening’s HTML/CSS cover composition, rendered with the same locally licensed Fraunces fonts and the three covers above. No reader text or map data appears in this social preview.
- `assets/personal-share.jpg`: retained historical four-book preview from `2bebaf0`; superseded by `personal-opening-share.jpg`. Its exact pin and source credits remain for reachable-history review.

- `assets/book.webp`: the existing [book graphic](https://lookatseel.com/_astro/book.CGxSQOGY_Zcbmoi.webp), downloaded unchanged from the public personal site. Lukas specifically authorized its use here. This branded artwork is not represented as public domain or licensed under the kit’s MIT code license; replace it in an independently branded fork unless you have permission to reuse it.
- `assets/fraunces-normal.woff2` and `assets/fraunces-italic.woff2`: unchanged Latin variable font subsets served by that site ([normal](https://lookatseel.com/_astro/fraunces-latin-wght-normal.ukD16Tqj.woff2), [italic](https://lookatseel.com/_astro/fraunces-latin-wght-italic.Py8at3oI.woff2)). Copyright 2018 The Fraunces Project Authors. Licensed under SIL Open Font License 1.1; the complete [license](assets/OFL.txt), from [the upstream project](https://github.com/undercasetype/Fraunces/blob/master/OFL.txt), accompanies the files and the website build.
- `favicon.svg`: original vector artwork for this showcase, under the kit’s MIT license.

## New reading identity · 17 October 2026

The user selected Open Shelf for `newreading.app`, then asked for a more distinctive typeface, an intriguing book-led entrance and a faster start. The new identity uses Bricolage Grotesque with the same four reviewed catalogue images. No literary text or edition image is altered.

- `assets/bricolage-grotesque.woff2`: the unchanged variable webfont from [Bricolage Grotesque](https://github.com/ateliertriay/bricolage/tree/84745e5b96261ae5f8c6c856e262fe78d1d6efdd), pinned revision `84745e5b96261ae5f8c6c856e262fe78d1d6efdd`, path `fonts/webfonts/BricolageGrotesque[opsz,wdth,wght].woff2`. Its SHA-256 is `b51a8ebd169637e47cb7db430431ab3e122d2f09b03ee2a03ea06f4cb46f1a8e`. The complete upstream SIL Open Font License 1.1 accompanies the file as [OFL-Bricolage.txt](assets/OFL-Bricolage.txt). Downloaded without modification; no remote font request is made by the site.
- The book favicon is original vector artwork in the new palette, under the kit’s MIT license.
- The updated social-preview composition uses only these reviewed images and the local licensed Bricolage font. Earlier image hashes and provenance remain available for history review.

## Current catalogue artwork · 17 October 2026

The four catalogue entrances use three unchanged edition images and one newly generated editorial illustration. They are artwork-led links to the readers, not screenshots or claims about the applications' exact appearance. Images were visually inspected at phone, tablet and desktop sizes. The software and editions themselves are unchanged.

- `assets/austen-cover.jpg`: exact bytes of [`austen-cover.jpg`](../examples/pride-and-prejudice/edition/austen-cover.jpg), the reviewed 1500 × 2114 gold-and-black peacock binding. Displayed complete on a dark field. [Source and contributor evidence](../examples/pride-and-prejudice/docs/SOURCE-RIGHTS.md).
- `assets/alice-rabbit.png`: the exact decoded `p0003-rabbithole-png` payload in the reviewed [Alice edition](../examples/alice-in-wonderland/edition/library.json), 600 × 825. The catalogue's CSS crop brings the rabbit forward; the file is unedited and the complete illustration remains in the reader. [Source and contributor evidence](../examples/alice-in-wonderland/docs/SOURCE-AND-RIGHTS.md).
- `assets/walden-survey.jpg`: exact bytes of the 731 × 412 [`walden-pond-map.jpg`](../examples/walden/edition/walden-pond-map.jpg), displayed complete. [Source and contributor evidence](../examples/walden/docs/SOURCE-RIGHTS.md).
- `assets/two-halls-portraits.webp`: a contemporary AI-generated editorial illustration of Hegel and Schopenhauer, made with the built-in image-generation tool on 17 October 2026 for this catalogue. No source image, book passage or private reader material was supplied. The 1536 × 1024 generated PNG was resized and encoded as a 1280 × 853 WebP; no compositional retouching was applied. The print treatment and shared book are invented staging, not evidence of a meeting, historical engraving or lecture-room reconstruction. This project places no additional restriction on reuse of this generated asset and makes no claim of exclusive rights. It is separate from the historical artwork and protected literary editions.
- `assets/read-share.jpg`: 1200 × 630 social preview rendered by [share-image.mjs](share-image.mjs) from the four catalogue assets and local Fraunces font. The typography is live HTML during rendering. This derivative layout retains the source-image notices above; the MIT code license does not relicense the historical art or font. Open Graph and large-image card metadata point directly to this locally hosted file. The older generic book preview remains credited but is no longer the social image.

The Two Halls illustration fills its catalogue frame at each breakpoint; the responsive crop and social layout keep both faces visible. The earlier contained layout left bands around the image. Its replacement changes CSS presentation and the rendered social JPEG, not the source illustration. The earlier social JPEG hash remains reviewed for reachable history.

The three historical image files retain their original bytes. CSS blending/cropping is confined to this catalogue presentation and does not modify source books. The linked edition rights, source terms and jurisdiction limits still apply; the kit's MIT code license does not relicense historical artwork. No private reader, promotional-video or user-library material is included.

<details>
<summary>Two Halls generation prompt</summary>

```text
Use case: illustration-story
Asset type: original editorial artwork for the "Two lecture halls" entrance on a literary reader catalogue. Wide landscape, approximately 3:2.
Primary request: an arresting, beautifully composed portrait confrontation between Georg Wilhelm Friedrich Hegel and Arthur Schopenhauer. Make it feel like a carefully commissioned wood engraving printed with two spot inks on warm ivory paper, sophisticated and slightly witty.
Subject: Hegel at left, Schopenhauer at right, facing one another in clear three-quarter profile. Recognizable historical likenesses: Hegel's long thoughtful face, high forehead, receding grey hair swept around the sides, clean-shaven and a high cravat; Schopenhauer's angular face, prominent brow and extraordinary outward white hair wings, clean-shaven and a dark coat. Each portrait is substantial, head and shoulders, beautifully delineated with exact directional hatching and strong silhouette. The two profiles create a generous pale central gap like a narrow aisle. One small open book, elegantly drawn, bridges the lower foreground. No invented buildings or factual diagram.
Composition: bold large portraits fill the image yet have comfortable breathing room around hair; Hegel anchored to the left edge and Schopenhauer to the right, both faces fully visible. A unified physical print composition, not two rectangular panels. Avoid strict mirror symmetry; make Schopenhauer slightly closer. Calm flat ivory background, rich sharp dark ink, restrained muted Prussian-blue ink behind and through Hegel's coat and restrained burnt-sienna ink through Schopenhauer's coat. Very subtle physical ink texture, no dirty antiquing. Central negative space.
Mood: intellectual rivalry, poised and dryly humorous, not grotesque caricature.
Constraints: no text, names, letters, numbers, labels, UI, frames, badges, logos, watermark, modern objects, cartoon expressions, photorealistic gloss, gradients, decorative sparks. Strong legibility at a 360px-wide catalogue thumbnail. This is an original contemporary illustration, not a reproduction of a particular historical engraving.
```

</details>

## Retired screenshot previews · release 5a55295

Four JPEGs show the actual public reader entrances, captured in fresh browser profiles with no annotations or reading positions. `capture.mjs` waits for each edition's loaded content, images and fonts before capturing. The 4:5 crops start at the main content and omit browser chrome. Austen, Alice and Walden are 960 × 1200 pixels; Two Halls is 1200 × 1500 to include both entrances. Captures were visually reviewed before copying into `assets/`; intermediate captures and receipts remain ignored. The source reader code and editions are unchanged from kit `7fb6849`.

- `assets/austen-preview.jpg`: [Austen](https://austen.lookatseel.com/), with Hugh Thomson's 1894 peacock ornament. [Edition and contributor evidence](../examples/pride-and-prejudice/docs/SOURCE-RIGHTS.md).
- `assets/alice-preview.jpg`: [Alice](https://alice.lookatseel.com/), with Arthur Rackham's rabbit-hole illustration. [Edition and contributor evidence](../examples/alice-in-wonderland/docs/SOURCE-AND-RIGHTS.md).
- `assets/walden-preview.jpg`: [Walden](https://walden.lookatseel.com/), with the source pond survey. [Edition and contributor evidence](../examples/walden/docs/SOURCE-RIGHTS.md).
- `assets/two-halls-preview.jpg`: [Two Halls](https://two-halls.lookatseel.com/), showing the original interface composition and source titles. [Edition and contributor evidence](../examples/schopenhauer-hegel/docs/SOURCE-RIGHTS.md).

These are previews of the specifically authorized public examples, not personal-library or promotional-video captures. The linked edition rights, source terms and jurisdiction limits still apply; the kit's MIT code license does not relicense source artwork. Each preview links directly to its complete reader and source notices.

These four screenshot files were retired after the independent design review; they are no longer build or upload inputs. Their exact hashes remain in both the historical-path review and the asset pins so earlier reachable Git history can still be inspected without rewriting it.

`publication.json.reviewedSiteAssets` records each current and historical binary by exact path and content hash. No asset directory receives a blanket scanner exemption. These assets and the showcase are excluded from `starterFiles` and the stock reader build. All images and fonts are served locally; opening the catalogue makes no request to the personal site, sample readers or a font provider.

## New reading redesign · 17 October 2026

The owner selected a new identity for `newreading.app`: IM Fell English for the logo and headlines, Reenie Beanie for the reader's handwritten notes, Martian Mono for labels and Piazzolla for body text. Exploration panels reuse the reviewed Rabbit plate and the approved map-only Canetti screenshot above; the word grid and Walden account are live HTML from the verified editions (“pride” 47 times across chapters 1–61; Thoreau’s house account as printed in *Economy*). The 30 book covers are original HTML/CSS compositions with no publisher artwork.

- `assets/im-fell-normal.woff2`, `assets/im-fell-italic.woff2`: unchanged Latin subsets of [IM Fell English](https://github.com/google/fonts/tree/main/ofl/imfellenglish) by Igino Marini, downloaded from Google Fonts. [SIL OFL 1.1](assets/OFL-IMFell.txt).
- `assets/reenie-beanie.woff2`: unchanged Latin subset of [Reenie Beanie](https://github.com/google/fonts/tree/main/ofl/reeniebeanie) by James Grieshaber. [SIL OFL 1.1](assets/OFL-ReenieBeanie.txt).
- `assets/martian-mono-normal.woff2`: unchanged Latin variable subset of [Martian Mono](https://github.com/evilmartians/mono). [SIL OFL 1.1](assets/OFL-MartianMono.txt).
- `assets/piazzolla-normal.woff2`, `assets/piazzolla-italic.woff2`: unchanged Latin variable subsets of [Piazzolla](https://github.com/huertatipografica/piazzolla). [SIL OFL 1.1](assets/OFL-Piazzolla.txt).
- `assets/reader-keep.jpg`: 450 × 978 screenshot of the public [Pride and Prejudice example](../examples/pride-and-prejudice/docs/SOURCE-RIGHTS.md) opened at Chapter 1, keeping the novel’s first sentence. The note text is illustrative; no personal reading records appear.
- `assets/favicon-32.png`, `assets/apple-touch-icon.png`: original artwork (an IM Fell “r” under a red caret), under the kit’s MIT license.

No font is requested remotely; all files are served from this site.
