---
'@getvitops/create': patch
---

Update the `emdash` template for the target-prefixed colour grammar.

The template's `design-system.json` and layout referenced tokens the generator no longer
emits — `--surface-bg`, `--surface-bg-muted`, `--neutral-border` — so a freshly scaffolded
project rendered a transparent card on a borderless footer. They now read
`--color-bg-surface-muted`, `--color-bg-surface-x-muted` and `--color-border-neutral`, and
`colors.utilities` picks up the new `icon` tier.

Existing scaffolds are unaffected until you upgrade `@getvitops/*`; when you do, the
[colour grammar migration table](https://www.npmjs.com/package/@getvitops/generator) applies
to your own `design-system.json` the same way.
