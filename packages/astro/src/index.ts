/**
 * @getvitops/astro — Astro integration for the Vitops design system.
 *
 * Default export is the `getvitops()` integration (favicons + PWA + web-component
 * scripts + optional CSS auto-inject). The `<Head />` component ships alongside at
 * `@getvitops/astro/Head.astro`. The framework-agnostic content-model + HTML helpers
 * now live in `@getvitops/utils` and are re-exported here for convenience.
 */
export { default } from './integration.ts';
export type {
  GetvitopsCssOptions,
  GetvitopsFaviconOptions,
  GetvitopsOptions,
  GetvitopsSitemapChangeFreq,
  GetvitopsSitemapEntry,
  GetvitopsSitemapOptions,
} from './integration.ts';
export { resolveSeo } from './seo.ts';
export type {
  GetvitopsSeoOptions,
  ResolvedSeo,
  SeoContext,
  SeoNameTag,
  SeoOgType,
  SeoPropertyTag,
  SeoProps,
  SeoTwitterCard,
} from './seo.ts';
export * from '@getvitops/utils';
