This is an EmDash CMS website (Astro on Cloudflare Workers, D1 + R2 — public pages
prerendered, the Worker serving the admin and API) styled by the Vitops design system.

## Ground rules

- `site.json` is the single source of truth — organization + site facts, and
  the design system (colors, type, spacing, patterns, animations) under
  `designSystem.themes.default`. Never edit `src/styles/tailwind.css` — it is
  generated from `site.json` by the `vitops()` integration on every dev/build
  and is gitignored. (There is no separate `design-system.json`: a scaffolded
  config can't merely reference a sibling file, so the token set lives inside
  `site.json` — see `AGENTS.md`'s "Client onboarding" section in the toolchain
  repo for why.)
- `src/assets/placeholder/` holds neutral wireframe stand-ins (square,
  portrait, landscape; SVG + PNG) for layout work before real imagery
  exists. Delete the directory once real assets land — it's separate from
  `src/assets/logo.svg`, the actual brand asset.
- Content lives in the EmDash database, not in the repo. Query it with
  `getEmDashCollection` / `getEmDashEntry` from `emdash`; render Portable Text
  with `<PortableText />` from `emdash/ui` (the Vitops blocks from
  `@getvitops/emdash` are merged in automatically).
- **Building pages from patterns:** the editor's insert menu offers the `vitops.*` blocks —
  link/button, image compare, copy snippet, banner, disclosure, accordion, hero, carousel, gallery,
  cards, marquee (`vp exec vitops docs blocks` lists them with every field). Repeating content (cards, gallery images, accordion items, carousel slides) is
  a repeater field. A block cannot contain other blocks, and a `vitops.*` block inside EmDash's
  built-in `columns` does not render — for layout (a section, a split, a hero) use a `blocks`
  field, or hand-write the page template with `@getvitops/astro` components
  (`Subgrid`, `Cards`, `Carousel`, …). `vp exec vitops docs components` lists every pattern, which
  tiers provide it, and which block renders it. Override a block's rendering per site with
  `<PortableText components={{ type: { 'vitops.cards': MyCards } }} />`; hide one with
  `vitopsEmdash({ blocks: { exclude: [...] } })` in `astro.config.mjs`.
- `seed/seed.json` only applies against an empty database: structure
  (collections, menus, settings) on first boot; the `content` entries only
  when the setup wizard's "include sample content" option is chosen. Changing
  the seed does not migrate an existing site — use the admin
  (`/_emdash/admin`) or the site's MCP server (`/_emdash/api/mcp`) to change
  the content model of a running site.
- Prefer framework CSS classes (utilities, patterns, type roles like
  `font-heading`) over bespoke CSS. Run `vp exec vitops agents` to append the
  full generated class-vocabulary reference to this file.
- **Layout foundations — these are the answer, not a starting point.** Six
  substitutions carry the structure of nearly every page:

  | About to write…                                         | Write instead   |
  | ------------------------------------------------------- | --------------- |
  | a `wrap`/`wrapper`/`container`/`inner` class            | **`centered`**  |
  | `max-width` + `margin-inline: auto`                     | **`centered`**  |
  | `padding-block` on a section                            | **`region`**    |
  | margins between headings/paragraphs/lists               | **`rhythm`**    |
  | `display: grid` + `grid-template-columns: repeat(n, …)` | **`subgrid`**   |
  | `repeat(auto-fit, minmax(…))`                           | **`grid-auto`** |
  | `display: flex` + `gap` for a row of controls           | **`cluster`**   |

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

  `vpr lint:design` reports all of these, and the pre-commit hook fails on them
  — the fix is the class, not a justification for the CSS.

