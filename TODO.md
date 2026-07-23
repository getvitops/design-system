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

---

See **`DESIGN-SYSTEM-GAPS.md`** for the token-level gaps found while reproducing the Home
page (border/hairline token, radii→token bricks-gating, button base, `.flex` fix, etc.).
