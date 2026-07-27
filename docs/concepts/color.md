---
type: "Design Concept"
title: "Vitops colour system — seeded scales, functional tokens, automatic dark mode"
description: "How palette hues become 11-step OKLCH scales, how semantic roles derive functional tokens from them, and how dark mode flips automatically."
resource: "design-system.json"
tags: [color, oklch, dark-mode, design-system]
generator: "@getvitops/generator"
---

# Colour system

Authoring is two maps in `design-system.json` (see [authoring.md](../authoring.md)):
`colors.palette` (hues) and `colors.roles` (semantic role → hue). Everything else —
scales, functional tokens, utilities, dark mode — is derived.

## From seed to scale

Each palette hue becomes an **11-step numeric OKLCH scale**, `--color-<hue>-50…950`,
running tinted near-white → tinted near-black. Two authoring modes:

- **Seeded** (`{ seed, anchors? }`): the scale is generated from one colour. The seed is
  preserved at its natural lightness step; `anchors` pin specific steps and the rest
  interpolate around them.
- **Fixed** (`{ tones }`): a brand kit used verbatim — each authored tone lands at its
  nearest step, endpoints are tinted off-white/off-black, no interpolation.

Current hues: `pine`, `navy`, `amber`, `rust`, `cobalt`, `grey`.

## Functional tokens (the public vocabulary)

Each role in `colors.roles` (currently `neutral`, `surface`, `ui-primary`, `ui-secondary`, `ui-accent`, `brand-primary`, `brand-secondary`, `info`, `success`, `warning`, `danger`) derives a family of
**job-named** tokens from its hue's scale:

- `--<role>-bg`, `--<role>-bg-muted` — background washes.
- `--<role>-border`, `--<role>-border-bold` — borders.
- `--<role>-solid`, `--<role>-solid-bold` — opaque fills (buttons, badges), paired with
  `--<role>-on-solid` for a guaranteed-contrast foreground.
- `--<role>-text`, `--<role>-text-muted`, `--<role>-text-x-muted` — content colours.
- **Emphasis stops** `--color-<role>-{x-muted,muted,bold,x-bold}` — appearance-relative:
  `muted` recedes toward the background extreme and `bold` advances toward the
  foreground, in *either* light or dark.
- Plus `--surface-glass` (translucent surface) and `--overlay` (scrim).

Classes name the token, not the tone: `bg-<role>`, `text-<role>-muted`, `text-on-<role>`,
`border-<role>` (see [css/classes.md](../css/classes.md)).

## Automatic dark mode

Dark mode is a **functional flip** under `:root[data-brx-theme="dark"]`: background and
text ends of each scale swap, while `solid` fills stay mode-stable with a recomputed
`on-solid` foreground. There is no per-appearance scheme grammar to author and no named
steps — a role token means the same *job* in both appearances.

## Contrast guarantees

Text tokens target APCA Lc ≥ 75 and muted text Lc ≥ 60, in **both** appearances —
enforced by the generator's unit tests, not left to the author.
