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
    //
    // `src/tokens.ts` is a third, sibling entry for the same reason: the
    // palette/contrast pipeline (expandPalette, checkContrast,
    // validateColorContract, patchToOverrideCss) only reaches @zod/mini-free,
    // colorjs.io-only code (@getvitops/utils/color) - no CSS bundling, no
    // lightningcss. Published as @getvitops/generator/tokens, for the EmDash
    // design-system-editor plugin route to run the exact same accessibility
    // gate generate() enforces at build time, synchronously, in a Worker,
    // before persisting an edit.
    //
    // `src/icons-sprite.ts` is a fourth, sibling entry for the same reason,
    // added after a real production 500 in a consumer: `buildIconSprite` /
    // `loadIconSvg` / `spriteId` only reach `node:module`/`node:path`/
    // `node:url` and `@iconify/utils` — no lightningcss — but `@getvitops/
    // astro`'s `Icon.astro` used to import them from the root entry, which
    // *also* re-exports `generate.ts`, so a static `import … from
    // '@getvitops/generator'` dragged lightningcss's native binary into any
    // SSR bundle that rendered `<Icon>`, regardless of `icons.engine` (the
    // import itself is unconditional even when the sprite/inline branches
    // never execute). Cloudflare Workers has no `require()` for a native
    // `.node` binary, so every request 500'd. Published as
    // `@getvitops/generator/icons-sprite`; `Icon.astro` imports from there
    // now, not the root.
    entry: ['src/index.ts', 'src/config.ts', 'src/tokens.ts', 'src/icons-sprite.ts'],
    outDir: 'dist',
    format: ['es'],
    platform: 'node',
    dts: true,
    clean: true,
    minify: false,
  },
});
