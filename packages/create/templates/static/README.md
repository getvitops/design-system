# My Static Site

A static [Astro](https://astro.build) website on Cloudflare Workers (static
assets — no server runtime), styled by the
[Vitops design system](https://www.npmjs.com/org/getvitops).

Scaffolded from `vp create @getvitops:static`.

## Stack

- **Astro** (`output: 'static'`) on **Cloudflare Workers Static Assets** — no
  adapter, no database, no server runtime
- **`@getvitops/astro`** — generates the design-system CSS from `site.json`
  (design tokens live at `designSystem.themes.default`) and serves the
  web-component runtime

`src/assets/placeholder/` ships neutral wireframe images for layout work
before real imagery exists — delete once real assets land.

## Local development

```bash
pnpm install
pnpm dev
```

- Site: <http://localhost:4321>

## Deploy

```bash
npx wrangler login
pnpm deploy
```

For a custom domain, uncomment the `routes` block in `wrangler.jsonc` and set
your apex — Cloudflare provisions the DNS record + TLS cert on deploy.

## Environments: dev → main promotion

The repo ships a two-environment flow modeled on branch = environment:

- **`dev`** is the integration branch. Every push auto-deploys the isolated
  `-dev` worker (`.github/workflows/deploy-dev.yml`), served at
  `dev.<domain>` when a custom domain is configured (or the worker's
  `workers.dev` URL otherwise).
- **`main`** is production. Every push auto-deploys the prod worker
  (`.github/workflows/deploy-prod.yml`) — gated behind a `production`
  GitHub Environment that requires an admin's approval before it runs.
- **Promotion is manual**: run the **"Promote dev → main"** workflow
  (`.github/workflows/promote.yml`) and it opens a PR from `dev` into `main`
  with auto-merge enabled. With required reviews on `main`, a human approves
  the PR; merging deploys prod (after the admin approval above).

One-time setup — work through the checklist:

```bash
pnpm run sop && open SETUP.html   # or: xdg-open SETUP.html
```

It covers host choice, GitHub + branch policy, hosting resources, going live
safely on `*.workers.dev` before any custom-domain cutover, configuration,
Search Console/GCP/ads connections, legal documents, and launch gates — one
command per step. An AI agent can work the same list autonomously via
`.agents/skills/setup/`; it stops at the steps that genuinely need a human
(the Cloudflare API token, the domain cutover, publishing legal documents).

`pnpm run deploy:dev` reproduces the dev deploy locally: it writes a
gitignored `.wrangler.dev.json` with the worker renamed and any custom-domain
route prefixed `dev.` (`scripts/dev-wrangler-config.mjs`), so it never
touches the prod worker.

## CI/deploy workflows

`.github/workflows/{ci,deploy-dev,deploy-prod,promote}.yml` are thin callers
of reusable workflows published by
[`getvitops/design-system`](https://github.com/getvitops/design-system),
pinned to `@v1`. A fix to the shared deploy logic there reaches this repo the
next time those workflows run — no re-pasting needed. Bump the pin
deliberately if you want to hold back a change.
