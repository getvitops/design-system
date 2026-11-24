---
'@getvitops/generator': minor
---

Add `@getvitops/generator/preview`: `previewCss(config)` returns the generated token layers (colour, shadows, type, spacing, tokens, typography, patterns, animation effects) as one stylesheet, each in the bundle's cascade layer, from a browser or a Worker. It exists so an edited config can be previewed live without a build. To make that possible `generate.ts` is split in two: `build.ts` holds the pure `build()` and imports nothing from `node:*` or lightningcss, and `generate.ts` keeps the file reading, lightningcss bundling and writing, and passes `build()` the two Node-only pieces by injection (the Bricks id hash and the tailwind emitter). `generate()` output and every existing export are unchanged. Not CSS; no format affected. Other fixed-group packages: no consumer-facing change.
