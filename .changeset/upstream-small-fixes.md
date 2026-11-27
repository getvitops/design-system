---
'@getvitops/core': patch
'@getvitops/generator': patch
'@getvitops/cli': patch
'@getvitops/astro': patch
---

Small fixes from two sites' upstream reports.

- **`.section__body` no longer overflows (`css`/`bricks`/`tailwind`).** Its column track is `minmax(0, 1fr)` instead of an implicit `auto`, so one long word or an unshrinkable figure cannot push the body wider than the section.
- **The footer no longer scrolls sideways on a phone (all formats).** `.sitefooter__inner.centered` has `column-gap: 0`; the inherited 1rem gap landed between the zero-width named tracks and pushed a 390px viewport to 454px.
- **A themed form reads as a card (all formats).** `.form-block` with `tone--tint` or `tone--solid` gets padding, border and radius (`--form-block-padding` to override); an untoned form is unchanged.
- **The page has a ground (all formats).** `html` paints `--color-bg-neutral` (fallback `Canvas`). Before, the ground was the browser's own, which differs per engine and which axe treats as white, so a correct dark site reported 1.2 to 1.7:1 contrast failures for light text on every page.
- **Dark-only sites no longer apply a stored `light` choice (`@getvitops/astro`).** With `defaultColorScheme: "dark"` in the site config, `<Head />` omits the colour-scheme bootstrap. localStorage is per origin and Vitops projects share localhost ports, so a `light` saved by another site turned every untoned band white.
- **`colors.tint` is accepted in a theme (`@getvitops/generator`).** The full colours schema already took it; the theme patch schema (which `designSystem.themes.<name>` is parsed with) did not, so `vitops validate` rejected the key that `vitops docs authoring` describes.
- **The tailwind `.rhythm` block gap now includes `.form-block`, `.callout` and `.logos-block` (tailwind only).** `css`/`bricks` already had them; a parity test now keeps the two lists in step.
- **`vitops lint` (`@getvitops/cli`):** `/* vitops-lint-ignore */` on the line above a CSS rule skips it, for reuse hints on elements a block renders and a site cannot give a class. `1fr 1fr` columns now suggest `split-1-1`, which exists. `--strict` help says it is a heavy CI default.
