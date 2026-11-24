---
'@getvitops/emdash': minor
'@getvitops/create': minor
'@getvitops/generator': patch
'@getvitops/core': patch
'@getvitops/astro': patch
'@getvitops/utils': patch
'@getvitops/cli': patch
'@getvitops/vite': patch
'@getvitops/config': patch
---

**Added: the `vitops_tree` block, and landing pages in the emdash template.**

- **`vitops_tree`** (`@getvitops/emdash`): an expandable outline for a file tree, a site map or nested sections. Block fields can't nest, so the editor types an indented outline (one node per line, indent to nest, `| badge` for a chip) and the block builds the `<Tree />` from it. Only plain label, badge and a derived id reach the tree: it never sets `descriptionHtml`, which `<Tree />` renders as raw HTML, so markup typed into the outline is shown as text. Capped at 500 nodes and six levels. The `tree` manifest entry no longer carries an `emdashExempt` reason.
- **Landing pages** (`@getvitops/create`, emdash template): new scaffolds ship a `landings` collection whose `layout` is a `blocks` field of `vitops_section`, the `vitops_section` block type in `seed/seed.json`, and `src/pages/landings/[slug].astro` (prerendered, like `pages`). Create a landing in the admin and stack sections, each holding any Vitops block. No sample landing is seeded. `templates.test.ts` fails if the seeded block type drifts from `vitopsBlockTypes()`.

### Migration

A seed is applied once, at a site's first boot, so an existing site gets none of this automatically. Either run `vitops emdash schema apply --from <a site that has it> --to <your site>` for the collection, add `...vitopsBlockTypes()` to the seed's `blockTypes` (a new environment only), or add the collection by hand with `emdash schema create landings` and a `blocks` field allowing `vitops_section`, and copy `src/pages/landings/[slug].astro`. Block types are not replayed by `schema apply` (they are reported); add `vitops_section` from the admin or the seed.

`@getvitops/generator`, `core`, `astro`, `utils`, `cli`, `vite` and `config` — no consumer-facing change in these packages. No CSS changed, so no format is affected.
