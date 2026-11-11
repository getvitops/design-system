# Call tracking numbers

Goal: attribute a real phone call to the ad that caused it, not just the `tel:` tap. That means
showing an ad visitor a different number than everyone else, then reading which number was dialled.

## What each platform can do

| Platform                                            | Number on the website?                                                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Google Ads**                                      | Yes — _website call conversions_. Google supplies the forwarding number. Canada is supported (local, toll-free). |
| **Microsoft Ads**                                   | No. Forwarding numbers exist only inside the ad's call extension, and only in the US, UK and Australia.          |
| Meta, LinkedIn, TikTok, Reddit, Pinterest, Snapchat | No platform-provided numbers at all.                                                                             |

For everything except Google the only route is a number the client provisions with a call-tracking
provider (Twilio, CallRail, CallScaler, …), forwarding to the real line, shown to that platform's
visitors. That is `site.tracking.phoneNumbers`. Re-check Google's and Microsoft's availability pages
before promising a client either: country lists change.

## Rules that hold for both routes

- **The served HTML always carries the real number.** Swapping happens in the browser only, so
  crawlers, structured data, no-JS visitors and local-SEO listings all see one consistent number, and
  `organization.phone` stays the truth. Never render a tracking number server-side.
- **Only matching links and marked text are swapped.** A `tel:` link is swapped when its digits equal
  the configured number (href and any text that is that number; a link labelled "Call us" only has its
  href changed). Other text is swapped only inside an element with `data-vitops-phone`. Write the
  number on the page in the same digits as the config — `613-555-0100`, `(613) 555-0100` and
  `+1 613 555 0100` all match; a number written with a typo never does and is silently left alone.
- **An organic visitor is never swapped.** Nobody sees a tracking number they weren't sent to.
- **Needs `site.tracking.enabled: true`.** The capture script does the swapping; validation rejects
  either feature without it.

## Google: `site.ads.google.callTracking`

```json
"ads": { "google": {
  "pixelId": "AW-123456789",
  "callTracking": { "label": "AbC_dEf-1", "number": "613-555-0100" }
} }
```

- `label` belongs to a **separate** Google Ads conversion action of type _Calls from a phone number on
  your website_, not the `conversionLabel.call` action (that one counts taps).
- Output is `gtag('config', 'AW-…/<label>', { phone_conversion_number, phone_conversion_callback })`,
  inside the same consent-gated `marketing` tag, so nothing loads or swaps before consent.
- Google replaces displayed **text** only. The callback hands the result to the capture script, which
  rewrites the `tel:` href. Without that, the visible number would be Google's and the tap would dial
  the real one.
- Google decides who is shown a number (ad click, remembered for a while in a cookie; `cache: false`
  turns that cache off). Only one number per page can be tracked this way.
- **Double counting:** one call can count as the tap action and the call action. In Google Ads make
  one secondary. `vitops ads lint` reminds you when both are set.
- **Verification:** with a swapped number Google can't verify the domain by scanning the page. Link
  Search Console. A tag installed through Google Tag Manager can't verify it either, so don't move this
  tag into GTM.
- Test: after granting marketing consent, load a landing URL with `#google-wcc-debug` appended and
  confirm the number and the `tel:` href both changed. Set the action's minimum call length in
  Google Ads.
- Not available on the Display Network.

## Everyone else: `site.tracking.phoneNumbers`

```json
"tracking": { "enabled": true, "phoneNumbers": {
  "number": "613-555-0100",
  "provider": "callrail",
  "sources": { "meta": "613-555-0101", "microsoft": "613-555-0102", "default-paid": "613-555-0199" }
} }
```

- `sources` keys are the `site.ads` platform names plus `default-paid`, the fallback for a paid visit
  (any click ID, or `utm_medium` of `cpc`/`ppc`/`paid…`) from a platform with no number of its own.
  Unknown keys fail validation. A `google` key is rejected while `callTracking` is set — two numbers
  would compete for one visitor.
- Which source wins: the **landing URL** first (click ID, then a known `utm_source` such as
  `facebook`→meta, `bing`→microsoft), then the stored `_ac` cookie. A fresh Meta click beats an old
  stored Google ID.
- **Consent timing:** on the landing page the number is chosen from the URL, which is not storage and
  needs no permission. On later pages it comes from `_ac`, which exists only if `marketing` was
  granted. A visitor who declines therefore sees a tracking number on the landing page only — say so
  to the client; it is a deliberate consequence of not storing without consent.
- The tap beacon carries which number was dialled, so the conversion notification says e.g. "Number
  shown: meta tracking number". The call itself is attributed by the provider's own reporting.
- The decision lives in `@getvitops/utils/tracking`'s `selectPhoneNumber()` (pure, tested). The
  capture script `packages/astro/src/scripts/tracking.ts` mirrors it because it is inlined into the
  document; `tracking.test.ts` pins the two, so change them together.

## Privacy policy

A call-tracking provider records every caller's number and often a recording, so it is a processor the
generated policy must name. State it in `site.legal.privacyPolicy.processors` (the toolchain has no
known-provider entry for these yet). `phoneNumbers.provider` is informational and exists so `vitops ads
lint` can flag a provider missing from that list. Call recording needs its own caller notice; that
belongs in the provider's settings, not here.

## CSP

If the CSP is enforced, Google's number fetch needs Google origins in `script-src`/`connect-src`;
watch the Report-Only console on a landing page with `#google-wcc-debug` for the exact ones. See the
`vitops-csp` skill.

## Verifying a change

- `vitops validate` / `vitops ads lint` after editing `site.json`.
- In a browser: load `/?fbclid=test` and confirm the Meta number appears and the `tel:` href matches;
  load `/` and confirm the real number; load with JavaScript disabled and confirm the real number.
