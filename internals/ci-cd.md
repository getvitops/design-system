# CI/CD

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

Two unrelated deploy stories live in this repo, and they must not be confused:

- **This repo's own theme deploy** (`lib/deploy.ts`, below) — rsync/symlink of the Bricks
  theme `dist/`. Unrelated to everything in this section.
- **The `dev → main` model** for every site this toolchain builds — this repo's own docs
  site (`site/`) and every `@getvitops/create` template — described here. **Partly adopted in
  this repo's own remote:** `origin/dev` exists and carries the reusable workflows
  (`site-*.yml`, `deploy-dev.yml`, `deploy-prod.yml`, …), but `origin/main` does not have them
  until the next `dev → main` promote lands. Check `git branch -a` / each branch's own workflow
  files before assuming either is live.

**Branch model.** `dev` is the integration branch: unprotected, so an agent (or anyone
with push access) commits and merges there directly, and every push auto-deploys the
isolated `-dev` worker. `main` is production: branch-protected (PR + the `ci` status
check required) and gated by a `production` GitHub Environment whose required reviewers
are the repo's admin collaborators — so a merge to `main` starts the prod deploy but it
**pauses for an admin's approval** before it runs. Promotion is manual and one-directional:
the `promote` workflow opens a `dev → main` PR with auto-merge; nothing pushes to `main`
directly. `vitops setup repo` (absorbing the old template-local `scripts/init-github.mjs`,
removed in `@getvitops/create` 0.7.0 — see "Client onboarding" above) provisions all of
this (branch protection, both environments) at scaffold time — see
`packages/utils/src/hosting/github.ts` for what it sets and what it can't (branch
protection / environment reviewers need GitHub Pro/Team on a private repo; the command
reports the manual equivalent when it 403s).

**Reusable workflows, not copy-pasted ones.** `.github/workflows/site-ci.yml`,
`site-deploy-static.yml`, `site-deploy-emdash.yml` and `site-promote.yml` in _this_ repo
are `workflow_call` workflows; every `@getvitops/create` template's own
`.github/workflows/{ci,deploy-dev,deploy-prod,promote}.yml` are four-line callers pinned
to `@v1` (e.g. `uses: getvitops/design-system/.github/workflows/site-ci.yml@v1`). A fix to
shared deploy logic lands once here and reaches every scaffolded client repo the next time
its workflow runs — no re-pasting. `v1` is a moving tag, moved deliberately via the
`workflow_dispatch`-only `release-workflows.yml` (never on every push — it is live in every
client repo, so moving it is a decision). Two deploy workflows, not one with a `platform`
input: `site-deploy-emdash.yml` needs a `DEV_D1_ID` secret and a config rewrite
(`scripts/build-dev-wrangler.mjs`, documented on that script) that make no sense for
`site-deploy-static.yml`'s plain static-assets path.

**EmDash 1.0 migrations run before traffic, not on the first visitor's request.**
Pre-1.0, EmDash applied its core migrations and `seed/seed.json` at first boot of the
worker with no separate step — there was no `.sql` file and no `wrangler d1 migrations
apply` anywhere in this toolchain, and `site-deploy-emdash.yml`'s optional
`health-check-url` input turned that into a checked fact by curling the deployed URL after
`wrangler deploy`, forcing first boot inside the job so a broken migration failed the
deploy instead of surfacing to the first real visitor. EmDash 1.0 makes this explicit
instead of implicit: `migrations.runtime` in `emdash()`'s config defaults to `'auto'`
(same first-request behaviour as before) but the documented production pattern is
`'check'` (the worker 503s on pending migrations rather than applying them) plus a real
`emdash migrate` step in CI — `emdash migrate --status`, then `emdash migrate
--expected-target-fingerprint <sha>` before `wrangler deploy`, then `emdash migrate
--check` after. `site-deploy-emdash.yml` runs this sequence explicitly now; the
`health-check-url` boot probe remains as a defence-in-depth check, not the only guard.

**The `dev → main` flow is for code, not content: truth runs a different direction per kind of
data.** Code, Astro pages, `site.json` and the design system live in git, so `dev` is their truth
and they promote `dev → main`. EmDash content (entries, media, menus, settings) lives in D1/R2 and
**production is its truth** — editors work there, and drafts, "Publish changes" on a live entry,
signed preview links and scheduling _are_ the staging step. The EmDash **schema** (collections and
fields) lives in the same database, so it travels with a database copy and with nothing in git.

That gives three databases, each with one job, and the design follows from keeping them apart:

| Database      | Job                                                               | Lifetime                     |
| ------------- | ----------------------------------------------------------------- | ---------------------------- |
| **prod**      | content truth                                                     | permanent                    |
| **dev**       | long-lived staging site: schema and code are developed here       | permanent, never wiped blind |
| **rehearsal** | `<db>-rehearse-<run id>`: a copy of prod a promotion rehearses on | one promote run              |

