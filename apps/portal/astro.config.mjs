// @ts-check
import { existsSync } from 'node:fs';
import node from '@astrojs/node';
import react from '@astrojs/react';
import vitops from '@getvitops/astro';
import { vitopsEmdash } from '@getvitops/emdash';
import { defineConfig, passthroughImageService } from 'astro/config';
import emdash, { local } from 'emdash/astro';
import { sqlite } from 'emdash/db';

// Load .env into process.env for the whole dev/build process (server code reads
// process.env directly; Vite only exposes import.meta.env). Node 20.12+ API.
if (existsSync('.env')) process.loadEnvFile('.env');

// Portable runtime: @astrojs/node (standalone) → a self-contained Node server
// (dist/server/entry.mjs) packaged as a Docker image. Runs on Cloudflare
// Containers now and any host later (k8s/ECS/Cloud Run/VPS) with zero code
// change — no Cloudflare-runtime lock-in.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  image: { service: passthroughImageService() }, // no image optimization → no sharp
  integrations: [
    // Design system, turnkey: generates favicons + PWA manifest into public/,
    // copies the web-component bundles into public/vitops/, and generates +
    // auto-injects the design-system CSS (no manual stylesheet import). <Head />
    // (in the layouts) renders the favicon/PWA + web-component tags.
    vitops({
      favicon: {
        source: 'brand/logo.svg',
        name: 'Vitops Portal',
        themeColor: '#2f6f5e',
        backgroundColor: '#0c1116',
      },
      // inject: false — Base.astro imports the stylesheet, so EmDash's
      // /_emdash/admin routes don't inherit the design system.
      css: { input: 'design-system.json', format: 'tailwind', out: 'src/styles', inject: false },
    }),
    // EmDash CMS (dogfoods @getvitops/emdash): admin at /_emdash/admin, its own
    // auth + SQLite store (portal Postgres stays untouched). react() is required
    // for the admin UI to hydrate. The vitops plugin adds the design-system
    // Portable Text blocks to the editor.
    react(),
    emdash({
      database: sqlite({ url: 'file:./emdash.db' }),
      storage: local({ directory: './uploads', baseUrl: '/_emdash/api/media/file' }),
      plugins: [vitopsEmdash()],
    }),
  ],
});
