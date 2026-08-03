# @getvitops/vite

A Vite plugin that generates Vitops design-system output from a `design-system.json` during a
Vite/Astro (EmDash) build — and hot-regenerates when the config changes in dev.

```ts
// astro.config.mjs / vite.config.ts
import vitops from '@getvitops/vite';

export default {
  plugins: [
    vitops({
      input: 'design-system.json', // default — or a site config (company.json) that embeds one
      format: 'tailwind', // 'bricks' | 'css' | 'tailwind' (default: 'tailwind')
      out: 'src/styles', // default
    }),
  ],
};
```

`input` accepts either config kind. Pointed at a site config it builds
`designSystem.themes[theme]` (`theme` option; default the config's `defaultTheme`, else `default`)
and reads the site-level facts from the same file — so `legal: {}` needs no `input` of its own, and
the theme editor's **Save to source** writes back into that theme rather than the file root.

Then import the generated stylesheet (Tailwind v4):

```css
@import './styles/tailwind.css';
```

Powered by [`@getvitops/generator`](https://www.npmjs.com/package/@getvitops/generator).

## Changelog

This package's history: [`CHANGELOG.md`](./CHANGELOG.md) (shipped in the npm tarball, so it
also reads from `node_modules/@getvitops/vite/CHANGELOG.md`). `@getvitops/core`, `generator`,
`utils`, `cli`, `vite` and `astro` share one version and are released together.
