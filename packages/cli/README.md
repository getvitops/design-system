# @getvitops/cli

CLI for the Vitops design-system generator. Turn a `design-system.json` into Tailwind v4,
Bricks, `DESIGN.md`, or standalone CSS output.

```sh
# scaffold a starter config (stamps a $schema for editor autocomplete)
npx vitops init

# validate it against the schema
npx vitops validate design-system.json

# generate output (comma-separate formats)
npx vitops generate --input design-system.json --format tailwind --out src/styles
npx vitops generate --format bricks,css --out dist
```

## Commands

| command                                            | does                                            |
| -------------------------------------------------- | ----------------------------------------------- |
| `vitops init [--out design-system.json] [--force]` | write a starter config with `$schema`           |
| `vitops validate <file>`                           | schema-check (non-zero exit on error)           |
| `vitops generate -i <file> -f <formats> -o <dir>`  | `tailwind` / `bricks` / `design` / `css` output |
| `vitops favicon -i <svg\|png> -o <dir>`            | generate a favicon set from a source image      |
| `vitops agents [-o AGENTS.md] [--docs-dir <dir>]`  | link the agent skill + AGENTS.md pointer        |
| `vitops docs [topic] [--all]`                      | print live reference docs to stdout             |
| `vitops search notify [--dry] [--check]`           | tell search engines about a deploy              |
| `vitops media [--raw <dir>] [-o <dir>]`            | encode raw video to WebM + MP4 + poster         |

Every `--input` takes a `design-system.json` **or** the larger site config that embeds one
(`company.json` / `site.json`) — told apart by shape, so name the file whatever you like. Add
`--theme <name>` to build a `designSystem.themes` entry other than the default. `vitops validate`
routes the same way and checks a site config as a site config.

## Using the output

**Tailwind / Astro (EmDash).** Generate into your styles dir and import it (Tailwind v4):

```sh
vitops generate --input design-system.json --format tailwind --out src/styles
```

```css
@import './styles/tailwind.css';
```

