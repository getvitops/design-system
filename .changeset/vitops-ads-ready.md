---
'@getvitops/astro': minor
---

**Added: `window.vitopsAds.ready`.** A promise that resolves once the Google tag's bootstrap has defined `gtag`, so a script that reports a conversion on page load (for example a form redirect's landing page) can `await window.vitopsAds.ready` instead of polling for `gtag` every 150 ms. It is checked at load and again on each `vitops:tag` event the consent runtime fires, so a late consent resolves it too. It stays pending for a visitor who never consents or a site with no Google tag: treat it as optional and never block a redirect on it.

Where #15's other points stand, for the record: per-action conversions already shipped as `site.ads.google.conversionLabel` (a string, or a `{ call, email, form }` map); a conversion that arrives before the tag is held and sent when the tag activates; `vitopsFormConversion(form)` reports once per form; and `reporting: 'server'` uploads the click conversion from the confirmed submission. Not added: a one-shot token for the thank-you page (the server upload path is the de-duplicated route).

All formats: no CSS change. `@getvitops/core` and the rest of the fixed group: no consumer-facing change in this entry.
