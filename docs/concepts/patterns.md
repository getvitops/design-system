---
type: "Design Concept"
title: "Vitops component patterns — token cascade, override hooks, states"
description: "How pattern CSS is assembled: the token cascade (defaults → groups → per-pattern overrides), per-pattern override-hook variables, state shortcuts, and role variants."
resource: "design-system.json"
tags: [patterns, components, cascade, css, design-system]
generator: "@getvitops/generator"
---

# Component patterns — the CSS chain

Patterns (currently `btn`, `cta`, `link`, `badge`, `card`, `tag`, `status`, `tooltip`, `dialog`, `popover`, `dropdown`, `notification`, `lightbox`, `comment`, `tabs`, `drawer`, `carousel`, `nav`, `banner`, `details`, `table`, `list`, `tree`, `pull-quote`, `combobox`, `forms`) are authored declaratively under `patterns` in
`design-system.json` (see [authoring.md](../authoring.md)) and compiled to CSS in a
**components cascade layer** — so utility classes, which live in a later layer, always win over
pattern styling without specificity fights. `class="card bg-danger-muted"` tints the card.

The layer names differ by format, because each defers to its host:

| format | layer stack (last wins) |
| --- | --- |
| `css`, `bricks` | `vitops.base` → `vitops.components` → `vitops.utilities` |
| `tailwind` | Tailwind's own `theme` → `base` → `components` → `utilities` |

**Your own CSS beats all of it.** Unlayered styles outrank every cascade layer regardless of
specificity, so a plain stylesheet, an Astro scoped `<style>`, or a Bricks-authored class
overrides the framework with no `!important` and no specificity escalation. That is the
intended override story.

The one thing to watch: a **reset** must be layered too, and ordered *below* the framework —
left unlayered it beats the very component rules it is meant to sit under (a bare
`p { margin: 0 }` would defeat `.rhythm`). Declare the order before you load the stylesheet,
since layer precedence is fixed by first declaration:

```html
<style>@layer my.reset, vitops.base, vitops.components, vitops.utilities;</style>
<link rel="stylesheet" href="/styles.css">
```

Put it *after* the link and `my.reset` becomes a new name introduced later — which sorts
**last**, i.e. highest priority, and the reset wins. That is the one non-obvious step.

## 1 — Token cascade

Shared geometry resolves through a variable chain, most-specific first:

- `patterns.defaults` → `--<prop>-default` (cascade-wide fallbacks).
- `patterns.groups.<group>` → `--<prop>-<group>` (e.g. groups `label`, `control`, `panel`, `area`, `content`, `pull`); a pattern
  opts in via its `group` key.
- Per-pattern: each grouped pattern gets aliases `--<prop>-<name>-group` →
  `var(--<prop>-<group>)`, and `overrides` replace individual aliases with literal values.
- `patterns.radii` → `--br-<name>` shape primitives; `patterns.z` → `--z-tier-<name>`.

## 2 — Base declarations & override hooks

Each pattern's `base` block is emitted on its selector:

- `class` only → `.<class ?? name>`, at normal class specificity.
- `element` only → a **zero-specificity** `:where(<element>)` rule, so author CSS can always
  override it.
- **both** → one `:where(<element>, .<class>)` rule (e.g. `:where(button, .btn)`). The element
  gets the styling with no class needed, the class carries it to any other tag, and — because the
  whole thing sits at zero specificity — any explicit class wins, including a louder pattern
  (`.cta`) or a component's own rule (`.dialog__close`).

Geometry properties are wrapped in a **per-pattern override hook**:

| base property | hook variable |
| --- | --- |
| `padding` | `--p-<pattern>` |
| `border-radius` | `--br-<pattern>` |
| `border` | `--b-<pattern>` |
| `box-shadow` | `--ds-<pattern>` |
| `font-size` | `--fs-<pattern>` |

e.g. `padding: var(--p-btn, 0.4em 0.8em)` — a consumer restyles every button by setting
`--p-btn` on `:root`, without touching the pattern. The hook is named after the pattern's
**key**, not its class.

## 3 — States

`states` (hover / active / focus-visible) compile from shortcuts:

- `step: n` — intensify the pattern's colour one emphasis stop: fills swap
  `--<role>-solid` → `--<role>-solid-bold`; text patterns swap the `bold` emphasis stop →
  `x-bold`.
- `scale: 0.97` — transform scale; `lift: "<length>"` — `translate: 0 calc(-1 * <length>)`.
- `shadow: "<name>"` — `filter: drop-shadow(var(--shadow-<name>))`; `shadow: true` — the
  generic lift box-shadow.
- `ring: true` — focus ring (`box-shadow` in the role's `muted` stop, outline removed).
- `css: { … }` — raw declarations escape hatch.

Any pattern with states also gets a composed transition block (translate / scale / filter /
box-shadow / colours, `--interact-duration` / `--interact-easing` overridable). Hover
rules are wrapped in `@media (hover: hover)` so touch devices never stick.

## 4 — Role variants

`roles` lists semantic colour variants: class patterns emit `.<pattern>-<role>`
(`.badge-success`). A pattern with an `element` emits both the bare role class on the
element and the `-<role>` form (`:where(button, .btn).danger, .btn-danger`), so the same
variant works on a non-element host — both at class specificity, so neither outranks a
plain class. Fill
patterns set `background-color: var(--<role>-solid)` + `color: var(--<role>-on-solid)`;
text patterns use the role's `bold` emphasis stop. `default_role` colours the bare,
unsuffixed pattern. States re-apply per variant with the variant's role.
