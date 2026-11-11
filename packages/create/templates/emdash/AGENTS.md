<!-- vitops:start -->

Built with the Vitops design system (`@getvitops/*`); tokens and site facts live in `site.json`.
Prefer its classes and patterns over hand-written CSS. Load the skill that matches the task:

- [contact-form](.agents/skills/contact-form/SKILL.md) — Use when adding or changing a form, fixing submissions that don't arrive, setting up noti…
- [content-and-deploys](.agents/skills/content-and-deploys/SKILL.md) — Use for any deploy or build problem, stale or missing content, "my publish isn't live", s…
- [csp](.agents/skills/csp/SKILL.md) — Use when changing `public/_headers`, adding an embed, tracking snippet or third-party scr…
- [custom-blocks](.agents/skills/custom-blocks/SKILL.md) — Use before creating, renaming or deleting any block type, any `src/components/blocks/*` r…
- [vitops-design-system](.agents/skills/vitops-design-system/SKILL.md) — Use when styling or authoring pages or components (choosing utility/pattern classes, colo…

Reference, rendered from this project: `vitops docs <topic>` (no topic lists them).
<!-- managed by `vitops agents sync` · @getvitops/cli@8.3.0-alpha.2 — edit outside this block -->
<!-- vitops:end -->

This is an EmDash CMS website (Astro on Cloudflare Workers, D1 + R2 — public pages
prerendered, the Worker serving the admin and API) styled by the Vitops design system.

## Ground rules

- `site.json` is the single source of truth: organization + site facts, and the design system
  under `designSystem.themes.default`. Never edit the generated stylesheet
  (`src/styles/tailwind.css` with the default `tailwind` format; `css.format` in
  `astro.config.mjs` picks it). It is rebuilt from `site.json` on every dev/build and gitignored.
  Only `src/styles/tailwind.css` and `tokens.json` are ignored: put your own CSS in a separate file
  (for example `src/site.css`, imported from the layout) and commit it.
- Content lives in the EmDash database, not the repo. Read it with `getEmDashCollection` /
  `getEmDashEntry` from `emdash`; render Portable Text with `<PortableText />` from `emdash/ui`
  (the `vitops_*` blocks from `@getvitops/emdash` are merged in).
- **Where truth lives:** content (entries, media, menus) is **production's**, edited there; code,
  `site.json` and schema are **git's** (`dev` → `main`). The dev database is a disposable copy
  refreshed from prod, never promoted back. See `.agents/skills/content-and-deploys/SKILL.md`.
- `seed/seed.json` applies only to an empty database. To change a running site's content model, use
  the admin (`/_emdash/admin`) or its MCP server (`/_emdash/api/mcp`).
- Hosting comes from `vitopsHosting()` in `astro.config.mjs` — never hard-code an adapter or
  d1/r2/sqlite. Switch with `vitopsHosting({ target })` or the `HOSTING` env var.
- Keep the Worker cron trigger in `wrangler.jsonc`: it publishes content scheduled in the admin.
- `src/assets/placeholder/` is wireframe stand-in imagery; delete it once real assets land.
- Prefer framework classes (utilities, patterns, type roles like `font-heading`) over bespoke CSS.
  `vp exec vitops docs classes` prints the full class reference.
- `SETUP.html` is the onboarding checklist (`.agents/skills/setup/`). Tick a box only for a step you
  completed, never for a human-only one (the Cloudflare API token, domain cutover, legal documents).

## Building pages

- The editor's insert menu offers the `vitops_*` blocks. `vp exec vitops docs blocks` lists them
  with every field; `vp exec vitops docs components` lists every pattern, which tiers provide it
  and which block renders it.
- **Nesting.** A block type with a `portableText` field, such as `vitops_section`, holds other
  blocks. A `vitops_*` block holds only scalar fields and repeaters (cards, gallery images,
  accordion items, slides), so it can't. EmDash's built-in `columns` doesn't render `vitops_*`
  children. For layout, nest in a section, use a `blocks` field, or hand-write the template with
  `@getvitops/astro` components (`Subgrid`, `Cards`, `Carousel`, …).
- **Page opener.** Use `vitops_section` at heading level 1 with its button fields (`cta_label`,
  `secondary_label`) and `stack: rhythm`; don't nest a `vitops_hero` or another section wrapper in a
  section body, which renders two layers of `section > .centered`. `vitops_hero` is for a hero
  that stands alone (it carries option cards).
- **Section, block or widget area?** Copy-and-edit content is an EmDash Section. The same content
  everywhere (announcement bar, pre-footer call to action, sidebar, footer columns) is a **widget
  area**: define it under Widgets in the admin and render it with `<VitopsWidgetArea name="…" />`
  from `@getvitops/emdash/astro` in the layout, or in page content with the `vitops_widgetArea`
  block. Page-specific content is blocks. An area can't hold another area, and prerendered pages
  show an edit after the next deploy (like menus).
- **Escape hatches on every block:** `theme` (a backdrop from the site's colour roles, `surface` or
  `brand-primary:solid`, with the readable text for it picked by the design system, so contrast is
  not the editor's judgement), `anchor` (the `id`, for `#links`), `className` (extra classes; under
  the tailwind format only ones the site already uses) and `style` (CSS custom properties only,
  e.g. `--p-card: 2rem`; anything else is dropped). The same backdrop is available on a widget area
  (`<VitopsWidgetArea theme="…">`) and on your own markup (`themeAttrs('surface')` from
  `@getvitops/emdash/astro`, spread on the layout's `<body>`). How a role looks (flat, raised,
  glass) is the site's own role styling in `site.json`. Set `--header-offset` to the sticky
  header's height so anchors clear it.
- Override a block per site with `<PortableText components={{ type: { 'vitops_cards': MyCards } }} />`;
  hide one with `vitopsEmdash({ blocks: { exclude: [...] } })`.
- **One `<h1>` per page.** The template's page routes render the title as an `<h1>`, and a hero's
  heading level defaults to `h1`, so set a hero's level to `2` on those pages (or let the hero own
  the `h1`). Use `p` for a display heading that is not part of the outline. `vitops emdash build`
  warns on any page without exactly one `<h1>`.
