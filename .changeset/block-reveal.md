---
'@getvitops/emdash': minor
---

**Added: an `Entrance` (`reveal`) field on the Cards, Steps and Stats blocks.** `.stagger` on a parent only sets an index on its children; each child still needs an effect and a driver (`fade-in slide-up animate-view`) to animate, and a block's `className` reaches only its root, so an editor could not stagger a card set without a site-local CSS shim. The new select (none / fade / slide / fade and slide) makes the block add `stagger` to its list and the effect plus `animate-view` to every item. Unset (the default) renders exactly as before.

The classes are literal in the block source, so they reach a Tailwind build that scans `@getvitops/emdash`. They use the `fade-in` and `slide-up` effects the default design system ships: a site that renamed or removed them gets no animation (`vitops lint` flags unknown framework classes). **All formats**; no CSS change in `@getvitops/core`. No migration.
