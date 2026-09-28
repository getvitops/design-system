---
'@getvitops/emdash': major
'@getvitops/generator': patch
'@getvitops/core': patch
'@getvitops/utils': patch
'@getvitops/cli': patch
'@getvitops/vite': patch
'@getvitops/astro': patch
'@getvitops/create': patch
---

Bump `emdash`/`@emdash-cms/cloudflare` peers to `>=1.0.0 <2` and `vite-plus` to `^1.0.0`, following
both projects' GA releases.

**Breaking for `@getvitops/emdash` consumers on EmDash 0.x**: the peer range no longer admits
`emdash@0.31.x`/`@emdash-cms/cloudflare@0.31.x`. Upgrade `emdash` and `@emdash-cms/cloudflare` to
`^1.0.1` first — nothing in `@getvitops/emdash`'s own plugin surface (`admin.portableTextBlocks`,
the `hooks.page-fragments:register` capability, `definePlugin()`) changed against EmDash 1.0, so no
code here needed to change, only the declared range.

The `emdash` scaffold template (`vp create @getvitops:emdash`) picks up several fixes alongside
the version bump:

- `tailwindcss`/`@tailwindcss/vite` are now real dependencies — the template selected
  `css.format: 'tailwind'` without installing either, which threw on build.
- `site.json` now sets `site.icons.sprite: true` plus the full `semantic` list the
  `vitops.actionLink` block's icon picker offers — previously its sprite icons pointed at a file
  the build never generated.
- `astro.config.mjs` sets `migrations: { runtime: 'check', dev: 'auto' }`, and
  `site-deploy-emdash.yml` runs EmDash 1.0's documented `build → status → apply → deploy → check`
  migration sequence explicitly, rather than relying solely on first-request auto-migration. This
  needs a new GitHub Environment variable, `EMDASH_TARGET_FINGERPRINT` (one per environment),
  which only a human can set — run `emdash migrate --status` against the real deployed database,
  review the printed identity, then `gh variable set EMDASH_TARGET_FINGERPRINT --env <env> --body
<value>`. Deploys fail clearly on the migration-apply step until it's set.
- `lint.options.typeAware`/`typeCheck` in the template's own `vite.config.ts` are commented out,
  not deleted: vite-plus 1.0 only honours that option in a project's actual root config, and hard
  errors on it in a nested one (which this file is, sitting inside the `design-system` monorepo).
  Uncomment it once scaffolded into its own repo.

No config schema changes. `@getvitops/generator` also switches from the `zod/mini` subpath import
to the standalone `@zod/mini` package (zod 4.5+; same API) and fixes `validateConfig()` silently
losing the offending key name on an `unrecognized_keys` error (e.g. a typo'd `site.ads` platform
now names the bad key instead of reporting a bare "Invalid input").

Also fixed: `vp check`'s `tsconfig-error` for `packages/create/templates/emdash/tsconfig.json`
(`extends: "astro/tsconfigs/strict"`, unresolvable from inside this monorepo since the template
has no `node_modules` of its own — a pre-existing, structural gap, newly surfaced as a hard error
by oxlint 1.85's deeper config discovery, and blocking on every commit since this repo's pre-commit
hook runs `vp check --fix`). Fixed with a new `scripts/link-template-deps.mjs`, wired as the root
`postinstall` script: symlinks `astro`/`emdash`/`@emdash-cms/cloudflare` into the template's own
`node_modules/` (resolved fresh from sibling packages that already depend on them for real, not a
hardcoded `.pnpm` hash) and writes a minimal `astro:content` ambient shim at `.astro/types.d.ts`
(the same path `astro sync` would generate for real). Both are gitignored and only ever exist
inside this monorepo's copy of the template — a real scaffold installs its own real copies instead.
Considered and rejected first: inlining astro's strict preset (drift risk against astro's own
evolving default) and making the template a real pnpm workspace member (would change how its
`@getvitops/*: "latest"` deps resolve locally, which `templates.test.ts` exists to protect).

**Known gap, not fixed here**: `packages/astro/src/components/container.test.ts` (the
`AstroContainer`-based render tests) fails to even load under vite-plus 1.0's Vite 8 — direct
`.astro` imports in a Vitest file need the Astro Vite plugin registered, which nothing in this
repo's test config actually does (Astro's own docs call for `getViteConfig()`, which doesn't
compose with vite-plus's own `defineConfig`). A type-level shim
(`packages/astro/src/components/astro-modules.d.ts`) fixes `vp check`'s type-aware pass, but the
runtime `vp test` failure for this one file is still open.
