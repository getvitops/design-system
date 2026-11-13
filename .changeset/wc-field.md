---
'@getvitops/core': minor
'@getvitops/astro': minor
'@getvitops/generator': patch
'@getvitops/utils': patch
'@getvitops/cli': patch
'@getvitops/vite': patch
'@getvitops/config': patch
---

**Added: `<wc-field>` and `<Field>`, a labelled control with help text and an error.** The fallback is a label that **nests** its control, so with no JavaScript it is a labelled control and needs no `id`/`for` pair (one field can appear twice on a page without a collision). The element only adds what the platform can't do alone:

- `aria-describedby` from the control to its help text and, while one shows, its error; `aria-invalid` with it.
- An inline message in a polite live region, shown once the visitor leaves the control or a submit reports it (`:user-invalid`'s timing, so an empty required field is not an error on arrival). The browser's own bubble and focus-the-first-invalid still happen; the message is in addition.
- `setError(message)` / `clearError()` for a host that validates against something richer than HTML constraints. It goes through `setCustomValidity`, so the form's own `reportValidity()` blocks submit; typing drops it and the host asserts it again if it still applies.
- A `maxlength` counter, and a `field-change` event (`{ name, value, valid }`).

It is deliberately **not form-associated**: the native control it wraps already submits, validates and takes focus, and `delegatesFocus` is a shadow-root option where this is light DOM. `<Field label help error optional>` (`@getvitops/astro/components/Field.astro`) emits the element itself, with a server-rendered `error` kept until the value is edited.

**CSS, all formats** (`forms.css`): `.field`, `.field__control`, `.field__label`, `.field__help`, `.field__error`, `.field__counter`, `.field__optional`, at zero specificity, sharing `.form-group`'s tokens. `.field__control > input` and `> textarea` now take the same base control border, radius and padding as `.form-group > input`. A label that wraps a checkbox or radio lays out on one line.

`@getvitops/generator`: a `field` entry in `TIERS`. `config`, `utils`, `cli`, `vite` — no consumer-facing change in these packages.
