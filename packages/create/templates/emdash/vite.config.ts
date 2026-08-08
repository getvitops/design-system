import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
    // Design-system drift, checked on the files being committed. `--strict` makes
    // the reuse hints fail here: a hand-rolled container or a card set without
    // `subgrid` is the drift this catches, and it is only ever cheap to fix at the
    // moment it is written. `vitops lint` takes the staged paths as positionals.
    'src/**/*.{astro,html,ts,tsx,jsx,vue,svelte,css}':
      'vitops lint -i design-system.json -f tailwind --strict',
  },
  fmt: {
    ignorePatterns: ['dist/**', 'node_modules/**', 'src/styles/**', 'public/vitops/**'],
  },
  lint: {
    ignorePatterns: ['dist/**', 'node_modules/**', 'src/styles/**', 'public/vitops/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
