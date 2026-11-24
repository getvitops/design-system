---
'@getvitops/core': patch
'@getvitops/cli': minor
'@getvitops/emdash': minor
'@getvitops/create': minor
'@getvitops/skills': patch
---

**`<main>` is a landmark, not a layout: remove `centered` from it.** With `<main class="centered">` every section, band and hero inside is a grid item in the reading-width track, so a tone or backdrop stops at the text column and each block had to opt out. Bands now own their width.

**Breaking, with a migration (`@getvitops/cli`).** `vitops lint` reports `<main class="centered …">` as an error in any `.astro`/`.html`/`.tsx`/`.vue`/`.svelte` file, and `vitops lint --fix` removes the `centered` token (other classes stay). Then wrap hand-written page content in `<div class="centered">`; the fix cannot do that for you, because it is a per-page decision. Content rendered through `<VitopsContent>` needs nothing.

- `@getvitops/emdash`: `<VitopsContent>` wraps each run of plain blocks (before, between or after bands) in `<div class="centered rhythm">`. A split hero in such a run still goes edge to edge.
- `@getvitops/create`: both templates' layouts render `<main id="main">`; their pages put `centered` on the page content instead. Existing sites keep their layout until `vitops lint --fix` is run.
- `@getvitops/core` (all formats): the `.centered > .section { grid-column: fullbleed }` rule added in alpha.10 is removed. It only compensated for a `.centered` `<main>`, which is now the thing `vitops lint --fix` removes. A layout that still has `<main class="centered">` holds its sections to the reading width again until migrated.
- `@getvitops/skills`: `emdash-building-pages` explains the rule.
