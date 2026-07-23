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
    deps: { neverBundle: ['emdash'] },
  },
});
