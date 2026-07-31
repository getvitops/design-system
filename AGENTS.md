This repo is responsible for generating design systems for use in websites (primarily Astro and WordPress with Bricks Builder).

It is composed of:

- TS-based utilities
- Variable-based lightweight CSS Framework for high level design patterns and common utilities (e.g. track-based centering of content, vertical rhythm, UI patterns)
- Lit-based Web Components for patterns that benefit from progressive enhancement (they are styled via the CSS Framework, and are fully operable, although degraded, in non-JS environments)

Prefer using modern CSS/HTML features (e.g. CSS Anchor Positioning API, Dialog, Invoker Commands API, Scroll Timelines, etc.) over JavaScript.

## Component architecture

Three tiers, chosen by **whether a pattern actually needs JavaScript**:

1. **CSS framework** (`@getvitops/core` `css/`) — every pattern expressible in pure HTML/CSS.
   Variable-driven utility + component classes, built on modern platform features (Anchor
   Positioning, Popover, Invoker Commands, `<details>`, subgrid, container queries, scroll-driven
   animations). Reach for these before anything else.

2. **Web components** (`@getvitops/core` `src/web-components/`, `<wc-*>`, Lit) — **only** for patterns
   that genuinely benefit from **progressive enhancement**, and they must **SSR**:
   - The slotted/light-DOM markup is the **fallback**, and it must be **accessible and usable on its
     own with no JS** (semantic HTML). The component never renders from empty.
   - On registration it **parses that fallback and augments it** in place. Use light DOM
     (`createRenderRoot() → this`) so the framework CSS applies to both the fallback and the enhanced
     result.
   - Exemplar: **`WCEntries`** — with no JS it renders semantic `<h3>` + `<dl>` pairs; with JS on a
     wide container it parses them into a table. (Others: carousel, image-compare, multi-field, …)
   - Shipped as feature-detected, deferred ES-module bundles
     (`@getvitops/core/{polyfills,elements,deferred}`); polyfills load **only** when a native feature
     is missing (see `Polyfills.astro`).

3. **Platform wrappers** (`@getvitops/astro` components; future `@getvitops/bricks`) — thin
   **authoring conveniences (DX)** for the pure-HTML/CSS patterns: they render the correct
   markup/classes so authors don't hand-write boilerplate, and they **must not require runtime JS**.
   - e.g. `Subgrid.astro` just emits `<ul class="grid"><li class="grid-rows-subgrid">…</li></ul>` from
     slotted children; `Popover.astro` uses the native Popover API + Anchor Positioning;
     `Nav`/`Details`/`Drawer` compose `<details>` + Invoker Commands (`command`/`commandfor`) — all
     no-JS. Renderers like `NodeRenderer`/`FormRenderer` turn a data model into that markup at
     SSR time.
   - **The rule:** if a wrapper would need runtime JS, it's the wrong tier — build a **web component**
     (tier 2) instead, and have the wrapper emit its `<wc-*>` tag with the accessible fallback inside.
     A feature-detected polyfill for a native CSS/HTML feature is fine; application/behaviour JS is not.

**The one deliberate exception: `<wc-theme-editor>`** (`@getvitops/core/editor`). It is _tooling_, not
a page pattern — a live editor has no accessible no-JS fallback to enhance, so it fails the tier-2 bar
on purpose. It is quarantined instead of excused: its own bundle entry (`src/js/editor.ts` →
`dist/editor.js`), never registered in `elements.js`, opt-in per consumer
(`getvitops({ editor: true })`), and carrying no Lit, so a production page that doesn't ask for it
pays nothing. Don't use it as precedent for putting behaviour JS in a `<wc-*>` element.

## The live theme editor

`<wc-theme-editor>` layers runtime `:root` overrides over the generated token layer via one injected
`<style id="ds-overrides">`, so the whole design system is tunable in the browser with no rebuild. It
reads its editable surface from `design-manifest.json` (a `css`-format output) and exports edits back
as CSS or as a `design-system.json` patch; on a dev server running `@getvitops/vite`, **Save to
source** POSTs that patch to `/__vitops/design-system` and the plugin merges → validates → writes →
regenerates. On any static build the probe fails and the button isn't rendered.

Three things here are load-bearing and easy to break:

