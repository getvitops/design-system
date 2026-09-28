# CRM form submissions — HubSpot + Zoho Bigin + Jobber

## Context

Client sites need form submissions to land in the client's CRM. The options available today
are a HubSpot/Bigin/Jobber iframe or JS embed, and both fail on the same three counts: the
markup can't be white-labelled against this design system, nothing can operate on the
submission before it leaves the page, and — the deciding one — **the submission never touches
`createConversionRoute()`**, so `_ac` attribution is lost and no conversion notification is
planned. A cross-origin iframe cannot read the first-party `_ac` cookie, and a HubSpot-hosted
script posts straight to `api.hsforms.com`. Either way the lead reaches the CRM with no record
of the ad that paid for it, and nobody gets told.

Four external facts settle most of the design:

- **Zoho Bigin has no unauthenticated submission endpoint.** Every write is OAuth
  refresh-token only. A browser-side path cannot exist for Bigin at all.
- **HubSpot's unauthenticated forms endpoint is rate-limited per _portal_** (50 req/10s), and
  since 2022-03-21 it rejects any submission carrying a field not already on the form. So a
  bot on one client's site would starve every other form in that portal, and the "configure it
  in their UI first" coupling we're escaping comes straight back.
- **Bigin's `Contacts.Last_Name` is `system_mandatory: true`** and `Email` is the unique field
  (verified against the live org via the Bigin fields-metadata API). A `name` + `email` form
  will 400 on insert unless a last name is derived.
