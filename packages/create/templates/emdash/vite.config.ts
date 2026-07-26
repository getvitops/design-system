import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
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
