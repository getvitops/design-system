import { getViteConfig } from 'astro/config';

/**
 * A separate vitest config for `src/components/container.test.ts`, the
 * `experimental_AstroContainer`-based render tests.
 *
 * Not folded into the root `vite.config.ts`: that config is shared across
 * the whole monorepo's ~830 pure tests, and Astro's Vite plugin (what
 * `getViteConfig` layers in — the thing that can parse `.astro` syntax at
 * all) has no reason to load for any of them. `vitest`'s `environment` can
 * be opted in per file with a docblock pragma; a Vite PLUGIN cannot — it is
 * a config-level concern, so this test file gets its own config instead.
 *
 * Run via `vp run test:container` (packages/astro), not the root `vp test`.
 */
// `getViteConfig` is typed over Vite's `UserConfig`, which has no `test` key — Vitest augments that
// type only where it is imported, and this file deliberately does not import it. The cast is the
// whole bridge; Vitest reads `test` off the resolved config at runtime.
export default getViteConfig({
  test: {
    include: [
      'src/components/container.test.ts',
      'src/components/head.container-test.ts',
      'src/components/sitenav.container-test.ts',
    ],
    environment: 'node',
  },
} as Parameters<typeof getViteConfig>[0]);
