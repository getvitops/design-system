This repo is responsible for generating design systems for use in websites (primarily Astro and WordPress with Bricks Builder).

It is composed of:

- TS-based utilities
- Variable-based lightweight CSS Framework for high level design patterns and common utilities (e.g. track-based centering of content, vertical rhythm, UI patterns)
- Lit-based Web Components for patterns that benefit from progressive enhancement (they are styled via the CSS Framework, and are fully operable, although degraded, in non-JS environments)

Prefer using modern CSS/HTML features (e.g. CSS Anchor Positioning API, Dialog, Invoker Commands API, Scroll Timelines, etc.) over JavaScript.

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

- `src/css/generated/color.css` — `:root` tokens (named ramps + semantic roles), dark-mode overrides under `:root[data-brx-theme="dark"]`, and colour utility classes (`bg-`, `text-`, `border-`, …) for both named and semantic.
- `src/css/generated/shadows.css` — `--shadow-<name>` tokens and `.drop-shadow-<name>` utilities. Always emitted regardless of `--bricks`.
- `src/css/generated/patterns.css` — component CSS for entries under `patterns` in the JSON (button, link, badge, card). Each pattern has `base` declarations, `states` (hover/active/focus-visible) with shortcuts (`step`, `scale`, `lift`, `shadow`, `ring`, `css`), and `roles` (semantic colour variants). Always emitted.
- `src/css/generated/animation-effects.css` — the effect + journey classes from `animations` in the JSON (`.fade-in`, `.reveal-left`, `.<parts>-journey`, …), each a pure value layer (`--_anim` + `--<prop>-from/-to`). Journeys are composed from `animations.journeys.base` + `compose`. Always emitted. The animation **engine** (keyframes, drivers, floats, utilities) stays hand-written in `src/css/animation.css`.
- `dist/bricks-colors-{named,semantic}.json` — palettes for Bricks Builder's Color Manager. Each semantic entry carries `darkEnabled` + a `dark` ref so Bricks generates the dark-mode overrides on import.

`src/css/index.css` is the lightningcss bundle entry. Static partials (`animation.css`, `layout.css`) live at `src/css/` root; everything generated lives under `src/css/generated/`. Keep that split when adding files.

### `--bricks` mode

`generate:theme` runs `node lib/generate-design-system.ts --bricks` by default. When the flag is **set**, `color.css` is a one-line stub — Bricks is expected to provide the colour `:root` tokens, dark overrides, and utility classes live from the imported palette JSONs. When the flag is **unset**, the script emits the full standalone colour layer (useful for non-Bricks consumers / docs). `patterns.css`, `shadows.css`, and the Bricks JSONs always emit regardless. Pattern `states` reference shadows via `"shadow": "<name>"`, compiled to `filter: drop-shadow(var(--shadow-<name>))`.

## Build system

All tasks go through `npx vp run <name>` (see [vite.config.ts](vite.config.ts)). The chain is `build` → `build:css` → `generate:theme` (`dependsOn`), then `build:js` runs after `build:css`.

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
