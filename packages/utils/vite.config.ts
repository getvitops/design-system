import { defineConfig } from 'vite-plus';

// Node library build for @getvitops/utils. Externalises sharp + png-to-ico
// (native/heavy — loaded lazily at runtime). One entry per published subpath —
// `indexing`, `onboarding` and `ads` are separate because they are the
// network-touching modules here, `media` because it is the only one that shells
// out to an external encoder (ffmpeg), and `hosting` because it shells out to
// `wrangler`/`gh` for the same reason.
//
// `tracking`, `notify`, `security` and `schema` are separate for a third
// reason: they are modules that can run in a **Worker** rather than only at
// build time — `schema`'s JSON-LD builders are consumed by `.astro` schema
// components, which render at request time under `output: 'server'`. Keeping
// them off `src/index.ts` is what stops a conversion route (or a
// server-rendered page) pulling `sharp` into its bundle. None may use a Node
// builtin, `platform: 'node'` below notwithstanding.
//
// This list must stay in step with `exports` in package.json — a subpath in one
// and not the other fails at a consumer's import, not at build.
export default defineConfig({
  pack: {
    entry: [
      'src/index.ts',
      'src/favicon.ts',
      'src/color/index.ts',
      'src/indexing/index.ts',
      'src/onboarding/index.ts',
      'src/reviews/index.ts',
      'src/ads/index.ts',
      'src/media/index.ts',
      'src/notify/index.ts',
      'src/tracking/index.ts',
      'src/security/index.ts',
      'src/schema/index.ts',
      'src/hosting/index.ts',
    ],
    outDir: 'dist',
    format: ['es'],
    platform: 'node',
    dts: true,
    clean: true,
    minify: false,
  },
});
