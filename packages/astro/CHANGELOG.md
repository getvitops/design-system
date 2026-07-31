# @getvitops/astro

## 0.9.0

### Minor Changes

- **Fixed: `Subgrid` and `Cards` rendered as unstyled lists, in every format.**

  `Subgrid.astro` drew its geometry with Tailwind utilities — `grid-rows-subgrid` and
  `row-span-(--row-span)`, the latter Tailwind v4's arbitrary-CSS-variable syntax. No framework CSS
  layer defines those, so under `css.format: 'css'` or `'bricks'` the component had no layout at all.

  It failed under `'tailwind'` too, which is the part worth internalising: **Tailwind v4 is JIT and
  does not scan `node_modules`**, so a class that only a shipped component references is never
  generated. A consumer had to add the package to Tailwind's `@source` by hand to get a subgrid;
  without that, cards silently laid out at `grid-row: auto` — visually plausible, quietly wrong. The
  same trap applied to `grid` in `Subgrid` and `sr-only` / `not-sr-only` in `Popover` / `Drawer`:
  those are in the generator's `TW_CLASH` list, so the framework strips its own rules for them from
  the tailwind bundle and defers to Tailwind — meaning they resolved only when the consumer's own
  templates happened to use the same class.

  The components now emit framework classes only, and the `subgrid` pattern owns the layout:
  - `Subgrid` renders `<ul class="subgrid"><li>…` and ships no `<style>` block of its own.
  - `Popover` / `Drawer` use a component-scoped `visually-hidden` instead of `sr-only`. The
    `not-sr-only` on their icons was a no-op and is gone.
  - The `subgrid` pattern absorbed the wrapped-row margin the component used to carry, so
    hand-written `.subgrid` markup gets it too, and resets list markers on `ul`/`ol`.

  **Also fixed: `Cards` discarded the `card` class and every class you put on a child.** It wrote
  `card` onto the slotted element and then serialised that element's _inner_ HTML, dropping the
  attribute it had just set. Child `class` and `style` now reach the rendered `<li>`.

  **Breaking — the subgrid custom properties are renamed.** One `--subgrid-*` vocabulary now covers
  both the pattern and the component; the old names are removed, not aliased:

  | removed                         | use                  |
  | ------------------------------- | -------------------- |
  | `--items-per-row`, `--cols`     | `--subgrid-cols`     |
  | `--rows-per-item`, `--row-span` | `--subgrid-row-span` |
  | `--row-margin`                  | `--subgrid-row-gap`  |

  `--subgrid-gap` (the grid gap) is unchanged, as are the `.subgrid-cols-*` / `.subgrid-rows-*` /
  `.subgrid-responsive` modifiers. Anything still setting an old name falls back to the pattern
  defaults — 3 columns, span 2 — so grep for them when you upgrade.

- **`tailwindcss` and `@tailwindcss/vite` are now optional peer dependencies, not dependencies.**

  Only `css.format: 'tailwind'` ever used them, but every consumer installed them — including
  `'css'` and `'bricks'` projects that never touch Tailwind. The integration now loads
  `@tailwindcss/vite` lazily inside that branch and throws a directive error if it is missing.

  **Migration:** if you use `css.format: 'tailwind'` (the default), add both to your
  `devDependencies` — `pnpm add -D tailwindcss @tailwindcss/vite`. Most Tailwind projects already
  have them. Everyone else can drop them.

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies [c949cae]
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @getvitops/generator@0.9.0
  - @getvitops/core@0.9.0
  - @getvitops/vite@0.9.0
  - @getvitops/utils@0.9.0

## 0.8.0

### Minor Changes

- a334049: Make the semantic icon mapping reachable, and fail the build on unresolvable names.

  `generateIconInclude()` — declare the semantic icon names a site needs plus which sets to draw
  them from, get back the `include` map that keeps the bundle to just those glyphs — already existed
  but was unreachable: it lived in `@getvitops/core/src/utils/`, which the package doesn't export.
  It has moved to `@getvitops/utils` (a build-time concern, in the build-time utilities package),
  which `@getvitops/astro` re-exports wholesale. So from `astro.config.mjs`:

  ```js
  import { generateIconInclude } from '@getvitops/astro';
  import icon from 'astro-icon';

  integrations: [
    icon({
      include: generateIconInclude({
        ui: 'fa7-solid',
        brand: 'simple-icons',
        semantic: ['menu', 'close', 'search', 'github'],
      }),
    }),
  ];
  // → { "fa7-solid": ["bars","xmark","magnifying-glass"], "simple-icons": ["github"] }
  ```

  Swapping `ui` to `'lucide'` yields `{ lucide: ["menu","x","search"] }` from the same declaration —
  which is the point: the semantic names are what your markup commits to, and the set is a config
  choice. The output shape is the `include` both `astro-icon` and `astro-iconset` accept, so the
  mapping doesn't tie you to either.

  **Unresolvable names are now a build error.** Previously they were skipped silently, so swapping
  sets appeared to succeed and the gaps surfaced as missing glyphs in production. The error names
  every offender; an unknown set name throws too, listing the known sets.

  Also fixes `@getvitops/create`'s emdash template, which pinned `@getvitops/astro: ^0.4.0` — a range
  that stopped resolving when astro joined the fixed group at 0.7.0, so scaffolded projects were
  stuck on the old line.

