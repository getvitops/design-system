---
title: Installation
description: Install the Vitops toolchain and generate your first output — for Astro, Tailwind, WordPress/Bricks, or plain CSS.
sidebar:
  order: 10
---

Every package in the toolchain shares one version. Install `@getvitops/cli` and let it pull the
rest, or add the integration for your platform directly.

## Pick your entry point

### Astro (recommended)

`@getvitops/astro` wraps the generator, the Vite plugin, favicon generation and the web-component
bundles behind a single integration.

```sh
npm i -D @getvitops/astro
```

```js title="astro.config.mjs"
import { defineConfig } from 'astro/config';
import getvitops from '@getvitops/astro';

export default defineConfig({
  integrations: [
    getvitops({
      css: { input: 'design-system.json', format: 'tailwind', out: 'src/styles' },
      favicon: { source: 'src/assets/logo.svg', name: 'My Site' },
    }),
  ],
});
```

Then drop `<Head />` into your layout's `<head>` — it emits the favicon/PWA tags and the
web-component runtime in the right order:

```astro title="src/layouts/Base.astro"
---
import Head from '@getvitops/astro/Head.astro';
---
<html lang="en">
  <head><Head /></head>
  <body><slot /></body>
</html>
```

### CLI (any stack)

```sh
npm i -D @getvitops/cli
npx vitops init                                          # scaffold design-system.json
npx vitops generate --format css --out dist              # standalone stylesheet
npx vitops generate --format bricks --out <theme>/dist   # WordPress / Bricks payload
```

### Vite (non-Astro)

```sh
npm i -D @getvitops/vite
```

```js title="vite.config.ts"
import getvitops from '@getvitops/vite';

export default { plugins: [getvitops({ input: 'design-system.json', out: 'src/styles' })] };
```

## Version pinning

`@getvitops/core`, `generator`, `utils`, `cli`, `vite` and `astro` are released together and are
only supported at **matching versions**. This isn't a convention — the generator embeds a snapshot
of core's CSS and web-component bundles, while the Astro integration copies the *installed* core's
bundles into your `public/`. Mixing versions can leave the stylesheet and the components
disagreeing about what a class means.

`@getvitops/emdash` and `@getvitops/create` have no `@getvitops/*` dependencies and version
independently.

## Teach your coding agent

```sh
npx vitops agents
```

This links the packaged `vitops-design-system` skill into `.agents/skills/` and `.claude/skills/`,
and writes a managed pointer block into your `AGENTS.md`. The skill teaches agents to fetch
reference docs live from *your* config with `vitops docs <topic>` — so they get your colours, your
scales and your class vocabulary rather than a generic guess.
