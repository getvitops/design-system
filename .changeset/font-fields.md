---
'@getvitops/config': minor
'@getvitops/utils': minor
'@getvitops/generator': patch
'@getvitops/core': patch
---

The brand step edits fonts. A map of plain strings (`designSystem…fonts`, `typography.families`) now renders a value field per row (it showed only the key before), named `…$map.N.$value` and read back by `formToConfig`. A new `combobox` widget (`FieldMeta.suggestions`) renders a `<wc-combobox>` over an `<input list>`, so font stacks come with suggestions and still accept free text, with the native datalist as the no-JS fallback. A row copied by `<wc-multifield>` after its combobox upgraded gets a clean one of its own. No consumer-facing change in `@getvitops/generator` or `@getvitops/core` beyond that.