- **A role is not a ramp alias.** `--color-<role>-<step>` is never emitted — a role resolves to
  _functional_ tokens (`--<role>-bg`, `--<role>-solid`, `--color-<role>-bold`, …). Two of them can't
  be derived in the browser (`solid` scans the hue for its natural 500 and clamps; `on-solid` is a
  computed contrast literal), which is why the manifest ships **`colors.roleTokens`** precomputed per
  hue, in `default` and `surface` variants × light/dark. A remap copies that set; it does not rewrite
  a ramp reference. The previous editor got this wrong and wrote 11 dead declarations per role.
- **Palette hexes are scheme-global.** The dark block re-points which step each functional token
  reads; it never redefines `--color-<hue>-<step>`. Hue edits therefore belong in `:root` only.
- **A step maps to `colors.palette.<hue>.anchors.<n>`, not `.seed`.** The seed regenerates the whole
  ramp, and mapping all 11 steps to one path silently loses every edit but the last.

Consumers point the element at its manifest with the `manifest` attribute; the Astro integration's
`editor: true` mirrors the file to `/vitops/design-manifest.json` (the default) _inside the generate
pass_, so it can't race a cold start or go stale after a config edit.

## Published toolchain: `@getvitops/*`

Published as a **reusable toolchain** (like Tailwind/shadcn): every client runs it against their own
consumer-editable `design-system.json` — there is no shared/canonical token set to ship. Workspace
packages under `packages/` (a pnpm workspace), by layer:

- **`@getvitops/core`** — the design-system **framework** (the runtime everything builds on): the
  variable-driven **CSS partials** (`css/`), the Lit **web components**, and the feature-detected
  browser **polyfills**. Subpath exports: `./css/*`, `./elements`, `./polyfills`, `./deferred`,
  `./editor`. Inert on its own — the CSS resolves against the token layer the generator emits.
- **`@getvitops/generator`** — the **generator** as a library + the JSON Schema. Public API:
  `generate({ input, format, outDir })`, `generateDocs()`, `validate()`, `defaultConfig()`,
  `DesignSystemSchema`, `jsonSchema`. The `zod/mini` schema in `packages/generator/src/schema.ts` is
  the **single source of truth** (the `DesignSystem` type via `z.infer`, the published JSON Schema via
  `toJSONSchema` → `schema.json`, and runtime validation all derive from it). It sources the framework
  CSS partials + prebuilt JS bundles from `@getvitops/core` and ships the Bricks PHP + `load.php`; it
  also carries the site-config schema (`site.ts` → `site.schema.json`).
- **`@getvitops/utils`** — shared build-time utilities (favicon generation via `sharp` +
  `png-to-ico`, loaded lazily; `oxipng` crush optional). Consumed by cli/vite/astro.
- **`@getvitops/cli`** — `vitops generate|init|validate|favicon|agents|docs|lint` (bin `vitops`), a
  thin wrapper over the generator + utils. The package **ships a static `vitops-design-system` agent
  skill** (`skill/SKILL.md`, in `files`); `agents` symlinks it into a consumer's
  `.agents/skills/` + `.claude/skills/` (logical `node_modules/@getvitops/cli/skill` target — never
  a pnpm realpath — so links survive version bumps) and writes a managed pointer block into their
  `AGENTS.md`. `docs <topic>` prints a reference doc to stdout, rendered live from the consumer's
  config (`--docs-dir` on `agents` keeps the legacy emit-files layout).

  `lint` (`src/lint.ts`) scans consumer source for framework classes that resolve to nothing —
  the failure mode where an unknown utility is indistinguishable from a working one. It is
  **format-aware** (`md-flex-row` is real in css/bricks and inert in tailwind) and deliberately
  judges **only classes anchored to the consumer's own config** — a palette hue, a role, a type
  role, a shadow. It never tries to enumerate "all valid classes", because under the tailwind
  format that would mean knowing Tailwind's whole vocabulary and every unknown would be a false
  positive. It asks `roleColorUtilities()` what the generator emits rather than re-deriving it.

- **`@getvitops/vite`** — a Vite plugin (Astro/EmDash) that runs the generator on build/dev (+
  optional favicon generation) and hot-regenerates when the config changes.
- **`@getvitops/astro`** — the **Astro integration**: a default `getvitops()` integration
  (favicons/PWA + web-component bundles copied to `public/` + the design-system CSS generated and
  auto-injected) plus a `<Head />` component and HTML/type authoring helpers. Wraps generator + utils
  - vite + core.
