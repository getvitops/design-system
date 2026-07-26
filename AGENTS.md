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

## Published toolchain: `@getvitops/*`

Published as a **reusable toolchain** (like Tailwind/shadcn): every client runs it against their own
consumer-editable `design-system.json` — there is no shared/canonical token set to ship. Workspace
packages under `packages/` (a pnpm workspace), by layer:

- **`@getvitops/core`** — the design-system **framework** (the runtime everything builds on): the
  variable-driven **CSS partials** (`css/`), the Lit **web components**, and the feature-detected
  browser **polyfills**. Subpath exports: `./css/*`, `./elements`, `./polyfills`, `./deferred`. Inert
  on its own — the CSS resolves against the token layer the generator emits.
- **`@getvitops/generator`** — the **generator** as a library + the JSON Schema. Public API:
  `generate({ input, format, outDir })`, `generateDocs()`, `validate()`, `defaultConfig()`,
  `DesignSystemSchema`, `jsonSchema`. The `zod/mini` schema in `packages/generator/src/schema.ts` is
  the **single source of truth** (the `DesignSystem` type via `z.infer`, the published JSON Schema via
  `toJSONSchema` → `schema.json`, and runtime validation all derive from it). It sources the framework
  CSS partials + prebuilt JS bundles from `@getvitops/core` and ships the Bricks PHP + `load.php`; it
  also carries the site-config schema (`site.ts` → `site.schema.json`).
- **`@getvitops/utils`** — shared build-time utilities (favicon generation via `sharp` +
  `png-to-ico`, loaded lazily; `oxipng` crush optional). Consumed by cli/vite/astro.
- **`@getvitops/cli`** — `vitops generate|init|validate|favicon|agents` (bin `vitops`), a thin
  wrapper over the generator + utils. `agents` emits a generated **`vitops-design-system` agent
  skill** into a consumer's `.agents/skills/vitops-design-system/` (SKILL.md + the docs bundle as
  `references/`, with an idempotent `.claude/skills/` symlink) and writes a managed pointer block
  into their `AGENTS.md`; `--docs-dir` keeps the legacy docs-only layout.
- **`@getvitops/vite`** — a Vite plugin (Astro/EmDash) that runs the generator on build/dev (+
  optional favicon generation) and hot-regenerates when the config changes.
- **`@getvitops/astro`** — the **Astro integration**: a default `getvitops()` integration
  (favicons/PWA + web-component bundles copied to `public/` + the design-system CSS generated and
  auto-injected) plus a `<Head />` component and HTML/type authoring helpers. Wraps generator + utils
  - vite + core.
    Dependency versions are centralized in `pnpm-workspace.yaml`'s `catalog:` (referenced via the
    `catalog:` protocol); internal deps use `workspace:*`. Both are rewritten to concrete versions on
    publish.

Per-format output (into `outDir`): `tailwind` → self-contained `tailwind.css` + `tokens.json`;
`css` → bundled standalone `styles.css` + `tokens.json` + `design-manifest.json`; `bricks` → the
full deployable payload (`styles.min.css`, `bricks-colors-*.json`, `bricks-variables.json`,
`tokens.json`, JS bundles, `bricks/` PHP, `docs/`). The generator is **pure** — it mutates no shared
state; the css/bricks bundle is assembled in memory and minified with lightningcss.

**This repo dogfoods the tool:** the framework source lives in `@getvitops/core`
(`packages/core/{css,src}`); root `src/` holds only the example `design-system.json` (+ the docs-only
`editor.ts`). `packages/generator/scripts/prepare.mjs` snapshots core's CSS + built JS bundles (and
the repo's `bricks/` PHP) into `packages/generator/assets/` and emits `schema.json` /
`site.schema.json` — all gitignored build inputs, like `dist/`. The root `build` runs the toolchain
(`build:bricks` → `build:theme` → `lib/build-theme.ts` → the generator; no lightningcss CLI) — see
the Build system section.

Build/publish: `npx vp run build:packages` (core → generator → utils → cli → vite → astro; each task
`dependsOn` the packages it imports) and `npx vp run release` (`build:packages && changeset publish`).
Versioning is via Changesets (`.changeset/config.json`): `core`/`generator`/`utils`/`cli`/`vite` are
**fixed** together; `@getvitops/astro` versions independently; the root and `apps/*` stay
private/ignored.

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
- Patterns (link, button, card, badge, etc.)

## Codegen flow

`src/design-system.json` is this repo's dev/example config (each consumer brings their own). The generator (`packages/generator/src/generate.ts`) reads it and emits these output layers — assembled **in memory** and bundled by the css/bricks formats (no longer written as standalone `src/css/generated/**` files); the labels below name the layers:

- **colour** (`color.css`) — Each `colors.palette` hue is an **11-step numeric OKLCH scale** (`--color-<hue>-50…950`, tinted near-white → tinted near-black) generated from a `seed` (+ optional `anchors`) or a fixed `tones` brand kit. `colors.roles` maps each semantic role (neutral, surface, ui-primary/secondary/accent, brand-primary/secondary, info/success/warning/danger) to a hue; the generator derives **functional tokens** — `--<role>-{bg,bg-muted,border,border-bold,solid,solid-bold,on-solid,text,text-muted,text-x-muted}` plus appearance-relative emphasis stops `--color-<role>-{x-muted,muted,bold,x-bold}` and `--surface-glass`/`--overlay` — with matching utility classes (`bg-<role>`, `text-<role>-muted`, `text-on-<role>`, `.glass`, …). Dark mode is the **automatic functional flip** under `:root[data-brx-theme="dark"]` (bg/text ends swap; `solid` stays mode-stable with a computed `on-solid`). Contrast targets (text ≥ APCA Lc 75, muted ≥ 60, both appearances) are enforced by unit tests. There is no per-appearance scheme grammar and no named steps.
- **shadows** (`shadows.css`) — `--shadow-<name>` tokens and `.drop-shadow-<name>` utilities. Always emitted for the `css`/`bricks` formats.
- **patterns** (`patterns.css`) — component CSS for entries under `patterns` in the JSON (button, link, badge, card). Each pattern has `base` declarations, `states` (hover/active/focus-visible) with shortcuts (`step`, `scale`, `lift`, `shadow`, `ring`, `css`), and `roles` (semantic colour variants). Always emitted.
- **animation-effects** (`animation-effects.css`) — the effect + journey classes from `animations` in the JSON (`.fade-in`, `.reveal-left`, `.<parts>-journey`, …), each a pure value layer (`--_anim` + `--<prop>-from/-to`). Journeys are composed from `animations.journeys.base` + `compose`. Always emitted. The animation **engine** (keyframes, drivers, floats, utilities) stays hand-written in `@getvitops/core`'s `css/animation.css`.
- `dist/bricks-colors-{named,semantic}.json` — palettes for Bricks Builder's Color Manager. Each semantic entry carries `darkEnabled` + a `dark` ref so Bricks generates the dark-mode overrides on import.

The framework CSS lives in **`@getvitops/core`**: `packages/core/css/index.css` is the bundle entry; core primitives (`global.css`, `animation.css`, `layout.css`, `utilities.css`) at `packages/core/css/` root; each UI pattern its own partial under `packages/core/css/patterns/` (one file per pattern — `dialog.css`, `table.css`, `cluster.css`, `overlay.css`, …). The generator produces the token layers above and bundles them with these partials (via lightningcss, in memory). Keep that split when adding files, and wire any new partial into `index.css` (order matters for the cascade).

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

`generateDocs()` also has a sibling `renderSkill()` (exported from the generator): the generated `SKILL.md` that `vitops agents` writes in front of the bundle (bundle as `references/`). Drift-prone data (`TW_CLASH`, `BASE_HOOK`) lives in `packages/generator/src/shared.ts` — shared by `generate.ts` and `docs.ts` (a direct import between them would be a cycle) and re-exported from the package index.

`docs/**` are generated artifacts — don't hand-edit them (they're in `fmt.ignorePatterns` to avoid churn); change the PHP / `design-system.json` / the generator's static strings and regenerate. Frontmatter deliberately omits `timestamp` (an OKF-recommended field) to keep output deterministic and diffs clean. If the generator gains a new source, extend the relevant `build:*` task's `input` list (e.g. `build:generator`). `index.html` stays a human/local-dev docsite (dogfoods the build); it is **not** the AI context vehicle — the `docs/` bundle is.

Two non-obvious caching/ordering gotchas:

- **`pack.clean: false` is required.** tsdown clears its `outDir` by default; the root `pack` (which now builds only the docs `editor.js`) shares `dist/` with `build:theme`'s codegen output, so leaving clean on would wipe `styles.min.css` and `bricks-colors-*.json` whenever `build:editor` runs.
- **`build:theme`'s `input` is declared explicitly.** vp's auto file-tracker only sees files the task itself reads. `node lib/build-theme.ts` reads its script + `design-system.json` and imports the built generator _inside_ the spawned Node process, so without an explicit `input` list (covering `packages/generator/dist/**` + `packages/generator/assets/**` + the config), source edits hit the cache and the dist files appear "stuck" on stale content.

Lint, format and typecheck run automatically on save and via a `PostToolUse` hook on `Edit|Write` (`.claude/settings.json`) — don't invoke `vp check` / `vp fmt` / `vp lint` manually as a verification step. The `staged` key wires `vp check --fix` into the pre-commit hook.

## Deploy

`lib/deploy.ts` has two modes, switched on env vars:

- **Remote (default):** rsync over SSH using `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_PATH` (+ optional `DEPLOY_PORT`, `DEPLOY_KEY`). `--dry` previews via `rsync -n`.
- **Local symlink:** set `DEPLOY_LOCAL_PATH` to a theme `dist/` directory (e.g. a WPLocal site) and the script idempotently symlinks it to this repo's `dist/`. One-time setup; subsequent builds are "auto-deployed" because the symlink follows them. The script refuses to clobber a non-symlink, so it's safe to point at an existing path.

`npx vp run deploy` chains `build` first, so it always ships a fresh `dist/`.

## Note on README.md

The `README.md` predates the current layout — it refers to `colors.json`, `src/color.css`, and `build.mjs`. Use this file and `AGENTS.md` as the authoritative description; update README if you touch user-facing docs.