- **Rendering and freshness: everything is prerendered.** `output: 'server'` is
  still required (the admin, media/API routes and scheduled publishing need a
  Worker), but every public page — `index.astro`, `[...slug].astro`, `404.astro` —
  has `export const prerender = true`, and `[...slug].astro` lists the published
  `pages` entries in `getStaticPaths()`. The HTML is written at build time and
  served as a static asset; the Worker only handles `/_emdash/*` and anything
  you deliberately leave on-demand. A route with no `prerender` export is
  re-rendered on every request, so don't leave it off by accident.
  - **Where build-time content comes from.** The Cloudflare adapter prerenders
    against a _local_ D1 (`.wrangler/state`), never the deployed one — on a CI
    runner that is an empty database, which would bake "No home page yet" into
    every page. `scripts/pull-content.mjs` (the first step of `vpr deploy` and
    `vpr deploy:dev`) exports production's D1 and loads it locally first. It
    fails closed: a failed export aborts the deploy rather than publishing an
    empty site (the one exception is a database that doesn't exist yet, the first
    deploy, which builds from the seed). `SKIP_PULL_CONTENT=1` skips it.
  - **Freshness is a rebuild.** Production is the truth for content, and a page
    reflects it as of the last build. Publishing in the admin therefore has to
    trigger one: the deploy workflows listen for a `repository_dispatch` event of
    type `emdash-publish` (see "Publish-triggered rebuilds" below).
  - **Drafts and previews.** A prerendered page cannot show an unpublished
    draft, so an admin "Preview" link shows the last published build. If previews
    matter, add a dedicated on-demand route for them rather than removing
    `prerender` from the public ones.
  - **Dynamic parts are server islands.** Anything that must be fresh per request
    goes in its own component rendered with `server:defer` inside the prerendered
    page; the surrounding HTML stays static. Keep islands rare — each is a Worker
    request after load.
  - **Unknown URLs.** There is no `Astro.rewrite('/404')`: a slug not listed by
    `getStaticPaths()` has no route, so Astro serves the prerendered `404.html`
    with a real 404 status. Rewriting an on-demand route to a prerendered one
    fails (500), so don't reintroduce it.
- The Worker cron trigger in `wrangler.jsonc` drives scheduled publishing —
  don't remove it.
- Hosting (adapter + EmDash database/storage) comes from `vitopsHosting()`
  (`@getvitops/emdash`) in astro.config.mjs — never hard-code an adapter or
  d1/r2/sqlite there. Switch targets via `vitopsHosting({ target })` or the
  `HOSTING` env var (see README "Hosting"); the `node` target needs
  `@astrojs/node` + `better-sqlite3` installed first.
- **`SETUP.html` is the client-onboarding checklist.** When working it via the
  `.agents/skills/setup/` skill, tick a box only for a step you actually
  completed — never on the operator's behalf for a step marked human-only
  (the Cloudflare API token, the domain cutover, publishing legal documents).

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
  To replace them properly, fill in `site.json`'s `organization`/`site.legal`
  fields and run `vp exec vitops legal --format portable-text --out ./legal`, then
  paste each document's blocks into the page in the admin. That renders a real
  policy from what the site actually does — the analytics provider it uses,
  the fields its forms collect, where it deploys — rather than from guesses.
  It still needs review before launch.

## EmDash 1.x behaviours worth knowing

- **Passkeys are bound to the hostname they were created on.** After the
  workers.dev → custom-domain cutover, use **Settings → General → Change
  domain**, then **Continue on** to add a passkey at the new address.
- **HTML blocks created in the admin run JavaScript** in a sandboxed iframe
  (Contributor and up can add it). Astro's `security.csp` blocks their styles
  and scripts, so don't turn CSP on without allowing for that.
- **Link entries by `entry.data.slug`, never `entry.id`** — on multilingual
  sites `id` carries a locale prefix.
- **Submit `/sitemap.xml`** to search engines, not a per-collection sitemap;
  collection sitemaps now split into pages of 2,000 entries.
- **A stuck D1 migration lock** is cleared with
  `vp exec emdash migrate --take-over-lock <id>` (confirms the target, or
  needs `--expected-target-fingerprint` non-interactively).

