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
- **Layout foundations — these are the answer, not a starting point.** Six
  substitutions carry the structure of nearly every page:
  | About to write… | Write instead |
  | --- | --- |
  | a `wrap`/`wrapper`/`container`/`inner` class | **`centered`** |
  | `max-width` + `margin-inline: auto` | **`centered`** |
  | `padding-block` on a section | **`region`** |
  | margins between headings/paragraphs/lists | **`rhythm`** |
  | `display: grid` + `grid-template-columns: repeat(n, …)` | **`subgrid`** |
  | `repeat(auto-fit, minmax(…))` | **`grid-auto`** |
  | `display: flex` + `gap` for a row of controls | **`cluster`** |

  `centered` is a grid of _named tracks_, not a max-width box — a child widens
  itself with `breakout`/`spotlight`/`fullbleed` without the parent knowing, which
  is the thing a bespoke `.wrap` can never do. **More than one card means
  `subgrid`**: a plain grid aligns the outer boxes but not the tranches inside
  them, so headings and CTAs land at different heights across the set. Write
  `<ul class="subgrid subgrid-cols-3" role="list">` with
  `<li class="card subgrid-card">` items, or `<Subgrid />` (which renders the slot
  verbatim — author the `<li>`s yourself; it adds `role="list"` for you, and a
  hand-written one needs it because a marker-less `<ul>` stops being announced as a
  list in Safari).

  **When the whole card is a link the card is still the item**, and pick by whether
  the card's text must stay selectable: `stretched-link` on a link inside it is
  zero-JS but kills text selection, while `<Cards>` (which wraps the list in
  `<wc-cards>`) keeps selection and falls back to that same link with no JS. Never
  both — the overlay wins and the JS never runs. Never `<li><a class="card">`: the
  `li` is the grid item, so the anchor's tranches never align and it does not fill
  the cell; it renders fine, which is why it keeps getting written.

  `npm run lint:design` reports all of these, and the pre-commit hook fails on them
  — the fix is the class, not a justification for the CSS.

- **Prerender by default.** `output: 'server'` is required (the admin, media/API
  routes, preview and scheduled publishing need a server), so prerendering is
  opt-in per route: put `export const prerender = true` on every page that
  doesn't need per-request data, and give dynamic routes a `getStaticPaths()`
  that queries the collection at build time. A route with no `prerender` export
  is re-rendered for every visitor on every request. The cost is that a
  prerendered page reflects the database as of the last build, so an admin
  publish needs a redeploy — leave a route server-rendered only where that is
  unacceptable (preview, personalised content, must-be-live-in-seconds).
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