**Promotion never touches dev.** An earlier arrangement used dev for both, so a promote and a
staging session overwrote each other. `site-promote.yml` with `rehearse: true` (the emdash template)
builds dev's code, creates a rehearsal database, copies prod into it (`vitops emdash db copy
--target rehearse`), runs `emdash migrate` against it, diffs dev's schema against prod's into the PR
body, and deletes the database. A core migration that breaks on real data fails the promote, not the
prod deploy. **This is the one place the toolchain deletes anything**, and it is held to a resource
this run created: `rehearseDatabaseName` only produces `<db>-rehearse-<digits>`, so `db rehearsal
drop` cannot name another database. It is EmDash's own "rehearse on a disposable copy" pattern.

**Pulling prod into dev is a separate, guarded sync** (`site-sync-dev.yml`, `vitops emdash db`). A
D1 dump restores a whole database with no row-level merge, so "don't lose dev's work" means:
refuse if dev content changed since the last sync, snapshot dev, capture its schema, reset it to
prod, redeploy so core migrations run, then replay dev's collections and fields (`vitops emdash
schema apply`). A scheduled run only _reports_ drift; it never resets. The unscheduled reset is the
whole point — a weekly blind copy is exactly what wipes someone's staging work.

Load-bearing, in the order they bite:

- **A reset is one-way and guarded, because it drops every table in its target.**
  `assertSafeTarget` (`@getvitops/utils/hosting`, asserted in `d1-copy.test.ts`) refuses a database
  that isn't named `*-dev` (or `*-rehearse-<digits>` for the rehearsal kind), whose id isn't the one
  we were told, or whose id is production's — the same instinct as `build-dev-wrangler.mjs`
  refusing to run without `DEV_D1_ID`. The sync runs in the `dev` GitHub Environment, not
  `production`: it only reads prod, and one waiting on an admin's approval would never get run.
- **The copy is a four-file dump, not `wrangler d1 export`.** That command refuses any database
  with a virtual table, and EmDash keeps its search index in FTS5 tables, so the old script failed as
  soon as a collection had search on. `d1-copy.ts` follows EmDash's backup guide: tables by name
  (the index is rebuilt on first search), `media_folders` before the rows that reference it, indexes
  and triggers last. It scans for a statement D1 would reject as `SQLITE_TOOBIG` and stops before the
  first write rather than leaving a half-imported target.
- **Content is refused, not merged; schema is replayed, additions only.** Content is prod-owned, so
  an edited dev is a reason to stop (`--force` is the explicit discard, and a snapshot is always
  taken first). "Edited since" needs a baseline that survives the reset: a one-row `_vitops_sync`
  table written after each sync (`sync-dev.ts`); with none, the first run needs `--force`, because
  nothing can tell a copy from work in progress. Schema replay (`emdash-schema/plan.ts`) only ever
  plans additions. A field defined differently on both sides is reported, and a field present only
  on the target is information: removing a field deletes its column and values, and nothing can
  restore them. Block types are reported but not replayed (they carry a version history the REST
  API can't be handed back whole).
- **Replay goes through the REST API, not `emdash schema add-field`.** The CLI command carries only
  type, label and required, so a select's options, a repeater's sub-fields, a widget or a validation
  rule would be silently dropped. `client.ts` posts the full field definition the schema export
  returns, over https only (a bearer token is never sent to a remote `http://`). Credentials are
  `EMDASH_TOKEN_*` env vars, never config.
