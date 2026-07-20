import { defineConfig } from 'vite-plus';

// Node library build for @getvitops/astro. Externalises parse5 + astro.
export default defineConfig({
  pack: {
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: ['es'],
    platform: 'node',
    dts: true,
    clean: true,
    minify: false,
  },
});