- Labels: `badge` is static (status, count, category); `tag` may be editable or dismissable. Don't
  invent `chip` or `pill`. The button class is `btn`.
- **Before adding a block type** or a `src/components/blocks/*` renderer, read
  `.agents/skills/custom-blocks/SKILL.md`. Types can't be renamed or deleted once pages use them.

## Layout foundations — the answer, not a starting point

| About to write…                                         | Write instead   |
| ------------------------------------------------------- | --------------- |
| a `wrap`/`wrapper`/`container`/`inner` class            | **`centered`**  |
| `max-width` + `margin-inline: auto`                     | **`centered`**  |
| `padding-block` on a section                            | **`region`**    |
| margins between headings/paragraphs/lists               | **`rhythm`**    |
| `display: grid` + `grid-template-columns: repeat(n, …)` | **`subgrid`**   |
| `repeat(auto-fit, minmax(…))`                           | **`grid-auto`** |
| `display: flex` + `gap` for a row of controls           | **`cluster`**   |

`centered` is a grid of _named tracks_: a child widens itself with `breakout`/`spotlight`/
`fullbleed` without the parent knowing, which a bespoke `.wrap` can't do.

- **More than one card means `subgrid`**, so headings and CTAs align across the set:
  `<ul class="subgrid subgrid-cols-3" role="list">` with `<li class="card subgrid-card">`, or
  `<Subgrid />` (renders the slot verbatim; author the `<li>`s).
- **A card that is a link:** `stretched-link` inside it is zero-JS but kills text selection;
  `<Cards>` keeps selection and falls back to the same link with no JS. Never both. Never
  `<li><a class="card">`: the `li` is the grid item, so the tranches don't align.
- `vpr lint:design` reports all of these and the pre-commit hook fails on them. Fix the class, not
  the CSS.

## Rendering and the contact form

- Every public page is **prerendered**; the Worker handles `/_emdash/*` and `src/pages/api/track.ts`.
  An admin publish goes live after a rebuild. Run `vpr prepare-local-db` before a first local
  `vpr build`. Details, previews and server islands: `.agents/skills/content-and-deploys/SKILL.md`.
- The contact form posts to `/api/track`. Set `site.notifications.email` before launch or the route
  refuses posts, and mirror form fields in `site.templates`. Details:
  `.agents/skills/contact-form/SKILL.md`.
- `public/_headers` ships a Report-Only CSP. Read `.agents/skills/csp/SKILL.md` before enforcing it
  or adding embeds.
- `vitops audit` needs optional packages and a browser, checked before it starts a server:
  `vp add -D playwright @axe-core/playwright lighthouse && vp exec playwright install chromium`.
  Its page list is the built sitemap, then the seed's menus.

## Branch model

- Work on **`dev`**; every push auto-deploys the isolated `-dev` worker.
- **`main`** is production and protected: never push or merge to it. It ships only through the
  `promote` skill (`.agents/skills/promote/`), and only when the user explicitly asks.
