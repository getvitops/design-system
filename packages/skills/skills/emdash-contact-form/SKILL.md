---
name: emdash-contact-form
description: How the contact form works on this site — the on-demand `/api/track` route, no-JS behaviour, where submissions go, spam protection and Turnstile, and the privacy-policy inventory. Use when adding or changing a form, fixing submissions that don't arrive, setting up notifications, CRM or Turnstile, or touching `src/pages/api/track.ts`.
---

# Contact form

The `vitops_form` block posts a plain `<form method="post">` to `src/pages/api/track.ts`
(`prerender = false`, built with `createConversionRoute()`). It is the one on-demand public route,
and it also answers the conversion beacons.

- **No JavaScript needed.** The route answers a form post with a 303 back to the page plus
  `?sent=1#form-sent` or `?error=1#form-error`, and the block's two notices are revealed by that
  fragment. Keep one form per page.
- **Where submissions go:** `site.notifications.email` (or the primary location's `email`) and
  `site.crm` when set. **With neither, the route refuses the post** rather than accept a message
  nobody receives, so set `site.notifications.email` before launch and run `vitops email setup` for
  its sender domain. A failed CRM write never fails the request; it is stated in the notification
  email, which is the durability floor.
- **Spam protection:** a honeypot field, the route's origin / size / per-IP rate checks, and
  Cloudflare Turnstile once `vitops setup turnstile` has put the public key in
  `site.security.turnstile.siteKey` and saved the Worker secret `VITOPS_TURNSTILE_SECRET` (never in
  `site.json`). With a key set the route fails closed if the secret is missing. `TURNSTILE_REQUIRED`
  in the route (default `true`) makes a token-less post a refusal, which means the form needs
  JavaScript; set it `false` to keep a no-JS submit working and accept that a bot can then skip the
  token. Turnstile is category `necessary` (it protects the form being sent), loads only when a
  visitor first uses the form, and its origin is allowed in the Report-Only CSP in
  `public/_headers`.
- **Privacy policy inventory.** `vitops legal` derives "what personal information we collect" from
  `site.templates` entries of type `form`, not from the editor's block, so a form added in the admin
  is invisible to it. When you add or change form fields, mirror them in a `site.templates` form
  entry in `site.json`, or the generated policy under-reports.
- A field named `phone` submits as `tel` (the route reserves `phone` and `event`).
- The per-IP rate limit is per Worker isolate; add a KV-backed `RateLimitStore` if you need a
  fleet-wide one.
