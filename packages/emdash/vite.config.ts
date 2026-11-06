import { defineConfig } from 'vite-plus';

// Node library build for @getvitops/emdash (the plugin descriptor + runtime).
// The ./astro entry ships as .astro/.ts source — EmDash compiles plugin Astro
// components in the consumer's build, so only src/index.ts is packed.
export default defineConfig({
  pack: {
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: ['es'],
    platform: 'node',
    dts: true,
    clean: true,
    minify: false,
    deps: {
      // tsdown <0.23 compatibility: resolve external dependency subpaths.
      // Remove to preserve subpath imports as written (the new default).
      // https://tsdown.dev/options/dependencies#deps-resolvedepsubpath
      resolveDepSubpath: true,
      neverBundle: ['emdash', 'astro'],
    },
  },
});