- Sample legal pages (`/terms`, `/privacy`) are deliberately short, unfinished placeholders; don't
  "improve" them into something that reads as a finished policy. To replace them, fill in
  `site.json`'s `organization`/`site.legal`, run
  `vp exec vitops legal --format portable-text --out ./legal`, and paste each document into the page
  in the admin. It still needs review before launch.

## EmDash 1.x behaviours

- Passkeys are bound to the hostname they were created on. After a domain cutover use **Settings →
  General → Change domain**, then **Continue on**.
- Link entries by `entry.data.slug`, never `entry.id` (multilingual sites prefix `id` with a locale).
- Submit `/sitemap.xml` to search engines, not a per-collection sitemap.
- Clear a stuck D1 migration lock with `vp exec emdash migrate --take-over-lock <id>` (needs
  `--expected-target-fingerprint` non-interactively).

## Improving the toolkit

You are also a source of feedback for `@getvitops/*`. When you struggle with a framework built-in,
write a workaround, add bespoke CSS or a site-local block, or find a doc wrong or missing, and the
need is **not** unique to this site, record it in `UPSTREAM.md` at the repo root (create it if
absent). One entry each, with: what you tried, what failed or was missing, the workaround (file
path), the change you'd propose, and the package (`@getvitops/emdash`, `astro`, `core`, `cli`,
`create`, or docs). Mention new entries in your end-of-task summary. Don't log choices that are
specific to this site, and never patch `node_modules`.

## Docs and skills

- `.mcp.json` preconfigures the Astro and EmDash docs MCP servers; search them before relying on
  pre-trained knowledge.
- **Skills.** `@getvitops/skills` ships `custom-blocks`, `content-and-deploys`, `contact-form` and
  `csp`. `skills experimental_sync` (run by `prepare`, so by `vp install`) links them into
  `.agents/skills/` and `.claude/skills/`; they are gitignored and update with `vp update`. A skill
  you write yourself with the same name is never replaced. `promote` and `setup` are this site's own.
- The EmDash skills (`building-emdash-site`, `creating-plugins`, `emdash-cli`, `upgrading-emdash`,
  two WordPress porting skills) are installed per project to match the pinned `emdash`. If
  `.agents/skills/building-emdash-site/` is missing: `vp dlx skills add emdash-cms/skills --skill '*' -y`.
  Refresh with `vp dlx skills update` after bumping `emdash`.

## Commands

This is a **Vite+** project: use `vp` (and `vpr`), not `pnpm`/`npm`/`npx`. Scripts that wrap Astro
go through `vpr` (`vpr dev`, `vpr build`, `vpr preview`), because `vp dev`/`vp build` skip Astro.
`vpr dev` returns immediately (the server runs in the background): check it with
`vp exec astro dev status`, read `vp exec astro dev logs --follow`, stop with
`vp exec astro dev stop`; the site is at <http://localhost:4321>.

| To…                                      | Run                                                     |
| ---------------------------------------- | ------------------------------------------------------- |
| install dependencies                     | `vp install`                                            |
| add / remove / update a package          | `vp add <pkg>` · `vp remove <pkg>` · `vp update`        |
| run a `package.json` script              | `vpr <script>`                                          |
| run a locally installed binary           | `vp exec <bin>` (e.g. `vp exec vitops docs components`) |
| run a one-off package without installing | `vp dlx <pkg>`                                          |
| format + lint + typecheck (files)        | `vp check`                                              |
| typecheck Astro (`.astro` files)         | `vpr typecheck`                                         |
| design-lint the markup                   | `vpr lint:design`                                       |

| Script                              | What it does                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `vpr dev`                           | local dev with local D1/R2 emulation (no Cloudflare account)                                |
| `vpr deploy`                        | pull production content, build, `wrangler deploy` prod (provisions D1/R2 on first run)      |
| `vpr deploy:dev`                    | same, for the isolated dev worker (needs `DEV_D1_ID`)                                       |
| `vpr pull-content`                  | just the content pull                                                                       |
| `vpr prepare-local-db`              | migrate and seed the local D1 the build prerenders from                                     |
| `vpr init:github`                   | one-time: create + push the GitHub repo (main + dev, dev default). Only when the user asks. |
| `vpr init:hosting`                  | one-time: provision hosting (dev D1/R2 + repo secrets). Only when the user asks.            |
| `vp exec vitops validate site.json` | schema-check the site config                                                                |

Shipping is not a package release: no changeset or version bump. Commit to `dev`, then promote.
(`vp` has no `vp change` command.)

`vp create` names the package after the target directory (pass `--directory <client-slug>`).
`wrangler.jsonc`'s `name`, D1 `database_name` and R2 `bucket_name` are separate and still say
`my-emdash-site`; rename them to match before the first deploy.
