# @getvitops/create

## 0.3.2

### Patch Changes

- a334049: Make the semantic icon mapping reachable, and fail the build on unresolvable names.

  `generateIconInclude()` — declare the semantic icon names a site needs plus which sets to draw
  them from, get back the `include` map that keeps the bundle to just those glyphs — already existed
  but was unreachable: it lived in `@getvitops/core/src/utils/`, which the package doesn't export.
  It has moved to `@getvitops/utils` (a build-time concern, in the build-time utilities package),
  which `@getvitops/astro` re-exports wholesale. So from `astro.config.mjs`:

  ```js
  import { generateIconInclude } from '@getvitops/astro';
  import icon from 'astro-icon';

  integrations: [
    icon({
      include: generateIconInclude({
        ui: 'fa7-solid',
        brand: 'simple-icons',
        semantic: ['menu', 'close', 'search', 'github'],
      }),
    }),
  ];
  // → { "fa7-solid": ["bars","xmark","magnifying-glass"], "simple-icons": ["github"] }
  ```

  Swapping `ui` to `'lucide'` yields `{ lucide: ["menu","x","search"] }` from the same declaration —
  which is the point: the semantic names are what your markup commits to, and the set is a config
  choice. The output shape is the `include` both `astro-icon` and `astro-iconset` accept, so the
  mapping doesn't tie you to either.

  **Unresolvable names are now a build error.** Previously they were skipped silently, so swapping
  sets appeared to succeed and the gaps surfaced as missing glyphs in production. The error names
  every offender; an unknown set name throws too, listing the known sets.

  Also fixes `@getvitops/create`'s emdash template, which pinned `@getvitops/astro: ^0.4.0` — a range
  that stopped resolving when astro joined the fixed group at 0.7.0, so scaffolded projects were
  stuck on the old line.

## 0.3.1

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

## 0.3.0

### Minor Changes

- emdash template: hosting is now a configurable seam — astro.config resolves
  adapter + database/storage via `vitopsHosting()` from `@getvitops/emdash`
  (^0.2.0), documented in the new README "Hosting" section. New
  `pnpm run init:hosting` provisions the platform: on cloudflare it creates the
  isolated dev D1 + R2 via wrangler and sets the `DEV_D1_ID` /
  `CLOUDFLARE_ACCOUNT_ID` repo secrets via `gh` (idempotent, `--dry-run`;
  `--target node` prints the Node-host switch steps). Also preconfigures
  permission allows for the Astro/EmDash docs MCP tools in `.claude/settings.json`.

## 0.2.0

### Minor Changes

- emdash template: `pnpm run init:github` — one-time GitHub bootstrap via the
  `gh` CLI. Creates a repo named after the project, makes the initial commit if
  needed, pushes `main` + `dev`, sets `dev` as the default branch, and prints
  the remaining manual steps (dev D1/R2, secrets, branch protection).
  Idempotent, with `--dry-run` and `--public` flags.

## 0.1.0

### Minor Changes

- New `@getvitops/create` package: `vp create` org templates for the Vitops
  design system. First template: `emdash` — an EmDash CMS website on Cloudflare
  Workers (D1 + R2) with `@getvitops/astro` (design-system CSS, favicons,
  web-component runtime), `@getvitops/emdash` (editor blocks), and
  `@getvitops/cli` pre-wired, plus a seed with a `pages` collection, menus, and
  starter content — home, about, terms, privacy, 404 (published via the setup
  wizard's "include sample content" option). Ships a dev → main promotion flow
  (auto-deploying `dev`/`main` workflows, a manual promote workflow + matching
  `promote` agent skill, and an isolated dev worker config), the Astro + EmDash
  docs MCP servers in `.mcp.json`, and a Claude Code web hook that provisions
  Node 24 + pnpm. Scaffold with `vp create @getvitops:emdash`.
