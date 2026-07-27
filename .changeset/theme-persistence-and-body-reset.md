---
'@getvitops/cli': patch
'@getvitops/astro': patch
---

Persist the colour scheme across navigations, and drop the UA body margin.

**The colour scheme now sticks.** `<color-scheme-toggle>` records the explicit choice in
`localStorage` (`vitops-color-scheme`) and restores it on load. Previously every navigation reset
to System — the component defaulted to `system` on each page and its `disconnectedCallback` even
deleted the attribute on unmount, so the scheme was per-page state rather than a user preference.
Choosing System clears the key, so a visitor can go back to following their OS.

`<Head />` from `@getvitops/astro` now also emits a tiny synchronous script that applies the stored
value **before first paint**. Without it the persisted choice would still work, but every page
would render light and flip once the deferred element bundle upgraded. A test asserts the storage
key stays in step between the two (they can't share an import: core exports only prebuilt bundles,
and the Head script must be a literal in the emitted HTML).

**`body { margin: 0 }`** is now part of the framework. The UA's 8px margin offset every full-bleed
surface — sticky headers and `bg-*` bands rendered inset with a sliver of canvas around them, since
the framework owns page gutters through `.centered`'s `--gutter`. This is the only UA reset the
framework makes; it deliberately still ships no general reset (no global `box-sizing` change),
which would silently reflow existing layouts.

**Migration:** if you were compensating for the body margin with a negative offset or your own
`body { margin: 0 }`, you can drop it. Sites relying on the 8px inset will need to add their own
padding.
