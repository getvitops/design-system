---
'@getvitops/emdash': minor
'@getvitops/create': patch
---

**Fixed: the EmDash starter's sitemap listed the homepage as `/home` and never `/`.** EmDash builds `/sitemap-pages.xml` from the collection's `urlPattern` (`/{slug}`) and has no home-entry concept, so a site that serves its `home` entry at `/` advertised a redirect and omitted the real URL.

`@getvitops/emdash` adds a `./sitemap` export, `homeAwareSitemap({ collection, homeSlug })`, a route handler that runs EmDash's own per-collection sitemap and rewrites only the home entry's `<loc>` (and its `hreflang` alternates, with or without a locale prefix) to the site root. The `emdash` template ships it as `src/pages/sitemap-[collection].xml.ts`, which EmDash prefers over its built-in route; the `/home` → `/` redirect stays for old links. **Migration for existing sites:** add that one file (`export const GET = homeAwareSitemap();`, `prerender = false`). It wraps an `internal/` export of EmDash (a static import, so a Worker bundle includes it), pinned by a test; EmDash has no per-entry URL override upstream yet.

`@getvitops/generator`, `@getvitops/astro` and the rest of the toolchain: no consumer-facing change.
