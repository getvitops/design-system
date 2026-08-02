---
'@getvitops/generator': minor
---

**Base page typography can now be bound to a type role, and the live editor's Body controls work.**

`typography.headings` was documented as an h1…h6 map, but the key has always been used verbatim as
a selector. Mapping `"body"` to your prose role now binds base page typography to that role:

```jsonc
"typography": {
  "headings": { "body": "body", "h1": "display", "h2": "heading" }
}
```

The generator emits `body { font-family: var(--body-ff, …); line-height: var(--body-lh, …); … }`,
so prose inherits the role and the role's tokens become the single place it is edited.
`defaultConfig()` includes the binding; existing configs are unaffected until they add it.

This is what made `<wc-theme-editor>`'s **Typography → Body** controls appear dead. They set
`--body-lh` and friends on `:root`, but only `.font-body` read them — page prose was styled by
hand-written `body { line-height: 1.55 }` rules that consumers had to write precisely _because_ the
framework offered no binding. If you keep such a block, drop the properties the role now owns:
restating them shadows the role's tokens, and because that CSS is typically unlayered it wins.

**Fixed: typography edits that previewed live and were dropped on save.** The design manifest's
`reverseIndex` only mapped hooks a role explicitly declared, while the editor renders a control for
every hook. Editing a property the role omitted (`--body-ls`, `--body-tt`, …) updated the page and
then silently vanished from the `design-system.json` patch. Every hook of every role is now indexed.

**Added: `validate()` warns when a shadow value can't survive `drop-shadow()`.** A `--shadow-<name>`
token feeds both `box-shadow` (pattern geometry) and `filter: drop-shadow(…)` (the
`.drop-shadow-<name>` utilities and the `shadow:` state shortcut). `drop-shadow()` accepts a single
layer of at most three lengths — a spread radius, a second comma-separated layer or `inset`
invalidates the whole `filter`, so the utility renders **no** shadow while the token still looks
correct everywhere it is authored. Keep shadow values in that intersection.
