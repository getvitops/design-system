import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';

/**
 * A separate vitest config for `src/astro/blocks/render.container.test.ts`, the
 * `experimental_AstroContainer` render tests of the block adapters.
 *
 * Kept out of the root `vite.config.ts` for the reason `packages/astro` keeps its own: Astro's Vite
 * plugin (what `getViteConfig` layers in, and the only thing that can parse `.astro` syntax) has
 * no business loading for the monorepo's ~1600 plain-TS tests. ADR-0000 recorded the container API
 * as failing — it does fail when pulled into the ROOT config (the root excludes
 * `container.test.ts` for that reason), but under its own `getViteConfig` config it renders
 * real HTML, which is what this file does.
 *
 * Run via `vp run test:render` in this package, not the root `vp test`.
 */
export default getViteConfig({
  // `virtual:getvitops/head` is supplied by the `vitops()` integration in a real site; a stub
  // stands in so the form block's one read of it (`turnstileSiteKey`) can be driven by a test.
  resolve: {
    alias: {
      'virtual:getvitops/head': fileURLToPath(
        new URL('./src/astro/blocks/head.stub.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['src/astro/blocks/*.container.test.ts'],
    environment: 'node',
  },
} as Parameters<typeof getViteConfig>[0]);
