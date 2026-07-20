# @getvitops/core

The Vitops design-system **framework** — the platform-agnostic primitives that the generator
turns into platform output and that `@getvitops/bricks` / `@getvitops/astro` build on:

- **CSS partials** — the variable-driven framework (layout, utilities, component patterns).
  Inert on their own; they resolve against the token layer emitted by
  [`@getvitops/generator`](https://www.npmjs.com/package/@getvitops/generator).
- **Lit web components** — progressively-enhanced custom elements (`<wc-*>`), self-registering.
- **Browser polyfills** — a feature-detected loader (Anchor Positioning, Popover, Scroll
  Timeline, …) used by both the CSS patterns and the web components.

## Subpath exports

```ts
import '@getvitops/core/polyfills'; // feature-detected polyfill loader (load high in <head>)
import '@getvitops/core/elements'; // register the Lit web components
import '@getvitops/core/deferred'; // late progressive-enhancement behaviour
```

```css
@import '@getvitops/core/css/index.css'; /* framework partials (needs generated tokens) */
```

Most consumers don't import the CSS directly — they run
[`@getvitops/generator`](https://www.npmjs.com/package/@getvitops/generator) (via the
[CLI](https://www.npmjs.com/package/@getvitops/cli) or
[Vite plugin](https://www.npmjs.com/package/@getvitops/vite)) to emit a bundled stylesheet
from their `design-system.json`, and load these JS bundles for interactivity.