- **`@getvitops/create`** — **`vp create` org templates** (no build step; published as-is). Its
  `package.json` carries a `createConfig.templates` manifest over bundled `templates/*` directories,
  so `vp create @getvitops` opens a picker and `vp create @getvitops:emdash` scaffolds an EmDash CMS
  website on Cloudflare Workers (D1 + R2) with `@getvitops/{astro,emdash,cli}` pre-wired. Template
  deps must use concrete npm ranges (never `workspace:*`/`catalog:` — scaffolded projects live
  outside this monorepo), and `templates/**` is excluded from the root lint (imports resolve only in
  a scaffolded project). Ship `_gitignore` (renamed to `.gitignore` on scaffold).

Dependency versions are centralized in `pnpm-workspace.yaml`'s `catalog:` (referenced via the
`catalog:` protocol); internal deps use `workspace:*`. Both are rewritten to concrete versions on
publish.

Per-format output (into `outDir`): `tailwind` → self-contained `tailwind.css` + `tokens.json`;
`css` → bundled standalone `styles.css` + `tokens.json` + `design-manifest.json`; `bricks` → the
full deployable payload (`styles.min.css`, `bricks-colors-*.json`, `bricks-variables.json`,
`tokens.json`, JS bundles, `bricks/` PHP, `docs/`). The generator is **pure** — it mutates no shared
state; the css/bricks bundle is assembled in memory and minified with lightningcss.

**This repo dogfoods the tool:** the framework source lives in `@getvitops/core`
(`packages/core/{css,src}`); root `src/` holds only the example `design-system.json` — the live theme
editor that used to sit beside it is now `@getvitops/core/editor` (see below).
`packages/generator/scripts/prepare.mjs` snapshots core's CSS + built JS bundles (and
the repo's `bricks/` PHP) into `packages/generator/assets/` and emits `schema.json` /
`site.schema.json` — all gitignored build inputs, like `dist/`. The root `build` runs the toolchain
(`build:bricks` → `build:theme` → `lib/build-theme.ts` → the generator; no lightningcss CLI) — see
the Build system section.

Build/publish: `npx vp run build:packages` (core → generator → utils → cli → vite → astro; each task
`dependsOn` the packages it imports) and `npx vp run release` (`build:packages && changeset publish`).
Versioning is via Changesets (`.changeset/config.json`): `core`/`generator`/`utils`/`cli`/`vite`/`astro`
are **fixed** together — one version for the whole toolchain; `@getvitops/emdash` and
`@getvitops/create` version independently (they have no `@getvitops/*` dependencies); the root and
`apps/*` stay private/ignored.

The lockstep is **load-bearing, not cosmetic**: `packages/generator/scripts/prepare.mjs` snapshots
core's CSS + built JS bundles into `packages/generator/assets/`, so generator@X ships a frozen copy
of core@X — while `@getvitops/astro` resolves `@getvitops/core/package.json` at _runtime_ and copies
the _installed_ core's bundles into the consumer's `public/`. A consumer's page thus gets its CSS
from generator@X and its web components from core@Y; `fixed` is what guarantees X == Y. Don't split
the group without solving that skew.

**Release runbook:**

1. `npx changeset` — describe the change in consumer-facing terms (this text becomes the published
   changelog; name breaking changes and their migration explicitly).
2. `npx vp run release:version` — `changeset version`: bumps every package and writes the
   per-package `CHANGELOG.md` files.
3. **Write the matching entry in the root `CHANGELOG.md`** — the curated, toolchain-level notes
   (Breaking / Added / Fixed + migrations). Summarise what step 2 generated; don't transcribe
   dependency bumps. Every package ships its own `CHANGELOG.md` in its tarball via `files`, so both
   layers reach consumers.
4. `npx vp run release` — `build:packages && changeset publish`.

## Development

The build system uses `vite-plus` (`vp`), which is a wrapper for common tools for SDLC tasks:

- `vite-task` (`npx vp run ...`) - task orchestration with caching, even across monorepo packages
- `oxfmt` (`npx vp fmt`) - formatting md/css/js/ts/html
- `oxlint` (`npx vp lint`) - linting js/ts
- `vitest` (`npx vp test`) - unit/integration testing
- `vite` (`npx vp build`) - libraries/application build meta-tool for web runtimes
- `tsdown` (`npx vp pack`) - libraries/applications build meta-tool for server runtimes

