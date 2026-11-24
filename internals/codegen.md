# Codegen flow

Moved out of AGENTS.md so the root file stays small. Read this before changing the area; the root file keeps only the cross-package rules.

`src/design-system.json` is this repo's dev/example config (each consumer brings their own). The generator (`packages/generator/src/generate.ts`) reads it and emits these output layers — assembled **in memory** and bundled by the css/bricks formats (no longer written as standalone `src/css/generated/**` files); the labels below name the layers:

- **colour** (`color.css`) — Each `colors.palette` hue is an **11-step numeric OKLCH scale** (`--color-<hue>-50…950`) generated from a `seed` (+ optional `anchors`) or a fixed `tones` brand kit.

  **Every ramp shares one fixed lightness ladder** (`LIGHTNESS_LADDER`, 50 → L 0.98 … 950 → L 0.21); only chroma and hue vary. That is what makes a step mean the same lightness in every hue, so one contrast table can serve all of them. Authored colours (the seed, `anchors`, `tones`) are pinned **verbatim** at their nearest step and are the _only_ steps allowed off the ladder — a bounded, local deviation the generator warns about past ~0.03 L. The previous engine transposed the curve onto each seed, which let luminance at step 300 range from 0.253 to 0.384 across the shipped palette.

  `colors.roles` maps each semantic role to a hue **and a kind**: `"danger": "rust"` (shorthand for chromatic) or `{ "hue": "navy", "kind": "surface" }`. Tokens are named **`--color-<target>-<role>[-<variant>]`**, target ∈ `bg` `text` `icon` `border`, and **the utility class name is the token name minus `--color-`**. Variants are ordinal (`xx-muted` < `x-muted` < `muted` < bare < `bold` < `x-bold`) and the tables are sparse.

  The kind decides the shape: a **surface** role has a bare `bg-<role>` (the card), `bg-<role>-muted` (the page), `bg-<role>-x-muted` (a well), the full text scale and `border-<role>-bold` as the guaranteed boundary. A **chromatic** role splits backgrounds into tints (`bg-<role>-x-muted`/`-muted`) and solids (`bg-<role>-solid[-bold|-x-bold]`) with **no bare `bg-<role>`**, plus `text-on-<role>` as the computed foreground. Also `--surface-glass`, `--overlay` and `--color-border-focus`.

  Dark mode re-points which step each token reads under `DARK_SEL` (`shared.ts`) — `:root[data-brx-theme="dark"], :root[data-theme="dark"]`, Bricks' attribute plus the one `<wc-color-scheme-toggle>` writes. The solid family and `text-on-<role>` stay mode-stable so a filled button keeps its identity. Raw hue steps never re-point. Contrast (WCAG 2 ratio: text ≥ 4.5:1, icons/boundaries ≥ 3:1, both appearances) is enforced **at build time** — a violation throws out of `generate` unless `site.accessibility.level` is `A` or `none`, which downgrades it to a warning. APCA is deliberately not used: it is perceptually better but off the W3C standards track, so no law or conformance claim tests it. There is no per-appearance scheme grammar and no named steps.

