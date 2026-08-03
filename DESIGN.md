---
version: alpha
name: "Vitops"
description: "Vitops is a calm, structural design system for content-led sites — editorial rather than app-like. It should feel considered and unhurried: generous measure, deliberate vertical rhythm, and colour used sparingly so a single accent still carries weight. Pine green anchors the identity against a deep navy surface; warmth comes from amber and rust, used as signals rather than decoration. Prefer restraint over ornament — depth from tonal layering and hairlines first, shadows only where something genuinely floats."
colors:
  # Raw hue ramps — 11 OKLCH steps each, tinted near-white → tinted near-black.
  pine-50: "#f4faf7"
  pine-100: "#e1f4eb"
  pine-200: "#c7e7d8"
  pine-300: "#a7d3c0"
  pine-400: "#81b9a1"
  pine-500: "#4a9075"
  pine-600: "#447c66"
  pine-700: "#3a6554"
  pine-800: "#2b4a3d"
  pine-900: "#1d3028"
  pine-950: "#121b17"
  navy-50: "#f5f9fe"
  navy-100: "#ebeff6"
  navy-200: "#d9dee7"
  navy-300: "#c2c8d1"
  navy-400: "#a5abb6"
  navy-500: "#89909c"
  navy-600: "#686f7c"
  navy-700: "#535b69"
  navy-800: "#3a4351"
  navy-900: "#1a2230"
  navy-950: "#14181f"
  amber-50: "#fbf8f3"
  amber-100: "#ffebc7"
  amber-200: "#ffd793"
  amber-300: "#f5b94a"
  amber-400: "#d4a145"
  amber-500: "#b1873c"
  amber-600: "#8a682d"
  amber-700: "#70562a"
  amber-800: "#513f21"
  amber-900: "#342a18"
  amber-950: "#1c1811"
  rust-50: "#fef6f6"
  rust-100: "#ffe5e1"
  rust-200: "#ffcdc6"
  rust-300: "#ffaea6"
  rust-400: "#f1897f"
  rust-500: "#e0625a"
  rust-600: "#ae4b45"
  rust-700: "#8b413c"
  rust-800: "#64322d"
  rust-900: "#3f2220"
  rust-950: "#1f1615"
  cobalt-50: "#f6f8fe"
  cobalt-100: "#e0efff"
  cobalt-200: "#c8deff"
  cobalt-300: "#a6c7ff"
  cobalt-400: "#6f9bff"
  cobalt-500: "#678cdf"
  cobalt-600: "#4f6cad"
  cobalt-700: "#43598b"
  cobalt-800: "#324263"
  cobalt-900: "#222b3f"
  cobalt-950: "#15181f"
  grey-50: "#f6f9fe"
  grey-100: "#eaeff7"
  grey-200: "#d8dee9"
  grey-300: "#c1c8d5"
  grey-400: "#a3abba"
  grey-500: "#868fa1"
  grey-600: "#6c7689"
  grey-700: "#535b6b"
  grey-800: "#3c434f"
  grey-900: "#262b35"
  grey-950: "#15181f"
  # Functional role tokens (LIGHT values). These are the public API: use these,
  # not the raw steps, and dark mode resolves itself. See "## Colors" below.
  bg-neutral: "{colors.grey-50}"
  bg-neutral-muted: "{colors.grey-100}"
  bg-neutral-x-muted: "{colors.grey-200}"
  bg-neutral-bold: "{colors.grey-800}"
  bg-neutral-x-bold: "{colors.grey-950}"
  text-neutral: "{colors.grey-900}"
  text-neutral-bold: "{colors.grey-950}"
  text-neutral-muted: "{colors.grey-700}"
  text-neutral-x-muted: "{colors.grey-500}"
  text-neutral-xx-muted: "{colors.grey-400}"
  text-on-neutral-bold: "{colors.grey-50}"
  icon-neutral: "{colors.grey-600}"
  icon-neutral-muted: "{colors.grey-500}"
  border-neutral-muted: "{colors.grey-200}"
  border-neutral: "{colors.grey-300}"
  border-neutral-bold: "{colors.grey-600}"
  bg-neutral-solid: "{colors.grey-600}"
  bg-neutral-solid-bold: "{colors.grey-700}"
  bg-neutral-solid-x-bold: "{colors.grey-800}"
  text-on-neutral: "#f5f9ff"
  bg-surface: "{colors.navy-50}"
  bg-surface-muted: "{colors.navy-100}"
  bg-surface-x-muted: "{colors.navy-200}"
  bg-surface-bold: "{colors.navy-800}"
  bg-surface-x-bold: "{colors.navy-950}"
  text-surface: "{colors.navy-900}"
  text-surface-bold: "{colors.navy-950}"
  text-surface-muted: "{colors.navy-700}"
  text-surface-x-muted: "{colors.navy-500}"
  text-surface-xx-muted: "{colors.navy-400}"
  text-on-surface-bold: "{colors.navy-50}"
  icon-surface: "{colors.navy-600}"
  icon-surface-muted: "{colors.navy-500}"
  border-surface-muted: "{colors.navy-200}"
  border-surface: "{colors.navy-300}"
  border-surface-bold: "{colors.navy-600}"
  bg-surface-solid: "{colors.navy-600}"
  bg-surface-solid-bold: "{colors.navy-700}"
  bg-surface-solid-x-bold: "{colors.navy-800}"
  text-on-surface: "#f5f9ff"
  bg-ui-primary-x-muted: "{colors.pine-50}"
  bg-ui-primary-muted: "{colors.pine-100}"
  text-ui-primary: "{colors.pine-700}"
  text-ui-primary-bold: "{colors.pine-900}"
  icon-ui-primary: "{colors.pine-600}"
  border-ui-primary: "{colors.pine-200}"
  border-ui-primary-bold: "{colors.pine-300}"
  bg-ui-primary-solid: "{colors.pine-600}"
  bg-ui-primary-solid-bold: "{colors.pine-700}"
  bg-ui-primary-solid-x-bold: "{colors.pine-800}"
  text-on-ui-primary: "#f3fbf7"
  bg-ui-secondary-x-muted: "{colors.cobalt-50}"
  bg-ui-secondary-muted: "{colors.cobalt-100}"
  text-ui-secondary: "{colors.cobalt-700}"
  text-ui-secondary-bold: "{colors.cobalt-900}"
  icon-ui-secondary: "{colors.cobalt-600}"
  border-ui-secondary: "{colors.cobalt-200}"
  border-ui-secondary-bold: "{colors.cobalt-300}"
  bg-ui-secondary-solid: "{colors.cobalt-600}"
  bg-ui-secondary-solid-bold: "{colors.cobalt-700}"
  bg-ui-secondary-solid-x-bold: "{colors.cobalt-800}"
  text-on-ui-secondary: "#f5f8ff"
  bg-ui-accent-x-muted: "{colors.amber-50}"
  bg-ui-accent-muted: "{colors.amber-100}"
  text-ui-accent: "{colors.amber-700}"
  text-ui-accent-bold: "{colors.amber-900}"
  icon-ui-accent: "{colors.amber-600}"
  border-ui-accent: "{colors.amber-200}"
  border-ui-accent-bold: "{colors.amber-300}"
  bg-ui-accent-solid: "{colors.amber-600}"
  bg-ui-accent-solid-bold: "{colors.amber-700}"
  bg-ui-accent-solid-x-bold: "{colors.amber-800}"
  text-on-ui-accent: "#fcf8f1"
  bg-brand-primary-x-muted: "{colors.pine-50}"
  bg-brand-primary-muted: "{colors.pine-100}"
  text-brand-primary: "{colors.pine-700}"
  text-brand-primary-bold: "{colors.pine-900}"
  icon-brand-primary: "{colors.pine-600}"
  border-brand-primary: "{colors.pine-200}"
  border-brand-primary-bold: "{colors.pine-300}"
  bg-brand-primary-solid: "{colors.pine-600}"
  bg-brand-primary-solid-bold: "{colors.pine-700}"
  bg-brand-primary-solid-x-bold: "{colors.pine-800}"
  text-on-brand-primary: "#f3fbf7"
  bg-brand-secondary-x-muted: "{colors.navy-50}"
  bg-brand-secondary-muted: "{colors.navy-100}"
  text-brand-secondary: "{colors.navy-700}"
  text-brand-secondary-bold: "{colors.navy-900}"
  icon-brand-secondary: "{colors.navy-600}"
  border-brand-secondary: "{colors.navy-200}"
  border-brand-secondary-bold: "{colors.navy-300}"
  bg-brand-secondary-solid: "{colors.navy-600}"
  bg-brand-secondary-solid-bold: "{colors.navy-700}"
  bg-brand-secondary-solid-x-bold: "{colors.navy-800}"
  text-on-brand-secondary: "#f5f9ff"
  bg-info-x-muted: "{colors.cobalt-50}"
  bg-info-muted: "{colors.cobalt-100}"
  text-info: "{colors.cobalt-700}"
  text-info-bold: "{colors.cobalt-900}"
  icon-info: "{colors.cobalt-600}"
  border-info: "{colors.cobalt-200}"
  border-info-bold: "{colors.cobalt-300}"
  bg-info-solid: "{colors.cobalt-600}"
  bg-info-solid-bold: "{colors.cobalt-700}"
  bg-info-solid-x-bold: "{colors.cobalt-800}"
  text-on-info: "#f5f8ff"
  bg-success-x-muted: "{colors.pine-50}"
  bg-success-muted: "{colors.pine-100}"
  text-success: "{colors.pine-700}"
  text-success-bold: "{colors.pine-900}"
  icon-success: "{colors.pine-600}"
  border-success: "{colors.pine-200}"
  border-success-bold: "{colors.pine-300}"
  bg-success-solid: "{colors.pine-600}"
  bg-success-solid-bold: "{colors.pine-700}"
  bg-success-solid-x-bold: "{colors.pine-800}"
  text-on-success: "#f3fbf7"
  bg-warning-x-muted: "{colors.amber-50}"
  bg-warning-muted: "{colors.amber-100}"
  text-warning: "{colors.amber-700}"
  text-warning-bold: "{colors.amber-900}"
  icon-warning: "{colors.amber-600}"
  border-warning: "{colors.amber-200}"
  border-warning-bold: "{colors.amber-300}"
  bg-warning-solid: "{colors.amber-600}"
  bg-warning-solid-bold: "{colors.amber-700}"
  bg-warning-solid-x-bold: "{colors.amber-800}"
  text-on-warning: "#fcf8f1"
  bg-danger-x-muted: "{colors.rust-50}"
  bg-danger-muted: "{colors.rust-100}"
  text-danger: "{colors.rust-700}"
  text-danger-bold: "{colors.rust-900}"
  icon-danger: "{colors.rust-600}"
  border-danger: "{colors.rust-200}"
  border-danger-bold: "{colors.rust-300}"
  bg-danger-solid: "{colors.rust-600}"
  bg-danger-solid-bold: "{colors.rust-700}"
  bg-danger-solid-x-bold: "{colors.rust-800}"
  text-on-danger: "#fff6f5"
  # Aliases for the spec's recommended names — references, not new values.
  primary: "{colors.bg-ui-primary-solid}"
  on-primary: "{colors.text-on-ui-primary}"
  secondary: "{colors.bg-ui-secondary-solid}"
  on-secondary: "{colors.text-on-ui-secondary}"
  tertiary: "{colors.bg-ui-accent-solid}"
  on-tertiary: "{colors.text-on-ui-accent}"
  neutral: "{colors.bg-neutral}"
  surface: "{colors.bg-surface}"
  on-surface: "{colors.text-surface}"
  error: "{colors.bg-danger-solid}"
  on-error: "{colors.text-on-danger}"
