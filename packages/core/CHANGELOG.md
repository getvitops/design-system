# @getvitops/core

## 1.0.0

### Major Changes

- bb92a14: **The colour system is rebuilt on a target-prefixed grammar and a shared lightness ladder.**
  This is a breaking change to every colour token and utility class.

  ## Why

  Two axes shared one class namespace — functional _planes_ (`--<role>-bg-muted`) and
  appearance-relative _stops_ (`--color-<role>-muted`) — arbitrated by a "plane wins" rule. The
  result was not a scale. On the shipped palette, light mode:

  | class                              | resolved to  | step                                          |
  | ---------------------------------- | ------------ | --------------------------------------------- |
  | `bg-ui-accent-x-muted`             | stop         | 100                                           |
  | `bg-ui-accent-muted`               | plane        | 100 — identical, so `x-muted` was a dead rung |
  | `bg-ui-accent`                     | plane        | 50 — _lighter_ than both its "muted" rungs    |
  | `border-ui-accent-muted` / `-bold` | stop / plane | 300 / 300 — identical                         |
  | `text-ui-accent-bold`              | stop         | 700 — _lighter_ than `text-…-muted` (800)     |

  Every family was non-monotonic, two had duplicate rungs, and `--color-<role>-muted` was
  unreachable through any `bg-` class.

  ## The new grammar

  ```
  --color-<target>-<role>[-<variant>]        target ∈ bg | text | icon | border
  ```

  The target is **inside** the name, so `bg-danger-muted` and `text-danger-muted` are different
  tokens and there is nothing left to arbitrate. **The class name is the token name minus
  `--color-`** — one vocabulary instead of two.

  Variants are ordinal (`xx-muted` < `x-muted` < `muted` < bare < `bold` < `x-bold`) and the
  tables are sparse: only cells that hold their contrast target exist.

  ## Role kinds

  `colors.roles` values may now be `{ hue, kind }` as well as a bare hue string:

  ```jsonc
  "roles": {
    "danger":  "rust",                             // shorthand => chromatic
    "surface": { "hue": "navy", "kind": "surface" }
  }
  ```

  - **`surface`** — a page/panel colour: `bg-<role>` is the card, `bg-<role>-muted` the page
    behind it, `bg-<role>-x-muted` a well, `bg-<role>-bold` the inverse surface. Full text scale.
  - **`chromatic`** (default) — a signal colour: tints (`bg-<role>-x-muted`/`-muted`) and solids
    (`bg-<role>-solid[-bold|-x-bold]`), with **no bare `bg-<role>`** — say how loud you mean.
    `text-on-<role>` is the guaranteed foreground for the solid family.

  ## Palette generation

  Every ramp now sits on one **fixed lightness ladder** (50 → L 0.98 … 950 → L 0.21); only chroma
  and hue vary. That is what makes a step mean the same lightness in every hue. Previously each
  seed transposed the curve, so relative luminance at step 300 ranged from 0.253 to 0.384 across
  the shipped palette — the same variant read differently depending on the role.

  Authored colours are still reproduced **exactly**. A `seed`, an `anchors` entry or a `tones`
  value is pinned verbatim at its nearest step; every other step takes the ladder. Snapping brand
  colours to the ladder was measured and rejected: 11 of 18 real brand hexes moved beyond a
  just-noticeable difference (worst ΔE-OK 0.050 — Facebook's `#1877F2` → `#0067e1`) and six left
  sRGB gamut. Deviation is now bounded and local to pinned steps, and warns past ~0.03 L.

  Two tones that claim the same step now **error** instead of one silently overwriting the other;
  the record form (`tones: { "600": "…", "700": "…" }`) is how you resolve it.

  ## New
  - **`icon-<role>`** — a non-text tier, so a glyph may run more vivid than text. `icon` is now a
    default utility family alongside `bg`/`text`/`border`.
  - **`--color-border-focus`** — the focus-ring tone, taken from `ui-primary`'s solid.
  - **Contrast is enforced at build time**, not only in tests: text ≥ APCA Lc 75 on its primary
    background, ≥ 60 on secondary planes, icons and surface boundaries ≥ 45, both appearances.
    A violation now fails `generate`. Chromatic text is checked against the _surface_ planes it
    actually sits on, not only its own tints. `text-<role>-x-muted` (placeholder) and `-xx-muted`
    (disabled) are explicitly exempt; nothing else is.

  ## Migrating

  Rename `--<role>-<suffix>` → `--color-<target>-<role>[-<variant>]`, and the same for classes:

  | before                                  | after                                                            |
  | --------------------------------------- | ---------------------------------------------------------------- |
  | `--<role>-bg` / `bg-<role>` (chromatic) | `--color-bg-<role>-x-muted` / `bg-<role>-x-muted`                |
  | `--<role>-bg-muted`                     | `--color-bg-<role>-muted`                                        |
  | `--<role>-solid` / `-solid-bold`        | `--color-bg-<role>-solid` / `-solid-bold`                        |
  | `--<role>-on-solid` / `text-on-<role>`  | `--color-text-on-<role>` (class unchanged)                       |
  | `--<role>-text` / `-text-muted`         | `--color-text-<role>` / `-muted`                                 |
  | `--<role>-border` / `-border-bold`      | `--color-border-<role>` / `-bold`                                |
  | `--color-<role>-muted` (stop)           | judge by use: `--color-bg-<role>-muted` or `--color-text-<role>` |

  **`surface` background names rotate**, value-preserving: what was `--surface-bg` (the page) is
  now `--color-bg-surface-muted`; what was `--surface-bg-bold` (raised) is now
  `--color-bg-surface`. Elevation is expressed by which token you reach for — page `bg-muted`,
  card `bg` — rather than a raised/sunken pair, which is what lets a future surfaces axis flatten
  it without touching markup.

  `vitops lint` reports role classes that no longer resolve, and now derives its suggestions from
  what the generator actually emits rather than a hand-maintained list.

### Patch Changes

- Updated dependencies [bb92a14]
  - @getvitops/utils@1.0.0

## 0.9.0

### Minor Changes

- **The theme editor no longer dims the page it's editing.**

  The panel used `.drawer`'s scrim and `popover="auto"`, which fought the whole purpose of a live
  editor: the page you were tuning sat behind a 4px blur, and the first click on it dismissed the
  panel. It is now modeless — no scrim, and clicking through to the page keeps it open. Escape still
  closes it (wired explicitly, since `popover="manual"` doesn't provide it), as does the × button.

  **New: `.drawer--modeless`.** The same treatment is available to any drawer — a side panel you work
  _alongside_ rather than through (an inspector, a live editor, a filter rail). Pair it with
  `popover="manual"`:

  ```html
  <div class="drawer drawer--right drawer--modeless" popover="manual">…</div>
  ```

  An `auto` popover light-dismisses on the first outside click, which is exactly the interaction a
  modeless panel exists to permit — so `manual` is part of the pattern, not an afterthought. It also
  drops Escape, so give the panel a visible close control.

  **Added:** a drift guard tying `<wc-theme-editor>`'s dark-override selector to the generator's
  `DARK_SEL`. The two must match or the editor's dark-mode edits land on a rule the page never
  matches — a failure that is invisible in light mode, so nothing would have caught it.

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

### Patch Changes

- **Fixed: `vitops init` and `vp create` scaffolded configs referencing tokens that no longer
  exist.** `defaultConfig()` and the EmDash template still pointed at `--color-surface-xl` and
  `--color-surface-xxl`, aliases from the named-step colour scale removed in 0.6. A scaffolded
  project therefore got a `card` with no background and an invalid default border colour, with
  nothing reporting it. Both now use `--surface-bg` / `--surface-bg-muted`. The EmDash template
  also dropped its `patterns.radii.card` key, which collided with the `card` pattern on
  `--br-card` — the collision `validate()` has been warning about (the `panel` group already
  supplies the same radius, so nothing changes visually).

  **Fixed: `.text-reveal` rendered invisible text.** Its gradient consumed
  `--text-reveal-color-from`/`-to` with no defaults, so unless a consumer set both, the `var()`
  substitution failed, `background` became invalid at computed-value time, and the accompanying
  `color: transparent` left the text with no way to render. Both tones now default to the
  functional text tokens.

  **Fixed: `.bordered` fell back to `currentColor`** via a reference to `--color-surface-xl`,
  which the generator never emitted. It now resolves `--surface-border`.

  **New: `validate()` warns when a required role is missing.** `colors.roles` is an open map —
  any name works and generates a full token set — but the shipped component CSS references
  `brand-primary`, `danger`, `neutral`, `surface`, `ui-primary` and `warning` with no fallback,
  so omitting one leaves those components uncoloured. This is a warning, not an error; the
  required list is re-derived from the CSS partials by a test so it cannot drift.

  `vitops docs` and `vitops agents` now surface config warnings (on stderr, so piping `docs` is
  unaffected). They previously discarded them, unlike `generate` and `validate`.

  Docs corrections, all in the generated bundle:
  - **Raw scale classes are frozen and do not remap in dark mode** — stated explicitly for the
    first time, with a migration table to the role equivalents. The dark-mode guarantee only ever
    applied to functional role tokens, and nothing said so.
  - **Roles are extensible over a required core** — the schema description and class reference
    read as a closed enumeration, which is why a consumer forked their own colour layer rather
    than adding a role.
  - **The `md:` / `@md:` / `md-` distinction** in the tailwind format: `@md:` uses the framework's
    breakpoints, `md:` works but uses Tailwind's (which differ — `sm:` is 40rem, `@sm:` is 30rem),
    and `md-` is silently inert. Plus a note that registering `--container-*` also re-points
    Tailwind's `max-w-*` scale.
  - The css and bricks bundles now carry a `/*!` banner pointing at `npx vitops docs classes`
    (the previous plain comment was stripped by the minifier, so it never reached the file).

  Contrast checking now covers **every** background plane a role emits (`bg`, `bg-muted`, and
  `bg-bold`), not just `bg` — body text on a `card` was previously unguaranteed.

- **Fixed: `<details>` disclosures never opened.**

  Every `<details>` on a page using this framework was inert in Chrome 149 — clicking a summary
  toggled the `open` attribute and nothing else happened. This affected the bare element, not just
  `.details`, so it hit the docs table-of-contents, the mobile nav, and the theme editor's sections
  alike.

  The cause was the open/close animation on `::details-content`. It used the canonical recipe
  (`block-size: 0 → auto` plus `content-visibility` under `allow-discrete`, backed by
  `interpolate-size: allow-keywords`), and that recipe deadlocks: `content-visibility` stays `hidden`,
  so the content has no layout, so `auto` resolves to `0`, so the transition has nothing to animate
  and the state never advances. The failure is total rather than cosmetic — collapsed content simply
  could not be reached.

  Bisected against a bare `<details>` with only the framework stylesheet. `transition: none` is the
  only thing that restores it; transitioning `block-size` alone, `content-visibility` alone,
  `calc-size(auto, size)`, and the `grid-template-rows: 0fr → 1fr` technique all fail identically.

  **So the transition is gone and disclosures now open instantly.** Correctness over motion. If you
  reinstate it, verify a _first click actually expands_ in a real browser — the syntax is valid and
  `@supports` reports it as supported, so a feature query proves nothing here; only the interaction
  does.

  **Also fixed: `.details--marker-start` right-aligned its label.** It mirrored the trailing marker's
  `margin-inline-start: auto` as `margin-inline-end: auto`, which pushed everything after the icon to
  the opposite edge instead of just placing the icon first.

  **Also:** `<wc-theme-editor>`'s section headers now carry a disclosure marker. The `.details`
  pattern removes the native one and expects a `.details-icon`; without it a panel of ~40 nested
  sections gave no indication anything was collapsible.
  - @getvitops/utils@0.9.0

## 0.8.0

### Minor Changes

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

- @getvitops/utils@0.8.0

## 0.7.0

### Patch Changes

- @getvitops/utils@0.7.0

## 0.6.0

### Patch Changes

- @getvitops/utils@0.6.0

## 0.5.0

### Patch Changes

- @getvitops/utils@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [d7e6491]
  - @getvitops/utils@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies
  - @getvitops/utils@0.3.0

## 0.2.1

### Patch Changes

- @getvitops/utils@0.2.1

## 0.2.0

### Minor Changes

- Redesign the colour system: seeded OKLCH tonal scales plus functional semantic tokens
  (`bg`/`text`/`solid`/`on-solid`, `muted`/`bold`), with named-alias back-compat. Updates the
  framework CSS, the schema, and the generated docs to the new token model.

### Patch Changes

- @getvitops/utils@0.2.0