It also supports:

- running pre-commit hooks on staged files using the `staged` key in `vite.config.ts`

They are all configured with their respective keys in `vite.config.ts`

Other tools used:

- `lightningcss` - css minification/bundling
- `playwright` - e2e testing

### Task Notes

- do not run format or lint as verifications, these are done automatically on save and PostToolUse hooks.
- `index.html` is the evergreen docsite that should dogfood the output of the build. Make sure it's kept up to date

## Output

- Bricks Builder supports some design system features out of the box (e.g. Font, Spacing, Typography, and Color Managers), so when targeting it some parts that would be in the CSS output are instead output as JSON so they can be imported into Bricks for use in the UI and which outputs the CSS itself.

## Design Guidelines

- Set of CSS properties for colors, spacing, typography (fonts, scale, roles: display|title|heading|body|quote|caption|eyebrow|code|lead|footnote|tag (each with font, size, decoration, transform, tracking, etc.)), animations (kinds, curves, durations), pattern primitives (border, drop-shadow, padding)
- General layout utilities (.centered, .flex*, .split*, .rhythm)
- Color utilities (.bg*, .text*)
- Spacing utilties (.space\*)
- Typographic utilities (.font-display, .font-title, ...)
- Animation utilities (see @src/css/animations.css)
- Patterns (link, cta, btn, card, badge, etc.)

## Codegen flow

`src/design-system.json` is this repo's dev/example config (each consumer brings their own). The generator (`packages/generator/src/generate.ts`) reads it and emits these output layers — assembled **in memory** and bundled by the css/bricks formats (no longer written as standalone `src/css/generated/**` files); the labels below name the layers:

- **colour** (`color.css`) — Each `colors.palette` hue is an **11-step numeric OKLCH scale** (`--color-<hue>-50…950`, tinted near-white → tinted near-black) generated from a `seed` (+ optional `anchors`) or a fixed `tones` brand kit. `colors.roles` maps each semantic role (neutral, surface, ui-primary/secondary/accent, brand-primary/secondary, info/success/warning/danger) to a hue; the generator derives **functional tokens** — `--<role>-{bg,bg-muted,border,border-bold,solid,solid-bold,on-solid,text,text-muted,text-x-muted}` plus appearance-relative emphasis stops `--color-<role>-{x-muted,muted,bold,x-bold}` and `--surface-glass`/`--overlay` — with matching utility classes (`bg-<role>`, `text-<role>-muted`, `text-on-<role>`, `.glass`, …). Dark mode is the **automatic functional flip** under `DARK_SEL` (`shared.ts`) — `:root[data-brx-theme="dark"], :root[data-theme="dark"]`, Bricks' attribute plus the one `<color-scheme-toggle>` writes (bg/text ends swap; `solid` stays mode-stable with a computed `on-solid`). Contrast targets (text ≥ APCA Lc 75, muted ≥ 60, both appearances) are enforced by unit tests. There is no per-appearance scheme grammar and no named steps.
- **shadows** (`shadows.css`) — `--shadow-<name>` tokens and `.drop-shadow-<name>` utilities. Always emitted for the `css`/`bricks` formats.
- **patterns** (`patterns.css`) — component CSS for entries under `patterns` in the JSON (cta, btn, link, badge, card). Each pattern has `base` declarations, `states` (hover/active/focus-visible) with shortcuts (`step`, `scale`, `lift`, `shadow`, `ring`, `css`), and `roles` (semantic colour variants). Always emitted.

  **Geometry must resolve through the group alias layer — never hard-code the group token.** For
  every grouped pattern the generator emits `--<prop>-<name>-group` aliases (`--br-btn-group:
var(--br-control)`), and `overrides` replace an alias with a literal. So a pattern's `base` writes
  `"border-radius": "var(--br-btn-group)"`, **not** `"var(--br-control, 0.25rem)"`. Both render the
  same, but only the first keeps the pattern → group mapping in CSS, where it is inspectable and
  editable in devtools; a hard-coded fallback bakes it into the rule and is unreachable. The full
  chain is `--p-btn` (consumer hook, from `BASE_HOOK`) → `--p-btn-group` (pattern/`overrides`) →
  `--p-control` (group) → `--p-default`. State the tier's _deviations_ in `overrides` and let
  everything else inherit. (Watch for a hard-coded fallback that is also dead: `--br-control` is
  always defined, so the `0.25rem` in `var(--br-control, 0.25rem)` never applied.)

  **Small-label patterns split by behaviour:** `badge` is a **static** label (status, count,
  category); `tag` is an **editable and/or dismissable** one (`.tag__remove`, `.tag__icon`, and the
  `.tag-list` field). "chip" is retired as vocabulary. Their shared group is named **`label`** —
  deliberately _not_ `tag`, because a pattern whose key equals its group name collides in the token
  namespace (`--br-tag` would be both the group token and the `tag` pattern's override hook, making
  the pattern's `-group` alias unreachable). Keep group names distinct from pattern names.

  **Two button tiers, by intent.** `.cta` is _persuasion_ — filled, bolder, larger padding, lift on hover; it's a class, so it works on any element (`<a class="cta">` is the common case, since CTAs usually navigate). `btn` is _affordance_ — it only signals "this is interactive", and pairs `element: "button"` with `class: "btn"` so it emits one `:where(button, .btn)` rule: a bare `<button>` gets it with no class, `.btn` carries it to other tags, and because the rule sits at zero specificity **any** explicit class overrides it (`.cta`, or a component's own `.dialog__close`). A pattern that sets both `element` and `class` is the general mechanism here; `link` does the same to emit `:where(a, .link)`. Use `fill: true|false` to state whether states/roles drive `background-color` (+ `on-solid` text) or `color` — `btn` must set `fill: false` because its `background: transparent` would otherwise be inferred as a fill.

