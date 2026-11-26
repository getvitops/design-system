---
'@getvitops/core': patch
'@getvitops/generator': patch
---

Tooltips now appear next to their trigger and no longer dim the page. `inset-block-start: anchor(block-end)` is not a valid `anchor()` side, so the declaration was dropped and the tooltip rendered at the top-left of the viewport (off-screen on a scrolled page); it is now `anchor(end)`. The shared popover scrim (`::backdrop`) is also cleared for `.tooltip`, which is a hint, not a modal. all formats.
