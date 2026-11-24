---
'@getvitops/core': patch
'@getvitops/generator': patch
---

**`interpolate-size: allow-keywords` is now set once, page-wide, in the animation engine.** It used to be declared on `:root` inside `patterns/reveal.css`, behind an `@supports` block, while `animation.css` and `patterns/details.css` described it as living elsewhere (`utilities.css`). The declaration now sits in `animation.css` as a plain `:root` rule, which every format reads (the tailwind format skips `global.css`, so that was not an option). An engine that does not know the property drops it, so `auto` heights resize instantly there, exactly as before. The `@supports` guards on `.transition` and `.reveal-h` are unchanged.

Affects all formats equally. No class, token or markup change, and nothing to migrate. No consumer-facing change in `@getvitops/config`, `@getvitops/utils`, `@getvitops/cli`, `@getvitops/vite` or `@getvitops/astro`.
