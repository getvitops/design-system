---
'@getvitops/core': patch
---

Element fixes from a web-standards review. `<wc-copy>` announces "Copied" / "Copy failed" through a polite live region beside the button (`copied-label` and `failed-label` set the spoken text) instead of swapping the button's own name, and no longer logs the copied value to the console. `BaseElement` gains `connectionSignal`, an `AbortSignal` that lives while the element is connected, so a listener on `document`/`window` is torn down by one mechanism. `initFromLightDom` retries once more at `DOMContentLoaded` when an element is defined before the parser has reached its children. The `combobox`, `tabs`, `format` and `contrast-toggle` elements use `connectionSignal`. Affects the web-component bundle in all formats; no markup or class changes. Other fixed-group packages: no consumer-facing change.
