// @ts-check
import { existsSync } from 'node:fs';
import node from '@astrojs/node';
import { defineConfig, passthroughImageService } from 'astro/config';

// Load .env into process.env for the whole dev/build process (server code reads
// process.env directly; Vite only exposes import.meta.env). Node 20.12+ API.
if (existsSync('.env')) process.loadEnvFile('.env');

// Portable runtime: @astrojs/node (standalone) → a self-contained Node server
// (dist/server/entry.mjs) packaged as a Docker image. Runs on Cloudflare
// Containers now and any host later (k8s/ECS/Cloud Run/VPS) with zero code
// change — no Cloudflare-runtime lock-in (no adapter/workerd/D1/KV/Hyperdrive).
//
// The design-system CSS plugin (@getvitops/vite) stays disabled while that
// framework is in flux — the app uses a static wireframe stylesheet
// (src/styles/app.css). Under this Node adapter the earlier Tailwind-in-workerd
// failure no longer applies, so re-enabling it later is low-risk.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  // No image optimization needed → skip the heavy sharp dependency.
  image: { service: passthroughImageService() },
});
