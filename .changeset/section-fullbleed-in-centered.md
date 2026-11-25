---
'@getvitops/core': patch
---

A `.section` that is a direct child of a `.centered` parent (the emdash template's `<main>`) now takes the full-bleed track, so its tone and backdrop span the viewport instead of stopping at the reading width. Its content is still laid out on its own inner `.centered` tracks. Reaches all formats.
