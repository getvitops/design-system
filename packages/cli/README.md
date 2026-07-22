# @getvitops/cli

CLI for the Vitops design-system generator. Turn a `design-system.json` into Bricks, CSS, or
Tailwind v4 output.

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

| command                                            | does                                          |
| -------------------------------------------------- | --------------------------------------------- |
| `vitops init [--out design-system.json] [--force]` | write a starter config with `$schema`         |
| `vitops validate <file>`                           | schema-check (non-zero exit on error)         |
| `vitops generate -i <file> -f <formats> -o <dir>`  | generate `bricks` / `css` / `tailwind` output |
| `vitops favicon -i <svg\|png> -o <dir>`            | generate a favicon set from a source image    |
| `vitops agents [-o AGENTS.md] [--docs-dir <dir>]`  | teach AI agents about the design system       |

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

## Teaching AI agents (`vitops agents`)

So an AI coding agent in a consumer project can discover the design system, `vitops agents`
writes a small, marker-delimited **managed block** into your `AGENTS.md` (idempotent — re-run to
update) and emits the reference docs bundle it points at:

```sh
vitops agents                                   # updates ./AGENTS.md, docs → ./.vitops/docs
vitops agents --out CLAUDE.md --docs-dir docs/vitops --input design-system.json
```

The block lists the CLI commands and points at the generated class vocabulary
(`<docs-dir>/css/classes.md`) and Bricks element reference (`<docs-dir>/bricks/elements.md`), both
derived from your `design-system.json`. Re-running only replaces the content between the
`<!-- vitops:start -->` / `<!-- vitops:end -->` markers, leaving the rest of the file untouched. If
you'd rather not commit the generated docs, add your `--docs-dir` (e.g. `.vitops/`) to
`.gitignore` and run `vitops agents` in a postinstall/CI step.

Powered by [`@getvitops/generator`](https://www.npmjs.com/package/@getvitops/generator).
