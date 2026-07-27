# @getvitops/astro

## 0.7.0

### Minor Changes

- 44de07f: Split the button pattern into two tiers named by intent: `.cta` (persuasion) and `.btn`
  (affordance).

  **Breaking: a bare `<button>` is no longer a filled brand-primary button.** It now renders as a
  quiet interactive control — geometry, cursor, subtle hover, focus ring — with no fill, no
  `font-weight: 600`, and no shadow.

  **Migration:** add `class="cta"` to any button that should stay prominent. Submit buttons, hero
  actions, and anything driving a conversion are the usual candidates; dialog closes, toolbar
  buttons, icon buttons and toggles should keep the new default. If you want the old behaviour
  globally, set `patterns.items.btn` in your `design-system.json` back to the previous filled base.

  New in this release:
  - **`.cta`** — filled, bolder, roomier, lifts on hover. It is a class, not an element rule, so it
    finally works on `<a>` — which is what a call to action usually is, since it navigates. Role
    variants: `.cta-{success,danger,warning,info}`.
  - **`.btn`** — the affordance tier. Emitted as one zero-specificity `:where(button, .btn)` rule, so
    a bare `<button>` gets it with no class, `.btn` carries it to any other tag, and any explicit
    class (including `.cta`, or a component's own class) overrides it without `!important`.
  - **`:where(a, .link)`** — the link pattern now pairs its element with a class the same way.
  - A pattern may now set **both `element` and `class`**, emitting one combined
    `:where(<element>, .<class>)` rule. This is the general mechanism behind the above.
  - A pattern may declare **`fill: true|false`** to state whether states and role variants drive
    `background-color` (plus `on-solid` text) or `color`, instead of relying on the previous
    inference from the pattern's name and base declarations. Existing configs are unaffected — the
    old inference is still the fallback.

  **Breaking: `chip` is retired as vocabulary.** The two small-label patterns are now split by
  behaviour, not size: **`badge`** is a _static_ label (status, count, category) and **`tag`** is an
  _editable and/or dismissable_ one (e.g. entries in a filter list).
  - `.chip-list` → **`.tag-list`**, and its `--*-chip-list` / `--chip-list-focus-color` tokens →
    `--*-tag-list` / `--tag-list-focus-color`.
  - `.chip-list__chip` and `.chip-list__chip-remove` are **removed**. A tag list is a list of tags, so
    its items are now the existing `.tag` / `.tag__remove` — which also means they pick up tag role
    variants. **Migration:** replace `<span class="chip-list__chip">x <button
class="chip-list__chip-remove">` with `<span class="tag">x <button class="tag__remove">`. Note the
    items change appearance: `.tag` is outlined (border + neutral text) where the old chip was filled
    with `--color-surface-muted`.
  - The `radii.chip` primitive is **removed** from the example config; it was only ever an alias of
    `--br-tag`. Consumers who set `--br-chip` should use `--br-tag`.

  **Pattern geometry now resolves through the group alias layer.** Every grouped pattern already
  emitted `--<prop>-<name>-group` aliases (e.g. `--br-btn-group: var(--br-control)`), but most
  patterns bypassed them and hard-coded `var(--br-control, …)` into the rule. `btn`, `cta`, `badge`,
  `tag`, `card` and `status` now reference the alias and restate only their deviations via
  `overrides`, so the whole chain — `--p-btn` → `--p-btn-group` → `--p-control` → `--p-default` — is
  live CSS custom properties, inspectable and editable in the browser. Computed values are unchanged.

  Also fixed:
  - Role variants on element patterns were emitted at specificity 0-1-1 (`button.danger`), which
    outranked any plain class. They now emit as `:where(button, .btn).danger, .btn-danger` — both at
    class specificity, and reachable from a non-`<button>` host.
  - The `link` pattern declared `default_role: "brand-primary"` while hard-coding a `ui-primary` base
    colour, so hovering shifted hue instead of intensifying. Its `default_role` is now `ui-primary`.
  - `@getvitops/astro`'s `FormRenderer` defaulted its submit button to `class="btn btn-primary"`, a
    class that never existed and a role that is not emitted; it now defaults to `.cta`.
  - The Tailwind bundle is no longer assembled during `css` / `bricks` builds, where it was computed
    and discarded (it also read every framework partial off disk).

### Patch Changes

- @getvitops/core@0.7.0
- @getvitops/generator@0.7.0
- @getvitops/utils@0.7.0
- @getvitops/vite@0.7.0

## 0.4.2

### Patch Changes

- Updated dependencies [2cc847d]
  - @getvitops/generator@0.6.0
  - @getvitops/vite@0.6.0
  - @getvitops/core@0.6.0
  - @getvitops/utils@0.6.0

## 0.4.1

### Patch Changes

- Updated dependencies
  - @getvitops/generator@0.5.0
  - @getvitops/vite@0.5.0
  - @getvitops/core@0.5.0
  - @getvitops/utils@0.5.0

## 0.4.0

### Minor Changes

- 54a06e9: Add `css.inject` option to `getvitops()` (default `true`). Set `inject: false` to stop the global `page-ssr` stylesheet injection and import the generated CSS from your site layout instead — needed when other integrations add routes that must not inherit the design system (e.g. EmDash's `/_emdash/admin`, which the auto-injected CSS was bleeding into).

## 0.3.1

### Patch Changes

- d7e6491: Extract schema.org JSON-LD graph builders (articleGraph/organizationGraph/breadcrumbGraph/faqGraph) into @getvitops/utils so platform hooks (e.g. the new @getvitops/emdash plugin's future page:metadata contributions) can share them; the corresponding schemas/\*.astro become thin wrappers. Also removes Layout.astro's import of the deleted Polyfills.astro.
- Updated dependencies [d7e6491]
  - @getvitops/utils@0.4.0
  - @getvitops/core@0.4.0
  - @getvitops/generator@0.4.0
  - @getvitops/vite@0.4.0

## 0.3.0

### Minor Changes

- Extract the framework-agnostic content model + HTML helpers into `@getvitops/utils`
  (new `content`/`html` exports: `Elmnt`/`Link`/`ContentNode` types + guards, `t`,
  `partAttrs`, `parseRenderedSlots`, `toHtml`, `nodesToHtml`, `styleList`, …), and ship
  the generic Astro component tier from `@getvitops/astro/components/*`: `Subgrid`,
  `Cards`, `NodeRenderer`, `WebComponentLoader`, plus `Popover`/`Details`/`Drawer`
  (the latter three use `astro-icon`, now declared as an optional peer). Config-bound
  chrome (Template/SEO/ContentInfo/FormRenderer/Nav/Submenu) stays internal pending the
  EmDash integration.

### Patch Changes

- Updated dependencies
  - @getvitops/utils@0.3.0
  - @getvitops/core@0.3.0
  - @getvitops/generator@0.3.0
  - @getvitops/vite@0.3.0

## 0.2.0

### Minor Changes

- 4d89eca: Add Schema.org / JSON-LD structured-data components, exported at `@getvitops/astro/schemas/*`
  (`Article`, `Organization`, `LocalBusiness`, `Product`, `Review`, `Event`, `FAQ`, `Recipe`,
  `Breadcrumb`, `JobPosting`, and more) — each emits a typed `<script type="application/ld+json">`
  block at SSR time with no runtime JS. `Head.astro` moved to `src/components/` (the public
  `@getvitops/astro/Head.astro` import is unchanged).

## 0.1.1

### Patch Changes

- Updated dependencies [d28aae7]
  - @getvitops/generator@0.2.1
  - @getvitops/vite@0.2.1
  - @getvitops/core@0.2.1
  - @getvitops/utils@0.2.1
