---
title: Your design system
description: How design-system.json is structured — colours, scales, patterns and animations — and what each section generates.
sidebar:
  order: 20
---

`design-system.json` is the only file you edit. Everything the toolchain emits is derived from it,
and the JSON Schema is published so editors give you autocomplete and hover docs:

```json title="design-system.json"
{
  "$schema": "./node_modules/@getvitops/generator/schema.json"
}
```

`vitops init` stamps that for you.

## What each section drives

| Section | Generates |
| --- | --- |
| `colors` | 11-step OKLCH scales per hue, functional role tokens, automatic dark mode, colour utilities |
| `typeScale` / `spaceScale` | Fluid modular scales as `clamp()` steps |
| `typography` | Font families and semantic type roles → `font-<role>` utilities |
| `patterns` | Component CSS (`.cta`, `.btn`, `.card`, `.badge`, …) plus the token cascade |
| `animations` | Effect and journey classes, layered over the hand-written animation engine |
| `shadows` | `--shadow-<name>` tokens and `.drop-shadow-<name>` utilities |

The [reference section](/reference/authoring/) documents every field, rendered from the schema
itself — so it can't fall out of step with what validation accepts.

## Colours are seeded, not enumerated

You give a hue a seed; the generator derives the full scale and the functional tokens over it.

```json
{
  "colors": {
    "palette": { "pine": { "seed": "#4A9075" } },
    "roles": { "brand-primary": "pine", "ui-primary": "pine" }
  }
}
```

That yields `--color-pine-50 … 950`, plus role tokens (`--brand-primary-solid`,
`--brand-primary-on-solid`, `--brand-primary-text`, …) and matching utilities. Dark mode is an
automatic functional flip, not a second palette you maintain. Contrast targets — text at
APCA Lc ≥ 75, muted ≥ 60, in both appearances — are enforced by unit tests in the generator.

See [Colour system](/reference/concepts-color/) for the full model.

## Patterns are declarative

A pattern is `base` declarations, interaction `states`, and semantic role variants:

```json
{
  "cta": {
    "group": "control",
    "class": "cta",
    "fill": true,
    "default_role": "brand-primary",
    "overrides": { "p": "0.75em 1.5em" },
    "base": { "padding": "var(--p-cta-group)", "font-weight": "600" },
    "states": { "hover": { "step": 1, "lift": "1px" }, "active": { "scale": 0.97 } },
    "roles": ["success", "danger", "warning", "info"]
  }
}
```

Two things worth internalising:

- **Geometry resolves through the group alias layer.** Write `var(--p-cta-group)`, not
  `var(--p-control, 0.75em)`. Both render the same, but the first keeps the pattern → group
  mapping in CSS where you can inspect and change it in devtools. The chain is `--p-cta`
  (your override hook) → `--p-cta-group` → `--p-control` → `--p-default`.
- **`element` + `class` emit one zero-specificity rule.** `"element": "button", "class": "btn"`
  produces `:where(button, .btn)`, so a bare `<button>` is styled with no class, `.btn` carries
  the styling to any other tag, and any explicit class overrides it without `!important`.

See [Component patterns](/reference/concepts-patterns/) for the full cascade.
