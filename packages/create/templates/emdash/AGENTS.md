This is an EmDash CMS website (Astro SSR on Cloudflare Workers, D1 + R2)
styled by the Vitops design system.

## Ground rules

- `design-system.json` is the single source of truth for the design system
  (colors, type, spacing, patterns, animations). Never edit
  `src/styles/tailwind.css` — it is generated from the JSON by the
  `vitops()` integration on every dev/build and is gitignored.
- Content lives in the EmDash database, not in the repo. Query it with
  `getEmDashCollection` / `getEmDashEntry` from `emdash`; render Portable Text
  with `<PortableText />` from `emdash/ui` (the Vitops blocks from
  `@getvitops/emdash` are merged in automatically).
- `seed/seed.json` only applies against an empty database: structure
  (collections, menus, settings) on first boot; the `content` entries only
  when the setup wizard's "include sample content" option is chosen. Changing
  the seed does not migrate an existing site — use the admin
  (`/_emdash/admin`) or the site's MCP server (`/_emdash/api/mcp`) to change
  the content model of a running site.
- Prefer framework CSS classes (utilities, patterns, type roles like
  `font-heading`) over bespoke CSS. Run `npx vitops agents` to append the
  full generated class-vocabulary reference to this file.
- The Worker cron trigger in `wrangler.jsonc` drives scheduled publishing —
  don't remove it.
- Hosting (adapter + EmDash database/storage) comes from `vitopsHosting()`
  (`@getvitops/emdash`) in astro.config.mjs — never hard-code an adapter or
  d1/r2/sqlite there. Switch targets via `vitopsHosting({ target })` or the
  `HOSTING` env var (see README "Hosting"); the `node` target needs
  `@astrojs/node` + `better-sqlite3` installed first.

## Branch model

- Work on **`dev`** (the integration branch). Every push auto-deploys the
  isolated `-dev` worker (own D1/R2; `dev.<domain>` with a custom domain).
- **`main`** is production and branch-protected — never push or merge to it
  directly. Production ships only via the manual **promote** flow: the
  `promote` skill (`.agents/skills/promote/SKILL.md`) dispatches
  `.github/workflows/promote.yml`, which opens a `dev → main` PR with
  auto-merge; merging deploys prod. Only run it when the user explicitly asks
  to promote/ship to production.
- Sample legal pages (`/terms`, `/privacy`) ship as seeded placeholder content
  — remind the user to replace them before launch. They are deliberately short
  and obviously unfinished; do not "improve" them into something that reads as
  a finished policy, because the risk here is a plausible-looking document
  getting shipped unread.
  To replace them properly, write a site config and run
  `npx vitops legal --format portable-text --out ./legal`, then paste each
  document's blocks into the page in the admin. That renders a real policy from
  what the site actually does — the analytics provider it uses, the fields its
  forms collect, where it deploys — rather than from guesses. It still needs
  review before launch.

## Docs MCP servers

`.mcp.json` preconfigures the Astro docs and EmDash docs MCP servers — prefer
searching them over pre-trained knowledge for Astro/EmDash questions.

## Commands

- `pnpm dev` — local dev with local D1/R2 emulation (no Cloudflare account)
- `pnpm typecheck` — `astro check`
- `pnpm deploy` — build + `wrangler deploy` prod (provisions D1/R2 on first run)
- `pnpm deploy:dev` — build + deploy the isolated dev worker (needs `DEV_D1_ID`)
- `pnpm run init:github` — one-time: create + push the GitHub repo (main + dev,
  dev default). Only run when the user asks to set up GitHub.
- `pnpm run init:hosting` — one-time: provision the hosting platform (dev
  D1/R2 + repo secrets on cloudflare). Only run when the user asks for it.
- `npx vitops validate design-system.json` — schema-check the design config
