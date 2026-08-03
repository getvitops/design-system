---
'@getvitops/emdash': minor
---

**Breaking:** this package now depends on the toolchain instead of pretending it doesn't.

It shipped with no `@getvitops/*` dependency at all, on the reasoning that the independence let it
version separately from the fixed toolchain group. That reasoning stopped being true when the blocks
started rendering from the generated SVG sprite: `vitops.actionLink` emits
`<use href="/vitops/icons.svg#icon-menu">`, and those ids only exist if the site's toolchain built
the sprite with the matching semantic vocabulary. Installed against an older toolchain the block
rendered an **empty box** — no install-time error, no console warning, nothing to grep for.

Two changes make the coupling real:

- **`@getvitops/utils` is a hard dependency**, and `SEMANTIC_ICON_OPTIONS` is now derived from its
  `iconMap` rather than generated into `src/icon-options.ts` by a script. The editor's icon list and
  the sprite's aliases are one source, so they cannot drift. `pnpm gen:icons` is gone; there is
  nothing left to regenerate.
- **`@getvitops/astro` is a peer** (`>=2.0.0`). It is the integration that emits the sprite into
  `public/`, and it belongs to the site — a hard dependency would let a version mismatch install two
  copies of an Astro integration rather than telling you about it.

**Migration:** install or upgrade `@getvitops/astro` (and the rest of the toolchain, which moves in
lockstep) to `2.x` alongside this release. If your package manager reports an unmet peer on
`@getvitops/astro`, that is this change working — it is the error that replaced the empty box.