- **Jobber is GraphQL-only, has no unauthenticated endpoint either, and answers `200 OK` for
  failures** — a rejected `clientCreate` returns `userErrors[]`, a malformed request returns
  top-level `errors[]`, both with HTTP 200. Its refresh tokens also rotate by default, which a
  Worker reading a static env var cannot survive; this integration requires rotation turned
  off in the app's Developer Center, a legitimate one-time setup step for a private per-client
  app (never published to Jobber's Marketplace, where rotation ON is mandatory).

So: **one server-side path for all three CRMs, hung off the conversion route that already exists.**
Nothing new ships in `@getvitops/core` — `css/patterns/forms.css` already provides the whole
field vocabulary (`.form-group`, `.form-group__error`, `.input-group`, `.fieldset`,
`.custom-check`, `.switch`), which is the white-labelling answer. Forms stay tier-1
`<form method="post" action="/api/track">`, which already works with no JS because the route
already parses urlencoded/multipart and redirects.

Intended outcome: a client form is our own markup, posts to our own endpoint, arrives in their
CRM with the click ID attached, and still triggers the notification email — with the CRM
outcome stated in that email so a failed write is never silent.

---

## Design decisions

| Decision                | Choice                                                                                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Where the write happens | Server-side only, inside `createConversionRoute()`                                                                                                                       |
| HubSpot path            | `POST /submissions/v3/integration/secure/submit/{portalId}/{formGuid}`, private-app Bearer — registers a real _form submission_, so workflows/lifecycle/attribution fire |
| Bigin path              | `POST https://www.zohoapis.<dc>/bigin/v2/Contacts/upsert`, `duplicate_check_fields: ['Email']`                                                                           |
| Jobber path             | GraphQL `clientCreate` at `https://api.getjobber.com/api/graphql`, Bearer + `X-JOBBER-GRAPHQL-VERSION`, then a best-effort `noteCreate`                                  |
| Field mapping           | Standalone `site.crm` block, not on `site.templates`                                                                                                                     |
| Failure handling        | CRM first, then notify — the notification email carries the CRM outcome                                                                                                  |
| Consent                 | The CRM write is **never** gated. Only `_ac` is (already `marketing`)                                                                                                    |
| Tier                    | No new `/core` component. `<wc-form>` deliberately deferred                                                                                                              |

**Why CRM-before-notify.** The email is the durability floor. A failed CRM write must still
reach a human with the full submission and a stated reason, which is only possible if the
outcome is known before the mail is rendered. Costs one sequential fetch (capped, below).

**Why consent must not gate it.** A visitor who fills in a form is deliberately handing over
their data — that is the necessary processing of their own submission. The tempting wrong move
is to gate it on `marketing`. What _is_ gated is `_ac`; so for a visitor who declined,
`event.tracking` is `null` and the mapper simply writes no attribution fields. Absence is not
an error.

---

## Files

### New — `packages/utils/src/crm/` (Worker-safe subpath)

Follows the pure-planner / executor split used by `indexing/`, `onboarding/`, `ads/`,
`hosting/`, `reviews/` and `notify/`. No Node builtins; every transport injected.

- **`types.ts`** — structural mirror of the `site.crm` block (utils cannot import the
  generator — same arrangement and same reason as `indexing/types.ts` and `notify/types.ts`).
  `CrmConfig`, `CrmProvider`, `HubSpotConfig`, `BiginConfig`, `JobberConfig`, `CrmCredentials`,
  `CrmPlan`, `CrmResult { ok, provider, recordId?, reason?, code? }`, and `PROVIDER_LABELS` — an
  exhaustive `Record<CrmProvider, string>` so a provider added here without a label is a
  compile error, not a mislabelled notification email. Optionals written `?: T | undefined` for
  `exactOptionalPropertyTypes`.
- **`plan.ts`** — pure, decides everything about _config_: which provider, or `enabled: false`
  with a stated `skip` reason (no `site.crm`, no credential, provider block missing). Mirrors
  `notify/plan.ts`'s `ChannelPlan { enabled, skip }` shape so `--dry` is a complete account.
- **`map.ts`** — pure, decides everything about _one submission_. `mapSubmission(event, config)`
  → a provider-neutral `CrmRecord { firstName?, lastName?, email?, phone?, company?, message?,
extra, attribution }`. This is where the two subtle rules live, and both get pinned tests:
  - **Bigin last-name fallback**: explicit `last_name` field → split the full name on its last
    space → email local-part → refuse with a stated reason. Never let Bigin 400.
  - **Attribution**: `event.tracking` keys mapped through `config.trackingFields`; a `null`
    tracking record yields `{}`, not an error.
- **`identity` extraction** — promote `render.ts`'s private `submitterName()` cascade into
  `packages/utils/src/tracking/identity.ts` (exported from `@getvitops/utils/tracking`) as
  `identifySubmitter(formData)`, returning the whole `{ firstName, lastName, fullName, email,
phone, company }` set. It belongs beside `ConversionEvent`, which already lives in
  `tracking/`, and both `notify/render.ts` and `crm/map.ts` already import that subpath — so no
  new coupling. `render.ts`'s `submitterName()` becomes a one-line delegate. Its existing
  comment records a real downstream failure from having two copies of this cascade; do not
  write a third.
- **`hubspot.ts`** — executor, decides nothing. Builds
  `{ fields: [{ objectTypeId: '0-1', name, value }], context: { hutk?, pageUri?, pageName? } }`
  and POSTs to the secure endpoint with `Authorization: Bearer`. Classifies: 401 → credential,
  400 with `MISSING_REQUIRED_FIELDS`/unknown-field → mapping, 429 → rate limit.
- **`bigin.ts`** — executor. `POST .../bigin/v2/Contacts/upsert`, `Authorization:
Zoho-oauthtoken <token>`, body `{ data: [record], duplicate_check_fields: ['Email'] }`.
  Data-centre host derived from `config.bigin.dataCenter` (`ca` → `www.zohoapis.ca`).
  Optionally opens a `Pipelines` record when `bigin.pipeline.enabled`.
- **`zoho-token.ts`** — the refresh-token grant against
  `https://accounts.zoho.<dc>/oauth/v2/token`. **Not** in `google/token.ts`: that module imports
  `node:crypto` for the RS256 service-account assertion and is therefore not Worker-safe. Zoho's
  grant is a plain form POST, so this one is. Per-isolate access-token cache keyed on the
  refresh token with an expiry margin.
- **`jobber.ts`** — executor, and the odd one out: Jobber is GraphQL, not REST, so it classifies
  in four layers instead of one status check — transport error → HTTP status (401/429) →
  top-level `errors[]` → `userErrors[]` — because a rejected mutation still answers `200 OK`.
  Only `clientCreate` is verified against Jobber's published docs; the best-effort `noteCreate`
  (carrying the message + unmapped attribution/extra) and the `clients` dedupe lookup are
  **not**, so both degrade rather than break: a failed note never downgrades a successful client
  write, and `dedupe` defaults to `false` until the search shape is confirmed live.
- **`jobber-token.ts`** — the refresh-token grant against
  `https://api.getjobber.com/api/oauth/token`. Same shape as `zoho-token.ts`, plus one thing
  Zoho's grant never needs: it detects a **rotated** refresh token in the response (Jobber's
  Refresh Token Rotation defaults ON) and throws a specific, actionable error rather than
  silently caching a token this integration can never persist past the first hour.
