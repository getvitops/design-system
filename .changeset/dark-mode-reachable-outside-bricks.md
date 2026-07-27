---
'@getvitops/cli': patch
---

Make the dark-mode flip reachable outside Bricks.

The dark functional-token block was emitted under `:root[data-brx-theme="dark"]` only.
`data-brx-theme` is Bricks' own attribute — Bricks sets it, nothing else does — so on every other
target the dark flip was unreachable. In particular the shipped `<color-scheme-toggle>` web
component writes `documentElement.dataset.theme` (i.e. `data-theme`), so clicking "Dark" set an
attribute no rule matched and the page stayed light.

The block now matches `:root[data-brx-theme="dark"], :root[data-theme="dark"]`, which fixes the
component everywhere without changing what Bricks already does. No migration needed.

Note this covers the _explicit_ choice only. There is still no `prefers-color-scheme` block, so the
toggle's "System" position resolves to light. Adding one would flip every existing consumer site
dark for dark-OS users, which is a product decision rather than a bug fix.
