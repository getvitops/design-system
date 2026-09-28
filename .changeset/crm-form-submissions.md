---
'@getvitops/generator': minor
'@getvitops/utils': minor
'@getvitops/cli': minor
'@getvitops/astro': minor
---

Add `site.crm` — push form submissions into HubSpot, Zoho Bigin, or Jobber.

Client sites need form submissions to land in the client's CRM. The options available before this
— a HubSpot/Bigin/Jobber iframe or JS embed — fail on three counts: the markup can't be
white-labelled against this design system, nothing can operate on the submission before it leaves
the page, and the submission never touched `createConversionRoute()`, so `_ac` ad-click attribution
was lost and no conversion notification was planned.

This adds one server-side path for all three CRMs, hung off the conversion route that already
exists. `createConversionRoute()` gets a new `crm` option (`{ config, credentials, fetch?,
timeoutMs? }`); credentials arrive as a function of `locals`, exactly like the existing `binding`
option, and are never config. A failed CRM write never fails the request and is folded into the
notification email's new "Delivery" section, so a broken CRM token is never silent.

New `@getvitops/utils/crm` subpath: `deliverToCrm()`, `mapSubmission()`, `deriveLastName()` (Bigin
requires a last name; this derives one from an explicit field, a full name, or an email address,
refusing rather than fabricating one), `submitToHubSpot()`, `submitToBigin()`, `submitToJobber()`.
`identifySubmitter()` was promoted out of `notify`'s private name-guessing cascade into
`@getvitops/utils/tracking`, since the CRM mapper needed the whole identity (first/last name,
email, phone, company), not just a display name.

Jobber is GraphQL, not REST, and answers `200 OK` for failures — a rejected `clientCreate` returns
`userErrors[]`, a malformed request returns top-level `errors[]`. `submitToJobber()` classifies on
the response body, not just the status. Its refresh tokens also rotate by default: **Refresh Token
Rotation must be turned off** in the app's Developer Center settings, since a Worker reading a
static `VITOPS_JOBBER_REFRESH_TOKEN` cannot persist a rotated one — a rotated token is detected at
exchange time and reported with the fix, rather than surfacing an hour later as an opaque 401.
Attribution and unmapped extra fields render into a best-effort note by default (works on every
Jobber plan); a resubmitting visitor creates a second Jobber client unless `crm.jobber.dedupe: true`
is set once its lookup query has been verified against a live account (defaults `false` pending
that verification — see `jobber.ts`'s docblock).

New `site.crm` config block (`provider`, `hubspot`/`bigin`/`jobber`, `fieldMap`, `trackingFields`)
and two CLI commands: `vitops crm check` (fetches the live HubSpot property list or Bigin field
list and reports every mapped name that doesn't exist there — HubSpot rejects an unknown field
outright, Bigin silently drops it; Jobber has nothing live to check yet, since its mapped values
currently render as note text) and `vitops crm setup` (creates missing HubSpot properties; Bigin
and Jobber have no such API, so both always print a manual reminder).

The generated privacy policy now names HubSpot, Zoho Bigin, or Jobber when `site.crm` configures
one. Bigin gets the same cross-border-transfer derivation Matomo Cloud already gets: a
`dataCenter: 'ca'` asserts no transfer outside Canada, any other data centre does. Jobber's
operator (Octopusapp Inc. d/b/a Jobber) is Canadian, but its own privacy policy names the United
States as a processing location too, so the policy always asserts a cross-border transfer for
Jobber regardless of config — a Canadian operator is not read as Canadian-only storage.

Credentials: `VITOPS_HUBSPOT_ACCESS_TOKEN` for HubSpot; `VITOPS_ZOHO_CLIENT_ID` /
`VITOPS_ZOHO_CLIENT_SECRET` / `VITOPS_ZOHO_REFRESH_TOKEN` for Bigin; `VITOPS_JOBBER_CLIENT_ID` /
`VITOPS_JOBBER_CLIENT_SECRET` / `VITOPS_JOBBER_REFRESH_TOKEN` for Jobber. Never config.

No consumer-facing change in `@getvitops/astro` beyond the new `crm` route option and a build
warning when `site.crm` is configured with no route answering `TRACKING_ENDPOINT` — CSS/Bricks/
tailwind outputs are unaffected.
