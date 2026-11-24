---
'@getvitops/utils': minor
'@getvitops/cli': minor
'@getvitops/create': minor
'@getvitops/skills': patch
'@getvitops/config': patch
'@getvitops/generator': patch
'@getvitops/core': patch
'@getvitops/vite': patch
'@getvitops/astro': patch
---

**EmDash environments: promotion rehearses on a throwaway copy of production, and syncing prod into dev no longer wipes dev.** Dev is a long-lived staging site (collections and fields are developed there, and content is edited there), but the old `refresh-dev` dropped every table in it, weekly if scheduled, and a promote and a staging session could overwrite each other. Three databases now have one job each: prod (content truth), dev (staging, never wiped blind) and `<db>-rehearse-<run id>` (a copy of prod, one promote run).

### Added

- **`vitops emdash db copy|snapshot|guard-dev|mark-synced|rehearsal|rewrite-config`** (`@getvitops/cli`, over `@getvitops/utils/hosting`). The copy is a four-file dump, so it works on a database with a search index (the old `wrangler d1 export` failed on any FTS5 table), and it stops before the first write if D1 would reject a statement as too big. A target must be named `*-dev` or `*-rehearse-<digits>` and may never be production's id.
- **`vitops emdash schema diff|apply|export`** (`@getvitops/utils/emdash-schema`). Replays one instance's collections and fields onto another over the REST API with the full field definition (options, validation, widget), additions only. A field defined differently, a target-only item and a block type are reported, never changed. `diff --check` exits 1 on drift. Tokens: `EMDASH_TOKEN_FROM`, `EMDASH_TOKEN_TO`, `EMDASH_TOKEN`.
- **`site-sync-dev.yml`** (reusable): refuses when dev content changed since the last sync (`force` discards it; the first run needs it), snapshots dev to an artifact, captures dev's schema, resets dev from prod, redeploys so core migrations run, replays dev's schema, and stamps a sync marker. `mode: report` only reports drift.
- **`site-promote.yml` `rehearse: true`**: builds dev's code, copies prod into a throwaway database, runs `emdash migrate` against it, puts a dev-vs-prod schema diff in the PR body, and deletes the database. It never touches the dev site.
- **`site-deploy-emdash.yml` `schema-from-url` / `schema-to-url`** (production only, off by default): applies the additive schema diff after the migrations and before the deploy, behind the `production` approval.

### Breaking

- **`@getvitops/create`: the emdash template's `refresh-dev.yml` and `scripts/refresh-dev.mjs` are replaced by `sync-dev.yml`.** The weekly run now only _reports_ drift and never resets dev. `promote.yml` rehearses by default (`rehearse` input, opt out per run). Existing sites keep their own workflow files. Migration: bump `@getvitops/cli` first (the workflows call `vitops emdash db|schema`), copy `sync-dev.yml` and `promote.yml` from the template, delete `refresh-dev.yml` and `scripts/refresh-dev.mjs`, and add the repo secrets `EMDASH_TOKEN_DEV` and `EMDASH_TOKEN_PROD` (admin → Settings → API Tokens) and the dev and production URLs in those two files. Without the tokens a sync resets dev without replaying its schema (`skip-schema: true` says so) and promote shows no schema diff.
- **`site-refresh-dev.yml` is now a deprecated alias** for the guarded sync (`skip-schema: true`). Its first run refuses until `force: true`, because a dev site with no sync marker can't be told from work in progress.

Not built: deploying a Worker Preview during rehearsal and replaying the schema there (it needs per-site preview infrastructure the templates don't carry), replaying block types, and a content merge. Untested here: the GitHub Actions workflows themselves (no `actionlint` or runner available; YAML parses and the planners, executors and template wiring are unit-tested), and `emdash migrate --status` output parsing for the fingerprint. Verify with the checklist in AGENTS.md's CI/CD section before moving the `v1` tag.

Formats: no CSS changed, so none are affected. `@getvitops/core`, `generator`, `vite`, `astro`, `config` and `skills` — no consumer-facing change in these packages.
