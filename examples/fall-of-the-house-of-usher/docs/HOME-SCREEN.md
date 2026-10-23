# Home Screen identity

An original pale serif U on charcoal, with a small angular fissure in its right stem; the palette follows the existing paper, ink and muted red accents.

`site/icon.svg` is the authored vector master. It contains only original geometric paths and solid colors: no book words, extracted artwork, historical illustration or embedded font. The three opaque PNG exports are rasterizations of that master at 180, 192 and 512 pixels. Artwork is part of this project’s MIT application code; this does not change any source-edition rights.

The HTML names the 180px Apple touch icon; the manifest names 192px and 512px PNGs plus the SVG favicon. All have a full square background; the launcher supplies its own corner mask. The manifest keeps the existing identity and root start address, with explicit root scope. Export files are checked against exact hashes in `../edition-lock.json` and `EDITION-INVENTORY.json`. Regenerate from the vector master with a local SVG rasterizer (current exports: Sharp 0.35.5, density 384, exact resize, remove alpha, PNG), then inspect small sizes and review the pins.

These files improve installation metadata; they do not establish physical iPhone or Android installation acceptance, change local storage, or move the reader to another address. Browser records remain tied to the existing origin.

The original icon work authorized no hosting by itself. Publication status for this packaged reader is recorded separately by the catalogue release coordinator.