(Or use [`@getvitops/vite`](https://www.npmjs.com/package/@getvitops/vite) to generate on
build/dev automatically.)

**WordPress / Bricks.** `--format bricks` writes a full, deployable theme payload: the CSS
bundle, the Bricks color/variable import JSON, the JS bundles, the custom `bricks/` elements,
and the `docs/` reference. Generate it into your Bricks **child theme's `dist/` directory**:

```sh
vitops generate --input design-system.json --format bricks --out wp-content/themes/bricks-child/dist
```

Then wire it up **once** — add this to the child theme's `functions.php` so the deployed loader
registers the elements and enqueues the CSS/JS:

```php
// Load the Vitops design system (elements + enqueued assets), if deployed.
$vitops = get_stylesheet_directory() . '/dist/bricks/load.php';
if ( file_exists( $vitops ) ) {
    require_once $vitops;
}
```

`dist/bricks/load.php` registers every element under a "Vitops" builder category, enqueues
`styles.min.css` + the JS bundles (versioned by mtime for cache-busting), and serves the
`docs/` bundle at `<theme>/dist/docs/`. Import `dist/bricks-colors-*.json` and
`dist/bricks-variables.json` into Bricks' Color + Variables managers.

### Shipping the output

The CLI only writes files — how they reach WordPress is up to you:

- **Local dev (WPLocal etc.):** point `--out` straight at the site's theme `dist/`, or symlink
  that `dist/` to your build output once so every regenerate is picked up automatically.
- **Remote:** rsync the generated directory to the theme over SSH —

  ```sh
  rsync -avz --delete dist/ user@host:wp-content/themes/bricks-child/dist/
  ```

- **CI:** run `vitops generate --format bricks` in your pipeline and deploy the artifact the
  same way you deploy the rest of the theme.

**Agent brief (`DESIGN.md`).** `--format design` emits a single `DESIGN.md` and **no CSS** — the
portable brief in [design.md](https://github.com/google-labs-code/design.md) format (YAML token
front matter, then prose) for a coding agent or design tool that doesn't have the toolchain
installed. It conventionally lives at the repo root beside `AGENTS.md`:

```sh
vitops generate --input design-system.json --format design --out .
```

`--format` is comma-separated, but a run shares one `--out` — so keep the brief its own invocation
whenever your stylesheet goes somewhere other than the repo root. Regenerate it with your CSS; it's
derived from the same config, so it can't drift from what the browser gets.

## Video (`vitops media`)

Keep unprocessed video in a `raw/` directory and encode it into web-ready outputs:

```sh
vitops media --raw raw --out src/assets/processed
```

Each source becomes three files — VP9/WebM, an H.264/MP4 fallback, and a JPG poster frame:

```astro
---
import hero from '../assets/processed/hero.webm';
import poster from '../assets/processed/hero.jpg';
---
<video poster={poster.src} autoplay muted loop playsinline>
  <source src={hero} type="video/webm" />
</video>
```

Outputs land under `src/` so your bundler content-hashes them and they can be served immutable,
while the raw sources stay outside anything it scans.

Defaults: capped at 1920px wide, CRF 32, audio dropped (the common case is a muted autoplay loop),
poster taken from frame 0. Every one is a flag — `--max-width`, `--crf`, `--audio`,
`--poster-time`, `--max-bitrate`, `--outputs`. `vitops media --dry` prints exactly what a run
would do without encoding anything.

**Needs `ffmpeg` on `PATH`.** It's an external tool, not an npm dependency — install it yourself
(`brew install ffmpeg`, `apt install ffmpeg`, `winget install Gyan.FFmpeg`). The command fails
rather than skipping: a page referencing a video that was never encoded is broken, not degraded.

**Commit the outputs and `.vitops/media-manifest.json`.** Runs are cached on source content plus
encode settings, so a second run costs a hash per file instead of minutes — but a fresh CI clone
has neither, and would re-encode everything. Committing both means CI never needs ffmpeg at all.
It also keeps your history clean: ffmpeg output isn't reproducible across versions, so a CI
re-encode would rewrite every video on any toolchain bump. Use `--force` when you mean to
re-encode, and commit the result.

Two things worth knowing before you conclude something is broken:

- **Frame 0 is often black** on a clip that fades in. That's `--poster-time`, not a bug.
- **A missing output re-encodes, a corrupt manifest re-encodes everything.** Neither ever reads as
  "already done" — the failure that would cause is silent, and a rebuild would never fix it.

## Teaching AI agents (`vitops agents` + `vitops docs`)

This package **ships an agent skill** (`skill/SKILL.md`, the [Agent Skills](https://code.claude.com/docs/en/skills)
format) that teaches AI coding agents to fetch design-system context on demand. Nothing is
generated into your repo — reference docs print live via `vitops docs`:

```sh
vitops docs                # list topics
vitops docs classes        # the class vocabulary, rendered from YOUR design-system.json
vitops docs authoring      # every config field, from the JSON Schema
vitops docs formats        # tailwind vs css vs bricks (incl. which utilities Tailwind owns)
```

Because output is rendered at call time from your config + the installed package version, it is
never stale. `vitops agents` wires up discovery:

```sh
vitops agents                                   # links the skill + updates ./AGENTS.md
vitops agents --out CLAUDE.md                   # different pointer file
```

It symlinks `.agents/skills/vitops-design-system` and `.claude/skills/vitops-design-system` to the
skill inside the installed package (the links target the logical `node_modules/@getvitops/cli/skill`
path, so they survive version bumps and reinstalls — re-run only if you delete them), and writes a
marker-delimited **managed block** into your `AGENTS.md` listing the CLI commands and `vitops docs`
topics. Re-running only replaces the content between the `<!-- vitops:start -->` /
`<!-- vitops:end -->` markers.

Prefer materialized files (offline/CI contexts, or agents that can't run commands)? The legacy
layout still works: `vitops agents --docs-dir .vitops/docs` writes the full docs bundle as files
and points the AGENTS.md block at them (no skill link).

Powered by [`@getvitops/generator`](https://www.npmjs.com/package/@getvitops/generator).

## Changelog

This package's history: [`CHANGELOG.md`](./CHANGELOG.md) (shipped in the npm tarball, so it
also reads from `node_modules/@getvitops/cli/CHANGELOG.md`). `@getvitops/core`, `generator`,
`utils`, `cli`, `vite` and `astro` share one version and are released together.
