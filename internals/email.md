# Sender-domain onboarding (`vitops email`)

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

`site.notifications.email.from` (see Conversion tracking above) names an address, but nothing
connected that to whether its domain is actually onboarded onto an outbound provider —
`EMAIL.send()` throws `E_SENDER_NOT_VERIFIED` at runtime with no build or deploy-time warning.
`vitops email setup [domain]` (`@getvitops/utils/email` → `packages/cli/src/commands/email.ts`)
onboards a sending domain and waits for its DNS to resolve; `vitops email check` is the
non-blocking deploy guard both templates' `deploy` script runs first. Same pure-planner/executor
split as `ads/`, `onboarding/` and `hosting/` — `plan.ts` decides everything, `cloudflare.ts`
executes Cloudflare's REST API and decides nothing, `dns.ts` is a read-only DoH propagation probe,
`scan.ts` is the best-effort static source scan.

Three things here are load-bearing:

- **The onboarded entity is an exact name, and it is usually a subdomain — never the apex a `from`
  address names.** Checked live against this account: `send.vitops.ca` is onboarded, and
  `wrangler email sending dns get vitops.ca` fails with "No sending subdomain found for
  `vitops.ca`" — Cloudflare matches `subdomains.find(s => s.name === name)`, no fallback to a
  parent zone. So a config whose `from` is `noreply@vitops.ca` is **not** covered by an onboarded
  `send.vitops.ca`, and the planner's single most valuable report is naming that mismatch: absent
  exact name + an onboarded sibling in the same zone → `blocked`, not `create`.
- **Why `send.<domain>` rather than the apex is NOT about MX conflict** — checked live: every
  record Cloudflare adds sits under its own label (`cf-bounce.<sending>`, `cf-bounce._domainkey
  .<sending>`), which collides with neither an apex MX nor `mail.<domain>`. What actually recommends
  a subdomain is the DMARC record: `_dmarc.<sending>` sets `p=reject`, and onboarding the apex
  would overwrite the domain's real `_dmarc.<domain>` — for `vitops.ca` that would replace an
  existing `p=none` policy covering Zoho-hosted mail with `p=reject`, which fails every message
  that isn't SPF/DKIM-aligned for this sender. A blocked report's fix therefore recommends sending
  from the onboarded subdomain first, and names enabling the apex as the second option with that
  caveat — never the reverse.
- **This calls Cloudflare's REST API directly, not `wrangler email sending list`** — checked
  against wrangler 4.119.0: that command has no `--json`, only a text table, and scraping it was
  ruled out the way every other executor here avoids parsing CLI prose. `findZoneForHost` mirrors
  wrangler's own `resolveDomain` label-walk (try the full host as a zone name, then each shorter
  suffix) rather than a public-suffix-list dependency, because a sending name is usually a
  subdomain and Cloudflare zones are registered at the apex.

`vitops email check` warns and exits 0 by default — `--strict` makes it a real gate — because a
false positive (a `from` the scan can't see is actually correct, e.g. built dynamically) must not
block every deploy; `site.notifications.email.verifySender: false` or `VITOPS_SKIP_EMAIL_CHECK`
opt out per-site. Candidates come from config first (`site.notifications.email.from`, or
`resolveSender()`'s derived `noreply@<canonical>`), with the source scan (`email/scan.ts`, modelled
on `icons-scan.ts`) only a supplement — a computed `from` value in source is reported as dynamic,
never guessed at, the same rule `icons-scan.ts` and `vitops lint` already follow.
