---
type: "Design Concept"
title: "Vitops colour system — seeded scales, target-prefixed tokens, automatic dark mode"
description: "How palette hues become 11-step OKLCH scales on a shared lightness ladder, how semantic roles derive target-prefixed tokens from them, and how dark mode flips automatically."
resource: "design-system.json"
tags: [color, oklch, dark-mode, design-system]
generator: "@getvitops/generator"
---

# Colour system

Authoring is two maps in `design-system.json` (see [authoring.md](../authoring.md)):
`colors.palette` (hues) and `colors.roles` (semantic role → hue). Everything else —
scales, role tokens, utilities, dark mode — is derived.

## From seed to scale

Each palette hue becomes an **11-step numeric OKLCH scale**, `--color-<hue>-50…950`,
running tinted near-white → tinted near-black. Two authoring modes:

- **Seeded** (`{ seed, anchors? }`): the scale is generated from one colour. The seed is
  preserved at its natural lightness step; `anchors` pin specific steps and the rest
  interpolate around them.
- **Fixed** (`{ tones }`): a brand kit used verbatim — each authored tone lands at its
  nearest step, endpoints are tinted off-white/off-black, no interpolation.

Current hues: `pine`, `navy`, `amber`, `rust`, `cobalt`, `grey`.

## The token grammar

Every colour token is named:

```
--color-<target>-<role>[-<variant>]      target ∈ bg | text | icon | border
```

The target sits **inside** the name on purpose. `--color-bg-danger-muted` and
`--color-text-danger-muted` are different tokens, so there is nothing to arbitrate between
them — an earlier grammar put both on one `<family>-<role>-<modifier>` name and needed a
precedence rule, which made half the variants unreachable and the rest non-monotonic.

**The token name is also the utility class name**, minus the `--color-` prefix. Write
`class="bg-danger-muted"` and you are using `--color-bg-danger-muted`. One vocabulary, not
two (see [css/classes.md](../css/classes.md)).

Variants are ordinal — `xx-muted` < `x-muted` < `muted` < (bare) < `bold` < `x-bold` — and
the tables are **sparse**: only cells that actually hold their contrast target exist.
`bold` means *more emphatic in the current appearance*, not darker.

## Role kinds

A role in `colors.roles` (currently `neutral`, `surface`, `ui-primary`, `ui-secondary`, `ui-accent`, `brand-primary`, `brand-secondary`, `info`, `success`, `warning`, `danger`) is one of two kinds, and the kind decides
which tokens exist:

- **`surface`** — a page or panel colour. `bg-<role>` is the card, `bg-<role>-muted` the page
  behind it, `bg-<role>-x-muted` a well, `bg-<role>-bold` the inverse surface a tooltip sits
  on. Full text scale, and `border-<role>-bold` as the contrast-guaranteed boundary.
- **`chromatic`** (the default, and what the bare-string form means) — a signal colour.
  Backgrounds split into *tints* (`bg-<role>-x-muted`, `bg-<role>-muted`) and *solids*
  (`bg-<role>-solid`, `-solid-bold`, `-solid-x-bold`). There is deliberately **no bare
  `bg-<role>`**: "how loud?" is a question the author answers. `text-on-<role>` is the
  guaranteed foreground for the solid family.

Plus `--surface-glass` (translucent surface), `--overlay` (scrim) and
`--color-border-focus` (the focus ring, taken from `ui-primary`'s solid tone).

## Automatic dark mode

Dark mode re-points which step each token reads, under `:root[data-brx-theme="dark"], :root[data-theme="dark"]`:
background and text ends of each scale swap, while the **solid family stays mode-stable**
along with the `text-on-<role>` foreground computed against it — so a filled button keeps
its identity when the appearance flips. There is no per-appearance scheme grammar to author
and no named steps: a role token means the same *job* in both appearances.

Raw hue steps (`--color-<hue>-<step>`) are the exception — they are fixed values and are
**not** re-pointed. Reach for a role token unless you specifically want a colour that
ignores the appearance.

Two attributes, one flip: `data-brx-theme` is Bricks' own (Bricks sets it on the
WordPress target), `data-theme` is what the shipped `<wc-color-scheme-toggle>` writes on
`<html>`, so the toggle works on every other target. Set either.

The OS preference is a **second, opt-in block**. Set
`designSystem.defaultColorScheme: "system"` in your site config and the same delta is emitted again inside
`@media (prefers-color-scheme: dark)`, under
`:root:not([data-brx-theme="light"]):not([data-theme="light"])` — i.e. whenever no explicit choice has been made. That is what makes
`<wc-color-scheme-toggle>`'s "System" position resolve to the OS (it *removes* the attribute,
so without this block it fell through to light), and it gives a no-JS page the OS
appearance, which the toggle alone never could. An explicit light choice still wins.

It is opt-in rather than default because turning it on flips a site dark for dark-OS
visitors, which is the site's decision and not the design system's.

## Contrast guarantees

Enforced **at build time** — a violation fails `generate`, so an unreadable pairing cannot
ship. In both appearances:

| tier | target | applies to |
| --- | --- | --- |
| text | APCA Lc ≥ 75 | `text-<role>` on the role's primary background |
| secondary | Lc ≥ 60 | text on any other background plane; `text-<role>-muted`; `text-on-<role>` on its solid |
| non-text | Lc ≥ 45 | `icon-<role>`, and a surface role's `border-<role>-bold` |

Two deliberate exemptions: `text-<role>-x-muted` (placeholders) and `-xx-muted` (disabled
text) are *required* to look unavailable, and holding them to the body-text bar would defeat
the affordance. Nothing else is exempt.

Chromatic text is checked against the **surface planes it actually sits on**, not only its
own tints — coloured text appears over the page far more often than over its own wash.

A `tones` kit thin enough that snapping can't cover a tier is reported rather than shipped;
the fix is another tone, and the failure says so.
