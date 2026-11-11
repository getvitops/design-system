/**
 * @getvitops/config — the site-config blocks the toolchain's provider integrations read.
 *
 * A leaf: it imports `@zod/mini` and nothing else in the workspace, which is what lets
 * `@getvitops/utils` (the provider code) import its own configuration types instead of keeping
 * a hand-copied mirror beside each module. The umbrella `Config` — the three-section document that
 * embeds a design system — stays in `@getvitops/generator`, because it needs the design-system
 * schema, which needs the token engine. These blocks need neither.
 */
export { desc } from './desc.ts';
export * from './providers.ts';
export * from './indexing.ts';
export * from './ads.ts';
export * from './reviews.ts';
export * from './crm.ts';
export * from './blocks.ts';
export * from './seo.ts';
export * from './chrome.ts';
