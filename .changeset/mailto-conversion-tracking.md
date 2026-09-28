---
'@getvitops/utils': minor
'@getvitops/astro': minor
---

Track `mailto:` link clicks as conversions, alongside the existing `tel:` link tracking.

Before this, the capture script only beaconed `tel:` clicks; a `mailto:` link on the same page was
invisible to attribution — a visitor who emailed the business instead of calling generated no
conversion event at all. `<Tracking />`'s inlined script now listens for both, sending `{ event:
'email', email }` via `navigator.sendBeacon` the same way it already sends `{ event: 'call', phone
}`.

`ConversionEvent['type']` gains an `'email'` member alongside `'form'`/`'call'`, with a new
`email` field. `createConversionRoute()` handles it exactly like a call: no honeypot, Turnstile or
CRM checks (there are no form fields to validate or map), a 204 response, and a notification email
subject reading `[Email Click] Visitor emailing ...`.

No config changes and no new options — a site with `<Tracking />` already mounted picks this up
automatically the next time it rebuilds.
