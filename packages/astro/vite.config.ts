import { defineConfig } from 'vite-plus';

// Node library build for @getvitops/astro. Externalises parse5 + astro.
//
// `routes` and `exports/tracking` are their own entries because they are the
// ones that run in a **Worker** at request time rather than in the build:
// keeping them off `src/index.ts` is what stops a conversion endpoint pulling
// the whole integration — and everything the integration imports — into its
// bundle.
export default defineConfig({
  pack: {
    entry: ['src/index.ts', 'src/routes/conversion.ts', 'src/exports/tracking.ts'],
    outDir: 'dist',
    format: ['es'],
    platform: 'node',
    dts: true,
    clean: true,
    minify: false,
  },
});
