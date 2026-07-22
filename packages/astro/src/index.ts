/**
 * @getvitops/astro — Astro integration for the Vitops design system.
 *
 * Default export is the `getvitops()` integration (favicons + PWA + web-component
 * scripts + optional CSS auto-inject). The `<Head />` component ships alongside at
 * `@getvitops/astro/Head.astro`. HTML/type helpers for authoring components are
 * also re-exported.
 */
export { default } from './integration.ts';
export type {
  GetvitopsCssOptions,
  GetvitopsFaviconOptions,
  GetvitopsOptions,
} from './integration.ts';

// NOTE: ./html.ts + ./types.ts helpers are intentionally not re-exported yet —
// they import a package-root `../types.ts` that doesn't exist post-refactor
// (pre-existing breakage, unrelated to the integration). Re-add once fixed.