typography:
  display:
    fontFamily: "'Mulish', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "3.5832rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.035em"
  title:
    fontFamily: "'Mulish', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "2.986rem"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  heading:
    fontFamily: "'Mulish', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.44rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  lead:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  quote:
    fontFamily: "'Mulish', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "1.44rem"
    fontWeight: 400
    lineHeight: 1.3
  caption:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.8333rem"
    fontWeight: 400
    lineHeight: 1.3
  eyebrow:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.8333rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0.08em"
  footnote:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.6944rem"
    fontWeight: 400
    lineHeight: 1.4
  code:
    fontFamily: "ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, monospace"
    fontSize: "0.9em"
    fontWeight: 400
    lineHeight: 1.5
  tag:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.02em"
rounded:
  DEFAULT: "0.375rem"
  pill: "999px"
  label: "0.25rem"
  control: "{rounded.DEFAULT}"
  panel: "0.5rem"
  area: "0px"
  content: "0.5rem"
  pull: "0px"
spacing:
  base: "1rem"
  "2xs": "0.512rem"
  xs: "0.64rem"
  s: "0.8rem"
  m: "1rem"
  l: "1.25rem"
  xl: "1.5625rem"
  "2xl": "1.9531rem"
  "3xl": "2.4414rem"
  "4xl": "3.0518rem"
  "5xl": "3.8147rem"
  "6xl": "4.7684rem"
  "7xl": "5.9605rem"
