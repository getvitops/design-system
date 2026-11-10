---
'@getvitops/emdash': minor
'@getvitops/cli': minor
'@getvitops/core': patch
'@getvitops/generator': patch
'@getvitops/create': patch
---

Build correctness and gaps from the second upstream round.

- **`@getvitops/emdash`: fixes a circular import that emptied the plugin block map in the static build.** `Section.astro` and `WidgetArea.astro` imported `emdash/ui` statically, which imports `virtual:emdash/block-components`, which is `@getvitops/emdash/astro` again. Depending on import order, every `vitops_*` block inside a section body was dropped from prerendered pages with only a `PortableText [components.type] is missing …` warning. Both now import it lazily, and a test fails if any renderer imports `emdash/ui` statically. No code change needed in sites.
- **`@getvitops/cli`: `vitops emdash build`** runs `astro build` and then `check-prerender`, and fails when the build reports a block type with no component (reported once per type). The template's `build`, `deploy` and `deploy:dev` scripts use it; existing sites replace `astro build && vitops emdash check-prerender` with `vitops emdash build`. `check-prerender` also warns (fails with `--strict`) on a page without exactly one `<h1>`.
- **`@getvitops/emdash`: `vitops_hero` and `vitops_section` heading level** accepts `h1`–`h6` and `p` (a heading that is styled but not in the outline). The hero defaults to `h1`; set the level to `2` on a page whose layout already renders an `h1` (the template's seed does).
- **`@getvitops/emdash`: `vitops_logos`** shows an entry's name as text (`.logos__name`) when it has no image. `@getvitops/core` adds the rule (all formats).
- **`@getvitops/emdash`: an empty content widget** (no text, no blocks) no longer renders its title, and an area whose widgets are all empty renders nothing.
- **`@getvitops/create`:** the template's `pages` collection gets `urlPattern: "/{slug}"` (the sitemap listed `/pages/<slug>`, which 404s; existing sites change it under Content Types), and `.gitignore` ignores only `src/styles/tailwind.css` and `tokens.json`, so site CSS kept in `src/styles/` is committed.
- **`@getvitops/emdash`: per-item colour.** The rows of `vitops_cards`, `vitops_stats`, `vitops_steps` and the hero's `cards` take their own `tone` / `color` (blank inherits the block's), so one block can hold a pine item and an amber one. Hero cards also take an `eyebrow` and a button (`ctaLabel` / `ctaHref`; with a button the card is no longer a stretched link).
- **`@getvitops/emdash` / `@getvitops/core`: solid fills read.** A fill chosen by `color` (hue and step) takes its text from the fill, not a fixed white: light steps get the hue's darkest step, and browsers with `contrast-color()` compute it exactly (`.tone--auto-on`, all formats). The tint from `color` is light-scheme only; use a `tone` role where the site has a dark theme.
- **`@getvitops/core`: `.counter__value.sr-only`** hides itself, so a build that never emitted the `.sr-only` utility no longer shows a counting figure twice (all formats).
