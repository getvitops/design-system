---
name: setup
description: Work the client-onboarding checklist (SETUP.html) autonomously — GitHub repo + branch policy, hosting resources, Search Console/GCP/ads connections. Use when the user asks to set up, onboard, or provision this project (e.g. "run setup", "onboard this site", "get this ready to deploy"). Never run this as a side effect of unrelated work, and never on your own initiative without the user asking.
---

# Setup (client onboarding)

`SETUP.html` is the canonical checklist — this skill adds only sequencing,
gates, and where to stop. It does not restate the steps; read `SETUP.html`
(or `vp exec vitops setup --help`) for what each stage actually does and why.

## Steps

1. **Preview the whole sequence first.**

   ```bash
   vp exec vitops setup all --dry
   ```

   Read the plan before doing anything. It names every step it would take and
   why any step is blocked — a missing credential, a field not yet in
   `site.json`, GitHub Pro/Team gating branch protection.

2. **Run it.**

   ```bash
   vp exec vitops setup all
   ```

   Re-run `vp exec vitops setup --check` after each leg rather than retrying on
   your own judgment — a step already done resolves to a no-op skip, so a
   second run is safe, and `--check` tells you exactly what still needs doing
   instead of you guessing from output.

3. **Tick `SETUP.html` boxes only for what you actually completed.** Never
   check a box for a step marked below as human-only, even if you did
   everything up to it — the human still has to act.

## Hard stops — ask the human, do not attempt

- **The Cloudflare API token.** No API can create one; there is no command to
  run. Tell the user to create it at
  <https://dash.cloudflare.com/profile/api-tokens> (Workers + D1 + R2 edit)
  and run `gh secret set CLOUDFLARE_API_TOKEN`, then continue.
- **The domain cutover** (`vitops setup domain`, stage 4b in `SETUP.html`).
  Uncommenting the custom-domain route and deploying overwrites the zone's DNS
  record at that instant — it takes an existing live site down. `setup domain`
  only ever plans and checks this; it never applies it, and neither should
  you. Report the plan and hand the actual cutover to the user.
- **Google's approval for the Business Profile API** (only for a site that shows
  Google reviews). Nothing can request it for you or grant it: it is a one-time
  form submitted to Google, per Google Cloud project, that takes days to weeks.
  Report it as a blocker with that lead time, tell the user to file it if the
  project has not been approved, and do not tick `connections.gbp` until
  `vitops reviews --check` no longer answers 403.
- **Publishing any generated legal document.** `vitops legal` renders a
  starting point from the config, not a reviewed policy. Generate it, tell the
  user it needs review, and stop — do not paste it into the admin or commit it
  yourself.

## If something is blocked

`vitops setup --check` names the field or credential and where to get it —
report that verbatim rather than guessing at a fix. A step reported as
"blocked" is not a failure to retry; it is waiting on one of the hard stops
above, or on a `site.json` field the user still needs to fill in (stage 5,
Configuration).

## Naming the project

`vp create` takes the package name from the target directory and invents a random slug when none
is given, so pass one: `vp create @getvitops:<template> --directory <client-slug>`. `wrangler.jsonc`'s
`name` (and on EmDash the D1 `database_name` and R2 `bucket_name`) are separate and still say what
the template shipped; rename them to match before the first deploy.
