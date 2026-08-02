---
title: "@getvitops/create"
description: "Project templates — scaffold a wired-up site with `vp create @getvitops`."
section: "Packages"
order: 80
---

```sh
npm i -D @getvitops/create
```


Project templates for the Vitops design system, consumed by
[Vite+](https://viteplus.dev)'s `vp create` via the `createConfig.templates`
manifest in this package's `package.json`.

## Usage

```bash
# Interactive picker over this package's templates
vp create @getvitops

# Scaffold a specific template directly
vp create @getvitops:emdash
```

`vp create` copies the template, initializes git, installs dependencies, and
(optionally) writes agent/editor config — see `vp create --help`.

## Templates

### `emdash`

An [EmDash CMS](https://docs.emdashcms.com) website on Cloudflare Workers,
with every relevant `@getvitops/*` package pre-wired:

- **`@getvitops/astro`** — the `vitops()` integration: design-system CSS
  generated from `design-system.json` (Tailwind v4 format, layout-scoped via
  `css.inject: false`), favicons/PWA from `src/assets/logo.svg`, and the
  web-component runtime copied into `public/vitops/`.
- **`@getvitops/emdash`** — the EmDash native plugin: Vitops Portable Text
  blocks (image compare, copy snippet, banner, disclosure, carousel) editors
  insert from the admin slash menu, rendered with the design-system web
  components (accessible no-JS fallbacks included).
- **`@getvitops/cli`** — `vitops` on the scaffolded project's PATH for
  `vitops validate`, `vitops agents`, and manual `vitops generate` runs.
- **EmDash on Cloudflare** — D1 database + R2 media via
  `@emdash-cms/cloudflare`, a Worker entry with the cron trigger for
  scheduled publishing, and a seed (`seed/seed.json`): the `pages`
  collection, `primary`/`footer` menus, and settings apply on first boot; the
  starter pages (home, about, terms, privacy — plus a 404 route) publish when
  the setup wizard's "include sample content" option is chosen.
- **GitHub bootstrap** — `pnpm run init:github` creates a same-named GitHub
  repo via the `gh` CLI, pushes `main` + `dev`, and makes `dev` the default
  branch (idempotent; `--dry-run` / `--public` flags).
- **Hosting seam** — astro.config resolves its adapter + EmDash
  database/storage through `vitopsHosting()` from `@getvitops/emdash`
  (`cloudflare` default; `node` for VPS/docker/k8s after installing
  `@astrojs/node` + `better-sqlite3`), and `pnpm run init:hosting` provisions
  the platform (cloudflare: dev D1 + R2 created via wrangler, `DEV_D1_ID` /
  `CLOUDFLARE_ACCOUNT_ID` repo secrets set via `gh`; idempotent, `--dry-run`).
- **dev → main promotion flow** — GitHub Actions deploying `dev` to an
  isolated `-dev` worker (`dev.<domain>` with a custom domain; own D1/R2 via
  `scripts/build-dev-wrangler.mjs`, which hard-fails without `DEV_D1_ID`) and
  `main` to prod, plus a manual `promote.yml` workflow and a matching
  `promote` agent skill (`.agents/skills/promote/`) that opens the
  `dev → main` PR with auto-merge.
- **AI tooling baked in** — `.mcp.json` with the Astro + EmDash docs MCP
  servers, and a Claude Code web SessionStart hook that installs Node 24
  (matching `devEngines`) and the pinned pnpm in the remote container.

The scaffolded README walks through local dev (`pnpm dev` — no Cloudflare
account needed) and deploy (`wrangler login && pnpm deploy` — wrangler
provisions the D1/R2 resources on first deploy).

## Adding a template

1. Add a directory under `templates/<name>/` (copied as-is; ship `_gitignore`
   instead of `.gitignore` — `vp create` renames it).
2. Add a `{ name, description, template: './templates/<name>' }` entry to
   `createConfig.templates` in `package.json`.

Template dependencies must use concrete npm ranges (no `workspace:*` /
`catalog:` — the scaffolded project lives outside this monorepo).
