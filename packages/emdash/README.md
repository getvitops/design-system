# @getvitops/emdash

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

Tested against `emdash@1.4.x`.

## Rendering mode

An EmDash site **must** run `output: 'server'` with an adapter — the admin at `/_emdash/admin`,
the media and API routes, preview tokens and scheduled publishing all need a server, and
`vitopsHosting()` supplies the adapter. That makes prerendering **per-route and opt-in**, the
opposite of a plain Astro site (which should stay `output: 'static'` and opt _out_ with
`export const prerender = false` — see [`@getvitops/astro`](../astro/README.md#rendering-mode)).

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

## Editor blocks

| Slash-menu entry | `_type`               | Renders                                                    |
| ---------------- | --------------------- | ---------------------------------------------------------- |
| Link or button   | `vitops.actionLink`   | sprite-icon `<a>`, styled `.link`/`.btn`/`.cta`            |
| Image compare    | `vitops.imageCompare` | `<wc-image-compare>` before/after slider                   |
| Copy snippet     | `vitops.copyButton`   | `<wc-copy>` with code/inline fallback                      |
| Banner           | `vitops.banner`       | `<wc-dismissable>` banner with tone colours                |
| Disclosure       | `vitops.details`      | native `<details>`/`<summary>`                             |
| Accordion        | `vitops.accordion`    | a group of `<details>`; optionally one-open-at-a-time      |
| Carousel         | `vitops.carousel`     | `@getvitops/astro`'s `<Carousel />` over a Slides repeater |
| Gallery          | `vitops.gallery`      | `<Gallery />` — thumbnail grid opening a lightbox carousel |
| Cards            | `vitops.cards`        | `<Cards />` — a grid of `.card`s, whole-card click with JS |
| Marquee          | `vitops.marquee`      | `<Marquee />` — a continuously scrolling row               |

All blocks render accessible markup that works without JavaScript; the
web components progressively enhance it. Each is a thin adapter over the matching
`@getvitops/astro` component, so the markup exists once. `@getvitops/generator`'s `TIERS`
manifest lists which block renders which pattern (its `emdash` key, the `vitops docs components`
"EmDash blocks" table), and `blocks.test.ts` fails if a block and the manifest disagree.

Repeating data (cards, gallery images, accordion items, marquee items, carousel slides) is a
**repeater** field; images can be a media-library URL or any `http(s)`/relative URL. Link and image
URLs with any other scheme (`javascript:`, `data:`) are dropped at render time.

### Choosing and extending the blocks

```js
vitopsEmdash({
  blocks: {
    exclude: ['vitops.marquee'], // or `include: [...]` as an allowlist
    extra: [
      {
        type: 'acme.pricing',
        label: 'Pricing table',
        fields: [
          /* Block Kit */
        ],
      },
    ],
  },
});
```

`extra` adds **editor** definitions only. This plugin cannot render a block it has never heard of,
so the site maps each of its own types to a component, and can replace a `vitops.*` renderer the same way:

```astro
<PortableText
  value={page.data.content}
  components={{ type: { 'acme.pricing': PricingTable, 'vitops.cards': MyCards } }}
/>
```

EmDash merges renderers as built-ins, then plugin `blockComponents`, then this `components` prop, so
the site's entry wins.

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

## Patterns that contain other blocks

A Portable Text block cannot hold other blocks — a repeater's rows are scalar fields. So a section
with columns, a hero, or a card holding a button is not a `vitops.*` block. Two routes:

- A **`blocks` field** (EmDash's typed page-composition field): define block types such as `hero` or
  `split` in the seed, and map each to an Astro component built from `@getvitops/astro`
  (`Subgrid`, `Cards`, the `.split` classes) with `defineBlockComponents`.
- **Sections** (`/section`): compose the pattern once as reusable content and let editors insert copies.

EmDash's built-in `columns` block renders its children with marks only, so a `vitops.*` block placed
inside one does not render. Use a `blocks` field for layout instead.

Not yet blocks: tree, entries, reviews (`ReviewCard` reads `.vitops/reviews.json`, which needs a
build-time import rather than a filesystem read on a Worker), dialog and tabs (no component yet).

## Changelog

This package's history: [`CHANGELOG.md`](./CHANGELOG.md) (shipped in the npm tarball, so it
also reads from `node_modules/@getvitops/emdash/CHANGELOG.md`). This package versions
independently of the `@getvitops` toolchain (`core`/`generator`/`utils`/`cli`/`vite`/`astro`,
which share one version).
