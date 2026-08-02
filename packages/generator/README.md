# @getvitops/generator

Generate design-system outputs — **Tailwind v4** (Astro/EmDash), **Bricks** (WordPress), an
agent-facing **`DESIGN.md`** brief, and standalone **CSS** — from a single `design-system.json`.
This is the library that powers
[`@getvitops/cli`](https://www.npmjs.com/package/@getvitops/cli) and
[`@getvitops/vite`](https://www.npmjs.com/package/@getvitops/vite).

```ts
import { generate, validate, defaultConfig } from '@getvitops/generator';

await generate({
  input: './design-system.json', // path or a config object
  format: 'tailwind', // 'tailwind' | 'bricks' | 'design' | 'css'
  outDir: './src/styles',
});
```

## API

- `generate({ input, format, outDir })` → writes the chosen format into `outDir`.
- `validate(configOrObject)` → `{ ok, errors }` against the schema.
- `defaultConfig()` → a complete starter `DesignSystem`.
- `DesignSystemSchema` / `jsonSchema` / `SCHEMA_URL` — the `zod/mini` schema, its JSON Schema,
  and the published schema URL. The schema is the single source of truth (types + validation +
  JSON Schema all derive from it). The JSON Schema ships as `@getvitops/generator/schema.json`.

## Output per format

| format     | writes                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `tailwind` | `tailwind.css` (self-contained, `@import "tailwindcss"`) + `tokens.json`                                 |
| `bricks`   | `styles.min.css`, `bricks-colors-*.json`, `bricks-variables.json`, `tokens.json`, JS, `bricks/`, `docs/` |
| `design`   | `DESIGN.md` — and nothing else                                                                           |
| `css`      | `styles.css` (bundled, standalone) + `tokens.json` + `design-manifest.json`                              |

`design` is the odd one out: it emits **no CSS**, just the agent-facing brief in
[design.md](https://github.com/google-labs-code/design.md) format — YAML token front matter plus a
prose body, meant to sit at a repo root beside `AGENTS.md` (so run it with `outDir: '.'`). It's what
you hand to a tool that has never heard of Vitops; the stylesheet formats are what the browser gets.
`Format` covers all four, and `StylesheetFormat` (`Exclude<Format, 'design'>`) is the narrower type
anything expecting an importable stylesheet uses.

`generate()` takes one format per call, so pair the brief with a stylesheet by calling it twice
(`@getvitops/cli`'s `--format` accepts a comma-separated list and does exactly that).

See the [`design-system.json` schema](./schema.json) for the config shape.

## Changelog

This package's history: [`CHANGELOG.md`](./CHANGELOG.md) (shipped in the npm tarball, so it
also reads from `node_modules/@getvitops/generator/CHANGELOG.md`). `@getvitops/core`, `generator`,
`utils`, `cli`, `vite` and `astro` share one version and are released together.
