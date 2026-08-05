---
'@getvitops/utils': minor
'@getvitops/astro': minor
'@getvitops/generator': minor
---

Ad-click attribution and conversion notifications ship as part of the toolchain.

A visitor arriving on an ad carries a click ID in the URL; `<Tracking />` captures it into a first-party `_ac` cookie, and when that visitor later submits a form or taps a `tel:` link, the conversion handler reads the cookie back and notifies whoever the config says. Previously this was per-site code.

**Added — `@getvitops/utils/tracking`.** The attribution vocabulary and cookie, as pure functions over a cookie _string_ so the browser capture and the server-side handler share one implementation: `parseTrackingCookie`, `serializeTrackingCookie`, `mergeTracking`, `identifyPlatform`, `getPrimaryClickId`, plus the click-ID/UTM tables. No DOM, no network, no clock — every function that needs "now" takes it as an argument, so it runs unchanged in a Worker.

**Added — `@getvitops/utils/notify`.** Conversion notifications, split the way `indexing/` is: `plan.ts` decides everything purely (which channels fire, who they reach, and **why anything is skipped**), `render.ts` turns the event into prose, `email.ts` executes and decides nothing. A misconfigured site can therefore be told exactly why no notification will arrive — a silently unsent one is indistinguishable from no conversion.

The `ConversionEvent` is the abstraction: the event is the _fact_, and how it reads is the channel's business.

**Added — the `email` channel, via Cloudflare Email Sending.** Uses the current structured binding (`env.EMAIL.send({ to, from, subject, html, text })`), not the legacy `EmailMessage` + hand-built MIME path. The binding is **passed in, never imported**, so `@getvitops/utils` takes no Cloudflare dependency and the sender is testable with a stub. Retries only the transient error codes; a configuration fault like `E_SENDER_NOT_VERIFIED` is surfaced verbatim rather than collapsed into "send failed". With no binding it prints the notification — the dev path.

Remember to onboard the sending domain (`wrangler email sending enable <domain>`) and add `"send_email": [{ "name": "EMAIL" }]` to `wrangler.jsonc`, or every send fails.

**Added — `<Tracking />` and `createConversionRoute()`** in `@getvitops/astro` (`@getvitops/astro/Tracking.astro`, `@getvitops/astro/routes`). The route factory handles both the `tel:` beacon and a form POST; validation and business rules stay the consumer's, because every site's form differs. A failed notification never fails the request — the visitor has already submitted, and refusing them because our mail didn't go out turns a lost notification into a lost conversion.

**Added — `site.tracking` and a widened `site.notifications`.** `notifications.email` now accepts a full channel object as well as a bare address (which still means what it did). `tracking` gains `category`.

**Fixed — the capture script now asks for consent instead of only reading it.** It previously checked `granted('marketing')` passively, which under the demand-driven banner is a permanent no-op: nothing else on a page demands `marketing`, so the banner never offered it, so it was never granted, so `_ac` was never written — silently, on every site with the gate enabled. It now calls `require()`, which is what raises the banner, and only when the URL actually carried a click ID or UTM. A visitor arriving organically has nothing to attribute and is never asked.

The integration adds `marketing` to the offered categories when tracking is on, so the banner has a row for the category the script will demand, and warns when tracking is enabled with `consent` off.

**Fixed — revoking consent now clears `_ac`.** The marker `<Tracking />` emits carries `data-consent-cookies`, which the consent runtime's cleanup reads. There was no cleanup path for this cookie before.

**Fixed — the cookie notice discloses `_ac`.** It is first-party, so no provider table would ever name it, and a site running attribution alongside a cookieless analytics provider was previously described as setting no cookies at all.
