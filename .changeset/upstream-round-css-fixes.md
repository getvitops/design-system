---
'@getvitops/core': patch
'@getvitops/generator': patch
'@getvitops/astro': patch
---

Fixes from the vitops.ca build, none of which need a code edit in a consumer.

- **Section body links** no longer stretch: a bare `<a>` in `.section__body` is sized to its label like a button. `.subgrid` and `.pricing-grid` use `minmax(0, 1fr)` tracks so wide content cannot overflow on mobile. (css/bricks/tailwind: all formats)
- **`.rhythm`** gives `.form-block`, `.callout` and `.logos-block` the block gap. (all formats; the tailwind output carries the same selector list)
- **`<select>`** without `appearance: base-select` drops the native arrow so it no longer shows two chevrons. (all formats)
- **`<Masthead width="content">`** keeps its row on the page track (`.masthead__row:not(.centered)` is the only row forced to `block`). (all formats)
- **`vitops_logos` text-only entries** size through `--heading-fs`, so they are no longer 45px. (all formats)
- **`.btn` on an `<a>`** is no longer underlined: a pattern on the bare `a` element (`link`) is now emitted before the other element patterns, whatever order `patterns.items` is authored in, so `.btn` wins the tie. (generator; css/bricks/tailwind)
- **`<SiteFooter>`** puts a space between the year and the name and moves the legal links onto the copyright row (`.sitefooter__base`). Sites that styled `.sitefooter__group--legal` inside `.sitefooter__nav` should retarget it. (astro)

`@getvitops/core` also gains `.list--check` (a ticked, flush list) in `list.css`. No consumer-facing change in `@getvitops/cli`, `@getvitops/vite`, `@getvitops/utils` or `@getvitops/config` beyond the fixed-group bump.
