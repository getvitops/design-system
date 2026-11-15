---
'@getvitops/core': patch
'@getvitops/astro': minor
'@getvitops/emdash': patch
'@getvitops/create': minor
---

**Performance and security-header fixes from a web-standards audit, batch D.** Checked in a real browser against a deliberately held-open `load` event.

**Breaking**

- **`<Carousel>` and `<Gallery>` no longer boost their first image by default.** Both set `loading="eager"` and `fetchpriority="high"` on the first image, and `fetchpriority="low"` on the rest, unconditionally. Priority is zero-sum, so a gallery near the foot of a page competed with the real Largest Contentful Paint image for nothing. New `priority` prop, default `false`: with it off every image is `loading="lazy"` with no priority hint (a horizontal scroll container honours `lazy` with no JavaScript); with it on, the first image is eager and high priority. **Migration:** a hero carousel or gallery that is the page's LCP element passes `priority`. Every other use needs no change and gets faster.

**Fixed**

- **`.animate-trigger` no longer waits for `window.load`.** It is `opacity: 0` and paused until `deferred.js` adds `.is-active`, and that happened only after every image and font on the page had loaded, so an above-the-fold trigger stayed invisible that whole time and delayed LCP. The observer now starts when the script runs; an `IntersectionObserver` is asynchronous and forces no layout, so the reflow reason for waiting did not apply. The row-stagger and track-width work, which does read layout, stays on `load`. All formats.
- **The EmDash `vitops_hero` image** (eager, and the likely LCP element) now carries `fetchpriority="high"`.
- **Scaffolded `public/_headers`** (both templates) gains `Strict-Transport-Security: max-age=31536000` and `Cross-Origin-Opener-Policy: same-origin-allow-popups`. HSTS deliberately omits `includeSubDomains` and `preload`: those commit every subdomain to HTTPS and are hard to take back, so that is the site owner's decision. The comment that said allowing a third-party tag's origin was enough to enforce the CSP was wrong for inline tag bodies (gtag's config, Matomo's `_paq`, Clarity's loader): the consent gate re-creates those as new scripts and each needs its own `'sha256-…'`. It now says so.

**Not changed, and why:** `<Head />` still preloads `polyfills.js` rather than `elements.js` and its chunks. Preloading the chunks would couple `<Head />` to the bundle's internal chunk names, and nothing here measured a gain. Hashing the gate's inline tag bodies automatically would need the integration to hand the policy the resolved tags, which is a design of its own; the scaffolds stay Report-Only, which is what shows the values to add.

Affects the browser bundle and components in all formats; no CSS change. Other fixed-group packages: no consumer-facing change.
