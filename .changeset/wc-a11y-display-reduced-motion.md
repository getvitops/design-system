---
'@getvitops/core': minor
---

**Accessibility and layout fixes for the web components.**

- **`<wc-entries>`: the column selector is no longer `aria-hidden`.** Its buttons are real and
  focusable, so hiding the `<nav>` left a keyboard user on a control that assistive tech never
  announced. It is now exposed as a `Column selector` navigation. The generated table stays
  `aria-hidden` (it duplicates the `<dl>`, which is what assistive tech reads) and contains nothing
  focusable.
- **`prefers-reduced-motion` is honoured by programmatic scrolling.** `<wc-carousel>` (prev/next and
  marker clicks) and `<wc-tree>` (deep-link scroll) always passed `behavior: 'smooth'` to
  `scrollIntoView`, which overrides the stylesheet's `scroll-behavior` and so ignored the setting.
  They now scroll instantly when it is set, reading the preference at call time.
- **Pre-upgrade `display` for six more elements** — `wc-entries`, `wc-image-compare`,
  `wc-split-panel`, `wc-multi-field`, `wc-dismissable` (all `block`), `wc-copy` (`inline-flex`) and
  `wc-marquee` (`block`, as a fallback under the `.marquee` class). Each is declared in its pattern's
  partial inside `:where()` (zero specificity, so any consumer rule wins) and matches the element's
  upgraded `:host`, so registering no longer shifts layout. `wc-split-panel`, which declared no
  display at all, is now a block after upgrade too — a visible change if a layout relied on it being
  inline. `wc-counter` is deliberately left inline.
- **A dismiss button no longer shows before it can work.**
  `wc-dismissable:not(:defined)` hides `.banner__close`, `.notification__close` and `[data-dismiss]`
  buttons, so with no JS a banner has no dead ✕. (`:not(:defined)` is also true until `elements.js`
  has run, so the button appears on upgrade.)

Formats reached for the CSS changes: all formats (the partials are components-layer patterns, inlined
by the tailwind format as well). Other packages in the `fixed` group: No consumer-facing change in this
package.
