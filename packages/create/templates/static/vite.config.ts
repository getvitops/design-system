import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    semi: true,
    singleQuote: true,
    // Off by default; needs `@astrojs/compiler-rs` in devDependencies.
    astro: true,
    ignorePatterns: ['dist/**', 'node_modules/**', 'src/styles/**', 'public/vitops/**'],
  },
});
