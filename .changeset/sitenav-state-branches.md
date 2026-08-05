---
'@getvitops/core': patch
---

Fix `sitenav` shipping its drawer geometry into its navbar state.

A `.sitenav` carrying both a drawer-direction modifier and a breakpoint promotion rendered its navbar one full panel-width toward the inline-end at and above the promotion width — off the page, with a horizontal scrollbar and anything laid out after the panel pushed out of view. Reported downstream against `sitenav--bp-lg sitenav--drawer-end`; it affected every `--bp-*` value and both drawer directions.

One cause, three symptoms. `@container` contributes no specificity, so when the four per-breakpoint blocks were consolidated into a single style query in 3.0.0, the wide-state reset lost the `.sitenav--bp-*` class that had been winning it the tie. Every narrow-state rule with a heavier selector then won _inside the wide state_:

- `.sitenav--drawer-end .sitenav__panel` (0,2,0) beat the navbar's `translate: none` (0,1,0) — the reported bug.
- The mobile accordion's `.sitenav__item--branch > .sitenav__submenu { overflow: hidden }` (0,2,0) beat the dropdown's `overflow: visible`, which **clipped away every third-level megamenu** at width. Its `padding-inline-start: 1rem` leaked in the same way.
- The wide block's counter-rule for depth caps beat the base `.sitenav__submenu { display: flex }`, so a `sitenav__item--desktop-branch` dropdown lost its column direction and gap.

The drawer and the navbar are now mutually exclusive branches of the same style query — `@container style(--_sitenav-wide: 0)` alongside the existing `: 1` — so there is no cascade contest to lose rather than a contest that is currently being won. A new test in core asserts the invariant across every two-state pattern.

**Two visible changes at width, both intended:** dropdown padding is now symmetric `0.5rem` (it was `1rem` on the inline-start side only), and depth-capped dropdowns regain their `0.25rem` gap.

Also fixed in the same pattern: `.sitenav__panel` never undid the UA `[popover]` sheet's `margin: auto` and `height: fit-content`, so `inset-block: 0` bought nothing and the drawer rendered as a content-height card floating in the vertical centre instead of filling the edge. It is now a full-height drawer, and the auto margins no longer absorb free space when a promoted `.sitenav` is stretched rather than content-sized.

Note the narrow state now also depends on `@container style()` (Chrome 111 / Safari 18 / Firefox 128), which the wide state already required. On an older engine the sitenav degrades to a popover holding an expanded link list — usable and accessible, but neither drawer nor navbar.
