import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  // ── JS packaging (tsdown, via `vp pack`) ──
  // Two independent ES-module entries (loaded via <script type="module">, which
  // defers by default):
  //   • polyfills.js — CRITICAL. Feature-detects + loads polyfills; belongs high
  //     in <head> so it runs as early as possible (it gates initial interaction).
  //   • deferred.js  — non-critical progressive-enhancement behaviour; can load
  //     late. Kept separate so it never delays the polyfills.
  // ESM output lets the bundler code-split each polyfill in polyfills.ts into its
  // own async chunk, so a browser downloads a polyfill ONLY when it fails that
  // feature's support test. (IIFE can't code-split — it would inline every
  // polyfill into the one file — which is why this is `es`, not `iife`.)
  pack: {
    entry: ['src/js/deferred.ts', 'src/js/polyfills.ts', 'src/js/editor.ts', 'src/js/elements.ts'],
    outDir: 'dist',
    clean: false,
    format: ['es'],
    minify: true,
    dts: false,
    platform: 'browser',
    // tsdown is a library bundler: it externalises node_modules deps by default,
    // which would leave the polyfills as bare `import()` specifiers no browser
    // can resolve. Bundle them so they ship (code-split into per-polyfill chunks)
    // from dist/. Patterns cover every polyfill package in polyfills.ts.
    deps: {
      alwaysBundle: [/polyfill/, /^@webcomponents\//, /^@oddbird\//, /^lit/, /^@lit-labs\//],
    },
    // Stable (unhashed) chunk names in a dedicated subdir. `clean: false` is
    // required (pack shares dist/ with the CSS/JSON codegen), so hashed names
    // would pile up orphaned chunks across rebuilds and ship them on deploy;
    // stable names overwrite in place. Cache-bust via the theme's enqueue version.
    outputOptions: { chunkFileNames: 'polyfills/[name].js' },
  },

  // ── Lint / format (Oxlint / Oxfmt, via `vp check` / `vp fmt`) ──
  lint: {
    ignorePatterns: ['dist/**', 'node_modules/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {
    semi: true,
    singleQuote: true,
    // Don't format generated/build output: the codegen emits its own style, so
    // formatting it just creates churn against the next `vp run build`.
    ignorePatterns: ['dist/**', 'src/css/generated/**', 'node_modules/**'],
  },

  // ── Tasks (Vite Task, via `vp run <name>`) ──
  run: {
    tasks: {
      dev: { command: 'vp dev', dependsOn: ['build'] },

      // Default full build → the Bricks target. Format-specific full builds are
      // separate `build:<type>` tasks (not a `--format` flag: vp appends
      // forwarded args to the command tail, which would corrupt the last
      // sub-task, and vp only resolves `vp run <task>` in-process when it appears
      // literally in the command — a wrapper that could parse the flag breaks it).
      build: { command: 'vp run build:bricks' },

      // Bricks full build: colours → CSS, then JS, then the Bricks PHP elements.
      // Sequential (&&) so a failure aborts before a stale deploy ships. Elements
      // copy runs last (dist/ already populated; pack.clean:false keeps it intact).
      // css/tailwind targets: use build:docs (standalone CSS) / build:tailwind.
      'build:bricks': {
        command: 'vp run build:css && vp run build:js && vp run build:elements',
      },

      // JS: bundle deferred.ts via tsdown.
      'build:js': { command: 'vp pack', output: ['dist/*.js*', 'dist/polyfills/*.js*'] },

      // Bricks custom PHP elements + theme bootstrap: copy the repo-owned sources into
      // dist/bricks/ so they ship through the same dist/ symlink/rsync the theme already
      // uses. The theme includes dist/bricks/load.php once (require_once), which registers
      // every element under dist/bricks/elements and enqueues the CSS/JS bundles.
      // elements.md ships alongside as a web-published AI context file (served at
      // <theme>/dist/bricks/elements.md), so the reference always matches the deployed
      // elements — regenerate it from bricks/elements/*.php when those change.
      'build:elements': {
        command:
          'mkdir -p dist/bricks && cp -R bricks/elements dist/bricks/ && cp bricks/load.php dist/bricks/load.php && cp bricks/elements.md dist/bricks/elements.md',
        input: ['bricks/**/*.php', 'bricks/elements.md'],
        output: ['dist/bricks/**'],
      },

      // CSS: bundle @imports + minify with lightningcss. Depends on colour
      // codegen so src/color.css exists before bundling.
      'build:css': {
        command:
          'lightningcss --minify --bundle --sourcemap -o dist/styles.min.css ./src/css/index.css',
        dependsOn: ['generate:theme'],
        // Static partials (layout.css, future patterns/*.css) are inlined by
        // lightningcss --bundle; declare them so edits bust this task's cache.
        input: ['src/css/**/*.css'],
        output: ['dist/*.css*'],
      },

      // Docs bundle: a standalone (non-Bricks) build the docsite links, so the
      // page renders self-sufficiently (colours, fonts, type scale all emitted).
      // Generates non-bricks → bundles to dist/styles.docs.css → regenerates
      // bricks so the working tree's src/css/generated/* ends in canonical
      // (committed) bricks state. Kept a plain command (not the cached
      // generate:theme) so the two generator runs stay strictly ordered.
      //
      // `input` tracks only the *true* sources: the generator, the JSON, and the
      // static partials (`src/css/*.css` does NOT recurse into `generated/`). The
      // generated CSS is fully derived from those AND is mutated by this command
      // itself (non-bricks → bricks), so tracking it would key the cache on a
      // state inconsistent with the emitted bundle and serve a stale docs build.
      'build:docs': {
        command:
          'node lib/generate-design-system.ts --format=css && lightningcss --minify --bundle -o dist/styles.docs.css ./src/css/index.css && node lib/generate-design-system.ts --format=bricks',
        input: ['lib/generate-design-system.ts', 'src/design-system.json', 'src/css/*.css'],
        output: ['dist/styles.docs.css*', 'dist/design-manifest.json'],
      },

      // Tailwind v4 bundle for Astro consumers: one self-contained dist/tailwind.css
      // (@theme + @custom-variant + @utility + inlined engine/structure/components).
      // Standalone (not in the default `build` chain). NOT piped through lightningcss —
      // the @theme/@utility/@custom-variant at-rules are Tailwind source directives that
      // must ship raw for Tailwind's own compiler. emitTailwind reads animation.css,
      // mirrors layout.css structure, and inlines every root static partial (component +
      // extended-structural CSS), so all of `src/css/*.css` are declared inputs. The glob
      // is non-recursive — it excludes `generated/`, which emitTailwind does not read.
      'build:tailwind': {
        command: 'node lib/generate-design-system.ts --format=tailwind',
        input: ['lib/generate-design-system.ts', 'src/design-system.json', 'src/css/*.css'],
        output: ['dist/tailwind.css'],
      },

      // Codegen: colors.json → src/color.css + dist/bricks-colors.json.
      // `input` is declared explicitly because vp's auto-tracker misses files
      // passed to `node` as argv (it only sees what the *task* reads, not what
      // the spawned process reads), so source edits would otherwise hit the cache.
      'generate:theme': {
        command: 'node lib/generate-design-system.ts --format=bricks',
        input: ['lib/generate-design-system.ts', 'src/design-system.json'],
        output: ['dist/bricks*', 'src/css/generated/**'],
      },

      // Deploy: rsync dist/ to the remote theme over SSH. Depends on build so
      // it always ships a fresh, complete dist/.
      deploy: {
        command: 'node --env-file=.env lib/deploy.ts',
        dependsOn: ['build'],
      },
    },
  },
});
