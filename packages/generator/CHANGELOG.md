# @getvitops/generator

## 0.9.0

### Minor Changes

- **The `tailwind` format now emits the full role colour vocabulary.** It previously emitted only
  the functional role utilities, so 87 classes — `bg-<role>-x-muted`, `bg-<role>-bold`,
  `bg-<role>-x-bold`, `text-<role>-bold`, `text-<role>-x-bold`,
  `border-<role>-{muted,x-muted,x-bold}`, for every role — existed in the `css` and `bricks`
  outputs and silently did nothing in `tailwind`. Nothing in the test suite built the tailwind
  format, so the divergence was invisible; it was found by a consumer who hand-forked four
  background planes into their own stylesheet to work around the absence.

  All three formats now render from one emitter (`roleColorUtilities()`), which resolves the
  plane-vs-stop namespace collision explicitly instead of relying on the CSS minifier dropping a
  shadowed rule. No class changes meaning, and the `css`/`bricks` output is unchanged.

  Also fixed in the tailwind format:
  - `colors.utilities` is now honoured. It was hardcoded to `bg`/`text`/`border`, so enabling
    `outline`/`fill`/`stroke` worked in `css`/`bricks` and was ignored here. (For raw hue scales
    it remains a floor rather than a ceiling — those are `@theme` colours, and Tailwind derives
    every colour family from them on demand.)
  - **Component container queries are no longer stripped.** The pass that drops the framework's
    pre-expanded `md-*` breakpoint utilities (Tailwind regenerates those as `@md:`) matched every
    `@container (min-width: …)` block, including component behaviour — most visibly the
    sitenav's, so `.sitenav--bp-{sm,md,lg,xl}` were removed and the nav stayed in its mobile
    layout at every width.

  New: **`vitops lint`** reports framework classes in your source that resolve to nothing — the
  failure mode where an unknown utility looks exactly like a working one. It is format-aware
  (`md-flex-row` is a real class in `css`/`bricks` and inert in `tailwind`) and only judges
  classes anchored to your own config, so it stays quiet on Tailwind's utilities and your own.

  ```
  vitops lint --format tailwind --src src
  ```

- **The `css` and `bricks` bundles now ship cascade layers, so a utility can override a pattern.**

  `class="card bg-danger-muted"` previously tinted the card in the `tailwind` format and silently
  did nothing in `css`/`bricks`: every colour utility was emitted before every pattern and both sat
  at `0-1-0`, so the pattern won on source order. The bundle now emits

  ```css
  @layer vitops.base, vitops.components, vitops.utilities;
  ```

  - `vitops.base` — the UA reset and the pure `:root` token blocks
  - `vitops.components` — the animation engine, structural layout, and every pattern
  - `vitops.utilities` — `bg-*`, `text-*`, `border-*`, `drop-shadow-*`, `font-*`, animation
    effects, and the display/`sr-only` families

  No rule changed — 1482 rules before, 1482 after — only precedence.

  **What this changes for you.** Unlayered CSS beats every cascade layer regardless of specificity,
  so your own stylesheet, an Astro scoped `<style>`, or a Bricks-authored class now overrides the
  framework with no `!important` and no specificity escalation. That is the intended override story
  and the reason to layer at all.

  **Migration — only if you ship a reset.** An unlayered reset will now beat the framework
  component rules it used to lose to; a bare `p { margin: 0 }` defeats `.rhythm`. Put it in a layer
  and declare the order **before** the stylesheet loads:

  ```html
  <style>
    @layer my.reset, vitops.base, vitops.components, vitops.utilities;
  </style>
  <link rel="stylesheet" href="/styles.css" />
  ```

  Declaring it _after_ the link makes `my.reset` a name introduced later, which sorts **last** —
  highest priority — and the reset wins anyway. That ordering rule is the one non-obvious step.

  The `tailwind` format is byte-identical. Its utilities are `@utility` definitions, which Tailwind
  already places in a layer above `components` and which are what make `hover:`/`@md:` variants
  work; wrapping them ourselves would win the cascade and lose the variants.

  Known gap: `layout.css` mixes structural rules (`.rhythm`, `.centered`) with utilities (`.m-*`,
  `.flex`, `.split-*`) in one partial, so it sits in `vitops.components` whole and its utility half
  cannot yet override a pattern. Splitting it is tracked separately.

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

- Docs now name both dark-mode attributes. The generated colour docs still described the
  dark flip as hanging off `:root[data-brx-theme="dark"]` alone, from before the selector
  also matched `:root[data-theme="dark"]` (the attribute `<color-scheme-toggle>` writes) —
  so a non-Bricks consumer reading `vitops docs color` would wire up an attribute that
  nothing matches. The selector moved into `shared.ts` as `DARK_SEL` (also exported from
  the package index) and the docs interpolate it, so the two can't drift again.
- c949cae: `vitops init` no longer scaffolds a config that warns on its own output.

  `defaultConfig()` declared `patterns.radii.card`, a key named after the `card` pattern — the exact
  collision `validate()` started reporting in 0.8.0. The primitive won `--br-card`, shadowing the
  pattern's override hook and leaving its `--br-card-group` alias unreachable, so a scaffolded project
  was warned about a config it had just been given.

  The key is dropped. This is **value-preserving**: `card` belongs to the `panel` group, which already
  carries the same `0.5rem`, so `--br-card-group` → `--br-panel` → `0.5rem` renders identically.

  **Migration:** none for existing configs — your `design-system.json` is not touched. If you copied
  the scaffold and reference `var(--br-card)` directly in hand-written CSS, note it is now an
  _override hook_ (undefined until you set it) rather than a defined primitive; read `--br-card-group`
  instead, or keep your own `radii` key under a name no pattern uses.

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

- d28aae7: Fix Tailwind output: the `.centered > *` default (`grid-column: measure`) was emitted unlayered,
  which in Tailwind v4 outranks every layer — so track utilities (`.spotlight`/`.breakout`/
  `.fullbleed`) never overrode it and all `.centered` children fell back to `measure`. Emit the
  structural rules (and the animation engine + patterns) in `@layer components` so the track/spacing
  `@utility` classes (utilities layer) win.
  - @getvitops/utils@0.2.1

## 0.2.0

### Minor Changes

- Redesign the colour system: seeded OKLCH tonal scales plus functional semantic tokens
  (`bg`/`text`/`solid`/`on-solid`, `muted`/`bold`), with named-alias back-compat. Updates the
  framework CSS, the schema, and the generated docs to the new token model.

### Patch Changes

- @getvitops/utils@0.2.0
