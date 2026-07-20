import { defineConfig } from 'vite-plus';

// Node library build for @getvitops/vite. Externalises vite + @getvitops/generator.
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
