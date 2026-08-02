---
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/cli': minor
---

Add a fourth output format, `design`, that emits `DESIGN.md` — the agent-facing brief in
[google-labs-code/design.md](https://github.com/google-labs-code/design.md) format.

```sh
vitops generate --format design --out .     # DESIGN.md, and nothing else
vitops generate --format css,design         # compose it with a stylesheet
```

The file is YAML front matter carrying the tokens (`colors`, `typography`, `rounded`,
`spacing`, `components`, cross-referenced with `{group.token}`) followed by a prose body
carrying the rationale — colour model, fluid scales, layout vocabulary, elevation, shape
cascade, component tiers, do's and don'ts. Every section is rendered from your config, so
it cannot describe a system the other formats don't build. Point a coding agent, a Figma
import, or a designer at this one file when they don't have the toolchain; `vitops docs`
remains the richer reference for those who do.

It is emitted with `--out .` in mind: DESIGN.md conventionally lives at a repo root beside
`AGENTS.md`, not in a build directory.

Three things the spec cannot express, handled the same way every time and explained in the
emitted prose so the file is self-describing:

- **Fluid `clamp()` sizes** → the maximum (desktop) value, since a spec `Dimension` is a
  bare number plus px/em/rem.
- **Dark mode** → light values only, with the automatic functional flip explained. Role
  tokens are emitted as `{colors.<hue>-<step>}` references into the raw ramps rather than
  flattened hexes, so the role → ramp lineage survives the export — flattening them is
  exactly what breaks dark mode downstream.
- **A `50%` radius** → dropped from `rounded` (it is not a `Dimension`) and named in the
  Shapes prose instead, so nothing is silently lost.

**New:** an optional `meta` key in `design-system.json` (`{ name, description }`) supplies
the brand name and the Overview paragraph. It affects no other format.

**New:** `StylesheetFormat` (`Exclude<Format, 'design'>`), exported from
`@getvitops/generator`. `@getvitops/astro`'s `css.format` now takes that narrower type —
`design` produces no stylesheet to inject, so passing it there is a type error rather than
a missing-file failure at build time. `vitops lint --format` is likewise restricted to the
three CSS formats. No change for anyone already passing `tailwind`, `css` or `bricks`.
