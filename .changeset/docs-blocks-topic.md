---
'@getvitops/cli': minor
'@getvitops/emdash': minor
---

`vitops docs blocks` prints every EmDash block type and its fields, so an agent can write valid Portable Text without reading the plugin source. It reads `@getvitops/emdash` from the project (and says so if it isn't installed); `@getvitops/emdash` exports `renderBlocksDoc()` for it.
