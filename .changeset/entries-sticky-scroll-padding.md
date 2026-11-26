---
'@getvitops/core': patch
---

**`<wc-entries projection>`: the column nav no longer scrolls the chosen column under the sticky row titles.** `WCEntries` now sets `--_entries-sticky-width` on the scroll wrapper from the sticky first column's width, so the existing `scroll-padding-inline-start` clears it. JS bundle only, all formats (no CSS output change). No consumer action needed.
