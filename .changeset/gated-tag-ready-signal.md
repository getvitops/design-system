---
'@getvitops/core': minor
'@getvitops/astro': minor
---

**A Google Ads conversion that happens before the Google tag has loaded is held and sent, not dropped.** `gtag` and the per-action `send_to` map are defined by the consent-gated bootstrap, so a `tel:`/`mailto:` tap or a `vitopsFormConversion(form)` call that arrived first (consent not given yet, or an `idle` tag not yet at its turn) used to find neither, skip silently, and, for the form, mark the form as converted so a retry could not recover it. The tracking script now queues the action and flushes it when the runtime announces the tag, so the wait is tied to consent instead of a polling deadline. Several taps on one action before the tag loads report once. jblsigns' `AdConversions.astro` poll-for-`gtag` loop is no longer needed.

**New: `vitops:tag`.** `<wc-consent>`'s runtime dispatches a `vitops:tag` event on `document` each time it activates a gated tag, with `detail.category`. It is the "this tag has loaded" counterpart of `vitops:consent`; `TAG_EVENT` is exported from `@getvitops/core/consent` beside `CONSENT_EVENT`. `consent.js` grows by about 100 bytes gzipped (3177 of 3500 B budget). Affects all formats (the web-component and script bundles are the same in each). Other fixed-group packages: no consumer-facing change.
