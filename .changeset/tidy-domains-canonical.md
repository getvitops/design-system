---
'@getvitops/generator': minor
'@getvitops/utils': minor
'@getvitops/cli': minor
---

Add `vitops domains setup` — configure the canonical domain, HTTPS and HSTS on Cloudflare.

`site.domains.canonical` and `site.domains.aliases` have been in the config schema for a long
time, and nothing ever applied them: a declared alias produced no redirect, and there was no
error to say so. This command executes the block. From `site.domains` it configures three things
on the canonical zone — Always Use HTTPS, HSTS, and one forwarding Page Rule per alias — so
`http(s)://<any non-canonical host>` and `http://<canonical>` all end at `https://<canonical>`.

The `www` ↔ apex counterpart of the canonical host is redirected **without** an `aliases` entry;
list only the domains that convention doesn't cover. An explicit entry for the counterpart still
wins, which is how you give it a non-default status code.

Like `search setup` and `ads setup` it is a pure planner plus an executor: `--dry` prints a
complete account of the run and changes nothing, `--check` reports drift and exits non-zero, and
a re-run of a configured domain is all skips. Credentials come from `CLOUDFLARE_API_TOKEN` and
never the config — but this command needs a **wider token** than the other two: `Zone:Read`,
`Zone Settings:Edit`, `Zone:Page Rules:Edit`, plus `Zone:DNS:Edit` if an alias has no DNS record
yet. No dashboard template bundles all four, so build a custom token.

Two behaviours worth knowing before the first run:

- It refuses to act on a zone Cloudflare is not actually serving. A zone can sit in your account
  with status `pending` — visible in the dashboard, serving nothing — because the registrar still
  delegates elsewhere. That case is reported with the nameservers to set, rather than as a clean
  run against a domain Cloudflare doesn't answer for.
- HSTS is applied only after Always Use HTTPS is confirmed on, and deferred otherwise: a browser
  holds the policy for its `max-age` regardless of what the zone says afterwards. Defaults are
  conservative — enabled, six-month `max-age`, no `includeSubDomains`, no `preload` — and
  `includeSubDomains` is refused while any configured environment is still on plaintext `http`.

New config: `site.domains.https` (`enabled`, and `hsts` with `enabled` / `maxAge` /
`includeSubDomains` / `preload`). Omitting the block is the safe posture rather than an opt-out —
HTTPS enforcement and HSTS are both on by default. `hsts.preload` without `maxAge >= 31536000`
and `includeSubDomains` is now a validation error, because the preload list rejects that
combination outright.

Also relaxed: `site.domains.aliases[].redirectType` and `.redirectTo` are now **optional**,
defaulting to `301` and the canonical host. Existing configs stating both are unaffected.

No CSS or pattern output changes in this release; `@getvitops/core`, `@getvitops/vite` and
`@getvitops/astro` carry no consumer-facing change beyond the lockstep version bump.
