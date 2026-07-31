---
type: "Config Reference"
title: "Vitops — design-system.json authoring reference"
description: "Every field of the design-system.json config, generated from the published JSON Schema so it always matches validation."
resource: "design-system.json"
tags: [config, schema, authoring, design-system]
generator: "@getvitops/generator"
---

# `design-system.json` authoring reference

The single source of truth every output format is generated from. Each consumer authors
their own config — there is no shared canonical token set. The field docs below are
rendered from the published JSON Schema, so they always match what `vitops validate`
enforces.

- Set `"$schema": "https://unpkg.com/@getvitops/generator/schema.json"` in the config for editor autocomplete + validation.
- Scaffold a starter config with `vitops init`; check one with `vitops validate`.
- The *why* behind each section: [colour system](concepts/color.md),
  [type & space scales](concepts/scales.md), [component patterns](concepts/patterns.md).
- What each output format does with these tokens: [formats.md](formats.md).

## `colors`

The colour system (the only required section): `palette` hues become generated OKLCH scales; `roles` map semantic roles onto those hues, from which all functional tokens and dark mode derive.

- `palette` (map, required) — Palette hues by name. Each becomes an 11-step numeric OKLCH scale (`--color-<hue>-50…950`).
  - `<name>` (one of) — A palette hue, authored one of two ways: `{ seed, anchors? }` generates an 11-step numeric OKLCH scale (50…950) from the seed, or `{ tones }` supplies a fixed brand kit used verbatim.
    - *one of* — Seeded hue: the 11-step scale is GENERATED in OKLCH from `seed` (anchors pin specific steps).
      - `seed` (string, required) — Seed colour (hex or oklch()). An 11-step numeric scale (50…950, tinted near-white → tinted near-black) is generated in OKLCH from it; the seed is preserved at its natural step.
      - `anchors` (map) — Step → colour overrides (hex or oklch()) that pin specific steps of the generated scale; the remaining steps interpolate around them.
    - *one of* — Fixed hue: authored brand tones used verbatim; no generation.
      - `tones` (one of, required) — Fixed brand kit: authored tones placed verbatim at their nearest steps plus tinted off-white/off-black endpoints; no interpolation. Either an ordered light → dark array or a step → colour map.
- `roles` (map, required) — Maps semantic role names onto palette hues. Role names are ARBITRARY — add a key and the generator emits that role's full FUNCTIONAL token set (`--<role>-{bg,bg-muted,border,border-bold,solid,solid-bold,on-solid,text,text-muted,text-x-muted}`), its emphasis stops, its dark-mode flip and its utility classes. Dark mode flips automatically; there is no per-appearance scheme grammar. Six roles are a required core, because the shipped framework CSS references them with no fallback: brand-primary, danger, neutral, surface, ui-primary, warning. Conventional additions are ui-secondary/accent, brand-secondary, info and success.
- `utilities` (array of bg | text | border | outline | fill | stroke) — Which colour utility-class families to emit (`bg-*`, `text-*`, `border-*`, `outline-*`, `fill-*`, `stroke-*`). Defaults to bg, text, border.

## `shadows` *(optional)*

Named shadows → `--shadow-<name>` tokens and `.drop-shadow-<name>` utilities. Values are shadow parameter lists (offset/blur/colour), applied via `filter: drop-shadow(…)`.

## `fonts` *(optional)*

Raw font stacks by name, emitted as `--font-<name>` tokens (referenced by `typography.families`).

## `typeScale` *(optional)*

Fluid modular TYPE scale → `--text-<name>` tokens, consumed by typography roles and text-size utilities.

- `base` (string, required) — Anchor size (a CSS length, e.g. "1rem") — the value at `baseStep`.
- `ratio` (number, required) — Modular ratio between adjacent steps at large viewports.
- `steps` (number) — Token count when `names` is absent (steps are then named 1..steps).
- `names` (array of string) — Step names, smallest → largest (e.g. ["xs","sm","md",…]); each becomes a token suffix.
- `baseStep` (number) — 1-based index of the step whose value is `base`.
- `baseline` (string) — Named step used as the fluid pivot / GUI scale centre (defaults to `baseStep`).
- `fluid` (object) — Makes the scale fluid: each step compiles to a clamp() that interpolates from `minRatio` at `minVw` to `ratio` at `maxVw`.
  - `minVw` (string, required) — Viewport width (CSS length) where fluid scaling bottoms out.
  - `maxVw` (string, required) — Viewport width (CSS length) where fluid scaling tops out.
  - `minRatio` (number, required) — Modular ratio at/below `minVw` (usually < `ratio`).

## `spaceScale` *(optional)*

Fluid modular SPACE scale → `--space-<name>` tokens, consumed by spacing/gap utilities and vertical rhythm.

