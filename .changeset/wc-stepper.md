---
'@getvitops/core': minor
'@getvitops/astro': minor
'@getvitops/generator': patch
'@getvitops/config': patch
'@getvitops/utils': patch
'@getvitops/cli': patch
'@getvitops/vite': patch
---

**Added: a stepper, in three forms.** `.stepper` is the progress list for a sequence of steps; `<StepperNav>` renders it for a flow where each step is its own page; `<wc-stepper>` / `<Stepper>` shows one long form a step at a time.

- **`.stepper`** (`stepper.css`): an `<ol>` of links, the number a CSS counter. The current step is `aria-current="step"`; `--complete` and `--invalid` on the item change the marker's glyph (a tick, a bang), so no state is colour alone. A forced-colors pass keeps the current marker filled. Distinct from `.steps`, the static "what happens next" list.
- **`<StepperNav steps current status hrefFor>`** (`@getvitops/astro/components/StepperNav.astro`): the same list for a multi-page flow, driven by the server (`status` is what `allStepStatuses` returns). No JS at all; a step with no URL is a `<span>`, not a dead link.
- **`<wc-stepper>` and `<Stepper steps hash>`** (`@getvitops/astro/components/Stepper.astro`): with no JS a complete long form (headed `<section data-step>`s inside one `<form>`, `#anchor` links), every section visible. With JS one section shows, with Back and Next. Next and a forward nav link validate the steps they pass and stop at the first invalid one, so a required field cannot be skipped; going back is free. A submit the browser blocks on a hidden step shows that step; Enter moves on rather than submitting early; focus moves to the new step's heading; the URL fragment selects a step (`hash` writes it). Fires `stepper-change`.
- **Its own bundle, `@getvitops/core/stepper`** (Lit-free, ~1 KB gzipped, `verify:bundle-size` ceiling 2,000 B), not part of `elements.js`, which is at 99% of its budget. It loads in either order with `<wc-config-form>` and `<wc-field>`.

**CSS, all formats** (`stepper.css`; `wc-stepper` is `display: block` while un-upgraded). `@getvitops/generator`: a `stepper` entry in `TIERS`. `config`, `utils`, `cli` and `vite`: no consumer-facing change in these packages.
