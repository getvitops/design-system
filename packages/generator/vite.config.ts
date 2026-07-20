import { defineConfig } from 'vite-plus';

// Node library build for @getvitops/generator. Externalises deps (lightningcss, zod);
// bundles the local .ts modules into one ESM entry with type declarations.
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
