---
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/utils': minor
'@getvitops/cli': minor
---

**New: server-side Google Ads offline conversion upload.** Set
`site.ads.google.reporting: "server"` and a matching
`conversionActionId` (a numeric id or full
`customers/…/conversionActions/…` resource name — **not** the same value
as `conversionLabel`, which is the opaque label the web tag uses and
which the Ads API's upload endpoint doesn't accept) and
`createConversionRoute`'s new `googleAdsOffline` option uploads the
conversion via `ConversionUploadService.UploadClickConversions` instead
of relying on the visitor's browser to fire `gtag.js`. An action with no
matching `conversionActionId` keeps firing client-side regardless of
`reporting`, so turning it on before the id is filled in never silently
drops a conversion. `@getvitops/astro/routes` exports a matching
`toGoogleAdsConfig(config)` adapter, alongside `toCrmConfig`.

Structurally typed against Google's documented REST shape, not verified
against a live Ads account — no developer-token/MCC access exists
anywhere in this toolchain's own setup to test against. Wrapped so a
wrong guess degrades to a stated failure reason (folded into the
conversion email's "Delivery" section, same as a failed CRM write) rather
than breaking, the same caveat `@getvitops/utils/crm`'s Jobber executor
already carries for its own unverified surfaces.

`vitops ads lint` now flags a `reporting: "server"` property whose
configured actions have no matching `conversionActionId` — not a
failure, since that action keeps firing client-side, but worth surfacing
rather than leaving someone to wonder why nothing changed.

Not built: `vitops ads provision` (upserting conversion actions via
`ConversionActionService` and printing back both the label and the
resource id) — same credential blocker, and deliberately left unscoped
until there's a live account to verify the request/response shape
against.