## Docs MCP servers

`.mcp.json` preconfigures the Astro docs and EmDash docs MCP servers — prefer
searching them over pre-trained knowledge for Astro/EmDash questions.

## Labels: badge and tag

Two label patterns, both enabled in `site.json`'s `patterns.items`: **`badge`** is a
static label (a status, count or category) and **`tag`** is a label that may be
static _or_ dynamic (editable, dismissable, in a `tag-list`). Don't invent a third
name — `chip` and `pill` are not part of this vocabulary. The button pattern's class
is `btn` (`<a class="btn">` is styled, not just a bare `<button>`).

## Custom blocks

Before adding a block type, a `src/components/blocks/*` renderer, or anything an
editor places on a page, read `.agents/skills/custom-blocks/SKILL.md`: compose the
existing `vitops.*` blocks first, extend one second, go site-local third, upstream
last. Block types can't be renamed or deleted once pages use them, so check the
framework's pattern names before choosing one.

## Publish-triggered rebuilds

Pages are static, so a publish in the admin goes live only after a rebuild.
`.github/workflows/deploy-prod.yml` also runs on a `repository_dispatch` event of
type `emdash-publish` (it pins `ref` to `main`, because a dispatch runs from the
default branch, `dev`). Wire an EmDash plugin hook to send it:

```jsonc
// emdash-plugin.jsonc
"capabilities": ["content:read", "network:request"],
"allowedHosts": ["api.github.com"]
```

