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
- **`split`** — a two-column pair. Ratio rule: **`split-<a>-<b>`** where `<a>-<b>` ∈
  `1-2`, `2-1`, `1-3`, `3-1`, `1-4`, `4-1`, `2-3`, `3-2` (breakpoint-prefixable); equal
  columns without one. The ratio is a flex **basis**, so a column's padding counts
  inside its share, and `min-inline-size: 0` is built in so long unbreakable content
  can't stretch a column past it.
  - **Stacking is `flex-col`** — there is no split-specific class for it:
    `class="split flex-col md-split-1-2"` is stacked below 48rem and 1:2 above,
    because the `<bp>-` ratio classes assert the row. While stacked the ratio goes
    inert on its own (a percentage basis against an auto-height column resolves as
    `content`), unless you give the split a definite `block-size`.
  - **`split-reverse`** — swaps the two panels (breakpoint-prefixable). Implemented
    as `order` on the first child, so it reverses on whichever axis the split is
    currently on: bare, it swaps the columns in a row AND the rows in a stack;
    scoped (`md-split-reverse`) it swaps only once there are two columns — media
    first in source so it leads on mobile, on the right at width. The ratio stays
    with the source-first child, not with the visual position.
    - **Accessibility:** reversing makes visual order disagree with DOM order, and
      focus order follows the DOM (WCAG 2.4.3 Focus Order). Put focusable content in
      **only one** of the two panels, or the tab order will not be linear. The
      pattern declares `reading-flow: flex-visual`, which fixes this properly where
      it is supported; support is not yet broad enough to rely on.
- **Flex** — `flex`, `flex-row`, `flex-col`, `flex-row-reverse`, `flex-col-reverse`
  (all breakpoint-prefixable).
- **Alignment** — `items-{start,center,end,stretch}`, `justify-{start,center,end,between}`,
  text align `text-{start,center,end}` (all breakpoint-prefixable).
- **Display** — `block`, `inline`, `inline-block`, `flex`, `grid`, `hidden`
  (breakpoint-prefixable, e.g. `md-hidden`).
- **Accessibility** — `sr-only` / `not-sr-only` (breakpoint-prefixable).
- **State hooks** — `is-active`, `is-open` (styling flags toggled by JS / native state).

## Spacing

The space scale is `2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`, `7xl` exposed as `--space-<name>` tokens.
`rhythm` margins consume these tokens; prefer `rhythm` for vertical flow rather than
per-element margins.

Rule: **`gap-<name>`**, **`gap-x-<name>`** (column) and **`gap-y-<name>`** (row), name ∈
`2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`, `7xl` — all breakpoint-prefixable (`md-gap-l`, `@md:gap-l`). These are the
framework's own utilities in every format: the fluid steps are deliberately kept out of
Tailwind's `--spacing-*` namespace (named keys there shadow the size scales, so
`max-w-7xl` would resolve to `var(--spacing-7xl)`), which means Tailwind's numeric
`gap-4` still uses its own multiplier and coexists with these.

## Typography

Rule: **`font-<role>`** — role ∈ `display`, `title`, `heading`, `lead`, `body`, `quote`, `caption`, `eyebrow`, `footnote`, `code`, `tag`. Each role carries its own family,
size (from the type scale `2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`, `7xl`), tracking, transform, weight and `text-wrap`.
Families: `display`, `sans`, `code` (`--font-*`).

