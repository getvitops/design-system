---
type: "Design Concept"
title: "Vitops conversion tracking — ad attribution and notifications"
description: "How an ad click becomes a notified conversion: the `_ac` cookie, consent-demanding capture, the pure notification planner, and the Cloudflare email channel."
resource: "site.json"
tags: [tracking, attribution, conversions, notifications, consent]
generator: "@getvitops/generator"
---

# Conversion tracking

A visitor arrives on an ad carrying a click ID; `<Tracking />` captures it into the
first-party **`_ac`** cookie; when they later submit a form or tap a `tel:` link,
`createConversionRoute()` reads the cookie back and notifies whoever the config names.

```json
{
  "site": {
    "tracking": { "enabled": true, "category": "marketing" },
    "notifications": { "email": "leads@example.com" }
  }
}
```

A bare address is shorthand for `{ provider: "cloudflare", to }`. The recipient otherwise
falls back to the primary location's email, and the sender to `noreply@<domains.canonical>`.

## Where each piece lives

| Layer | Module | Why there |
| --- | --- | --- |
| Attribution vocabulary + cookie | `@getvitops/utils/tracking` | Needed on **both** sides of the wire |
| Plan / render / send | `@getvitops/utils/notify` | Pure planner, I/O sender |
| Capture script, `<Tracking />`, route factory | `@getvitops/astro` | Beside the analytics components |

Both utils entries are **separate subpaths** because they are the only modules that run in a
**Worker** rather than at build time. Keeping them off the package index is what stops a
conversion endpoint pulling `sharp` into its bundle. Neither may use a Node builtin.

**Import them from `@getvitops/astro` if that is your only direct dependency.**
`@getvitops/astro/tracking` re-exports everything in `@getvitops/utils/tracking` (plus
`TRACKING_ENDPOINT`), so the flow works with one install — under strict pnpm, app code cannot
resolve a transitive dependency, and `@getvitops/utils` would otherwise have to be added by
hand. Do **not** reach for the same symbols on `@getvitops/astro`'s index instead: that entry
pulls the integration and its Node builtins, which is the import that drags `sharp` toward a
Worker bundle. `@getvitops/astro/tracking` and `@getvitops/astro/routes` are both clean.

⚠️ The route you mount must answer **`/api/track`** (`TRACKING_ENDPOINT`) — the capture
script beacons `tel:` conversions there, and a route at any other path means every call
conversion 404s silently. The integration warns at build when tracking is on and no such route
exists.

## The capture demands consent

`_ac` is a 90-day identifier tying a visitor to an ad, so it waits on `marketing` (override
with `site.tracking.category`).

⚠️ The script calls **`require()`**, not `granted()` — `require()` is what *raises the
banner*. A passive `granted()` here is a permanent no-op: nothing else on a page demands
`marketing`, so it is never offered, never granted, and `_ac` is never written — silently, on
every gated site. The integration adds `marketing` to the offered categories when tracking is
on, so there is a row for the category the script will ask about.

**Only an arrival that carried something asks.** The demand is guarded on the URL actually
holding a click ID or UTM, so an organic visitor — who has nothing to attribute — is never
interrupted. That is demand-driven consent applied to attribution.

**The capture is synchronous; only the write waits.** Reading the query string is not storage
and needs no permission; *keeping* it does. The click ID is in the URL only on the landing
page, so deferring the read would lose it outright.

The marker element carries `data-consent` but deliberately **not** `data-vitops-tag`: the
scan never tries to "activate" it (it is ungated by design), while the revoke path — which
queries `[data-consent="…"]` — still finds it and clears `_ac`.

## The event is the abstraction

`ConversionEvent` is the *fact*; how it reads belongs to the channel. That is what lets an SMS
channel render 160 characters from the same event an email renders in full.

**The plan is pure and says why anything is skipped.** `planNotifications` touches no network
and no binding, so a misconfigured site can be told exactly why no notification will arrive — a
silently unsent conversion notification is indistinguishable from no conversion.

## The email channel

Cloudflare Email Sending's **current** binding — structured
`env.EMAIL.send({ to, from, subject, html, text })`, not the legacy `EmailMessage` plus
hand-built MIME. The binding is **passed in, never imported**, so utils takes no Cloudflare
dependency.

Only transient codes are retried. `E_SENDER_NOT_VERIFIED` and friends are surfaced
**verbatim**, because nothing here can check whether the sending domain was onboarded — run:

```sh
wrangler email sending enable <domain>
```

A generic "send failed" would hide the one thing worth knowing.

Only `email` is implemented. `sms` and `persist` are a planned seam
(`NotificationsConfig` plus a sender with `sendEmail`'s signature); one channel is not enough
to know what the abstraction should be.

## Disclosure

`_ac` is disclosed by the generated cookie notice as a first-party cookie. It has to be stated
explicitly: no provider table would ever name a first-party cookie, so a site running
attribution alongside a **cookieless** analytics provider would otherwise be described as
setting no cookies at all. See [legal.md](legal.md).
