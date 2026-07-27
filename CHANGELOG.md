# Vitops toolchain changelog

Release notes for the `@getvitops/*` packages — what changed, what broke, and how to migrate.

`@getvitops/core`, `generator`, `utils`, `cli`, `vite` and `astro` share **one version**: they are
released together and are only supported in matching versions (the generator embeds a snapshot of
core's CSS and web-component bundles, and the Astro integration copies the _installed_ core's
bundles into your `public/` — mixing versions can leave the CSS and the components disagreeing).
`@getvitops/emdash` and `@getvitops/create` version independently.

Per-package detail — including every release before 0.7.0 — ships with each package:
`node_modules/@getvitops/<pkg>/CHANGELOG.md`.

## 0.8.0 — 2026-07-27

One new feature — a live theme editor — plus repairs to things shipped in 0.7.0 that didn't work
outside this repo.

### Added

- **`<wc-theme-editor>` — tune the whole design system in the browser, with no rebuild.** Palette,
  semantic roles, type roles, spacing, layout, pattern geometry, radii and shadows, layered as
  `:root` custom-property overrides and exportable as CSS or as a `design-system.json` patch. On a
  dev server running `@getvitops/vite`, **Save to source** writes the patch back through
  validate → write → regenerate; on a static build the probe fails and the button isn't rendered.

  It ships as a **separate, opt-in bundle** — `@getvitops/core/editor`, ~13 kB, no Lit — and is
  never registered in `elements.js`, so a page that doesn't ask for it pays nothing. Enable with
  `getvitops({ editor: true })`.

  This is a deliberate exception to the framework's rule that web components must progressively
  enhance accessible no-JS markup: it's _tooling_, not a page pattern, and a live editor has no
  no-JS fallback to enhance. It's quarantined rather than excused — don't read it as precedent for
  behaviour JS in a `<wc-*>` element.

- **`validate()` returns `warnings: string[]`** for configs that parse and generate but won't behave
  as authored, and `vitops validate` prints them. First case: a `patterns.radii` key named after a
  pattern collides on `--br-<name>` (the example config hits this with `radii.card`).

### Breaking

- **`body { margin: 0 }` is now part of the framework.** The UA's 8px margin offset every
  full-bleed surface — sticky headers and `bg-*` bands rendered inset, with a sliver of canvas
  around them, because the framework owns page gutters through `.centered`'s `--gutter`. This is
  the _only_ UA reset the framework makes; it still deliberately ships no general reset (no global
  `box-sizing` change), which would silently reflow existing layouts. **Migration:** drop any
  `body { margin: 0 }` you added to compensate; add your own padding if you relied on the inset.

- **`.cta` defaults to the `ui-primary` role instead of `brand-primary`.** The three tiers of one
  interaction family had split colour lineage — `:where(button, .btn)` and `:where(a, .link)`
  resolved to `ui-primary` while `.cta` alone used `brand-primary`, so the focus ring changed
  colour depending on which tier you tabbed onto. **Migration:** none if the two roles share a hue
  (true of the example config). If they differ and you want the old colour, use the new
  `.cta-brand-primary` variant — `brand-primary` was added to `cta.roles`, so a brand-coloured CTA
  is reachable rather than unavailable.

### Fixed

- **Dark mode worked only under Bricks.** The dark block was emitted under
  `:root[data-brx-theme="dark"]` alone — Bricks' own attribute, which nothing else sets — while the
  shipped `<color-scheme-toggle>` writes `data-theme`. Clicking "Dark" changed an attribute no rule
  matched. Both are now matched. ("System" still resolves to light; there is deliberately no
  `prefers-color-scheme` block, since adding one would flip every existing site dark for dark-OS
  users.)
- **The colour scheme now persists across navigations**, via `localStorage`, and `<Head />` applies
  it before first paint so pages don't render light and flip. Previously the choice was per-page
  state and the toggle even cleared it on unmount.
- **`@getvitops/emdash@0.2.1` reported version `0.2.0`** from its plugin descriptor — a
  hand-maintained literal that `changeset version` doesn't touch. It's now derived from
  package.json, and `vp run release` runs the test suite that catches this before publishing.
- **`generateIconInclude()` is reachable.** The semantic icon mapping (declare names + sets, get
  the build-time `include` map) lived in a package path that was never exported, so nothing could
  call it. It moved to `@getvitops/utils`, which `@getvitops/astro` re-exports. Unresolvable
  semantic names now throw at build time naming every offender, where they were skipped silently.
- **`design-manifest.json` reverse-index paths.** Numeric colour steps mapped to the hue's `seed`
  (which regenerates the whole ramp, collapsing every step onto one path); they now map to
  `anchors.<n>`. `--br-<name>` resolved to `patterns.radii.<name>` even when a pattern owned the
  variable.
- **`@getvitops/create`'s emdash template** pinned `@getvitops/astro: ^0.4.0`, a range that stopped
  resolving when astro joined the fixed group at 0.7.0.

