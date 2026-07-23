# Design-system TODO

Context: one shared design-system schema (`src/design-system.json`) drives every site we
build — WordPress/Bricks **and** Cloudflare EmDash (Astro/Tailwind). Keep tokens and pattern
names platform-agnostic so the same schema round-trips through both the Bricks generators and
the Tailwind (`--format=tailwind`) output.

## Patterns: consolidate to `badge` + `chip` only

- Keep **`badge`** (status/label pill) and **`chip`** (compact rounded token) as the two
  small-label patterns.
- **Remove `tag`** as a separate pattern — fold its use-cases into `badge`/`chip`.
- **Remove `pill`-specific tokens** (e.g. `--br-pill`, the `radii.pill` primitive, and any
  `pill`-named variants). Badge/chip should reference their own radius (`--br-badge` /
  `--br-chip`), not a standalone `pill`.
- Audit downstream: `.tag` usages in `src/css/patterns/`, `typography.roles` (there's a `tag`
  type role), `patterns.groups.tag`, and `--br-chip: var(--br-tag,…)` fallbacks — all should
  be reconciled to badge/chip after the rename.

## Typography: fully fluid, Utopia-style

- Move the type scale to a proper **Utopia** (utopia.fyi) fluid model: a min type scale +
  ratio at a min viewport and a max type scale + ratio at a max viewport, interpolated with
  `clamp()` per step. (Today `typeScale` has `ratio` + `fluid.minRatio` but not a clean
  min/max-ratio-per-viewport Utopia pair.)
- Do the same for **space** (Utopia fluid space) so type and spacing share one fluid system.
- Constraint: the Bricks side generates these as **Variables** (via the Scale Generator /
  `generate-scale-variables`), and the Tailwind side emits `@theme` `--text-*`/`--spacing-*`.
  The Utopia model must express cleanly in both — verify the clamp math matches what Bricks'
  Scale Generator produces so imports round-trip.

## Astro integration (`@getvitops/astro`)

- **Semantic icon mapping → the integration.** Components currently take an `iconResolver` prop
  (semantic name like `expand-more`/`close` → a fully-qualified `astro-icon` name like
  `fa7-solid:chevron-down`), defaulting to pass-through. Move this mapping into the `getvitops()`
  integration so it's provided centrally (per-site) rather than threaded through every component.
- ~~**Ship the generic component tier.**~~ Done — the framework-agnostic content/HTML helpers moved
  to `@getvitops/utils`, and the generic primitives export at `@getvitops/astro/components/*`:
  `Subgrid`, `Cards`, `NodeRenderer`, `WebComponentLoader`, plus `Popover`/`Details`/`Drawer`
  (optional `astro-icon` peer). Config-bound chrome (`Template`/`SEO`/`ContentInfo`/`FormRenderer`)
  stays out of the generic library.
- **Decouple `Nav`/`Submenu` and ship them too.** They're still internal — coupled to `#site-config`
  plus the `../utils/images` + `../utils/icon-resolver` pipeline (the latter is the semantic-icon
  mapping above). Route them through the EmDash menus/widgets integration rather than a one-line
  `defaultLocale` prop default; export once that resolves.

## EmDash editing portal (`@getvitops/emdash`)

- ~~**Map the component tiers into EmDash's editor.**~~ v1 done — `@getvitops/emdash` is an EmDash
  **native plugin**: `admin.portableTextBlocks` puts 5 flat-field patterns in the editor's slash
  menu (`vitops.imageCompare`/`copyButton`/`banner`/`details`/`carousel`), and the
  `componentsEntry` (`@getvitops/emdash/astro` → `blockComponents`) renders them via `<PortableText>`
  with the `wc-*` tags + accessible fallbacks. Composes with `getvitops()` (CSS + WC bundles);
  dogfooded in `apps/portal` (`/_emdash/admin`, rendered at `/cms/[slug]`).
- **Adopt in vitops-website.** `/home/alex/dev/vitops-website` (the real site: EmDash on :4321,
  GitHub `authProviders`, Cloudflare D1/R2) is on `emdash@^0.28.1` + published
  `@getvitops/astro@0.1.1` — too old for the plugin (peer `>=0.31.0`, descriptor format changed).
  Steps: upgrade its `emdash` → 0.31.x, bump `@getvitops/astro` → 0.3.1, add
  `@getvitops/emdash@0.1.0` (published 2026-07-23), register `vitopsEmdash()` in its `emdash()`
  plugins array.
- **v2 backlog:**
  - `page:metadata` hook emitting JSON-LD from the shared builders now in
    `packages/utils/src/schema/` (`articleGraph`/`organizationGraph`/`breadcrumbGraph`/`faqGraph`;
    the remaining ~20 `schemas/*.astro` can be extracted the same way as needed).
  - Repeating-data patterns (Cards/Subgrid, `wc-entries`, FAQ, forms): seeded **Sections** in a
    starter theme + documented Field Kit `list`-widget recipes rendered via
    `Cards.astro`/`NodeRenderer.astro` — flat Block Kit PT fields can't express them.
  - `widgetComponents` map + documented `WidgetRenderer` pattern for widget areas.
  - EmDash `getMenu()` → `Nav` adapter (blocked on the Nav decoupling above).
  - Carousel field UX: replace the newline-separated-URLs workaround if EmDash grows
    media-picker/repeater PT block fields.
  - Pin the `emdash` peer range per tested version (currently `>=0.31.0`, verified on 0.31.0).

---

See **`DESIGN-SYSTEM-GAPS.md`** for the token-level gaps found while reproducing the Home
page (border/hairline token, radii→token bricks-gating, button base, `.flex` fix, etc.).
