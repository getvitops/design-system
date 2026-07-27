---
type: "Formats Reference"
title: "Vitops — output formats (tailwind vs css vs bricks)"
description: "What each vitops generate format emits, what the target platform provides instead, and the Tailwind-specific rules (which framework utilities are stripped in favour of Tailwind defaults)."
resource: "design-system.json"
tags: [formats, tailwind, bricks, css, design-system]
generator: "@getvitops/generator"
---

# Output formats — `tailwind` vs `css` vs `bricks`

One config, three targets: `vitops generate --format <tailwind|css|bricks>`. The **class
vocabulary is the same** everywhere (see [css/classes.md](css/classes.md)); what differs is
which layers the generator emits versus which the platform provides, and the variant
separator (`-` in CSS/Bricks, `:` / `@` in Tailwind).

## `tailwind` — single-file Tailwind v4 layer

Emits one self-contained `tailwind.css` (plus `tokens.json`): `@import "tailwindcss"`,
`@theme` tokens, the framework's structural CSS + component patterns inlined, and
`@utility` definitions for the bespoke families (type roles, animation effects,
split ratios, track placement).

**Use Tailwind's own utilities for these class names.** The framework's rules for them are
deliberately stripped from the bundle because Tailwind provides them natively — writing
them still works, but they are Tailwind's, not the framework's:

`absolute`, `block`, `collapse`, `content-around`, `content-between`, `content-center`, `content-end`, `content-evenly`, `content-start`, `contents`, `fixed`, `flex`, `flex-col`, `flex-col-reverse`, `flex-nowrap`, `flex-row`, `flex-row-reverse`, `flex-wrap`, `flow-root`, `grid`, `hidden`, `inline`, `inline-block`, `inline-flex`, `inline-grid`, `inline-table`, `invisible`, `isolate`, `items-baseline`, `items-center`, `items-end`, `items-start`, `items-stretch`, `justify-around`, `justify-between`, `justify-center`, `justify-end`, `justify-evenly`, `justify-start`, `list-item`, `not-sr-only`, `relative`, `sr-only`, `static`, `sticky`, `table`, `table-caption`, `table-cell`, `table-row`, `text-center`, `text-end`, `text-justify`, `text-left`, `text-right`, `text-start`, `visible`

Other Tailwind-specific behaviour:

- **Variants are Tailwind's job.** No pre-expanded breakpoint/state classes are emitted
  (the framework's `@container (min-width: …)` variant blocks are dropped); use Tailwind
  syntax — `@md:split-1-2`, `hover:flip-fade-in`. Container breakpoints are registered as
  `--container-{sm,md,lg,xl}` = 30/48/64/80rem, backing the `@sm:`…`@xl:` variants.
- **The space scale is NOT mapped into Tailwind's `--spacing-*` namespace** (that would
  corrupt Tailwind's numeric multipliers and `max-w-*` sizes). Numeric utilities like
  `p-4` keep Tailwind's 0.25rem meaning; use the design-system scale via arbitrary
  values — `p-(--space-m)`, `gap-(--space-m)`.
- **Functional colour roles are plain `:root` variables, not `@theme` colours**, so
  Tailwind doesn't auto-derive utilities from them; the emitted `@utility` set
  (`bg-<role>`, `text-<role>-muted`, …) is the public API. The raw hue scales ARE
  `@theme` colours, so native `bg-<hue>-500`-style utilities work.

## `css` — standalone bundle

Emits a bundled, self-contained `styles.css` + `tokens.json` + `design-manifest.json`.
The colour and font/scale layers are fully included, and every utility family is
pre-expanded — including breakpoint/state variants with `-` separators
(`md-split-1-2`, `hover-fade-in`). For non-Bricks, non-Tailwind consumers and the
docs build.

## `bricks` — WordPress / Bricks Builder payload

Emits the full deployable theme payload: `styles.min.css`, the Bricks import JSONs
(`bricks-colors-{named,semantic}.json`, `bricks-variables.json`), `tokens.json`, the JS
bundles (polyfills / elements / deferred), the Bricks element PHP under `bricks/`, and
this docs bundle under `docs/`.

- **Bricks provides the token layer.** `color.css` and `type-tokens.css` are one-line
  stubs: the colour `:root` tokens, dark-mode overrides, colour utility classes, fonts,
  and type/space scales are generated live by Bricks' Color / Font / Variables Managers
  from the imported JSONs. Semantic palette entries carry `darkEnabled` + a `dark` ref so
  Bricks emits the dark-mode overrides on import.
- Everything else (patterns, shadows, typography roles, animation effects, structural
  framework CSS) ships in `styles.min.css` as in the other formats.
- Pattern states reference shadows by name, compiled to
  `filter: drop-shadow(var(--shadow-<name>))`.
