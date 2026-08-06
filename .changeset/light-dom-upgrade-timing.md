---
'@getvitops/core': patch
---

Fix `<wc-entries>`, `<wc-carousel>` and `<wc-marquee>` silently failing to enhance when inserted
dynamically.

All three parse their slotted markup in `connectedCallback` and return early when they find
nothing. That is fine when `elements.js` loads as a deferred module, because the document is
fully parsed before any definition registers. But an element upgraded _during_ insertion is
connected **before its children exist** — verified: an `innerHTML` write runs
`connectedCallback` with zero children.

So on an Astro view-transition swap, a client-side navigation, an `innerHTML` write or a cloned
template, `<wc-entries>` never built its table, `<wc-carousel>` never cloned its slides or
started autoplay, and `<wc-marquee>` never took over from the CSS-only path. Nothing errored;
the un-enhanced fallback just stayed on screen, which is why this went unnoticed.

Initialisation is now expressed as a function that reports whether it found its markup, and is
retried once the insertion completes (`initFromLightDom`). Setup is guarded so a retry after a
genuinely empty state can't double-apply — an `<wc-entries>` building its table twice would
have been the obvious way to fix this badly.

`<wc-tree>` uses the same helper. If you write a light-DOM component, use it too; the hazard is
documented in `web-components/utils/upgrade.ts`.
