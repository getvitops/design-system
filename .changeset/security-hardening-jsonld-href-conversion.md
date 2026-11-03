---
'@getvitops/astro': minor
'@getvitops/emdash': patch
---

**Security: JSON-LD can no longer break out of its `<script>` tag.** All 24 `schemas/*.astro`
components inlined `JSON.stringify(jsonLd)` as-is, so a review, FAQ answer or forum post containing
`</script><script>…` ran as script on the page. They now go through `jsonLdScript()`, which escapes
`<`, `>`, `&`, U+2028 and U+2029 (still valid JSON — consumers and search engines parse the same
document). Sites rendering any user-supplied text through a schema component should upgrade promptly.

**`createConversionRoute()` hardening** — behaviour changes:

- The body-size cap is now enforced on the stream itself, not only on `Content-Length`; a chunked
  request with no header is refused with 413 once it passes `maxBodyBytes`.
- **Breaking for non-Cloudflare hosts:** `X-Forwarded-For` is no longer used as the rate-limit key by
  default, since off Cloudflare a client can set it freely and mint a new bucket per request. Pass
  `trustForwardedFor: true` when running behind a proxy that overwrites it. Without
  `CF-Connecting-IP` or that opt-in there is no IP and rate limiting is skipped. No change on
  Cloudflare Workers.

`@getvitops/emdash`: the link/button block (`vitops.actionLink`) drops hrefs with a scheme other
than `http`, `https`, `mailto` or `tel` (e.g. `javascript:`, `data:`) and renders nothing for them.

Formats reached: none — no CSS change. Other packages in the `fixed` group: No consumer-facing
change in this package.
