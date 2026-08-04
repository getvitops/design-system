import { defineConfig } from 'vite-plus';

// Node library build for @getvitops/utils. Externalises sharp + png-to-ico
// (native/heavy — loaded lazily at runtime). One entry per published subpath —
// `indexing` is separate because it is the only network-touching module here, and
// `media` because it is the only one that shells out to an external encoder.
export default defineConfig({
  pack: {
    entry: [
      'src/index.ts',
      'src/favicon.ts',
      'src/color/index.ts',
      'src/indexing/index.ts',
      'src/media/index.ts',
    ],
    outDir: 'dist',
    format: ['es'],
    platform: 'node',
    dts: true,
    clean: true,
    minify: false,
  },
});
