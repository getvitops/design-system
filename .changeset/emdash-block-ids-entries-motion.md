---
'@getvitops/emdash': patch
'@getvitops/core': patch
---

EmDash gallery and carousel blocks now derive their element id from the block's `_key`, so two blocks with the same label on one page no longer open each other's dialog. `<wc-entries>` column navigation now honours `prefers-reduced-motion`.