- **`index.ts`** — `deliverToCrm(event, config, deps)` → `CrmResult`. Never throws. Wraps every
  fetch in `AbortSignal.timeout(deps.timeoutMs ?? 5_000)` so a hanging CRM cannot hold a
  visitor's request open. `fetchImpl` injected, as in `security/turnstile.ts` and
  `indexing/gsc.ts`. Dispatch is a `switch` on `CrmProvider` with a `never` exhaustiveness
  check, and `describeCrmResult` reads its label from `PROVIDER_LABELS` — both replace what were
  binary `hubspot ? … : bigin` ternaries before a third provider existed to expose them.

Wire the subpath into **both** `packages/utils/package.json` `exports` and the `pack.entry`
array in `packages/utils/vite.config.ts` — a subpath missing from either is unreachable.

### Modified — `packages/astro/src/routes/conversion.ts`

The insertion point is the single `await notify(...)` call at line 385.

- New option `crm?: { config: CrmConfig; credentials?: (locals: unknown) => CrmCredentials |
undefined; fetch?: typeof fetch; timeoutMs?: number }`. Credentials arrive as a **function of
  `locals`**, exactly like `binding?: (locals) => EmailBinding` — the consumer reads them from
  `import { env } from 'cloudflare:workers'`. Credentials are never config; that rule is
  absolute in this toolchain.
- Read `hubspotutk` off the request cookie header via the existing `readCookie` from
  `@getvitops/utils/tracking` and pass it, plus `pageUri` from the `Referer`, as a
  provider-neutral `pageContext`. HubSpot reads `hutk` to stitch the submission to its own
  session tracking; Jobber reads `pageUri` for its note body. Neither field is HubSpot-specific
  to build (the option was renamed from `hubspotContext` once a second provider needed it), so
  it's passed unconditionally rather than gated on which provider is configured.
- Call `deliverToCrm` **after** the honeypot/Turnstile/`validate` gates and after `event` is
  built, **before** `notify`. A honeypot trip must never reach the CRM — same rule as `notify`.
- Widen `notify()` with a fourth optional arg `{ notes?: string[] }`; `renderEmail` appends a
  "Delivery" section from it. Deliberately a channel-neutral `string[]` rather than a
  `CrmResult`, so `notify` gains no dependency on `crm` and the seam serves any future sink.
  The route composes one line either way (`Written to HubSpot (contact 1234)` /
  `⚠ Not written to HubSpot: access token rejected (401)`).
- `onResult` gains the CRM outcome: replace the inline
  `Awaited<ReturnType<typeof notify>>` with a named `ConversionResult` interface carrying
  `crm?: CrmResult`. Additive.
- **A failed CRM write never fails the request**, restating the rule the docblock already sets
  for notifications: the visitor has already submitted, and refusing them because our CRM's
  token expired turns a lost write into a lost conversion.

### Modified — `packages/generator/src/config.ts`

New `site.crm` block, every field through `desc()`:

