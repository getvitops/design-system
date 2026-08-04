/**
 * @getvitops/astro — Astro integration for the Vitops design system.
 *
 * Default export is the `vitops()` integration (favicons + PWA + web-component
 * scripts + optional CSS auto-inject). The `<Head />` component ships alongside at
 * `@getvitops/astro/Head.astro`. The framework-agnostic content-model + HTML helpers
 * now live in `@getvitops/utils` and are re-exported here for convenience.
 */
export { default } from './integration.ts';
export type {
  GetvitopsCssOptions,
  GetvitopsFaviconOptions,
  GetvitopsMediaOptions,
  GetvitopsOptions,
  GetvitopsSitemapChangeFreq,
  GetvitopsSitemapEntry,
  GetvitopsSitemapOptions,
} from './integration.ts';
export { consentCategories, resolveAnalytics } from './analytics.ts';
export type {
  AnalyticsStrategy,
  ClarityOptions,
  ConsentCategory,
  GetvitopsAnalyticsOptions,
  GetvitopsConsentOptions,
  GoogleAnalyticsOptions,
  MatomoOptions,
  OptionalConsentCategory,
  PlausibleOptions,
  ResolveAnalyticsContext,
  ResolvedAnalytics,
  ResolvedTag,
} from './analytics.ts';
// Real per-page <lastmod> for the sitemap. A helper rather than a `sitemap`
// option, because it shells out to git and returns nothing from a shallow clone —
// a caveat that belongs at the call site.
export { gitLastmod, routeFromPage, slugFromContent } from './lastmod.ts';
export type { GitLastmodOptions } from './lastmod.ts';
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
