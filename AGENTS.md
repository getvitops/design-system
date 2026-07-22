This repo is responsible for generating design systems for use in websites (primarily Astro and WordPress with Bricks Builder).

It is composed of:

- TS-based utilities
- Variable-based lightweight CSS Framework for high level design patterns and common utilities (e.g. track-based centering of content, vertical rhythm, UI patterns)
- Lit-based Web Components for patterns that benefit from progressive enhancement (they are styled via the CSS Framework, and are fully operable, although degraded, in non-JS environments)

Prefer using modern CSS/HTML features (e.g. CSS Anchor Positioning API, Dialog, Invoker Commands API, Scroll Timelines, etc.) over JavaScript.

## Published toolchain: `@getvitops/*`

The generator is published as a **reusable tool** (like Tailwind/shadcn) that any client runs
against their own consumer-editable `design-system.json` — there is no shared/canonical token
set to ship. Workspace packages under `packages/` (a pnpm workspace):

- **`@getvitops/generator`** — the generator as a library plus the framework-static assets (CSS
  partials, Bricks PHP + `load.php`, pre-built JS bundles) and the JSON Schema. Public API:
  `generate({ input, format, outDir })`, `validate()`, `defaultConfig()`, `DesignSystemSchema`,
  `jsonSchema`. The `zod/mini` schema in `packages/generator/src/schema.ts` is the **single source of
  truth**: the `DesignSystem` type (`z.infer`), the published JSON Schema (`toJSONSchema` →
  `schema.json`), and runtime validation all derive from it.
- **`@getvitops/utils`** — shared build-time utilities (favicon generation via `sharp` +
  `png-to-ico`, loaded lazily; `oxipng` crush is optional). Consumed by the CLI and Vite plugin.
- **`@getvitops/cli`** — `vitops generate|init|validate|favicon|agents` (bin `vitops`; `agents`
  writes a managed design-system block into a consumer's `AGENTS.md`), a thin wrapper
  over core + utils.
- **`@getvitops/vite`** — a Vite plugin (Astro/EmDash) that runs core on build/dev (and optional
  favicon generation) and hot-regenerates when the config changes.

Dependency versions are centralized in `pnpm-workspace.yaml`'s `catalog:` (referenced via the
`catalog:` protocol); internal deps use `workspace:*`. Both are rewritten to concrete versions on
publish.

Per-format output (into `outDir`): `tailwind` → self-contained `tailwind.css` + `tokens.json`;
`css` → bundled standalone `styles.css` + `tokens.json` + `design-manifest.json`; `bricks` → the
full deployable payload (`styles.min.css`, `bricks-colors-*.json`, `bricks-variables.json`,
`tokens.json`, JS bundles, `bricks/` PHP, `docs/`). The library is **pure** — it mutates no shared
state (no `src/css/generated/**` writes); the css/bricks bundle is assembled in memory and minified
with lightningcss.

**This repo dogfoods the tool:** `src/design-system.json` is the example/dev config, and the
framework sources (`src/css`, `src/js`, `src/web-components`, `bricks/`) are the product core
ships. `packages/generator/scripts/prepare.mjs` snapshots those (+ the built JS bundles) into
`packages/generator/assets/` and emits `schema.json` — both are gitignored build inputs, like `dist/`.

Build/publish tasks: `npx vp run build:packages` (builds core → cli → vite; `build:generator`
`dependsOn build:js` because it copies the JS bundles) and `npx vp run release`
(`build:packages && changeset publish`). Versioning is via Changesets (`.changeset/config.json`,
the three packages `fixed` together); the root package stays `private`. The legacy root
`build`/`deploy` (Bricks theme) pipeline is unchanged and produces byte-equivalent output to
`vitops generate --format bricks`.

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

`src/design-system.json` is the source of truth. `lib/generate-design-system.ts` reads it and emits four kinds of output:

- `src/css/generated/color.css` — the colour layer. Each `colors.palette` hue is an **11-step numeric OKLCH scale** (`--color-<hue>-50…950`, tinted near-white → tinted near-black) generated from a `seed` (+ optional `anchors`) or a fixed `tones` brand kit. `colors.roles` maps each semantic role (neutral, surface, ui-primary/secondary/accent, brand-primary/secondary, info/success/warning/danger) to a hue; the generator derives **functional tokens** — `--<role>-{bg,bg-muted,border,border-bold,solid,solid-bold,on-solid,text,text-muted,text-x-muted}` plus appearance-relative emphasis stops `--color-<role>-{x-muted,muted,bold,x-bold}` and `--surface-glass`/`--overlay` — with matching utility classes (`bg-<role>`, `text-<role>-muted`, `text-on-<role>`, `.glass`, …). Dark mode is the **automatic functional flip** under `:root[data-brx-theme="dark"]` (bg/text ends swap; `solid` stays mode-stable with a computed `on-solid`). Contrast targets (text ≥ APCA Lc 75, muted ≥ 60, both appearances) are enforced by unit tests. There is no per-appearance scheme grammar and no named steps.
- `src/css/generated/shadows.css` — `--shadow-<name>` tokens and `.drop-shadow-<name>` utilities. Always emitted for the `css`/`bricks` formats.
- `src/css/generated/patterns.css` — component CSS for entries under `patterns` in the JSON (button, link, badge, card). Each pattern has `base` declarations, `states` (hover/active/focus-visible) with shortcuts (`step`, `scale`, `lift`, `shadow`, `ring`, `css`), and `roles` (semantic colour variants). Always emitted.
- `src/css/generated/animation-effects.css` — the effect + journey classes from `animations` in the JSON (`.fade-in`, `.reveal-left`, `.<parts>-journey`, …), each a pure value layer (`--_anim` + `--<prop>-from/-to`). Journeys are composed from `animations.journeys.base` + `compose`. Always emitted. The animation **engine** (keyframes, drivers, floats, utilities) stays hand-written in `src/css/animation.css`.
- `dist/bricks-colors-{named,semantic}.json` — palettes for Bricks Builder's Color Manager. Each semantic entry carries `darkEnabled` + a `dark` ref so Bricks generates the dark-mode overrides on import.

