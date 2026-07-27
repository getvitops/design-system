# Vitops toolchain changelog

Release notes for the `@getvitops/*` packages — what changed, what broke, and how to migrate.

`@getvitops/core`, `generator`, `utils`, `cli`, `vite` and `astro` share **one version**: they are
released together and are only supported in matching versions (the generator embeds a snapshot of
core's CSS and web-component bundles, and the Astro integration copies the _installed_ core's
bundles into your `public/` — mixing versions can leave the CSS and the components disagreeing).
`@getvitops/emdash` and `@getvitops/create` version independently.

Per-package detail — including every release before 0.7.0 — ships with each package:
`node_modules/@getvitops/<pkg>/CHANGELOG.md`.

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