- **animation-effects** (`animation-effects.css`) — the effect + journey classes from `animations` in the JSON (`.fade-in`, `.reveal-left`, `.<parts>-journey`, …), each a pure value layer (`--_anim` + `--<prop>-from/-to`). Journeys are composed from `animations.journeys.base` + `compose`. Always emitted. The animation **engine** (keyframes, drivers, floats, utilities) stays hand-written in `@getvitops/core`'s `css/animation.css`.
- `dist/bricks-colors-{named,semantic}.json` — palettes for Bricks Builder's Color Manager. Each semantic entry carries `darkEnabled` + a `dark` ref so Bricks generates the dark-mode overrides on import.

The framework CSS lives in **`@getvitops/core`**: `packages/core/css/index.css` is the bundle entry; core primitives (`global.css`, `animation.css`, `layout.css`, `utilities.css`) at `packages/core/css/` root; each UI pattern its own partial under `packages/core/css/patterns/` (one file per pattern — `dialog.css`, `table.css`, `cluster.css`, `overlay.css`, …). The generator produces the token layers above and bundles them with these partials (via lightningcss, in memory). Keep that split when adding files, and wire any new partial into `index.css`.

**The bundle is layered.** `bundleCss()` wraps every chunk via the `CHUNK_LAYER` map and emits
`@layer vitops.base, vitops.components, vitops.utilities;`. That is what lets a utility override
a pattern (`class="card bg-danger-muted"`) — it previously depended on source order and so
silently did nothing here while working in tailwind. **A new partial defaults to
`vitops.components`**; add it to `CHUNK_LAYER` only if it emits single-purpose utilities. Order
within a layer still matters, layer membership matters more.

Three consequences worth holding:

- **Unlayered CSS beats every layer**, so a consumer's stylesheet, an Astro scoped `<style>` or
  a Bricks-authored class wins over the framework with no `!important`. Deliberate. But a
  _reset_ must be layered and ordered first, and the order statement must be declared **before**
  the stylesheet loads — otherwise the new layer name sorts last and the reset wins. `index.html`
  demonstrates the migration.
- **lightningcss drops the standalone `@layer a, b, c;` statement** after physically reordering
  the blocks to match it. Verified: given a statement that contradicts first-appearance order, it
  reorders rather than mis-cascades. So the declaration is honoured, just normalised away — don't
  assert on its presence, assert on block order (`bundle-layers.test.ts`).
- **The tailwind format is deliberately NOT layered by us.** Its utilities are `@utility`
  definitions, which Tailwind places in its own `utilities` layer _and_ which are what make
  variants (`hover:`, `@md:`) work. Moving them into a post-`utilities` layer would win the
  cascade and lose variant support — measured against tailwindcss@4.3.3.

