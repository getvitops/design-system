---
'@getvitops/generator': minor
'@getvitops/config': minor
'@getvitops/core': minor
'@getvitops/astro': minor
---

**Added a high-contrast layer and a toggle for it.** WCAG 2 AA is the floor; this is the route above it, and the G174 route for a brand palette that cannot reach it.

- **A third appearance axis (css and tailwind formats; Bricks supplies its own colour tokens, so there is nothing to re-point there).** `generate()` now emits a layer that answers `@media (prefers-contrast: more)`, `:root[data-contrast="more"]` and the `.contrast-toggle` checkbox. It is not a `themes` entry: like dark mode it re-points the role tokens, so it composes with light, dark and the OS-preference block. Text walks to 7:1, borders collapse onto the icon token, solids walk until `text-on-<role>` clears 7:1, and `--surface-glass` becomes opaque. `data-contrast="standard"` opts a visitor out of the media query. The layer itself must clear the baseline bars (4.5:1 text, 3:1 non-text) or `generate` fails; missing 7:1 only warns.
- **`site.accessibility.contrastToggle: true`** declares that the site ships the toggle. A baseline contrast miss then **warns instead of failing**, but only for a role whose high-contrast layer conforms. Default `false`.
- **`<ContrastToggle />`** (`@getvitops/astro/components/ContrastToggle.astro`) emits `<wc-contrast-toggle>` around a plain `<label class="contrast-toggle"><input type="checkbox">`. The checkbox works with no JavaScript; the element adds starting checked under `prefers-contrast: more` and remembering the choice behind the `preferences` consent category. `core/css/global.css` also gives the layer a 3px outline and drops `backdrop-filter`.
- **`<Head contrast />`** restores a remembered choice before first paint. Opt-in, and a separate inline script from the colour-scheme one on purpose: changing that script would change its hash and break the dark-mode bootstrap on every site that pins it in a CSP. A site with a hash-pinned policy adds `inline: { contrast: true }` to `contentSecurityPolicy()`.

Pattern CSS (`contrast-toggle.css`) reaches **all formats**; the token layer it switches reaches **css and tailwind only**, so the toggle is inert under `bricks`.

No consumer-facing change in `@getvitops/utils`, `@getvitops/cli` or `@getvitops/vite`.
