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
export * from '../types.ts';
export * from './html.ts';
export * from './types.ts';
export * from './parts.ts';
export * from './i18n.ts';
