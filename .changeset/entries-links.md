---
'@getvitops/astro': minor
'@getvitops/emdash': patch
---

`vitops_entries` values that are exactly `[label](url)` render as links (`tel:`, `mailto:`, pages) instead of raw Markdown, and other values show their text with the markup flattened. `<Entries>` pairs take an optional `href`.
