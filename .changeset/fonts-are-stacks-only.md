---
'@getvitops/generator': patch
'@getvitops/cli': patch
---

Say plainly that `fonts` in `design-system.json` is stacks only and loads nothing.

The field's description was complete and self-consistent — "raw font stacks by name, emitted as
`--font-<name>` tokens" — and told you nothing about where the `@font-face` comes from. Following
it literally leads to installing a `@fontsource*` package and importing its CSS in a layout, which
renders correctly and silently gives up subsetting, preload, and the `size-adjust` /
`ascent-override` fallback metrics: a CLS regression that looks like a working setup.

The field is unchanged. What changed is that four surfaces now name the boundary and point at the
fix — declare the family in Astro's `fonts:` config and point the token at its `cssVariable`:

- the `fonts` description in the JSON Schema, and therefore `vitops docs authoring`
- `SKILL.md`, which previously never mentioned fonts at all
- the generated `tailwind.css` header and its `@theme` fonts comment
- the generated `type-tokens.css` header (css format)