`src/css/index.css` is the lightningcss bundle entry. Core primitives (`global.css`, `animation.css`, `layout.css`, `utilities.css`) live at `src/css/` root; everything generated lives under `src/css/generated/`; and each UI pattern is its own partial under `src/css/patterns/` (one file per pattern — `dialog.css`, `table.css`, `cluster.css`, `overlay.css`, …), mirroring `old-css-lib/patterns/`. Keep that three-way split when adding files, and wire any new partial into `index.css` (order matters for the cascade).

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

**The root build dogfoods `@getvitops/generator`.** `build:bricks` runs `build:theme`, which invokes `lib/build-theme.ts` → `core.generate({ format: 'bricks', outDir: 'dist' })`. Core owns the lightningcss _library_ and does the CSS bundling in-process, so the root no longer shells out to the lightningcss CLI (removed from deps). `build:theme` `dependsOn build:generator` (which `dependsOn build:js`), so the framework JS bundles are built and snapshotted into the package assets before `generate` copies them (plus the Bricks PHP + `docs/`) into `dist/`. `build:docs` and `build:tailwind` likewise call `lib/build-theme.ts --format css|tailwind`. The single-file emit contract per format is unchanged.

`build:theme` emits the deployable Bricks payload into `dist/`: `styles.min.css`, the Bricks import JSON, `tokens.json`, the JS bundles, the repo-owned Bricks sources (`bricks/elements/*.php`, `bricks/load.php`) under `dist/bricks/`, and the generated `docs/` tree under `dist/docs/` — an LLM-oriented context bundle in **Open Knowledge Format** (OKF; served at `<theme>/dist/docs/`) so an AI has documentation matching what deploys. (Generated by core's `docs.ts`; the older `lib/generate-design-system.ts` / `lib/generate-docs.ts` remain in the tree but are no longer wired into the build.) OKF rules the generator follows: reserved `index.md` files carry **no frontmatter** and are directory listings (`* [Title](path) - desc`); every other `.md` is a "concept" doc that **must** begin with a YAML frontmatter block with a non-empty `type` (plus `title`/`description`/`resource`/`tags`/`generator`). The tree:

- `docs/index.md` — bundle index → `css/`, `bricks/`.
- `docs/css/index.md` — listing → `classes.md`.
- `docs/css/classes.md` — concept: the CSS framework class vocabulary **summarized by naming rule** (not enumerated), pulled live from `src/design-system.json` (colours, type roles, space/type scales, shadows, animation effects, component patterns) plus static structural utilities and the responsive/state variant grammar.
- `docs/bricks/index.md` — listing + the "prefer framework CSS classes over hand-tuning Bricks UI properties" guidance; links `elements.md` + `../css/classes.md`.
- `docs/bricks/elements.md` — concept: per-element control reference, parsed from each element's docblock, class metadata, `get_label`/`get_keywords`/`get_nestable_children`, and a small PHP-array-literal parse of `set_controls()`.

`docs/**` are generated artifacts — don't hand-edit them (they're in `fmt.ignorePatterns` to avoid churn); change the PHP / `design-system.json` / the generator's static strings and regenerate. Frontmatter deliberately omits `timestamp` (an OKF-recommended field) to keep output deterministic and diffs clean. If the generator gains a new input, extend `generate:docs`'s `input` list. `index.html` stays a human/local-dev docsite (dogfoods the build); it is **not** the AI context vehicle — the `docs/` bundle is.

Two non-obvious caching/ordering gotchas:

- **`pack.clean: false` is required.** tsdown clears its `outDir` by default; since both pack and the CSS/JSON codegen output into `dist/`, leaving clean on would wipe `styles.min.css` and `bricks-colors-*.json` whenever `build:js` runs.
- **The codegen task's `input` is declared explicitly.** vp's auto file-tracker only sees files the task itself reads. `node lib/generate-design-system.ts` reads its script and `design-system.json` _inside_ the spawned Node process, so without an explicit `input` list, source edits hit the cache and the dist files appear "stuck" on stale content. If you add new inputs to the script (new JSON files, etc.), extend that list.

Lint, format and typecheck run automatically on save and via a `PostToolUse` hook on `Edit|Write` (`.claude/settings.json`) — don't invoke `vp check` / `vp fmt` / `vp lint` manually as a verification step. The `staged` key wires `vp check --fix` into the pre-commit hook.

## Deploy

`lib/deploy.ts` has two modes, switched on env vars:

- **Remote (default):** rsync over SSH using `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_PATH` (+ optional `DEPLOY_PORT`, `DEPLOY_KEY`). `--dry` previews via `rsync -n`.
- **Local symlink:** set `DEPLOY_LOCAL_PATH` to a theme `dist/` directory (e.g. a WPLocal site) and the script idempotently symlinks it to this repo's `dist/`. One-time setup; subsequent builds are "auto-deployed" because the symlink follows them. The script refuses to clobber a non-symlink, so it's safe to point at an existing path.

`npx vp run deploy` chains `build` first, so it always ships a fresh `dist/`.

## Note on README.md

The `README.md` predates the current layout — it refers to `colors.json`, `src/color.css`, and `build.mjs`. Use this file and `AGENTS.md` as the authoritative description; update README if you touch user-facing docs.
