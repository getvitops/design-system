<!-- vitops:start -->

Built with the Vitops design system (`@getvitops/*`); tokens and site facts live in `site.json`.
Prefer its classes and patterns over hand-written CSS. Load the skill that matches the task:

- [emdash-building-pages](.agents/skills/emdash-building-pages/SKILL.md) — Use when authoring or changing a page's layout or content on this EmDash site — composing `vitops_*` blocks
- [emdash-contact-form](.agents/skills/emdash-contact-form/SKILL.md) — Use when adding or changing a form, fixing submissions that don't arrive, setting up notifications, CRM or Turnstile
- [emdash-content-and-deploys](.agents/skills/emdash-content-and-deploys/SKILL.md) — Use for any deploy or build problem, stale or missing content, "my publish isn't live", scheduled posts, previews
- [emdash-custom-blocks](.agents/skills/emdash-custom-blocks/SKILL.md) — Use before creating, renaming or deleting any block type, any `src/components/blocks/*` renderer
- [vitops-ads](.agents/skills/vitops-ads/SKILL.md) — Use when adding or changing a Google/Meta/LinkedIn/TikTok/Microsoft/Reddit/Pinterest/Snapchat pixel
- [vitops-consent](.agents/skills/vitops-consent/SKILL.md) — Use before gating, adding or changing any non-essential third-party tag, cookie, embed
- [vitops-csp](.agents/skills/vitops-csp/SKILL.md) — Use when changing `public/_headers`, adding an embed, tracking snippet or third-party script, turning the CSP on
- [vitops-design-system](.agents/skills/vitops-design-system/SKILL.md) — Use when styling or authoring pages or components (choosing utility/pattern classes, colours, spacing, typography)
- [vitops-see-the-page](.agents/skills/vitops-see-the-page/SKILL.md) — How to look at a rendered page of this site

Reference, rendered from this project: `vp exec vitops docs [topic]` (no topic lists them).
<!-- vitops:end -->

This is an EmDash CMS website (Astro on Cloudflare Workers, D1 + R2: public pages prerendered, the
Worker serving the admin and API) styled by the Vitops design system.

## Ground rules

- `site.json` is the single source of truth: organization + site facts, and the design system under
  `designSystem.themes.default`. Never edit the generated stylesheet (`src/styles/tailwind.css`,
  rebuilt from `site.json` on every dev/build, gitignored); put your own CSS in a separate file
  (e.g. `src/site.css`, imported from the layout) and commit it.
- Content lives in the EmDash database, not the repo. Read it with `getEmDashCollection` /
  `getEmDashEntry` from `emdash`; render Portable Text with `<PortableText />` from `emdash/ui`.
- **Where truth lives:** content (entries, media, menus) is **production's**, edited there; code,
  `site.json` and schema are **git's** (`dev` → `main`). The dev database is a disposable copy
  refreshed from prod, never promoted back.
- `seed/seed.json` applies only to an empty database. To change a running site's content model, use
  the admin (`/_emdash/admin`) or its MCP server (`/_emdash/api/mcp`).
- Hosting comes from `vitopsHosting()` in `astro.config.mjs`; never hard-code an adapter or
  d1/r2/sqlite. Keep the Worker cron trigger in `wrangler.jsonc`: it publishes scheduled content.
- Prefer framework classes (utilities, patterns, type roles like `font-heading`) over bespoke CSS.
  `vpr lint:design` fails the pre-commit hook on unresolvable classes and layout primitives you
  hand-rolled (`centered`, `region`, `rhythm`, `subgrid`, `grid-auto`, `cluster` exist for those).
- `src/assets/placeholder/` is wireframe stand-in imagery; delete it once real assets land.
- Sample legal pages (`/terms`, `/privacy`) are deliberately short, unfinished placeholders; don't
  "improve" them into something that reads as a finished policy.
- `SETUP.html` is the onboarding checklist (the `setup` skill). Tick a box only for a step you
  completed, never for a human-only one (the Cloudflare API token, domain cutover, legal documents).

## Branches

Work on **`dev`**; every push auto-deploys the isolated `-dev` worker. **`main`** is production and
protected: never push or merge to it. It ships only through the `promote` skill, and only when the
user explicitly asks. Shipping is not a package release: no changeset or version bump.

## Commands

This is a **Vite+** project: use `vp` (and `vpr` for scripts), not `pnpm`/`npm`/`npx`. Scripts that
wrap Astro go through `vpr` (`vpr dev`, `vpr build`), because `vp dev`/`vp build` skip Astro.
`vpr dev` returns immediately (the server runs in the background): check it with
`vp exec astro dev status`, read `vp exec astro dev logs --follow`, stop with
`vp exec astro dev stop`; the site is at <http://localhost:4321>. `package.json` lists the scripts;
`vp check` and `vpr typecheck` verify a change. `vpr init:github` and `vpr init:hosting` are one-time
setup, only when the user asks.

## Where to look

- **Skills** are listed in the block at the top; load the one matching the task before starting.
- **Reference** for this project's own tokens, classes, blocks and config: `vp exec vitops docs`.
- `.mcp.json` preconfigures the Astro and EmDash docs MCP servers; search them before relying on
  pre-trained knowledge. The EmDash skills (`building-emdash-site`, `emdash-cli`, …) are installed
  per project to match the pinned `emdash`; if `.agents/skills/building-emdash-site/` is missing:
  `vp dlx skills add emdash-cms/skills --skill '*' -y`.
- **Improving the toolkit:** when you work around a framework built-in, add bespoke CSS or a
  site-local block, or find a doc wrong or missing, and the need is **not** unique to this site,
  record it in `UPSTREAM.md` at the repo root: what you tried, what failed or was missing, the
  workaround (file path), the change you'd propose, and the package. Mention new entries in your
  end-of-task summary. Never patch `node_modules`.
