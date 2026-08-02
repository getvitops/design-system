---
'@getvitops/astro': patch
'@getvitops/emdash': patch
'@getvitops/create': patch
---

Docs: import the Astro integration as `vitops`, and document the fourth output format.

Every example now reads `import vitops from '@getvitops/astro'` and calls `vitops({ … })`,
including the scaffolded `emdash` template. The default export is unchanged, so this is a
naming convention in the docs rather than an API change — existing configs that bind it as
`getvitops` keep working.

The `@getvitops/generator` and `@getvitops/cli` docs also describe the `design` format, which
was shipped without a mention in either package's output table: `--format design` writes a
single `DESIGN.md` and no CSS, so a run that composes it with a stylesheet wants its own
`--out` (the brief conventionally sits at a repo root, the stylesheet does not).
