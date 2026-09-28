---
'@getvitops/generator': minor
'@getvitops/utils': minor
'@getvitops/cli': minor
'@getvitops/create': patch
---

Add `vitops email setup|check` — connect `site.notifications.email.from` to whether its domain is
actually onboarded onto an outbound email provider.

Before this, nothing checked that. `EMAIL.send()` throws `E_SENDER_NOT_VERIFIED` at runtime with no
build or deploy-time warning — the failure mode is silent and production-only.

`vitops email setup [domain]` onboards a sending domain (currently Cloudflare Email Sending only)
and polls DNS until its SPF/DKIM/DMARC records resolve or a timeout is reached; `vitops email
check` is the non-blocking deploy guard both `@getvitops/create` templates' `deploy`/`deploy:dev`
scripts now run first (`--strict` makes it a real gate; opt out per-site with
`site.notifications.email.verifySender: false`, or globally with `--skip` /
`VITOPS_SKIP_EMAIL_CHECK`).

Two things worth knowing before running it:

- **The onboarded entity is an exact name, and it is usually a subdomain**
  (`send.yourdomain.com`), never the apex your `from` address names. When the exact domain isn't
  onboarded but a sibling in the same zone already is, the command reports that as the fix — send
  from the onboarded subdomain — rather than silently trying to onboard the apex, which rewrites
  `_dmarc.<domain>` and can tighten DMARC policy on every other mail your domain sends.
- Candidates come from `site.notifications.email.from` (or its derived `noreply@<domains
.canonical>` default) first; a best-effort scan of `--src` only supplements it, and never guesses
  at a computed `from` value.

New `@getvitops/utils/email` subpath and `site.notifications.email.verifySender` config field.
Needs `CLOUDFLARE_API_TOKEN` with an Email Sending scope in addition to the `Zone:Read` other
commands already use.
