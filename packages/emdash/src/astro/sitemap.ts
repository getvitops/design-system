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

export interface HomeAwareSitemapOptions {
  /** The collection that holds the home entry. Default `pages`. */
  collection?: string;
  /** The home entry's slug. Default `home`. */
  homeSlug?: string;
}

/** An optional locale prefix (`/fr`, `/pt-BR`) before the slug. */
const LOCALE = '(?:/[a-z]{2}(?:-[A-Za-z]{2,4})?)?';

/**
 * Rewrite `…/<homeSlug>` to `…/` in every `<loc>` and `hreflang` `href` of a sitemap document.
 * Only a path that is exactly the slug (or locale + slug) matches, so `/about/home` and
 * `/homepage` are left alone. Pure, so it is tested without a server.
 */
export function rewriteHomeEntry(xml: string, homeSlug = 'home'): string {
  const slug = homeSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tail = new RegExp(`^(https?://[^/<"]+${LOCALE})/${slug}(/?)$`);
  const fix = (url: string) => url.replace(tail, '$1/');
  return xml
    .replace(/<loc>([^<]*)<\/loc>/g, (_m, url: string) => `<loc>${fix(url)}</loc>`)
    .replace(
      /(\shref=")([^"]*)(")/g,
      (_m, a: string, url: string, b: string) => `${a}${fix(url)}${b}`,
    );
}

export function homeAwareSitemap(options: HomeAwareSitemapOptions = {}): APIRoute {
  const { collection = 'pages', homeSlug = 'home' } = options;
  return async (context) => {
    // Imported here, not at the top: the module reads EmDash's virtual config, which only exists
    // inside the Vite pipeline, so a plain import of this file (a test, a type check) must not load it.
    const mod = (await import(
      /* @vite-ignore */ 'emdash/internal/routes/sitemap-_collection_.xml'
    )) as { GET: APIRoute };
    const res = await mod.GET(context);
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
