---
'@getvitops/emdash': major
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/utils': minor
'@getvitops/cli': patch
'@getvitops/vite': patch
'@getvitops/astro': patch
'@getvitops/create': minor
---

**New: the design-system editor, mounted inside the EmDash admin.** `vitopsEmdash({
designSystemEditor: { config } })` (`config` is your `site.json`, e.g. `import config from
'./site.json' with { type: 'json' }`) adds a `/design-system` admin page mounting
`<wc-theme-editor>` — the same live token editor `@getvitops/vite`'s dev server has always
offered, now usable by the client directly, no dev server required. An edit is visible
site-wide immediately (a runtime `:root` override, served via a new plugin API route and
`page:fragments`) and — once `site.deployment.repo`/`branch` and a `VITOPS_GITHUB_TOKEN`
secret are set (see the scaffold's `SETUP.html`) — auto-commits to your `dev` branch, so it
reaches the git-tracked `site.json` through your repo's normal review path rather than
becoming a second, unreviewed source of truth. Until that's configured, the live half still
works; only the auto-commit half is skipped (and says so in the admin page). The save route
runs the exact same accessibility (APCA contrast) gate `generate()` enforces at build time,
synchronously, before persisting — nothing non-compliant ever goes live even momentarily.

Requires `@astrojs/react` + `react` + `react-dom` (already scaffold dependencies, for
EmDash's own admin) and `@getvitops/core` (added as a new scaffold dependency this release).
Declares two new plugin capabilities when enabled: `network:request` (for the GitHub
auto-commit) and `hooks.page-fragments:register` (for the live override) — reviewed once at
plugin-install time.

**Breaking for `@getvitops/emdash`**: `vitopsEmdash()`'s `hooks.page-fragments:register`
capability is now also granted whenever `designSystemEditor` is set, independent of the
existing `scripts: 'fragments'` option (which governs something unrelated — web-component
script delivery). No change if you don't use `designSystemEditor`.

Also new, supporting the above:

- `@getvitops/generator`: `validateColorContract()` and `buildReverseIndex()` (both
  `/tokens` subpath, Worker-safe) — the monotonicity/contrast gate and the
  `design-manifest.json` reverse-index, each extracted from `generate()`'s `build()` into
  standalone, non-throwing functions. `patchToOverrideCss()` turns a design-system patch
  into the `:root` override `<style>` block. `designSystemPath`/`getAt`/`setAt`/
  `mergePatch`/`formatConfig` moved from `@getvitops/vite` into `@getvitops/generator/config`
  (re-exported from `@getvitops/vite` unchanged) — one "patch a config file's design-system
  subtree" implementation shared by the dev endpoint and the new plugin route. New
  `site.deployment.repo`/`branch` config fields.
- `@getvitops/utils`: new `/git` subpath — `commitFile()`, a Worker-safe (fetch-only)
  wrapper over GitHub's Contents API.
- `@getvitops/core`: `<wc-theme-editor>` gains a `save-endpoint` attribute (default
  unchanged — `/__vitops/design-system`) so the same element can target the new plugin
  route instead of the dev-only Vite endpoint.
