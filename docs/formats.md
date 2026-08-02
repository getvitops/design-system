---
type: "Formats Reference"
title: "Vitops — output formats (tailwind vs css vs bricks vs design)"
description: "What each vitops generate format emits, what the target platform provides instead, and the Tailwind-specific rules (which framework utilities are stripped in favour of Tailwind defaults)."
resource: "design-system.json"
tags: [formats, tailwind, bricks, css, design, design-system]
generator: "@getvitops/generator"
---

# Output formats — `tailwind` vs `css` vs `bricks` vs `design`

One config, four targets: `vitops generate --format <tailwind|css|bricks|design>`. Three of
them are stylesheets, and across those the **class vocabulary is the same** (see
[css/classes.md](css/classes.md)); what differs is which layers the generator emits versus
which the platform provides, and the variant separator (`-` in CSS/Bricks, `:` / `@` in
Tailwind). The fourth, `design`, emits no CSS at all.

`--format` takes a comma-separated list, so the brief composes with a stylesheet:
`vitops generate --format css,design`.

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
  (the framework's `@container (min-width: …)` **variant** blocks are dropped; component
  container queries such as the sitenav's desktop switch are kept); use Tailwind syntax —
  `@md:split-1-2`, `hover:flip-fade-in`. Container breakpoints are registered as
  `--container-{sm,md,lg,xl}` = 30/48/64/80rem, backing the `@sm:`…`@xl:` variants.

  > **Three spellings, and only two of them work here.**
  >
  > | you write | in `tailwind` | note |
  > | --- | --- | --- |
  > | `@md:flex-row` | ✅ container query | the framework's breakpoints (48rem) |
  > | `md:flex-row` | ✅ media query | **Tailwind's** breakpoints, which differ — `sm:` is 40rem where `@sm:` is 30rem |
  > | `md-flex-row` | ❌ silently nothing | the css/bricks spelling; not emitted in this format |
  >
  > `md-*` is the trap: it is a real class in `css`/`bricks` and a no-op here, and
  > nothing errors — the element simply never changes at the breakpoint. Prefer `@md:`
  > so one vocabulary of breakpoints applies throughout.

- **Overriding `--container-*` also moves Tailwind's width scale.** Registering the
  framework breakpoints in `@theme` re-points `max-w-sm`…`max-w-xl` at the same values,
  so `max-w-md` is 48rem here rather than Tailwind's stock 28rem. Use
  `max-w-(--container-md)` style arbitrary values if you need to be explicit.
- **The space scale is NOT mapped into Tailwind's `--spacing-*` namespace** (that would
  corrupt Tailwind's numeric multipliers and `max-w-*` sizes). Numeric utilities like
  `p-4` keep Tailwind's 0.25rem meaning; use the design-system scale via arbitrary
  values — `p-(--space-m)`, `gap-(--space-m)`.
- **Functional colour roles are plain `:root` variables, not `@theme` colours**, so
  Tailwind doesn't auto-derive utilities from them; the emitted `@utility` set
  (`bg-<role>`, `text-<role>-muted`, …) is the public API. The raw hue scales ARE
  `@theme` colours, so native `bg-<hue>-500`-style utilities work.

  This split is deliberate and load-bearing. When a token sits in `@theme` *and* an
  `@utility` of the derived name exists, Tailwind merges both into one rule with the
  `@theme` declaration last — regardless of source order. Only palette hues belong in
  `@theme`, where nothing competes for the name. Role tokens stay in a plain `:root`
  block, and `format-parity.test.ts` derives that guard from the emitted token names so
  it cannot go quiet if the grammar moves again.
- **`colors.utilities` is a floor here, not a ceiling.** It controls which families get
  explicit role `@utility` rules, exactly as in `css`/`bricks`. But the raw hue scales
  are `@theme` colours, and Tailwind derives *every* colour family from those on demand
  (`ring-`, `divide-`, `accent-`, `caret-`, …), so hue-step utilities you did not enable
  still resolve in this format.

## `css` — standalone bundle

Emits a bundled, self-contained `styles.css` + `tokens.json` + `design-manifest.json`.
The colour and font/scale layers are fully included, and every utility family is
pre-expanded — including breakpoint/state variants with `-` separators
(`md-split-1-2`, `hover-fade-in`). For non-Bricks, non-Tailwind consumers and the
docs build.

**Cascade layers.** The bundle ships three, in precedence order:

```
@layer vitops.base, vitops.components, vitops.utilities;
```

- `vitops.base` — the UA reset and the pure `:root` token blocks.
- `vitops.components` — the animation engine, structural layout, and every pattern.
- `vitops.utilities` — `bg-*`, `text-*`, `border-*`, `drop-shadow-*`, `font-*`,
  animation effects, and the display/`sr-only` families.

So a utility overrides a pattern: `class="card bg-danger-muted"` tints the card. Your own
unlayered CSS beats all three — see [concepts/patterns.md](concepts/patterns.md) for the
override story and the one gotcha (a reset must be layered and ordered first).

Known gap: `layout.css` is a single partial mixing structural rules (`.rhythm`,
`.centered`) with utilities (`.m-*`, `.flex`, `.split-*`), so it sits in
`vitops.components` whole — its utility half cannot yet override a pattern. Splitting it is
tracked separately.

## `bricks` — WordPress / Bricks Builder payload

Emits the full deployable theme payload: `styles.min.css`, the Bricks import JSONs
(`bricks-colors-{named,semantic}.json`, `bricks-variables.json`), `tokens.json`, the JS
bundles (polyfills / elements / deferred), the Bricks element PHP under `bricks/`, and
this docs bundle under `docs/`.

- **Bricks provides the token layer.** `color.css` and `type-tokens.css` are one-line
  stubs: the colour `:root` tokens, dark-mode overrides, colour utility classes, fonts,
  and type/space scales are generated live by Bricks' Color / Font / Variables Managers
  from the imported JSONs. Semantic palette entries carry `darkModeEnabled` + a `dark` ref so
  Bricks emits the dark-mode overrides on import.
- Everything else (patterns, shadows, typography roles, animation effects, structural
  framework CSS) ships in `styles.min.css` as in the other formats.
- Pattern states reference shadows by name, compiled to
  `filter: drop-shadow(var(--shadow-<name>))`.

## `design` — the agent-facing brief

Emits exactly one file, `DESIGN.md`, in the
[google-labs-code/design.md](https://github.com/google-labs-code/design.md) format: YAML
front matter carrying the tokens (`colors`, `typography`, `rounded`, `spacing`,
`components`, with `{group.token}` references) followed by a prose body carrying the
rationale. It is meant to be run with `--out .` — DESIGN.md conventionally sits at a repo
root beside `AGENTS.md`, not in a build directory.

**No CSS, no `tokens.json`, nothing else.** This format is a description of the system for
a tool that has to work without it — a coding agent in another repo, a Figma import, a
designer. It is not a build target, and `vitops lint` does not accept it.

Three things the format cannot represent, and what is emitted instead:

| Ours | Why it doesn't fit | Emitted as |
| --- | --- | --- |
| fluid `clamp()` type / space steps | a spec `Dimension` is a number + px/em/rem | the **max** (desktop) value, with the prose saying so |
| the automatic dark flip | the spec has no notion of a second appearance | **light** values only, with the flip explained in prose |
| a `50%` radius | same `Dimension` restriction | dropped from `rounded`, named in the Shapes prose |

Role tokens are emitted as `{colors.<hue>-<step>}` **references** into the raw ramps rather
than flattened hexes, so the role → ramp lineage survives the export. `on-solid` is the
exception — it is a computed contrast literal with no step behind it.

`meta.name` / `meta.description` in `design-system.json` supply the brand name and the
Overview paragraph; everything else is derived from the config, so the brief cannot drift
from what the other three formats build.
