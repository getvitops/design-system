---
'@getvitops/core': minor
'@getvitops/utils': minor
'@getvitops/generator': minor
'@getvitops/astro': minor
'@getvitops/config': minor
'@getvitops/cli': minor
'@getvitops/vite': minor
---

Config forms: rows you can add and remove, and a colour picker on brand colours.

- **`<wc-repeat>`** (in `@getvitops/core/config-form`): `renderProjectionHtml` now wraps every keyed map (locations, services, languages…) in it. Each row is an open `<details>` titled by its key; with JS there are Add and Remove buttons, with none the last row is still blank to fill in, and emptying a row's key drops it. `<wc-config-form>` no longer adds a blank row by itself once `<wc-repeat>` has the map. Any markup that depended on rows being `<fieldset class="field__row">` now sees `<details class="field__row">` with the fields inside `.field__row-body`. Forms CSS: **all formats**.
- **`<wc-color-field>`** (`@getvitops/core/color-field`, new): a colour text input with the theme editor's OKLCH picker offered beside it. The text input is still the fallback and the only submitted control; the picker (~40 KB gzipped) is fetched only when it is first opened. `<ConfigForm colorPicker>` loads it. Forms CSS: **all formats**.
- `verify-bundle-size` now counts the chunks an entry imports statically (Lit is shared between `elements.js` and the picker), so `elements.js` is measured as the page downloads it; its ceiling moves from 33,000 to 33,600 B for that reason. `config-form.js` 4,000 to 5,000 B for `<wc-repeat>`.

No consumer-facing change in `@getvitops/cli` and `@getvitops/vite`.