- `base` (string, required) — Anchor size (a CSS length, e.g. "1rem") — the value at `baseStep`.
- `ratio` (number, required) — Modular ratio between adjacent steps at large viewports.
- `steps` (number) — Token count when `names` is absent (steps are then named 1..steps).
- `names` (array of string) — Step names, smallest → largest (e.g. ["xs","sm","md",…]); each becomes a token suffix.
- `baseStep` (number) — 1-based index of the step whose value is `base`.
- `baseline` (string) — Named step used as the fluid pivot / GUI scale centre (defaults to `baseStep`).
- `fluid` (object) — Makes the scale fluid: each step compiles to a clamp() that interpolates from `minRatio` at `minVw` to `ratio` at `maxVw`.
  - `minVw` (string, required) — Viewport width (CSS length) where fluid scaling bottoms out.
  - `maxVw` (string, required) — Viewport width (CSS length) where fluid scaling tops out.
  - `minRatio` (number, required) — Modular ratio at/below `minVw` (usually < `ratio`).

## `patterns` *(optional)*

Component patterns and their token cascade: `defaults` → `groups` → per-pattern `overrides`, plus shape (`radii`) and z-index primitives.

- `defaults` (map) — Cascade-wide fallback tokens, emitted as `--<prop>-default`.
- `radii` (map) — Shape primitives, emitted as `--br-<name>` (referenced by pattern bases).
- `groups` (map) — Group-level tokens, emitted as `--<prop>-<group>`; patterns opt in via their `group` key.
  - `<name>` (map) — A CSS declaration block: property → value. Values stay strings (they can be hex, var(), clamp(), keywords, …); the generator, not the schema, interprets them.
- `z` (map) — Z-index tiers → `--z-tier-<name>`.
- `items` (map) — The component patterns to emit, keyed by name.
  - `<name>` (object) — One component pattern (button, link, badge, card, …): base declarations + interaction states + semantic role variants, resolved through the pattern token cascade.
    - `group` (string) — Token-cascade group this pattern belongs to (e.g. tag / control / panel); base declarations resolve through `--<prop>-<group>` before `--<prop>-default`.
    - `overrides` (map) — Per-pattern token overrides, emitted as `--<prop>-<name>-group` values.
    - `element` (string) — Style at element level via zero-specificity `:where(<element>)` (instead of, or alongside, a class).
    - `class` (string) — Class name to emit (defaults to the pattern's key when no `element` is set). Combined with `element`, the pattern emits one zero-specificity `:where(<element>, .<class>)` rule so the class works on any tag and any explicit class overrides it.
    - `fill` (boolean) — Whether this pattern is colour-filled (states/roles drive `background-color` + `on-solid` text) or text-coloured (they drive `color`). Defaults to true when `base` declares a background.
    - `default_role` (string) — Semantic colour role applied to the bare/default variant.
    - `base` (map) — Base CSS declarations. Geometry properties (padding, border-radius, border, box-shadow, font-size) are wrapped in per-pattern override hooks (`--p-<name>`, `--br-<name>`, `--b-<name>`, `--ds-<name>`, `--fs-<name>`) so consumers can restyle one pattern by setting one variable.
    - `states` (map) — Interaction states (hover / active / focus-visible), each a map of shortcuts: `step` (intensify fills/text by n emphasis stops), `scale` (transform scale), `lift` (translateY + shadow), `shadow` (a shadow name → drop-shadow(var(--shadow-<name>)), or true → lift shadow), `ring` (focus ring), or raw `css` declarations. Hover rules are wrapped in `@media (hover: hover)`.
    - `roles` (array of string) — Semantic colour role variants to emit as `<pattern>-<role>` classes (fills use the role solid / on-solid tokens).

## `typography` *(optional)*

Typography: family aliases, semantic type roles (→ `font-<role>` classes), and the heading-element → role mapping.

- `families` (map) — Role-facing family aliases → CSS font values, usually referencing the top-level `fonts` tokens (e.g. "var(--font-display)").
- `roles` (map) — Semantic type roles (display, title, heading, body, quote, caption, eyebrow, code, lead, footnote, tag, …), each emitted as a `font-<role>` class.
  - `<name>` (map) — An open bag of CSS-ish keys (family / size / weight / line-height / tracking / transform / decoration / text-wrap / …); the generator maps known keys and passes the rest through.
    - `<name>` (string | number)
- `headings` (map) — Maps heading elements (h1…h6) to type roles so bare headings pick up role styling.

## `animations` *(optional)*

Animation effect + journey classes (pure value layers). The animation engine itself — keyframes, drivers, floats, utilities — is static framework CSS, not configured here.

- `effects` (map) — Effect classes to emit (`.fade-in`, `.reveal-left`, …), keyed by class name.
  - `<name>` (object) — A named animation effect class — a pure value layer (`--_anim` + `--<prop>-from/-to`) over the static keyframe engine.
    - `kf` (string, required) — Keyframe family driving the effect: composite (transform/opacity), paint, or layout.
    - `css` (map) — Extra literal declarations merged into the effect class as-is.
      - `<name>` (string | number)
    - `vars` (map) — Effect endpoint variables (`--<key>: <value>`, e.g. opacity-from, translate-y-to) that override the keyframe defaults.
      - `<name>` (string | number)
- `journeys` (object) — Multi-part journey classes composed from `base` building blocks.
  - `base` (map) — Named journey building blocks: part name → var map.
  - `compose` (array of array) — Combinations of base parts, each emitted as a `.<parts>-journey` class.
