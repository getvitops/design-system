---
'@getvitops/emdash': minor
'@getvitops/cli': minor
---

Add `vitops emdash check-seed [seed.json]`, which checks the `vitops_*` blocks inside a seed.

EmDash's `validateSeed` knows the collections but not this plugin's blocks, so a misspelled field (`primaryLabl`) or an unknown block type passed it and then rendered nothing. The command walks every content entry, including section bodies, and reports unknown block types, unknown or misspelled fields (with a suggestion), select values outside their options and rows with no content. Unknown types and fields are errors and exit 1; a select value or a gallery image with an empty `src` is a warning, because a seed written before the photos exist leaves those empty on purpose. The checker is `checkSeedBlocks()` from `@getvitops/emdash`, built from the same block definitions the renderers use. No CSS change.
