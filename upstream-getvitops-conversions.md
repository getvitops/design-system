# Gap report: offline conversion upload isn't in `@getvitops/*` yet

Filed against `@getvitops/astro@8.1.0` / `@getvitops/utils@8.1.0` / `@getvitops/generator@7.0.0`
while wiring client-side Google Ads conversion tracking for a downstream site. The client's
hosting plan has a premium tier described as: a conversion is **not** tracked client-side at all;
instead the existing conversion-notification email (`notify()` in `@getvitops/utils/notify`)
carries a link into the operator's own system, which uploads the conversion to Google Ads via the
Ads API (offline conversion import) using the attached `gclid`. That flow does not exist in the
package today. Findings below, from reading the source, for whoever owns that roadmap.

## What exists today

- `site.tracking` → `<Tracking />` → `_ac` cookie, captured on the landing page, holding click IDs
  (`gclid` among them via `platform-0nlOIy8h.mjs`'s `getPrimaryClickId()`) and UTMs.
- `createConversionRoute()` (`@getvitops/astro/routes`) turns a `tel:` beacon or a form POST into a
  `ConversionEvent` and calls `notify()`, which renders and sends **one** email
  (`@getvitops/utils/notify`, Cloudflare Email Sending only).
- `site.ads.google.conversionLabel` is accepted by the config schema and typed onto
  `GetvitopsAdProperty`, but nothing reads it — the Google bootstrap
  (`@getvitops/utils/dist/ads/index.mjs:6`) takes only the `AW-…` id and ignores every other field
  passed in. No `gtag('event','conversion',…)` is emitted anywhere in either package.

## What's missing, in the order that blocks the premium flow

1. **No offline-conversion primitive.** Nothing under `@getvitops/utils` talks to the Google Ads
   API — no `developer_token`, no `uploadClickConversion`, no `googleads` search hit anywhere in
   either package's `dist/`.
2. **The notification email has no action link.** `describeEvent()`
   (`@getvitops/utils/dist/notify/index.mjs`) renders exactly three fixed sections — Contact
   details, Ad attribution, Visitor context — as plain `[label, value]` rows. There's no URL slot
   and no signed token, so nothing in the current template can point back at an operator system to
   record the conversion.
3. **`ConversionEvent` can't name which conversion action fired.** It's
   `{ type: 'form' | 'call', formData?, phone?, tracking, userAgent?, ip?, at }`. An offline upload
   needs a `conversionActionId` (or equivalent) alongside `gclid` (already reachable via
   `tracking` + `getPrimaryClickId()`) and `conversionDateTime` (already covered by `at`) — only
   the action identity is absent from the type.
4. **`conversionLabel` is one string; a real site has one per interaction.** This client alone
   needs three actions (call, email click, form submit). The schema field is singular and
   `site.ads.<platform>` is `additionalProperties: false`, so there's no per-action map to extend
   into. This is also why, on the client-side path, every downstream site ends up hand-rolling its
   own `src/data/conversions.ts` instead of the package doing it once.
5. **No client-side conversion helper either**, which is the flip side of #4: since
   `conversionLabel` is read by nothing, sites on the non-premium path get no `gtag('event',
'conversion', …)` call from the package at all — see the hand-rolled component this site added
   in `src/components/AdConversions.astro`.
6. **No `mailto:` capture.** `scripts/tracking.ts` only beacons `a[href^="tel:"]` clicks
   (`TRACK_ENDPOINT`), and `ConversionEvent['type']` has no `email`/`mailto` member — so even the
   _existing_ call-only notification flow has no email-click counterpart to extend.
7. **No on/off relationship between the two paths.** Once an offline-upload channel exists, a site
   using it presumably wants client-side `gtag` conversion firing suppressed (or vice versa) to
   avoid double-counting the same visitor action in Google Ads. Nothing in `resolveAds()` /
   `resolveTracking()` currently expresses that relationship — each is independent of the other by
   design, which is right for pixels-with-no-attribution but not for two systems reporting the same
   conversion to the same Ads account.

## Suggested shape (not prescriptive — just where the seams already are)

- Extend `NotificationsConfig`/`ConversionEvent` with an optional `conversionAction` (or a
  per-type map: `{ call?, email?, form? }`) alongside the existing `email` channel — mirrors how
  `site.ads.<platform>` is already keyed.
- Add a `notify.actionUrl` template (or a `renderEmail` hook) so `describeEvent()` can include a
  link with the event id / gclid / action, the way `policyUrl` is already threaded into
  `<CookieConsent />`.
- A `googleAdsOfflineUpload` sender under `@getvitops/utils/notify`, structurally typed against the
  Ads API request shape the same way `EmailBinding` is structurally typed against Cloudflare's —
  keeps the Google Ads client SDK out of `@getvitops/utils`'s own dependency tree, consistent with
  how the email channel takes its binding by injection rather than importing `cloudflare:workers`.

## Also worth scoping: provisioning the conversion actions themselves

Separate from firing/uploading conversions, every downstream site with per-interaction tracking
(this one included, once #4 above is fixed) needs the same 3 conversion actions — call, email
click, form submission — created once per client Ads account before anything can fire against
them. That's currently done by hand in the Ads UI per client. It's provisionable:

- **`gcloud` doesn't apply here** — that's GCP infra tooling, unrelated to Google Ads accounts.
- **The Google Ads API does**: `ConversionActionService.MutateConversionActions` creates a
  conversion action (name, `type` — `WEBPAGE`, `PHONE_CALL_FROM_ADS`, etc. — `category`,
  `status`) and returns its resource name, from which the label used in `send_to` is derived.
  This is a real, supported mutate call, not a workaround.
- **What it needs, once, before any script can run**: a **developer token** issued against a
  Google Ads **manager (MCC) account** (Tools & Settings → API Center; Google reviews the
  application — Basic access is materially faster than Standard, timeline is Google's, not
  ours), plus an OAuth2 client (created in Google Cloud Console — the one place this and `gcloud`
  share infrastructure) and a refresh token for whichever account administers clients' Ads
  accounts. None of this exists in this repo or, as far as this investigation went, anywhere in
  the vitops tooling today.
- **Once that access exists**, a `vitops ads provision` (or similar) taking a customer ID and the
  standard 3-action template, upserting them via the API, and printing the resulting labels back
  in the exact shape `conversions.ts` (or its schema-fixed successor per #4) expects, would remove
  the manual click-through entirely — for this client and every future one that wants the same
  three actions. Scoped here as a candidate command, not built: this investigation didn't have Ads
  API credentials to test against.
