import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
    // Design-system drift, checked on the files being committed. `--strict` makes
    // the reuse hints fail here: a hand-rolled container or a card set without
    // `subgrid` is the drift this catches, and it is only ever cheap to fix at the
    // moment it is written. `vitops lint` takes the staged paths as positionals.
    'src/**/*.{astro,html,ts,tsx,jsx,vue,svelte,css}':
      'vitops lint -i site.json -f tailwind --strict',
  },
  fmt: {
    // Explicit, matching the monorepo root's style: unlike `lint`, a nested
    // `fmt` config genuinely takes effect independently here rather than
    // being root-only, so leaving these unset let this file (and anything
    // else oxfmt formats under this directory, e.g. SETUP.html's embedded
    // `<script>`) drift to a different default quote style each time
    // `vp check --fix` ran, breaking `templates.test.ts`'s byte-identical
    // mirror assertion.
    semi: true,
    singleQuote: true,
    ignorePatterns: ['dist/**', 'node_modules/**', 'src/styles/**', 'public/vitops/**'],
  },
  lint: {
    ignorePatterns: ['dist/**', 'node_modules/**', 'src/styles/**', 'public/vitops/**'],
    // `options.typeAware`/`typeCheck` commented out, not deleted: vite-plus 1.0
    // only honours those at the root config, and while this file sits nested
    // inside the getvitops/design-system monorepo (which has its own root
    // vite.config.ts), setting them here is a hard error — "typeAware is only
    // supported in the root config" — rather than the silent no-op it was
    // pre-1.0. Once `vp create @getvitops:emdash` scaffolds this file out into
    // its own project, it *becomes* that project's root config, and
    // uncommenting this is the right move there.
    // options: { typeAware: true, typeCheck: true },
  },
});
