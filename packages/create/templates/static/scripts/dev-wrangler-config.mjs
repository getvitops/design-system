// Local counterpart to the rewrite the CI dev-deploy workflow does: no adapter
// regenerates this site's `wrangler.jsonc` (it's a pure static build — Workers
// Static Assets, no server config to merge), so the checked-in file already
// IS the deploy config. This just suffixes the worker name and any
// custom-domain route so a local `pnpm run deploy:dev` never touches the prod
// worker, writing the result to a gitignored file rather than editing
// wrangler.jsonc in place.
//
//   pnpm run deploy:dev   → astro build && node scripts/dev-wrangler-config.mjs
//                           && wrangler deploy --config .wrangler.dev.json

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'wrangler.jsonc';
const OUT = '.wrangler.dev.json';

const raw = readFileSync(SRC, 'utf8')
  .replace(/\/\/.*$/gm, '')
  .replace(/,(\s*[}\]])/g, '$1');
const cfg = JSON.parse(raw);

cfg.name = `${cfg.name}-dev`;
cfg.routes = (cfg.routes ?? []).map((r) =>
  r?.pattern ? { ...r, pattern: `dev.${r.pattern}` } : r,
);

writeFileSync(OUT, `${JSON.stringify(cfg, null, 2)}\n`);
console.log(`Wrote ${OUT}\n  name: ${cfg.name}\n  routes: ${JSON.stringify(cfg.routes)}`);
