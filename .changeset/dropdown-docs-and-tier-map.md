---
'@getvitops/generator': patch
'@getvitops/core': patch
'@getvitops/utils': patch
'@getvitops/cli': patch
'@getvitops/vite': patch
'@getvitops/astro': patch
---

**Docs: a dropdown is the Popover API plus anchor positioning, not a component.** The `dropdown` entry in the component manifest now says so and gives the recipe (`popovertarget` trigger, `[popover]` panel, `anchor-name` / `position-anchor`, `.dropdown--show-on-hover` for hover reveal). `dropdown-trigger`, `dropdown-menu` and `dropdown-icon` are now listed under the `nav` entry, where their CSS lives (`patterns/nav.css`), instead of `dropdown-menu` being attributed to `dropdown.css`. No CSS changed in any format, and nothing was removed or renamed.

`@getvitops/core`, `utils`, `cli`, `vite` and `astro` — no consumer-facing change in these packages.