Known gap: `layout.css` mixes structural rules with utilities in one partial, so it sits in
`vitops.components` whole and its utility half can't override a pattern. Splitting it is a
separate change.

### `--format` mode

The generator takes `--format <css|bricks|tailwind>` (default `bricks`; `--bricks` is a back-compat alias for `--format=bricks`).

- **`bricks`** — `color.css` and `type-tokens.css` are one-line stubs; Bricks provides the colour `:root` tokens, dark overrides, utility classes, fonts, and type/space scales live from the imported palette + Variables JSONs. `patterns.css`, `shadows.css`, `tokens.css`, `typography.css`, `animation-effects.css`, and the Bricks JSONs emit. Pattern `states` reference shadows via `"shadow": "<name>"`, compiled to `filter: drop-shadow(var(--shadow-<name>))`.
- **`css`** — same set, but `color.css`/`type-tokens.css` emit the full standalone colour + font/scale layer (self-contained; used by the docs build and non-Bricks consumers).
- **`tailwind`** — bypasses all the per-file outputs and emits **one** self-contained `dist/tailwind.css` for Tailwind v4 (Astro): `@import "tailwindcss"` + `@theme` tokens (colours, `--font-*`, `--text-*`, `--spacing-*`, `--shadow-*`, `--container-{sm,md,lg,xl}`), a dark block, `@custom-variant is-active`, and `@utility` for the bespoke families (type roles, animation effects + `flip-<fx>`, split ratios, track placement) with the animation engine + structural CSS + patterns inlined. Tailwind's own engine expands `@md:`/`hover:`/… on demand, so no pre-expanded per-breakpoint/pseudo classes are emitted; native families (`flex`/`items`/`justify`/`text`/`bg`/`p`/`gap`) come from Tailwind + `@theme`. Run via `npx vp run build:tailwind` (standalone; not in the default `build` chain, not piped through lightningcss).

### Utility variant naming (Tailwind-aligned)

Responsive/state utilities follow Tailwind's left-to-right order in every format; CSS/Bricks swap `:` for `-`, Tailwind keeps `:` (and `@` for container queries):

| Intent           | CSS / Bricks               | Tailwind                                |
| ---------------- | -------------------------- | --------------------------------------- |
| responsive split | `md-split-1-2`             | `@md:split-1-2`                         |
| responsive align | `md-items-center`          | `@md:items-center`                      |
| hover effect     | `transition hover-fade-in` | `transition fade-in hover:flip-fade-in` |

Container breakpoints are bare prefixes (`sm-`/`md-`/`lg-`/`xl-` = 30/48/64/80rem). Base utility names mirror Tailwind (`items-*` not `align-*`), so one vocabulary spans all three formats.

## Build system

All tasks go through `npx vp run <name>` (see [vite.config.ts](vite.config.ts)). `build` delegates to `build:bricks` (the default target); format-specific full builds are separate `build:<type>` tasks rather than a `--format` flag on `build` (vp appends forwarded args to the command tail, which would corrupt the last sub-task, and it only resolves `vp run <task>` in-process when that appears literally in the command).

**The root build dogfoods `@getvitops/generator`.** `build:bricks` runs `build:theme`, which invokes `lib/build-theme.ts` → `generate({ format: 'bricks', outDir: 'dist' })` (from `@getvitops/generator`). The generator owns the lightningcss _library_ and does the CSS bundling in-process, so the root no longer shells out to the lightningcss CLI (removed from deps). `build:theme` `dependsOn build:generator` (which `dependsOn build:core`), so the framework JS bundles are built in `@getvitops/core` and snapshotted into the generator's package assets before `generate` copies them (plus the Bricks PHP + `docs/`) into `dist/`. `build:docs` and `build:tailwind` likewise call `lib/build-theme.ts --format css|tailwind`. The single-file emit contract per format is unchanged.

