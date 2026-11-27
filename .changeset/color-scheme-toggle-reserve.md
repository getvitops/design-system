---
'@getvitops/core': patch
'@getvitops/generator': patch
---

`<wc-color-scheme-toggle>` no longer shifts the page when it upgrades (all formats).

The element is `display: none` until it upgrades and then renders a ~248px three-button group, which squeezed the brand and nav beside it and pushed everything below down: CLS 0.21 on the scaffolded site's mobile home page, from this alone. While scripting is enabled and the element is not yet defined, its box is now reserved (15.5rem by 2.3125rem, the English labels; `--color-scheme-toggle-reserve-inline` / `-block` resize it for other languages or styles). Without scripting nothing is reserved, so there is no permanent gap. On the scaffolded site CLS goes from 0.21 to 0.000 on `/`, `/contact`, `/privacy`, `/terms` and `/cookies`, and from 0.284 to 0.045 on `/blocks`.
