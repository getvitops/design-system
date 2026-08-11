---
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/astro': minor
---

Add `<wc-counter>` — animates a number from a start value to the value already in its fallback
text, on intersection. The stat/percentage figure in a media tile ("0 → 94%"), a KPI row, a
metrics band.

No consumer-facing change in this release outside `core`, `generator` and `astro` — `utils`,
`cli` and `vite` still ship in this release only because the six share one version.

**Added — `css`/`bricks`/`tailwind` (all formats):** `.counter` / `.counter__value` /
`.counter__presentation` (`patterns/counter.css`). A registered `--_n` custom property drives the
count via a plain CSS `@keyframes` animation — the interpolation and the easing curve are CSS's,
never duplicated in JS.

**Added — `wc` (`@getvitops/core`).** `<wc-counter>` parses the final value out of its own
`.counter__value` fallback text — never from a separate attribute, so the no-JS reading and the
animated reading can't disagree — and renders it back through `Intl.NumberFormat`, seeded from the
fallback text's own separators (a grouped `1,284` never animates through ungrouped intermediates).
`counter()` cannot do that part: no decimals, no locale grouping, which is the one thing here that
genuinely needs JavaScript.

- Triggers on intersection via a single shared `IntersectionObserver`, not on upgrade — a counter
  below the fold that finished before the visitor scrolled to it would have done nothing.
- `prefers-reduced-motion: reduce` means don't animate at all, checked before the observer is even
  created, with `patterns/counter.css`'s own reduced-motion query as a second belt.
- The accessible name stays the final value for the whole animation: `.counter__value` is toggled
  to the framework's `.sr-only` utility while running, never hidden — `display: none`/`visibility:
hidden` would pull it out of the accessible-name computation along with the visual hiding, and a
  screen reader must never be read ~60 intermediate numbers. The animated text lives in a separate
  `aria-hidden` presentation span it never reaches.
- `data-from` (default `0`), `data-duration` (ms, default `1200`), `data-easing` (`linear` |
  `ease-in` | `ease-out` | `float-sine` | `float-bounce` — maps onto the real
  `--custom-ease-*`/`--ease-float-*` tokens, so a curve edited in `animation.css` cannot drift out
  of step with this element), `data-decimals` (inferred from the fallback text when absent).
- Never leaves an intermediate value on screen as the resting state: disconnecting mid-animation
  restores the fallback immediately, and it was never mutated in the first place — only the
  presentation span was ever written to.

**Added — `astro`.** `<Counter value="94%" />` emits its own `<wc-counter>` — do NOT wrap it in
one, same rule as `Gallery`/`Carousel`/`Tree`. `value` is the only source of the final figure;
there is no separate `to` prop, for the same one-source-of-truth reason the element itself parses
its fallback rather than taking a duplicate attribute. `enhance={false}` emits the bare fallback
for a page that cannot run `elements.js`.
