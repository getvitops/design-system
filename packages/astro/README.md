# @getvitops/astro

Astro integration for the Vitops design system. Generates your design-system CSS at build time,
copies the web-component bundles into `public/`, generates favicons + a PWA manifest, and gives you
a `<Head />` component that wires it all into the page.

Requires Astro >= 7 (and `astro-icon` >= 1).

```sh
npm i -D @getvitops/astro
```

## Setup

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import getvitops from '@getvitops/astro';

export default defineConfig({
  integrations: [
    getvitops({
      css: { input: 'design-system.json', format: 'tailwind', out: 'src/styles' },
      favicon: { source: 'src/assets/logo.svg', name: 'My Site', themeColor: '#0b0b0c' },
    }),
  ],
});
```

```astro
---
// src/layouts/Base.astro
import Head from '@getvitops/astro/Head.astro';
---

<html lang="en">
  <head>
    <Head />
  </head>
  <body><slot /></body>
</html>
```

`<Head />` emits the favicon/PWA tags and the web-component runtime scripts in the correct order and
priority. It does **not** emit a stylesheet `<link>` — the integration imports the generated CSS into
Astro's module graph and Astro emits that link itself.

## Options

| option          | default              | does                                                              |
| --------------- | -------------------- | ----------------------------------------------------------------- |
| `css`           | off unless given     | generate + auto-inject the design-system CSS                      |
| `css.input`     | `design-system.json` | source config                                                     |
| `css.format`    | `tailwind`           | `tailwind` \| `css` \| `bricks`                                   |
| `css.out`       | `src/styles`         | directory the generated CSS is written to                         |
| `css.inject`    | `true`               | inject the stylesheet into every SSR page                         |
| `webComponents` | `true`               | copy + link the web-component bundles                             |
| `favicon`       | off unless given     | `source`, `lowResSource`, `name`, `themeColor`, `backgroundColor` |
| `sitemap`       | off unless given     | generate `sitemap-index.xml` via `@astrojs/sitemap`               |

Set `css.inject: false` when another integration adds routes that must not inherit the design system
(e.g. EmDash's `/_emdash/admin`) — then import the generated file (`<out>/tailwind.css` or
`<out>/styles.css`) from your own layout, so only your pages are styled.

## Sitemap

`sitemap: true` registers the official [`@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
and links the result from `<Head />`. Pass an object to configure it (`filter`, `customPages`,
`changefreq`, `priority`, `i18n`, `entryLimit`, `filenameBase`, `serialize`, …):

```js
getvitops({ sitemap: { filter: (page) => !page.includes('/draft/') } });
```

Three things to know:

- **It's an optional peer — install it yourself:** `pnpm add -D @astrojs/sitemap`. Without it the
  build fails with a message telling you so, rather than silently emitting nothing.
- **It needs the `site` astro.config option**, since a sitemap lists absolute URLs. Without it the
  option warns and skips.
- **It lists prerendered routes only.** On an `output: 'server'` site, mark the pages you want
  indexed with `export const prerender = true`, or list them in `sitemap.customPages`.

**On an EmDash site, leave it off.** EmDash serves its own `/sitemap.xml` from the database, which
also covers on-demand pages a static sitemap can't; the option detects `emdash()` and skips with a
warning. The two write different filenames and so don't actually collide — if you want both (DB
content _and_ hand-authored `.astro` pages), add `sitemap()` to your own `integrations` array.
getvitops detects that too and leaves yours in charge, which is also how you reach the handful of
`@astrojs/sitemap` options this integration doesn't mirror.

## Components

Thin authoring helpers that emit the framework's HTML/CSS patterns — **none require runtime JS**:

```astro
import Subgrid from '@getvitops/astro/components/Subgrid.astro';
import Cards from '@getvitops/astro/components/Cards.astro';
import NodeRenderer from '@getvitops/astro/components/NodeRenderer.astro';
import Popover from '@getvitops/astro/components/Popover.astro';
import Details from '@getvitops/astro/components/Details.astro';
import Drawer from '@getvitops/astro/components/Drawer.astro';
import WebComponentLoader from '@getvitops/astro/components/WebComponentLoader.astro';
```

## Changelog

This package's history: [`CHANGELOG.md`](./CHANGELOG.md) (shipped in the npm tarball, so it
also reads from `node_modules/@getvitops/astro/CHANGELOG.md`). `@getvitops/core`, `generator`,
`utils`, `cli`, `vite` and `astro` share one version and are released together — install this at the
same version as your `@getvitops/cli` / `@getvitops/generator`.

Powered by [`@getvitops/generator`](https://www.npmjs.com/package/@getvitops/generator).
