import cssnano from 'cssnano';
import { minifyHTMLLiterals } from 'minify-html-literals';
import postcss from 'postcss';
// `postcss-lit` reassigns `module.exports` to a plain object built from
// variables, which Node's native-ESM CJS interop doesn't reliably expose as
// named exports (named imports here fail at runtime, not just under a
// bundler) — import the default and destructure instead.
import postcssLit from 'postcss-lit';
import { defineConfig } from 'vite-plus';

const { parse: parseLitCss, stringify: stringifyLitCss } = postcssLit;

// Browser bundle build for @getvitops/core (the framework runtime), moved from the
// repo root. Five independent ES-module entries (loaded via <script type="module">):
//   • polyfills — feature-detected polyfill loader; belongs high in <head>.
//   • deferred  — non-critical progressive-enhancement behaviour; loads late.
//   • elements  — self-registering Lit web components.
//   • consent   — the opt-in consent gate + <wc-consent>; Lit-free, because it
//                 decides whether third-party tags run and so loads ahead of the
//                 element bundle rather than behind it.
//   • editor    — the opt-in live theme editor; not part of the runtime.
// ESM lets the bundler code-split each polyfill into its own async chunk, fetched
// only when its feature test fails. The polyfill/lit/webcomponents deps are bundled
// (not externalised) so the output resolves standalone in the browser.

// `minify: true` below only minifies JS — a template literal's cooked text is
// opaque to a JS minifier, so the CSS and HTML authored inside Lit's `css`/`html`
// tagged templates survive verbatim, indentation and all. Two source-level
// transforms below collapse that before rolldown ever bundles the module.
//
// Import only `postcss-lit`'s `parse`/`stringify` (typed purely against
// `postcss`), not its `rollupPostCSSLit` helper — that helper's return type is
// declared as `import("rollup").Plugin`, and `rollup` isn't resolvable from this
// package under this workspace's pnpm layout. Calling `postcss([cssnano()])`
// with that parse/stringify pair as the `syntax` is exactly what
// `rollupPostCSSLit` does internally; doing it inline avoids the unresolvable
// type and the mandatory external `postcss.config.*` its `postcss-load-config`
// call would otherwise require.
const cssLiteralMinifier = postcss([cssnano()]);

let cssHits = 0;
let htmlHits = 0;

export default defineConfig({
  pack: {
    entry: [
      'src/js/polyfills.ts',
      'src/js/deferred.ts',
      'src/js/elements.ts',
      'src/js/consent.ts',
      'src/js/editor.ts',
    ],
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
    plugins: [
      {
        name: 'vitops:minify-css-literals',
        async transform(code: string, id: string) {
          if (!id.endsWith('.ts') || id.includes('/node_modules/')) return null;
          if (!code.includes('css`')) return null;
          const result = await cssLiteralMinifier.process(code, {
            syntax: { parse: parseLitCss, stringify: stringifyLitCss },
            from: id,
            to: id,
          });
          cssHits++;
          return { code: result.css, map: null };
        },
        buildEnd() {
          // postcss-lit degrades silently: a template it can't parse gets a
          // console warning and is left untouched, not a build failure. Without
          // this, a future syntax it can't handle puts elements.js back to ~886
          // lines with nothing in the build output to say so.
          if (cssHits === 0)
            throw new Error('vitops:minify-css-literals matched no `css` templates');
        },
      },
      {
        name: 'vitops:minify-html-literals',
        transform(code: string, id: string) {
          if (!id.endsWith('.ts') || id.includes('/node_modules/')) return null;
          if (!code.includes('html`')) return null;
          const result = minifyHTMLLiterals(code, {
            fileName: id,
            // CSS templates are already owned by the plugin above; don't let
            // this library's own (differently-behaved) CSS path touch them too.
            shouldMinifyCSS: () => false,
            minifyOptions: {
              // Collapse whitespace runs to a single space rather than removing
              // them outright. Several registered components render into light
              // DOM (`createRenderRoot() → this`), where whitespace between
              // inline elements is *rendered* whitespace, not incidental source
              // formatting. `collapseWhitespace` alone can reduce a run to
              // zero; this can't.
              conservativeCollapse: true,
            },
          });
          if (!result) return null;
          htmlHits++;
          // Not `result.map`: minify-html-literals's own SourceMap type widens
          // `version` to `string | number` (a documented workaround for a
          // magic-string type bug), which doesn't satisfy rolldown's
          // SourceMapInput (`version: number`). Moot regardless — this `pack`
          // config sets no `sourcemap`, so nothing consumes it.
          return { code: result.code, map: null };
        },
        buildEnd() {
          if (htmlHits === 0)
            throw new Error('vitops:minify-html-literals matched no `html` templates');
        },
      },
      {
        name: 'vitops:dedupe-legal-comments',
        renderChunk(code: string) {
          // elements.js accumulates one @license block per source file that
          // carries one (Lit internals, polyfilled behaviour, …) — several are
          // byte-identical because the same notice covers multiple files. BSD-3
          // clause 2 (and MIT/Apache-2.0 in kind) requires reproducing each
          // *distinct* notice in redistribution, not one copy per file it came
          // from — so this hoists one verbatim copy of each and drops the rest.
          // Dropping notices entirely is a licensing call, not a build one, and
          // isn't what this does.
          const seen = new Set<string>();
          const stripped = code.replace(/\/\*\*\s*\n\s*\*\s*@license[\s\S]*?\*\//g, (block) => {
            if (seen.has(block)) return '';
            seen.add(block);
            return '';
          });
          if (seen.size === 0) return null;
          return { code: `${[...seen].join('\n')}\n${stripped}` };
        },
      },
    ],
    // Stable (unhashed) chunk names in a dedicated subdir; cache-bust via the
    // theme's enqueue version, not content hashes.
    outputOptions: { chunkFileNames: 'polyfills/[name].js' },
  },
});
