import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  // ── JS packaging (tsdown, via `vp pack`) ──
  // Bundles the deferred behaviour script as a minified, self-executing IIFE
  // for a plain <script defer> tag — no module loader needed on the page.
  pack: {
    entry: ['src/js/deferred.ts'],
    outDir: 'dist',
    clean: false,
    format: ['iife'],
    minify: true,
    dts: false,
    platform: 'browser',
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
      dev: { command: 'vp dev' },

      // Full build: colours → CSS, then JS. Sequential (&&) so a CSS failure
      // aborts the build instead of letting a stale deploy through.
      build: { command: 'vp run build:css && vp run build:js' },

      // JS: bundle deferred.ts via tsdown.
      'build:js': { command: 'vp pack', output: ['dist/*.js*'] },

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
          'node lib/generate-design-system.ts && lightningcss --minify --bundle -o dist/styles.docs.css ./src/css/index.css && node lib/generate-design-system.ts --bricks',
        input: ['lib/generate-design-system.ts', 'src/design-system.json', 'src/css/*.css'],
        output: ['dist/styles.docs.css*'],
      },

      // Codegen: colors.json → src/color.css + dist/bricks-colors.json.
      // `input` is declared explicitly because vp's auto-tracker misses files
      // passed to `node` as argv (it only sees what the *task* reads, not what
      // the spawned process reads), so source edits would otherwise hit the cache.
      'generate:theme': {
        command: 'node lib/generate-design-system.ts --bricks',
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
