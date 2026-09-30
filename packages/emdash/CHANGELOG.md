# @getvitops/emdash

## 1.0.0-alpha.0

### Major Changes

- c3c1bcb: **New: the design-system editor, mounted inside the EmDash admin.** `vitopsEmdash({
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

- 0574388: Bump `emdash`/`@emdash-cms/cloudflare` peers to `>=1.0.0 <2` and `vite-plus` to `^1.0.0`, following
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

### Patch Changes

- Updated dependencies [65a13cc]
- Updated dependencies [67e2088]
- Updated dependencies [0574388]
- Updated dependencies [c3c1bcb]
- Updated dependencies [0574388]
- Updated dependencies [0574388]
- Updated dependencies [0574388]
- Updated dependencies [1a3e811]
- Updated dependencies [2a0a559]
- Updated dependencies [0574388]
- Updated dependencies [dde3df3]
- Updated dependencies [d9f213b]
- Updated dependencies [0f8c018]
- Updated dependencies [3bbb8c3]
  - @getvitops/generator@8.2.0-alpha.0
  - @getvitops/astro@8.2.0-alpha.0
  - @getvitops/utils@8.2.0-alpha.0
  - @getvitops/core@8.2.0-alpha.0

## 0.3.10

### Patch Changes

- Updated dependencies
  - @getvitops/utils@8.1.0

## 0.3.9

### Patch Changes

- @getvitops/utils@8.0.1

## 0.3.8

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [a84839b]
  - @getvitops/utils@8.0.0

## 0.3.7

### Patch Changes

- Updated dependencies [c0c092b]
- Updated dependencies
- Updated dependencies [2b50f9e]
  - @getvitops/utils@7.0.0

## 0.3.6

**The `vitops.carousel` block now renders `@getvitops/astro`'s `<Carousel />`** instead of emitting
`<wc-carousel>` markup of its own — one implementation, so the block cannot drift from the
component. Two new fields: **Loop** (a toggle; cloning the slides is opt-in now, and `autoplay`
implies it) and **Slide aspect ratio** (default `16 / 9`, which is what keeps slide heights equal
whatever each image's proportions are). Existing carousel blocks keep working; they simply stop
looping unless you tick Loop.

**The `@getvitops/astro` peer range is now `>=6.0.0`**, because `Carousel.astro` does not exist
before it. Upgrade the whole toolchain together — it ships as one version.

### Patch Changes

- @getvitops/utils@6.0.0

## 0.3.5

### Patch Changes

- Updated dependencies
  - @getvitops/utils@5.0.0

## 0.3.4

### Patch Changes

- Updated dependencies [2c890c0]
  - @getvitops/utils@4.1.0

## 0.3.3

### Patch Changes

- Updated dependencies [c6b99e7]
- Updated dependencies [f7bc0a0]
- Updated dependencies [ceed51f]
  - @getvitops/utils@4.0.0

## 0.3.2

### Patch Changes

- Updated dependencies [6e68ace]
  - @getvitops/utils@3.0.0

## 0.3.1

### Patch Changes

- Updated dependencies [20e518e]
- Updated dependencies [9bf975a]
  - @getvitops/utils@2.1.0

## 0.3.0

### Minor Changes

- 04a51d8: New `vitops.actionLink` block: a link or button with optional icons at either end.

  Editors get a label, URL, style (link / button / call-to-action), colour role, new-tab toggle, and
  searchable pickers for a start and end icon. Icons render from the generated SVG sprite, so the
  block needs no JavaScript, and they use the sprite's set-independent aliases — content authored in
  the CMS survives the site changing icon sets.

  Fields are flattened (`label`, `href`, … as siblings rather than a nested object) because Block Kit
  has no object-group element. The icon pickers are comboboxes over the semantic name list for the
  same reason: Block Kit's element union is closed, so a richer icon picker isn't mountable inside a
  block modal today.

- bf453b0: **Breaking:** this package now depends on the toolchain instead of pretending it doesn't.

  It shipped with no `@getvitops/*` dependency at all, on the reasoning that the independence let it
  version separately from the fixed toolchain group. That reasoning stopped being true when the blocks
  started rendering from the generated SVG sprite: `vitops.actionLink` emits
  `<use href="/vitops/icons.svg#icon-menu">`, and those ids only exist if the site's toolchain built
  the sprite with the matching semantic vocabulary. Installed against an older toolchain the block
  rendered an **empty box** — no install-time error, no console warning, nothing to grep for.

  Two changes make the coupling real:
  - **`@getvitops/utils` is a hard dependency**, and `SEMANTIC_ICON_OPTIONS` is now derived from its
    `iconMap` rather than generated into `src/icon-options.ts` by a script. The editor's icon list and
    the sprite's aliases are one source, so they cannot drift. `pnpm gen:icons` is gone; there is
    nothing left to regenerate.
  - **`@getvitops/astro` is a peer** (`>=2.0.0`). It is the integration that emits the sprite into
    `public/`, and it belongs to the site — a hard dependency would let a version mismatch install two
    copies of an Astro integration rather than telling you about it.

  **Migration:** install or upgrade `@getvitops/astro` (and the rest of the toolchain, which moves in
  lockstep) to `2.x` alongside this release. If your package manager reports an unmet peer on
  `@getvitops/astro`, that is this change working — it is the error that replaced the empty box.

### Patch Changes

- Updated dependencies [4756788]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [04a51d8]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [bf453b0]
- Updated dependencies [feae1a3]
- Updated dependencies [bf453b0]
  - @getvitops/astro@2.0.0
  - @getvitops/utils@2.0.0

## 0.2.3

### Patch Changes

- bb92a14: Docs: import the Astro integration as `vitops`, and document the fourth output format.

  Every example now reads `import vitops from '@getvitops/astro'` and calls `vitops({ … })`,
  including the scaffolded `emdash` template. The default export is unchanged, so this is a
  naming convention in the docs rather than an API change — existing configs that bind it as
  `getvitops` keep working.

  The `@getvitops/generator` and `@getvitops/cli` docs also describe the `design` format, which
  was shipped without a mention in either package's output table: `--format design` writes a
  single `DESIGN.md` and no CSS, so a run that composes it with a stylesheet wants its own
  `--out` (the brief conventionally sits at a repo root, the stylesheet does not).

## 0.2.2

### Patch Changes

- 3b37caa: Fix the plugin descriptor reporting a stale version.

  `@getvitops/emdash@0.2.1` shipped a descriptor whose `version` read `0.2.0`. The value was a
  hand-maintained literal carrying a "keep in sync with package.json" comment; `changeset version`
  bumps package.json and leaves such a literal alone, so the two drifted at release time. A test
  asserts they match, but the release chain built and published without running tests, so nothing
  caught it.

  It's now derived from package.json, which removes the failure mode rather than relying on
  remembering, and the `release` task runs the test suite before publishing.

## 0.2.1

### Patch Changes

- 44de07f: Shared toolchain version + changelogs that reach consumers.
  - **`@getvitops/astro` now shares the toolchain version** (`core`/`generator`/`utils`/`cli`/`vite`),
    so it moves from its own `0.4.x` line onto the group's. The number changes; the package does not —
    install it at the same version as `@getvitops/cli`. It was already being bumped on every toolchain
    release by its dependency updates, and it depends on core, generator, utils _and_ vite, so a
    separate version line cost the same churn while leaving the compatible pairing implicit. The
    lockstep is load-bearing: the generator ships a snapshot of core's CSS + web-component bundles
    while the Astro integration copies the _installed_ core's bundles, so mismatched versions can leave
    the CSS and the components disagreeing.

  - **Every package now ships its `CHANGELOG.md` in the published tarball.** npm does not include
    changelogs by default, so none of this history previously reached anyone who installed the
    packages. Per-package history now reads from `node_modules/@getvitops/<pkg>/CHANGELOG.md`;
    curated toolchain-level release notes live in the repo's root `CHANGELOG.md`.

## 0.2.0

### Minor Changes

- New `vitopsHosting()` export — the hosting seam for EmDash sites. Resolves
  the Astro adapter + EmDash database/storage for a target: `cloudflare`
  (default — `@astrojs/cloudflare`, D1 `DB`, R2 `MEDIA`) or `node`
  (`@astrojs/node` standalone, SQLite file, local uploads). Target precedence
  `HOSTING` env > `options.target` > cloudflare; adapter packages resolve
  lazily (install per target, missing ones fail with install instructions);
  `options.node.database/storage` accept full descriptors (postgres/s3) for
  production Node hosts.
