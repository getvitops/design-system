# Search Console onboarding

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

`vitops search setup` (`packages/cli` → `@getvitops/utils/onboarding`) automates the other half of
the Search Console relationship — getting a domain _into_ it in the first place, which is otherwise a
manual DNS-paste / wait / verify / add-property dance. It reads a **`Config`**'s `site.searchConsole`
block (a record keyed by bare hostname, mirroring `site.dns`), and for each domain: ensures the apex
verification TXT in Cloudflare, verifies ownership via the Site Verification API (DNS_TXT), adds the
`sc-domain:` property via the Search Console API, and adds any `delegatedOwners` to the verified web
resource.

The architecture is the **same pure/I-O split as indexing**, and load-bearing for the same reasons:

- **`onboarding/plan.ts` decides everything and touches nothing.** Idempotency lives here — a step
  whose desired state already holds resolves to `skip`, so a re-run of an onboarded domain is all
  skips (a no-op) by construction, not by the executors checking twice. `hasDrift()` drives
  `--check` (report drift, exit non-zero, mutate nothing); `--dry` prints the plan and stops. The
  executors (`cloudflare.ts`, `google.ts`) gather each domain's live state and apply what they are
  told, `fetchImpl` injected, structured results not exceptions.
- **DNS is only ever created, never edited or deleted.** The command's contract is that it never
  removes a record, so `cloudflare.ts` simply has no update/delete verb — the apex TXT is created
  only when the planner says it is absent.
- **Verification retries with backoff, then reports PENDING — not failed.** DNS_TXT verification
  fails until the record propagates, which is slow, not broken. `backoffSchedule()` is a pure policy
  (capped at ~5 attempts) the tests assert; the CLI does the sleeping. A domain still unverified
  after the last attempt is PENDING in the summary, and its property/owner steps are skipped for that
  run — re-run later.
- **Google auth is a user OAuth refresh token, not a service account** (`google.ts`) — onboarding
  acts _as a person_ who can own the sites. Simpler than indexing's JWT flow (a `refresh_token`
  grant, no `node:crypto`), but broader scope: `siteverification` + `webmasters`. Still **no
  `googleapis`** — a handful of REST endpoints don't justify it.
- **Search Console has no user/permission API.** Adding a Google Group as a **Full User** is
  genuinely un-automatable, so it is surfaced as a **reminder** in the summary (from
  `searchConsole.<domain>.fullUserGroup`), never attempted. This is distinct from **delegated
  owners**, which _are_ automated — those are Site Verification web-resource owners (an additive
  union, so an existing owner is never dropped), a different concept from Search Console property
  users. Don't conflate the two.

Credentials follow the same env-var pattern as `lib/deploy.ts` and never live in the config:
Cloudflare via `CLOUDFLARE_API_TOKEN` (a `Zone:DNS:Edit` token — the standard "Edit zone DNS"
template also carries the `Zone:Read` that the zone-by-name lookup needs), Google via
`VITOPS_GOOGLE_CLIENT_ID` / `VITOPS_GOOGLE_CLIENT_SECRET` / `VITOPS_GOOGLE_REFRESH_TOKEN`. As with
`IndexingConfig`, the util-side onboarding types derive from `@getvitops/config`; the CLI's
`toSearchConsoleSetup` only reshapes the config for the planner.
