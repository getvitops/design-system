# @getvitops/create

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
