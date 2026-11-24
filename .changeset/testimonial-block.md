---
'@getvitops/emdash': minor
'@getvitops/generator': minor
---

Add the `vitops_testimonial` block: a customer quote with attribution and optional stars, on the `.pull-quote` pattern.

Its `Review` JSON-LD is opt-in (a toggle, off by default) and needs the stars and the name of the business reviewed, because Google ignores reviews a business writes about itself and the markup must match what the page shows. The `pull-quote` entry in the generator's tier manifest lists the new block. Reaches the EmDash renderer only; no CSS change.
