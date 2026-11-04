---
'@getvitops/utils': minor
'@getvitops/astro': patch
'@getvitops/emdash': patch
---

`@getvitops/utils/url` exports `safeHref()` (a Worker-safe scheme allowlist: http, https, mailto, tel and relative), shared by the EmDash blocks and the Astro components. It now also guards the EmDash image-compare block, the review avatar and the cookie-notice policy link. `nodesToHtml`/`toHtml` throw on invalid tag or attribute names and on `on*` event-handler attributes, and drop `href`/`src`-style values that fail `safeHref`. EmDash cards link text now names the card for screen readers.
