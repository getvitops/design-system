/**
 * The pure half of `homeAwareSitemap()` (see `sitemap.ts`), kept apart so it can be imported — and
 * tested — without loading EmDash's route module, which reads Vite-only virtual modules.
 */

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
