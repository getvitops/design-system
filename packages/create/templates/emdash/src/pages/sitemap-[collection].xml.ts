/**
 * EmDash's per-collection sitemap, with the `home` entry listed as `/`.
 *
 * Without this file EmDash builds `/sitemap-pages.xml` from the `pages` urlPattern (`/{slug}`), so
 * it lists `/home` — which `astro.config.mjs` redirects to `/`, because `index.astro` serves that
 * entry at the root — and never lists `/` itself. Every other collection passes through untouched.
 */
import { homeAwareSitemap } from '@getvitops/emdash/sitemap';

export const prerender = false;

export const GET = homeAwareSitemap({ collection: 'pages', homeSlug: 'home' });
