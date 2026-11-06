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
export { resolveAds } from './ads.ts';
export type {
  GetvitopsAdProperty,
  GetvitopsAdsOptions,
  ResolveAdsContext,
  ResolvedAdTag,
  ResolvedAds,
} from './ads.ts';
export { resolveTracking, TRACKING_COOKIE } from './tracking.ts';
export type {
  GetvitopsTrackingOptions,
  ResolvedTracking,
  ResolveTrackingContext,
  TrackingCategory,
} from './tracking.ts';
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
  GatedTag,
} from './analytics.ts';
// Real per-page <lastmod> for the sitemap. A helper rather than a `sitemap`
// option, because it shells out to git and returns nothing from a shallow clone —
// a caveat that belongs at the call site.
// Strict-CSP helpers: SHA-256 hashes of the inline scripts <Head /> emits, and a
// starting policy built on them. Build-time (node:crypto), like gitLastmod.
export { contentSecurityPolicy, cspScriptHash, inlineScriptHashes } from './csp.ts';
export type { ContentSecurityPolicyOptions, InlineScriptOptions } from './csp.ts';
export { gitLastmod, routeFromPage, slugFromContent } from './lastmod.ts';
export type { GitLastmodOptions } from './lastmod.ts';
export { resolveSeo } from './seo.ts';
export { resolveSeoDefaults, mergeSeoDefaults } from './seo-defaults.ts';
export type { ResolveSeoDefaultsOptions } from './seo-defaults.ts';
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
