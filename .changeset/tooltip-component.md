---
'@getvitops/core': minor
'@getvitops/astro': minor
---

Add `<Tooltip>` (`@getvitops/astro/components/Tooltip.astro`) and a toggletip. `<Tooltip id label>text</Tooltip>` emits a `.tooltip-trigger` button and its `[popover="manual"].tooltip` as siblings; `deferred.js` already opens it on hover and keyboard focus and closes it on Escape, so the component is markup only, and with no JS the trigger's `popovertarget` is a click toggle. `<Tooltip toggle>` is a "?" button for more than a phrase and for touch and screen-reader users: a `popover="auto"` with `.tooltip--toggle`, opened by hover, focus or click, pinned open once clicked until Escape or a click outside, and reporting `aria-expanded` (not `aria-describedby`) on its trigger. `js/tooltip.ts` gains the toggletip handling and `tooltip.dom.test.ts`. CSS (`tooltip.css`, `.tooltip--toggle` wraps its text): all formats. Other fixed-group packages: no consumer-facing change.
