import { defineConfig } from 'vite-plus';

// Node library build for @getvitops/utils. Externalises sharp + png-to-ico
// (native/heavy — loaded lazily at runtime). Two entries: index + favicon subpath.
export default defineConfig({
  pack: {
    entry: ['src/index.ts', 'src/favicon.ts'],
    outDir: 'dist',
    format: ['es'],
    platform: 'node',
    dts: true,
    clean: true,
    minify: false,
  },
});
