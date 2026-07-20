---
name: bricks-design-system
description: Learn and work with the Vitops design system and its Bricks Builder outputs — the design-system.json source of truth, the generated CSS-framework class vocabulary, and the custom Bricks elements. Use when building or editing Bricks pages/elements, choosing which framework CSS classes to apply, adding or changing design tokens, or understanding what the build emits for WordPress/Bricks.
---

# Vitops design system (Bricks)

Vitops generates a design system for websites — primarily WordPress with **Bricks Builder**.
It is one source of truth (`src/design-system.json`) that a generator turns into a
variable-driven **CSS framework** (utility + pattern classes), a set of **Lit web
components**, and repo-owned **Bricks elements**. Everything else is generated — treat the
JSON and the hand-written CSS/PHP as source, and the rest as output.

Read `AGENTS.md` at the repo root for the full build/codegen contract; this skill is the
task-oriented map for the design system and its Bricks surface.

The generator is also published as a reusable toolchain under `packages/` — **`@getvitops/generator`**
(library + JSON Schema), **`@getvitops/cli`** (`vitops generate|init|validate`), and
**`@getvitops/vite`** (Astro/EmDash plugin) — and this repo dogfoods it. Any consumer runs the
tool against their own `design-system.json`; `packages/cli/README.md` documents the output and
the WordPress/Bricks setup (the `functions.php` loader snippet + deploy recipes). See the
"Published toolchain" section of `AGENTS.md`. The legacy `vp run build`/`deploy` pipeline below is
unchanged and produces output equivalent to `vitops generate --format bricks`.

## Source of truth: `src/design-system.json`

Top-level keys and what each controls (the generator, `lib/generate-design-system.ts`,
expands these into CSS tokens, utility classes, and Bricks import JSON):

| Key          | Controls                                                                                                                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `colors`     | `named` ramps (e.g. `pine`, `navy` … × steps `xxd…xxl`), `semantic` roles (`brand-primary`, `surface`, `success`, `danger`, …), and which `utilities` emit (`bg`/`text`/`border`). Drives colour tokens, dark-mode overrides, and colour utility classes. |
| `shadows`    | `--shadow-<name>` tokens (`sm`/`md`/`lg`/`xl`) → `drop-shadow-<name>` utilities.                                                                                                                                                                          |
| `fonts`      | Font stacks (`display`/`sans`/`mono`) → `--font-*`.                                                                                                                                                                                                       |
| `typeScale`  | Fluid modular type scale (`names`, `ratio`, `fluid`) used by type-role sizes.                                                                                                                                                                             |
| `spaceScale` | Fluid space scale → `--space-<name>` tokens consumed by gap/rhythm.                                                                                                                                                                                       |
| `typography` | `families`, semantic type `roles` (display/title/heading/body/quote/caption/eyebrow/code/lead/footnote/tag) → `font-<role>` utilities, and `headings`.                                                                                                    |
| `patterns`   | Component patterns (`items`: button/link/badge/card/… with `base`, `states`, `roles`), plus `defaults`, `radii`, `groups`, `z`. Drives `patterns.css`.                                                                                                    |
| `animations` | `effects` (fade/slide/scale/blur/…) and composed `journeys` → `animation-effects.css`.                                                                                                                                                                    |

To change the system, **edit `design-system.json` (or the hand-written CSS/PHP), then
regenerate** — never hand-edit generated files.

## Generated reference docs — read these for specifics

The build emits an **Open Knowledge Format** bundle under `docs/` (deployed to
`<theme>/dist/docs/`). It is generated from source, so it always matches what ships — prefer
it over guessing class or element names:

- `docs/index.md` — bundle index.
- **`docs/css/classes.md`** — the full CSS-framework class vocabulary, stated as **naming
  rules** (colour, typography, spacing, layout, animation, component patterns) plus the
  responsive/state variant grammar (`md-`, `hover-`, `flip-…`, breakpoint sizes). Start here
  to pick a class.
- **`docs/bricks/elements.md`** — per-element reference for every custom Bricks element:
  label, controls (types/defaults/options/bound CSS vars), seeded children, keywords.
- `docs/bricks/index.md` — Bricks integration + the styling rule below.

These are generated by `lib/generate-docs.ts`; don't hand-edit them.

## What the build emits for Bricks

`npx vp run build` (default target = Bricks) produces under `dist/`:

- `styles.min.css` — the framework CSS bundle (lightningcss). In Bricks format, colour and
  type **tokens are provided by Bricks' managers** (imported from the JSON below), not the CSS.
- `bricks-colors-{named,semantic}.json` — palettes to import into Bricks' Color Manager.
- `polyfills.js`, `elements.js`, `deferred.js`, `editor.js` — ES-module bundles (web
  components self-register from `elements.js`).
- `bricks/` — the custom elements (`bricks/elements/*.php`) + `load.php`, the theme bootstrap
  that registers the elements and enqueues the CSS/JS. Elements group under a "Vitops"
  category in the builder.
- `docs/` — the OKF reference bundle above.

Custom Bricks elements live in `bricks/elements/*.php` (source). Most wrap a Lit web
component (`<wc-*>`); a few are pure CSS-pattern markup (Split, Centered, Menu, Split Link).

## Core rule: prefer framework classes over Bricks UI property tuning

When styling an element, **add the framework CSS classes in the element's "CSS classes"
field** rather than hand-setting spacing/colour/typography via Bricks' property panels. The
classes carry the design system's tokens, responsive grammar, and interaction states — so
they stay consistent, respond to theme/dark mode, and update with the system. Ad-hoc Bricks
property values are one-off and drift; reserve them for genuinely bespoke cases.

## Common tasks

- **Which class does X?** → search `docs/css/classes.md` (rules + token lists). Apply the
  rule to a listed token (e.g. `bg-<color>` + `navy-xl` → `bg-navy-xl`; `split-<a>-<b>`,
  breakpoint-prefixable as `md-split-1-2`).
- **What does a Bricks element do / what are its controls?** → `docs/bricks/elements.md`.
- **Add/adjust a token** (colour, shadow, font, scale, pattern, animation) → edit
  `src/design-system.json`, then `npx vp run build`. The docs + CSS + Bricks JSON regenerate.
- **Add/change a Bricks element** → edit `bricks/elements/*.php` (see AGENTS.md for the
  nestable/render conventions), then `npx vp run build`. `docs/bricks/elements.md`
  regenerates from the PHP.
- **Other output formats** → `npx vp run build:docs` (standalone CSS for non-Bricks),
  `npx vp run build:tailwind` (Tailwind v4 for Astro). See AGENTS.md `--format` section. The same
  outputs are available via the toolchain: `vitops generate --format <bricks|css|tailwind>`.
- **Build/publish the toolchain** → `npx vp run build:packages` (builds `@getvitops/{core,cli,vite}`);
  `npx vp run release` versions + publishes via Changesets. The schema lives in
  `packages/generator/src/schema.ts` (single source of truth) → emits `packages/generator/schema.json`.

Lint/format/typecheck run automatically on save and via a PostToolUse hook — don't invoke
`vp check`/`fmt`/`lint` as a manual verification step.