components:
  btn:
    rounded: "{rounded.DEFAULT}"
    padding: "0.5em 1em"
  cta:
    backgroundColor: "{colors.bg-ui-primary-solid}"
    textColor: "{colors.text-on-ui-primary}"
    rounded: "{rounded.DEFAULT}"
    padding: "0.75em 1.5em"
  cta-hover:
    backgroundColor: "{colors.bg-ui-primary-solid-bold}"
  link:
    textColor: "{colors.text-ui-primary}"
  link-hover:
    textColor: "{colors.text-ui-primary-bold}"
  badge:
    backgroundColor: "{colors.bg-neutral-solid}"
    textColor: "{colors.text-on-neutral}"
    rounded: "{rounded.pill}"
    padding: "0.2em 0.6em"
  card:
    backgroundColor: "{colors.bg-surface}"
    rounded: "{rounded.panel}"
    padding: "1.75rem"
  tag:
    textColor: "{colors.text-neutral-bold}"
    rounded: "{rounded.label}"
    padding: "0.25em 0.6em"
  status:
    backgroundColor: "{colors.bg-neutral-bold}"
---

# Vitops

## Overview

Vitops is a calm, structural design system for content-led sites — editorial rather than app-like. It should feel considered and unhurried: generous measure, deliberate vertical rhythm, and colour used sparingly so a single accent still carries weight. Pine green anchors the identity against a deep navy surface; warmth comes from amber and rust, used as signals rather than decoration. Prefer restraint over ornament — depth from tonal layering and hairlines first, shadows only where something genuinely floats.

