# A reader on the Home Screen

Give each new reader an icon of its own. Use a clear detail from its established design: a letterform, object or simple arrangement of lines. Draw it for a 48–60px display, then inspect that small version beside the entrance. A complete cover reduced to a square rarely remains legible. The starter's red R is a working example to replace when the reader takes shape.

Keep the source artwork in `site/icon.svg`. Export three square, opaque, 8-bit RGB PNGs from that vector at their actual dimensions; do not enlarge a small bitmap:

| File | Pixels | Use |
| --- | --- | --- |
| `site/apple-touch-icon.png` | 180 × 180 | Explicit Apple touch icon |
| `site/icon-192.png` | 192 × 192 | Manifest icon |
| `site/icon-512.png` | 512 × 512 | Manifest icon |

Use the reader's own paper or ink as the full background. Leave space around the mark and let the operating system apply its shape. These files use manifest purpose `any`. Only advertise a separate `maskable` icon after checking its essential artwork inside the manifest specification's safe area. Preserve reviewed font or image credits if the icon uses either; an original vector emblem needs no book text or source illustration.

The starter already includes the three filenames in its build and offline cache. Its head explicitly links the Apple icon with `sizes="180x180"`; its manifest lists both PNGs alongside the SVG favicon. Replace all three rasters together when changing the SVG, then run:

```sh
npm run check:icons
npm test
npm run build
node scripts/check-home-screen.mjs --site dist --cache
```

The check reads the files rather than trusting their extensions. It verifies PNG dimensions, checksums and decoded pixel length, opaque backgrounds, required links, same-origin paths, launch scope and offline inclusion. It does not judge the artwork. Inspect the actual small icon yourself, including the contrast of thin lines and the shape imposed by the device.

## Keep the installed identity stable

For a reader served at its own origin, use `id: "/"`, `start_url: "/"` and `scope: "/"`, unless an existing explicit ID is already in use. Keep that ID when changing the icon or name. A manifest without an ID derives its identity from its start URL; making that same value explicit preserves the established identity.

For a reader mounted at `/my-reader/`, use that directory for `start_url` and `scope`, keep its established ID, and keep every icon and manifest URL under the same directory. The public catalogue's builder already performs this rewrite for each approved reader. Check the mounted output too:

```sh
node scripts/check-home-screen.mjs --site output --base /my-reader/ --id /my-reader/ --cache
```

The ID and scope describe the installed application; they do not migrate browser records. Keep database names, storage keys and worker boundaries unchanged. Do not promise that Safari's saved passages automatically appear in a newly installed app. Export a reading bundle before changing how an existing reader is opened, and test recovery separately.

Apple uses an explicit PNG touch icon for a Home Screen shortcut. Manifest icons, ID and scope describe the web application on supporting browsers. Installation behavior and existing icon caches vary by device and OS version. Before release, add the actual HTTPS reader on an iPhone/iPad and an Android device when available; check the small icon, label, launch destination, ordinary reading and offline reopening. Browser automation cannot certify the operating system's installation sheet or icon refresh. See [Apple's icon guidance](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html) and the [Web App Manifest specification](https://www.w3.org/TR/appmanifest/).

## Publication and original artwork

Local readers keep their own icon files and authorization. Adding an icon does not authorize publishing a book. Public PNGs require exact path/hash entries in `publication.json` under `reviewedIconFiles`, with a tracked provenance document and reason. This exception admits only the three named icon files in `site/` or an approved example's `site/`; it does not admit arbitrary images or suppress private-path and credential checks. A source-free starter keeps only the icon entries named by its own inventory.

The kit's red R and all eleven public reader emblems are original contemporary vector artwork under the kit's MIT license. Their PNGs are direct, opaque raster exports of the corresponding `site/icon.svg`. Existing identities retained here are Alice's A, Walden's W, the two lecture doorways, the Odyssey's boat, At Table's plate, the Inward Life's loops, and Music and Feeling's crossing lines. Austen's fan, Dracula's folded document, Learning to See's outlined and solid leaves, and Beside the Bed's chair and window replace inherited generic R marks. These emblems are not reproductions of historical illustrations. No literary source, edition image, font file or existing artwork pin changes with this addition.

The catalogue's existing red caret and letter r remain separate from the readers. Its already-reviewed 180px Apple icon is retained unchanged.
