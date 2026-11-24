---
'@getvitops/config': patch
'@getvitops/core': patch
'@getvitops/utils': patch
'@getvitops/generator': patch
'@getvitops/cli': patch
'@getvitops/vite': patch
'@getvitops/astro': patch
---

**Fixed: a form field is only marked required when everything above it is.** `site.domains.canonical` is required _within_ `domains`, and `site.crm.provider` within `crm`, but both blocks are optional, so a form that put the native `required` attribute on them forced a custom domain and a CRM onto every site. `FieldDescriptor.required` (`@getvitops/config/forms`) now uses `isUnconditionallyRequired`: the field is required by its parent and every ancestor is required by its own. Validation is unchanged; the schema still requires `canonical` once `domains` exists.

**CSS, all formats** (`stepper.css`): a `.stepper__actions` row honours the `hidden` attribute, and a `<wc-stepper>` section the element has put away stays hidden whatever display its own classes set (`.rhythm` would otherwise out-rank the attribute).

The docs site gains a `/configure` page that builds a `site.json` step by step with `<Stepper>` and `<ConfigForm>` (no package change). `config`: the required fix. `core`: the CSS above. `utils`, `generator`, `cli`, `vite`, `astro`: no consumer-facing change in these packages.
