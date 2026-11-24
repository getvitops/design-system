---
'@getvitops/core': minor
'@getvitops/astro': minor
'@getvitops/generator': patch
'@getvitops/config': patch
'@getvitops/utils': patch
'@getvitops/cli': patch
'@getvitops/vite': patch
---

**Added: `<wc-config-form>` and `<ConfigForm>`, live feedback over a config form that already works.** Wrap a form written by `renderProjectionHtml` (`@getvitops/utils/forms`) and, with scripting on, the config schema validates as you type and each message appears in its `<wc-field>`; a keyed map (locations, services, ad platforms) gains a row as its blank one is used; and `value` is the config document the form describes (`formToConfig`), with an optional `output` element filled on every change and a `config-change` event.

- **Messages appear when they are due.** A field's message shows once the visitor has left it, or a submit has been attempted: never while they are still reading the form. Row fields are matched to their schema path through the row's key control, so an error on `gutters`'s price lands on that row.
- **A submit with errors is cancelled** and the first invalid field is focused, unless the element has `novalidate` (the server decides). A clean submit is untouched, so a plain `<form method="post">` still posts the names the server parses.
- **Its own bundle, `@getvitops/core/config-form`** (3.6 KB gzipped, Lit-free, a plain `HTMLElement`), not part of `elements.js`: it carries the validator and the form codec, which a page with no config form should not download. It enhances `<wc-field>` without importing it, so the two load in either order. `<ConfigForm id schema paths output>` (`@getvitops/astro/components/ConfigForm.astro`) emits the element, embeds the schema narrowed to `paths` (`pickSchema`), and loads the bundle.
- **`verify:bundle-size`** gains a 4,000 B ceiling for `config-form.js`.

**CSS, all formats** (`forms.css`): `wc-config-form` is `display: block` while un-upgraded, so the tag does not form an inline box around a block `<form>`.

`@getvitops/generator`: a `config-form` entry in `TIERS`. `config`, `utils`, `cli` and `vite` — no consumer-facing change in these packages.