- **shadows** (`shadows.css`) — `--shadow-<name>` tokens and `.drop-shadow-<name>` utilities. Always emitted for the `css`/`bricks` formats.
- **patterns** (`patterns.css`) — component CSS for entries under `patterns` in the JSON (cta, btn, link, badge, card). Each pattern has `base` declarations, `states` (hover/active/focus-visible) with shortcuts (`step`, `scale`, `lift`, `shadow`, `ring`, `css`), and `roles` (semantic colour variants). Always emitted.

  **Geometry must resolve through the group alias layer — never hard-code the group token.** For
  every grouped pattern the generator emits `--<prop>-<name>-group` aliases (`--br-btn-group:
  var(--br-control)`), and `overrides` replace an alias with a literal. So a pattern's `base` writes
  `"border-radius": "var(--br-btn-group)"`, **not** `"var(--br-control, 0.25rem)"`. Both render the
  same, but only the first keeps the pattern → group mapping in CSS, where it is inspectable and

  editable in devtools; a hard-coded fallback bakes it into the rule and is unreachable. The full
  chain is `--p-btn` (consumer hook, from `BASE_HOOK`) → `--p-btn-group` (pattern/`overrides`) →
  `--p-control` (group) → `--p-default`. State the tier's _deviations_ in `overrides` and let
  everything else inherit. (Watch for a hard-coded fallback that is also dead: `--br-control` is
  always defined, so the `0.25rem` in `var(--br-control, 0.25rem)` never applied.)

  **Small-label patterns split by behaviour:** `badge` is a **static** label (status, count,
  category); `tag` is an **editable and/or dismissable** one (`.tag__remove`, `.tag__icon`, and the
  `.tag-list` field). "chip" is retired as vocabulary. Their shared group is named **`label`** —
  deliberately _not_ `tag`, because a pattern whose key equals its group name collides in the token
  namespace (`--br-tag` would be both the group token and the `tag` pattern's override hook, making
  the pattern's `-group` alias unreachable). Keep group names distinct from pattern names.

  **Two button tiers, by intent.** `.cta` is _persuasion_ — filled, bolder, larger padding, lift on hover; it's a class, so it works on any element (`<a class="cta">` is the common case, since CTAs usually navigate). `btn` is _affordance_ — it only signals "this is interactive", and pairs `element: "button"` with `class: "btn"` so it emits one `:where(button, .btn)` rule: a bare `<button>` gets it with no class, `.btn` carries it to other tags, and because the rule sits at zero specificity **any** explicit class overrides it (`.cta`, or a component's own `.dialog__close`). A pattern that sets both `element` and `class` is the general mechanism here; `link` does the same to emit `:where(a, .link)`. Use `fill: true|false` to state whether states/roles drive `background-color` (+ `on-solid` text) or `color` — `btn` must set `fill: false` because its `background: transparent` would otherwise be inferred as a fill.

  **A state pseudo goes INSIDE the `:where()`, not after it.** `:where()` zeroes the element, but a
  pseudo-class appended outside it still carries weight — so `:where(a, .link):hover` is **0-1-0**, not
  0-0-0, and the zero-specificity promise silently held for a pattern's base rule while breaking for
  every one of its state rules. That tied `link`'s hover colour with `.cta` / `.cta-<role>` (both
  0-1-0) and won on source order, because `link` is emitted after `cta` — so every `<a class="cta">`
  flipped to dark link-coloured text on its filled background mid-hover. `:where(a:hover, .link:hover)`
  is a true 0-0-0. This is why `stateRules` takes a selector **builder** keyed on the pseudo rather
  than a finished selector string; a role class (`extra`) still sits outside the wrapper, since a
  variant is meant to carry a class's weight.

- **animation-effects** (`animation-effects.css`) — the effect + journey classes from `animations` in the JSON (`.fade-in`, `.reveal-left`, `.<parts>-journey`, …), each a pure value layer (`--_anim` + `--<prop>-from/-to`). Journeys are composed from `animations.journeys.base` + `compose`. Always emitted. The animation **engine** (keyframes, drivers, floats, utilities) stays hand-written in `@getvitops/core`'s `css/animation.css`.
- `dist/bricks-colors-{named,semantic}.json` — palettes for Bricks Builder's Color Manager. Each semantic entry carries `darkEnabled` + a `dark` ref so Bricks generates the dark-mode overrides on import.

The framework CSS lives in **`@getvitops/core`**: `packages/core/css/index.css` is the bundle entry; core primitives (`global.css`, `animation.css`, `layout.css`, `layout-utilities.css`, `utilities.css`) at `packages/core/css/` root; each UI pattern its own partial under `packages/core/css/patterns/` (one file per pattern — `dialog.css`, `table.css`, `cluster.css`, `overlay.css`, …). The generator produces the token layers above and bundles them with these partials (via lightningcss, in memory). Keep that split when adding files, and wire any new partial into `index.css`.

