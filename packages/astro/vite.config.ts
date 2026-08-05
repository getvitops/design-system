import { defineConfig } from 'vite-plus';

// Node library build for @getvitops/astro. Externalises parse5 + astro.
//
// `routes` is its own entry because it is the only one that runs in a **Worker**
// at request time rather than in the build: keeping it off `src/index.ts` is what
// stops a conversion endpoint pulling the whole integration — and everything the
// integration imports — into its bundle.
export default defineConfig({
  pack: {
    entry: ['src/index.ts', 'src/routes/conversion.ts'],
    outDir: 'dist',
    format: ['es'],
    platform: 'node',
    dts: true,
    clean: true,
    minify: false,
  },
});