Because the role owns `text-wrap`, a heading is balanced and copy is `pretty` with **no
class at all** wherever `typography.headings` maps the bare element to a role. Override one
element with `text-{wrap,nowrap,balance,pretty}` — the per-element escape hatch, for markup
that carries no role class. (These four are Tailwind's own in the tailwind format.)

## Colour

**Functional tokens are the primary vocabulary** — classes name the *job*, not the tone, and
every one remaps automatically under `:root[data-brx-theme="dark"], :root[data-theme="dark"]` (background/text ends
swap; `solid` fills stay mode-stable with a computed `on-` foreground). Prefer these over
raw steps.

**Role names are yours.** `colors.roles` is an open map: add a key, and the generator emits
that role's full token set, its dark flip and every utility below. Your config
currently defines `neutral`, `surface`, `ui-primary`, `ui-secondary`, `ui-accent`, `brand-primary`, `brand-secondary`, `info`, `success`, `warning`, `danger`. Six of those are a **required core** — the framework's own
component CSS references `brand-primary`, `danger`, `neutral`, `surface`, `ui-primary`, `warning` with no fallback, so removing one
leaves those components uncoloured (`vitops validate` warns). Everything beyond them is free.

The rule is one shape — **`<target>-<role>[-<variant>]`**, target ∈ `bg` `text` `icon`
`border` — and the class name is exactly its token name minus `--color-`. Variants are
ordinal (`xx-muted` < `x-muted` < `muted` < bare < `bold` < `x-bold`) and sparse: only the
cells that hold their contrast target exist.

**Which cells exist depends on the role's `kind`:**

*Surface roles* (page and panel colours):

- **Backgrounds** — `bg-<role>` (the card/panel), `bg-<role>-muted` (the page behind it),
  `bg-<role>-x-muted` (well / inset), `bg-<role>-bold` and `-x-bold` (inverse surface).
  Elevation is *which* token you reach for, not a raised/sunken pair.
- **Content** — `text-<role>` (body), `text-<role>-bold`, `text-<role>-muted` (secondary),
  `text-<role>-x-muted` (placeholder) and `-xx-muted` (disabled). The last two are
  contrast-exempt by design.
- **Borders** — `border-<role>-muted` (hairline), `border-<role>`, `border-<role>-bold`
  (the one guaranteed to carry a boundary on its own).

*Chromatic roles* (signal colours) — **there is no bare `bg-<role>`**; say tint or solid:

- **Tints** — `bg-<role>-x-muted` (alert wash), `bg-<role>-muted` (badge).
- **Solids** — `bg-<role>-solid`, `-solid-bold` (hover), `-solid-x-bold` (active), each
  pairing with `text-on-<role>` for a guaranteed-contrast foreground.
- **Content** — `text-<role>`, `text-<role>-bold`. There is deliberately no
  `text-<role>-muted`: it could not hold its contrast target off a light surface, so soften
  coloured text with weight or size instead.
- **Borders** — `border-<role>`, `border-<role>-bold` (decorative status edges).

Both kinds also get **`icon-<role>`** — a separate non-text tier, so a glyph may run more
vivid than text — plus `glass` (translucent surface + backdrop blur), the `--overlay` scrim
and `--color-border-focus` for focus rings.

Everyday pairings, using the roles this config defines: page
`bg-neutral-muted`, cards `bg-neutral` on top of it, body
`text-neutral`, captions `text-neutral-muted`; buttons
`bg-ui-primary-solid text-on-ui-primary`;
alerts `bg-danger-x-muted text-danger`.

**Raw scale** (secondary / fine control) — rule `<util>-<hue>-<step>` with util ∈
`bg`, `text`, `icon`, `border`: every hue is an 11-step OKLCH scale generated from its seed (or fixed brand
tones), numeric steps `50` … `950` (tinted near-white → tinted near-black) — e.g.
`bg-pine-100`, `text-pine-800`. Hues: `pine`, `navy`, `amber`, `rust`, `cobalt`, `grey`.

> **Raw scale classes are frozen — they do NOT remap in dark mode.**
> `bg-pine-800` is that exact colour in every appearance. The automatic
> dark flip described above applies **only** to the functional role tokens, because
> `--color-<hue>-<step>` is emitted once and never re-pointed under `:root[data-brx-theme="dark"], :root[data-theme="dark"]`.
> A raw step on a page that can switch appearance is a latent bug: it looks correct in
> whichever mode you built it in and inverts in the other.
>
> If you are reaching for a raw step, you usually want a **role** instead — and roles are
> extensible, so adding one is a two-line config change:
>
> | instead of | use | why |
> | --- | --- | --- |
> | `bg-<hue>-50` / `-950` | `bg-<role>` (surface kind) | the card plane, flips automatically |
> | `bg-<hue>-100` / `-900` | `bg-<role>-muted` | the page, or a chromatic tint |
> | `bg-<hue>-500`…`-700` | `bg-<role>-solid` | vivid fill, mode-stable, pairs with `text-on-<role>` |
> | `text-<hue>-950` / `-50` | `text-<role>` | contrast-guaranteed body text |
> | `text-<hue>-800` / `-200` | `text-<role>-muted` | secondary text |
> | `border-<hue>-200` / `-800` | `border-<role>` | |
>
> Raw steps stay the right tool for genuinely fixed colours — a brand mark, a chart series,
> an illustration — where the value must not move between appearances.

## Shadows

Rule: **`drop-shadow-<size>`** — size ∈ `sm`, `md`, `lg`, `xl`, `2xl` (applied as a `filter`, so it
follows non-rectangular shapes).

## Animation

An effect carries no motion of its own — it sets `--<prop>-from`/`-to` and picks a keyframe.
A **driver** supplies the motion, and you always compose one of each:

- `animate-view` — plays as the element crosses the viewport
- `animate-scroll` — scrubs against page scroll
- `animate-trigger` — time-based; plays once when `.is-active` / `[data-active]` is set
- `transition` — transitions the same from/to vars, so it reverses on a state flip

Rule: **`<effect>`** — effect ∈ `fade-in`, `fade-out`, `slide-up`, `slide-down`, `slide-left`, `slide-right`, `scale-up`, `scale-down`, `rotate-cw`, `rotate-ccw`, `blur-in`, `blur-out`, `elevate-up`, `elevate-down`, `reveal-left`, `reveal-right`, `reveal-up`, `reveal-down`, `size-grow`, `size-shrink`. The state/flip prefixes above pair with
`transition` and apply to every one of them.

Each state matches the element **or its direct parent** (`.hover-<fx>:hover, :hover > .hover-<fx>`),
which is what makes `reveal-*` usable: it rests at a zero-area `clip-path`, and `clip-path` clips
hit-testing as well as painting, so the element itself can never be hovered.

`size-grow`, `size-shrink` animate `height`, the only stage that reflows and the only one behind a
feature gate: `0 → auto` is not interpolable without `interpolate-size: allow-keywords`, so
`transition` declares `height` only inside an `@supports` for it. The `layout` **keyframe**
has the same dependency — this is not a limit of the transition driver.

**When it plays.** `animate-view` and `.is-active` are both timed off the element's **midpoint**:
motion starts once that midpoint is 10% of the viewport in, and a one-shot entrance completes at
25%. Both stops are the element's position on screen rather than a fraction of its own height, so a
small card and a full-bleed section behave alike. Shift the window with `--anim-start` /
`--anim-end`, or replace it outright with `--anim-range`.

Composed **journeys** chain multiple effects into one entrance: rule `<parts>-journey`
(e.g. `fade-slide-journey`, `fade-scale-blur-journey`). They need a **keyframe** driver, not
`transition`. A journey is entry → hold → exit, so it starts on that same 10% pivot but runs to the
end of the exit phase — the hold occupies the middle of the crossing instead of the bottom edge of
the screen.

**`stagger`** on a parent offsets each child by `--stagger-amount` (time-based drivers) and by
`--stagger-range-step` (scroll-driven ones — `animation-delay` is ignored on a progress-based
timeline). Journeys set an explicit range and opt out.

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
- Shape primitives: `--br-<name>` radii — `pill`, `circle`.
