import react from '@astrojs/react';
import vitops from '@getvitops/astro';
import { vitopsEmdash, vitopsHosting } from '@getvitops/emdash';
import { defineConfig } from 'astro/config';
import emdash from 'emdash/astro';

// Hosting seam: adapter + EmDash database/storage for the configured target.
// Default 'cloudflare' (Workers + D1 + R2 — see wrangler.jsonc / src/worker.ts).
// To move to a Node host (VPS / docker-compose / k8s) later:
//   pnpm add @astrojs/node better-sqlite3
// then pass { target: 'node' } here (or set the HOSTING env var, which wins).
// Content lives in the database and media in storage, so switching hosts is a
// data migration, not a rewrite — see README "Hosting".
const { adapter, database, storage } = await vitopsHosting();

export default defineConfig({
  output: 'server',
  adapter,
  image: {
    layout: 'constrained',
    responsiveStyles: true,
  },
  integrations: [
    // The EmDash admin UI (/_emdash/admin) is a React app.
    react(),
    emdash({
      database,
      storage,
      // Vitops design-system blocks (image compare, copy snippet, banner,
      // disclosure, carousel) in the editor slash menu. Default 'integration'
      // script delivery: Layout.astro renders <Head /> from @getvitops/astro,
      // which emits the web-component runtime tags.
      plugins: [vitopsEmdash()],
    }),
    vitops({
      favicon: {
        source: 'src/assets/logo.svg',
        name: 'My EmDash Site',
        themeColor: '#2e9b73',
        backgroundColor: '#ffffff',
      },
      // inject: false — Layout.astro imports the generated stylesheet, so
      // EmDash's /_emdash/admin routes don't inherit the design system while
      // your pages (and EmDash previews rendered through the layout) do.
      css: { format: 'tailwind', inject: false },
    }),
  ],
});
