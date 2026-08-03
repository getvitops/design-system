---
'@getvitops/generator': minor
'@getvitops/core': minor
---

New `gap-*` utilities over the fluid space scale, in all three formats.

`gap-<name>`, `gap-x-<name>` (column) and `gap-y-<name>` (row), for every step of your
`spaceScale` — `gap-2xs` … `gap-7xl` — each breakpoint-prefixable (`md-gap-l` in css/bricks,
`@md:gap-l` in tailwind).

There was no gap utility at all before. `vitops docs css` advertised a `g` class that was never
emitted, so the honest answer for a css or bricks consumer was an inline `style="gap: …"`. Tailwind
did not fill the hole either: the fluid steps are deliberately kept **out** of Tailwind's
`--spacing-*` namespace, because named keys there shadow the size scales (`max-w-7xl` would resolve
to `var(--spacing-7xl)` and collapse layouts), so `gap-l` was not something Tailwind could derive.
Measured against tailwindcss@4.3.3: the emitted `@utility gap-l` is honoured, accepts variants, and
coexists with the built-in numeric `gap-4`, which keeps Tailwind's own multiplier.

The whole matrix is emitted rather than a plausible subset. An undefined step produces no rule and
no error in either format, so a missing `md-gap-x-2xl` would be indistinguishable from a working
one.

In the css and bricks bundles these land in `vitops.utilities`, so `class="cluster gap-l"` beats
the pattern's own gap.
