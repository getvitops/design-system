# CRM submissions

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

Email-list signups (waitlist, blog updates) are a separate block with their own consent: see [campaigns.md](campaigns.md).

`site.crm` (`@getvitops/utils/crm`) pushes a form submission into a client's CRM — HubSpot, Zoho
Bigin, or Jobber — server-side, hung off the same `createConversionRoute()` every conversion already
reaches, rather than a client-side iframe/JS embed. That distinction is the whole reason it exists: a
cross-origin iframe can't read the first-party `_ac` cookie, and a HubSpot-hosted script posts
straight to `api.hsforms.com` — either way the lead reaches the CRM with no record of the ad that
paid for it and no notification email, and the markup can't be white-labelled against this design
system. Tier-1 all the way down: a client form is `<form method="post" action="/api/track">`
against `css/patterns/forms.css`'s existing field vocabulary — no new `/core` component, and
`<wc-form>` stays deliberately deferred.

Four external facts settle most of the design:

- **Zoho Bigin has no unauthenticated submission endpoint.** Every write is OAuth refresh-token
  only, so a browser-side path cannot exist for Bigin at all.
- **HubSpot's unauthenticated forms endpoint is rate-limited per _portal_** and rejects any field
  not already declared on the form. A bot on one client's site would starve every other form
  sharing that portal — the "configure it in their UI first" coupling this feature exists to avoid.
- **Bigin's `Contacts.Last_Name` is mandatory and `Email` is the unique field.** A bare name/email
  form 400s on insert unless a last name is derived.
- **Jobber is a GraphQL API that answers `200 OK` for failures.** A rejected `clientCreate`
  returns `userErrors[]`, and a malformed request returns top-level `errors[]` — both with HTTP
  200, so `jobber.ts` classifies on the body, not the status. Its refresh tokens also rotate by
  default: Refresh Token Rotation must be turned **off** in the app's Developer Center settings,
  since a Worker reading a static `VITOPS_JOBBER_REFRESH_TOKEN` cannot persist a rotated one. A
  per-client private app is never published to Jobber's Marketplace (where rotation ON is
  mandatory), so this is a legitimate setup requirement, not a workaround — `jobber-token.ts`
  detects a rotated token at exchange time and names the fix rather than failing an hour later
  as an opaque 401.

Seven things are load-bearing:

- **CRM-before-notify, and the notification states the outcome.** `createConversionRoute()` calls
  `deliverToCrm()` after the honeypot/Turnstile/`validate` gates (a honeypot trip must never reach
  the CRM) and before `notify()`, then folds the result into `notify`'s fourth arg —
  `describeCrmResult()` becomes one line in the email's "Delivery" section
  (`Written to HubSpot (contact 1234)` / `⚠ Not written to HubSpot: access token rejected (401)`).
  The email is the durability floor: a failed CRM write must still reach a human with the full
  submission and a stated reason, which is only possible once the outcome is known.
- **A failed CRM write never fails the request.** The visitor has already submitted; refusing them
  because a CRM token expired turns a lost write into a lost conversion — the same rule
  `notify()`'s own docblock states for the email channel.
- **Consent gates `_ac`, never the CRM write.** A visitor filling in a form is deliberately handing
  over their data — that's the necessary processing of their own submission. `event.tracking` is
  `null` for a visitor who declined `marketing`, and `map.ts`'s `mapSubmission()` simply writes no
  attribution fields; absence is not an error, and the CRM write proceeds regardless.
- **Bigin's last-name fallback**, in `crm/map.ts`'s `deriveLastName()`: an explicit `lastName` field
  wins; failing that, the last space-separated token of the full name; failing that, the email
  local-part; failing all three, a stated refusal rather than a fabricated name or a 400 Bigin would
  otherwise return.
- **Credentials are a function of `locals`, never config** — `createConversionRoute()`'s `crm`
  option takes `credentials?: (locals) => CrmCredentials`, matching `binding?: (locals) =>
  EmailBinding` exactly, so a consumer reads `VITOPS_HUBSPOT_ACCESS_TOKEN` /
  `VITOPS_ZOHO_CLIENT_ID`/`_CLIENT_SECRET`/`_REFRESH_TOKEN` /
  `VITOPS_JOBBER_CLIENT_ID`/`_CLIENT_SECRET`/`_REFRESH_TOKEN` from `cloudflare:workers`'s `env`.
  That rule is absolute in this toolchain.
- **`vitops crm check` is the drift guard, and the reason a separate CLI command exists at all.**
  HubSpot _rejects_ a submission naming a property that isn't on the form; Bigin _silently ignores_
  one. A typo'd `site.crm.fieldMap`/`trackingFields` entry is therefore invisible in one CRM and
  fatal in the other, and only fetching the live field/property list can tell you which.
  `vitops crm setup` creates missing HubSpot properties; Bigin has no such API, so it always
  resolves to a manual reminder, matching how `ads setup` handles a platform with no verification
  API. Jobber currently renders `fieldMap`/`trackingFields` values as note-text lines rather than
  app-configured custom fields (see below), so both subcommands say so rather than checking an
  unverified endpoint.

