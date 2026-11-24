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

- **`<wc-multifield>`** replaces `<wc-multi-field>` (**breaking: rename `wc-multi-field` to `wc-multifield`**; the Bricks element key `vitops-multi-field`, the `--multi-field-gap` property and the `multi-field-*` events are unchanged). It is now light DOM and Lit-free, so the framework's form CSS applies and the controls are native: the authored inputs are the no-JS fallback and submit with the form. Kept from the old element: `min`, `max`, `protect-defaults`, Clear, `add-label` / `clear-label` / `delete-label`, `type`, `placeholder`, `name` (`name[]`). New: it repeats a whole fieldset too, with each row an open `<details>` titled by its key, a polite announcement of changes, and a row unfolds when a blocked submit is about it. The slots `add-label` / `clear-label` / `delete-label` and the `::part`s are gone (shadow DOM); use the attributes and the `.multifield__*` classes. `renderProjectionHtml` wraps every keyed map in it, so rows are now `<details class="field__row">` with the fields in `.field__row-body` where they were `<fieldset class="field__row">`. Forms CSS: **all formats**.
- **`<wc-color-field>`** (`@getvitops/core/color-field`, new): a colour text input with the theme editor's OKLCH picker offered beside it. The text input is still the fallback and the only submitted control; the picker (~40 KB gzipped) is fetched only when it is first opened. `<ConfigForm colorPicker>` loads it. Forms CSS: **all formats**.
- `verify-bundle-size` now counts the chunks an entry imports statically (Lit is shared between `elements.js` and the picker), so `elements.js` is measured as the page downloads it; its ceiling moves from 33,000 to 33,600 B for that reason.

No consumer-facing change in `@getvitops/cli` and `@getvitops/vite`.
