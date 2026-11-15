---
'@getvitops/core': minor
'@getvitops/astro': minor
---

Add `<wc-config-preview>` (`@getvitops/core/config-preview`, ~1.1 KB gzipped, Lit-free) and `<ConfigPreview>`: a config form's edits are previewed on the page they are made on. On each `config-change` it regenerates the design system's token layers in the browser (`@getvitops/generator/preview`, a dynamic import fetched on the first edit) and injects them after the page stylesheet; a seed the generator would refuse (a contrast failure, a role naming a missing hue) is reported and the last good CSS stays. Reset removes it. `/configure` has a sample panel and the preview. `@fallback none`: a live preview has no meaning without script. Affects the web-component bundles in all formats; no CSS or class changes. Other fixed-group packages: no consumer-facing change.
