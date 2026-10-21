# Home Screen identity and type

The original angular paper-coloured M on mountain green is drawn from geometric coordinates in `site/icon.svg`, with no book image or historical illustration. `scripts/make-app-icons.py` rasterizes that mark at four times each target size and downsamples to opaque RGB PNG. Pillow is needed only for regeneration; builds copy reviewed bytes.

Apple uses `apple-touch-icon.png` at 180×180. The manifest uses 192×192 and 512×512 PNGs with `purpose:any`; no maskable claim. The complete square is opaque so the operating system can apply its corner mask. Exact PNG hashes are pinned in `publication.json`. The standalone manifest retains its original root id/start_url/scope; catalogue mounting adapts them to `/mountains/` without copying local browser records.

Typography uses device-local Baskerville, Times New Roman and system sans-serif fallbacks. There are no font binaries, external font downloads or separate font licences in this package. The artwork itself contains no font glyph asset. Native Home Screen installation remains untested.