Compliance is not optional here, and follows the rule Legal documents already set: **the config
records facts; the template owns prose.** `legal/providers.ts` names HubSpot, Zoho Bigin or Jobber
once `site.crm` picks one — the same reasoning `site.ads` already established for ad platforms,
since `site.crm` makes the toolchain the thing deciding whether a submission reaches any of them.
Bigin's cross-border-transfer sentence derives from `bigin.dataCenter` exactly as `matomoLocation()`
derives Matomo Cloud's: `dataCenter: 'ca'` asserts `storage: [{ country: 'Canada' }]`, which
`derive.ts`'s `foreign()` then correctly omits from the disclosure — a real win for an Ontario
client running Bigin's Canadian data centre. HubSpot's `operatorCountry` is verified (Delaware
corporation, Cambridge, MA); Zoho's is deliberately left unset pending verification, since Zoho
Corporation has both an Indian and a US entity and which one controls a given account is not
something the config can see — don't invent a jurisdiction there. **Jobber's operator is Canadian
but its storage is not** — Octopusapp Inc. d/b/a Jobber, Edmonton AB, verified from its own
published privacy policy, which is exactly why `KNOWN_PROCESSORS.jobber` sets `operatorCountry:
'Canada'` **and** `storage: [{ country: 'the United States' }, { country: 'Canada' }]` rather than
inheriting Bigin's Canadian-data-centre win: that same policy names the United States as a
processing location, so a Canadian operator must not be read as Canadian-only storage. Unlike
Bigin's `dataCenter`, this isn't derived from a config field — Jobber gives the config nothing to
derive from, so it's asserted once, directly in the table.

`packages/utils/src/crm/` follows the pure-planner/executor split every other module here does
(`plan.ts` decides whether the channel is on, from one `PROVIDER_REQUIREMENTS` table rather than a
hand-written `if` per provider; `map.ts` decides how one submission becomes a provider-neutral
`CrmRecord`; `hubspot.ts`/`bigin.ts`/`jobber.ts` execute and decide nothing beyond the last-name
refusal and Jobber's own GraphQL-body classification). `identifySubmitter()` — pulling first/last
name, email, phone, company out of a form's fields by its aliases — was promoted out of
`notify/render.ts`'s private `submitterName()` into `tracking/identity.ts`, because `crm/map.ts`
needed the whole identity, not just a display name, and a second independent alias cascade is
exactly the bug `render.ts`'s own comment records: a downstream site had five of six forms carrying
`first_name`/`last_name`, and a name-only cascade read every one of them as "Unknown".

Three CRMs is also the point where the binary `hubspot ? … : bigin` branches a second provider
could get away with had to go: `describeCrmResult`'s provider label, `deliverToCrm`'s executor
dispatch, and `planCrm`'s block/credential checks are each one small table now
(`PROVIDER_LABELS`, a `switch` with a `never` exhaustiveness check, `PROVIDER_REQUIREMENTS`), so a
fourth provider added to `CrmProvider` with no matching entry is a compile error rather than a
silently mislabelled email or a runtime crash on a missing config block.

No durable retry queue (the notification email is the durability floor, matching `notify`'s own
restraint), no client-side path (impossible for Bigin, actively harmful for HubSpot's rate limit),
and no generic connector framework — three CRMs with three genuinely different transports (a
form-submission POST, a REST upsert, a GraphQL mutation) is evidence against a shared abstraction,
not for one, the same restraint `notify`'s own TODO records for its unimplemented channels.

**Jobber-specific, and each an open item rather than a silent guess:**

- Only `clientCreate` is verified against Jobber's own published docs. The best-effort note
  (`noteCreate`) and the dedupe lookup (`clients` search) are **not** — Jobber's changelog records
  `requestNoteCreate`/`requestUpsert` being _removed_, so the note surface is genuinely in flux.
  Both are wrapped so a wrong guess degrades rather than breaks: a failed note never downgrades a
  successful client write, and `dedupe` defaults to `false` until the search shape is confirmed
  against a live account's GraphiQL schema — turn it on once verified, and update `jobber.ts`'s
  docblock with what was found.
- Attribution and any unmapped extra fields render into the note body by default, not a Jobber
  custom field — Jobber's app-configured custom fields need the Connect plan or higher, and their
  `clientCreate` input shape is a further unverified surface. `fieldMap`/`trackingFields` values
  still land as note lines rather than a guessed custom-field mutation input.
- A resubmitting visitor creates a second Jobber client unless `crm.jobber.dedupe: true` is set
  (once verified) — Jobber's `clientCreate` has no upsert, unlike Bigin's.
