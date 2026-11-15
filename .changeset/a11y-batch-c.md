---
'@getvitops/core': patch
'@getvitops/generator': patch
---

**Popover open-state rules now work in engines that load the Popover polyfill.** An engine without `:popover-open` (Safari below 17, Firefox below 125, the engines `polyfills.js` exists for) drops any rule whose selector contains it, or the whole selector list. The polyfill cannot define the pseudo-class; it marks an open popover with the class `.\:popover-open` instead, so every open-state rule was lost there: the narrow site-nav drawer opened and stayed at `opacity: 0`, and the same went for the dropdown, consent banner, tooltip, split-link panel, drawer and the `open-<fx>` animation variants. All 22 occurrences across the partials, and the generated `open-<fx>` classes, are now `:is(:popover-open, .\:popover-open)` (same specificity, and `:is()` parses forgivingly so the unknown half is dropped on its own). `css-popover-pairing.test.ts` fails on a bare `:popover-open` in any partial.

Also: the Invoker Commands polyfill is now feature-detected with `commandForElement` on `HTMLButtonElement.prototype`, the property the polyfill and the platform guidance test, instead of `command`.

Affects all formats (CSS in css, bricks and tailwind alike; the generated `open-<fx>` classes in all three). No markup or class changes; nothing to migrate. Other fixed-group packages: no consumer-facing change.
