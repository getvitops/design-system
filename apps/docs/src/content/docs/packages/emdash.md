---
title: "@getvitops/emdash"
description: "EmDash CMS plugin: Portable Text block types editors can insert."
section: "Packages"
order: 70
---

```sh
npm i -D @getvitops/emdash
```


EmDash CMS **native plugin** for the Vitops design system. It gives content
editors Vitops patterns as Portable Text blocks in the EmDash admin
(`/_emdash/admin`) — inserted from the slash menu, edited with simple forms,
and rendered on the public site with the design-system web components and CSS
framework (accessible no-JS fallbacks included).

## Install

The plugin **composes with** the `vitops()` Astro integration from
`@getvitops/astro` — the integration generates the design-system CSS and copies
the web-component bundles into `public/vitops/`; this plugin adds the
editor-facing layer. You need both:

```js
// astro.config.mjs
import react from '@astrojs/react';
import vitops from '@getvitops/astro';
import { vitopsEmdash } from '@getvitops/emdash';
import emdash, { local } from 'emdash/astro';
import { sqlite } from 'emdash/db';

export default defineConfig({
  output: 'server',
  adapter: /* node/cloudflare */,
  integrations: [
    react(),
    vitops({ css: { input: 'design-system.json', format: 'tailwind', out: 'src/styles' } }),
    emdash({
      database: sqlite({ url: 'file:./data.db' }),
      storage: local({ directory: './uploads', baseUrl: '/_emdash/api/media/file' }),
      plugins: [vitopsEmdash()],
    }),
  ],
});
```

Tested against `emdash@0.31.x`.

## Rendering mode

An EmDash site **must** run `output: 'server'` with an adapter — the admin at `/_emdash/admin`,
the media and API routes, preview tokens and scheduled publishing all need a server, and
`vitopsHosting()` supplies the adapter. That makes prerendering **per-route and opt-in**, the
opposite of a plain Astro site (which should stay `output: 'static'` and opt _out_ with
`export const prerender = false` — see [`@getvitops/astro`](/packages/astro/)).

So on an EmDash site:

- **Put `export const prerender = true` on every page that doesn't need per-request data** — the
  home page, legal pages, anything whose content is known at build time. A route with no
  `prerender` export is rendered again for every visitor on every request.
- **Give dynamic routes a `getStaticPaths()`** so database-backed pages build to static HTML too.
  Query the collection at build time and return one entry per path:

  ```astro
  ---
  // src/pages/[...slug].astro
  import { getEmDashCollection, getEmDashEntry } from 'emdash';
  import { PortableText } from 'emdash/ui';
  import Layout from '../layouts/Layout.astro';

  export const prerender = true;

  export async function getStaticPaths() {
    const { entries } = await getEmDashCollection('pages', { status: 'published' });
    return entries.map((entry) => ({ params: { slug: entry.slug } }));
  }

  const { slug } = Astro.params;
  const { entry: page } = await getEmDashEntry('pages', slug);
  ---

  <Layout title={page.data.title}>
    <PortableText value={page.data.content} />
  </Layout>
  ```

The trade-off is deliberate and worth stating: **a prerendered page reflects the database as of the
last build**, so publishing from the admin only appears after a redeploy. Leave a route
server-rendered when that is unacceptable — the preview route (draft content is served at request
time via a signed token), a page that must go live within seconds, or anything personalised. That
is the narrow case, not the default.

One exception to the exception: if you are building a **distributable EmDash theme** rather than a
site, EmDash's own guidance is that content pages must stay server-rendered, since a theme's users
edit content through the admin and expect it live. The rule above is for a site you build and
deploy yourself.

## Hosting seam: `vitopsHosting()`

One call resolves the Astro adapter + EmDash database/storage for a hosting
target, so a site can start on Cloudflare and later move to a Node host
(VPS / docker-compose / k8s) — or back — by flipping one value:

```js
// astro.config.mjs
import { vitopsEmdash, vitopsHosting } from '@getvitops/emdash';

const { adapter, database, storage } = await vitopsHosting();

export default defineConfig({
  output: 'server',
  adapter,
  integrations: [react(), emdash({ database, storage, plugins: [vitopsEmdash()] })],
});
```

| Target                 | Adapter                      | Database                                | Storage                  | Install                                               |
| ---------------------- | ---------------------------- | --------------------------------------- | ------------------------ | ----------------------------------------------------- |
| `cloudflare` (default) | `@astrojs/cloudflare`        | D1 (`binding: 'DB'`, `session: 'auto'`) | R2 (`binding: 'MEDIA'`)  | `pnpm add @astrojs/cloudflare @emdash-cms/cloudflare` |
| `node`                 | `@astrojs/node` (standalone) | SQLite (`file:./data/emdash.db`)        | local (`./data/uploads`) | `pnpm add @astrojs/node better-sqlite3`               |

- Target precedence: `HOSTING` env var > `options.target` > `'cloudflare'`.
- Adapter packages are resolved lazily — install only the stack you use; a
  missing one fails with install instructions.
- Overrides: `vitopsHosting({ cloudflare: { dbBinding, mediaBinding, session } })`
  or `vitopsHosting({ node: { databaseUrl, uploadsDir, database, storage } })` —
  the `database`/`storage` escape hatches take full descriptors, e.g.
  `postgres()` from `emdash/db` or `s3()` from `emdash/astro` for production
  Node hosts.
- On Node, scheduled publishing runs in-process — no worker/cron trigger.
- Switching an existing site is a data migration, not a rewrite: content lives
  in the database (D1 export / EmDash seed round-trip), media in the storage
  backend (bucket/directory copy). Both directions work.

## Editor blocks (v1)

| Slash-menu entry | `_type`               | Renders                                     |
| ---------------- | --------------------- | ------------------------------------------- |
| Image compare    | `vitops.imageCompare` | `<wc-image-compare>` before/after slider    |
| Copy snippet     | `vitops.copyButton`   | `<wc-copy>` with code/inline fallback   |
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
