---
'@getvitops/core': major
'@getvitops/generator': major
---

The framework now ships a border-box reset.

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}
```

**This is a behavioural change for the `css` and `bricks` formats.** If your project does not
already set border-box — Tailwind's preflight does, as does normalize and almost every modern base
stylesheet — elements with padding or a border now measure their declared width inclusive of it, so
some boxes will come out narrower than before. The `tailwind` format is unaffected: preflight
already did this.

The framework used to refuse this on the grounds that a global reset silently reflows consumer
layouts, and that reasoning was sound when nothing was layered. Two things changed:

- **It is layered.** The rule lives in `vitops.base`, the lowest of the three framework layers, so
  it loses to any unlayered consumer CSS. The opt-out is one rule in your own stylesheet:
  `*, *::before, *::after { box-sizing: content-box }`.
- **Patterns are only correct under it.** `.split`'s ratio is a flex basis, which sizes the border
  box; under content-box a padded column came out wider than its sibling by exactly its padding.
  Stating the assumption once beats every pattern re-asserting it and the ones that forget being
  quietly wrong.
