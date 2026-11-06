---
'@getvitops/cli': minor
'@getvitops/create': minor
---

The EmDash template's two build scripts are now CLI commands, so fixes reach existing sites with `vp update` instead of a re-copy.

- `vitops emdash prepare-db` migrates and seeds the local D1 the build prerenders from (was `scripts/prepare-local-db.mjs`). The start and stop calls time out after 5 minutes and it prints progress.
- `vitops emdash check-prerender [dir]` fails the build if a prerendered page is not a real page (was `scripts/check-prerender.mjs`).

**Migration for a site scaffolded earlier:** delete `scripts/prepare-local-db.mjs` and `scripts/check-prerender.mjs`, then in `package.json` set `"prepare-local-db": "vitops emdash prepare-db"`, `"build": "astro build && vitops emdash check-prerender"`, and use the same two commands in place of `node scripts/…` inside `deploy` and `deploy:dev`. A site that never had the scripts needs only the `package.json` entries.
