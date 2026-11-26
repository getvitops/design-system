---
'@getvitops/emdash': minor
---

`themeAttrs(theme, className?)` takes the element's own classes as a second argument and returns one merged `class`. Spreading it next to a literal `class` emits two `class` attributes, and the browser keeps only the first, so the backdrop silently disappeared. The building-pages skill and the docblock show the merged form. Existing one-argument calls are unchanged.
