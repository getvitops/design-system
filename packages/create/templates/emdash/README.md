# My EmDash Site

An [EmDash CMS](https://docs.emdashcms.com) website on Cloudflare Workers,
styled by the [Vitops design system](https://www.npmjs.com/org/getvitops).

Scaffolded from `vp create @getvitops:emdash --directory <client-slug>` (pass a directory: `vp create` derives the package name from it and invents a random slug otherwise).

## Stack

- **Astro** (SSR) on **Cloudflare Workers** — D1 database, R2 media storage
- **EmDash** — the admin lives at `/_emdash/admin`; content is queried with
  `getEmDashCollection` / `getEmDashEntry` (Astro live content collections)
- **`@getvitops/astro`** — generates the design-system CSS from `site.json`
  (Tailwind v4 format), generates favicons/PWA assets from
  `src/assets/logo.svg`, and serves the web-component runtime
- **`@getvitops/emdash`** — design-system Portable Text blocks in the editor
  slash menu: image compare, copy snippet, banner, disclosure, carousel

`src/assets/placeholder/` ships neutral wireframe images for layout work
before real imagery exists — delete once real assets land (separate from
`src/assets/logo.svg`, the brand asset).

## Local development

```bash
vp install
vpr dev
```

No Cloudflare account needed: `astro dev` runs the Worker locally with local
D1/R2 emulation (state in `.wrangler/`). On first boot EmDash runs its
migrations and applies the structure from `seed/seed.json` — a `pages`
collection, three menus (`primary`, `footer-sitemap`, `footer-legal`), and the site
settings.

- Site: <http://localhost:4321>
- Admin: <http://localhost:4321/_emdash/admin>

Open the admin and complete the setup wizard — it creates your first account,
and choosing to **include sample content** publishes the starter pages from
the seed: home, about, contact (`/contact`), terms (`/terms`), privacy policy
(`/privacy`) and cookie notice (`/cookies`) — every link in the seeded menus
resolves. Until then the home route shows a friendly empty state. Unknown paths
get the prerendered `src/pages/404.astro` with a real 404 status.

**Pages are prerendered.** `vpr build` writes static HTML for every published
`pages` entry, so an edit in the admin goes live on the next rebuild rather than
per request — see AGENTS.md "Rendering and freshness" for how production content
reaches the build (`scripts/pull-content.mjs`) and for the publish-triggered rebuild.
In `vpr dev` the pages read your local database, so edits appear straight away.

The two legal pages are placeholders. To generate real ones from what your site
actually does, fill in `site.json`'s `organization`/`site.legal` fields and run:

```sh
vp exec vitops legal --format portable-text --out ./legal
```

Then paste each document's blocks into the matching page in the admin. The
output is generated from your config, not legal advice — have it reviewed
before you publish.

## Deploy

```bash
vp exec wrangler login
vpr deploy
```

Wrangler provisions the D1 database and R2 bucket named in `wrangler.jsonc`
on the first deploy; EmDash migrates + applies the seed structure on first
boot (sample content again comes from the setup wizard). Later deploys leave
existing content alone. The cron trigger in `wrangler.jsonc` drives
scheduled publishing — don't remove it. For a custom domain, uncomment the
`routes` block in `wrangler.jsonc` and set your apex.

## Environments: dev → main promotion

The repo ships a two-environment flow modeled on branch = environment:

- **`dev`** is the integration branch. Every push auto-deploys the isolated
  `-dev` worker (`.github/workflows/deploy-dev.yml`) — its own D1 database and
  R2 bucket, served at `dev.<domain>` when a custom domain is configured (or
  the worker's `workers.dev` URL otherwise).
- **`main`** is production. Every push auto-deploys the prod worker
  (`.github/workflows/deploy-prod.yml`).
- **Promotion is manual**: run the **"Promote dev → main"** workflow
  (`.github/workflows/promote.yml`) — or ask your AI agent to run the
  `promote` skill (`.agents/skills/promote/`) — and it opens a PR from `dev`
  into `main` with auto-merge enabled. With required reviews on `main`, a
  human approves the PR; merging deploys prod.

One-time setup — work through the checklist:

```bash
vpr sop && open SETUP.html   # or: xdg-open SETUP.html
```

It covers host choice, GitHub + branch policy, hosting resources, going live
safely on `*.workers.dev` before any custom-domain cutover, configuration,
Search Console/GCP/ads connections, legal documents, and launch gates — one
command per step. An AI agent can work the same list autonomously via
`.agents/skills/setup/`; it stops at the steps that genuinely need a human
(the Cloudflare API token, the domain cutover, publishing legal documents).

`vpr deploy:dev` reproduces the dev deploy locally: it rewrites the
adapter-generated wrangler config (`scripts/build-dev-wrangler.mjs`) so the
dev worker never touches prod data — it hard-fails without `DEV_D1_ID`,
on purpose. Schema/content changes live in the EmDash database, not git, so
promote them separately (via the prod admin or its MCP server).

## Hosting

The adapter and EmDash database/storage come from one call in
`astro.config.mjs` — `vitopsHosting()` from `@getvitops/emdash` — so hosting
is a configurable dimension of the project, not a rewrite:

- **`cloudflare`** (default) — Workers + D1 + R2. `wrangler.jsonc`,
  `src/worker.ts` (fetch + scheduled handlers), and the deploy workflows
  belong to this target.
- **`node`** — `@astrojs/node` (standalone) + SQLite file + local uploads,
  for a VPS / docker-compose / k8s host. Not installed by default; to switch:
  `vp add @astrojs/node better-sqlite3`, then `vitopsHosting({ target:
'node' })` (or set `HOSTING=node` — the env var wins). Run the built site
  with `node ./dist/server/entry.mjs`; data lives in `./data/` (gitignored) —
  persist it as a volume. Scheduled publishing runs in-process on Node, so
  the worker/cron pieces aren't needed. For production, move storage to
  S3-compatible and/or the database to Postgres via `vitopsHosting({ node:
{ database, storage } })`. CI deploy for Node hosts is TBD — the shipped
  workflows are Cloudflare-specific.

Moving an existing site between targets (either direction) is a data
migration: content lives in the database (D1 export / EmDash seed round-trip)
and media in the storage backend (bucket/directory copy).

## AI tooling

- **MCP servers** (`.mcp.json`): the Astro docs (`mcp.docs.astro.build`) and
  EmDash docs (`docs.emdashcms.com/mcp`) servers are preconfigured, so coding
  agents answer from current documentation. Your running site also exposes its
  own content MCP server at `/_emdash/api/mcp` (authenticated).
- **Skills** (`.agents/skills/`): `promote` dispatches the dev → main
  promotion workflow. Run `vp exec vitops agents` to also write the design-system
  class reference into `AGENTS.md`.
- **Claude Code on the web**: the SessionStart hook
  (`.claude/hooks/session-start.sh`) installs Node 24 (matching
  `devEngines`), activates the pinned pnpm, and installs dependencies in the
  remote container automatically. Point the remote environment at the `dev`
  branch so pushes land on the auto-deployed review site.

## The design system

`site.json`'s `designSystem.themes.default` is the single source of truth for
colors, type, spacing, shadows, patterns, and animations — there is no
separate `design-system.json`, since a scaffolded config can't merely
reference a sibling file. The `vitops()` integration regenerates
`src/styles/tailwind.css` from it on dev/build (the file is gitignored — edit
the JSON, not the CSS). `Layout.astro` imports the stylesheet so the admin
routes stay unstyled by it.

Useful commands (via `@getvitops/cli`):

```bash
vp exec vitops validate site.json   # check the config against the schema
vp exec vitops agents               # write the design-system reference into AGENTS.md
vpr build:css                  # regenerate the CSS manually
```

## Project map

| Path                             | Purpose                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| `site.json`                      | Org + site config; design tokens/patterns at `designSystem.themes.default` → generated CSS         |
| `seed/seed.json`                 | First-boot content model + starter content                                                         |
| `src/worker.ts`                  | Worker entry (fetch + EmDash scheduled handler)                                                    |
| `src/live.config.ts`             | Astro live content collections wiring for EmDash                                                   |
| `src/layouts/Layout.astro`       | Site chrome: EmDash + Vitops head tags, nav from the CMS menu                                      |
| `src/pages/index.astro`          | Home — prerendered from the `home` page entry                                                      |
| `src/pages/[...slug].astro`      | Prerendered once per published `pages` entry (`getStaticPaths`)                                    |
| `src/pages/404.astro`            | Prerendered not-found page, served with a 404 status for any unmatched URL                         |
| `public/_headers`                | Report-Only CSP for the static pages (see AGENTS.md "Content Security Policy")                     |
| `scripts/pull-content.mjs`       | Loads production's D1 into the local build DB before the prerender (`deploy`/`deploy:dev`)         |
| `wrangler.jsonc`                 | Cloudflare bindings (D1/R2) + cron trigger                                                         |
| `scripts/build-dev-wrangler.mjs` | Rewrites the built wrangler config for the isolated dev worker                                     |
| `SETUP.html`                     | Client-onboarding checklist — run `vpr sop` first (see "One-time setup")                           |
| `.github/workflows/`             | deploy-dev (push to `dev`), deploy-prod (push to `main`, or an `emdash-publish` dispatch), promote |
| `.agents/skills/promote/`        | Agent skill: dispatch the dev → main promotion                                                     |
| `.agents/skills/custom-blocks/`  | Agent skill: when (and how) to add a block type — compose, extend, local, upstream                 |
| `.mcp.json`                      | Astro + EmDash docs MCP servers for coding agents                                                  |
| `.claude/hooks/`                 | Claude Code web: Node 24 + pnpm setup on session start                                             |