```
site.crm?: {
  provider: 'hubspot' | 'bigin' | 'jobber'
  enabled?: boolean
  hubspot?: { portalId, formGuid, dataCenter?: 'na' | 'eu' }
  bigin?:   { dataCenter: 'com'|'ca'|'eu'|'in'|'com.au'|'jp',
              duplicateCheckField?, pipeline?: { enabled, subPipeline?, stage? } }
  jobber?:  { apiVersion?, dedupe?: boolean, note?: { enabled?: boolean } }
  fieldMap?: Record<string, string>        // submitted field name → CRM property
  trackingFields?: Record<string, string>  // _ac key → CRM property
}
```

`validateConfig` cross-field checks (the block sits with the other integrity rules around
`config.ts:1309-1538`):

- `provider` decides which block is required (`hubspot` → `crm.hubspot`, `bigin` → `crm.bigin`,
  `jobber` → `crm.jobber`), via one `CRM_PROVIDER_BLOCKS` table rather than a hand-written `if`
  per provider — a provider added to `CRM_PROVIDERS` with no entry here is a type error.
- every `trackingFields` key ∈ `TRACKED_PARAMS ∪ { landingPage, referrer, ab_variant }`,
  imported from `@getvitops/utils/tracking` — the generator already imports `AD_PLATFORMS` from
  utils, so that direction is allowed. A typo'd key is otherwise a silently dead mapping.

Do **not** add `crm` to `MOVED_KEYS` — it never existed at the root, matching `ads`/`reviews`.

Also update the `legal.privacyPolicy.processors` description, which currently names CRMs as the
consumer's to declare.

### Modified — `packages/generator/src/legal/`

This is the compliance half, and it is not optional. A site pushing leads to HubSpot in the US
whose PIPEDA policy never mentions the transfer is a compliance defect — the same class of
defect as "a policy naming Plausible while the site runs GA".

- **`providers.ts`**: add `hubspot`, `zohoBigin` and `jobber` to `KNOWN_PROCESSORS`; extend
  `detectProcessorKeys(cfg)` with `site.crm?.provider`. Derive Bigin's storage country from the
  data centre exactly as `matomoLocation()` derives Matomo's — `bigin.dataCenter: 'ca'` →
  `storage: [{ country: 'Canada' }]`, which `derive.ts`'s `foreign()` then correctly filters
  out, so the policy asserts no cross-border transfer for a Canadian-hosted Bigin. That is a
  real win for Ontario clients and it must fall out of the config, not prose. **Jobber's is the
  opposite shape, deliberately**: its `operatorCountry` (Canada — Octopusapp Inc. d/b/a Jobber,
  Edmonton AB, verified from its own privacy policy) and its `storage` (both the United States
  and Canada — that same policy names the US as a processing location) are asserted directly in
  the table rather than derived from a config field, because Jobber gives the config nothing to
  derive from. A Canadian operator must not be read as Canadian-only storage; don't "simplify"
  this into Bigin's `dataCenter: 'ca'` win, which Jobber hasn't earned.
- The table's docblock currently states CRMs are out of its scope. Update it with the reason
  that changed: the table covers "the set of providers the toolchain itself can vouch for", and
  once `site.crm` exists the toolchain is the thing making the call.
- **`operatorCountry` for HubSpot and Jobber is verified; Zoho's stays unset** — Zoho has both
  US and Indian entities and which controls a given account isn't something the config can see.
  Record what's verified; don't invent a jurisdiction.
- The hand-nested `biginLocation(matomoLocation(p, site), site)` chain becomes a
  `LOCATION_REFINERS` array + `reduce` — adding a refiner is an array entry, not another
  nesting level. (Jobber needs no refiner of its own: its location is static, not
  config-derived.)

### Modified — `packages/astro/src/integration.ts`

Extend the existing `hasConversionRoute(root)` build warning: warn when `site.crm` is configured
but no route answers `TRACKING_ENDPOINT`. This is the Turnstile lesson — a config field
asserting a fact nothing implements.

### New — `packages/cli/src/commands/crm.ts`

Subcommand group, `Config`-anchored via `SITE_OPTS` + `siteConfig(a)` from `commands/shared.ts`.
Modelled on `commands/ads.ts`. Read-and-create only; never destructive.

