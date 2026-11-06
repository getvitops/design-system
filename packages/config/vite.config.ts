import { defineConfig } from 'vite-plus';

// Node library build for @getvitops/config. Two entries, and the split is the point:
//   - `index`     — the zod schemas and inferred types.
//   - `providers` — closed provider lists as bare literals, with NO zod import.
// Worker-safe code in `@getvitops/utils` needs the lists as runtime values (an exhaustive
// `Record<CrmProvider, …>`, an `isAdProvider` guard), and importing them from `index` would
// keep zod in a conversion route's bundle. This list must stay in step with `exports`.
export default defineConfig({
  pack: {
    deps: {
      resolveDepSubpath: true,
    },
    entry: ['src/index.ts', 'src/providers.ts'],
    outDir: 'dist',
    format: ['es'],
    platform: 'node', // emits .mjs like every sibling; the code itself imports no Node builtin
    dts: true,
    clean: true,
    minify: false,
  },
});
