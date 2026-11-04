---
'@getvitops/create': minor
---

**Content now lives in production; dev is a refreshed copy.** The `dev → main` flow is for code,
pages and `site.json`. EmDash content is edited on the production site (drafts, "Publish changes"
and preview links are the staging step), and the dev database is disposable and refreshed _from_
prod — never promoted back. Both templates gain a hotfix path back into `dev`.

- **New `refresh-dev.yml` (emdash template) + `scripts/refresh-dev.mjs`** — copies prod's D1
  database into `<name>-dev` (weekly and on demand), and prod's R2 bucket too when the optional
  `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` repo secrets are set. It drops every table in its
  target, so it refuses a database that isn't `*-dev`, doesn't match `DEV_D1_ID`, or is
  production's. **Overwrites everything in the dev database on each run** — content edited on dev
  is lost by design.
- **New `backmerge.yml` (both templates)** — on every push to `main`, opens a `main → dev` PR when
  merging would change `dev`, so a prod hotfix doesn't leave `dev` behind. The PR is left for a
  human to merge unless a `BACKMERGE_TOKEN` secret (PAT / GitHub App token) is set: a merge made
  with the default token triggers no workflows, so Deploy dev would not run.
- **Magic-link sign-in in the emdash template**: it now registers `cloudflareEmail()` and a
  `send_email` binding named `EMAIL`. A passkey only works at the origin it was registered on, so a
  refreshed dev site would otherwise lock editors out; the cloned users already exist, so the same
  email signs in on both origins. **Existing sites:** templates are copied at scaffold time, so
  nothing changes until you add both yourself, and magic link answers "Email is not configured"
  until you do. Onboard the sender first (`npx vitops email setup send.<your-domain>`) and set
  `from` to an address on that domain — the template ships a placeholder you must replace.
- **The dev worker no longer has a cron trigger** (`build-dev-wrangler.mjs`), since a refreshed
  database carries prod's scheduled publishes and plugin jobs. Scheduled publishing can't be
  exercised on dev. Set a different `EMDASH_PREVIEW_SECRET` on the dev worker, or prod preview
  links will open drafts there.
- `SETUP.html` and the `promote` skill describe the new model; `SETUP.html` gains four items under
  "3. Hosting resources" (the OAuth apps and preview secret are manual).

No consumer-facing change in `@getvitops/core`, `@getvitops/generator`, `@getvitops/utils`,
`@getvitops/cli`, `@getvitops/vite`, `@getvitops/astro` or `@getvitops/emdash`. The reusable
workflows (`site-refresh-dev.yml`, `site-backmerge.yml`) reach existing client repos only once the
`v1` tag is moved by `release-workflows.yml`; a client needs the new caller files above to use them.
