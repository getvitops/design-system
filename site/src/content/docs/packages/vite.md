---
title: "@getvitops/vite"
description: "Vite plugin that regenerates design-system output on build and dev."
section: "Packages"
order: 30
---

```sh
npm i -D @getvitops/vite
```


A Vite plugin that generates Vitops design-system output from a `design-system.json` during a
Vite/Astro (EmDash) build — and hot-regenerates when the config changes in dev.

```ts
// astro.config.mjs / vite.config.ts
import vitops from '@getvitops/vite';

export default {
  plugins: [
    vitops({
      input: 'design-system.json', // default
      format: 'tailwind', // 'bricks' | 'css' | 'tailwind' (default: 'tailwind')
      out: 'src/styles', // default
    }),
  ],
};
```

`input` takes a `design-system.json` **or** the larger site config that embeds one (`company.json`) — told apart by shape. A site config also supplies the site-level facts generation reads, so `legal: {}` needs no `input` of its own. `theme` picks a `designSystem.themes` entry other than the default.

Then import the generated stylesheet (Tailwind v4):

```css
@import './styles/tailwind.css';
```

## Video (`media`)

The plugin also encodes raw video, in the same run that generates your CSS:

```ts
vitops({
  input: 'design-system.json',
  media: { raw: 'raw', out: 'src/assets/processed' },
});
```

Each source becomes a **VP9/WebM**, an **H.264/MP4** fallback and a **JPG poster**. Runs are cached
on source content plus encode settings (`.vitops/media-manifest.json`), so a rebuild that changes
nothing re-encodes nothing. `ffmpeg` must be installed — it's an external tool, not an npm
dependency, and a missing one fails the build rather than silently skipping.

Full behaviour and flags: [`vitops media`](/packages/cli/).

Powered by [`@getvitops/generator`](https://www.npmjs.com/package/@getvitops/generator).
