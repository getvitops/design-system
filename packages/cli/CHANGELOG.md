# @getvitops/cli

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

- 44de07f: Shared toolchain version + changelogs that reach consumers.
  - **`@getvitops/astro` now shares the toolchain version** (`core`/`generator`/`utils`/`cli`/`vite`),
    so it moves from its own `0.4.x` line onto the group's. The number changes; the package does not —
    install it at the same version as `@getvitops/cli`. It was already being bumped on every toolchain
    release by its dependency updates, and it depends on core, generator, utils _and_ vite, so a
    separate version line cost the same churn while leaving the compatible pairing implicit. The
    lockstep is load-bearing: the generator ships a snapshot of core's CSS + web-component bundles
    while the Astro integration copies the _installed_ core's bundles, so mismatched versions can leave
    the CSS and the components disagreeing.

  - **Every package now ships its `CHANGELOG.md` in the published tarball.** npm does not include
    changelogs by default, so none of this history previously reached anyone who installed the
    packages. Per-package history now reads from `node_modules/@getvitops/<pkg>/CHANGELOG.md`;
    curated toolchain-level release notes live in the repo's root `CHANGELOG.md`.

### Patch Changes

- @getvitops/generator@0.7.0
- @getvitops/utils@0.7.0

## 0.6.0

### Minor Changes

- 2cc847d: Package-resident agent skill + `vitops docs`:
  - `@getvitops/cli` now ships the `vitops-design-system` agent skill inside the package
    (`skill/SKILL.md`). `vitops agents` no longer emits a generated skill into the repo — it
    symlinks `.agents/skills/` and `.claude/skills/` entries to the installed package (logical
    `node_modules/@getvitops/cli/skill` target, surviving version bumps) and writes the
    AGENTS.md pointer block. Old generated-skill directories are migrated automatically;
    `--docs-dir` keeps the emit-files layout.
  - New `vitops docs [topic]` command prints reference docs to stdout, rendered live from the
    project's `design-system.json` (topics: classes, authoring, formats, color, scales,
    patterns, elements; `--all` concatenates).
  - `renderSkill()` removed from `@getvitops/generator` (superseded by the packaged skill).

### Patch Changes

- Updated dependencies [2cc847d]
  - @getvitops/generator@0.6.0
  - @getvitops/utils@0.6.0

## 0.5.0

### Minor Changes

- Ship design-system context to downstream agents:
  - JSON Schema descriptions: every `design-system.json` and site-config field now carries a
    `description` (authored in the zod schemas via `desc()`), emitted into `schema.json` /
    `site.schema.json` for editor hovers and agent consumption.
  - New generated OKF docs: `authoring.md` (field reference walked from the JSON Schema),
    `formats.md` (tailwind vs css vs bricks, including the TW_CLASH utilities Tailwind
    provides natively), and `concepts/{color,scales,patterns}.md` (seeded OKLCH colour
    system, fluid modular scales, pattern token cascade + override hooks).
  - `vitops agents` now emits a generated `vitops-design-system` agent skill into
    `.agents/skills/vitops-design-system/` (SKILL.md + the docs bundle as `references/`,
    with an idempotent `.claude/skills/` symlink) and writes a compact pointer block into
    `AGENTS.md`. Pass `--docs-dir` for the legacy docs-only layout.
  - `TW_CLASH` and `BASE_HOOK` are exported from `@getvitops/generator`.

### Patch Changes

- Updated dependencies
  - @getvitops/generator@0.5.0
  - @getvitops/utils@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [d7e6491]
  - @getvitops/utils@0.4.0
  - @getvitops/generator@0.4.0

## 0.3.0

### Patch Changes

- Updated dependencies
  - @getvitops/utils@0.3.0
  - @getvitops/generator@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies [d28aae7]
  - @getvitops/generator@0.2.1
  - @getvitops/utils@0.2.1

## 0.2.0

### Minor Changes

- d35515e: Add `vitops agents` — writes a managed, marker-delimited block into a consumer's `AGENTS.md`
  (or `--out CLAUDE.md`) so AI coding agents can discover the CLI and the design-system class/element
  vocabulary. Idempotent (re-run to update between the `<!-- vitops:start -->`/`<!-- vitops:end -->`
  markers) and also emits the OKF docs bundle it points at (`--docs-dir`, default `.vitops/docs`).

### Patch Changes

- Updated dependencies
  - @getvitops/generator@0.2.0
  - @getvitops/utils@0.2.0
