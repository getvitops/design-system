---
'@getvitops/emdash': minor
'@getvitops/core': patch
---

`vitops_gallery` gains a **Thumbnail size** field (small, medium, large), and a gallery with a single image fills its column instead of showing one 150px thumbnail (`.gallery:has(> li:only-child)`). The block's `style` field still wins. CSS: **all formats**.
