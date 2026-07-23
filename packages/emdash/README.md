# @getvitops/emdash

EmDash CMS **native plugin** for the Vitops design system. It gives content
editors Vitops patterns as Portable Text blocks in the EmDash admin
(`/_emdash/admin`) — inserted from the slash menu, edited with simple forms,
and rendered on the public site with the design-system web components and CSS
framework (accessible no-JS fallbacks included).

## Install

The plugin **composes with** the `getvitops()` Astro integration from
`@getvitops/astro` — the integration generates the design-system CSS and copies
the web-component bundles into `public/vitops/`; this plugin adds the
editor-facing layer. You need both:

```js
// astro.config.mjs
import react from '@astrojs/react';
import getvitops from '@getvitops/astro';
import { vitopsEmdash } from '@getvitops/emdash';
import emdash, { local } from 'emdash/astro';
import { sqlite } from 'emdash/db';

export default defineConfig({
  output: 'server',
  adapter: /* node/cloudflare */,
  integrations: [
    react(),
    getvitops({ css: { input: 'design-system.json', format: 'tailwind', out: 'src/styles' } }),
    emdash({
      database: sqlite({ url: 'file:./data.db' }),
      storage: local({ directory: './uploads', baseUrl: '/_emdash/api/media/file' }),
      plugins: [vitopsEmdash()],
    }),
  ],
});
```

Tested against `emdash@0.31.x`.

## Editor blocks (v1)

| Slash-menu entry | `_type`               | Renders                                     |
| ---------------- | --------------------- | ------------------------------------------- |
| Image compare    | `vitops.imageCompare` | `<wc-image-compare>` before/after slider    |
| Copy snippet     | `vitops.copyButton`   | `<copy-button>` with code/inline fallback   |
| Banner           | `vitops.banner`       | `<wc-dismissable>` banner with tone colours |
| Disclosure       | `vitops.details`      | native `<details>`/`<summary>`              |
| Carousel         | `vitops.carousel`     | `<wc-carousel>` scroll-snap carousel        |

All blocks render accessible markup that works without JavaScript; the
web components progressively enhance it.

## Script delivery

The web-component runtime (`/vitops/{polyfills,elements,deferred}.js`) must be
loaded on pages that render these blocks. Pick **one**:

- **`scripts: 'integration'` (default)** — your layout renders `<Head />` from
  `@getvitops/astro`, which emits the script tags.
- **`vitopsEmdash({ scripts: 'fragments' })`** — for layouts built on EmDash's
  `<EmDashHead/>`/`<EmDashBodyEnd/>` components: the plugin injects the tags
  via the `page:fragments` hook (requires the `hooks.page-fragments:register`
  capability, which the descriptor declares automatically).

Enabling both would load the scripts twice (harmless — element registration is
guarded — but wasteful).

## Repeating structured patterns

EmDash's Portable Text block fields are flat, so patterns with repeating data
(card grids, FAQ lists, spec tables via `wc-entries`, forms) are deliberately
**not** v1 blocks. Use instead:

- **Sections** (`/section`): compose the pattern once as reusable content and
  let editors insert copies.
- **Field Kit `list` widgets** on `json` collection fields: model the repeating
  rows in the collection schema and render them at the template level with
  `Cards.astro` / `NodeRenderer.astro` from `@getvitops/astro`.
