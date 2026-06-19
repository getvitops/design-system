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
  },
  fmt: {
    semi: true,
    singleQuote: true,
  },

  // ── Tasks (Vite Task, via `vp run <name>`) ──
  run: {
    tasks: {
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
        output: ['dist/*.css*'],
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