- **Applying dev's schema to production is opt-in and behind the production approval.**
  `site-deploy-emdash.yml`'s `schema-from-url` runs `schema apply` after the core migrations and
  before the deploy (additive first, EmDash's own ordering), in the `production` environment, so it
  waits for the same reviewers. The template wires it to repository variables and restricts it to a
  `push`, so a content-publish rebuild never touches the schema.
- **The back-merge compares trees, not ancestry.** Promotion merges `dev` into `main` with a merge
  commit, so `main` is never an ancestor of `dev` right after a release even though the content is
  identical; an ancestry check would open a no-op PR on every promote. `git merge-tree
  --write-tree` says whether merging would change `dev`. A merge made with the default
  `GITHUB_TOKEN` triggers no workflows, so without `BACKMERGE_TOKEN` the PR is left for a human —
  otherwise `dev` would take the fix without Deploy dev running and sit silently stale.
- **Sign-in must work on both origins, so the template ships magic link, not just passkeys.** A
  passkey only works at the origin it was registered on, so a synced dev site would lock every
  editor out. Magic link needs only a working email provider — the template registers
  `cloudflareEmail()` and an `EMAIL` `send_email` binding — and the cloned users already exist, so
  the same address signs in on both origins with nothing per-origin to create. It was chosen over
  EmDash's GitHub provider, which needs a separate OAuth app and two secrets for each origin (one
  callback URL each), all by hand. The `from` must be on a domain onboarded with Cloudflare Email
  Sending (`vitops email setup`, and usually the `send.` subdomain — see "Sender-domain
  onboarding"); until it is, magic link answers "Email is not configured" and the only way in on a
  synced dev site is a passkey registered there.
- **No PII scrub on sync.** Dev is the same organisation, platform and access as prod, so the
  copy carries the same handling obligations; it must stay gated like prod and `noindex`. Sessions
  are in the Astro session store (KV), not D1, so none are carried over.
- **Two things in D1 would leak across.** The preview-link secret is stored in the database, so a
  sync copies prod's and prod preview links would open drafts on dev — set
  `EMDASH_PREVIEW_SECRET` on the dev worker. Scheduled publishes and plugin jobs are copied too, so
  `build-dev-wrangler.mjs` drops the cron trigger from the dev config; the cost is that scheduled
  publishing can't be exercised on dev.

`<wc-theme-editor>`'s "Save to source" is the sanctioned prod → git path for design tokens: it
commits to `site.deployment.branch` (default `dev`), so it rides the next promote. Keep that off
`main`, or a prod edit becomes a hotfix that skips review.

Not built: per-PR preview environments. Static sites could have them cheaply (`wrangler versions
upload`), but an EmDash preview needs a database each; a persistent dev plus the per-promote
rehearsal database covers the need until contention on `dev` is real. Also not built: deploying a
Worker Preview during rehearsal and replaying the schema there — it needs per-site preview
infrastructure (a `previews` block, a KV namespace, a site URL) the templates don't carry, so the
schema diff is computed read-only and applied to production only behind its approval.

**This repo's own docs site is the one exception to "thin caller."**
`.github/workflows/deploy-dev.yml` / `deploy-prod.yml` at the repo root deploy `site/`
directly through `site/wrangler.jsonc` rather than calling `site-deploy-static.yml` — see
those files' docblocks: `site-deploy-static.yml` assumes a standalone site repo where
`pnpm run build` alone is enough, but `site/`'s build depends on this monorepo's own `vp`
task graph (`build:generator` → `build:astro` → …), so the job runs `vp run docs:build`
from the repo root instead. It still deploys through the identical `wrangler.jsonc` +
environment-gate mechanism every client site uses — that mechanism is what's being
dogfooded, not the specific workflow file. `docs.vitops.ca` moved here from GitHub Pages
for exactly that reason: Pages was a deploy path no client site used, so the toolchain's
real deploy code was never exercised by its own docs build. The old Pages workflow (`docs.yml`) was deleted once the Cloudflare prod deploy had succeeded.

**The `scaffold` CI job is the only thing that installs a template the way a client does.** A
template's `@getvitops/*` deps are `latest` (see `templates.test.ts` for why), so a plain scaffold
resolves the last _release_ and would test nothing new; `scripts/scaffold-check.mjs` (`vp run
verify:scaffold`) instead `pnpm pack`s this checkout's packages, **publishes them to a throwaway
Verdaccio registry** under `latest`, and installs the scaffold from it, then typechecks, builds and
`vitops lint --strict`s it. `@getvitops/*` is served from that registry only (no uplink, so it cannot
fall back to a release) and everything else proxies to npmjs. It replaced `overrides` pointing at
`file:` tarballs, which never resolved the scaffold's own `latest` specifiers and needed
`blockExoticSubdeps` switched off. The template's release cooldown is left in force — the script
throws if a template stops exempting `@getvitops/*` from it — so the install resolves what a client
would today, Astro included. It copies the template directory rather than calling `vp create`,
because `vp create @getvitops:<name>` resolves the _published_ `@getvitops/create` from npm and
refuses `--directory` for a local path. It also drops `packageManager` and `devEngines` (they make
pnpm/Node try to download other versions than the runner has) and fails on EmDash's
adapter-version-mismatch warning, which is how an
upgrade of `emdash` without `@emdash-cms/cloudflare` shows up. It exists because it found real
defects the first time it ran: `resolveOrganizationName` demanded the full `Config`, which a plain
`import site from './site.json'` cannot satisfy; `page.data` was `unknown` before `emdash types`
had run; and the templates declared `neutral`/`surface` as chromatic roles while using
`text-neutral-muted`, a class that resolved to nothing.

**Verifying a change to the reusable workflows**, before running `release-workflows.yml`:
`vp check` / `vp test run` (covers `templates.test.ts`); scaffold each template fresh in a
scratch dir and run `vitops setup repo --dry`; push a no-op commit to `dev`
and confirm the dev worker updates; run `promote` and confirm the prod job **pauses** for
approval before publishing.