Every value in this document is generated from a single `design-system.json` and
emitted as CSS custom properties plus utility classes. **Prefer the class vocabulary
over hand-written CSS** — `vitops docs classes` prints the full list, and `vitops lint`
reports classes that resolve to nothing.

The token names below are the contract. Reach for a raw ramp step only when no
functional role expresses what you mean.

> Most tokens here are consumed by **utility classes**, not by the `components` block —
> `bg-<role>`, `text-<role>-muted` and friends are the API. `design.md lint` reports
> those as `orphaned-tokens`; that rule assumes a component-only system and does not
> apply. Everything else it reports is worth reading.

## Colors

6 hues (`pine`, `navy`, `amber`, `rust`, `cobalt`, `grey`), each generated as an 11-step
OKLCH scale from a seed — step `50` is a tinted near-white, `950` a tinted near-black,
with chroma damped toward both ends so the extremes read as neutral rather than washed.

11 semantic **roles** map onto those hues:

- `neutral` → `grey`
- `surface` → `navy`
- `ui-primary` → `pine`
- `ui-secondary` → `cobalt`
- `ui-accent` → `amber`
- `brand-primary` → `pine`
- `brand-secondary` → `navy`
- `info` → `cobalt`
- `success` → `pine`
- `warning` → `amber`
- `danger` → `rust`

A role is **not** an alias for a ramp. It resolves to tokens named
`<target>-<role>[-<variant>]`, where target is one of `bg` `text` `icon` `border`. The
target is part of the name on purpose: `bg-danger-muted` and `text-danger-muted` are
different tokens, so there is no ambiguity about which one a name refers to. **The token
name is also the utility class name** — write `class="bg-danger-muted"` and you are using
`--color-bg-danger-muted`.

Variants are ordinal: `xx-muted` < `x-muted` < `muted` < (bare) < `bold` < `x-bold`.
`bold` means *more emphatic in the current appearance*, not darker.

Roles come in two kinds, and the kind decides which tokens exist:

