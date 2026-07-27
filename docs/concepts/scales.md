---
type: "Design Concept"
title: "Vitops type & space scales — fluid modular scales"
description: "How typeScale and spaceScale compile to clamp()-based fluid modular scales, and which utilities consume the resulting tokens."
resource: "design-system.json"
tags: [typography, spacing, fluid, modular-scale, design-system]
generator: "@getvitops/generator"
---

# Type & space scales

Both scales share one model (authored in `design-system.json` as `typeScale` /
`spaceScale` — see [authoring.md](../authoring.md)): a **fluid modular scale**.

## The model

- `base` anchors the value at `baseStep`; every other step is a power of the `ratio`
  away (step n = base × ratio^(n − baseStep)).
- With `fluid`, each step compiles to a **`clamp()`**: the scale uses `fluid.minRatio`
  at/below `fluid.minVw` and grows to `ratio` at `fluid.maxVw`, interpolating between —
  so large steps spread apart on wide viewports and compress on phones, with no
  breakpoint jumps. `baseline` names the pivot step that stays closest to `base`.
- `names` become the token suffixes.

- **Type**: base `1rem` at step `m`, ratio 1.2 (1.12 below 22.5rem); steps `2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`, `7xl`.
- **Space**: base `1rem` at step `m`, ratio 1.25 (1.2 below 22.5rem); steps `2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`, `7xl`.

## What consumes them

- **Type**: `--text-<name>` tokens → typography role sizes (`font-<role>` classes,
  heading defaults) and text-size utilities.
- **Space**: `--space-<name>` tokens → gap (`g`), spacing utilities, and `rhythm`
  (relationship-based vertical margins between headings, paragraphs, lists, media).
  Prefer `rhythm` for vertical flow over per-element margins.
- In the `tailwind` format these stay in their own namespaces (`--text-*` via `@theme`,
  `--space-*` as plain vars) — see [formats.md](../formats.md) for why `--spacing-*` is
  deliberately not used.
