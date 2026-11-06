---
'@getvitops/create': minor
---

EmDash template: make the database a build prerenders from valid before it builds, and fail the build when it isn't. The template runs `migrations: { runtime: 'check' }`, so a build against a local D1 with pending migrations prerendered EmDash's one-line "Database migrations are required" response into every page while still succeeding. A fresh CI runner, a first deploy, a `SKIP_PULL_CONTENT=1` build and an upgrade deploy all hit it.

- **New `scripts/prepare-local-db.mjs`** (`vpr prepare-local-db`): starts `astro dev` once, calls EmDash's `dev-bypass` setup (which migrates and applies the seed's sample content), checks the home page renders, and stops it. Writes only the disposable `.wrangler/state`. Run after `pull-content` by `vpr deploy`, `vpr deploy:dev` and the reusable deploy workflow. `SKIP_PREPARE_LOCAL_DB=1` skips it.
- **New `scripts/check-prerender.mjs`**, part of `vpr build` and both deploy scripts: fails when any prerendered page is not an HTML document with a title, or carries the pending-migrations message.
- **Existing sites:** add the two scripts, the `prepare-local-db` script entry, and `&& node scripts/check-prerender.mjs` after `astro build`; add a "Prepare local database" step before each Build step in a copied deploy workflow. Run `vpr prepare-local-db` once before a first local `vpr build`.

No consumer-facing change in the other toolchain packages.
