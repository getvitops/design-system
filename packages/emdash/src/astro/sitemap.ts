/**
 * A home-aware per-collection sitemap for EmDash.
 *
 * EmDash builds `/sitemap-<collection>.xml` from the collection's `urlPattern` (`/{slug}`), and
 * it has no concept of a home entry. A site that serves its `home` entry at `/` (the starter's
 * `index.astro` does, and 301s `/home` to it) therefore advertises `…/home` — a redirect, not a
 * canonical URL — and never lists `/`.
 *
 * `homeAwareSitemap()` runs EmDash's own route and rewrites only the home entry's `<loc>` (and
 * its `hreflang` alternates) to the site root, leaving everything else — lastmod, images,
 * pagination, i18n — to EmDash. A site opts in by adding the route file, which EmDash's
 * `hasUserDefinedPublicRoute` then prefers over its own:
 *
 *   // src/pages/sitemap-[collection].xml.ts
 *   import { homeAwareSitemap } from '@getvitops/emdash/sitemap';
 *   export const prerender = false;
 *   export const GET = homeAwareSitemap();
 *
 * TODO(upstream): EmDash has no home-entry / per-entry URL override. When it does, delete this
 * and set it in the seed instead.
 */
import type { APIRoute } from 'astro';
// A static import on purpose. A dynamic one (even `@vite-ignore`d) is left as a runtime specifier
// that a Worker bundle cannot resolve ("No such module chunks/emdash/internal/routes/…"), so the
// route 500s; a static one is bundled with the rest of the site.
import { GET as emdashSitemap } from 'emdash/internal/routes/sitemap-_collection_.xml';
import { rewriteHomeEntry } from './sitemap-rewrite.ts';

export interface HomeAwareSitemapOptions {
  /** The collection that holds the home entry. Default `pages`. */
  collection?: string;
  /** The home entry's slug. Default `home`. */
  homeSlug?: string;
}

export function homeAwareSitemap(options: HomeAwareSitemapOptions = {}): APIRoute {
  const { collection = 'pages', homeSlug = 'home' } = options;
  return async (context) => {
    const res = await emdashSitemap(context);
    const name = context.params.collection ?? '';
    // `pages` and its pages (`pages-2`); any other collection passes through untouched.
    if (res.status !== 200 || !(name === collection || name.startsWith(`${collection}-`)))
      return res;
    return new Response(rewriteHomeEntry(await res.text(), homeSlug), {
      status: res.status,
      headers: res.headers,
    });
  };
}
