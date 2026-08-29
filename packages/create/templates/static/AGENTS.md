This is a static Astro website styled by the Vitops design system, deployed
as Cloudflare Workers static assets (no server runtime, no database).

## Ground rules

- `site.json` is the single source of truth — organization + site facts, and
  the design system (colors, type, spacing, patterns, animations) under
  `designSystem.themes.default`. Never edit `src/styles/` by hand — it is
  generated from `site.json` by the `vitops()` integration on every dev/build
  and is gitignored. (There is no separate `design-system.json`: a scaffolded
  config can't merely reference a sibling file, so the token set lives inside
  `site.json`.)
- `src/assets/placeholder/` holds neutral wireframe stand-ins (square,
  portrait, landscape; SVG + PNG) for layout work before real imagery
  exists. Delete the directory once real assets land.
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
- Every page is prerendered by default (`output: 'static'`) — there is no
  server to fall back to, so nothing here can read request-time data
  (cookies, headers, query params) at render time. If a page genuinely needs
  that, it needs an adapter and a different template — this one stays pure
  static on purpose.
- **`SETUP.html` is the client-onboarding checklist.** When working it via the
  `.agents/skills/setup/` skill, tick a box only for a step you actually
  completed — never on the operator's behalf for a step marked human-only
  (the Cloudflare API token, the domain cutover, publishing legal documents).

## Branch model

- Work on **`dev`** (the integration branch). Every push auto-deploys the
  isolated `-dev` worker (`dev.<domain>` with a custom domain).
- **`main`** is production and branch-protected — never push or merge to it
  directly. Production ships only via the manual **promote** flow:
  `.github/workflows/promote.yml`, dispatched manually, opens a `dev → main`
  PR with auto-merge; merging deploys prod. Only run it when the user
  explicitly asks to promote/ship to production.

## Commands

- `pnpm dev` — local dev
- `pnpm typecheck` — `astro check`
- `pnpm run build:css` — regenerate the framework CSS from `site.json`
- `pnpm deploy` — build + `wrangler deploy` to prod
- `pnpm run deploy:dev` — build + deploy the isolated dev worker
- `pnpm run init:github` — one-time: create + push the GitHub repo (main +
  dev, dev default, branch protection + environment policy). Only run when
  the user asks to set up GitHub.
- `pnpm run init:hosting` — one-time: read the Cloudflare account id and set
  it as a repo secret. Only run when the user asks for it.
- `npx vitops validate site.json` — schema-check the site config
- `npx vitops lint -i site.json -f css` — find framework classes in
  source that resolve to nothing under this format
