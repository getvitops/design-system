---
'@getvitops/core': patch
'@getvitops/generator': patch
---

**Fix: scroll-driven animations silently did nothing in Chromium.** lightningcss folds `animation: x linear both; animation-timeline: view()` into one `animation: linear both x view()` when it minifies, and Chromium does not accept a timeline inside the `animation` shorthand, so it dropped the whole declaration. The affected rules never ran: `.text-reveal`, `.scroll-size`, `.scroll-reveal`, the `.steps--animated` items, `.parallax__layer`, the scroll-progress bar, `.stack` cards, `.horizontal-scroll` and the carousel's hint and scrollbar dimming and offscreen-inert rules. They are now written as `animation-name`, `animation-timing-function`, `animation-fill-mode` and `animation-timeline` longhands, which lightningcss leaves alone. All formats (the partials are shared); the visible change is that those effects now run. A new test fails if any bundle carries a timeline inside an `animation:` shorthand. Other fixed-group packages: no consumer-facing change.