```ts
// src/plugin.ts
hooks: {
  'content:afterPublish': async (_event, ctx) => {
    const token = await ctx.settings.get<string>('githubToken'); // an encrypted plugin setting
    if (!token || !ctx.http) return;
    await ctx.http.fetch(`https://api.github.com/repos/${OWNER}/${REPO}/dispatches`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
      body: JSON.stringify({ event_type: 'emdash-publish' }),
    });
  },
}
```

The token is a fine-grained GitHub token with `Contents: write` on this repo only,
stored as the plugin's encrypted setting (a sandboxed plugin can't read Worker
environment variables), never in the repo. The hook name, capabilities and
`ctx.http` / `ctx.settings` calls follow EmDash's plugin reference but this exact
plugin has not been run against a live site, so treat it as a starting point. Two
costs to know: the run goes through the `production` environment, so it **waits for
the reviewers' approval** like any prod deploy (relax that rule if editors' publishes
should go live unattended), and bursts of publishes queue behind the
`deploy-prod` concurrency group rather than cancelling each other. Without the hook,
a manual run of **Deploy prod** (or a push to `main`) does the same job.

## Content Security Policy

`public/_headers` ships a **`Content-Security-Policy-Report-Only`** header: it logs
violations to the browser console and blocks nothing, so it can't break a page. Its
`script-src` is `'self'` plus the SHA-256 of each inline script `<Head />` emits (the
colour-scheme bootstrap and the consent-gate stub) — no `'unsafe-inline'`. Hashes,
not nonces, because prerendered pages have no per-request response to put a nonce in.
`contentSecurityPolicy()` and `inlineScriptHashes()` from `@getvitops/astro` produce
the same strings (`templates.test.ts` in the toolchain keeps the file in step).

Know what it does not cover before you flip it to enforcing (rename the header to
`Content-Security-Policy`):

- **`_headers` applies to static assets only.** Worker-rendered responses — the EmDash
  admin (`/_emdash/*`), its API, anything left on-demand — don't get it. Setting a
  header there means doing it in code (e.g. Astro middleware calling
  `contentSecurityPolicy()`), and the admin's own inline scripts and editor HTML
  would need allowing; leave the admin out of an enforced policy.
- **Editor-authored HTML blocks are the hard limit.** Any block that lets an editor
  paste raw HTML or a `<script>` (an embed, a tracking snippet) puts arbitrary inline
  script on the page, which a hash policy cannot name ahead of time. Enforcing a strict
  policy means removing such blocks or moving embeds to a consent-gated
  `data-consent` tag whose origin you allow explicitly.
- **Third-party tags** the consent gate activates need their origins in `script-src`
  / `connect-src`; anything with `frame` needs `frame-src`.
- **A server island** (`server:defer`) adds an inline loader script and a request to
  the Worker; expect a report for the loader until you hash it.

Run the site, browse the pages you ship with the console open, fix or allow what is
reported, and only then enforce.

## EmDash agent skills

The EmDash skills (`building-emdash-site`, `creating-plugins`, `emdash-cli`,
`upgrading-emdash` and the two WordPress porting skills) are installed per
project, not globally, so they match the `emdash` version this repo pins. If
`.agents/skills/building-emdash-site/` is missing, install them (the setup guide
and `SETUP.html` have the full step):

```bash
vp dlx skills add emdash-cms/skills --skill '*' -y
```

Refresh them with `vp dlx skills update` after bumping `emdash` — the
`upgrading-emdash` skill covers the rest of the upgrade.

## Commands

This is a **Vite+** project: use `vp` (and its `vpr` shorthand), not `pnpm`/`npm`/`npx`.
The package manager underneath is pnpm, but `vp` picks it up for you.

| To…                                      | Run                                                     |
| ---------------------------------------- | ------------------------------------------------------- |
| install dependencies                     | `vp install`                                            |
| add / remove / update a package          | `vp add <pkg>` · `vp remove <pkg>` · `vp update`        |
| run a `package.json` script              | `vpr <script>` (alias for `vp run <script>`)            |
| run a locally installed binary           | `vp exec <bin>` (e.g. `vp exec vitops docs components`) |
| run a one-off package without installing | `vp dlx <pkg>`                                          |
| format + lint + typecheck (files)        | `vp check`                                              |
| typecheck Astro (`.astro` files)         | `vpr typecheck`                                         |

**Scripts that wrap Astro must go through `vpr`.** `vp dev` / `vp build` run Vite
directly and skip Astro, so use `vpr dev`, `vpr build`, `vpr preview`.

**`vpr dev` returns immediately.** `astro dev` now starts the server in the
background. Check it with `vp exec astro dev status`, read its output with
`vp exec astro dev logs --follow`, and stop it with `vp exec astro dev stop`; the
site is at <http://localhost:4321>. Don't wait on it as if it were a foreground
process.

| Script                              | What it does                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `vpr dev`                           | local dev with local D1/R2 emulation (no Cloudflare account)                                |
| `vpr deploy`                        | pull production content, build, `wrangler deploy` prod (provisions D1/R2 on first run)      |
| `vpr deploy:dev`                    | same, for the isolated dev worker (needs `DEV_D1_ID`)                                       |
| `vpr pull-content`                  | just the content pull (see "Rendering and freshness")                                       |
| `vpr init:github`                   | one-time: create + push the GitHub repo (main + dev, dev default). Only when the user asks. |
| `vpr init:hosting`                  | one-time: provision hosting (dev D1/R2 + repo secrets). Only when the user asks.            |
| `vp exec vitops validate site.json` | schema-check the site config                                                                |

**Release flow.** A site is not a published package, so there is no changeset or
version bump: ship by committing to `dev` (auto-deploys the dev worker) and then
running the **promote** workflow. `vp` has no `vp change` / `vp pm change` command
(checked against vp 1.5.0); for a _package_ it does have `vp pm version`,
`vp pm publish` and `vp pm stage`.

**Naming the project.** `vp create` takes the package name from the target
directory and invents a random slug when none is given, so pass one:
`vp create @getvitops:emdash --directory <client-slug>`. `wrangler.jsonc`'s
`name`, D1 `database_name` and R2 `bucket_name` are separate and still say
`my-emdash-site` — rename them to match before the first deploy.
