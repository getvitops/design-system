---
'@getvitops/config': minor
'@getvitops/generator': minor
'@getvitops/utils': minor
'@getvitops/astro': minor
'@getvitops/cli': minor
'@getvitops/skills': minor
'@getvitops/create': patch
---

**Call tracking numbers: show an ad visitor a number that attributes the phone call.** Two additive config blocks, no CSS, no breaking change — all formats unaffected.

- **`site.ads.google.callTracking`** — Google Ads _website call conversions_. `{ label, number, cache? }` makes the consent-gated Google tag fetch a Google forwarding number (Canada supported) and swap it in for visitors who arrived from a Google ad. Google replaces text only, so the capture script also rewrites the matching `tel:` href. Needs `pixelId` and `site.tracking.enabled`; rejected on any other platform (only Google can put a number on the website — Microsoft's exist only inside the ad, in the US/UK/AU).
- **`site.tracking.phoneNumbers`** — per-platform numbers for every other platform: the real `number`, `sources` keyed by `site.ads` platform (plus `default-paid`), and an informational `provider`. You provision the numbers with a call-tracking service (Twilio, CallRail, …). The landing URL decides first, then the `_ac` cookie, so a visitor who declines `marketing` sees a tracking number on the landing page only. An organic visitor is never swapped, and the server-rendered HTML always carries the real number.
- The `tel:` tap beacon now carries which number was shown (`phoneSource`), and the conversion notification says so.
- `vitops ads lint` flags a call-tracking provider that is not in `site.legal.privacyPolicy.processors`, and notes that `callTracking` plus `conversionLabel.call` can count one call twice (make one secondary in Google Ads).
- `@getvitops/utils/tracking` exports the pure `selectPhoneNumber()` and helpers; the capture script mirrors it and `tracking.test.ts` pins the two.
- `@getvitops/skills` gains a **`vitops-ads`** skill (overview plus a `call-tracking.md` topic). The templates gitignore synced skills by prefix (`vitops-*`, `emdash-*`), so it needs no `.gitignore` line of its own.

`@getvitops/core`, `@getvitops/vite` and `@getvitops/emdash` — no consumer-facing change in these packages.
