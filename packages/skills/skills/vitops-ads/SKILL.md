---
name: vitops-ads
description: How ad platforms, pixels, conversions and attribution work on this site — `site.ads`, the consent-gated tags, click-ID capture into `_ac`, `vitops ads setup|tags|lint`, and the `tel:`/form conversions they report. Also call tracking and forwarding numbers (Google website call conversions, per-platform CallRail/Twilio numbers). Use when adding or changing a Google/Meta/LinkedIn/TikTok/Microsoft/Reddit/Pinterest/Snapchat pixel, verifying a domain with an ad platform, debugging conversions that arrive unattributed, or showing different phone numbers to ad visitors.
---

# Ads

An ad platform is recorded as facts in `site.json` under `site.ads.<platform>`; the toolchain turns
those facts into the tag, the cookie-notice disclosure, the consent behaviour and the lint checks. A
pixel pasted into a template is invisible to all four, so don't.

- **Platforms:** `google` `meta` `linkedin` `reddit` `tiktok` `microsoft` `pinterest` `snapchat`. Each
  entry names the account (`accountId`), the tag (`pixelId`; for Google the `AW-…` conversion ID, not
  the customer ID) and, where the platform verifies a domain, the token (`domainVerification`).
- **Tags are inert until consent.** `<Ads />` renders each as `type="text/plain"` with its URL on
  `data-src`, so an undecided visitor's page makes no third-party request. Never give an ad tag a live
  `src`. Category is `marketing` unless `category: "analytics"`. `environments.<env>.ads: false`
  switches every tag off for that environment (a preview must not fire conversion pixels).
- **Click IDs are captured into `_ac`** by `<Tracking />` once `site.tracking.enabled` is true. It
  reads the landing URL synchronously, but only _writes_ the 90-day cookie after `marketing` is
  granted, and only an arrival that carried a click ID or UTM raises the banner. With tracking off,
  every conversion from an ad arrives unattributed — it looks exactly like organic.
- **Conversions** are `tel:` taps, `mailto:` taps and form posts. For Google, `conversionLabel`
  takes one label or `{ call, email, form }`, and each is its own action in Google Ads (the category —
  "Phone call lead", "Contact", "Submit lead form" — is set there, not in code).
  `reporting: "server"` + `conversionActionId` uploads from the conversion route instead of the browser.
- **Domain verification:** only Meta, TikTok, Pinterest and Snapchat verify, by an apex DNS TXT record.
  Google Ads, LinkedIn, Reddit and Microsoft have none — linking is the tag and the account ID.

## Commands

- `vitops ads setup` — creates the verification TXT (needs `CLOUDFLARE_API_TOKEN`), asks for a missing
  token and writes it back to `site.json`. It never edits or deletes a DNS record, and calls no
  platform API; the final "Verify" click stays manual (it prints a reminder).
- `vitops ads tags` — prints the inert, gated `<script>` markup for stacks that aren't Astro.
- `vitops ads lint` — reports gaps nothing shows at runtime: a click ID that isn't captured, tracking
  turned off, an undeclared call-tracking processor. Run it before launch and when adding a platform.

## Topics

- [call-tracking.md](call-tracking.md) — showing ad visitors a forwarding number: Google's website
  call conversions, per-platform numbers from a call-tracking provider, what each platform can and
  can't do, consent timing, double counting, privacy policy, and how to test. Read when the task
  involves phone numbers, `tel:` links or "calls from ads".

See also the `emdash-contact-form` skill (where form conversions land and what the notification says) and the
`vitops-csp` skill (origins a new tag needs before the CSP is enforced).

## Conversion tracking details

`vitops docs tracking`. `site.tracking.enabled` captures ad click IDs and UTMs from the
landing URL into the first-party `_ac` cookie; a conversion route reads it back and notifies
via `site.notifications`. Points worth holding:

- `_ac` is a 90-day identifier, so it waits on `marketing` (or `site.tracking.category`) and
  the capture **`require()`s** it — see above.
- Only an arrival actually carrying a click ID or UTM asks; organic visitors are never
  interrupted.
- The read is synchronous and the _write_ is what waits — the click ID exists only in the
  landing URL, so it cannot be deferred.
- Only the `email` channel (Cloudflare Email Sending) is implemented. Its sending domain must
  be onboarded with `wrangler email sending enable <domain>` or every send fails; the tool
  surfaces that error verbatim rather than as "send failed".
- `--dry`-style planning is pure and reports **why** anything was skipped. A silently unsent
  notification is indistinguishable from no conversion, so never leave one unexplained.
