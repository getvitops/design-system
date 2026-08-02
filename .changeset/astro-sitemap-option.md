---
'@getvitops/astro': minor
---

Add an opt-in `sitemap` option to `getvitops()`, and link the result from `<Head />`.

`sitemap: true` registers the official `@astrojs/sitemap` for you; pass an object to configure it
(`filter`, `customPages`, `changefreq`, `priority`, `i18n`, `entryLimit`, `filenameBase`,
`serialize`, …). `<Head />` gains a matching `<link rel="sitemap">`.

```js
getvitops({ sitemap: true });
getvitops({ sitemap: { filter: (page) => !page.includes('/draft/') } });
```

`@astrojs/sitemap` is an **optional peer** — install it yourself (`pnpm add -D @astrojs/sitemap`) and
the build fails with a message saying so if you don't, rather than silently emitting nothing. The
option also needs the `site` astro.config option, since a sitemap lists absolute URLs; without it the
option warns and skips. Note `@astrojs/sitemap` enumerates **prerendered** routes only, so on an
`output: 'server'` site you'll want `export const prerender = true` on the pages you want indexed, or
`sitemap.customPages`.

**On an EmDash site, leave it off** — EmDash serves its own database-driven `/sitemap.xml`, which also
covers on-demand pages a static sitemap can't. The option detects `emdash()` and skips with a warning.
If you want both, add `sitemap()` to your own `integrations` array; getvitops detects that too and
leaves yours in charge, which is also how you reach the few `@astrojs/sitemap` options this
integration doesn't mirror.

Also fixes the `virtual:getvitops/head` type declaration, which was missing the `editor` field that
`<Head />` already reads — a type error in consumer projects that don't set `skipLibCheck`.
