# Design-system TODO

Context: one shared design-system schema (`src/design-system.json`) drives every site we
build — WordPress/Bricks **and** Cloudflare EmDash (Astro/Tailwind). Keep tokens and pattern
names platform-agnostic so the same schema round-trips through both the Bricks generators and
the Tailwind (`--format=tailwind`) output.

## Patterns: `badge` + `tag` only — ✅ done

Superseded an earlier plan that kept `badge` + `chip` and dropped `tag`. The split is now by
**behaviour**, not by size:

- **`badge`** — a **static** label (status, count, category). Not interactive.
- **`tag`** — an **editable and/or dismissable** label or item (e.g. entries in a filter list),
  with `.tag__remove` / `.tag__icon` sub-parts.
- **`chip` is retired** as vocabulary. `.chip-list` became `.tag-list`, and its bespoke
  `__chip` / `__chip-remove` sub-parts were deleted in favour of the existing `.tag` /
  `.tag__remove` — a tag list is a list of tags. The redundant `radii.chip` primitive (which
  was only ever an alias of `--br-tag`) is gone.

Still open:

- **Remove `pill`-specific tokens** (`--br-pill`, the `radii.pill` primitive). Badge should
  reference its own radius (`--br-badge`) rather than a standalone `pill`. Note `--br-pill` is
  still referenced by `forms.css` (switch track), `list.css` (count) and `tag.css`
  (badge-indicator), and the `, 999px` fallbacks are **live in the bricks format**, where
  `patterns.radii` is not emitted (`generate.ts:367`).
- `typography.roles` has a `tag` type role, unrelated to the `tag` pattern — worth
  disambiguating.

Resolved along the way: the `tag` **group** was renamed to **`label`**. Previously the `tag`
pattern and the `tag` group both compiled to `--{p,br,b,ds,fs}-tag`, so the pattern's override
hook and the group token were the same variable and the pattern's `-group` alias was
unreachable. Group tokens are now `--<prop>-label`, leaving `--<prop>-tag` free as the `tag`
pattern's own hook. Members: `badge`, `tag`, `status`, `tooltip`.

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
- ~~**Decouple `Nav`/`Submenu` and ship them too.**~~ Resolved by deletion (2026-07-27). The whole
  `#site-config` subtree — `Nav`, `Submenu`, `SEO`, `Template`, `FormRenderer`, `ContentInfo`,
  `Layout`, plus `utils/{icon-resolver,env,contact,images}` — was removed: `#site-config` was
  defined nowhere, none of it was in `files`/`exports`, and it had rotted. Recover from `201bfb9`
  if a site model is wanted again, but rebuild it taking **config as an argument** (not a global
  module import) and typed against `SiteConfig` from `@getvitops/generator`.

## EmDash editing portal (`@getvitops/emdash`)

- ~~**Map the component tiers into EmDash's editor.**~~ v1 done — `@getvitops/emdash` is an EmDash
  **native plugin**: `admin.portableTextBlocks` puts 5 flat-field patterns in the editor's slash
  menu (`vitops.imageCompare`/`copyButton`/`banner`/`details`/`carousel`), and the
  `componentsEntry` (`@getvitops/emdash/astro` → `blockComponents`) renders them via `<PortableText>`
  with the `wc-*` tags + accessible fallbacks. Composes with `getvitops()` (CSS + WC bundles);
  dogfooded in `apps/portal` (`/_emdash/admin`, rendered at `/cms/[slug]`).
- ~~**Adopt in vitops-website.**~~ Done 2026-07-24: `/home/alex/dev/vitops-website` on
  `emdash@^0.31.0` + `@getvitops/astro@^0.4.0` (`css.inject: false`; PineLayout imports the
  stylesheet so `/_emdash/admin` stays unstyled) + `@getvitops/emdash@^0.1.0` registered in the
  `emdash()` plugins array; deployed to dev.vitops.ca (push to `dev` → deploy-dev workflow) and
  verified: editor loads, slash menu shows the 5 vitops blocks. Note: the deployed D1s (`vitops`,
  `vitops-dev`) had a `pages` collection with **zero field rows** — fields were added on dev via
  the admin Content Types UI (`title` string required, `content` portableText, matching
  `seed/seed.json`); prod's `vitops` D1 still lacks them (fix the same way when promoting).
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

- ~~Output format for Google's DESIGN.md format https://github.com/google-labs-code/design.md~~
  — done: `vitops generate --format design` (`packages/generator/src/design-md.ts`), plus the
  root `DESIGN.md` via `npx vp run build:design`. Deferred from it: a **DESIGN.md → config
  importer** (`design.md` as an _input_, seeding `design-system.json` from a brand brief) and a
  `diff` gate in CI. See the deferred DTCG/OKF plan in `PLAN.md` for the wider framing — its
  Phase 3 (OKF bundle) is already live as `docs/`.