- **New: `<wc-theme-editor>`, a live theme editor you can ship with your site.**

  Tune the whole design system in the browser — palette, semantic roles, type roles, spacing, layout,
  pattern geometry, radii, shadows — with no rebuild. Edits are layered as `:root` custom-property
  overrides, persist to localStorage, and export as CSS or as a `design-system.json` patch. It follows
  your site's colour scheme and drives the same `data-theme` + storage key as `<color-scheme-toggle>`,
  so the two no longer fight.

  It ships as a **separate, opt-in bundle** (`@getvitops/core/editor`, ~13 kB, no Lit) and is never
  registered in `elements.js`: a page that doesn't ask for it pays nothing.

  ```js
  // astro.config.mjs
  getvitops({
    css: { input: 'design-system.json', format: 'css', out: 'src/styles' },
    editor: true,
  });
  ```

  ```html
  <!-- anywhere in your layout -->
  <wc-theme-editor></wc-theme-editor>
  ```

  `editor: true` copies `editor.js` into `public/vitops/`, loads it from `<Head />`, and mirrors
  `design-manifest.json` to `/vitops/design-manifest.json` (override with the `manifest` attribute).
  Outside Astro, load the bundle yourself and point `manifest` at the file.

  **Save straight back to your config, in dev.** `@getvitops/vite` now serves a dev-only
  `/__vitops/design-system` endpoint: the editor POSTs its patch, the plugin deep-merges it into your
  `design-system.json`, validates the _merged_ result, writes it back preserving the file's formatting,
  then regenerates and reloads. The endpoint exists only under `vite dev` — on a static deploy the
  editor detects its absence and hides the button, while everything else still works.

  **Added:** `colors.roleTokens` in `design-manifest.json` — the functional token set (bg / border /
  solid / on-solid / text / emphasis stops) precomputed per hue, in `default` and `surface` variants for
  both appearances. Re-pointing a role at another hue needs these: `solid` is chosen by scanning the hue
  and `on-solid` is a computed contrast value, so neither is derivable by a browser client.

  **Removed:** the dead `interaction` block from `design-manifest.json` — a hardcoded
  `{duration, easing}` literal with no schema key, no reverse-index entry, and no corresponding CSS
  variable. Nothing could have consumed it meaningfully. The real animation knobs are
  `--animation-duration-*` / `--custom-ease-*`.

  **Fixed:** a `[popover]` reset in `popover.css` was stripping the background, padding and border from
  any pattern used as a popover. It is imported after `drawer.css`, so at equal specificity it beat
  `.drawer` — and `dialog` (0-0-1) too — leaving a `.drawer[popover]` transparent and unpadded despite
  drawer.css documenting popover as supported. The reset now sits in `:where()` at zero specificity, so
  it still overrides the UA stylesheet but any pattern class takes its surface back. Open/closed
  behaviour is unchanged.

  **Added:** `input[type="range"]` and `input[type="color"]` now have baseline styling in `forms.css`
  (accent colour from `--ui-primary-solid`; the colour swatch picks up the control border and radius).

### Patch Changes

- aa2863d: Persist the colour scheme across navigations, and drop the UA body margin.

  **The colour scheme now sticks.** `<color-scheme-toggle>` records the explicit choice in
  `localStorage` (`vitops-color-scheme`) and restores it on load. Previously every navigation reset
  to System — the component defaulted to `system` on each page and its `disconnectedCallback` even
  deleted the attribute on unmount, so the scheme was per-page state rather than a user preference.
  Choosing System clears the key, so a visitor can go back to following their OS.

  `<Head />` from `@getvitops/astro` now also emits a tiny synchronous script that applies the stored
  value **before first paint**. Without it the persisted choice would still work, but every page
  would render light and flip once the deferred element bundle upgraded. A test asserts the storage
  key stays in step between the two (they can't share an import: core exports only prebuilt bundles,
  and the Head script must be a literal in the emitted HTML).

  **`body { margin: 0 }`** is now part of the framework. The UA's 8px margin offset every full-bleed
  surface — sticky headers and `bg-*` bands rendered inset with a sliver of canvas around them, since
  the framework owns page gutters through `.centered`'s `--gutter`. This is the only UA reset the
  framework makes; it deliberately still ships no general reset (no global `box-sizing` change),
  which would silently reflow existing layouts.

  **Migration:** if you were compensating for the body margin with a negative offset or your own
  `body { margin: 0 }`, you can drop it. Sites relying on the 8px inset will need to add their own
  padding.

- Updated dependencies
  - @getvitops/core@0.8.0
  - @getvitops/generator@0.8.0
  - @getvitops/vite@0.8.0
  - @getvitops/utils@0.8.0

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
