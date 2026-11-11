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
  `font-heading`) over bespoke CSS. `vp exec vitops docs classes` prints the
  full class vocabulary.
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

## Labels: badge and tag

Two label patterns, both enabled in `site.json`'s `patterns.items`: **`badge`** is a
static label (a status, count or category) and **`tag`** is a label that may be
static _or_ dynamic (editable, dismissable, in a `tag-list`). Don't invent a third
name — `chip` and `pill` are not part of this vocabulary. The button pattern's class
is `btn` (`<a class="btn">` is styled, not just a bare `<button>`).

## Content Security Policy

`public/_headers` ships a **`Content-Security-Policy-Report-Only`** header for every
page (they are all static assets): violations are logged to the browser console and
nothing is blocked, so it can't break a page. Its `script-src` is `'self'` plus the
SHA-256 of each inline script `<Head />` emits (the colour-scheme bootstrap and the
consent-gate stub), with no `'unsafe-inline'`. `contentSecurityPolicy()` and
`inlineScriptHashes()` from `@getvitops/astro` produce the same strings.

Before enforcing it (rename the header to `Content-Security-Policy`), browse the pages
with the console open: add the origins of any third-party tag the consent gate
activates to `script-src` / `connect-src`, any embed to `frame-src`, and hash any
inline script you add yourself. Hashes rather than nonces because a static page has no
per-request response to carry one.

## Skills

`@getvitops/skills` ships agent skills that update with the package. `skills experimental_sync` (run
by `prepare`, so by `vp install`) links them into `.agents/skills/` and `.claude/skills/`; they are
gitignored. The set is written for EmDash sites, so `csp` is the one that applies here. To look at a rendered page, use `playwright-cli`
(`see-the-page` skill), never a browser extension or MCP server. A skill you
write yourself with the same name is never replaced. `setup` is this site's own.

## Commands

This is a **Vite+** project: use `vp` (and its `vpr` shorthand), not `pnpm`/`npm`/`npx`.
The package manager underneath is pnpm, but `vp` picks it up for you.

| To…                                      | Run                                                  |
| ---------------------------------------- | ---------------------------------------------------- |
| install dependencies                     | `vp install`                                         |
| add / remove / update a package          | `vp add <pkg>` · `vp remove <pkg>` · `vp update`     |
| run a `package.json` script              | `vpr <script>` (alias for `vp run <script>`)         |
| run a locally installed binary           | `vp exec <bin>` (e.g. `vp exec vitops docs classes`) |
| run a one-off package without installing | `vp dlx <pkg>`                                       |
| format + lint + typecheck (files)        | `vp check`                                           |
| typecheck Astro (`.astro` files)         | `vpr typecheck`                                      |

**Scripts that wrap Astro must go through `vpr`.** `vp dev` / `vp build` run Vite
directly and skip Astro, so use `vpr dev`, `vpr build`, `vpr preview`.

**`vpr dev` returns immediately.** `astro dev` now starts the server in the
background. Check it with `vp exec astro dev status`, read its output with
`vp exec astro dev logs --follow`, and stop it with `vp exec astro dev stop`; the
site is at <http://localhost:4321>. Don't wait on it as if it were a foreground
process.

| Script                                    | What it does                                                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `vpr dev`                                 | local dev                                                                                                                           |
| `vpr build:css`                           | regenerate the framework CSS from `site.json`                                                                                       |
| `vpr deploy`                              | build + `wrangler deploy` to prod                                                                                                   |
| `vpr deploy:dev`                          | build + deploy the isolated dev worker                                                                                              |
| `vpr init:github`                         | one-time: create + push the GitHub repo (main + dev, dev default, branch protection + environment policy). Only when the user asks. |
| `vpr init:hosting`                        | one-time: read the Cloudflare account id and set it as a repo secret. Only when the user asks.                                      |
| `vp exec vitops validate site.json`       | schema-check the site config                                                                                                        |
| `vp exec vitops lint -i site.json -f css` | find framework classes in source that resolve to nothing under this format                                                          |

**Release flow.** A site is not a published package, so there is no changeset or
version bump: ship by committing to `dev` (auto-deploys the dev worker) and then
running the **promote** workflow. `vp` has no `vp change` / `vp pm change` command
(checked against vp 1.5.0); for a _package_ it does have `vp pm version`,
`vp pm publish` and `vp pm stage`.

**Naming the project.** `vp create` takes the package name from the target
directory and invents a random slug when none is given, so pass one:
`vp create @getvitops:static --directory <client-slug>`. `wrangler.jsonc`'s `name`
is separate and still says what the template shipped — rename it to match before
the first deploy.
