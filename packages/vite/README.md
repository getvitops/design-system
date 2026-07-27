# @getvitops/vite

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

Then import the generated stylesheet (Tailwind v4):

```css
@import './styles/tailwind.css';
```

Powered by [`@getvitops/generator`](https://www.npmjs.com/package/@getvitops/generator).

## Changelog

This package's history: [`CHANGELOG.md`](./CHANGELOG.md) (shipped in the npm tarball, so it
also reads from `node_modules/@getvitops/vite/CHANGELOG.md`). `@getvitops/core`, `generator`,
`utils`, `cli`, `vite` and `astro` share one version and are released together.