## 0.7.0 — 2026-07-27

### Breaking

- **A bare `<button>` is no longer a filled brand-primary button.** Actions now split into two tiers
  named by intent: **`.cta`** is _persuasion_ (filled, bolder, roomier, lifts on hover) and bare
  `<button>` / **`.btn`** is _affordance_ — it signals only that something is interactive, with no
  fill, no `font-weight: 600` and no shadow.

  **Migration:** add `class="cta"` to any button that should stay prominent — submit buttons, hero
  actions, anything driving a conversion. Dialog closes, toolbar buttons, icon buttons and toggles
  should keep the new default. To restore the old look globally, point `patterns.items.btn` in your
  `design-system.json` back at the previous filled base.

  **Why:** `<button>` the element means "interactive control", not "primary action" — and a CTA is
  usually an `<a>`, because it navigates. Making the CTA a _class_ is what finally lets it go on a
  link. The framework was also fighting its old default: fourteen component partials existed partly
  to undo the fill.

- **`chip` is retired as vocabulary.** The two small-label patterns now split by behaviour, not size:
  **`badge`** is a _static_ label (status, count, category), **`tag`** is an _editable and/or
  dismissable_ one (e.g. entries in a filter list).

  **Migration:** `.chip-list` → `.tag-list`. Its `__chip` / `__chip-remove` sub-parts are removed —
  replace `<span class="chip-list__chip">x <button class="chip-list__chip-remove">` with `<span
class="tag">x <button class="tag__remove">`, since a tag list is a list of tags. Items change
  appearance: `.tag` is outlined where the old chip was filled with `--color-surface-muted`. Tokens
  `--*-chip-list` → `--*-tag-list`; the redundant `radii.chip` primitive is gone (use `--br-tag`).

- **The small-label pattern group is renamed `tag` → `label`**, so group tokens are now
  `--{p,br,b,ds,fs}-label`. **Migration:** if you set any `--*-tag` expecting the _group_ value,
  switch to `--*-label`. **Why:** the `tag` pattern and the `tag` group compiled to the same
  variables, so the pattern's override hook shadowed the group token and its `-group` alias was
  unreachable. `--*-tag` is now free as the `tag` pattern's own hook.

- **`@getvitops/astro` jumps 0.4.2 → 0.7.0.** It now shares the toolchain version instead of tracking
  its own line. **The number changed; the package did not** — 0.7.0 is the direct successor to 0.4.2,
  with no API change implied by the jump.

  **Migration:** update the version range, nothing else. Install `@getvitops/astro` at the same
  version as your `@getvitops/cli` / `@getvitops/generator`.

  **Why:** astro depends on core, generator, utils _and_ vite, and was already being bumped on every
  single toolchain release by its dependency updates — so its separate version line cost the same
  churn while making "which astro works with cli 0.6?" a question you had to answer yourself. Now the
  versions match by construction.

### Added

- **`.cta`** — the persuasion tier, with `.cta-{success,danger,warning,info}` role variants. A class,
  so it works on any element.
- **`:where(button, .btn)`** and **`:where(a, .link)`** — a pattern may now set both `element` and
  `class`, emitting one zero-specificity rule. The element gets the styling with no class needed, the
  class carries it to any other tag, and any explicit class overrides it without `!important`.
- **`fill: true|false`** on a pattern — states whether states and role variants drive
  `background-color` (plus `on-solid` text) or `color`, instead of inferring it from the pattern's
  name and base declarations. Existing configs are unaffected; the old inference is the fallback.
- Every published package now ships its `CHANGELOG.md` in the npm tarball, so per-package history is
  readable at `node_modules/@getvitops/<pkg>/CHANGELOG.md` (and on unpkg/jsdelivr) without needing
  repository access.
- This file: curated, toolchain-level release notes covering all packages at once.

### Fixed

- Role variants on element patterns were emitted at specificity 0-1-1 (`button.danger`), outranking
  any plain class. They now emit as `:where(button, .btn).danger, .btn-danger` — both at class
  specificity, and reachable from a non-`<button>` host.
- Pattern geometry now resolves through the group alias layer (`--br-btn-group: var(--br-control)`)
  instead of hard-coding `var(--br-control, …)` into each rule, so the whole cascade — `--p-btn` →
  `--p-btn-group` → `--p-control` → `--p-default` — is live custom properties you can inspect and
  edit in the browser. Applies to `btn`, `cta`, `badge`, `tag`, `card` and `status`. Computed values
  are unchanged.
- The `link` pattern declared `default_role: "brand-primary"` while hard-coding a `ui-primary` base
  colour, so hovering shifted hue instead of intensifying. Its `default_role` is now `ui-primary`.
- `@getvitops/astro`'s `FormRenderer` defaulted its submit button to `class="btn btn-primary"` — a
  class that never existed and a role that is not emitted. It now defaults to `.cta`.
- The Tailwind bundle is no longer assembled during `css` / `bricks` builds, where it was computed
  and discarded (it also read every framework partial off disk).
