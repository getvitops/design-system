---
'@getvitops/utils': minor
'@getvitops/astro': minor
---

Fire a Google Ads conversion on a tel:/mailto: click, and fix a rate-limit bug on the conversion
route that could silently drop one of the two.

`site.ads.google.conversionLabel` used to be accepted by the config schema and typed all the way
through to the rendered tag, but nothing actually read it — no `gtag('event', 'conversion', …)`
was ever emitted. When set, the click tracker `<Tracking />` inlines now fires the conversion at
the moment a visitor taps a `tel:` or `mailto:` link, using the `AW-…/label` target Google Ads
expects. A `conversionLabel` that can't safely land inside the inline bootstrap script (the same
check `pixelId`/`accountId` already get) is dropped with a warning rather than firing something
malformed — the ad tag itself still loads.

Also: `createConversionRoute()`'s rate limiter previously keyed on IP address alone, so a call
beacon and an email-click beacon from the same visitor, seconds apart, competed for one window —
the second could 429 and vanish with no error anywhere. It's now keyed on IP _and_ event type, so
distinct conversion types never starve each other; repeats of the same type are still throttled
exactly as before.

No config changes — a site with `site.ads.google.conversionLabel` already set picks this up
automatically on the next build.
