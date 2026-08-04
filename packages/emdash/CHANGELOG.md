# @getvitops/emdash

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
