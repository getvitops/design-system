---
title: "@getvitops/generator"
description: "The generator as a library, plus the published JSON Schema."
section: "Packages"
order: 40
---

```sh
npm i -D @getvitops/generator
```


Generate design-system outputs — **Bricks** (WordPress), standalone **CSS**, and **Tailwind
v4** (Astro/EmDash) — from a single `design-system.json`. This is the library that powers
[`@getvitops/cli`](https://www.npmjs.com/package/@getvitops/cli) and
[`@getvitops/vite`](https://www.npmjs.com/package/@getvitops/vite).

```ts
import { generate, validate, defaultConfig } from '@getvitops/generator';

await generate({
  input: './design-system.json', // path or a config object
  format: 'tailwind', // 'bricks' | 'css' | 'tailwind'
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
| `css`      | `styles.css` (bundled, standalone) + `tokens.json` + `design-manifest.json`                              |
| `bricks`   | `styles.min.css`, `bricks-colors-*.json`, `bricks-variables.json`, `tokens.json`, JS, `bricks/`, `docs/` |

See the [`design-system.json` schema](./schema.json) for the config shape.
