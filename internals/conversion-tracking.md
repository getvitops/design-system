# Conversion tracking and notifications

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

A visitor arrives on an ad with a click ID in the URL; `<Tracking />`
(`@getvitops/astro`) captures it into the first-party **`_ac`** cookie; when they later
submit a form or tap a `tel:`/`mailto:` link, `createConversionRoute()` reads the cookie back
and notifies whoever the config names. Three packages, split along the seams the rest of the
toolchain already uses:

| Layer                                         | Where                       | Why there                                                |
| --------------------------------------------- | --------------------------- | -------------------------------------------------------- |
| Attribution vocabulary + cookie               | `@getvitops/utils/tracking` | Framework-agnostic, needed on **both** sides of the wire |
| Plan / render / send                          | `@getvitops/utils/notify`   | Pure planner, I/O sender — `indexing/`'s split exactly   |
| Capture script, `<Tracking />`, route factory | `@getvitops/astro`          | Beside `analytics.ts` + `<Analytics />`                  |

Both `utils` entries are separate subpaths because they are the only modules that run in a
**Worker** rather than at build time — keeping them off `src/index.ts` is what stops a
conversion endpoint pulling `sharp` into its bundle. Neither may use a Node builtin.
`TrackingConfig`/`NotificationsConfig` are the inferred types of `@getvitops/config`'s
`TrackingSchema`/`NotificationsSchema` — utils imports its own configuration types rather than
mirroring them (see `@getvitops/config` above).

Eight things are load-bearing:

- **The capture demands consent; it does not merely read it.** `_ac` is a 90-day identifier
  tying a visitor to an ad, so it waits on `marketing` (configurable — `site.tracking.category`).
  The script calls `require()`, which is what _raises the banner_. It previously called
  `granted()` passively, and that is a permanent no-op: nothing else on a page demands
  `marketing`, so it was never offered, never granted, and `_ac` was never written — silently,
  on every gated site. The integration adds `marketing` to the offered categories when tracking
  is on, so there is a row for the category the script will ask about.
- **Only an arrival that carried something asks.** The demand is guarded on the URL actually
  holding a click ID or UTM. An organic visitor has nothing to attribute and is never
  interrupted — demand-driven consent applied to attribution.
- **The capture is synchronous; only the write waits.** Reading the query string is not storage
  and needs no permission; keeping it does. The click ID is in the URL only on the landing page,
  so deferring the _read_ would lose it. The script also listens for `vitops:consent` rather than
  calling `subscribe()`: `window.vitopsConsent` may still be the inline stub (which has no
  `subscribe`), and a grant can arrive later in the same page view.
- **The marker carries `data-consent` but NOT `data-vitops-tag`.** So `scan()` never tries to
  activate the script — it is ungated by design — while `clearCookies()`, which queries
  `[data-consent="…"]`, finds it and clears `_ac` on revoke.
- **`ConversionEvent` is the abstraction.** The event is the _fact_; how it reads belongs to the
  channel. That is what lets an SMS channel render 160 characters from the same event an email
  renders in full — the rule the legal templates already follow, applied here.
- **The plan is pure and says why anything is skipped.** `planNotifications` touches no network
  and no binding, so a misconfigured site can be told exactly why no notification will arrive.
  A silently unsent conversion notification is indistinguishable from no conversion.
- **`createConversionRoute()` is the one endpoint that has to answer a no-JS `<form method="post">`,
  and it has to answer strangers.** It parses `application/x-www-form-urlencoded` /
  `multipart/form-data` the same way it parses the fetch/beacon JSON path (`navigator.sendBeacon`
  sends a bare string as `text/plain`, not `application/json` — the parser branches on
  content-type, not on assuming JSON), and redirects a no-JS submission to
  `redirectTo`/`errorRedirectTo` rather than handing that visitor's full-page navigation a raw
  `{"success":true}` body. Being public and unauthenticated makes it a relay and a cost amplifier
  by default, so four generic checks ship in the factory rather than being left to each consumer:
  a honeypot (default field names mirror `render.ts`'s `OMIT_FIELDS`) that returns the same
  success response a bot would get for real, so it learns nothing; a best-effort `Origin` check
  against `context.canonical` (absence is never treated as a mismatch — plenty of legitimate
  requests omit it); a `Content-Length` cap; and a per-IP rate limit backed by an injectable
  `RateLimitStore` (an in-memory default, good for one Worker isolate, not a fleet — inject a
  KV/Durable-Object store for real cross-instance limiting).
- **Turnstile verification is a separate, opt-in layer, not one of the four generic checks.** Pass
  `turnstile: { secretKey }` and a submitted `cf-turnstile-response` token gets verified against
  Cloudflare's siteverify endpoint via `verifyTurnstileToken()` (`@getvitops/utils/security` — a
  Worker-safe subpath for the same reason `notify`/`tracking` are). The **secret** key is an env
  var, never config, mirroring every other credential in the toolchain; `site.security.turnstile
  .siteKey` stays public config and is what the legal templates read to name Turnstile in the
  generated privacy policy (see the Legal documents section). Before this existed, that field made
  the policy assert something nothing in the toolchain checked — a bare token in the submission
  is, by default, treated as absent-because-no-JS rather than rejected (`required: true` opts a
  specific form out of the no-JS promise deliberately, rather than by omission). The widget markup
  itself is the consumer's own — there is no `FormRenderer` for it to hook into, matching how the
  rest of the form is already hand-written.

The `email` channel uses Cloudflare Email Sending's **current** binding — structured
`env.EMAIL.send({ to, from, subject, html, text })`, not the legacy `EmailMessage` + hand-built
MIME. The binding is **passed in, never imported**, so utils takes no Cloudflare dependency.
Only transient codes are retried; `E_SENDER_NOT_VERIFIED` and friends are surfaced verbatim,
because nothing here can check whether the sending domain was onboarded
(`wrangler email sending enable <domain>`) and "send failed" would hide the one thing worth
knowing.

**TODO — `sms` and `persist` channels**, and the generic content+provider helpers behind them.
The seam is `NotificationsConfig` plus a sender with `sendEmail`'s signature; adding one should
mean a new file, a branch in `planNotifications` and a schema variant, touching neither
`ConversionEvent` nor the recipient cascade. Only `email` is implemented — one channel is not
enough to know what the abstraction should be.

`_ac` is disclosed by the generated cookie notice via `firstPartyCookies` in `legal/derive.ts`.
It is first-party, so no provider table would ever name it, and a site running attribution
alongside a cookieless analytics provider would otherwise be described as setting no cookies.
