// @ts-check
import vitops from '@getvitops/astro';
import { defineConfig } from 'astro/config';

export default defineConfig({
  // Pure static output — deploys as Workers Static Assets (see
  // wrangler.jsonc), no adapter and no server runtime.
  output: 'static',
  integrations: [
    vitops({
      // site.json is the umbrella Config — organization + site facts plus the
      // design system at designSystem.themes.default — so css.input points
      // there instead of a bare design-system.json. legal/robots/search/ads/
      // reviews all read the same file (see AGENTS.md's "Client onboarding").
      css: {
        input: 'site.json',
        format: 'css',
        out: 'src/styles',
      },
      webComponents: true,
    }),
  ],
});
