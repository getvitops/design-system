---
'@getvitops/utils': minor
'@getvitops/config': patch
'@getvitops/core': patch
'@getvitops/generator': patch
'@getvitops/cli': patch
'@getvitops/vite': patch
'@getvitops/astro': patch
---

**Added: `@getvitops/utils/forms`, a renderer that turns config fields into a complete no-JavaScript HTML form.** `renderProjectionHtml()`, `renderProjectionSection()` and `renderStepHtml()` take the descriptors `@getvitops/config/forms` produces and write the markup once, for every host: an Astro page (`set:html`), an EmDash admin route, a Worker. Every field is a `<wc-field>` around a label that nests its control; help text and the error are pre-linked with `aria-describedby`, so a page re-rendered after a failed POST is already right with scripting off. The form posts the names `formToConfig` parses, and a round trip of every onboarding step against the real schema is a test.

- **Worker-safe, and light.** No Node builtin and no parse5: the pure node-tree renderer (`nodesToHtml`, `styleList`, `toHtml`) moved out of `html.ts` into `html-render.ts`, which `html.ts` re-exports, so no import changed. A test fails if the forms entry reaches parse5 or the zod-carrying config root.
- **Safe by construction.** Everything goes through `nodesToHtml`, so text is escaped and tag and attribute names are validated. Attribute values additionally have `&` escaped, so what a visitor typed (`AT&T`, `&copy`) comes back out exactly. A `notice` takes plain text (escaped) or nodes; schema descriptions are rendered as nodes, never spliced in as HTML.
- **Switches start from the schema default.** An unset `default: true` field would otherwise render unchecked and be saved as an explicit `false`. `FieldDescriptor.default` carries it.
- **Known shape changes on an unedited save** (inherent to the wire format, documented in the tests): with several languages configured a bare string becomes `{ <default locale>: … }`, and an unset switch is saved as `false`.

**Changed in `@getvitops/config/forms`.** `formToConfig` parses a keyed-map row with itself, so a row may hold `$loc`, `$lines`, `$bool`, `$num` and a nested `$map`, to any depth (it handled only `$bool`/`$num` before). The validator no longer shows a visitor a regular expression: a `format` and a `pattern` that both fail report one sentence ("Must be an email address."), and a bare pattern reports "Isn't in the expected format."

**CSS, all formats** (`forms.css`): `.field__group`, `.field__row`, `.field__option`, `.field__notice`, `.field-section` and `.field-section__intro`, at zero specificity where they style an element. `@getvitops/generator`, `cli`, `vite` and `astro` — no consumer-facing change in these packages.