- **`vitops crm check`** — the drift guard, and the reason this command exists. Fetches live
  field metadata (Bigin `GET /bigin/v2/settings/fields?module=Contacts`; HubSpot
  `GET /crm/v3/properties/contacts` plus the form definition) and reports every `fieldMap` /
  `trackingFields` target that doesn't exist. HubSpot _rejects_ unknown fields and Bigin
  _ignores_ them, so without this a broken mapping is invisible in one CRM and fatal in the
  other. Exits non-zero on drift. **Jobber has no live check yet** — its executor renders
  `fieldMap`/`trackingFields` values as note-text lines rather than app-configured custom
  fields (see `jobber.ts`'s docblock on why that surface is deferred), so there is nothing
  there that can silently mismatch; the subcommand says so rather than querying an unverified
  endpoint.
- **`vitops crm setup`** — HubSpot only: create missing attribution properties via
  `POST /crm/v3/properties/contacts`. Bigin resolves to a manual reminder (no property-creation
  API), matching `ads`' handling of platforms with no API. Jobber resolves to a reminder too,
  for the same reason `check` has nothing to query yet. `--dry` prints the plan and stops.

Registration is three places (`help.test.ts` fails the build otherwise): the `switch` in
`cli.ts`, `COMMANDS` + `SUBCOMMANDS` in `help.ts`, and a `Crm check options:` / `Crm setup
options:` block in `HELP`.

### Docs

- `AGENTS.md` — a "CRM submissions" section carrying the _why_: the four external facts above,
  the CRM-before-notify ordering, the never-gate-on-consent rule, the Bigin mandatory-last-name
  rule, Jobber's rotation requirement and GraphQL-body classification, and
  credentials-are-env-vars.
- `packages/generator/src/docs.ts` — `config.md` picks the new block up automatically from the
  schema walker; no change needed. Confirm it renders.
- Changeset (amended, not a new one — this feature is unreleased) + root `CHANGELOG.md` entry
  (Added; name the new `VITOPS_JOBBER_*` env vars and the rotation requirement).

---

## Not doing, and why

- **No `<wc-form>` in `/core` this pass.** It would be justified later — `forms.css` ships a
  `.form-group__error` slot that nothing currently fills, which is exactly the `WCEntries`-shaped
  gap a tier-2 component exists for — but the submission works without it, and shipping it now
  couples a UI decision to a server feature.
- **No `FormRenderer` revival.** `site.templates` type `form` stays inert and legal-only. A
  hand-written form would need the standalone `site.crm` map regardless, so the renderer buys
  nothing here.
- **No durable retry queue.** It would add a binding every consumer must provision, for three
  CRMs. The notification email is the durability floor instead.
- **No client-side path.** Impossible for Bigin and Jobber; actively harmful for HubSpot
  (per-portal rate limit).
- **No generic connector framework.** Three CRMs with three genuinely different transports (a
  form-submission POST, a REST upsert, a GraphQL mutation) is evidence against a shared
  abstraction, not for one — the same restraint `notify`'s own TODO records for its channels.
- **No CRM spam gate, and no confirm-before-write flow.** Considered and rejected: holding a
  submission for a clicked email confirmation before writing to the CRM would invert the
  durability rule this feature is built on (today the email is the floor and the CRM write is
  best-effort; confirm-first makes the CRM write depend on a human clicking, so an unclicked
  _real_ lead never reaches the CRM at all — a worse failure than a spam contact reaching it).
  It also needs a durable pending-submission store, a signed confirm endpoint and a replay
  path — the same cost the no-durable-retry-queue restraint above already declines — and a bot
  that clears the existing honeypot/`Origin`/`Content-Length`/rate-limit gates would clear a
  confirm link too. What to build instead, as its own pass: a provider-neutral
  `site.security.formSpamProtection` block (`turnstile` | `recaptcha` v3-only | `none`,
  replacing the released `turnstile`-only field with a migration error) plus
  `crm.requireFormSpamProtection`, which fails `validateConfig` at build time when no
  protection is configured rather than silently doing nothing. Two consequences to carry into
  that pass: reCAPTCHA is a Google processor (new `KNOWN_PROCESSORS` entry, a US-transfer
  sentence, a cookie the consent gate must clear on revoke) where Turnstile costs the policy
  nothing, and a _required_ check breaks the no-JS form promise (today a bare token is treated
  as absent-because-no-JS; a gate that requires a pass can't be that lenient).
- **No Jobber custom-field write, no verified dedupe.** `noteCreate` and the `clients` search
  filter are unverified against a live Jobber schema (see `jobber.ts`'s docblock) — attribution
  and extras render into the note body instead, and `dedupe` defaults to `false`. Verify both
  against a real account before turning `dedupe` on or wiring `fieldMap`/`trackingFields` into a
  real custom-field mutation.

---

## Verification

1. `npx vp check` — type-check + lint at a complete point, reading the output rather than
   trusting hook silence (the `PostToolUse` hook ends in `|| true`).
2. `npx vp test run` — new pure suites must cover:
   - `crm/plan.test.ts`: every skip reason stated, including a `jobber` config with no `jobber`
     block.
   - `crm/map.test.ts`: the identity cascade; the Bigin last-name fallback chain including the
     refusal case; `tracking: null` → no attribution keys; unmapped fields dropped.
   - `crm/hubspot.test.ts` / `crm/bigin.test.ts`: injected `fetchImpl`, asserting exact URL,
     headers and body per data centre; error classification per status.
   - `crm/jobber.test.ts`: exact URL/headers/version header; a 200 carrying top-level `errors[]`
     is a failure; a 200 carrying `userErrors[]` is a mapping failure; a failed note never
     downgrades `ok: true`; `dedupe` off by default, and a dedupe-lookup error falls through to
     create rather than failing the submission.
   - `crm/zoho-token.test.ts` / `crm/jobber-token.test.ts`: refresh grant and per-isolate cache
     expiry; Jobber's additionally covers the rotated-refresh-token detection.
   - `crm/index.test.ts`: `describeCrmResult` labels Jobber "Jobber", not "Bigin" (the old
     binary ternary's default); the executor dispatch reaches `jobber.ts`.
   - `routes/conversion.test.ts`: CRM failure does not fail the request; the email still sends
     and carries the failure note; honeypot never reaches the CRM; timeout is bounded.
   - `legal/legal.test.ts`: `site.crm` → processor derivation; Bigin `ca` produces no
     cross-border sentence, HubSpot and Jobber both do (Jobber's unconditionally — its location
     isn't config-derived).
   - `crm-config.test.ts`: the cross-field rules, including the `jobber`/no-block case.
   - `help.test.ts` and `tiers.test.ts` must stay green (no new component, so `tiers.ts` is
     untouched).
3. **Verify the two unconfirmed Jobber GraphQL shapes** (`noteCreate`, the `clients` dedupe
   filter) against a real account's GraphiQL schema before treating the executor as done, and
   record what was found in `jobber.ts`'s docblock. If either doesn't exist as expected, the
   stated fallback (no note / `dedupe` staying `false`) is what ships, not a guess.
4. **End-to-end against a real Bigin sandbox.** `vitops crm check --input site.json` should
   report a clean map; then POST a urlencoded body to a locally-served `/api/track` with a
   `_ac` cookie set, and confirm via `Bigin_searchRecords` that the contact exists with the
   attribution fields populated. A `Bigin_getFieldsMetadata` call is the ground truth for the
   field names — that is how `Last_Name`'s mandatory flag was found.
5. **End-to-end against a real Jobber sandbox with Refresh Token Rotation OFF.** POST a
   urlencoded body to a locally-served `/api/track` with an `_ac` cookie set, and confirm the
   client exists in Jobber with the note and attribution. Resubmit with the same email and
   `dedupe: true` and confirm no duplicate client is created.
6. **Confirm the no-JS path still works**: submit with JavaScript disabled and check the 303 to
   `redirectTo` lands, the CRM record is written, and the email arrives.
7. `npx vp run build:packages` to confirm the new subpath resolves from `@getvitops/utils/crm`.