- **surface** (page and panel colours) — `bg-<role>` is the card/panel, `bg-<role>-muted`
  the page behind it, `bg-<role>-x-muted` a well. Full text scale, `border-<role>-bold`
  as the contrast-guaranteed boundary.
- **chromatic** (signal colours) — backgrounds are either *tints*
  (`bg-<role>-x-muted` / `-muted`) or *solids*
  (`bg-<role>-solid` / `-solid-bold` / `-solid-x-bold`). **There is no bare `bg-<role>`**:
  say how loud you mean. `text-on-<role>` is the guaranteed-contrast foreground for the
  solid family.

**Dark mode is automatic, and this file only lists the light values.** The spec has no
way to express a second appearance, so do not try to reconstruct one: the framework
re-points each token at a different ramp step under `:root[data-brx-theme="dark"], :root[data-theme="dark"]`, so `bg-<role>`
becomes dark and `text-<role>` becomes light on their own. The solid family and
`text-on-<role>` stay mode-stable by design, so a filled button keeps its identity.
**An agent that styles with the role tokens gets dark mode for free; one that flattens
them to hexes breaks it.**

Contrast is enforced at build time, not by convention — a violation fails the build.
Text is held to APCA Lc 75 on a role's primary background and Lc 60 on its secondary
planes; icons and the surface boundary to Lc 45; and chromatic text is checked against
the *surface* planes it actually sits on, not just its own tints. Pairing
`text-<role>` with `bg-<role>`, or `text-on-<role>` with `bg-<role>-solid`, is always
safe. Pairing a raw ramp step with another raw ramp step is not.

## Typography

Font stacks are named, and roles consume the name rather than the stack — so swapping a
typeface is one edit:

