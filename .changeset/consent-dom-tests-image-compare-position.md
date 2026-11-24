---
'@getvitops/core': patch
'@getvitops/utils': patch
'@getvitops/generator': patch
'@getvitops/cli': patch
'@getvitops/vite': patch
'@getvitops/astro': patch
---

**Fixed: `<wc-image-compare position="25">` was ignored on first render.** The slider always started at 50 unless `position` changed a second time, because the constructor's own `_offset` assignment defeated the guard that applied the attribute. It now starts where the attribute says. JS only; no CSS changed, so no format is affected.

**Hardened: `nodesToHtml` refuses elements that run code or change parsing** (`script`, `style`, `iframe`, `frame`, `object`, `embed`, `template`, `base`, `meta`, `link`, `portal`) at any depth and in any case, and escapes a quote in an object-form `style` value so it cannot close the attribute. Only authored legal text and `NodeRenderer` data go through it today, so no shipped output changes; a tree that did contain one of those tags now throws instead of rendering it.

Added DOM tests for `<wc-consent>` and `<wc-image-compare>`; `<wc-image-compare>` is now named in AGENTS.md as the element that renders into a shadow root.

`@getvitops/generator`, `cli`, `vite` and `astro` — no consumer-facing change in these packages.
