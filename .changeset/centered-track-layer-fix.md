---
'@getvitops/generator': patch
---

Fix Tailwind output: the `.centered > *` default (`grid-column: measure`) was emitted unlayered,
which in Tailwind v4 outranks every layer — so track utilities (`.spotlight`/`.breakout`/
`.fullbleed`) never overrode it and all `.centered` children fell back to `measure`. Emit the
structural rules (and the animation engine + patterns) in `@layer components` so the track/spacing
`@utility` classes (utilities layer) win.
