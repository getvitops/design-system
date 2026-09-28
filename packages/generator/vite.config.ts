import { defineConfig } from 'vite-plus';

// Node library build for @getvitops/generator. Externalises deps (lightningcss, zod);
// bundles the local .ts modules into one ESM entry with type declarations.
export default defineConfig({
  pack: {
    deps: {
      // tsdown <0.23 compatibility: resolve external dependency subpaths.
      // Remove to preserve subpath imports as written (the new default).
      // https://tsdown.dev/options/dependencies#deps-resolvedepsubpath
      resolveDepSubpath: true,
    },
    // `src/config.ts` is a second, standalone entry — not a re-export of the
    // main one — because it's the Worker-safe half: the `Config` schema,
    // validator and resolvers have no `node:fs`/`node:crypto`/lightningcss in
    // their own import graph (verified: they only reach `@zod/mini`,
    // `./schema.ts`/`shared.ts`/`token-refs.ts`/`tokens.ts`, and
    // `@getvitops/utils`'s own Worker-safe `ads`/`tracking` subpaths), while
    // `src/index.ts` also re-exports `generate.ts`/`docs.ts`/`legal/` — which
    // do use those Node builtins — pulling them into any bundle that imports
    // the root entry at all. Published as `@getvitops/generator/config`; see
    // that export's docblock in `config.ts` for what it's for.
    entry: ['src/index.ts', 'src/config.ts'],
    outDir: 'dist',
    format: ['es'],
    platform: 'node',
    dts: true,
    clean: true,
    minify: false,
  },
});
