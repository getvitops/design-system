# @getvitops/generator

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
