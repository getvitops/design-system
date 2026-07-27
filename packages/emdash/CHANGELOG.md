# @getvitops/emdash

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
