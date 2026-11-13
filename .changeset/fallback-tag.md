---
'@getvitops/core': patch
'@getvitops/generator': minor
---

Every web component now states its no-JS standing in its docblock with `@fallback full|partial|none <what the no-JS state is>`, and the generated components reference and docs table gain a "With no JS" column (`TierWc.fallback`). A test fails when an element lacks the tag or TIERS disagrees. No consumer-facing change in `@getvitops/core`'s runtime or CSS. No consumer-facing change in the other packages.
