---
'@getvitops/config': minor
'@getvitops/generator': patch
'@getvitops/core': patch
'@getvitops/utils': patch
'@getvitops/cli': patch
'@getvitops/vite': patch
'@getvitops/astro': patch
---

**Added: `@getvitops/config/forms`, the field layer for editing a `site.json` in a form.** Pure and Worker-safe (no zod, no Node builtin, no import from the rest of the toolchain): every function takes the JSON Schema (`config.schema.json`) as an argument, so a host that cannot load the generator still gets the same field choice, grouping and validation as one that can.

- **Projections.** `PROJECTIONS` are named, ordered groups of config paths (`organization.identity`, `site.accessibility`, `brand.basics`, …) and `ONBOARDING_STEPS` arranges them into the sequence a new client fills in. `resolveProjection()` and `describeField()` turn a path into a descriptor (label, required, the widget derived from the schema node: text, email, date, radio or select for an enum, switch, locale map, lines, keyed map, fieldset) so the decision is made once, from the schema that validates the value. Labels live in `FIELD_META`, not the schema; a field with none gets a humanised key.
- **Validation.** `validateAgainstSchema()` and `validateField()` are a JSON Schema walker for exactly the keywords the config schema uses (including `prefixItems`, `minLength`, `minItems` and `oneOf`, which the portal's copy of this walker did not know). `unhandledKeywords()` is the tripwire.
- **Form codec.** `formToConfig()` and the name builders (`scalarName`, `locName`, `mapKeyName`, …) are the flat `name=value` wire format a no-JS form posts, moved here from the portal so the renderer and the parser import the same names. An empty number field now writes nothing; the portal's copy wrote `0`.
- **`pickSchema()`, `stepStatus()`.** The first narrows the schema to the paths a form edits, so a required field elsewhere is not reported against it; the second derives which onboarding steps a draft has finished (complete, incomplete, invalid, empty), so no progress is stored.
- **`renderInlineMarkdown`** moved here from `@getvitops/generator`, which re-exports it, so nothing that imports it changed.

Three drift guards in `@getvitops/generator`: every projected path must exist in the schema; every top-level `organization` / `site` key must be projected or listed in `UNPROJECTED` with a reason; and the validator must implement every keyword the schema uses. A fourth walks the built `@getvitops/generator/config` import graph and fails on a Node builtin, lightningcss or tailwind, since the portal runs it on a Worker (a static check, not a workerd run).

No CSS changed, so no format is affected. `@getvitops/generator`: the tests and the re-export only. `core`, `utils`, `cli`, `vite` and `astro` — no consumer-facing change in these packages.
