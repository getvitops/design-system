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
import vitops from '@getvitops/astro';

export default defineConfig({
  integrations: [
    vitops({
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
| `seo`           | off unless given     | site-level defaults for `<Seo />`                                 |

Set `css.inject: false` when another integration adds routes that must not inherit the design system
(e.g. EmDash's `/_emdash/admin`) — then import the generated file (`<out>/tailwind.css` or
`<out>/styles.css`) from your own layout, so only your pages are styled.

## Sitemap

`sitemap: true` registers the official [`@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/)
and links the result from `<Head />`. Pass an object to configure it (`filter`, `customPages`,
`changefreq`, `priority`, `i18n`, `entryLimit`, `filenameBase`, `serialize`, …):

```js
vitops({ sitemap: { filter: (page) => !page.includes('/draft/') } });
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
vitops detects that too and leaves yours in charge, which is also how you reach the handful of
`@astrojs/sitemap` options this integration doesn't mirror.

## `<Seo />`

Page metadata: `<title>`, description, canonical, Open Graph, Twitter cards, robots, `article:*`,
`hreflang`, verification tokens. Site-level defaults go in the integration; pages pass what differs.

```js
// astro.config.mjs
vitops({
  seo: {
    siteName: 'Acme',
    titleTemplate: '%s · Acme',
    defaultDescription: 'We make the thing.',
    openGraph: {
      locale: 'en_CA',
      image: { url: '/og.png', alt: 'Acme', width: 1200, height: 630 },
    },
    twitter: { site: '@acme' },
  },
});
```

```astro
---
import Head from '@getvitops/astro/Head.astro';
import Seo from '@getvitops/astro/Seo.astro';
---
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <Seo title={title} description={description} image={cover} />
  <Head />
</head>
```

**It owns `<title>` and `<meta name="description">` — delete yours when you adopt it.** That isn't
tidiness: it already computes the resolved title for `og:title`/`twitter:title`, and splitting the
two is how they drift out of sync. `<Head />` is orthogonal (favicons, theme-color, the
web-component runtime); use both.

Behaviour worth knowing:

- **`titleTemplate` is skipped when a page's title already equals `siteName`**, so a homepage titled
  "Acme" emits `Acme`, not `Acme · Acme`. It never applies to `defaultTitle` either.
- **Canonical needs the `site` astro.config option.** Without it, canonical, `og:url` and any
  _relative_ `og:image` are omitted rather than derived from the request — a canonical built from a
  dev or preview origin can de-index you. The integration warns at build time. Absolute image URLs
  still work.
- **`base` is handled for you.** `Astro.url.pathname` already includes it; don't prepend it yourself.
  Under the default `trailingSlash: 'ignore'` dev and build can disagree on the trailing slash, so
  pin `'always'` or `'never'` if you need a byte-stable canonical.
- **`robots` is omitted unless it says something.** `index, follow` is what crawlers already assume.
  Set `noindex`/`nofollow`/`noarchive`/`nocache`/`robotsExtras` per page, `robots` for a full
  override, or `seo.robots` for a site-wide default.
- **`twitter:card`** becomes `summary_large_image` whenever an image resolves.
- **`hreflang` alternates are explicit only.** Pass `alternates={[{ hreflang, href }, …]}` including
  the current page; nothing is inferred from a locale list, because only the page knows where its own
  translations live.
- **No JSON-LD.** The structured-data components in `./schemas/` take _entity_ data, `<Seo />` takes
  _page_ data. Compose them: `<Seo … />` then `<Organization {...org} />`.

**On an EmDash site, use `<EmDashHead>` instead** — it emits the same tags from the CMS. Rendering
both duplicates every one of them; the integration warns if you configure `seo` alongside `emdash()`.

The merge logic is a pure function, exported as `resolveSeo(defaults, props, ctx)` if you need to
drive it yourself.

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
