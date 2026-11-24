---
'@getvitops/core': patch
---

**`<wc-entries>` builds its table cells by cloning the author's nodes instead of copying `innerHTML` strings.** The generated table is an aria-hidden presentation copy of the heading and `<dl>` pairs. It used to serialise each `<dd>` and heading to a string and re-parse it into a cell, a round-trip that can alter markup and is where HTML sanitisers get bypassed. Cloning keeps links, `<time>`, `<data>` and inline markup as they were, adds no parser step, and needs no sanitiser in `elements.js` (which sits near its size budget). Affects the web-component bundle in all formats; no markup or class changes. Other fixed-group packages: no consumer-facing change.
