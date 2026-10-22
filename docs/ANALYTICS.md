# Usage on the public site

New reading measures the hosted catalogue and its fourteen public readers through Vercel Web Analytics. The default reader starter, independently built examples, private readers and `read.lookatseel.com` do not load this integration. Hosting a copy of the kit does not enroll it in New reading's analytics.

## What the counts mean

| Signal | What it establishes | What it does not establish |
| --- | --- | --- |
| Page view | A public entrance loaded with analytics available | A book was read |
| `reader_link`, `game_link` | A known public reader or game link was activated | The destination finished loading |
| `edition_preview` | A library edition preview opened | Its companion was used |
| `prompt_copy` / `copied` | The current maker instruction reached the clipboard | A reader was built |
| `prompt_copy` / `fallback` | Manual copying was offered | The text was copied |
| `kit_link` | The kit repository link was activated | A clone, download or contribution |
| `reading_visible_30s` | A public book route had restored text visible for thirty accumulated seconds in this page visit | Attention, comprehension or a finished chapter |

Custom events carry at most two fixed labels: page type, public edition slug or copy outcome. Each combination is counted once per page visit. Book and section identifiers are not sent. The read signal checks the generated public-book inventory locally; imported book routes do not produce it. Companions and game completion are not measured in this version.

## Data boundary

The integration accepts only `https://newreading.app` and its named public entrances. Query strings and fragments are removed before both page views and events. Unknown events, properties and paths are rejected. Search terms, maker drafts, clipboard contents, quotations, notes, imported books and reading records are not inspected by the analytics module. There is no session replay or automatic form capture.

Vercel's script handles aggregate visitor, device, approximate location and referrer reporting. Its current client adds referrers outside `beforeSend`; a visit with an external referrer containing a path, query or fragment is therefore excluded entirely. Bare referring origins can be counted. The site's existing `no-referrer` response policy remains unchanged. No identity, group, cookie-enabling or session-replay API is called. Collection is suppressed if the provider’s reserved attribution key or flag elements exist, so those cannot add unreviewed data outside the event filter. This checks only the presence of an analytics-reserved key, not reading records.

Do Not Track, Global Privacy Control, automated browsers, preview hosts, unknown paths and offline starts are excluded. A failed or slow provider script stops collection. Events wait only in bounded page memory during startup; nothing is persisted or retried after failure, leaving the page or disconnection. Ad blockers and these exclusions make the counts incomplete.

The analytics module is an independent optional script added only during the combined catalogue build. Reader application modules do not import it, and workers do not require it for their offline copy. Edition bytes, local database names, cache prefixes and installed addresses are unchanged. The public [privacy notice](https://newreading.app/privacy/) is linked from the catalogue and all fourteen mounted reader footers; the reusable reader's [storage guidance](PRIVACY.md) remains separate.

## Maintenance

Review `showcase/analytics.mjs`, the exact mounted HTML and actual provider request bodies when changing collection. Keep property values finite and public. Never add generic click text, full URLs, search strings or imported identifiers for convenience. A new measure needs a defined question and a test for what it actually establishes.

Run `node --test showcase/analytics.test.mjs`, `node showcase/check-analytics.mjs`, the relevant catalogue/reader checks and the exact publication audit. The browser check requires the privately downloaded official provider script at `.reader/analytics-2026-10-22/vendor-script.js` (or `ANALYTICS_VENDOR_SCRIPT`). CI downloads it from `https://va.vercel-scripts.com/v1/script.js`; the harness checks its reviewed SHA-256 before execution and intercepts every request. The production script also carries that integrity pin: different bytes stop collection. Verify the same-origin provider route before release. If the provider changes its script, review its behavior before updating both the runtime and test pins. This test does not send production traffic.

Use the existing project's Analytics dashboard. Compare weekly page visits, public reader signals and maker actions; filter devices and referring sites to find concrete follow-up questions. When using the API, compare the returned query periods: endpoints can round dates differently. Do not label aggregate action ratios as a person-level funnel, retention or conversion rate. The integration intentionally has no cross-device or lasting reader identity. Keep reports private, and avoid conclusions from small samples.

Vercel's plan controls availability, retention and charges. Check the account before enabling it; do not enable a paid add-on or change spend controls as part of a code update. [Setup](https://vercel.com/docs/analytics/quickstart), [privacy](https://vercel.com/docs/analytics/privacy-policy), [custom events](https://vercel.com/docs/analytics/custom-events), [pricing](https://vercel.com/docs/analytics/limits-and-pricing) (checked 22 October 2026).
