---
'@getvitops/emdash': minor
'@getvitops/astro': minor
'@getvitops/generator': minor
---

Add the `vitops_location` block: one of the site's `organization.locations` (address, phone, email, hours, photos) with its `LocalBusiness` JSON-LD.

It is a thin adapter over `<LocationPage>`, so a hand-built location page and the block cannot differ, and a blank key renders the first location. The data comes from a new `virtual:getvitops/organization` module that the `vitops()` integration serves from `site.json` (only `organization.locations` and the default locale; empty when there is no config). `<LocationPage>` now passes extra HTML attributes and `class` through to its `<article>`, which is how the block applies its anchor, class and style. The `location-pages` entry in the tier manifest lists the block. Reaches the EmDash renderer and Astro integration only; no CSS change.
