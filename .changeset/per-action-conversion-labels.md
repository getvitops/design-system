---
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/utils': minor
---

**`site.ads.google.conversionLabel` now accepts a per-action map** —
`{ call?, email?, form? }` — instead of one bare string shared by every
interaction. A bare string still works (back-compat, treated as `call`), but a
call and an email click used to report as the **same** Google Ads conversion
action, indistinguishable in the account; each action now gets its own
`send_to` target.

**New: `vitopsFormConversion(formEl)`**, exposed as `window.vitopsFormConversion`
by `<Tracking />`'s capture script — call it from your own fetch-based form
submit handler once the POST to `createConversionRoute()` succeeds, to fire the
`form` Google Ads conversion action client-side (mirroring the existing
tel:/mailto: click handler, which now fires `call`/`email` instead of sharing
one label). Idempotent per form element. There's deliberately no server-side
equivalent for a no-JS `<form method="post">` submission — that's a full-page
redirect with no script to fire from, and a real server-side Google Ads
conversion needs the Ads API's click-conversion upload (developer token + MCC
access), tracked separately in the vNext backlog.

**Fixed: the conversion route's rate limiter no longer trusts the client's
raw `event` field.** It used to key on whatever string a client sent
(`` `${ip}:${body.event}` ``), so varying that value on every request let a
form submission dodge the per-IP rate limit entirely — only `'call'`/`'email'`
were ever recognized, and anything else got its own fresh bucket. The key now
uses the server's own classification (`call` | `email` | `form`), closing that
bypass without changing the existing call-vs-email-don't-compete behavior.

**New: `site.notifications.actionUrl`** — an optional action-link template
added to the conversion-notification email as an "Actions" section.
`{clickId}` is replaced with the ad click ID captured on `_ac` (gclid, fbclid,
etc.); the section is omitted when the event has no click ID to interpolate,
rather than emailing a broken link.
