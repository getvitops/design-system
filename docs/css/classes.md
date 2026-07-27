---
type: "CSS Framework Reference"
title: "Vitops CSS framework — class vocabulary"
description: "Every utility and component class in the Vitops CSS framework, stated as a naming rule over the design tokens it expands."
resource: "design-system.json"
tags: [css, utilities, patterns, design-system]
generator: "@getvitops/generator"
---

# Vitops CSS framework — class vocabulary (LLM reference)

A variable-driven CSS framework. Classes encode the design system's **tokens** (colour,
type, space, shadow), **responsive grammar**, and **interaction states** — so styling with
these classes stays consistent and theme-/dark-mode-aware. Prefer them over hand-written
CSS or ad-hoc property values.

This is a **rule reference**, not an exhaustive list: each family below is a naming rule
plus the set of tokens it expands over. Applying a rule to any listed token yields a valid
class (e.g. rule `bg-<color>` + colour `pine-xl` → `bg-pine-xl`).

The tokens themselves are authored in `design-system.json` — see
[/authoring.md](../authoring.md); the systems behind them are explained in
[/concepts/](../concepts/index.md); per-format output differences (including which of
these utilities Tailwind provides natively) in [/formats.md](../formats.md).

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

**Functional tokens are the primary vocabulary** — classes name the *job*, not the tone, and
every one remaps automatically under `:root[data-brx-theme="dark"]` (background/text ends
swap; `solid` fills stay mode-stable with a computed `on-` foreground). Prefer these over
raw steps. Rules (role ∈ `neutral`, `surface`, `ui-primary`, `ui-secondary`, `ui-accent`, `brand-primary`, `brand-secondary`, `info`, `success`, `warning`, `danger`):

- **Surfaces** — `bg-<role>` (the role's background wash; for `surface` this is the
  card/panel plane), `bg-<role>-muted` (subtle / sunken), `bg-surface-bold` (raised plane).
- **Solid fills** — `bg-<role>-solid`, `bg-<role>-solid-bold` (hover / emphasis), paired
  with `text-on-<role>` for guaranteed-contrast foreground.
- **Content** — `text-<role>` (primary, contrast-guaranteed in both appearances),
  `text-<role>-muted` (secondary), `text-<role>-x-muted` (tertiary / disabled).
- **Borders** — `border-<role>`, `border-<role>-bold`.
- **Translucency** — `glass` (translucent surface + backdrop blur); `--overlay` scrim var.
- **Emphasis stops** (appearance-relative vars for power use):
  `--color-<role>-{x-muted,muted,bold,x-bold}` — `muted` recedes toward the background
  extreme, `bold` advances toward the foreground, in *either* appearance.

Everyday pairings: page `bg-neutral` + `text-neutral`; cards `bg-surface`; captions
`text-neutral-muted`; buttons `bg-ui-primary-solid text-on-ui-primary`; status text
`text-danger` / `text-success` / `text-warning` / `text-info`.

**Raw scale** (secondary / fine control) — rule `<util>-<hue>-<step>` with util ∈
`bg`, `text`, `border`: every hue is an 11-step OKLCH scale generated from its seed (or fixed brand
tones), numeric steps `50` … `950` (tinted near-white → tinted near-black) — e.g.
`bg-pine-100`, `text-pine-800`. Hues: `pine`, `navy`, `amber`, `rust`, `cobalt`, `grey`.
The **bare** role name (`bg-<role>`, `text-<role>`) is always the functional token.

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
baked in; coloured patterns add role variants via rule **`<pattern>-<role>`**. (How the
pattern CSS is assembled — token cascade, `--p-<pattern>`-style override hooks, state
shortcuts — is explained in [/concepts/patterns.md](../concepts/patterns.md).)

- Patterns: `btn`, `cta`, `link`, `badge`, `card`, `tag`, `status`, `tooltip`, `dialog`, `popover`, `dropdown`, `notification`, `lightbox`, `comment`, `tabs`, `drawer`, `carousel`, `nav`, `banner`, `details`, `table`, `list`, `tree`, `pull-quote`, `combobox`, `forms`.
- Roles (for coloured patterns — `badge`, `tag`, `status`, `cta`, `btn`, …):
  `success`, `danger`, `warning`, `info`, `ui-primary`, `brand-primary`, `neutral` — e.g. `badge-success`, `cta-danger`. A pattern that also styles an
  element accepts the bare role class too (`<button class="danger">`). The default
  (unsuffixed) variant uses the pattern's `default_role`.
- Shape primitives: `--br-<name>` radii — `pill`, `circle`, `card`.
