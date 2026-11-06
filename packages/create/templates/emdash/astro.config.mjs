import { readFileSync } from 'node:fs';
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

// Favicon/PWA colours come from site.json rather than a second copy here that
// drifts when the palette changes: the browser-UI colour is the `brand-primary`
// role's hue seed. (The page background behind the maskable icon is a computed
// ramp step, not a config value, so `backgroundColor` below stays a literal.)
const site = JSON.parse(readFileSync(new URL('./site.json', import.meta.url), 'utf8'));
const colors = site.designSystem?.themes?.default?.colors ?? {};
const roleHue = (role) =>
  typeof colors.roles?.[role] === 'string' ? colors.roles[role] : colors.roles?.[role]?.hue;
const brandColor = colors.palette?.[roleHue('brand-primary')]?.seed ?? '#2e9b73';

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
        name: site.organization?.name ?? 'My EmDash Site',
        themeColor: brandColor,
        backgroundColor: '#ffffff',
      },
      // inject: false — Layout.astro imports the generated stylesheet, so
      // EmDash's /_emdash/admin routes don't inherit the design system while
      // your pages (and EmDash previews rendered through the layout) do.
      //
      // site.json is the umbrella Config — organization + site facts plus the
      // design system at designSystem.themes.default — so css.input points
      // there instead of a bare design-system.json. legal/fonts/search/ads/
      // reviews all read the same file (see AGENTS.md's "Client onboarding").
      css: { format: 'tailwind', inject: false, input: 'site.json' },
      site: { input: 'site.json' },
    }),
  ],
});
