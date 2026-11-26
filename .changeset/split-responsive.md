---
'@getvitops/core': minor
'@getvitops/generator': minor
'@getvitops/emdash': patch
---

`.split-responsive` stacks a `.split` below `md` (48rem of the nearest container) with no utility class, so a block or any markup can ask for it in every format. A block cannot emit `md-split-1-2` (css/bricks only) or `@md:split-1-2` (Tailwind scans source, and a block's output is not source). `split-1-1` now exists as a ratio, with its breakpoint forms, and `vitops lint` flags a `split-<a>-<b>` class the framework does not define (`@md:split-1-1` used to lint clean and do nothing). The hero's split layout emits `split split-responsive`, so it no longer squeezes into a narrow column on a phone. CSS: **all formats**.
