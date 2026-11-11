<!-- vitops:start -->

Built with the Vitops design system (`@getvitops/*`); tokens and site facts live in `site.json`.
Prefer its classes and patterns over hand-written CSS. Load the skill that matches the task:

- [vitops-ads](.agents/skills/vitops-ads/SKILL.md) — Use when adding or changing a Google/Meta/LinkedIn/TikTok/Microsoft/Reddit/Pinterest/Snapchat pixel
- [vitops-consent](.agents/skills/vitops-consent/SKILL.md) — Use before gating, adding or changing any non-essential third-party tag, cookie, embed
- [vitops-csp](.agents/skills/vitops-csp/SKILL.md) — Use when changing `public/_headers`, adding an embed, tracking snippet or third-party script, turning the CSP on
- [vitops-design-system](.agents/skills/vitops-design-system/SKILL.md) — Use when styling or authoring pages or components (choosing utility/pattern classes, colours, spacing, typography)
- [vitops-see-the-page](.agents/skills/vitops-see-the-page/SKILL.md) — How to look at a rendered page of this site

Reference, rendered from this project: `vp exec vitops docs [topic]` (no topic lists them).
<!-- vitops:end -->

This is a static Astro website styled by the Vitops design system, deployed as Cloudflare Workers
static assets (no server runtime, no database).

## Ground rules

- `site.json` is the single source of truth: organization + site facts, and the design system under
  `designSystem.themes.default`. Never edit `src/styles/`: it is generated from `site.json` on every
  dev/build and gitignored.
- Every page is prerendered (`output: 'static'`): nothing can read request-time data (cookies,
  headers, query params). A page that needs that needs an adapter and a different template.
- Prefer framework classes (utilities, patterns, type roles like `font-heading`) over bespoke CSS.
  `vpr lint:design` fails the pre-commit hook on unresolvable classes and layout primitives you
  hand-rolled (`centered`, `region`, `rhythm`, `subgrid`, `grid-auto`, `cluster` exist for those).
- `src/assets/placeholder/` is wireframe stand-in imagery; delete it once real assets land.
- `SETUP.html` is the onboarding checklist (the `setup` skill). Tick a box only for a step you
  completed, never for a human-only one (the Cloudflare API token, domain cutover, legal documents).

## Branches

Work on **`dev`**; every push auto-deploys the isolated `-dev` worker. **`main`** is production and
protected: never push or merge to it directly; production ships only through the manual `promote`
workflow (`.github/workflows/promote.yml`), only when the user explicitly asks. Shipping is not a
package release: no changeset or version bump.

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
- **Reference** for this project's own tokens, classes and config: `vp exec vitops docs`.
