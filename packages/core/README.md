# @getvitops/core

The Vitops design-system **framework** — the platform-agnostic primitives that the generator
turns into platform output and that `@getvitops/bricks` / `@getvitops/astro` build on:

- **CSS partials** — the variable-driven framework (layout, utilities, component patterns).
  Inert on their own; they resolve against the token layer emitted by
  [`@getvitops/generator`](https://www.npmjs.com/package/@getvitops/generator).
- **Lit web components** — progressively-enhanced custom elements (`<wc-*>`), self-registering.
- **Browser polyfills** — a feature-detected loader (Anchor Positioning, Popover, Scroll
  Timeline, …) used by both the CSS patterns and the web components.

## Most consumers never install this package

`@getvitops/astro` copies the JS bundles into your `public/vitops/` and links them from
`<Head />`, and `@getvitops/generator` inlines the CSS partials into the stylesheet it emits
from your `design-system.json`. Both reach core through their own dependency, so a normal
site lists neither the package nor the imports below.

## Subpath exports

Reach for these only when you're bypassing the integration and the generator. Install it
directly first — core is otherwise a transitive dependency, and under pnpm (or any strict
`node_modules` layout) these specifiers won't resolve from your app code:

```sh
npm i -D @getvitops/core
```

```ts
import '@getvitops/core/polyfills'; // feature-detected polyfill loader (load high in <head>)
import '@getvitops/core/elements'; // register the Lit web components
import '@getvitops/core/deferred'; // late progressive-enhancement behaviour
```

```css
@import '@getvitops/core/css/index.css'; /* framework partials (needs generated tokens) */
```

The CSS import in particular is inert on its own: the partials resolve against the token layer
[`@getvitops/generator`](https://www.npmjs.com/package/@getvitops/generator) emits (via the
[CLI](https://www.npmjs.com/package/@getvitops/cli) or
[Vite plugin](https://www.npmjs.com/package/@getvitops/vite)), so you need that output too.

## Changelog

This package's history: [`CHANGELOG.md`](./CHANGELOG.md) (shipped in the npm tarball, so it
also reads from `node_modules/@getvitops/core/CHANGELOG.md`). `@getvitops/core`, `generator`,
`utils`, `cli`, `vite` and `astro` share one version and are released together.