**The bundle is layered.** `bundleCss()` wraps every chunk via the `CHUNK_LAYER` map and emits
`@layer vitops.base, vitops.components, vitops.utilities;`. That is what lets a utility override
a pattern (`class="card bg-danger-muted"`) — it previously depended on source order and so
silently did nothing here while working in tailwind. **A new partial defaults to
`vitops.components`**; add it to `CHUNK_LAYER` only if it emits single-purpose utilities. Order
within a layer still matters, layer membership matters more.

Three consequences worth holding:

- **Unlayered CSS beats every layer**, so a consumer's stylesheet, an Astro scoped `<style>` or
  a Bricks-authored class wins over the framework with no `!important`. Deliberate. But a
  _reset_ must be layered and ordered first, and the order statement must be declared **before**
  the stylesheet loads — otherwise the new layer name sorts last and the reset wins. `index.html`
  demonstrates the migration.
- **lightningcss drops the standalone `@layer a, b, c;` statement** after physically reordering
  the blocks to match it. Verified: given a statement that contradicts first-appearance order, it
  reorders rather than mis-cascades. So the declaration is honoured, just normalised away — don't
  assert on its presence, assert on block order (`bundle-layers.test.ts`).
- **The tailwind format is layered too, just by Tailwind.** Its utilities are `@utility`
  definitions, which Tailwind places in its own `utilities` layer _and_ which are what make
  variants (`hover:`, `@md:`) work; its patterns go in explicit `@layer components` blocks the
  emitter writes. So the classification is the same in both — only the mechanism differs.

**One class, one classification, enforced across formats.** A pattern is `vitops.components` /
`@layer components`; a single-purpose utility is `vitops.utilities` / `@utility`. `LAYER_CONTRACT`
(`packages/generator/src/layer-contract.ts`) names a representative sample and is asserted twice —
the css half in `bundle-layers.test.ts`, the tailwind half in `format-parity.test.ts` — so the two
can't drift. Three consequences that bite when adding CSS:

- **Classify by RULE, not by file.** `layout.css` was ~75% utilities and unmapped, so its whole
  utility half lost to every pattern; `utilities.css` held the `.reveal` component family and so
  beat every pattern. Both are now split (`layout-utilities.css`, `patterns/reveal.css`). If a new
  partial mixes the two, split it rather than picking the lesser evil.
- **A utilities partial must also be in `TAILWIND_SKIP`.** Otherwise it is inlined into tailwind's
  `@layer components` — the exact inversion — and it fails _silently_, because every class in it
  already exists as an `@utility` that wins on layer anyway. `format-parity.test.ts` asserts the
  implication structurally.
- **`@utility` cannot live in a layer.** Measured: it throws `` `@utility` cannot be nested ``
  inside `@layer`, and also inside a file pulled in with `@import … layer(…)` — the layer clause is
  itself a nesting context. A `@custom-variant` is no escape hatch either; a variant applied to a
  components-layer class emits nothing, because variants attach to utility candidates only. So a
  pattern cannot be responsive-by-variant in tailwind, which is why `.split` has no `@md:split` and
  `md-flex-row` carries that job instead.
- **Never contract on Tailwind's order _within_ its utilities layer.** It is property-based and
  flips when a declaration is added: `@utility split-1-2 { flex-direction: row }` sorts after
  `flex-col`, and adding `--_split-a: 1` sorts it before. The one stable rule is that a variant
  sorts after the un-varianted utility, which is what `class="split flex-col md-split-1-2"` relies
  on. If two of our own utilities must be ordered, put both in the same css partial and say so.

