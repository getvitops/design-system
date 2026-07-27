import { defineConfig } from 'vite-plus';

// Browser bundle build for @getvitops/core (the framework runtime), moved from the
// repo root. Four independent ES-module entries (loaded via <script type="module">):
//   • polyfills — feature-detected polyfill loader; belongs high in <head>.
//   • deferred  — non-critical progressive-enhancement behaviour; loads late.
//   • elements  — self-registering Lit web components.
//   • editor    — the opt-in live theme editor; not part of the runtime.
// ESM lets the bundler code-split each polyfill into its own async chunk, fetched
// only when its feature test fails. The polyfill/lit/webcomponents deps are bundled
// (not externalised) so the output resolves standalone in the browser.
export default defineConfig({
  pack: {
    entry: ['src/js/polyfills.ts', 'src/js/deferred.ts', 'src/js/elements.ts', 'src/js/editor.ts'],
    outDir: 'dist',
    format: ['es'],
    minify: true,
    dts: false,
    platform: 'browser',
    deps: {
      alwaysBundle: [
        /polyfill/,
        /^@webcomponents\//,
        /^@oddbird\//,
        /^lit/,
        /^@lit-labs\//,
        /colorjs/,
        /^@getvitops\/utils/,
      ],
    },
    // Stable (unhashed) chunk names in a dedicated subdir; cache-bust via the
    // theme's enqueue version, not content hashes.
    outputOptions: { chunkFileNames: 'polyfills/[name].js' },
  },
});