- **display** — `'Mulish', system-ui, -apple-system, 'Segoe UI', sans-serif`
- **sans** — `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
- **mono** — `ui-monospace, 'Cascadia Code', 'SF Mono', Menlo, monospace`

Type is a fluid modular scale: 12 steps (`2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`, `7xl`) built from a
1rem base at a 1.2 ratio, interpolating between a 1.12 ratio at 22.5rem viewport width and the full ratio at 80rem. **The `fontSize` values in the front matter are the maximum (desktop) sizes** — the
real tokens are `clamp()` expressions, which the spec's `Dimension` type cannot hold.
Never hard-code the emitted number; use the scale (`--text-<step>`) or the role class.

Each typography role is a class (`.font-<role>`): `font-display`, `font-title`, `font-heading`, `font-lead`, `font-body`, `font-quote`, `font-caption`, `font-eyebrow`, `font-footnote`, `font-code`, `font-tag`.
Roles also carry properties this format has no slot for — `text-transform`,
`text-wrap`, and a `color` — so **apply the role class rather than copying its
front-matter properties**, or uppercase eyebrows and balanced headings silently
disappear. Base page text is bound to the `body` role, so prose inherits it.

## Layout & Spacing

Spacing is its own fluid modular scale: 12 steps (`2xs`, `xs`, `s`, `m`, `l`, `xl`, `2xl`, `3xl`, `4xl`, `5xl`, `6xl`, `7xl`) from a
1rem base at a 1.25 ratio. As with type,
the front-matter values are the maxima and the live tokens are fluid.

Layout is composed from utilities rather than bespoke CSS:

- `.centered` — track-based centering: content sits in a centred measure while
  full-bleed children can still break out. Use it instead of `margin-inline: auto`.
- `.rhythm` — vertical rhythm between flow children, so sibling spacing is one
  decision rather than per-element margins.
- `.flex` / `.split-<a>-<b>` / `.grid` — the structural families, with container-query
  variants prefixed `sm-` / `md-` / `lg-` / `xl-` (30 / 48 / 64 / 80rem).
  `.split` is a two-column pair. Stack it with `.flex-col` and let a
  breakpoint-prefixed ratio un-stack it (`split flex-col md-split-1-2`);
  `.split-reverse` swaps the two panels. Reversing puts visual order out of step
  with DOM order, so keep focusable content in only one panel.

Breakpoints are **container** queries, not viewport media queries: a component
responds to the space it is given, so the same markup works in a sidebar and a full-width
section.

## Elevation & Depth

Depth comes from 5 named shadows (`sm`, `md`, `lg`, `xl`, `2xl`), applied as `--shadow-<name>` tokens or `.drop-shadow-<name>` utilities:

- `sm` — `0 1px 2px rgb(0 0 0 / 0.08)`
- `md` — `0 4px 6px rgb(0 0 0 / 0.12)`
- `lg` — `0 10px 15px rgb(0 0 0 / 0.18)`
- `xl` — `0 20px 25px rgb(0 0 0 / 0.22)`
- `2xl` — `0 32px 44px rgb(0 0 0 / 0.26)`

Each value is deliberately a **single layer with no spread and no `inset`**: the same
token feeds both `box-shadow` (pattern geometry) and `filter: drop-shadow()` (the
utilities), and `drop-shadow()` rejects all three, which would drop the whole filter.

Surfaces stack tonally as well: `surface-bg-bold` is the *raised* plane in both
appearances, so a card on a page reads as lifted without any shadow at all.

## Shapes

Corner radii resolve through a cascade rather than being set per component:
`--br-<pattern>` (your override hook) → `--br-<pattern>-group` → the group's radius →
`--br-default`. Overriding one variable restyles every pattern in that tier.

- `DEFAULT` — `0.375rem`
- `pill` — `999px`
- `label` — `0.25rem`
- `control` — `{rounded.DEFAULT}`
- `panel` — `0.5rem`
- `area` — `0px`
- `content` — `0.5rem`
- `pull` — `0px`

Change a group's radius to restyle a whole tier; change `DEFAULT` to restyle everything
that has not opted out.

**Not in the front matter above**, because the spec's `Dimension` type only holds
px / em / rem — these are real radii in the system and have to be applied as CSS:

- `circle` — `50%`
- `status` — `50%`

## Components

Patterns are classes, not components — apply them to whatever element is semantically
correct. Two tiers of button exist and the distinction is intent, not looks:

- **`.cta`** is *persuasion* — filled, bolder, more padding, lifts on hover. Usually on an
  `<a>`, because a call to action usually navigates.
- **`.btn`** is *affordance* — it only says "this is interactive". It is emitted at zero
  specificity for both `<button>` and `.btn`, so a bare `<button>` gets it with no class
  and **any** explicit class overrides it.

Role variants are systematic rather than enumerated above. A filled pattern's variant sets
`background-color: var(--<role>-solid)` with `color: var(--<role>-on-solid)`; a text
pattern's sets `color: var(--color-<role>-bold)`:

- `btn` → `.btn-success`, `.btn-danger`, `.btn-warning`, `.btn-info`
- `cta` → `.cta-brand-primary`, `.cta-success`, `.cta-danger`, `.cta-warning`, `.cta-info`
- `badge` → `.badge-success`, `.badge-danger`, `.badge-warning`, `.badge-info`
- `card` → `.card-success`, `.card-danger`, `.card-warning`, `.card-info`
- `tag` → `.tag-success`, `.tag-danger`, `.tag-warning`, `.tag-info`
- `status` → `.status-dot-success`, `.status-dot-danger`, `.status-dot-warning`, `.status-dot-info`

Interaction states are generated from a small grammar — `step` (intensify the colour),
`scale`, `lift`, `shadow`, `ring` — so hover, active and focus-visible stay consistent
across every pattern. Focus rings are never removed, only restyled.

## Do's and Don'ts

- **Do** use functional role tokens (`ui-primary-solid`, `surface-bg`) over raw ramp steps.
- **Do** pair `<role>-text` with `<role>-bg`, and `<role>-on-solid` with `<role>-solid` —
  those pairings are contrast-tested; arbitrary ones are not.
- **Do** apply the `.font-<role>` classes rather than copying their font properties.
- **Do** reach for a utility class before writing CSS; run `vitops lint` to catch classes
  that resolve to nothing.
- **Don't** hard-code the `fontSize` / `spacing` numbers from the front matter — they are
  the maxima of fluid `clamp()` scales.
- **Don't** flatten role tokens to hex values: that is exactly what breaks dark mode.
- **Don't** invent a colour outside the 6 ramps or the 11 roles; add a hue to the config instead.
- **Don't** edit this file by hand — it is generated from `design-system.json`. Change the
  config and re-run `vitops generate --format design`.
