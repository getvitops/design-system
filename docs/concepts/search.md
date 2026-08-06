---
type: "Design Concept"
title: "Vitops search — Search Console onboarding and deploy notification"
description: "What search engines actually accept, why the Indexing API is deliberately not wired, and how `vitops search setup` and `vitops search notify` work."
resource: "site.json"
tags: [seo, search-console, indexnow, sitemap, indexing]
generator: "@getvitops/generator"
---

# Search

Two commands, both anchored to a full config:

- **`vitops search notify`** — tell search engines a deploy happened (from `site.seo.indexing`).
- **`vitops search setup`** — onboard domains into Search Console (from `site.searchConsole`).

## Start from what engines actually accept

The obvious assumption is wrong, and every design decision here follows from that:

- **Google exposes no "request indexing" API.** The button in the Search Console UI is not in
  the Search Console API or anywhere else, and the **URL Inspection API is read-only**.
- **The sitemap ping endpoint was removed in June 2023.** `google.com/ping?sitemap=` is a no-op.
- **The Indexing API is scoped to `JobPosting` / `BroadcastEvent`.** It accepts other URLs and
  discards them; general use violates its terms, with *your own* GCP project on the line.
  ⚠️ **Deliberately not wired. Do not add it.**
- **Google does not participate in IndexNow.** Bing, Yandex, Naver, Seznam and Yep do.

So `search notify` does every sanctioned thing and then **verifies**: resubmit the sitemap,
ping IndexNow, and `--check` inspects `priorityUrls` and exits non-zero on one Google hasn't
indexed. That last part is what actually replaces the manual Search Console visit.

⚠️ Never describe this as making Google re-index faster. It cannot.

## `search notify`

- **The pure/I-O split is the point.** The planner decides everything — which URLs, which
  channels, why each was skipped — and touches no network, no filesystem, no clock. That is what
  makes `--dry` a *complete* account of a run rather than an approximation.
- **`lastmod` is not a nice-to-have, it is the mechanism.** The changed-URL diff compares each
  sitemap entry's `<lastmod>` against a stored snapshot. With no lastmod the diff can see pages
  appear and disappear but **never see one change** — so an edited page is never resubmitted, and
  the command looks healthy while doing less than it appears to. It counts lastmod-less entries
  and says so every run.

  `gitLastmod()` in `@getvitops/astro` derives real dates from `git log`. It is an exported
  helper rather than a `sitemap` option because it shells out to git and returns **nothing**
  from a shallow CI clone (`fetch-depth: 1`). It leaves an unmatched URL alone rather than
  stamping the build time: Google weighs lastmod only while it stays consistent with what
  actually changed, so a site that stamps every page every deploy teaches it to distrust the
  field site-wide.
- **The `noindex` gate reads the environment, so the URLs must too.** The run is refused
  entirely when the resolved environment's `robots` contains `noindex` — submitting a staging
  host to IndexNow publishes it to several engines and invites them to crawl it, which a later
  directive does not undo. Origins therefore derive from `site.environments[env].url` **before**
  `domains.canonical`: the canonical is the *production* origin, so deriving from it while
  notifying staging would submit production URLs the gate would not catch.
- **Verify the IndexNow key file before submitting.** A submission whose key file is unreachable
  returns `403`, but one whose key file is *reachable and stale* is accepted with `202` and then
  silently discarded. Only a prior GET distinguishes "submitted" from "submitted and ignored".
  The key is **not a secret** — the engine fetching it back is the ownership proof — so it lives
  in the config, and the Astro integration writes `public/<key>.txt` from it.
- **Write the snapshot last, and only on success.** Writing it eagerly records URLs as notified
  that never were; because the next run diffs against it, one transient `503` would drop those
  pages from every future run — silently and permanently. A corrupt or absent snapshot reads as
  "submit everything, and say so", never as "nothing changed".

## `search setup`

Automates the otherwise-manual DNS-paste / wait / verify / add-property dance.
`site.searchConsole` is keyed by bare hostname (mirroring `site.dns`):

```json
{
  "site": {
    "searchConsole": {
      "example.com": {
        "delegatedOwners": ["dev@example.com"],
        "fullUserGroup": "seo@example.com"
      }
    }
  }
}
```

Per domain it ensures the apex verification TXT in Cloudflare, verifies ownership via the Site
Verification API (`DNS_TXT`), adds the `sc-domain:` property, then adds any
`delegatedOwners`. The verification token is fetched live and written to DNS — never stored in
the config.

- **Idempotency lives in the planner.** A step whose desired state already holds resolves to
  `skip`, so re-running an onboarded domain is a no-op **by construction**, not because the
  executors check twice. `--check` reports drift, exits non-zero and mutates nothing;
  `--dry` prints the plan and stops.
- **DNS is only ever created, never edited or deleted.** The command never removes a record, so
  the Cloudflare executor simply has no update or delete verb.
- **Verification retries with backoff, then reports PENDING — not failed.** `DNS_TXT`
  verification fails until the record propagates, which is slow, not broken. A domain still
  unverified after the last attempt is `PENDING`, and its property and owner steps are skipped
  for that run. Re-run later.
- **Search Console has no user/permission API.** Adding a Google Group as a **Full User** is
  genuinely un-automatable, so `fullUserGroup` is surfaced as a **reminder** in the summary,
  never attempted. That is distinct from `delegatedOwners`, which *are* automated — those are
  Site Verification web-resource owners (an additive union, so an existing owner is never
  dropped), a different concept from Search Console property users. Don't conflate them.

## Credentials

Always from the environment; never in the config. There is **one** token exchange and **two
grants**, tracking where each command runs:

| Grant | Env vars | Used by |
| --- | --- | --- |
| **Service account** (JWT bearer) | `VITOPS_GSC_SERVICE_ACCOUNT` (inline JSON) or `GOOGLE_APPLICATION_CREDENTIALS` (path) | `search notify` — never expires, right for CI |
| **User OAuth** (refresh token) | `VITOPS_GOOGLE_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN` | `search setup` — **required** |

Cloudflare uses `CLOUDFLARE_API_TOKEN` (a `Zone:DNS:Edit` token; the standard "Edit zone DNS"
template also carries the `Zone:Read` the zone-by-name lookup needs).

`search setup` requires user OAuth because **verifying a site makes the caller an owner** of
the property, and that should be a person, not a project robot. Note a refresh token can be
revoked, and for an OAuth client still in *Testing* publishing status Google expires it after
**7 days** — fine for a one-time human setup, bad for a deploy step.

**`search notify` accepts either**, preferring the service account when both are set. Search
Console does not care which identity calls it, and someone who has run `search setup` already
holds a Google credential.

⚠️ Do not add `googleapis` — an enormous dependency for a handful of REST endpoints in a CLI
that installs into every consumer project. The JWT is minted with ~30 lines of `node:crypto`.
