---
'@getvitops/config': minor
'@getvitops/utils': minor
'@getvitops/cli': minor
'@getvitops/astro': minor
'@getvitops/generator': minor
---

Sitemap `<lastmod>` on EmDash sites (all formats — no CSS change).

EmDash dates every CMS entry in its own `/sitemap.xml`, but cannot list `src/pages` routes and offers no way to add them; the only escape (a hand-written `sitemap.xml` route) discards its dates. Hybrid sites were left with undated pages and `search notify` advice (`gitLastmod()` in the `sitemap` option) that did nothing under EmDash.

- **`vitops({ sitemap })` now works with `emdash()` registered** (it used to warn and skip). A build writes `public/pages-sitemap.xml` for the `src/pages` routes only, dated from git, and writes **nothing** when there are none. New `sitemap.exclude` option for a page that only renders a CMS entry. A file without the generated marker is never replaced. CI needs full history (`fetch-depth: 0`); the shared `site-deploy-emdash.yml` now does this.
- **`seo.indexing.sitemapUrl` accepts a list.** Unset, `search notify` discovers `sitemap-index.xml` (Astro), `sitemap.xml` (EmDash) and `pages-sitemap.xml` and uses the ones that exist and hold a `<url>`; an explicit value turns discovery off. Previously an EmDash site with no `sitemapUrl` derived `sitemap-index.xml`, which EmDash does not serve.
- **`search notify` output lists every sitemap** with why it is there (`required for non-EmDash content (src/pages)`), submits each to Search Console, and names up to three URLs missing a `<lastmod>`. `vitops robots` emits one `Sitemap:` line per listed URL.
- Migration: none required. `@getvitops/emdash`, `@getvitops/core`, `@getvitops/vite`: No consumer-facing change in this package.