`build:theme` emits the deployable Bricks payload into `dist/`: `styles.min.css`, the Bricks import JSON, `tokens.json`, the JS bundles, the repo-owned Bricks sources (`bricks/elements/*.php`, `bricks/load.php`) under `dist/bricks/`, and the generated `docs/` tree under `dist/docs/` — an LLM-oriented context bundle in **Open Knowledge Format** (OKF; served at `<theme>/dist/docs/`) so an AI has documentation matching what deploys. (Generated by the generator's `docs.ts`; the legacy `lib/generate-design-system.ts` / `lib/generate-docs.ts` have been removed.) OKF rules the generator follows: reserved `index.md` files carry **no frontmatter** and are directory listings (`* [Title](path) - desc`); every other `.md` is a "concept" doc that **must** begin with a YAML frontmatter block with a non-empty `type` (plus `title`/`description`/`resource`/`tags`/`generator`). The tree:

- `docs/index.md` — bundle index → `authoring.md`, `formats.md`, `concepts/`, `css/`, `bricks/`.
- `docs/authoring.md` — concept: every `design-system.json` field, **rendered by walking the published JSON Schema's `description` metadata** (authored once in `packages/generator/src/schema.ts` via the `desc()` helper — the same descriptions editors show as hovers), so it cannot drift from validation.
- `docs/formats.md` — concept: tailwind vs css vs bricks output differences, including the interpolated `TW_CLASH` list (from `packages/generator/src/shared.ts`) of framework utilities the tailwind format strips in favour of Tailwind's own.
- `docs/concepts/{index.md,color.md,scales.md,patterns.md}` — concept docs for the colour system (seeded OKLCH scales, functional tokens, automatic dark flip), the fluid modular scales, and the pattern CSS chain (token cascade, `BASE_HOOK` override vars, state shortcuts, role variants).
- `docs/css/index.md` — listing → `classes.md`.
- `docs/css/classes.md` — concept: the CSS framework class vocabulary **summarized by naming rule** (not enumerated), pulled live from `src/design-system.json` (colours, type roles, space/type scales, shadows, animation effects, component patterns) plus static structural utilities and the responsive/state variant grammar.
- `docs/bricks/index.md` — listing + the "prefer framework CSS classes over hand-tuning Bricks UI properties" guidance; links `elements.md` + `../css/classes.md`.
- `docs/bricks/elements.md` — concept: per-element control reference, parsed from each element's docblock, class metadata, `get_label`/`get_keywords`/`get_nestable_children`, and a small PHP-array-literal parse of `set_controls()`.

The agent-facing skill is **not** generated: it's the static `packages/cli/skill/SKILL.md` shipped inside `@getvitops/cli`, which teaches agents to fetch these docs live via `vitops docs <topic>` (topic → bundle-path map in `packages/cli/src/agents.ts`, drift-guarded by `agents.test.ts`). Drift-prone data (`TW_CLASH`, `BASE_HOOK`, `DARK_SEL`, `REQUIRED_ROLES`, `ROLE_TOKEN_SUFFIXES`) lives in `packages/generator/src/shared.ts` — shared by `generate.ts` and `docs.ts` (a direct import between them would be a cycle) and re-exported from the package index.

**One emitter for the role colour vocabulary.** `roleColorUtilities()` (`generate.ts`) returns
every role utility as data — `{ cls, prop, value, axis: 'plane' | 'stop' }` — and both the
css/bricks and tailwind paths render from it. Two axes share the
`<family>-<role>-<modifier>` namespace (functional **planes** like `--<role>-bg-muted`, and
appearance-relative emphasis **stops** like `--color-<role>-muted`); where they collide the
plane wins, decided in that function so every class is emitted exactly once. This used to be
implicit — the css path emitted stops then planes and relied on the minifier dropping the
shadowed rule, while the tailwind path ran only the plane half, so **87 role classes existed in
css/bricks and not in tailwind**. `format-parity.test.ts` now holds the three formats to the
same vocabulary, allowing exactly four documented differences (Bricks' own palette-import
utilities, `TW_CLASH` drops, variant spelling, and `@theme` auto-generation).

**Role tokens must stay out of Tailwind's `@theme`.** Measured against tailwindcss@4.3.3: when a
token is in `@theme` _and_ an `@utility` of the derived name exists, Tailwind merges both into
one rule with the `@theme` declaration **last**, regardless of source order. Promoting
`--color-<role>-<stop>` would silently swap the plane for the stop on `bg-<role>-muted`,
`text-<role>-muted`, `text-<role>-x-muted`, `border-<role>-bold` and `bg-surface-bold` — two of
which are the contrast-guaranteed text tokens. Raw hue scales are safe there (nothing competes).

`docs/**` are generated artifacts — don't hand-edit them (they're in `fmt.ignorePatterns` to avoid churn); change the PHP / `design-system.json` / the generator's static strings and regenerate. Frontmatter deliberately omits `timestamp` (an OKF-recommended field) to keep output deterministic and diffs clean. If the generator gains a new source, extend the relevant `build:*` task's `input` list (e.g. `build:generator`). `index.html` stays a human/local-dev docsite (dogfoods the build); it is **not** the AI context vehicle — the `docs/` bundle is.

