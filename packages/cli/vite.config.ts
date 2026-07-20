import { defineConfig } from 'vite-plus';

// Node CLI build for @getvitops/cli. Keeps the shebang; externalises @getvitops/generator.
export default defineConfig({
  pack: {
    entry: ['src/cli.ts'],
    outDir: 'dist',
    format: ['es'],
    platform: 'node',
    dts: true,
    clean: true,
    minify: false,
  },
});
