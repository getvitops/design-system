---
'@getvitops/generator': minor
'@getvitops/utils': minor
'@getvitops/cli': minor
---

Add `vitops search setup` — onboard domains into Google Search Console as domain properties.

The `indexing` command is now grouped under a new `search` command as **`vitops search notify`**.
`vitops indexing` still works as a deprecated alias (it prints a deprecation notice and forwards to
`search notify`); update scripts to the new spelling at your convenience.

**New: `vitops search setup`.** For each domain in a site config's new `site.searchConsole` block
(a record keyed by bare hostname), it:

- ensures the apex verification TXT record in Cloudflare,
- verifies ownership via the Site Verification API (DNS_TXT), retried with exponential backoff while
  DNS propagates — a still-unverified domain is reported **PENDING**, not failed,
- adds the `sc-domain:` property via the Search Console API,
- adds any `delegatedOwners` to the verified Site Verification web resource.

It is idempotent (a re-run of an onboarded domain is a no-op), supports `--check` (report drift, exit
non-zero, mutate nothing) and `--dry` (print the plan, change nothing), and `--domain <name>` to
scope to one entry. DNS records are only ever created, never edited or deleted.

Credentials come from the environment, never the config: `CLOUDFLARE_API_TOKEN` (a `Zone:DNS:Edit`
token) and a Google **user OAuth refresh token** as `VITOPS_GOOGLE_CLIENT_ID` /
`VITOPS_GOOGLE_CLIENT_SECRET` / `VITOPS_GOOGLE_REFRESH_TOKEN` (scoped to `siteverification` +
`webmasters`). Granting a Google Group **Full-User** access has no Search Console API and is surfaced
as a reminder in the summary rather than automated.