**Three docs surfaces, don't confuse them:**

| Surface                             | Audience                                | Authored how           |
| ----------------------------------- | --------------------------------------- | ---------------------- |
| `docs/` + `dist/docs/` (OKF bundle) | agents, via `vitops docs <topic>`       | generated by `docs.ts` |
| `index.html`                        | human/local dev, dogfoods the built CSS | hand-written           |
| `apps/docs` (plain Astro)           | public docs site                        | hybrid — see below     |

`apps/docs` is private and **isolated from the release DAG** like `apps/portal` (not in `build`, `build:packages` or `deploy`).

**It is deliberately a plain Astro site, not a docs framework.** Starlight was tried and removed: a themed docs framework ships its own CSS layer and component library, which hides the very thing under test. The whole site — layout, nav, type, colour, controls — is built from the framework's own vocabulary (`.rhythm`, `.centered`, `.split-*`, `.font-<role>`, `.link`, `.card`, `.details`, `.btn`) via the `getvitops()` integration at `css.format: 'css'`, plus the `color-scheme-toggle` web component. **If you find yourself adding hand-written CSS to `src/layouts/Docs.astro`, that's a signal the framework is missing a pattern — add it to `@getvitops/core` instead.** The `<style>` block there is meant to stay short; it's the site's honest scorecard. (Root `index.html` also exercises the css format, but as a static page — `apps/docs` is the only thing covering that format _through the Astro integration_.)

Its _Reference_ section is not written by hand: `apps/docs/scripts/sync-reference.mjs` calls the generator's `generateDocs()` and emits pages into `src/content/docs/reference/` (gitignored), so the site can't describe output the toolchain doesn't produce. The script flattens the OKF tree (`concepts/patterns.md` → `concepts-patterns`), drops the frontmatter-less `index.md` listings (the site builds nav from the collection), rewrites the bundle's relative `.md` cross-links to site slugs, and sets `generated: true` so the layout renders a "don't edit this" banner. Guides, package pages and the landing page **are** hand-written. Tasks: `docs:sync` (dependsOn `build:generator`), `docs:dev`, `docs:build`, `docs:preview`.

Note the app tasks shell out via `pnpm --filter <app> exec …`: vp resolves binaries itself and doesn't put `apps/*/node_modules/.bin` on `PATH`, so a bare `cd apps/docs && astro build` fails with "cannot find binary path".

One non-obvious caching/ordering gotcha:

- **`build:theme`'s `input` is declared explicitly.** vp's auto file-tracker only sees files the task itself reads. `node lib/build-theme.ts` reads its script + `design-system.json` and imports the built generator _inside_ the spawned Node process, so without an explicit `input` list (covering `packages/generator/dist/**` + `packages/generator/assets/**` + the config), source edits hit the cache and the dist files appear "stuck" on stale content.

Lint, format and typecheck run automatically on save and via a `PostToolUse` hook on `Edit|Write` (`.claude/settings.json`) — don't invoke `vp check` / `vp fmt` / `vp lint` manually as a verification step. The `staged` key wires `vp check --fix` into the pre-commit hook.

## Deploy

`lib/deploy.ts` has two modes, switched on env vars:

- **Remote (default):** rsync over SSH using `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_PATH` (+ optional `DEPLOY_PORT`, `DEPLOY_KEY`). `--dry` previews via `rsync -n`.
- **Local symlink:** set `DEPLOY_LOCAL_PATH` to a theme `dist/` directory (e.g. a WPLocal site) and the script idempotently symlinks it to this repo's `dist/`. One-time setup; subsequent builds are "auto-deployed" because the symlink follows them. The script refuses to clobber a non-symlink, so it's safe to point at an existing path.

`npx vp run deploy` chains `build` first, so it always ships a fresh `dist/`.

## Note on README.md

The `README.md` predates the current layout — it refers to `colors.json`, `src/color.css`, and `build.mjs`. Use this file and `AGENTS.md` as the authoritative description; update README if you touch user-facing docs.
