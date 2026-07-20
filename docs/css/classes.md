---
type: "CSS Framework Reference"
title: "Vitops CSS framework — class vocabulary"
description: "Every utility and component class in the Vitops CSS framework, stated as a naming rule over the design tokens it expands."
resource: "src/design-system.json"
tags: [css, utilities, patterns, design-system]
generator: lib/generate-docs.ts
---

# Vitops CSS framework — class vocabulary (LLM reference)

A variable-driven CSS framework. Classes encode the design system's **tokens** (colour,
type, space, shadow), **responsive grammar**, and **interaction states** — so styling with
these classes stays consistent and theme-/dark-mode-aware. Prefer them over hand-written
CSS or ad-hoc property values.

This is a **rule reference**, not an exhaustive list: each family below is a naming rule
plus the set of tokens it expands over. Applying a rule to any listed token yields a valid
class (e.g. rule `bg-<color>` + colour `pine-xl` → `bg-pine-xl`).

## Responsive & state variant grammar

Every utility accepts a **container-breakpoint prefix**; animation utilities also accept a
**state prefix**. In CSS/Bricks the separator is `-`; in Tailwind it is `:` / `@`.

| Intent            | CSS / Bricks               | Tailwind                                  |
| ----------------- | -------------------------- | ----------------------------------------- |
| responsive split  | `md-split-1-2`             | `@md:split-1-2`                           |
| responsive align  | `md-items-center`         | `@md:items-center`                        |
| hover effect      | `transition hover-fade-in` | `transition fade-in hover:flip-fade-in`   |

- Breakpoint prefixes (bare): `sm-` = 30rem, `md-` = 48rem, `lg-` = 64rem, `xl-` = 80rem.
- State prefixes (animation effects only): `hover-`, `active-`, `focus-`, and `flip-<effect>`
  (plays the effect in reverse on toggle). Effects require `transition` on the element.

## Layout & structure

- **`centered`** — named-track grid centering content in the reading `measure` track.
  Widen a **direct child** by adding `breakout`, `spotlight`, or `fullbleed` (each
  breakpoint-prefixable) to that child. Track widths are set via `--width-measure` /
  `--width-breakout` / `--width-spotlight` and `--gutter`.
- **`rhythm`** — relationship-based vertical spacing (margins between headings, paragraphs,
  lists, media) driven by the space scale. Usually paired with `centered`.
- **`split`** — equal flex columns. Ratio rule: **`split-<a>-<b>`** where `<a>-<b>` ∈
  `1-2`, `2-1`, `1-3`, `3-1`, `1-4`, `4-1`, `2-3`, `3-2` (breakpoint-prefixable).
- **Flex** — `flex`, `flex-row`, `flex-col`; `g` for gap (space-scale token).
- **Alignment** — `items-{start,center,end,stretch}`, `justify-{start,center,end,between}`,
  text align `text-{start,center,end}` (all breakpoint-prefixable).
- **Display** — `block`, `inline`, `inline-block`, `flex`, `grid`, `hidden`
  (breakpoint-prefixable, e.g. `md-hidden`).
- **Accessibility** — `sr-only` / `not-sr-only` (breakpoint-prefixable).
- **State hooks** — `is-active`, `is-open` (styling flags toggled by JS / native state).

## Spacing

The space scale is `2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`, `7xl` exposed as `--space-<name>` tokens.
Gap (`g`) and `rhythm` margins consume these tokens; prefer `rhythm` for vertical flow
rather than per-element margins.

## Typography

Rule: **`font-<role>`** — role ∈ `display`, `title`, `heading`, `lead`, `body`, `quote`, `caption`, `eyebrow`, `footnote`, `code`, `tag`. Each role carries its own family,
size (from the type scale `2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`, `7xl`), tracking, transform, and weight.
Families: `display`, `sans`, `code` (`--font-*`).

## Colour

Rule: **`<util>-<color>`** — util ∈ `bg`, `text`, `border`; `<color>` is either a **named ramp**
step or a **semantic role**.

- Named ramps: `pine`, `navy`, `amber`, `rust`, `cobalt`, `grey`. Steps: base (no suffix) + `xxd`, `xd`, `d`, `l`, `xl`, `xxl` — e.g. `bg-pine`
  (base), `text-navy-xl`, `border-grey-d`.
- Semantic roles: `brand-primary`, `surface`, `success`, `info`, `danger`, `warning`, `neutral` — e.g. `bg-brand-primary`, `text-danger`. Roles remap
  automatically under `:root[data-brx-theme="dark"]`.

## Shadows

Rule: **`drop-shadow-<size>`** — size ∈ `sm`, `md`, `lg`, `xl`, `2xl` (applied as a `filter`, so it
follows non-rectangular shapes).

## Animation

Rule: **`<effect>`** (with the state/flip prefixes above) — effect ∈ `fade-in`, `fade-out`, `slide-up`, `slide-down`, `slide-left`, `slide-right`, `scale-up`, `scale-down`, `rotate-cw`, `rotate-ccw`, `blur-in`, `blur-out`, `elevate-up`, `elevate-down`, `reveal-left`, `reveal-right`, `reveal-up`, `reveal-down`, `size-grow`, `size-shrink`.
Composed **journeys** chain multiple effects into one entrance: rule `<parts>-journey`
(e.g. `fade-slide-journey`, `fade-scale-blur-journey`). All require `transition` on the
element; scroll-linked entrances resolve within the first portion of the element's scroll.

## Component patterns

Each pattern is a base class `<pattern>` with interaction states (hover/active/focus-visible)
baked in; coloured patterns add role variants via rule **`<pattern>-<role>`**.

- Patterns: `button`, `link`, `badge`, `card`, `tag`, `status`, `tooltip`, `dialog`, `popover`, `dropdown`, `notification`, `lightbox`, `comment`, `tabs`, `drawer`, `carousel`, `nav`, `banner`, `details`, `table`, `list`, `tree`, `pull-quote`, `combobox`, `forms`.
- Roles (for coloured patterns like `badge`, `tag`, `status`, `button`):
  `brand-primary`, `success`, `danger`, `warning`, `info`, `neutral` — e.g. `badge-success`, `button-danger`. The default (unsuffixed)
  variant uses the brand-primary role.
- Shape primitives: `--br-<name>` radii — `pill`, `circle`, `chip`, `card`.