Fixed, same shape as the `layout.css` split: `typography.headings`' bare-element bindings (`h1`,
`h2`, `body`) used to emit alongside `.font-<role>` into one `generated/typography.css` chunk
mapped wholly to `vitops.utilities`, so those tag rules beat every component pattern —
`<h2 class="pull-quote">` lost its font-size in css/bricks (kept it in tailwind, which put the
bindings in `@layer base` from the start). The role utilities and the element bindings are now
separate chunks: `.font-<role>` stays in `generated/typography.css` (`vitops.utilities`); the
bindings moved to `generated/typography-headings.css`, mapped to `vitops.base` — a DEFAULT for an
unstyled element, ranked below every pattern rather than above it. `LAYER_CONTRACT.base` (a new
bucket, alongside `components`/`utilities`/`tailwindOwns`) pins this as a cross-format contract so
a regression here fails a test rather than waiting to be noticed again.

### `--format` mode

The generator takes `--format <css|bricks|tailwind|design>` (default `tailwind`; `--bricks` is a back-compat alias for `--format=bricks`).

- **`bricks`** (kept working, **not actively maintained**: Bricks was the original target, the toolchain now builds EmDash/Astro sites on `tailwind`; it gets no new patterns until rebuilt on the tailwind/css foundation) — `color.css` and `type-tokens.css` are one-line stubs; Bricks provides the colour `:root` tokens, dark overrides, utility classes, fonts, and type/space scales live from the imported palette + Variables JSONs. `patterns.css`, `shadows.css`, `tokens.css`, `typography.css`, `typography-headings.css`, `animation-effects.css`, and the Bricks JSONs emit. Pattern `states` reference shadows via `"shadow": "<name>"`, compiled to `filter: drop-shadow(var(--shadow-<name>))`.
- **`css`** — same set, but `color.css`/`type-tokens.css` emit the full standalone colour + font/scale layer (self-contained; used by the docs build and non-Bricks consumers).
- **`tailwind`** — bypasses all the per-file outputs and emits **one** self-contained `dist/tailwind.css` for Tailwind v4 (Astro): `@import "tailwindcss"` + `@theme` tokens (colours, `--font-*`, `--text-*`, `--spacing-*`, `--shadow-*`, `--container-{sm,md,lg,xl}`), a dark block, `@custom-variant is-active`, and `@utility` for the bespoke families (type roles, animation effects + `flip-<fx>`, split ratios, track placement) with the animation engine + structural CSS + patterns inlined. Tailwind's own engine expands `@md:`/`hover:`/… on demand, so no pre-expanded per-breakpoint/pseudo classes are emitted; native families (`flex`/`items`/`justify`/`text`/`bg`/`p`/`gap`) come from Tailwind + `@theme`. Run via `vp run build:tailwind` (standalone; not in the default `build` chain, not piped through lightningcss).
- **`design`** — emits **one** file, `DESIGN.md`, and no CSS: the agent-facing brief in [google-labs-code/design.md](https://github.com/google-labs-code/design.md) format (YAML token front matter — `colors`/`typography`/`rounded`/`spacing`/`components` with `{group.token}` refs — then a prose body). Emitter: `packages/generator/src/design-md.ts`. Meant to be run with `--out .`, since DESIGN.md conventionally sits at a repo root beside `AGENTS.md`; run via `vp run build:design`, which writes the **tracked root `DESIGN.md`** (the one `build:*` target that doesn't write to `dist/`).

  Three things the spec can't hold, resolved the same way every time and **stated in the emitted prose** so the file is self-describing: fluid `clamp()` sizes → the **max** value (a `Dimension` is a bare number + px/em/rem); the automatic dark flip → **light values only**, with the flip explained (an agent that flattens role tokens to hexes breaks dark mode, which is the whole hazard); a `50%` radius → dropped from `rounded` and named in the Shapes prose rather than emitted as an invalid `Dimension`. Role tokens are `{colors.<hue>-<step>}` **references** into the raw ramps, not flattened hexes, so the role → ramp lineage survives — `on-solid` excepted, being a computed contrast literal. `meta.name`/`meta.description` (optional, in `design-system.json`) supply the brand name + Overview paragraph; everything else derives from the config. `design.md lint` reports zero errors on the emitted file; its ~190 `orphaned-tokens` warnings are inherent (our tokens are consumed by utility classes, not by the `components` block) and the file says so.

### Icons

Icons are named by **meaning** and resolved per configured set — `menu` becomes `fa7-solid:bars`,
`lucide:menu` or `ph:list` — so swapping sets is a config edit, not a find-and-replace. **A name
containing `:` passes through untouched**, which is the escape hatch for a set-specific glyph. The
map lives in `packages/utils/src/icons.ts` (`iconMap`, `resolveIcon`, `generateIconInclude`); the
declaration lives in the **site config**'s `icons` block, not `design-system.json`, because it
describes what a site uses rather than what the system defines.

**Weight is per-set-shape, not universal.** Phosphor keeps every weight in one collection and varies
the NAME (`list`, `list-bold`), so `ph` takes `weight`; Font Awesome splits weights across
collections (`fa7-solid` / `fa7-regular`), so there it's part of the prefix. `WEIGHTED_SETS` records
which is which, and an unknown weight throws rather than silently resolving to the regular glyph.

**The `include` map exists for one reason: SSR bundle size.** astro-icon is zero-config on a static
build but bundles _every icon in a set_ under `output: 'server'`. The `icons` option on
`vitops()` derives the list by scanning source during `astro:config:setup` — awaited **before**
the `updateConfig` that appends the icon integration, because an appended integration's own
`config:setup` runs after this hook returns, and the Vite plugin's `buildStart` is far too late. On
a static build **no `include` is passed at all**. Declared names that don't resolve throw; scanned
ones only warn (a bare unmapped name is usually a local `src/icons/*.svg`); runtime-computed names
are reported with file and line, never guessed.

Three delivery paths: `astro-icon` / `astro-iconset` for Astro, and a **build-time SVG sprite**
(`icons.svg`, opt-in via `site.icons.sprite`) for Bricks, EmDash renderers and plain HTML —
`<use href="…#ph--list">`, no JS and no icon-API call, which is what keeps it a tier-1 pattern.
Sprite ids are the qualified name with `:` → `--`, plus a set-independent `icon-<name>` alias per
semantic name so sprite markup survives a set swap. `spriteId()` in the generator and `Icon.astro`
must agree; `icon.test.ts` guards it, since a drift renders an empty box rather than erroring.
Note external-file `<use>` is **same-origin only**.

Markup is always `<span class="icon">…</span>`. `.icon` sizes in `em` via `--icon-size` and sets
`fill: currentColor`; because `.cta` and `:where(button, .btn)` are already `inline-flex` with a
`gap`, **a start/end icon is child order, not a modifier class**. Don't confuse `.icon` with
`.icon-mask`, the CSS-only adornment path behind `.link--icon::before`.

### Utility variant naming (Tailwind-aligned)

Responsive/state utilities follow Tailwind's left-to-right order in every format; CSS/Bricks swap `:` for `-`, Tailwind keeps `:` (and `@` for container queries):

| Intent           | CSS / Bricks               | Tailwind                                |
| ---------------- | -------------------------- | --------------------------------------- |
| responsive split | `md-split-1-2`             | `@md:split-1-2`                         |
| responsive align | `md-items-center`          | `@md:items-center`                      |
| hover effect     | `transition hover-fade-in` | `transition fade-in hover:flip-fade-in` |

Container breakpoints are bare prefixes (`sm-`/`md-`/`lg-`/`xl-` = 30/48/64/80rem). Base utility names mirror Tailwind (`items-*` not `align-*`), so one vocabulary spans all three formats.
